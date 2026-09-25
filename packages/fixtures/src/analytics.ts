import type {
  Bop,
  Inspection,
  Machine,
  MaintenanceRecord,
  ManufacturingOrder,
  MaterialLot,
  MaterialRequirement,
  MaterialTxn,
  OeeSnapshot,
  OrgNode,
  Person,
  Product,
  ReasonCode,
  Shift,
  Specification,
  Wip,
  WorkOrder,
} from '@mes/types'
import {
  ACTIVE_WIP_STATES,
  OPEN_MO_STATUSES,
  OPEN_WO_STATUSES,
  PAUSE_REASON_LABEL,
  PRIORITIES,
  PRIORITY_RANK,
  type PauseReason,
} from '@mes/types'
import { DAY, HOUR, MINUTE, dayKey, startOfDay, toIso, toMs, wib } from './dates'
import { type CapacityRow, capacityByWorkCenter, moActualQty, shiftAt } from './derive'
import type { AppAction, AppState } from './store'

// Pure analytics over site-scoped slices of the store (blueprint phases 20 to 22).
// Nothing here touches React; pages memoise the results on the scoped state.

// ─── Dimensions ─────────────────────────────────────────────────

export type Dimension =
  | 'plant'
  | 'area'
  | 'line'
  | 'workCenter'
  | 'product'
  | 'mo'
  | 'wo'
  | 'operation'
  | 'machine'
  | 'shift'
  | 'operator'

export const DIMENSIONS: Dimension[] = [
  'plant',
  'area',
  'line',
  'workCenter',
  'product',
  'mo',
  'wo',
  'operation',
  'machine',
  'shift',
  'operator',
]

export const DIMENSION_LABEL: Record<Dimension, string> = {
  plant: 'Plant',
  area: 'Area',
  line: 'Line',
  workCenter: 'Work center',
  product: 'Product',
  mo: 'MO',
  wo: 'WO',
  operation: 'Operation',
  machine: 'Machine',
  shift: 'Shift',
  operator: 'Operator',
}

/** The finer grouping a row opens into when the user drills down. */
export const DIMENSION_NEXT: Record<Dimension, Dimension | null> = {
  plant: 'area',
  area: 'line',
  line: 'workCenter',
  workCenter: 'operation',
  operation: 'machine',
  machine: 'shift',
  shift: 'operator',
  operator: 'mo',
  product: 'mo',
  mo: 'wo',
  wo: null,
}

export interface GroupKey {
  key: string
  label: string
}

export interface DimensionContext {
  orgById: ReadonlyMap<string, OrgNode>
  mo: ReadonlyMap<string, ManufacturingOrder>
  wo: ReadonlyMap<string, WorkOrder>
  product: ReadonlyMap<string, Product>
  machine: ReadonlyMap<string, Machine>
  shift: ReadonlyMap<string, Shift>
  person: ReadonlyMap<string, Person>
  bop: ReadonlyMap<string, Bop>
  /** Non-cancelled work orders per manufacturing order, by operation sequence. */
  wosByMo: ReadonlyMap<string, WorkOrder[]>
}

export type DimensionSource = Pick<
  AppState,
  'orgNodes' | 'manufacturingOrders' | 'workOrders' | 'products' | 'machines' | 'shifts' | 'people' | 'bops'
>

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]))

export function dimensionContext(s: DimensionSource): DimensionContext {
  const wosByMo = new Map<string, WorkOrder[]>()
  for (const wo of s.workOrders) {
    if (wo.status === 'cancelled') continue
    const list = wosByMo.get(wo.moId)
    if (list) list.push(wo)
    else wosByMo.set(wo.moId, [wo])
  }
  for (const list of wosByMo.values()) list.sort((a, b) => a.operationSeq - b.operationSeq)
  return {
    orgById: byId(s.orgNodes),
    mo: byId(s.manufacturingOrders),
    wo: byId(s.workOrders),
    product: byId(s.products),
    machine: byId(s.machines),
    shift: byId(s.shifts),
    person: byId(s.people),
    bop: byId(s.bops),
    wosByMo,
  }
}

const NONE: GroupKey = { key: 'none', label: 'Unassigned' }

function orgUp(ctx: DimensionContext, id: string, kind: OrgNode['kind']): OrgNode | undefined {
  let node = ctx.orgById.get(id)
  while (node && node.kind !== kind) node = node.parentId ? ctx.orgById.get(node.parentId) : undefined
  return node
}

/** The group a work order falls into for a dimension, with a display label. */
export function dimensionKey(dim: Dimension, wo: WorkOrder, ctx: DimensionContext): GroupKey {
  switch (dim) {
    case 'plant':
    case 'area':
    case 'line':
    case 'workCenter': {
      const node = orgUp(ctx, wo.workCenterId, dim === 'workCenter' ? 'work_center' : dim)
      return node ? { key: node.id, label: node.name } : NONE
    }
    case 'product': {
      const mo = ctx.mo.get(wo.moId)
      const product = mo ? ctx.product.get(mo.productId) : undefined
      return product ? { key: product.id, label: product.name } : NONE
    }
    case 'mo':
      return { key: wo.moId, label: ctx.mo.get(wo.moId)?.code ?? wo.moId }
    case 'wo':
      return { key: wo.id, label: wo.code }
    case 'operation':
      return { key: `op-${wo.operationSeq}`, label: `${wo.operationSeq} · ${wo.operationName}` }
    case 'machine': {
      const machine = wo.machineId ? ctx.machine.get(wo.machineId) : undefined
      return machine ? { key: machine.id, label: machine.code } : NONE
    }
    case 'shift': {
      const shift = wo.shiftId ? ctx.shift.get(wo.shiftId) : undefined
      return shift ? { key: shift.id, label: shift.name } : NONE
    }
    case 'operator': {
      const id = wo.operatorIds[0]
      const person = id ? ctx.person.get(id) : undefined
      return person ? { key: person.id, label: person.name } : NONE
    }
  }
}

// ─── Window and shared helpers ──────────────────────────────────

const isRunning = (wo: WorkOrder) => wo.status === 'in_progress' || wo.status === 'paused'

/** Work orders that finished inside the window plus the ones still running. */
export function windowWorkOrders(wos: readonly WorkOrder[], from: number, to: number): WorkOrder[] {
  return wos.filter((wo) => {
    if (wo.status === 'completed' && wo.actualEnd) {
      const end = toMs(wo.actualEnd)
      return end >= from && end <= to
    }
    return isRunning(wo) && !!wo.actualStart && toMs(wo.actualStart) <= to
  })
}

const runMs = (wo: WorkOrder, now: number) =>
  wo.actualStart ? Math.max(0, (wo.actualEnd ? toMs(wo.actualEnd) : now) - toMs(wo.actualStart)) : 0

const producedQty = (wo: WorkOrder) => wo.goodQty + wo.rejectQty + wo.reworkQty + wo.scrapQty

const ratio = (num: number, den: number) => (den > 0 ? num / den : 0)

const sum = <T>(items: readonly T[], value: (item: T) => number) =>
  items.reduce((s, item) => s + value(item), 0)

const uniq = <T>(items: readonly T[]) => [...new Set(items)]

function standardCycleSec(ctx: DimensionContext, wo: WorkOrder): number | null {
  const mo = ctx.mo.get(wo.moId)
  const bop = mo?.snapshot ? ctx.bop.get(mo.snapshot.bopId) : undefined
  const op = bop?.operations.find((o) => o.seq === wo.operationSeq)
  return op ? op.cycleSec : null
}

const finalWo = (ctx: DimensionContext, moId: string) => ctx.wosByMo.get(moId)?.at(-1) ?? null

// ─── Metric inputs ──────────────────────────────────────────────

export interface DimensionFilter {
  dimension: Dimension
  key: string
}

export type AnalyticsSource = DimensionSource &
  Pick<AppState, 'wips' | 'materialRequirements' | 'reasonCodes' | 'settings'> & { siteId: string }

export interface AnalyticsInput {
  from: number
  to: number
  now: number
  filter: DimensionFilter | null
  /** Work orders inside the window and the filter. */
  workOrders: readonly WorkOrder[]
  manufacturingOrders: readonly ManufacturingOrder[]
  wips: readonly Wip[]
  materialRequirements: readonly MaterialRequirement[]
  machines: readonly Machine[]
  capacity: readonly CapacityRow[]
  reasonCodes: readonly ReasonCode[]
  wipAgingHours: number
  ctx: DimensionContext
}

export function analyticsInput(
  s: AnalyticsSource,
  from: number,
  to: number,
  now: number,
  filter: DimensionFilter | null = null,
): AnalyticsInput {
  const ctx = dimensionContext(s)
  const inWindow = windowWorkOrders(s.workOrders, from, to)
  return {
    from,
    to,
    now,
    filter,
    workOrders: filter ? inWindow.filter((wo) => matchesFilter(wo, filter, ctx)) : inWindow,
    manufacturingOrders: s.manufacturingOrders,
    wips: s.wips,
    materialRequirements: s.materialRequirements,
    machines: s.machines,
    capacity: capacityByWorkCenter(s, s.siteId, from, to),
    reasonCodes: s.reasonCodes,
    wipAgingHours: s.settings.wipAgingHours,
    ctx,
  }
}

