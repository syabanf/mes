// Marketing orders and the demands they raise; produces the list of manufacturing orders production must build.
import type {
  Demand,
  DemandSource,
  FulfillmentStrategy,
  ItemFulfillmentStatus,
  ManufacturingOrder,
  MarketingOrder,
  MarketingOrderItem,
  MarketingOrderStatus,
  MoSource,
  MoStatus,
  Priority,
  Replenishment,
  ReplenishmentStatus,
} from '../../packages/types/src/index.ts'
import { DAY, HOUR, SITE_JKT, SITE_SBY, clampPast, dayAt, iso, logEvent, pad, skipSunday } from './common.ts'
import { PRODUCT_SPECS, SBY_PRODUCT_KEYS, customers, inventoryPolicies, productId } from './master.ts'
import { rng } from './rng.ts'

export interface MoRequest {
  key: string
  siteId: string
  productKey: string
  qty: number
  source: MoSource
  demandIds: string[]
  replenishmentId: string | null
  priority: Priority
  status: MoStatus
  /** Creation instant. */
  createdAt: number
  createdBy: string
}

/** Finished goods on hand at FG-01 before allocations, per site and product key. */
export const FG_ONHAND: Record<string, Record<string, number>> = {
  [SITE_JKT]: { gb05: 22000, gb001: 45000, gb002: 16000, gb005: 12000, sb100: 900 },
  [SITE_SBY]: { gb05: 6000, gb001: 14000, gb002: 4000, gb005: 3000 },
}
const free: Record<string, Record<string, number>> = structuredClone(FG_ONHAND)

const PRODUCT_WEIGHT: [string, number][] = [
  ['gb05', 2],
  ['gb001', 3],
  ['gb002', 1.5],
  ['gb005', 2.5],
  ['gb010', 2.2],
  ['gb025', 1.8],
  ['gb050', 1.3],
  ['gb100', 1],
  ['sb100', 1],
  ['sb250', 0.8],
]

function qtyFor(key: string): number {
  const p = PRODUCT_SPECS.find((s) => s.key === key)!
  if (p.metal === 'ag') return rng.step(200, 1000, 100)
  if (p.w <= 2) return rng.step(2000, 15000, 500)
  if (p.w <= 5) return rng.step(1000, 8000, 250)
  if (p.w <= 10) return rng.step(500, 3000, 100)
  if (p.w <= 25) return rng.step(200, 1200, 50)
  return rng.step(100, 600, 50)
}

interface OrderSpec {
  siteId: string
  status: MarketingOrderStatus
  ageDays: number
  customerId?: string
  priority?: Priority
  reference?: string
  note?: string
  lines?: {
    key: string
    qty: number
    strategy: FulfillmentStrategy
    moStatus?: MoStatus
    allocateMax?: number
  }[]
  fixedAt?: number
  requiredIn?: number
}

const JKT_PLAN: MarketingOrderStatus[] = [
  ...Array<MarketingOrderStatus>(5).fill('closed'),
  ...Array<MarketingOrderStatus>(3).fill('delivered'),
  'cancelled',
  ...Array<MarketingOrderStatus>(3).fill('partially_delivered'),
  ...Array<MarketingOrderStatus>(5).fill('ready'),
  'on_hold',
  ...Array<MarketingOrderStatus>(10).fill('fulfilling'),
  'on_hold',
  ...Array<MarketingOrderStatus>(4).fill('confirmed'),
  ...Array<MarketingOrderStatus>(2).fill('draft'),
]
const SBY_PLAN: MarketingOrderStatus[] = [
  'closed',
  'closed',
  'delivered',
  'ready',
  'fulfilling',
  'fulfilling',
  'fulfilling',
  'confirmed',
]

/** Orders cluster towards today: position 0 is ~50 days old, the last one a day or two. */
const ageCurve = (i: number, n: number, span: number) =>
  Math.max(1, Math.round(span * (1 - i / (n - 1)) ** 1.6 + rng.float(-0.5, 0.5)))

