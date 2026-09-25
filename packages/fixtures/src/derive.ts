import type {
  IsoDate,
  ManufacturingOrder,
  MaterialRequirement,
  OeeSnapshot,
  OrgNode,
  RequirementStatus,
  Shift,
  Wip,
  WorkOrder,
} from '@mes/types'
import { OPEN_MO_STATUSES } from '@mes/types'
import { HOUR, toMs, wib } from './dates'
import type { AppState } from './store'

// ─── Manufacturing orders ───────────────────────────────────────

export interface MoProgress {
  totalOps: number
  completedOps: number
  /** Fraction of planned quantity finished at the last operation. */
  qtyRatio: number
  /** Fraction of operations completed, weighted by the running one. */
  ratio: number
  current: WorkOrder | null
}

export function moProgress(mo: ManufacturingOrder, workOrders: readonly WorkOrder[]): MoProgress {
  const own = workOrders
    .filter((w) => w.moId === mo.id && w.status !== 'cancelled')
    .sort((a, b) => a.operationSeq - b.operationSeq)
  const completed = own.filter((w) => w.status === 'completed').length
  const current =
    own.find((w) => w.status === 'in_progress' || w.status === 'paused') ??
    own.find((w) => w.status !== 'completed') ??
    null
  const running =
    current && current.status !== 'completed'
      ? Math.min(1, current.outputQty / Math.max(1, current.targetQty))
      : 0
  const ratio = own.length
    ? (completed + running) / own.length
    : mo.status === 'completed' || mo.status === 'closed'
      ? 1
      : 0
  return {
    totalOps: own.length,
    completedOps: completed,
    qtyRatio: Math.min(1, mo.goodQty / Math.max(1, mo.qty)),
    ratio,
    current,
  }
}

/** Good quantity reported so far: the order total once the last operation reports, otherwise the furthest operation's good output. */
export function moActualQty(mo: ManufacturingOrder, workOrders: readonly WorkOrder[]): number {
  if (mo.goodQty > 0) return mo.goodQty
  const reported = workOrders
    .filter((w) => w.moId === mo.id && w.goodQty > 0)
    .sort((a, b) => b.operationSeq - a.operationSeq)
  return reported[0]?.goodQty ?? 0
}

/** An open order whose remaining planned time is short compared with the work left. */
export function isMoDelayed(
  mo: ManufacturingOrder,
  workOrders: readonly WorkOrder[],
  now: number,
  thresholdPct = 20,
): boolean {
  if (!OPEN_MO_STATUSES.includes(mo.status) || mo.status === 'draft') return false
  const end = toMs(mo.plannedEnd)
  if (now > end) return true
  const start = toMs(mo.plannedStart)
  const elapsed = (now - start) / Math.max(1, end - start)
  const done = moProgress(mo, workOrders).ratio
  return elapsed > 0.3 && elapsed - done > thresholdPct / 100
}

export const isMoOverdue = (mo: ManufacturingOrder, now: number) =>
  OPEN_MO_STATUSES.includes(mo.status) && now > toMs(mo.plannedEnd)

// ─── Material readiness ─────────────────────────────────────────

export type Readiness = 'ready' | 'partial' | 'shortage'

export function materialReadiness(moId: string, requirements: readonly MaterialRequirement[]): Readiness {
  const own = requirements.filter((r) => r.moId === moId)
  if (!own.length) return 'ready'
  const states: RequirementStatus[] = own.map((r) => r.status)
  if (states.every((s) => s === 'ready' || s === 'consumed')) return 'ready'
  if (states.every((s) => s === 'shortage')) return 'shortage'
  return 'partial'
}

/** Free quantity of a material on floor stock and available lots at a site. */
export function materialOnHand(
  state: Pick<AppState, 'materialLots'>,
  materialId: string,
  siteId: string,
): number {
  return state.materialLots
    .filter(
      (l) =>
        l.materialId === materialId &&
        l.siteId === siteId &&
        l.status !== 'consumed' &&
        l.status !== 'returned' &&
        l.status !== 'hold',
    )
    .reduce((s, l) => s + l.qty, 0)
}

export function productOnHand(
  state: Pick<AppState, 'fgStock'>,
  productId: string,
  siteId: string,
): { qty: number; free: number } {
  const rows = state.fgStock.filter((f) => f.productId === productId && f.siteId === siteId)
  const qty = rows.reduce((s, f) => s + f.qty, 0)
  return { qty, free: qty - rows.reduce((s, f) => s + f.allocatedQty, 0) }
}