const matchesFilter = (wo: WorkOrder, filter: DimensionFilter, ctx: DimensionContext) =>
  dimensionKey(filter.dimension, wo, ctx).key === filter.key

/** True when any work order of the order sits inside the active filter. */
function moInFilter(input: AnalyticsInput, moId: string): boolean {
  const filter = input.filter
  if (!filter) return true
  return (input.ctx.wosByMo.get(moId) ?? []).some((wo) => matchesFilter(wo, filter, input.ctx))
}

/** Every group an order belongs to for a dimension: one per distinct key among its work orders. */
function moKeys(input: AnalyticsInput, moId: string, dim: Dimension): GroupKey[] {
  const seen = new Map<string, GroupKey>()
  for (const wo of input.ctx.wosByMo.get(moId) ?? []) {
    const k = dimensionKey(dim, wo, input.ctx)
    if (!seen.has(k.key)) seen.set(k.key, k)
  }
  return seen.size ? [...seen.values()] : [NONE]
}

// ─── Metric results ─────────────────────────────────────────────

export interface MetricRow {
  key: string
  label: string
  value: number
  count: number
  /** Reference value beside `value`, such as the standard cycle time. */
  standard?: number
}

export interface MetricResult {
  overall: number
  standard?: number
  rows: MetricRow[]
}

type Summary = { value: number; standard?: number }

function aggregate<T>(
  items: readonly T[],
  keysOf: (item: T) => GroupKey[],
  summarize: (group: readonly T[]) => Summary,
  order: 'asc' | 'desc' = 'desc',
): MetricResult {
  const groups = new Map<string, { label: string; items: T[] }>()
  for (const item of items) {
    for (const k of keysOf(item)) {
      const g = groups.get(k.key)
      if (g) g.items.push(item)
      else groups.set(k.key, { label: k.label, items: [item] })
    }
  }
  const rows = [...groups]
    .map(([key, g]) => ({ key, label: g.label, count: g.items.length, ...summarize(g.items) }))
    .sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value))
  const all = summarize(items)
  return { overall: all.value, standard: all.standard, rows }
}

const woKeys = (input: AnalyticsInput, dim: Dimension) => (wo: WorkOrder) => [
  dimensionKey(dim, wo, input.ctx),
]

// ─── Phase 20 metrics ───────────────────────────────────────────

export type MetricId =
  | 'scheduleAdherence'
  | 'throughput'
  | 'cycleTime'
  | 'leadTime'
  | 'wipAging'
  | 'materialVariance'
  | 'yieldRate'
  | 'reworkRate'
  | 'scrapRate'
  | 'bottleneck'
  | 'resourceUtilization'
  | 'delayReasons'
  | 'planVsActual'

export type MetricUnit = 'percent' | 'perHour' | 'seconds' | 'hours' | 'minutes' | 'count'

export const METRICS: { id: MetricId; label: string; unit: MetricUnit; description: string }[] = [
  {
    id: 'scheduleAdherence',
    label: 'Schedule adherence',
    unit: 'percent',
    description: 'Completed work orders that finished by their planned end',
  },
  { id: 'throughput', label: 'Throughput', unit: 'perHour', description: 'Good pieces per hour of run time' },
  {
    id: 'cycleTime',
    label: 'Cycle time',
    unit: 'seconds',
    description: 'Actual seconds per piece against the BOP standard',
  },
  { id: 'leadTime', label: 'Lead time', unit: 'hours', description: 'Hours from first start to last finish' },
  { id: 'wipAging', label: 'WIP aging', unit: 'hours', description: 'Average age of active WIP' },
  {
    id: 'materialVariance',
    label: 'Material variance',
    unit: 'percent',
    description: 'Consumed against BOM-required quantity',
  },
  { id: 'yieldRate', label: 'Yield', unit: 'percent', description: 'Good pieces of everything produced' },
  { id: 'reworkRate', label: 'Rework rate', unit: 'percent', description: 'Pieces sent to rework' },
  { id: 'scrapRate', label: 'Scrap rate', unit: 'percent', description: 'Pieces scrapped' },
  {
    id: 'bottleneck',
    label: 'Queue time',
    unit: 'minutes',
    description: 'Minutes between the previous operation finishing and this one starting',
  },
  {
    id: 'resourceUtilization',
    label: 'Utilization',
    unit: 'percent',
    description: 'Machine run hours of the hours available in the window',
  },
  { id: 'delayReasons', label: 'Delay events', unit: 'count', description: 'Pauses, holds and risk flags' },
  {
    id: 'planVsActual',
    label: 'Plan vs actual',
    unit: 'percent',
    description: 'Good output of the planned quantity',
  },
]

export const METRIC_LABEL = Object.fromEntries(METRICS.map((m) => [m.id, m.label])) as Record<
  MetricId,
  string
>

export function scheduleAdherence(input: AnalyticsInput, dim: Dimension): MetricResult {
  const done = input.workOrders.filter((wo) => wo.status === 'completed' && wo.actualEnd)
  return aggregate(done, woKeys(input, dim), (group) => ({
    value: ratio(group.filter((wo) => toMs(wo.actualEnd!) <= toMs(wo.plannedEnd)).length, group.length),
  }))
}

export function throughput(input: AnalyticsInput, dim: Dimension): MetricResult {
  const ran = input.workOrders.filter((wo) => runMs(wo, input.now) > 0)
  return aggregate(ran, woKeys(input, dim), (group) => ({
    value: ratio(
      sum(group, (wo) => wo.goodQty),
      sum(group, (wo) => runMs(wo, input.now)) / HOUR,
    ),
  }))
}

/** Good pieces per run hour for each day of the window. */
export function throughputByDay(input: AnalyticsInput): { day: string; ms: number; value: number }[] {
  const days = dayRange(input.from, input.to)
  const finished = input.workOrders.filter((wo) => wo.actualEnd && runMs(wo, input.now) > 0)
  return days.map((ms) => {
    const key = dayKey(ms)
    const group = finished.filter((wo) => dayKey(toMs(wo.actualEnd!)) === key)
    return {
      day: key,
      ms,
      value: ratio(
        sum(group, (wo) => wo.goodQty),
        sum(group, (wo) => runMs(wo, input.now)) / HOUR,
      ),
    }
  })
}

export function cycleTime(input: AnalyticsInput, dim: Dimension): MetricResult {
  const ran = input.workOrders.filter((wo) => runMs(wo, input.now) > 0 && producedQty(wo) > 0)
  return aggregate(ran, woKeys(input, dim), (group) => {
    const qty = sum(group, producedQty)
    const withStandard = group.filter((wo) => standardCycleSec(input.ctx, wo) !== null)
    return {
      value: ratio(
        sum(group, (wo) => runMs(wo, input.now) / 1000),
        qty,
      ),
      standard: ratio(
        sum(withStandard, (wo) => standardCycleSec(input.ctx, wo)! * producedQty(wo)),
        sum(withStandard, producedQty),
      ),
    }
  })
}

function moLeadHours(mo: ManufacturingOrder): number | null {
  if (!mo.actualEnd) return null
  const released = mo.events.find((e) => e.type === 'manufacturing_order.released')?.at
  const start = mo.status === 'closed' && released ? released : mo.actualStart
  return start ? (toMs(mo.actualEnd) - toMs(start)) / HOUR : null
}

function finishedMos(input: AnalyticsInput): ManufacturingOrder[] {
  return input.manufacturingOrders.filter((mo) => {
    if (mo.status !== 'completed' && mo.status !== 'closed') return false
    if (!mo.actualEnd) return false
    const end = toMs(mo.actualEnd)
    return end >= input.from && end <= input.to && moInFilter(input, mo.id)
  })
}

export function leadTime(input: AnalyticsInput, dim: Dimension): MetricResult {
  const mos = finishedMos(input).filter((mo) => moLeadHours(mo) !== null)
  return aggregate(
    mos,
    (mo) => moKeys(input, mo.id, dim),
    (group) => ({
      value: ratio(
        sum(group, (mo) => moLeadHours(mo)!),
        group.length,
      ),
    }),
  )
}

const wipAgeH = (wip: Wip, now: number) => Math.max(0, now - toMs(wip.updatedAt)) / HOUR

function activeWips(input: AnalyticsInput): Wip[] {
  return input.wips.filter(
    (w) => ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0 && moInFilter(input, w.moId),
  )
}

function wipWorkOrder(ctx: DimensionContext, wip: Wip): WorkOrder | undefined {
  return (
    (wip.woId ? ctx.wo.get(wip.woId) : undefined) ??
    ctx.wosByMo.get(wip.moId)?.find((wo) => wo.operationSeq === wip.operationSeq)
  )
}