const specs: OrderSpec[] = [
  ...JKT_PLAN.map((status, i): OrderSpec => ({
    siteId: SITE_JKT,
    status,
    ageDays: ageCurve(i, JKT_PLAN.length, 50),
    lines:
      status === 'cancelled'
        ? [{ key: 'gb025', qty: 400, strategy: 'mto' }]
        : status === 'on_hold'
          ? [{ key: i % 2 ? 'gb010' : 'gb050', qty: i % 2 ? 1500 : 300, strategy: 'mto' }]
          : undefined,
  })),
  ...SBY_PLAN.map((status, i): OrderSpec => ({
    siteId: SITE_SBY,
    status,
    ageDays: Math.max(2, ageCurve(i, SBY_PLAN.length, 45)),
  })),
  {
    siteId: SITE_JKT,
    status: 'confirmed',
    ageDays: 0,
    customerId: 'cus-abc',
    priority: 'high',
    reference: 'PO-ABC-2026-0917',
    fixedAt: dayAt(0, 8, 5),
    requiredIn: 7,
    note: 'Bank promotion stock; hologram with customer logo. Partial delivery of the 1g line accepted.',
    lines: [
      { key: 'gb005', qty: 10000, strategy: 'mto', moStatus: 'planned' },
      { key: 'gb001', qty: 25000, strategy: 'mts', allocateMax: 12000 },
    ],
  },
  {
    siteId: SITE_JKT,
    status: 'draft',
    ageDays: 0,
    customerId: 'cus-investa',
    fixedAt: dayAt(0, 9, 20),
    note: 'Quote requested, awaiting customer confirmation.',
  },
]

const sbyCustomers = ['cus-nusyar', 'cus-cahaya', 'cus-permata']
const jktCustomers = customers.map((c) => c.id)

const itemStatus = (
  order: MarketingOrderStatus,
  allocated: number,
  qty: number,
  hasMo: boolean,
  deliveredLine: boolean,
): ItemFulfillmentStatus => {
  if (order === 'draft' || order === 'cancelled') return 'open'
  if (order === 'delivered' || order === 'closed' || deliveredLine) return 'delivered'
  if (order === 'ready') return 'ready'
  if (hasMo) return 'in_production'
  if (allocated >= qty) return 'ready'
  return allocated > 0 ? 'allocated' : 'open'
}

const moStatusFor = (order: MarketingOrderStatus, line: number, ageDays: number): MoStatus | null => {
  switch (order) {
    case 'closed':
    case 'delivered':
      return 'closed'
    case 'partially_delivered':
      return line === 1 ? 'closed' : 'in_progress'
    case 'ready':
      return 'completed'
    case 'fulfilling':
      return rng.chance(0.9) ? 'in_progress' : 'released'
    case 'confirmed':
      return ageDays > 4 ? 'released' : ageDays > 0 ? 'planned' : 'draft'
    case 'on_hold':
      return 'on_hold'
    case 'cancelled':
      return 'cancelled'
    default:
      return null
  }
}

interface Built {
  order: MarketingOrder
  items: MarketingOrderItem[]
  demands: Demand[]
  requests: MoRequest[]
}

const ALLOCATION_PRIORITY: MarketingOrderStatus[] = [
  'ready',
  'partially_delivered',
  'fulfilling',
  'on_hold',
  'confirmed',
]