// ─── WIP ────────────────────────────────────────────────────────

export const wipAgeHours = (wip: Wip, now: number) => (now - toMs(wip.updatedAt)) / HOUR

export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

export const sumBy = <T>(items: readonly T[], value: (item: T) => number) =>
  items.reduce((s, item) => s + value(item), 0)

// ─── Org hierarchy ──────────────────────────────────────────────

/** "Plant 1 › Finishing hall › Line A" for any node. */
export function orgPath(nodes: readonly OrgNode[], id: string | null): string {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parts: string[] = []
  let node = id ? byId.get(id) : undefined
  while (node) {
    parts.unshift(node.name)
    node = node.parentId ? byId.get(node.parentId) : undefined
  }
  return parts.join(' › ')
}

/** The nearest ancestor (or the node itself) of a given kind. */
export function orgAncestor(
  nodes: readonly OrgNode[],
  id: string | null,
  kind: OrgNode['kind'],
): OrgNode | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let node = id ? byId.get(id) : undefined
  while (node && node.kind !== kind) node = node.parentId ? byId.get(node.parentId) : undefined
  return node
}

/** The work center with a given code at a site. Routings carry codes because each site has its own node. */
export function workCenterForSite(
  nodes: readonly OrgNode[],
  siteId: string,
  code: string,
): OrgNode | undefined {
  return nodes.find((n) => n.siteId === siteId && n.kind === 'work_center' && n.code === code)
}

export function orgDescendants(nodes: readonly OrgNode[], id: string): Set<string> {
  const result = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && result.has(n.parentId) && !result.has(n.id)) {
        result.add(n.id)
        grew = true
      }
    }
  }
  return result
}

// ─── Shifts ─────────────────────────────────────────────────────

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** The shift running at an instant, in plant time. Night shifts wrap past midnight. */
export function shiftAt(shifts: readonly Shift[], ms: number): Shift | undefined {
  const { hours, minutes } = wib(ms)
  const t = hours * 60 + minutes
  return shifts.find((s) => {
    const start = minutesOf(s.start)
    const end = minutesOf(s.end)
    return start < end ? t >= start && t < end : t >= start || t < end
  })
}

// ─── Traceability ───────────────────────────────────────────────

export type TraceNodeKind =
  | 'product'
  | 'receipt'
  | 'serial'
  | 'batch'
  | 'wip'
  | 'operation'
  | 'machine'
  | 'operator'
  | 'lot'
  | 'supplier'
  | 'customer'
  | 'mo'
  | 'inspection'

export interface TraceNode {
  id: string
  kind: TraceNodeKind
  title: string
  subtitle: string
  at: IsoDate | null
  children: TraceNode[]
}

const uniq = <T>(items: T[]) => [...new Set(items)]