export function wipAging(input: AnalyticsInput, dim: Dimension): MetricResult {
  return aggregate(
    activeWips(input),
    (wip) => {
      const wo = wipWorkOrder(input.ctx, wip)
      return [wo ? dimensionKey(dim, wo, input.ctx) : NONE]
    },
    (group) => ({
      value: ratio(
        sum(group, (w) => wipAgeH(w, input.now)),
        group.length,
      ),
    }),
  )
}

export interface WipBucket {
  key: string
  label: string
  count: number
  qty: number
}

/** Active WIP by age: under the aging threshold, threshold to a day, one to three days, older. */
export function wipAgingBuckets(input: AnalyticsInput): WipBucket[] {
  const t = input.wipAgingHours
  const edges: { key: string; label: string; test: (h: number) => boolean }[] = [
    { key: 'fresh', label: `Under ${t}h`, test: (h) => h < t },
    { key: 'day', label: `${t}h to 24h`, test: (h) => h >= t && h < 24 },
    { key: 'days', label: '1 to 3 days', test: (h) => h >= 24 && h < 72 },
    { key: 'old', label: 'Over 3 days', test: (h) => h >= 72 },
  ]
  const wips = activeWips(input)
  return edges.map((e) => {
    const group = wips.filter((w) => e.test(wipAgeH(w, input.now)))
    return { key: e.key, label: e.label, count: group.length, qty: sum(group, (w) => w.qty) }
  })
}

export interface MaterialVarianceRow {
  requirementId: string
  moId: string
  materialId: string
  requiredQty: number
  consumedQty: number
  /** Consumed over required as a fraction: 0.05 means 5% over. */
  variance: number
}

function varianceRows(input: AnalyticsInput): MaterialVarianceRow[] {
  const finished = new Set(
    input.manufacturingOrders
      .filter((mo) => mo.status === 'completed' || mo.status === 'closed')
      .map((mo) => mo.id),
  )
  return input.materialRequirements
    .filter(
      (r) =>
        r.requiredQty > 0 &&
        (r.status === 'consumed' || finished.has(r.moId)) &&
        r.consumedQty > 0 &&
        moInFilter(input, r.moId) &&
        moFinishedInWindow(input, r.moId),
    )
    .map((r) => ({
      requirementId: r.id,
      moId: r.moId,
      materialId: r.materialId,
      requiredQty: r.requiredQty,
      consumedQty: r.consumedQty,
      variance: (r.consumedQty - r.requiredQty) / r.requiredQty,
    }))
}

function moFinishedInWindow(input: AnalyticsInput, moId: string): boolean {
  const mo = input.ctx.mo.get(moId)
  if (!mo) return false
  const end = mo.actualEnd ? toMs(mo.actualEnd) : null
  return end === null ? OPEN_MO_STATUSES.includes(mo.status) : end >= input.from && end <= input.to
}

/** Per requirement: consumed against required, largest deviation first. */
export function materialVarianceRows(input: AnalyticsInput): MaterialVarianceRow[] {
  return varianceRows(input).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
}

export function materialVariance(input: AnalyticsInput, dim: Dimension): MetricResult {
  return aggregate(
    varianceRows(input),
    (r) => moKeys(input, r.moId, dim),
    (group) => ({
      value: ratio(
        sum(group, (r) => Math.abs(r.variance)),
        group.length,
      ),
    }),
  )
}

const qualityMetric =
  (part: (wo: WorkOrder) => number) =>
  (input: AnalyticsInput, dim: Dimension): MetricResult =>
    aggregate(
      input.workOrders.filter((wo) => producedQty(wo) > 0),
      woKeys(input, dim),
      (group) => ({ value: ratio(sum(group, part), sum(group, producedQty)) }),
    )

export const yieldRate = qualityMetric((wo) => wo.goodQty)
export const reworkRate = qualityMetric((wo) => wo.reworkQty)
export const scrapRate = qualityMetric((wo) => wo.scrapQty)

/** Minutes between the previous operation finishing and this one starting; null for a first operation. */
export function queueMinutes(ctx: DimensionContext, wo: WorkOrder): number | null {
  if (!wo.actualStart) return null
  const own = ctx.wosByMo.get(wo.moId) ?? []
  const prev = [...own].reverse().find((w) => w.operationSeq < wo.operationSeq && w.actualEnd)
  if (!prev) return null
  return Math.max(0, (toMs(wo.actualStart) - toMs(prev.actualEnd!)) / MINUTE)
}

export function bottleneck(input: AnalyticsInput, dim: Dimension): MetricResult {
  const queued = input.workOrders.filter((wo) => queueMinutes(input.ctx, wo) !== null)
  return aggregate(queued, woKeys(input, dim), (group) => ({
    value: ratio(
      sum(group, (wo) => queueMinutes(input.ctx, wo)!),
      group.length,
    ),
  }))
}

export interface BottleneckRow {
  workCenterId: string
  avgQueueMin: number
  totalQueueMin: number
  load: number
  woCount: number
}

/** Work centers ranked by queue time, with their planned load from capacity planning. */
export function bottleneckRanking(input: AnalyticsInput): BottleneckRow[] {
  const byWc = bottleneck(input, 'workCenter')
  const loads = new Map(input.capacity.map((c) => [c.workCenterId, c]))
  const ids = uniq([...byWc.rows.map((r) => r.key), ...input.capacity.map((c) => c.workCenterId)]).filter(
    (id) => id !== NONE.key,
  )
  return ids
    .map((id) => {
      const row = byWc.rows.find((r) => r.key === id)
      const cap = loads.get(id)
      return {
        workCenterId: id,
        avgQueueMin: row?.value ?? 0,
        totalQueueMin: (row?.value ?? 0) * (row?.count ?? 0),
        load: cap?.load ?? 0,
        woCount: row?.count ?? cap?.woCount ?? 0,
      }
    })
    .sort((a, b) => b.avgQueueMin - a.avgQueueMin || b.load - a.load)
}

export function resourceUtilization(input: AnalyticsInput, dim: Dimension): MetricResult {
  const windowHours = Math.max(1, (input.to - input.from) / HOUR)
  const ran = input.workOrders.filter((wo) => runMs(wo, input.now) > 0)
  return aggregate(ran, woKeys(input, dim), (group) => {
    const resources = Math.max(1, uniq(group.map((wo) => wo.machineId ?? wo.id)).length)
    return { value: sum(group, (wo) => runMs(wo, input.now)) / HOUR / (windowHours * resources) }
  })
}

export interface DelayEvent {
  wo: WorkOrder
  reasonKey: string
  reason: string
  at: string
}

/** Pauses and holds from work order history plus the risk flags on their orders. */
export function delayEvents(input: AnalyticsInput): DelayEvent[] {
  const reasonLabel = (id: string | null) =>
    id ? (input.reasonCodes.find((r) => r.id === id)?.label ?? 'Hold') : 'Hold'
  const events: DelayEvent[] = []
  const flagged = new Set<string>()
  for (const wo of input.workOrders) {
    for (const e of wo.events) {
      if (e.kind === 'paused') {
        const token =
          e.text
            .replace(/^Paused:\s*/, '')
            .split(' · ')[0]
            ?.trim() ?? ''
        const known = (Object.keys(PAUSE_REASON_LABEL) as PauseReason[]).find((k) => k === token)
        const reason = known ? PAUSE_REASON_LABEL[known] : token || PAUSE_REASON_LABEL.other
        events.push({ wo, reasonKey: `pause-${known ?? 'other'}`, reason, at: e.at })
      } else if (e.kind === 'held') {
        const label = reasonLabel(wo.holdReasonId)
        events.push({ wo, reasonKey: `hold-${wo.holdReasonId ?? 'none'}`, reason: label, at: e.at })
      }
    }
    const mo = input.ctx.mo.get(wo.moId)
    if (mo?.atRisk && mo.atRiskReason && !flagged.has(mo.id)) {
      flagged.add(mo.id)
      events.push({ wo, reasonKey: `risk-${mo.id}`, reason: mo.atRiskReason, at: mo.plannedEnd })
    }
  }
  return events
}

export function delayReasons(input: AnalyticsInput, dim: Dimension): MetricResult {
  return aggregate(
    delayEvents(input),
    (e) => [dimensionKey(dim, e.wo, input.ctx)],
    (group) => ({ value: group.length }),
  )
}

/** Delay events counted by reason, most frequent first. */
export function delayReasonCounts(input: AnalyticsInput): MetricRow[] {
  return aggregate(
    delayEvents(input),
    (e) => [{ key: e.reasonKey, label: e.reason }],
    (group) => ({ value: group.length }),
  ).rows
}

function plannedMos(input: AnalyticsInput): ManufacturingOrder[] {
  return input.manufacturingOrders.filter((mo) => {
    if (mo.status === 'draft' || mo.status === 'cancelled') return false
    const end = mo.actualEnd ? toMs(mo.actualEnd) : toMs(mo.plannedEnd)
    return end >= input.from && end <= input.to && moInFilter(input, mo.id)
  })
}