function buildOrder(spec: OrderSpec, n: number): Built {
  const orderAt = spec.fixedAt ?? skipSunday(dayAt(-spec.ageDays, rng.int(8, 16), rng.int(0, 59)))
  const ageDays = Math.round((dayAt(0, 0) - orderAt) / DAY)
  const requiredAt = dayAt(-ageDays + (spec.requiredIn ?? rng.int(7, 21)), 17)
  const customerId =
    spec.customerId ?? (spec.siteId === SITE_JKT ? rng.pick(jktCustomers) : rng.pick(sbyCustomers))
  const customer = customers.find((c) => c.id === customerId)!
  const priority =
    spec.priority ??
    rng.weighted<Priority>([
      ['normal', 6],
      ['high', 2.5],
      ['low', 1],
      ['critical', 0.5],
    ])
  const key = `mkt-${n}`
  const order: MarketingOrder = {
    id: key,
    code: '',
    siteId: spec.siteId,
    customerId,
    orderDate: iso(orderAt),
    requiredDate: iso(requiredAt),
    priority,
    reference: spec.reference ?? `PO-${customer.code}-${String(2600 + n * 13).padStart(4, '0')}`,
    status: spec.status,
    note:
      spec.note ??
      rng.pick([
        '',
        '',
        'Deliver with insured courier.',
        'Certificate cards in customer language.',
        'Call before delivery.',
      ]),
    createdBy:
      spec.siteId === SITE_JKT
        ? rng.pick(['per-marketing', 'per-marketing', 'per-dewi-sartika'])
        : 'per-dewi-sartika',
    createdAt: iso(orderAt),
  }
  const pool =
    spec.siteId === SITE_JKT ? PRODUCT_WEIGHT : PRODUCT_WEIGHT.filter(([k]) => SBY_PRODUCT_KEYS.includes(k))
  const lineCount = rng.weighted([
    [1, 4],
    [2, 4.5],
    [3, 1.5],
  ])
  const lines = spec.lines ?? []
  while (!spec.lines && lines.length < lineCount) {
    const k = rng.weighted(pool)
    if (lines.some((l) => l.key === k)) continue
    const p = PRODUCT_SPECS.find((s) => s.key === k)!
    // Some customers want a dedicated run of a stock item (own hologram artwork), so a stock product can be ordered make-to-order.
    const dedicated = spec.siteId === SITE_SBY ? 0.4 : 0.15
    const strategy: FulfillmentStrategy =
      p.strategy === 'mts' && p.key === 'gb005' && rng.chance(0.3)
        ? 'hybrid'
        : p.strategy === 'mts' && rng.chance(dedicated)
          ? 'mto'
          : p.strategy
    lines.push({ key: k, qty: qtyFor(k), strategy })
  }
  const items: MarketingOrderItem[] = []
  const demands: Demand[] = []
  const requests: MoRequest[] = []
  lines.forEach((line, i) => {
    const lineNo = i + 1
    const itemId = `${key}-l${lineNo}`
    const usesStock = line.strategy !== 'mto'
    const deliveredLine = spec.status === 'partially_delivered' && lineNo === 1
    const open = ALLOCATION_PRIORITY.includes(spec.status) && !deliveredLine
    const want = Math.min(
      line.allocateMax ?? line.qty,
      line.strategy === 'hybrid' ? Math.floor((line.qty * 0.4) / 100) * 100 : line.qty,
    )
    let allocated = 0
    if (usesStock && open) {
      const avail = free[spec.siteId]![line.key] ?? 0
      allocated = Math.min(avail, want)
      free[spec.siteId]![line.key] = avail - allocated
      if (spec.status === 'ready' && allocated < want) {
        // A ready order is fully covered by definition: the vault held more than the base figure.
        FG_ONHAND[spec.siteId]![line.key] = (FG_ONHAND[spec.siteId]![line.key] ?? 0) + (want - allocated)
        allocated = want
      }
    } else if (usesStock && (spec.status === 'delivered' || spec.status === 'closed' || deliveredLine)) {
      allocated = want
    }
    const needsMo = line.strategy === 'mto' || (line.strategy === 'hybrid' && allocated < line.qty)
    const moStatus = needsMo ? (line.moStatus ?? moStatusFor(spec.status, lineNo, ageDays)) : null
    const status = itemStatus(spec.status, allocated, line.qty, moStatus !== null, deliveredLine)
    const moQty = line.qty - allocated
    const delivered = status === 'delivered' ? line.qty : 0
    const produced =
      moStatus === 'closed' || moStatus === 'completed'
        ? moQty
        : moStatus === 'in_progress' && rng.chance(0.3)
          ? Math.floor((moQty * 0.5) / 50) * 50
          : 0
    items.push({
      id: itemId,
      orderId: key,
      line: lineNo,
      productId: productId(line.key),
      qty: line.qty,
      uomId: 'uom-pcs',
      requiredDate: iso(requiredAt + (lineNo > 1 && rng.chance(0.3) ? 3 * DAY : 0)),
      strategy: line.strategy,
      status,
      allocatedQty: allocated,
      producedQty: Math.min(moQty, produced),
      deliveredQty: delivered,
    })
    if (spec.status === 'draft') return
    const demandId = `${key}-d${lineNo}`
    const demandStatus: Demand['status'] =
      spec.status === 'cancelled'
        ? 'cancelled'
        : status === 'delivered'
          ? 'fulfilled'
          : allocated + (moStatus && moStatus !== 'cancelled' ? moQty : 0) >= line.qty
            ? 'resolved'
            : 'open'
    demands.push({
      id: demandId,
      code: '',
      siteId: spec.siteId,
      source: 'customer',
      productId: productId(line.key),
      qty: line.qty,
      requiredDate: items[i]!.requiredDate,
      status: demandStatus,
      orderItemId: itemId,
      allocatedQty: allocated,
      requirementQty: 0,
      moIds: [],
      explanation:
        allocated >= line.qty
          ? 'Fully allocated from finished goods stock.'
          : line.strategy === 'mts'
            ? `${allocated} allocated from stock; ${line.qty - allocated} short of the make-to-stock line.`
            : 'Make-to-order item: the full quantity goes to production.',
      createdAt: iso(orderAt + HOUR),
    })
    if (moStatus) {
      requests.push({
        key: `${key}-mo${lineNo}`,
        siteId: spec.siteId,
        productKey: line.key,
        qty: moQty,
        source: 'mto',
        demandIds: [demandId],
        replenishmentId: null,
        priority,
        status: moStatus,
        createdAt: spec.fixedAt ? dayAt(0, 8, 40) : clampPast(orderAt + rng.int(2, 26) * HOUR, 30 * 60_000),
        createdBy: 'per-planner',
      })
    }
  })
  return { order, items, demands, requests }
}

