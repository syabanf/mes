import { DAY, startOfDay, startOfMonth, startOfWeek, toMs } from '@mes/fixtures'
import type {
  FloorStock,
  IsoDate,
  LotStatus,
  ManufacturingOrder,
  MaterialLot,
  MaterialRequirement,
  MaterialTxnKind,
  Operation,
  RequirementStatus,
} from '@mes/types'
import type { BadgeProps } from '@mes/ui'
import type { Scoped } from '../../state/scoped'

// ─── Requirements ───────────────────────────────────────────────

/** Quantity already reserved, staged, issued or consumed against a requirement line. */
export const coveredQty = (r: MaterialRequirement) =>
  r.reservedQty + r.stagedQty + r.issuedQty + r.consumedQty
export const coveredRatio = (r: MaterialRequirement) =>
  Math.min(1, coveredQty(r) / Math.max(1, r.requiredQty))
export const shortfall = (r: MaterialRequirement) => Math.max(0, r.requiredQty - coveredQty(r))
/** Quantity still to issue to the floor: what the line needs minus what is already issued or consumed. */
export const remainingToIssue = (r: MaterialRequirement) =>
  Math.max(0, r.requiredQty - r.issuedQty - r.consumedQty)

/** Status derived from the quantities, the same rule the store applies after a material move. */
export function requirementStatusOf(r: MaterialRequirement): RequirementStatus {
  if (r.consumedQty >= r.requiredQty) return 'consumed'
  const covered = coveredQty(r)
  if (covered >= r.requiredQty) return 'ready'
  return covered > 0 ? 'partial' : 'shortage'
}

export const coverageSegments = (r: MaterialRequirement) => [
  { key: 'reserved', value: r.reservedQty, className: 'bg-info', label: 'Reserved' },
  { key: 'staged', value: r.stagedQty, className: 'bg-ink', label: 'Staged' },
  { key: 'issued', value: r.issuedQty, className: 'bg-warning', label: 'Issued' },
  { key: 'consumed', value: r.consumedQty, className: 'bg-success', label: 'Consumed' },
]

// ─── Lots ───────────────────────────────────────────────────────

export const RESERVABLE_LOT_STATUSES: LotStatus[] = ['available']
export const STAGEABLE_LOT_STATUSES: LotStatus[] = ['reserved', 'available']
export const ISSUABLE_LOT_STATUSES: LotStatus[] = ['staged', 'reserved']
export const CONSUMABLE_LOT_STATUSES: LotStatus[] = ['staged', 'reserved', 'available']

/** Why a lot cannot be deleted, or null when it can. */
export function lotDeleteBlocker(lot: MaterialLot, floorStock: readonly FloorStock[]): string | null {
  if (lot.status === 'consumed') return 'Consumed lots stay on record for traceability.'
  if (lot.status === 'reserved' || lot.status === 'staged')
    return 'The lot is locked to an order. Return or consume it first.'
  if (floorStock.some((f) => f.lotId === lot.id && f.reservedQty > 0))
    return 'Floor stock still holds a reservation on this lot.'
  return null
}

type Variant = NonNullable<BadgeProps['variant']>
export const TXN_KIND_VARIANT: Record<MaterialTxnKind, Variant> = {
  reserve: 'info',
  stage: 'ink',
  issue: 'warning',
  consume: 'success',
  return: 'muted',
  scrap: 'danger',
  receipt: 'default',
  transfer: 'outline',
}

// ─── Time windows ───────────────────────────────────────────────

export const isToday = (iso: IsoDate, now: number) => {
  const ms = toMs(iso)
  const start = startOfDay(now)
  return ms >= start && ms < start + DAY
}
export const isThisWeek = (iso: IsoDate, now: number) => toMs(iso) >= startOfWeek(now) && toMs(iso) <= now
export const isThisMonth = (iso: IsoDate, now: number) => toMs(iso) >= startOfMonth(now) && toMs(iso) <= now

// ─── Operations from the order snapshot ─────────────────────────

export function moOperations(s: Pick<Scoped, 'maps'>, mo: ManufacturingOrder | undefined): Operation[] {
  const bop = mo?.snapshot ? s.maps.bop.get(mo.snapshot.bopId) : undefined
  return bop ? [...bop.operations].sort((a, b) => a.seq - b.seq) : []
}

export function operationName(
  s: Pick<Scoped, 'maps'>,
  mo: ManufacturingOrder | undefined,
  seq: number,
): string {
  return moOperations(s, mo).find((o) => o.seq === seq)?.name ?? `Operation ${seq}`
}

// ─── Ranking ────────────────────────────────────────────────────

/** Groups by key, sums a value per group and returns the groups largest first. */
export function rankBy<T>(
  items: readonly T[],
  key: (item: T) => string,
  value: (item: T) => number = () => 1,
): { key: string; value: number; count: number }[] {
  const totals = new Map<string, { value: number; count: number }>()
  for (const item of items) {
    const k = key(item)
    const cur = totals.get(k) ?? { value: 0, count: 0 }
    totals.set(k, { value: cur.value + value(item), count: cur.count + 1 })
  }
  return [...totals].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.value - a.value)
}