export function planVsActual(input: AnalyticsInput, dim: Dimension): MetricResult {
  const wos = [...input.ctx.wosByMo.values()].flat()
  return aggregate(
    plannedMos(input),
    (mo) => moKeys(input, mo.id, dim),
    (group) => ({
      value: ratio(
        sum(group, (mo) => moActualQty(mo, wos)),
        sum(group, (mo) => mo.qty),
      ),
    }),
  )
}

export interface OutputDay {
  day: string
  ms: number
  planned: number
  actual: number
}

/** Planned finish quantity against good output of the final operation, per day. */
export function outputByDay(input: AnalyticsInput): OutputDay[] {
  const finals = input.manufacturingOrders
    .filter((mo) => mo.status !== 'draft' && mo.status !== 'cancelled' && moInFilter(input, mo.id))
    .map((mo) => finalWo(input.ctx, mo.id))
    .filter((wo): wo is WorkOrder => wo !== null)
  return dayRange(input.from, input.to).map((ms) => {
    const key = dayKey(ms)
    return {
      day: key,
      ms,
      planned: sum(
        finals.filter((wo) => dayKey(toMs(wo.plannedEnd)) === key),
        (wo) => wo.targetQty,
      ),
      actual: sum(
        finals.filter((wo) => wo.actualEnd && dayKey(toMs(wo.actualEnd)) === key),
        (wo) => wo.goodQty,
      ),
    }
  })
}

function dayRange(from: number, to: number): number[] {
  const days: number[] = []
  for (let ms = startOfDay(from); ms <= to; ms += DAY) days.push(ms)
  return days
}

const METRIC_FN: Record<MetricId, (input: AnalyticsInput, dim: Dimension) => MetricResult> = {
  scheduleAdherence,
  throughput,
  cycleTime,
  leadTime,
  wipAging,
  materialVariance,
  yieldRate,
  reworkRate,
  scrapRate,
  bottleneck,
  resourceUtilization,
  delayReasons,
  planVsActual,
}

export const metricByDimension = (id: MetricId, input: AnalyticsInput, dim: Dimension): MetricResult =>
  METRIC_FN[id](input, dim)

// ─── Phase 21: shift summary ────────────────────────────────────

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export interface ShiftWindow {
  shift: Shift | null
  from: number
  to: number
}

/** The shift running at an instant and its start and end, in plant time. */
export function shiftWindow(shifts: readonly Shift[], at: number): ShiftWindow {
  const shift = shiftAt(shifts, at) ?? null
  if (!shift) return { shift: null, from: startOfDay(at), to: startOfDay(at) + DAY }
  const start = minutesOf(shift.start)
  const end = minutesOf(shift.end)
  const { hours, minutes } = wib(at)
  const t = hours * 60 + minutes
  const dayStart = startOfDay(at) - (start > end && t < start ? DAY : 0)
  const length = end > start ? end - start : 24 * 60 - start + end
  return { shift, from: dayStart + start * MINUTE, to: dayStart + (start + length) * MINUTE }
}

export interface ShiftFacts {
  window: ShiftWindow
  outputQty: number
  completedWoIds: string[]
  runningWoIds: string[]
  delayed: { woId: string; minutesLate: number }[]
  failedInspectionIds: string[]
  holdIds: string[]
  scrapQty: number
  rejectQty: number
  downtimeMin: number
  downtimeByMachine: { machineId: string; minutes: number }[]
  shortageRequirementIds: string[]
  paragraph: string
}

export type ShiftSource = Pick<
  AppState,
  'workOrders' | 'inspections' | 'qualityHolds' | 'oeeSnapshots' | 'materialRequirements' | 'shifts'
>

const within = (iso: string | null, from: number, to: number) =>
  iso !== null && toMs(iso) >= from && toMs(iso) < to

export function shiftSummary(s: ShiftSource, now: number, which: 'current' | 'previous'): ShiftFacts {
  const current = shiftWindow(s.shifts, now)
  const window = which === 'current' ? current : shiftWindow(s.shifts, current.from - MINUTE)
  const { from, to } = window
  const end = Math.min(to, now)
  const completed = s.workOrders.filter((wo) => wo.status === 'completed' && within(wo.actualEnd, from, end))
  const running = s.workOrders.filter((wo) => isRunning(wo) && wo.actualStart && toMs(wo.actualStart) < end)
  const touched = uniq([...completed, ...running])
  const delayed = touched
    .map((wo) => ({
      woId: wo.id,
      minutesLate: ((wo.actualEnd ? toMs(wo.actualEnd) : now) - toMs(wo.plannedEnd)) / MINUTE,
    }))
    .filter((d) => d.minutesLate > 0)
    .sort((a, b) => b.minutesLate - a.minutesLate)
  const failed = s.inspections.filter((i) => i.status === 'failed' && within(i.completedAt, from, end))
  const holds = s.qualityHolds.filter((h) => within(h.heldAt, from, end))
  const scrapQty = sum(
    s.workOrders.flatMap((wo) => wo.events.filter((e) => e.kind === 'scrap' && within(e.at, from, end))),
    (e) => e.qty ?? 0,
  )
  const rejectQty = sum(
    s.workOrders.flatMap((wo) => wo.events.filter((e) => e.kind === 'reject' && within(e.at, from, end))),
    (e) => e.qty ?? 0,
  )
  const day = dayKey(from)
  const snapshots = s.oeeSnapshots.filter(
    (o) => o.date === day && (!window.shift || o.shiftId === window.shift.id),
  )
  const downtimeByMachine = [
    ...groupSum(
      snapshots,
      (o) => o.machineId,
      (o) => o.downtimeMin,
    ),
  ]
    .map(([machineId, minutes]) => ({ machineId, minutes }))
    .filter((d) => d.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
  const shortages = s.materialRequirements.filter((r) => r.status === 'shortage')
  const outputQty = sum(
    s.workOrders.flatMap((wo) => wo.events.filter((e) => e.kind === 'output' && within(e.at, from, end))),
    (e) => e.qty ?? 0,
  )
  const facts: Omit<ShiftFacts, 'paragraph'> = {
    window,
    outputQty,
    completedWoIds: completed.map((wo) => wo.id),
    runningWoIds: running.map((wo) => wo.id),
    delayed,
    failedInspectionIds: failed.map((i) => i.id),
    holdIds: holds.map((h) => h.id),
    scrapQty,
    rejectQty,
    downtimeMin: sum(snapshots, (o) => o.downtimeMin),
    downtimeByMachine,
    shortageRequirementIds: shortages.map((r) => r.id),
  }
  return { ...facts, paragraph: shiftParagraph(facts, which) }
}

function groupSum<T>(items: readonly T[], key: (item: T) => string, value: (item: T) => number) {
  const map = new Map<string, number>()
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + value(item))
  return map
}

function shiftParagraph(f: Omit<ShiftFacts, 'paragraph'>, which: 'current' | 'previous'): string {
  const name = f.window.shift ? `${f.window.shift.name} shift` : 'shift'
  const opener = which === 'current' ? `The ${name} so far` : `The last ${name}`
  const parts = [
    `${opener} produced ${f.outputQty} pieces across ${f.completedWoIds.length} completed and ${f.runningWoIds.length} running work orders.`,
  ]
  parts.push(
    f.delayed.length
      ? `${f.delayed.length} work order${f.delayed.length === 1 ? '' : 's'} ran past the planned end, the worst by ${Math.round(f.delayed[0]!.minutesLate)} minutes.`
      : 'Every work order finished inside its planned window.',
  )
  const quality: string[] = []
  if (f.failedInspectionIds.length) quality.push(`${f.failedInspectionIds.length} failed inspections`)
  if (f.holdIds.length) quality.push(`${f.holdIds.length} quality holds`)
  if (f.scrapQty) quality.push(`${f.scrapQty} scrapped`)
  if (f.rejectQty) quality.push(`${f.rejectQty} rejected`)
  parts.push(quality.length ? `Quality recorded ${quality.join(', ')}.` : 'No quality issues were recorded.')
  parts.push(
    f.downtimeMin
      ? `Machines lost ${Math.round(f.downtimeMin)} minutes to downtime, ${f.downtimeByMachine.length} of them affected.`
      : 'OEE reported no downtime.',
  )
  parts.push(
    f.shortageRequirementIds.length
      ? `${f.shortageRequirementIds.length} material requirements are short.`
      : 'Material is covered for every open requirement.',
  )
  return parts.join(' ')
}

// ─── Phase 21: root cause assistant ─────────────────────────────

export type ProblemKind = 'scrap' | 'delay' | 'reject'
export const PROBLEM_LABEL: Record<ProblemKind, string> = {
  scrap: 'Scrap',
  delay: 'Delay',
  reject: 'Reject',
}

export interface Problem {
  kind: ProblemKind
  moId?: string | null
  woId?: string | null
}

