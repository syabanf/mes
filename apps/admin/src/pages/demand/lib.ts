import { fmtNumber, productOnHand, sumBy } from '@mes/fixtures'
import type {
  Demand,
  FulfillmentStrategy,
  InventoryPolicy,
  MarketingOrderItem,
  MarketingOrderStatus,
  MoSource,
  MoStatus,
} from '@mes/types'
import type { Scoped } from '../../state/scoped'

type StockScope = Pick<Scoped, 'siteId' | 'fgStock' | 'demands' | 'manufacturingOrders'>

/** Orders still expected to add finished goods, the same set replenishments/run counts as inbound. */
const INBOUND_MO_STATUSES: MoStatus[] = ['planned', 'released', 'in_progress']

/** Quantity of a demand neither allocated from stock nor handed to production yet. */
export const demandGap = (d: Demand) => Math.max(0, d.qty - d.allocatedQty - d.requirementQty)

/** Open and resolved demand still counts against stock until it is fulfilled. */
export const isLiveDemand = (d: Demand) => d.status === 'open' || d.status === 'resolved'

export interface StockProjection {
  onHand: number
  free: number
  openDemand: number
  inbound: number
  /** Free stock minus unresolved open demand plus quantity still expected from running orders. */
  projected: number
}

/** Same arithmetic as replenishments/run, so the screens predict what the check will propose. */
export function projectedStock(s: StockScope, productId: string): StockProjection {
  const { qty, free } = productOnHand(s, productId, s.siteId)
  const openDemand = sumBy(
    s.demands.filter((d) => d.productId === productId && d.status === 'open'),
    demandGap,
  )
  const inbound = sumBy(
    s.manufacturingOrders.filter((m) => m.productId === productId && INBOUND_MO_STATUSES.includes(m.status)),
    (m) => Math.max(0, m.qty - m.goodQty),
  )
  return { onHand: qty, free, openDemand, inbound, projected: free - openDemand + inbound }
}

export interface PolicyRow extends StockProjection {
  policy: InventoryPolicy
  belowReorder: boolean
}

export function policyRows(s: StockScope & Pick<Scoped, 'inventoryPolicies'>): PolicyRow[] {
  return s.inventoryPolicies.map((policy) => {
    const projection = projectedStock(s, policy.productId)
    return { policy, ...projection, belowReorder: projection.projected < policy.reorderPoint }
  })
}

/** Split of the open gap between stock and production, given the free finished goods right now. */
export function splitGap(d: Demand, free: number) {
  const gap = demandGap(d)
  const allocate = Math.min(Math.max(0, free), gap)
  return { gap, allocate, produce: gap - allocate }
}

/** "Allocate 8,000 from stock, produce 12,000" for the fulfillment table. */
export function suggestedAction(d: Demand, free: number): string {
  const { gap, allocate, produce } = splitGap(d, free)
  if (gap === 0)
    return d.status === 'fulfilled' ? 'Fulfilled' : d.status === 'cancelled' ? 'Cancelled' : 'Resolved'
  if (allocate && produce) return `Allocate ${fmtNumber(allocate)} from stock, produce ${fmtNumber(produce)}`
  if (allocate) return `Allocate ${fmtNumber(allocate)} from stock`
  return `Produce ${fmtNumber(produce)}`
}

/** How a demand has resolved so far: stock only, production only, both, or not yet. */
export function resolutionOf(d: Demand): FulfillmentStrategy | null {
  if (d.allocatedQty > 0 && d.requirementQty > 0) return 'hybrid'
  if (d.allocatedQty > 0) return 'mts'
  if (d.requirementQty > 0) return 'mto'
  return null
}

/** The strategy a demand line follows: its order line's, or the product default for demand without an order. */
export function demandStrategy(s: Pick<Scoped, 'maps'>, d: Demand): FulfillmentStrategy {
  const item = d.orderItemId ? s.maps.marketingOrderItem.get(d.orderItemId) : undefined
  if (item) return item.strategy
  if (d.source === 'replenishment') return 'mts'
  return s.maps.product.get(d.productId)?.defaultStrategy ?? 'mto'
}

/** Source an MO created from this demand should carry. */
export function moSourceFor(d: Demand): MoSource {
  if (d.source === 'replenishment') return 'mts'
  if (d.source === 'rework') return 'rework'
  if (d.source === 'internal') return 'internal'
  return 'mto'
}

/** The marketing order behind a demand line, when it has one. */
export function orderOfDemand(s: Pick<Scoped, 'maps'>, d: Demand) {
  const item = d.orderItemId ? s.maps.marketingOrderItem.get(d.orderItemId) : undefined
  return { item, order: item ? s.maps.marketingOrder.get(item.orderId) : undefined }
}

export function strategyMix(items: readonly MarketingOrderItem[]): Record<FulfillmentStrategy, number> {
  const mix: Record<FulfillmentStrategy, number> = { mto: 0, mts: 0, hybrid: 0 }
  for (const item of items) mix[item.strategy] += 1
  return mix
}

export function orderTotals(items: readonly MarketingOrderItem[]) {
  return {
    lines: items.length,
    qty: sumBy(items, (i) => i.qty),
    delivered: sumBy(items, (i) => i.deliveredQty),
  }
}

/** Where an order resumes after a hold, read from the state of its lines. */
export function resumeStatus(items: readonly MarketingOrderItem[]): MarketingOrderStatus {
  if (items.length && items.every((i) => i.status === 'ready' || i.status === 'delivered')) return 'ready'
  if (items.some((i) => i.deliveredQty > 0)) return 'partially_delivered'
  if (items.some((i) => i.status === 'in_production' || i.status === 'allocated')) return 'fulfilling'
  return 'confirmed'
}