/** Finished product → batch → WIP → operations → machine, operator → material lot → supplier. */
export function traceBackward(state: AppState, moId: string): TraceNode | null {
  const mo = state.manufacturingOrders.find((m) => m.id === moId)
  if (!mo) return null
  const product = state.products.find((p) => p.id === mo.productId)
  const person = (id: string) => state.people.find((p) => p.id === id)
  const wips = state.wips.filter((w) => w.moId === mo.id)
  const wos = state.workOrders.filter((w) => w.moId === mo.id).sort((a, b) => a.operationSeq - b.operationSeq)
  const lotIds = uniq([
    ...wips.flatMap((w) => w.lotIds),
    ...state.materialTxns
      .filter((t) => t.moId === mo.id && t.kind === 'consume' && t.lotId)
      .map((t) => t.lotId!),
  ])
  const lotNodes: TraceNode[] = lotIds.map((lotId) => {
    const lot = state.materialLots.find((l) => l.id === lotId)
    const material = state.materials.find((m) => m.id === lot?.materialId)
    const supplier = state.suppliers.find((s) => s.id === lot?.supplierId)
    return {
      id: lotId,
      kind: 'lot',
      title: lot ? `${lot.code} · ${material?.name ?? ''}` : lotId,
      subtitle: lot ? `${lot.qty} ${state.uoms.find((u) => u.id === lot.uomId)?.code ?? ''} received` : '',
      at: lot?.receivedAt ?? null,
      children: supplier
        ? [
            {
              id: supplier.id,
              kind: 'supplier',
              title: supplier.name,
              subtitle: supplier.city,
              at: null,
              children: [],
            },
          ]
        : [],
    }
  })
  const opNodes: TraceNode[] = wos.map((wo) => {
    const machine = state.machines.find((m) => m.id === wo.machineId)
    const inspections = state.inspections.filter((i) => i.woId === wo.id)
    return {
      id: wo.id,
      kind: 'operation',
      title: `${wo.operationSeq} · ${wo.operationName}`,
      subtitle: `${wo.code} · ${wo.goodQty} good / ${wo.rejectQty} reject / ${wo.scrapQty} scrap`,
      at: wo.actualStart,
      children: [
        ...(machine
          ? [
              {
                id: machine.id,
                kind: 'machine' as const,
                title: `${machine.code} · ${machine.name}`,
                subtitle: machine.model,
                at: null,
                children: [],
              },
            ]
          : []),
        ...wo.operatorIds.map((id) => ({
          id,
          kind: 'operator' as const,
          title: person(id)?.name ?? id,
          subtitle: person(id)?.code ?? '',
          at: null,
          children: [],
        })),
        ...inspections.map((i) => ({
          id: i.id,
          kind: 'inspection' as const,
          title: `${i.code} · ${i.status}`,
          subtitle: i.disposition ?? 'pending',
          at: i.completedAt ?? i.requestedAt,
          children: [],
        })),
      ],
    }
  })
  const batchNodes: TraceNode[] = uniq(wips.map((w) => w.batch)).map((batch) => ({
    id: `${mo.id}-${batch}`,
    kind: 'batch',
    title: batch,
    subtitle: `${wips.filter((w) => w.batch === batch).length} WIP records`,
    at: null,
    children: wips
      .filter((w) => w.batch === batch)
      .map((w) => ({
        id: w.id,
        kind: 'wip' as const,
        title: w.code,
        subtitle: `Op ${w.operationSeq} · ${w.qty} · ${w.state}`,
        at: w.updatedAt,
        children: [],
      })),
  }))
  const receipts = state.finishedGoodsReceipts.filter((r) => r.moId === mo.id)
  return {
    id: mo.id,
    kind: 'product',
    title: `${product?.name ?? mo.productId} · ${mo.code}`,
    subtitle: `${mo.goodQty} of ${mo.qty} good · revision ${mo.snapshot?.rev ?? 'n/a'}`,
    at: mo.actualEnd ?? mo.actualStart,
    children: [
      ...receipts.map((r) => ({
        id: r.id,
        kind: 'receipt' as const,
        title: `${r.code} · ${r.qty} received`,
        subtitle: r.lotCode,
        at: r.at,
        children: r.serialIds.slice(0, 5).map((sid) => ({
          id: sid,
          kind: 'serial' as const,
          title: state.serials.find((s) => s.id === sid)?.serialNo ?? sid,
          subtitle: '',
          at: null,
          children: [],
        })),
      })),
      ...batchNodes,
      {
        id: `${mo.id}-ops`,
        kind: 'mo',
        title: 'Operations',
        subtitle: `${wos.length} work orders`,
        at: null,
        children: opNodes,
      },
      {
        id: `${mo.id}-lots`,
        kind: 'mo',
        title: 'Material lots',
        subtitle: `${lotNodes.length} lots consumed`,
        at: null,
        children: lotNodes,
      },
    ],
  }
}