export type FactorKind = 'machine' | 'lot' | 'operator' | 'process' | 'quality' | 'downtime'
export const FACTOR_LABEL: Record<FactorKind, string> = {
  machine: 'Machine',
  lot: 'Material lot',
  operator: 'Operator',
  process: 'Operation',
  quality: 'Quality',
  downtime: 'Downtime',
}

export interface RootCauseFactor {
  factor: FactorKind
  id: string
  label: string
  evidence: string
  /** Lift over the site baseline, 0 to 1. */
  score: number
  rate: number
  baseline: number
  /** Work orders the factor was measured on. */
  woIds: string[]
}

export type RootCauseSource = Pick<
  AppState,
  'workOrders' | 'materialTxns' | 'materialLots' | 'inspections' | 'oeeSnapshots' | 'machines' | 'people'
>

const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 1)}%`

function problemRate(kind: ProblemKind, wo: WorkOrder): number | null {
  if (kind === 'delay') {
    if (!wo.actualEnd) return null
    const planned = Math.max(MINUTE, toMs(wo.plannedEnd) - toMs(wo.plannedStart))
    return Math.max(0, toMs(wo.actualEnd) - toMs(wo.plannedEnd)) / planned
  }
  const total = producedQty(wo)
  if (total === 0) return null
  return (kind === 'scrap' ? wo.scrapQty : wo.rejectQty) / total
}

/** Lift over the baseline, damped when the factor was seen on fewer than three work orders. */
const lift = (rate: number, baseline: number, support: number) =>
  rate > 0 ? Math.max(0, 1 - baseline / rate) * Math.min(1, support / 3) : 0

export function rootCauseCandidates(
  problem: Problem,
  s: RootCauseSource,
  ctx: DimensionContext,
): RootCauseFactor[] {
  const population = s.workOrders.filter((wo) => problemRate(problem.kind, wo) !== null)
  if (!population.length) return []
  const rateOf = (wo: WorkOrder) => problemRate(problem.kind, wo)!
  const avg = (wos: readonly WorkOrder[]) => ratio(sum(wos, rateOf), wos.length)
  const baseline = avg(population)
  const affected = population.filter((wo) =>
    problem.woId ? wo.id === problem.woId : problem.moId ? wo.moId === problem.moId : rateOf(wo) > 0,
  )
  if (!affected.length) return []
  const affectedIds = new Set(affected.map((wo) => wo.id))
  const affectedMoIds = new Set(affected.map((wo) => wo.moId))
  const noun = PROBLEM_LABEL[problem.kind].toLowerCase()
  const factors: RootCauseFactor[] = []

  const compare = (
    factor: FactorKind,
    id: string,
    label: string,
    wos: readonly WorkOrder[],
    where: string,
  ) => {
    if (!wos.length) return
    const rate = avg(wos)
    factors.push({
      factor,
      id,
      label,
      rate,
      baseline,
      score: lift(rate, baseline, wos.length),
      woIds: wos.map((wo) => wo.id),
      evidence: `${noun} rate ${pct(rate)} on ${wos.length} work order${wos.length === 1 ? '' : 's'} ${where}, site average ${pct(baseline)}`,
    })
  }

  for (const machineId of uniq(affected.map((wo) => wo.machineId).filter((id): id is string => !!id))) {
    const machine = ctx.machine.get(machineId)
    compare(
      'machine',
      machineId,
      machine ? `${machine.code} · ${machine.name}` : machineId,
      population.filter((wo) => wo.machineId === machineId),
      'on this machine',
    )
  }
  for (const personId of uniq(affected.map((wo) => wo.operatorIds[0]).filter((id): id is string => !!id))) {
    compare(
      'operator',
      personId,
      ctx.person.get(personId)?.name ?? personId,
      population.filter((wo) => wo.operatorIds[0] === personId),
      'run by this operator',
    )
  }
  for (const seq of uniq(affected.map((wo) => wo.operationSeq))) {
    const name = affected.find((wo) => wo.operationSeq === seq)?.operationName ?? ''
    compare(
      'process',
      `op-${seq}`,
      `Operation ${seq} · ${name}`,
      population.filter((wo) => wo.operationSeq === seq),
      'at this operation',
    )
  }
  const consumed = s.materialTxns.filter(
    (t) =>
      t.kind === 'consume' &&
      t.lotId &&
      ((t.woId && affectedIds.has(t.woId)) || (!t.woId && t.moId && affectedMoIds.has(t.moId))),
  )
  for (const lotId of uniq(consumed.map((t) => t.lotId!))) {
    const lot = s.materialLots.find((l) => l.id === lotId)
    const users = s.materialTxns.filter((t) => t.kind === 'consume' && t.lotId === lotId)
    const woIds = new Set(users.map((t) => t.woId).filter((id): id is string => !!id))
    const moIds = new Set(users.filter((t) => !t.woId && t.moId).map((t) => t.moId!))
    compare(
      'lot',
      lotId,
      lot?.code ?? lotId,
      population.filter((wo) => woIds.has(wo.id) || moIds.has(wo.moId)),
      'that consumed this lot',
    )
  }
  const doneInspections = s.inspections.filter((i) => i.status === 'passed' || i.status === 'failed')
  const failRate = (list: readonly Inspection[]) =>
    ratio(list.filter((i) => i.status === 'failed').length, list.length)
  const siteFail = failRate(doneInspections)
  for (const seq of uniq(affected.map((wo) => wo.operationSeq))) {
    const here = doneInspections.filter((i) => i.woId && affectedIds.has(i.woId) && i.operationSeq === seq)
    const failed = here.filter((i) => i.status === 'failed')
    if (!failed.length) continue
    const rate = failRate(here)
    const latest = [...failed].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]!
    factors.push({
      factor: 'quality',
      id: latest.id,
      label: `Failed inspections at operation ${seq}`,
      rate,
      baseline: siteFail,
      score: lift(rate, siteFail, here.length),
      woIds: uniq(here.map((i) => i.woId!)),
      evidence: `${failed.length} of ${here.length} inspections failed on the affected work, site failure rate ${pct(siteFail)}`,
    })
  }
  const siteDowntime = ratio(
    sum(s.oeeSnapshots, (o) => o.downtimeMin),
    s.oeeSnapshots.length,
  )
  for (const machineId of uniq(affected.map((wo) => wo.machineId).filter((id): id is string => !!id))) {
    const days = new Set(
      affected
        .filter((wo) => wo.machineId === machineId && wo.actualStart)
        .map((wo) => dayKey(toMs(wo.actualStart!))),
    )
    const snaps = s.oeeSnapshots.filter((o) => o.machineId === machineId && days.has(o.date))
    if (!snaps.length) continue
    const perSnap = ratio(
      sum(snaps, (o) => o.downtimeMin),
      snaps.length,
    )
    const machine = ctx.machine.get(machineId)
    factors.push({
      factor: 'downtime',
      id: machineId,
      label: `Downtime on ${machine?.code ?? machineId}`,
      rate: perSnap,
      baseline: siteDowntime,
      score: lift(perSnap, siteDowntime, snaps.length),
      woIds: affected.filter((wo) => wo.machineId === machineId).map((wo) => wo.id),
      evidence: `${Math.round(perSnap)} min downtime per shift on the affected days, fleet average ${Math.round(siteDowntime)} min`,
    })
  }
  return factors.sort((a, b) => b.score - a.score || b.rate - a.rate)
}

// ─── Phase 21: delay prediction ─────────────────────────────────

export interface DelayRisk {
  moId: string
  /** 0 to 1. */
  risk: number
  hoursLeft: number
  hoursNeeded: number
  remainingOps: number
  reason: string
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function delayPrediction(
  mos: readonly ManufacturingOrder[],
  requirements: readonly MaterialRequirement[],
  ctx: DimensionContext,
  now: number,
): DelayRisk[] {
  const shortMoIds = new Set(requirements.filter((r) => r.status === 'shortage').map((r) => r.moId))
  return mos
    .filter((mo) => mo.status === 'released' || mo.status === 'in_progress' || mo.status === 'on_hold')
    .map((mo) => {
      const remaining = (ctx.wosByMo.get(mo.id) ?? []).filter((wo) => wo.status !== 'completed')
      const hoursNeeded = sum(remaining, (wo) => {
        const left = Math.max(0, wo.targetQty - wo.outputQty)
        const std = standardCycleSec(ctx, wo)
        const plannedH = (toMs(wo.plannedEnd) - toMs(wo.plannedStart)) / HOUR
        const runH = std === null ? plannedH * ratio(left, Math.max(1, wo.targetQty)) : (left * std) / 3600
        return runH + (wo.actualStart ? 0 : plannedH * 0.1)
      })
      const hoursLeft = (toMs(mo.plannedEnd) - now) / HOUR
      const reasons: string[] = []
      let risk = hoursLeft <= 0 ? 1 : clamp01(hoursNeeded / hoursLeft - 0.5)
      if (hoursLeft <= 0) reasons.push('planned end has passed')
      else if (hoursNeeded > hoursLeft)
        reasons.push(`${hoursNeeded.toFixed(1)}h of work left for ${hoursLeft.toFixed(1)}h of plan`)
      else if (risk > 0) reasons.push(`${remaining.length} operations left with little slack`)
      if (mo.status === 'on_hold') {
        risk += 0.25
        reasons.push('order on hold')
      }
      if (shortMoIds.has(mo.id)) {
        risk += 0.2
        reasons.push('material shortage')
      }
      if (mo.atRisk) {
        risk += 0.2
        reasons.push(mo.atRiskReason || 'flagged at risk')
      }
      return {
        moId: mo.id,
        risk: clamp01(risk),
        hoursLeft,
        hoursNeeded,
        remainingOps: remaining.length,
        reason: reasons.join('; ') || 'On track',
      }
    })
    .filter((r) => r.risk >= 0.3)
    .sort((a, b) => b.risk - a.risk || a.hoursLeft - b.hoursLeft)
}

// ─── Phase 21: material risk ────────────────────────────────────

export interface MaterialRiskRow {
  materialId: string
  freeQty: number
  openQty: number
  ratePerDay: number
  /** Days the free stock lasts at the recent rate; null when nothing was consumed lately. */
  daysOfCover: number | null
  shortfall: number
  requirementIds: string[]
}

export function materialRisk(
  requirements: readonly MaterialRequirement[],
  txns: readonly MaterialTxn[],
  lots: readonly MaterialLot[],
  now: number,
  horizonDays = 7,
): MaterialRiskRow[] {
  const since = now - horizonDays * DAY
  const consumed = groupSum(
    txns.filter((t) => t.kind === 'consume' && toMs(t.at) >= since),
    (t) => t.materialId,
    (t) => t.qty,
  )
  const free = groupSum(
    lots.filter((l) => l.status === 'available'),
    (l) => l.materialId,
    (l) => l.qty,
  )
  const open = requirements.filter((r) => r.status !== 'consumed' && r.requiredQty > r.consumedQty)
  const openQty = groupSum(
    open,
    (r) => r.materialId,
    (r) => r.requiredQty - r.consumedQty,
  )
  const ids = uniq([...consumed.keys(), ...openQty.keys()])
  return ids
    .map((materialId) => {
      const rate = (consumed.get(materialId) ?? 0) / horizonDays
      const freeQty = free.get(materialId) ?? 0
      const needed = openQty.get(materialId) ?? 0
      return {
        materialId,
        freeQty,
        openQty: needed,
        ratePerDay: rate,
        daysOfCover: rate > 0 ? freeQty / rate : null,
        shortfall: Math.max(0, needed - freeQty),
        requirementIds: open.filter((r) => r.materialId === materialId).map((r) => r.id),
      }
    })
    .filter((r) => r.shortfall > 0 || (r.daysOfCover !== null && r.daysOfCover < horizonDays))
    .sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) || b.shortfall - a.shortfall)
}

// ─── Phase 21: quality risk ─────────────────────────────────────

export interface CharacteristicRisk {
  characteristicId: string
  name: string
  productId: string
  unit: string
  readings: number[]
  inspectionIds: string[]
  min: number | null
  max: number | null
  target: number | null
  lastValue: number
  slope: number
  severity: 'watch' | 'risk'
  note: string
}

export interface FpyRisk {
  productId: string
  operationSeq: number
  recent: number
  previous: number
  inspectionIds: string[]
}

export interface QualityRisk {
  characteristics: CharacteristicRisk[]
  fpy: FpyRisk[]
}

function slopeOf(values: readonly number[]): number {
  const n = values.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = sum(values, (v) => v) / n
  let num = 0
  let den = 0
  values.forEach((v, i) => {
    num += (i - meanX) * (v - meanY)
    den += (i - meanX) ** 2
  })
  return den ? num / den : 0
}

export function qualityRisk(
  inspections: readonly Inspection[],
  specs: readonly Specification[],
): QualityRisk {
  const done = inspections
    .filter((i) => (i.status === 'passed' || i.status === 'failed') && i.completedAt)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))
  const series = new Map<string, { inspection: Inspection; value: number }[]>()
  for (const inspection of done) {
    for (const m of inspection.measurements) {
      if (m.type !== 'numeric' || m.value === null) continue
      const list = series.get(m.characteristicId)
      if (list) list.push({ inspection, value: m.value })
      else series.set(m.characteristicId, [{ inspection, value: m.value }])
    }
  }
  const characteristics: CharacteristicRisk[] = []
  for (const [characteristicId, all] of series) {
    const last10 = all.slice(-10)
    if (last10.length < 3) continue
    const spec = specs.find((sp) => sp.characteristics.some((c) => c.id === characteristicId))
    const ch = spec?.characteristics.find((c) => c.id === characteristicId)
    const sample = last10[last10.length - 1]!.inspection.measurements.find(
      (m) => m.characteristicId === characteristicId,
    )!
    const min = ch?.min ?? sample.min
    const max = ch?.max ?? sample.max
    if (min === null && max === null) continue
    const readings = last10.map((p) => p.value)
    const lastValue = readings[readings.length - 1]!
    const slope = slopeOf(readings)
    const target = ch?.target ?? sample.target
    const limit = (max ?? min)!
    const band =
      min !== null && max !== null
        ? max - min
        : target !== null && target !== limit
          ? 2 * Math.abs(target - limit)
          : Math.abs(limit || 1) * 0.01
    const margin = band * 0.2
    const nearMax = max !== null && lastValue >= max - margin
    const nearMin = min !== null && lastValue <= min + margin
    if (!nearMax && !nearMin) continue
    const trending = (nearMax && slope > 0) || (nearMin && slope < 0)
    const limitText = nearMax ? `upper limit ${max}` : `lower limit ${min}`
    characteristics.push({
      characteristicId,
      name: ch?.name ?? sample.name,
      productId: last10[last10.length - 1]!.inspection.productId,
      unit: ch?.unit ?? sample.unit,
      readings,
      inspectionIds: last10.map((p) => p.inspection.id),
      min,
      max,
      target,
      lastValue,
      slope,
      severity: trending ? 'risk' : 'watch',
      note: trending
        ? `Last reading ${lastValue} ${sample.unit} is within 20% of the ${limitText} and the trend is heading toward it.`
        : `Last reading ${lastValue} ${sample.unit} sits within 20% of the ${limitText}.`,
    })
  }
  const fpy: FpyRisk[] = []
  const byOp = new Map<string, Inspection[]>()
  for (const i of done) {
    const key = `${i.productId}|${i.operationSeq}`
    const list = byOp.get(key)
    if (list) list.push(i)
    else byOp.set(key, [i])
  }
  for (const list of byOp.values()) {
    if (list.length < 6) continue
    const recentList = list.slice(-10)
    const previousList = list.slice(-20, -10).length ? list.slice(-20, -10) : list.slice(0, -10)
    if (!previousList.length) continue
    const pass = (l: Inspection[]) => ratio(l.filter((i) => i.status === 'passed').length, l.length)
    const recent = pass(recentList)
    const previous = pass(previousList)
    if (recent < previous - 0.1) {
      fpy.push({
        productId: list[0]!.productId,
        operationSeq: list[0]!.operationSeq,
        recent,
        previous,
        inspectionIds: recentList.map((i) => i.id),
      })
    }
  }
  return {
    characteristics: characteristics.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === 'risk' ? -1 : 1,
    ),
    fpy: fpy.sort((a, b) => a.recent - b.recent),
  }
}

// ─── Phase 21: maintenance correlation ──────────────────────────

export interface MachineCorrelation {
  machineId: string
  downtimeMin: number
  inspectionCount: number
  failedInspectionRate: number | null
  /** Actual over standard cycle time minus one; 0.15 means 15% slower than standard. */
  cycleDeviation: number | null
  maintenanceCount: number
  woIds: string[]
  flagged: boolean
  note: string
}

export function maintenanceCorrelation(
  machines: readonly Machine[],
  oeeSnapshots: readonly OeeSnapshot[],
  wos: readonly WorkOrder[],
  inspections: readonly Inspection[],
  maintenanceRecords: readonly MaintenanceRecord[],
  ctx: DimensionContext,
  now: number,
): MachineCorrelation[] {
  const fleetDowntime = ratio(
    sum(oeeSnapshots, (o) => o.downtimeMin),
    Math.max(1, machines.length),
  )
  const rows = machines.map((machine) => {
    const own = wos.filter((wo) => wo.machineId === machine.id && wo.status !== 'cancelled')
    const ownIds = new Set(own.map((wo) => wo.id))
    const done = inspections.filter(
      (i) => i.woId && ownIds.has(i.woId) && (i.status === 'passed' || i.status === 'failed'),
    )
    const failed = done.filter((i) => i.status === 'failed').length
    const timed = own.filter(
      (wo) => runMs(wo, now) > 0 && producedQty(wo) > 0 && standardCycleSec(ctx, wo) !== null,
    )
    const actualSec = sum(timed, (wo) => runMs(wo, now) / 1000)
    const standardSec = sum(timed, (wo) => standardCycleSec(ctx, wo)! * producedQty(wo))
    const downtimeMin = sum(
      oeeSnapshots.filter((o) => o.machineId === machine.id),
      (o) => o.downtimeMin,
    )
    const maintenanceCount = maintenanceRecords.filter((r) => r.machineId === machine.id).length
    const failedRate = done.length ? failed / done.length : null
    const cycleDeviation = standardSec > 0 ? actualSec / standardSec - 1 : null
    const signals: string[] = []
    if (downtimeMin > fleetDowntime * 1.5 && downtimeMin > 0)
      signals.push(`downtime ${(downtimeMin / Math.max(1, fleetDowntime)).toFixed(1)}× the fleet average`)
    if (failedRate !== null && failedRate >= 0.2) signals.push(`${pct(failedRate)} of inspections failed`)
    if (cycleDeviation !== null && cycleDeviation >= 0.15)
      signals.push(`cycle ${pct(cycleDeviation)} slower than standard`)
    const flagged = signals.length >= 2 || (signals.length === 1 && maintenanceCount >= 2)
    const note = signals.length
      ? `${signals.join(', ')} with ${maintenanceCount} maintenance record${maintenanceCount === 1 ? '' : 's'}${flagged ? ': condition and output move together' : ''}.`
      : 'No signal above the fleet.'
    return {
      machineId: machine.id,
      downtimeMin,
      inspectionCount: done.length,
      failedInspectionRate: failedRate,
      cycleDeviation,
      maintenanceCount,
      woIds: own.map((wo) => wo.id),
      flagged,
      note,
    }
  })
  return rows.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.downtimeMin - a.downtimeMin)
}

// ─── Phase 22: recommendations ──────────────────────────────────

export type RecommendationKind =
  'reschedule' | 'reassign' | 'maintenance_aware' | 'quality_routing' | 'material_priority' | 'bottleneck'

export const RECOMMENDATION_KIND_LABEL: Record<RecommendationKind, string> = {
  reschedule: 'Schedule',
  reassign: 'Reassignment',
  maintenance_aware: 'Maintenance-aware',
  quality_routing: 'Quality routing',
  material_priority: 'Material priority',
  bottleneck: 'Bottleneck',
}

export const RECOMMENDATION_KINDS: RecommendationKind[] = [
  'reschedule',
  'reassign',
  'maintenance_aware',
  'quality_routing',
  'material_priority',
  'bottleneck',
]

export type EvidenceKind =
  'mo' | 'wo' | 'machine' | 'requirement' | 'inspection' | 'workCenter' | 'person' | 'maintenance'

export interface Evidence {
  label: string
  kind: EvidenceKind
  id: string
}

export interface Recommendation {
  /** Stable across renders: derived from the entities it refers to. */
  id: string
  kind: RecommendationKind
  title: string
  rationale: string
  evidence: Evidence[]
  impact: string
  action: AppAction | null
  highImpact: boolean
}

export type RecommendationSource = DimensionSource &
  Pick<AppState, 'materialRequirements' | 'inspections' | 'maintenanceRecords'> & { siteId: string }

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

function alternativeMachine(
  s: RecommendationSource,
  wo: WorkOrder,
  ctx: DimensionContext,
  exclude: ReadonlySet<string>,
): Machine | undefined {
  const productId = ctx.mo.get(wo.moId)?.productId
  return [...s.machines]
    .filter(
      (m) =>
        m.workCenterId === wo.workCenterId &&
        m.active &&
        m.maintenanceState === 'available' &&
        !exclude.has(m.id) &&
        (!productId || m.eligibleProductIds.length === 0 || m.eligibleProductIds.includes(productId)),
    )
    .sort(
      (a, b) => Number(b.state === 'idle') - Number(a.state === 'idle') || a.code.localeCompare(b.code),
    )[0]
}

const woEvidence = (wo: WorkOrder): Evidence => ({ label: wo.code, kind: 'wo', id: wo.id })
const moEvidence = (mo: ManufacturingOrder): Evidence => ({ label: mo.code, kind: 'mo', id: mo.id })
const machineEvidence = (m: Machine): Evidence => ({ label: m.code, kind: 'machine', id: m.id })

export function recommendations(s: RecommendationSource, now: number): Recommendation[] {
  const ctx = dimensionContext(s)
  const out: Recommendation[] = []
  const openWos = s.workOrders.filter((wo) => OPEN_WO_STATUSES.includes(wo.status))
  const openMos = s.manufacturingOrders.filter((mo) => OPEN_MO_STATUSES.includes(mo.status))
  const moOf = (wo: WorkOrder) => ctx.mo.get(wo.moId)

  // Maintenance-aware: work planned on a machine that the CMMS takes away in the same window.
  for (const wo of openWos) {
    const machine = wo.machineId ? ctx.machine.get(wo.machineId) : undefined
    if (!machine || (machine.maintenanceState !== 'planned' && machine.maintenanceState !== 'in_maintenance'))
      continue
    const outage = s.maintenanceRecords.find(
      (r) =>
        r.machineId === machine.id &&
        r.status !== 'completed' &&
        overlaps(toMs(r.plannedStart), toMs(r.plannedEnd), toMs(wo.plannedStart), toMs(wo.plannedEnd)),
    )
    if (machine.maintenanceState === 'planned' && !outage) continue
    const alt = alternativeMachine(s, wo, ctx, new Set([machine.id]))
    const mo = moOf(wo)
    out.push({
      id: `rec:maintenance_aware:${wo.id}:${alt?.id ?? 'none'}`,
      kind: 'maintenance_aware',
      title: alt
        ? `Move ${wo.code} from ${machine.code} to ${alt.code}`
        : `${wo.code} sits on a machine under maintenance`,
      rationale: outage
        ? `${machine.code} has ${outage.title.toLowerCase()} (${outage.code}) inside the work order window.`
        : `${machine.code} is in maintenance while ${wo.code} is scheduled on it.`,
      evidence: [
        woEvidence(wo),
        machineEvidence(machine),
        ...(outage ? [{ label: outage.code, kind: 'maintenance' as const, id: outage.id }] : []),
        ...(mo ? [moEvidence(mo)] : []),
      ],
      impact: alt
        ? `Keeps ${wo.operationName} on plan without waiting for the outage to end.`
        : 'No free machine in the work center; the operation waits for maintenance.',
      action: alt ? { type: 'workOrders/assign', id: wo.id, assignment: { machineId: alt.id } } : null,
      highImpact: wo.status === 'in_progress' || wo.status === 'paused',
    })
  }

  // Reschedule: two planned work orders overlap on one machine.
  const moved = new Set<string>()
  const byMachine = new Map<string, WorkOrder[]>()
  for (const wo of openWos) {
    if (!wo.machineId || isRunning(wo)) continue
    const list = byMachine.get(wo.machineId)
    if (list) list.push(wo)
    else byMachine.set(wo.machineId, [wo])
  }
  for (const [machineId, list] of byMachine) {
    list.sort((a, b) => toMs(a.plannedStart) - toMs(b.plannedStart))
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i]!
      const b = list[i + 1]!
      if (toMs(b.plannedStart) >= toMs(a.plannedEnd)) continue
      const rankA = PRIORITY_RANK[moOf(a)?.priority ?? a.priority]
      const rankB = PRIORITY_RANK[moOf(b)?.priority ?? b.priority]
      const [keep, shift] = rankB < rankA ? [b, a] : [a, b]
      if (moved.has(shift.id)) continue
      moved.add(shift.id)
      const duration = toMs(shift.plannedEnd) - toMs(shift.plannedStart)
      const start = toMs(keep.plannedEnd)
      const mo = moOf(shift)
      const pastMoEnd = mo ? start + duration > toMs(mo.plannedEnd) : false
      const machine = ctx.machine.get(machineId)
      out.push({
        id: `rec:reschedule:${shift.id}:${keep.id}`,
        kind: 'reschedule',
        title: `Shift ${shift.code} after ${keep.code} on ${machine?.code ?? machineId}`,
        rationale: `Both are planned on ${machine?.code ?? machineId} at the same time; ${keep.code} carries the higher priority.`,
        evidence: [woEvidence(shift), woEvidence(keep), ...(machine ? [machineEvidence(machine)] : [])],
        impact: pastMoEnd
          ? `${shift.code} would end after its order's planned finish; the order needs a new date.`
          : `${shift.code} starts ${Math.round((start - toMs(shift.plannedStart)) / MINUTE)} minutes later and stays inside its order window.`,
        action: {
          type: 'workOrders/reschedule',
          id: shift.id,
          plannedStart: toIso(start),
          plannedEnd: toIso(start + duration),
        },
        highImpact: pastMoEnd,
      })
    }
  }

  // Reassign: an operator on leave is still on the crew.
  for (const wo of openWos) {
    const away = wo.operatorIds.filter((id) => ctx.person.get(id)?.availability === 'leave')
    if (!away.length) continue
    const replacement = [...s.people]
      .filter(
        (p) =>
          p.role === 'operator' &&
          p.availability === 'on_shift' &&
          p.workCenterIds.includes(wo.workCenterId) &&
          !wo.operatorIds.includes(p.id) &&
          (!wo.shiftId || p.shiftId === wo.shiftId),
      )
      .sort((a, b) => a.code.localeCompare(b.code))[0]
    const awayNames = away.map((id) => ctx.person.get(id)?.name ?? id).join(', ')
    out.push({
      id: `rec:reassign:${wo.id}:${replacement?.id ?? 'none'}`,
      kind: 'reassign',
      title: replacement
        ? `Put ${replacement.name} on ${wo.code} for ${awayNames}`
        : `${wo.code} has no available operator`,
      rationale: `${awayNames} ${away.length === 1 ? 'is' : 'are'} on leave but still assigned to ${wo.operationName}.`,
      evidence: [
        woEvidence(wo),
        ...away.map((id) => ({ label: ctx.person.get(id)?.name ?? id, kind: 'person' as const, id })),
      ],
      impact: replacement
        ? 'The operation can start on time with a qualified operator.'
        : 'Nobody qualified for the work center is on shift; the operation will wait.',
      action: replacement
        ? {
            type: 'workOrders/assign',
            id: wo.id,
            assignment: {
              operatorIds: [...wo.operatorIds.filter((id) => !away.includes(id)), replacement.id],
            },
          }
        : null,
      highImpact: false,
    })
  }

  // Material priority: an urgent order is short while a lower-priority one holds the same material.
  const openMoIds = new Set(openMos.map((mo) => mo.id))
  const shortages = s.materialRequirements.filter((r) => r.status === 'shortage' && openMoIds.has(r.moId))
  const handled = new Set<string>()
  for (const req of shortages) {
    const mo = ctx.mo.get(req.moId)
    if (!mo || (mo.priority !== 'high' && mo.priority !== 'critical')) continue
    const key = `${mo.id}:${req.materialId}`
    if (handled.has(key)) continue
    handled.add(key)
    const hoarder = s.materialRequirements
      .filter(
        (r) =>
          r.materialId === req.materialId &&
          r.moId !== mo.id &&
          openMoIds.has(r.moId) &&
          r.reservedQty > r.consumedQty &&
          PRIORITY_RANK[ctx.mo.get(r.moId)!.priority] > PRIORITY_RANK[mo.priority],
      )
      .map((r) => ({ r, mo: ctx.mo.get(r.moId)! }))
      .sort(
        (a, b) =>
          PRIORITY_RANK[b.mo.priority] - PRIORITY_RANK[a.mo.priority] || b.r.reservedQty - a.r.reservedQty,
      )[0]
    const lower = hoarder ? PRIORITIES[Math.max(0, PRIORITIES.indexOf(hoarder.mo.priority) - 1)]! : null
    out.push({
      id: `rec:material_priority:${req.id}:${hoarder?.mo.id ?? 'none'}`,
      kind: 'material_priority',
      title: hoarder
        ? `Lower ${hoarder.mo.code} to ${lower} so ${mo.code} gets its material`
        : `${mo.code} is short with no reservation to release`,
      rationale: hoarder
        ? `${mo.code} (${mo.priority}) is short of a material that ${hoarder.mo.code} (${hoarder.mo.priority}) has ${hoarder.r.reservedQty} reserved and not consumed.`
        : `${mo.code} (${mo.priority}) is short and no lower-priority order holds a reservation on the material.`,
      evidence: [
        moEvidence(mo),
        { label: 'Shortage', kind: 'requirement', id: req.id },
        ...(hoarder
          ? [moEvidence(hoarder.mo), { label: 'Reservation', kind: 'requirement' as const, id: hoarder.r.id }]
          : []),
      ],
      impact: hoarder
        ? 'Planning can re-reserve the material for the urgent order once priorities are swapped.'
        : 'Warehouse needs a receipt or a substitute before the order can start.',
      action:
        hoarder && lower && lower !== hoarder.mo.priority
          ? { type: 'manufacturingOrders/setPriority', id: hoarder.mo.id, priority: lower }
          : null,
      highImpact: true,
    })
  }

  // Bottleneck: a work center is booked past capacity for the next seven days.
  const capacity = capacityByWorkCenter(s, s.siteId, now, now + 7 * DAY)
  for (const row of capacity.filter((c) => c.load > 1)) {
    const wc = ctx.orgById.get(row.workCenterId)
    if (!wc) continue
    const line = orgUp(ctx, wc.id, 'line')
    const relief = capacity
      .filter((c) => c.workCenterId !== wc.id && c.load < 0.8)
      .map((c) => ({ c, node: ctx.orgById.get(c.workCenterId) }))
      .filter((x) => x.node && orgUp(ctx, x.node.id, 'line')?.id !== line?.id)
      .sort((a, b) => a.c.load - b.c.load)[0]
    out.push({
      id: `rec:bottleneck:${wc.id}:${relief?.node?.id ?? 'none'}`,
      kind: 'bottleneck',
      title: `${wc.name} is loaded at ${Math.round(row.load * 100)}% for the next 7 days`,
      rationale: `${row.woCount} open work orders need ${row.requiredHours.toFixed(0)}h against ${row.availableHours.toFixed(0)}h available.`,
      evidence: [
        { label: wc.name, kind: 'workCenter', id: wc.id },
        ...(relief?.node
          ? [{ label: relief.node.name, kind: 'workCenter' as const, id: relief.node.id }]
          : []),
      ],
      impact: relief?.node
        ? `${relief.node.name} on another line runs at ${Math.round(relief.c.load * 100)}%; moving work there levels the load.`
        : 'No work center on another line has spare capacity; consider overtime or a later start.',
      action: null,
      highImpact: false,
    })
  }

  // Quality routing: repeated failed inspections at one operation on one machine.
  const recentFailed = s.inspections.filter(
    (i) => i.status === 'failed' && i.woId && i.completedAt && toMs(i.completedAt) >= now - 14 * DAY,
  )
  const failedByMachineOp = new Map<string, Inspection[]>()
  for (const i of recentFailed) {
    const wo = ctx.wo.get(i.woId!)
    if (!wo?.machineId) continue
    const key = `${wo.machineId}|${i.operationSeq}`
    const list = failedByMachineOp.get(key)
    if (list) list.push(i)
    else failedByMachineOp.set(key, [i])
  }
  for (const [key, list] of failedByMachineOp) {
    if (list.length < 2) continue
    const [machineId, seqText] = key.split('|')
    const seq = Number(seqText)
    const machine = ctx.machine.get(machineId!)
    if (!machine) continue
    const next = openWos
      .filter((wo) => wo.machineId === machineId && wo.operationSeq === seq && !isRunning(wo))
      .sort((a, b) => toMs(a.plannedStart) - toMs(b.plannedStart))[0]
    if (!next) continue
    const alt = alternativeMachine(s, next, ctx, new Set([machine.id]))
    out.push({
      id: `rec:quality_routing:${next.id}:${alt?.id ?? 'none'}`,
      kind: 'quality_routing',
      title: alt
        ? `Route ${next.code} to ${alt.code} instead of ${machine.code}`
        : `Hold ${next.code} on ${machine.code} for a check`,
      rationale: `${list.length} inspections failed at operation ${seq} on ${machine.code} in the last 14 days.`,
      evidence: [
        woEvidence(next),
        machineEvidence(machine),
        ...list.slice(0, 3).map((i) => ({ label: i.code, kind: 'inspection' as const, id: i.id })),
      ],
      impact: alt
        ? 'The next batch avoids the machine until quality finds the cause.'
        : 'No alternative machine in the work center; quality should check the machine before the next run.',
      action: alt ? { type: 'workOrders/assign', id: next.id, assignment: { machineId: alt.id } } : null,
      highImpact: true,
    })
  }

  // Priority: an order flagged at risk still runs below critical.
  for (const mo of openMos.filter((m) => m.atRisk && m.priority !== 'critical')) {
    const higher = PRIORITIES[PRIORITIES.indexOf(mo.priority) + 1]!
    out.push({
      id: `rec:reschedule:priority:${mo.id}:${higher}`,
      kind: 'reschedule',
      title: `Raise ${mo.code} to ${higher}`,
      rationale: mo.atRiskReason || 'The order is flagged at risk.',
      evidence: [moEvidence(mo)],
      impact: 'Dispatch sorts the order ahead of others on the same work centers.',
      action: { type: 'manufacturingOrders/setPriority', id: mo.id, priority: higher },
      highImpact: true,
    })
  }

  return out
}

/** Recommendations not yet applied or dismissed, for the navigation badge. */
export function countOpenRecommendations(
  s: RecommendationSource,
  now: number,
  decidedIds: readonly string[],
): number {
  const decided = new Set(decidedIds)
  return recommendations(s, now).filter((r) => !decided.has(r.id)).length
}