// Allocate stock to the orders that need it first, then keep the creation order for numbering.
const ordered = specs.map((spec, n) => ({ spec, n }))
const priorityRank = (spec: OrderSpec) =>
  spec.reference === 'PO-ABC-2026-0917'
    ? -1
    : spec.status === 'ready'
      ? 0
      : spec.status === 'partially_delivered'
        ? 1
        : spec.status === 'fulfilling'
          ? 2
          : spec.status === 'on_hold'
            ? 3
            : 4
const built = ordered
  .slice()
  .sort((a, b) => priorityRank(a.spec) - priorityRank(b.spec) || a.n - b.n)
  .map(({ spec, n }) => buildOrder(spec, n))

built.sort((a, b) => a.order.orderDate.localeCompare(b.order.orderDate))
// The blueprint order is MKT-2026-00124; everything else numbers around it.
const FIRST_MKT = 124 - built.findIndex((b) => b.order.reference === 'PO-ABC-2026-0917')
built.forEach((b, i) => {
  b.order.code = `MKT-2026-${pad(FIRST_MKT + i)}`
})

export const marketingOrders: MarketingOrder[] = built.map((b) => b.order)
export const marketingOrderItems: MarketingOrderItem[] = built.flatMap((b) => b.items)
export const blueprintOrder = marketingOrders.find((o) => o.reference === 'PO-ABC-2026-0917')!

for (const b of built) {
  const at = Date.parse(b.order.createdAt)
  logEvent(
    b.order.siteId,
    'marketing_order.created',
    at,
    b.order.createdBy,
    `${b.order.code} created for ${customers.find((c) => c.id === b.order.customerId)!.name} with ${b.items.length} line${b.items.length > 1 ? 's' : ''}`,
  )
  if (b.order.status !== 'draft')
    logEvent(
      b.order.siteId,
      'marketing_order.confirmed',
      at + HOUR,
      b.order.createdBy,
      `${b.order.code} confirmed with ${b.items.length} lines`,
    )
}

// ─── Non-customer demands ───────────────────────────────────────

interface ExtraDemand {
  id: string
  siteId: string
  source: DemandSource
  key: string
  qty: number
  ageDays: number
  status: Demand['status']
  explanation: string
  mo: MoStatus | null
  moSource: MoSource
  priority: Priority
}

const EXTRA: ExtraDemand[] = [
  {
    id: 'dmd-int-1',
    siteId: SITE_JKT,
    source: 'internal',
    key: 'gb010',
    qty: 200,
    ageDays: 28,
    status: 'fulfilled',
    explanation: 'Exhibition samples for the Jakarta gold fair.',
    mo: 'closed',
    moSource: 'internal',
    priority: 'low',
  },
  {
    id: 'dmd-fc-1',
    siteId: SITE_JKT,
    source: 'forecast',
    key: 'gb025',
    qty: 600,
    ageDays: 12,
    status: 'resolved',
    explanation: 'Q4 forecast build for bank channel, planner approved.',
    mo: 'completed',
    moSource: 'internal',
    priority: 'normal',
  },
  {
    id: 'dmd-fc-2',
    siteId: SITE_JKT,
    source: 'forecast',
    key: 'gb050',
    qty: 300,
    ageDays: 3,
    status: 'open',
    explanation: 'Q4 forecast build, awaiting capacity on Line B.',
    mo: null,
    moSource: 'internal',
    priority: 'normal',
  },
  {
    id: 'dmd-rw-1',
    siteId: SITE_JKT,
    source: 'rework',
    key: 'gb050',
    qty: 60,
    ageDays: 6,
    status: 'resolved',
    explanation: 'Replacement bars for NCR-00042 surface scratches.',
    mo: 'completed',
    moSource: 'rework',
    priority: 'high',
  },
  {
    id: 'dmd-int-2',
    siteId: SITE_SBY,
    source: 'internal',
    key: 'gb001',
    qty: 1000,
    ageDays: 4,
    status: 'resolved',
    explanation: 'Branch showroom stock transfer to Surabaya.',
    mo: 'released',
    moSource: 'internal',
    priority: 'normal',
  },
]