/** Raw material lot → WIP → batch → finished product → customer. */
export function traceForward(state: AppState, lotId: string): TraceNode | null {
  const lot = state.materialLots.find((l) => l.id === lotId)
  if (!lot) return null
  const material = state.materials.find((m) => m.id === lot.materialId)
  const moIds = uniq([
    ...state.wips.filter((w) => w.lotIds.includes(lot.id)).map((w) => w.moId),
    ...state.materialTxns.filter((t) => t.lotId === lot.id && t.moId).map((t) => t.moId!),
  ])
  const moNodes: TraceNode[] = moIds.map((moId) => {
    const mo = state.manufacturingOrders.find((m) => m.id === moId)!
    const product = state.products.find((p) => p.id === mo.productId)
    const wips = state.wips.filter((w) => w.moId === moId && w.lotIds.includes(lot.id))
    const receipts = state.finishedGoodsReceipts.filter((r) => r.moId === moId)
    const customers = uniq(
      state.demands
        .filter((d) => mo.demandIds.includes(d.id) && d.orderItemId)
        .map(
          (d) =>
            state.marketingOrders.find(
              (o) => o.id === state.marketingOrderItems.find((i) => i.id === d.orderItemId)?.orderId,
            )?.customerId,
        )
        .filter((c): c is string => !!c),
    )
    return {
      id: mo.id,
      kind: 'mo',
      title: `${mo.code} · ${product?.name ?? ''}`,
      subtitle: `${mo.status} · ${mo.goodQty} good`,
      at: mo.actualStart,
      children: [
        ...wips.map((w) => ({
          id: w.id,
          kind: 'wip' as const,
          title: w.code,
          subtitle: `Op ${w.operationSeq} · ${w.qty} · ${w.state}`,
          at: w.updatedAt,
          children: [],
        })),
        ...receipts.map((r) => ({
          id: r.id,
          kind: 'receipt' as const,
          title: `${r.code} · ${r.qty} finished`,
          subtitle: r.lotCode,
          at: r.at,
          children: [],
        })),
        ...customers.map((cid) => ({
          id: cid,
          kind: 'customer' as const,
          title: state.customers.find((c) => c.id === cid)?.name ?? cid,
          subtitle: 'Delivered to',
          at: null,
          children: [],
        })),
      ],
    }
  })
  return {
    id: lot.id,
    kind: 'lot',
    title: `${lot.code} · ${material?.name ?? ''}`,
    subtitle: `${state.suppliers.find((s) => s.id === lot.supplierId)?.name ?? 'No supplier'} · received`,
    at: lot.receivedAt,
    children: moNodes,
  }
}

// ─── Capacity ───────────────────────────────────────────────────

export interface CapacityRow {
  workCenterId: string
  requiredHours: number
  availableHours: number
  load: number
  woCount: number
}

/** Required hours from open work orders against available hours per work center in a window. */
export function capacityByWorkCenter(
  state: Pick<AppState, 'workOrders' | 'orgNodes' | 'shifts' | 'machines'>,
  siteId: string,
  from: number,
  to: number,
): CapacityRow[] {
  const days = Math.max(1, (to - from) / (24 * HOUR))
  const shiftHours = state.shifts.reduce((s, sh) => {
    const start = minutesOf(sh.start)
    const end = minutesOf(sh.end)
    const minutes = (end > start ? end - start : 24 * 60 - start + end) - sh.breakMin
    return s + minutes / 60
  }, 0)
  const rows: CapacityRow[] = []
  for (const wc of state.orgNodes.filter((n) => n.siteId === siteId && n.kind === 'work_center')) {
    const machines = state.machines.filter(
      (m) =>
        m.workCenterId === wc.id &&
        m.active &&
        m.maintenanceState !== 'in_maintenance' &&
        m.maintenanceState !== 'unavailable',
    ).length
    const availableHours =
      (wc.capacityHoursPerShift ? wc.capacityHoursPerShift * state.shifts.length : shiftHours) *
      Math.max(1, machines) *
      days
    const wos = state.workOrders.filter(
      (w) =>
        w.workCenterId === wc.id &&
        w.siteId === siteId &&
        w.status !== 'completed' &&
        w.status !== 'cancelled' &&
        toMs(w.plannedEnd) > from &&
        toMs(w.plannedStart) < to,
    )
    const requiredHours = wos.reduce((s, w) => {
      const start = Math.max(from, toMs(w.plannedStart))
      const end = Math.min(to, toMs(w.plannedEnd))
      return s + Math.max(0, end - start) / HOUR
    }, 0)
    rows.push({
      workCenterId: wc.id,
      requiredHours,
      availableHours,
      load: availableHours ? requiredHours / availableHours : 0,
      woCount: wos.length,
    })
  }
  return rows
}

// ─── OEE ────────────────────────────────────────────────────────

export interface OeeAverage {
  availability: number
  performance: number
  quality: number
  oee: number
  downtimeMin: number
  count: number
}

export function oeeAverage(snapshots: readonly OeeSnapshot[]): OeeAverage {
  const n = snapshots.length
  if (!n) return { availability: 0, performance: 0, quality: 0, oee: 0, downtimeMin: 0, count: 0 }
  const avg = (key: 'availability' | 'performance' | 'quality' | 'oee') =>
    snapshots.reduce((s, x) => s + x[key], 0) / n
  return {
    availability: avg('availability'),
    performance: avg('performance'),
    quality: avg('quality'),
    oee: avg('oee'),
    downtimeMin: snapshots.reduce((s, x) => s + x.downtimeMin, 0),
    count: n,
  }
}