const extraDemands: Demand[] = EXTRA.map((d) => ({
  id: d.id,
  code: '',
  siteId: d.siteId,
  source: d.source,
  productId: productId(d.key),
  qty: d.qty,
  requiredDate: iso(dayAt(-d.ageDays + 14, 17)),
  status: d.status,
  orderItemId: null,
  allocatedQty: 0,
  requirementQty: 0,
  moIds: [],
  explanation: d.explanation,
  createdAt: iso(dayAt(-d.ageDays, 10, 15)),
}))

const extraRequests: MoRequest[] = EXTRA.filter((d) => d.mo).map((d) => ({
  key: `${d.id}-mo`,
  siteId: d.siteId,
  productKey: d.key,
  qty: d.qty,
  source: d.moSource,
  demandIds: [d.id],
  replenishmentId: null,
  priority: d.priority,
  status: d.mo!,
  createdAt: dayAt(-d.ageDays, 11),
  createdBy: 'per-pm',
}))

// ─── Replenishments ─────────────────────────────────────────────

interface RplSpec {
  siteId: string
  key: string
  status: ReplenishmentStatus
  ageDays: number
  mo: MoStatus | null
  demandId?: string
}

const RPL: RplSpec[] = [
  { siteId: SITE_JKT, key: 'gb001', status: 'received', ageDays: 30, mo: 'closed' },
  { siteId: SITE_JKT, key: 'gb05', status: 'received', ageDays: 24, mo: 'closed' },
  { siteId: SITE_JKT, key: 'gb002', status: 'received', ageDays: 16, mo: 'closed' },
  { siteId: SITE_JKT, key: 'sb100', status: 'dismissed', ageDays: 9, mo: null },
  { siteId: SITE_JKT, key: 'gb005', status: 'in_production', ageDays: 5, mo: 'in_progress' },
  { siteId: SITE_JKT, key: 'gb05', status: 'in_production', ageDays: 3, mo: 'in_progress' },
  { siteId: SITE_JKT, key: 'gb002', status: 'approved', ageDays: 2, mo: 'released' },
  { siteId: SITE_JKT, key: 'gb05', status: 'approved', ageDays: 1, mo: 'draft' },
  { siteId: SITE_SBY, key: 'gb001', status: 'received', ageDays: 20, mo: 'closed' },
  { siteId: SITE_SBY, key: 'gb005', status: 'in_production', ageDays: 4, mo: 'in_progress' },
  { siteId: SITE_SBY, key: 'gb05', status: 'proposed', ageDays: 1, mo: null },
]

const blueprintGb001Demand = built
  .find((b) => b.order.id === blueprintOrder.id)!
  .demands.find((d) => d.productId === productId('gb001'))!
RPL.push({
  siteId: SITE_JKT,
  key: 'gb001',
  status: 'proposed',
  ageDays: 0,
  mo: null,
  demandId: blueprintGb001Demand.id,
})

export const replenishments: Replenishment[] = RPL.map((r, i) => {
  const policy = inventoryPolicies.find((p) => p.siteId === r.siteId && p.productId === productId(r.key))!
  const onHand = r.demandId
    ? (FG_ONHAND[r.siteId]![r.key] ?? 0)
    : Math.round(policy.reorderPoint * rng.float(0.35, 0.9))
  const projected = r.demandId
    ? onHand - blueprintGb001Demand.qty
    : Math.round(onHand - policy.reorderPoint * rng.float(0.1, 0.5))
  const raw = Math.max(policy.replenishQty, policy.maxStock - projected)
  return {
    id: `rpl-${i + 1}`,
    code: '',
    siteId: r.siteId,
    productId: productId(r.key),
    onHand,
    projected,
    reorderPoint: policy.reorderPoint,
    requiredQty: Math.ceil(raw / policy.productionMultiple) * policy.productionMultiple,
    status: r.status,
    demandId: r.demandId ?? null,
    moId: null,
    createdAt: iso(r.demandId ? dayAt(0, 9, 12) : dayAt(-r.ageDays, 6, 30)),
  }
})

const rplRequests: MoRequest[] = RPL.flatMap((r, i) =>
  r.mo
    ? [
        {
          key: `rpl-${i + 1}-mo`,
          siteId: r.siteId,
          productKey: r.key,
          qty: replenishments[i]!.requiredQty,
          source: 'mts' as const,
          demandIds: [],
          replenishmentId: `rpl-${i + 1}`,
          priority: 'normal' as const,
          status: r.mo,
          createdAt: dayAt(-r.ageDays, 9, 30),
          createdBy: 'per-planner',
        },
      ]
    : [],
)

// ─── Assemble and number ────────────────────────────────────────

export const demands: Demand[] = [...built.flatMap((b) => b.demands), ...extraDemands].sort((a, b) =>
  a.createdAt.localeCompare(b.createdAt),
)
demands.forEach((d, i) => {
  d.code = `DMD-${pad(200 + i)}`
})
replenishments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
replenishments.forEach((r, i) => {
  r.code = `RPL-${pad(40 + i)}`
})

if (blueprintGb001Demand.allocatedQty < blueprintGb001Demand.qty) {
  const rpl = replenishments.find((r) => r.demandId === blueprintGb001Demand.id)!
  blueprintGb001Demand.explanation = `${blueprintGb001Demand.allocatedQty} allocated from FG-01; ${blueprintGb001Demand.qty - blueprintGb001Demand.allocatedQty} short, replenishment ${rpl.code} proposed.`
}

const recent = demands.filter((d) => Date.parse(d.createdAt) > dayAt(-20, 0))
for (const d of recent)
  logEvent(
    d.siteId,
    'demand.created',
    Date.parse(d.createdAt),
    d.source === 'customer' ? 'per-marketing' : 'per-planner',
    `${d.code} raised: ${d.qty} × ${PRODUCT_SPECS.find((p) => productId(p.key) === d.productId)!.code} (${d.source})`,
  )
for (const d of recent)
  if (d.allocatedQty > 0)
    logEvent(
      d.siteId,
      'demand.allocated',
      Date.parse(d.createdAt) + 20 * 60_000,
      'per-planner',
      `${d.code}: ${d.allocatedQty} allocated from stock`,
    )
for (const r of replenishments)
  logEvent(
    r.siteId,
    'replenishment.created',
    Date.parse(r.createdAt),
    'per-planner',
    `${r.code}: projected ${r.projected} below reorder point ${r.reorderPoint}`,
  )

export const moRequests: MoRequest[] = [...built.flatMap((b) => b.requests), ...extraRequests, ...rplRequests]

/** The blueprint replenishment reads the vault as it stands once finished goods are known. */
export function settleBlueprintReplenishment(onHand: number, allocated: number): void {
  const rpl = replenishments.find((r) => r.demandId === blueprintGb001Demand.id)!
  const policy = inventoryPolicies.find((p) => p.siteId === SITE_JKT && p.productId === productId('gb001'))!
  rpl.onHand = onHand
  rpl.projected = onHand - allocated - (blueprintGb001Demand.qty - blueprintGb001Demand.allocatedQty)
  rpl.requiredQty =
    Math.ceil(Math.max(policy.replenishQty, policy.maxStock - rpl.projected) / policy.productionMultiple) *
    policy.productionMultiple
}

/** Once manufacturing orders exist, point demands and replenishments at them. */
export function linkProduction(mos: ManufacturingOrder[]): void {
  for (const mo of mos) {
    for (const demandId of mo.demandIds) {
      const d = demands.find((x) => x.id === demandId)!
      d.moIds.push(mo.id)
      if (mo.status !== 'cancelled') {
        d.requirementQty += mo.qty
        d.explanation = `${mo.qty} sent to production as ${mo.code}${d.allocatedQty ? ` after ${d.allocatedQty} from stock` : ''}.`
      }
    }
    if (mo.replenishmentId) replenishments.find((r) => r.id === mo.replenishmentId)!.moId = mo.id
  }
}

/** Finished goods allocated to open customer demand, per site and product key. */
export function allocatedStock(siteId: string, key: string): number {
  return demands
    .filter(
      (d) =>
        d.siteId === siteId &&
        d.productId === productId(key) &&
        d.status !== 'fulfilled' &&
        d.status !== 'cancelled',
    )
    .reduce((s, d) => s + d.allocatedQty, 0)
}
