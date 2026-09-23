import type {
  Bom,
  Bop,
  Bor,
  CalendarDay,
  Category,
  Company,
  ConsumptionMode,
  Customer,
  DefectCode,
  DefectRecord,
  Demand,
  Disposition,
  Eco,
  EventType,
  FgStock,
  FinishedGoodsReceipt,
  FloorStock,
  Inspection,
  InspectionPlan,
  IntegrationConnection,
  IntegrationLog,
  IntegrationMapping,
  InventoryLocation,
  InventoryPolicy,
  IsoDate,
  LotRule,
  Machine,
  MachineState,
  MaintenanceRecord,
  ManufacturingOrder,
  MarketingOrder,
  MarketingOrderItem,
  MarketingOrderStatus,
  Material,
  MaterialLot,
  MaterialRequirement,
  MaterialTxn,
  Measurement,
  MoEvent,
  MoSource,
  Ncr,
  NcrStatus,
  NumberingSequence,
  OeeSnapshot,
  OrgNode,
  PauseReason,
  Person,
  Priority,
  Product,
  ProductRevision,
  ProductionEvent,
  ProductionPolicy,
  QualityHold,
  ReasonCode,
  Replenishment,
  Resource,
  ReworkOrder,
  ReworkStatus,
  ScrapRecord,
  Serial,
  SerialRule,
  Settings,
  Shift,
  Site,
  Skill,
  Specification,
  Supplier,
  TelemetryPoint,
  Uom,
  UomConversion,
  Validation,
  Wip,
  WipState,
  WoEvent,
  WoEventKind,
  WorkInstruction,
  WorkOrder,
} from '@mes/types'
import { VALIDATION_CHECKS } from '@mes/types'
import { HOUR, addHours, toIso, toMs } from './dates'
import { newId, nextCode } from './ids'

export interface AppState {
  company: Company
  sites: Site[]
  orgNodes: OrgNode[]
  customers: Customer[]
  suppliers: Supplier[]
  categories: Category[]
  uoms: Uom[]
  uomConversions: UomConversion[]
  products: Product[]
  materials: Material[]
  productRevisions: ProductRevision[]
  boms: Bom[]
  bors: Bor[]
  bops: Bop[]
  specifications: Specification[]
  workInstructions: WorkInstruction[]
  ecos: Eco[]
  machines: Machine[]
  resources: Resource[]
  skills: Skill[]
  people: Person[]
  shifts: Shift[]
  calendarDays: CalendarDay[]
  productionPolicies: ProductionPolicy[]
  inventoryLocations: InventoryLocation[]
  inventoryPolicies: InventoryPolicy[]
  lotRules: LotRule[]
  serialRules: SerialRule[]
  reasonCodes: ReasonCode[]
  numbering: NumberingSequence[]
  integrationMappings: IntegrationMapping[]
  integrationConnections: IntegrationConnection[]
  integrationLogs: IntegrationLog[]
  marketingOrders: MarketingOrder[]
  marketingOrderItems: MarketingOrderItem[]
  demands: Demand[]
  replenishments: Replenishment[]
  manufacturingOrders: ManufacturingOrder[]
  workOrders: WorkOrder[]
  materialLots: MaterialLot[]
  floorStock: FloorStock[]
  materialRequirements: MaterialRequirement[]
  materialTxns: MaterialTxn[]
  finishedGoodsReceipts: FinishedGoodsReceipt[]
  fgStock: FgStock[]
  /** Per-demand reservation. Older browser datasets are hydrated on load. */
  fgReservations?: FgReservation[]
  serials: Serial[]
  wips: Wip[]
  inspectionPlans: InspectionPlan[]
  inspections: Inspection[]
  defectCodes: DefectCode[]
  defectRecords: DefectRecord[]
  qualityHolds: QualityHold[]
  scrapRecords: ScrapRecord[]
  reworkOrders: ReworkOrder[]
  ncrs: Ncr[]
  productionEvents: ProductionEvent[]
  oeeSnapshots: OeeSnapshot[]
  telemetry: TelemetryPoint[]
  maintenanceRecords: MaintenanceRecord[]
  settings: Settings
}

export interface FgReservation {
  demandId: string
  stockId: string
  qty: number
}

/** Who did it and when. The app provider stamps this on every dispatch. */
export interface ActionMeta {
  by: string
  at: IsoDate
}

type Upsert<K extends string, T> = { type: `${K}/upsert`; item: T } | { type: `${K}/remove`; id: string }

export interface MoDraft {
  /** Caller-supplied id, so a dialog can navigate to the order it just created. */
  id?: string
  siteId: string
  productId: string
  qty: number
  source: MoSource
  demandIds: string[]
  replenishmentId: string | null
  priority: Priority
  lineId: string | null
  plannedStart: IsoDate
  plannedEnd: IsoDate
}

export interface WoAssignment {
  machineId?: string | null
  operatorIds?: string[]
  shiftId?: string | null
  toolIds?: string[]
  moldIds?: string[]
}

export interface OutputRecord {
  id: string
  goodQty: number
  rejectQty: number
  reworkQty: number
  scrapQty: number
  reasonCodeId: string | null
  note: string
}

export type AppAction =
  | Upsert<'orgNodes', OrgNode>
  | Upsert<'customers', Customer>
  | Upsert<'suppliers', Supplier>
  | Upsert<'categories', Category>
  | Upsert<'uoms', Uom>
  | Upsert<'uomConversions', UomConversion>
  | Upsert<'products', Product>
  | Upsert<'materials', Material>
  | Upsert<'productRevisions', ProductRevision>
  | Upsert<'boms', Bom>
  | Upsert<'bors', Bor>
  | Upsert<'bops', Bop>
  | Upsert<'specifications', Specification>
  | Upsert<'workInstructions', WorkInstruction>
  | Upsert<'ecos', Eco>
  | Upsert<'machines', Machine>
  | Upsert<'resources', Resource>
  | Upsert<'skills', Skill>
  | Upsert<'people', Person>
  | Upsert<'shifts', Shift>
  | Upsert<'calendarDays', CalendarDay>
  | Upsert<'productionPolicies', ProductionPolicy>
  | Upsert<'inventoryLocations', InventoryLocation>
  | Upsert<'inventoryPolicies', InventoryPolicy>
  | Upsert<'lotRules', LotRule>
  | Upsert<'serialRules', SerialRule>
  | Upsert<'reasonCodes', ReasonCode>
  | Upsert<'numbering', NumberingSequence>
  | Upsert<'integrationMappings', IntegrationMapping>
  | Upsert<'integrationConnections', IntegrationConnection>
  | Upsert<'defectCodes', DefectCode>
  | Upsert<'inspectionPlans', InspectionPlan>
  | Upsert<'marketingOrders', MarketingOrder>
  | Upsert<'marketingOrderItems', MarketingOrderItem>
  | Upsert<'materialLots', MaterialLot>
  | Upsert<'ncrs', Ncr>
  | Upsert<'qualityHolds', QualityHold>
  | Upsert<'demands', Demand>
  | Upsert<'replenishments', Replenishment>
  | Upsert<'workOrders', WorkOrder>
  | Upsert<'materialRequirements', MaterialRequirement>
  | Upsert<'floorStock', FloorStock>
  | Upsert<'wips', Wip>
  | Upsert<'reworkOrders', ReworkOrder>
  | Upsert<'inspections', Inspection>
  | Upsert<'scrapRecords', ScrapRecord>
  | Upsert<'materialTxns', MaterialTxn>
  | Upsert<'defectRecords', DefectRecord>
  | { type: 'settings/update'; patch: Partial<Settings> }
  // marketing and demand
  | { type: 'marketingOrders/confirm'; id: string }
  | { type: 'marketingOrders/setStatus'; id: string; status: MarketingOrderStatus }
  | { type: 'marketingOrderItems/deliver'; id: string; qty: number }
  | { type: 'demands/allocate'; id: string; qty: number }
  | { type: 'demands/resolveWithMo'; id: string; allocateQty: number; draft: MoDraft }
  | { type: 'demands/cancel'; id: string }
  | { type: 'replenishments/run'; siteId: string }
  | {
      type: 'replenishments/approve'
      id: string
      plannedStart: IsoDate
      plannedEnd: IsoDate
      lineId: string | null
    }
  | { type: 'replenishments/dismiss'; id: string }
  // manufacturing orders
  | { type: 'manufacturingOrders/create'; draft: MoDraft }
  | {
      type: 'manufacturingOrders/update'
      id: string
      patch: Partial<Pick<ManufacturingOrder, 'qty' | 'priority' | 'lineId' | 'plannedStart' | 'plannedEnd'>>
    }
  | { type: 'manufacturingOrders/plan'; id: string }
  | { type: 'manufacturingOrders/release'; id: string }
  | { type: 'manufacturingOrders/hold'; id: string; reasonCodeId: string; note: string }
  | { type: 'manufacturingOrders/resume'; id: string }
  | { type: 'manufacturingOrders/complete'; id: string }
  | { type: 'manufacturingOrders/close'; id: string }
  | { type: 'manufacturingOrders/cancel'; id: string }
  | { type: 'manufacturingOrders/setPriority'; id: string; priority: Priority }
  | { type: 'manufacturingOrders/setAtRisk'; id: string; atRisk: boolean; reason: string }
  // work orders
  | { type: 'workOrders/assign'; id: string; assignment: WoAssignment }
  | { type: 'workOrders/reschedule'; id: string; plannedStart: IsoDate; plannedEnd: IsoDate }
  | { type: 'workOrders/hold'; id: string; reasonCodeId: string; note: string }
  | { type: 'workOrders/releaseHold'; id: string }
  | { type: 'workOrders/setPriority'; id: string; priority: Priority }
  | { type: 'workOrders/start'; id: string }
  | { type: 'workOrders/pause'; id: string; reason: PauseReason; note: string }
  | { type: 'workOrders/resume'; id: string }
  | { type: 'workOrders/reportIssue'; id: string; text: string }
  | { type: 'workOrders/recordOutput'; record: OutputRecord }
  | { type: 'workOrders/complete'; id: string }
  | { type: 'workOrders/cancel'; id: string }
  // manufacturing inventory
  | { type: 'materials/reserve'; moId: string; materialId: string; lotId: string; qty: number }
  | {
      type: 'materials/stage'
      moId: string
      materialId: string
      lotId: string
      qty: number
      toLocationId: string
    }
  | {
      type: 'materials/issue'
      moId: string
      woId: string | null
      materialId: string
      lotId: string
      qty: number
    }
  | {
      type: 'materials/consume'
      moId: string
      woId: string
      materialId: string
      lotId: string
      qty: number
      mode: ConsumptionMode
    }
  | {
      type: 'materials/return'
      moId: string
      materialId: string
      lotId: string
      qty: number
      toLocationId: string
      reasonCodeId: string
    }
  | { type: 'materialLots/receive'; lot: Omit<MaterialLot, 'id' | 'code' | 'status'> }
  | { type: 'finishedGoods/receive'; moId: string; qty: number; locationId: string }
  // WIP
  | { type: 'wips/move'; id: string; locationId: string; state: WipState }
  | { type: 'wips/split'; id: string; qtys: number[] }
  | { type: 'wips/merge'; ids: string[] }
  | { type: 'wips/hold'; id: string; reasonCodeId: string; note: string }
  | { type: 'wips/release'; id: string; disposition: Disposition }
  // quality
  | {
      type: 'inspections/request'
      inspection: Omit<
        Inspection,
        'id' | 'code' | 'status' | 'completedAt' | 'disposition' | 'defectRecordIds' | 'measurements'
      > & { measurements: Measurement[] }
    }
  | { type: 'inspections/start'; id: string }
  | {
      type: 'inspections/record'
      id: string
      measurements: Measurement[]
      disposition: Disposition
      note: string
      defects: { defectCodeId: string; qty: number; note: string }[]
    }
  | { type: 'qualityHolds/release'; id: string; disposition: Disposition }
  | {
      type: 'scrap/record'
      moId: string
      woId: string
      wipId: string | null
      operationSeq: number
      qty: number
      reasonCodeId: string
      disposition: Disposition
      note: string
      inputAlreadyConsumed?: boolean
    }
  | {
      type: 'rework/create'
      moId: string
      sourceWoId: string
      sourceWipId: string | null
      qty: number
      routeSeqs: number[]
      reasonCodeId: string
      inputAlreadyConsumed?: boolean
    }
  | { type: 'rework/setStatus'; id: string; status: ReworkStatus }
  | { type: 'rework/close'; id: string; goodQty: number; scrapQty: number }
  | { type: 'ncrs/setStatus'; id: string; status: NcrStatus; disposition?: Disposition; containment?: string }
  // PLM governance
  | { type: 'ecos/submit'; id: string }
  | { type: 'ecos/decide'; id: string; decision: 'approved' | 'rejected'; note: string }
  | { type: 'ecos/release'; id: string; effectiveFrom: IsoDate }
  | { type: 'productRevisions/release'; id: string }
  // integrations
  | { type: 'integrationConnections/toggle'; id: string; enabled: boolean }
  | { type: 'integrationConnections/sync'; id: string }
  | { type: 'machines/setState'; id: string; state: MachineState; alarm: string | null }
  | { type: 'maintenance/request'; machineId: string; title: string; alarm: string | null }
  | { type: 'maintenance/complete'; id: string }

export interface Envelope {
  action: AppAction
  meta: ActionMeta
}

// ─── helpers ────────────────────────────────────────────────────

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id)
  if (index === -1) return [...list, item]
  const next = list.slice()
  next[index] = item
  return next
}

function patchItem<T extends { id: string }>(list: T[], id: string, patch: (item: T) => T): T[] {
  return list.map((x) => (x.id === id ? patch(x) : x))
}

const remove = <T extends { id: string }>(list: T[], id: string) => list.filter((x) => x.id !== id)

const stripUpsert = (type: string) => type.replace(/\/(upsert|remove)$/, '') as keyof AppState

function codeOf(state: AppState, entity: string, fallbackPrefix: string, digits = 5): string {
  const seq = state.numbering.find((n) => n.entity === entity)
  if (!seq) return nextCode([], fallbackPrefix, digits)
  return `${seq.prefix}${String(seq.next).padStart(digits, '0')}`
}

function bumpNumbering(state: AppState, entity: string): NumberingSequence[] {
  return state.numbering.map((n) => (n.entity === entity ? { ...n, next: n.next + 1 } : n))
}

function event(
  state: AppState,
  meta: ActionMeta,
  type: EventType,
  text: string,
  refs: Partial<Pick<ProductionEvent, 'siteId' | 'moId' | 'woId' | 'wipId' | 'lotId' | 'machineId'>> = {},
): ProductionEvent[] {
  const siteId =
    refs.siteId ?? state.manufacturingOrders.find((m) => m.id === refs.moId)?.siteId ?? state.sites[0]!.id
  return [
    ...state.productionEvents,
    {
      id: newId('evt'),
      siteId,
      type,
      at: meta.at,
      by: meta.by,
      moId: refs.moId ?? null,
      woId: refs.woId ?? null,
      wipId: refs.wipId ?? null,
      lotId: refs.lotId ?? null,
      machineId: refs.machineId ?? null,
      text,
    },
  ]
}

const moEvent = (meta: ActionMeta, type: EventType, text: string): MoEvent => ({
  id: newId('moe'),
  at: meta.at,
  by: meta.by,
  type,
  text,
})
const woEvent = (meta: ActionMeta, kind: WoEventKind, text: string, qty: number | null = null): WoEvent => ({
  id: newId('woe'),
  at: meta.at,
  by: meta.by,
  kind,
  text,
  qty,
})

function withMoEvent(
  state: AppState,
  id: string,
  patch: Partial<ManufacturingOrder>,
  meta: ActionMeta,
  type: EventType,
  text: string,
): AppState {
  const mo = state.manufacturingOrders.find((m) => m.id === id)
  if (!mo) return state
  return {
    ...state,
    manufacturingOrders: patchItem(state.manufacturingOrders, id, (m) => ({
      ...m,
      ...patch,
      events: [...m.events, moEvent(meta, type, text)],
    })),
    productionEvents: event(state, meta, type, `${mo.code}: ${text}`, { moId: id, siteId: mo.siteId }),
  }
}

function withWoEvent(
  state: AppState,
  id: string,
  patch: Partial<WorkOrder>,
  meta: ActionMeta,
  kind: WoEventKind,
  text: string,
  qty: number | null = null,
  eventType?: EventType,
): AppState {
  const wo = state.workOrders.find((w) => w.id === id)
  if (!wo) return state
  const next: AppState = {
    ...state,
    workOrders: patchItem(state.workOrders, id, (w) => ({
      ...w,
      ...patch,
      events: [...w.events, woEvent(meta, kind, text, qty)],
    })),
  }
  if (!eventType) return next
  return {
    ...next,
    productionEvents: event(next, meta, eventType, `${wo.code}: ${text}`, {
      moId: wo.moId,
      woId: id,
      siteId: wo.siteId,
      machineId: patch.machineId ?? wo.machineId,
    }),
  }
}

/** Released revision of a product, or the newest one when nothing is released. */
export function currentRevision(state: AppState, productId: string): ProductRevision | undefined {
  const product = state.products.find((p) => p.id === productId)
  const revisions = state.productRevisions.filter((r) => r.productId === productId)
  return (
    revisions.find((r) => r.id === product?.currentRevisionId && r.state === 'released') ??
    revisions.find((r) => r.state === 'released') ??
    revisions.at(-1)
  )
}

function requirementStatus(r: MaterialRequirement): MaterialRequirement['status'] {
  if (r.consumedQty >= r.requiredQty) return 'consumed'
  const ready = r.reservedQty + r.stagedQty + r.issuedQty + r.consumedQty
  if (ready >= r.requiredQty) return 'ready'
  return ready > 0 ? 'partial' : 'shortage'
}

function moProgressStatus(mo: ManufacturingOrder, wos: WorkOrder[]): ManufacturingOrder['status'] {
  const own = wos.filter((w) => w.moId === mo.id)
  if (own.length && own.every((w) => w.status === 'completed')) return 'completed'
  if (own.some((w) => w.status === 'in_progress' || w.status === 'paused' || w.status === 'completed'))
    return 'in_progress'
  return mo.status
}

export function moCompletionBlocker(state: AppState, mo: ManufacturingOrder): string | null {
  if (mo.status !== 'in_progress' && mo.status !== 'released') return 'Order is not running.'
  const wos = state.workOrders.filter((w) => w.moId === mo.id)
  if (!wos.length) return 'Release the order to create its operations first.'
  const unfinished = wos.filter((w) => w.status !== 'completed')
  if (unfinished.length)
    return `${unfinished.length} operation${unfinished.length === 1 ? '' : 's'} still unfinished.`
  if (state.qualityHolds.some((h) => h.moId === mo.id && h.status === 'active'))
    return 'Release the active quality hold first.'
  return null
}

export function moCloseBlocker(state: AppState, mo: ManufacturingOrder): string | null {
  if (mo.status !== 'completed') return 'Complete every operation before closing the order.'
  const received = state.finishedGoodsReceipts
    .filter((r) => r.moId === mo.id)
    .reduce((sum, r) => sum + r.qty, 0)
  return received < mo.goodQty
    ? `${mo.goodQty - received} finished pieces still need warehouse receipt.`
    : null
}

export function woCompletionBlocker(state: AppState, wo: WorkOrder): string | null {
  if (wo.status !== 'in_progress' && wo.status !== 'paused') return 'Operation is not running.'
  if (wo.qualityRequired) {
    const latest = state.inspections
      .filter((i) => i.woId === wo.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id))[0]
    if (
      !latest ||
      latest.status !== 'passed' ||
      (latest.disposition !== 'accept' && latest.disposition !== 'use_as_is')
    )
      return 'A passed inspection with an accepted disposition is required.'
  }
  if (
    state.qualityHolds.some(
      (h) =>
        h.moId === wo.moId &&
        h.status === 'active' &&
        (h.targetId === wo.id ||
          state.wips.some((w) => w.id === h.targetId && w.operationSeq === wo.operationSeq)),
    )
  )
    return 'Release the active quality hold first.'
  return null
}

export function outputBlocker(state: AppState, record: OutputRecord): string | null {
  const wo = state.workOrders.find((w) => w.id === record.id)
  if (!wo || wo.status !== 'in_progress') return 'Start or resume the operation before recording output.'
  const quantities = [record.goodQty, record.rejectQty, record.reworkQty, record.scrapQty]
  if (quantities.some((n) => !Number.isSafeInteger(n) || n < 0)) return 'Use whole, non-negative quantities.'
  if ([record.rejectQty, record.reworkQty, record.scrapQty].filter((n) => n > 0).length > 1)
    return 'Record one reject, rework, or scrap reason at a time.'
  const total = quantities.reduce((sum, n) => sum + n, 0)
  if (!total) return 'Enter at least one quantity.'
  const available = state.wips
    .filter(
      (w) =>
        w.moId === wo.moId &&
        w.operationSeq === wo.operationSeq &&
        (w.state === 'processing' || w.state === 'queued'),
    )
    .reduce((sum, w) => sum + w.qty, 0)
  if (total > available) return `Only ${available} input pieces remain at this operation.`
  if (wo.outputQty + total > wo.targetQty)
    return `This exceeds the ${wo.targetQty} piece target. Ask a supervisor to adjust the order.`
  return null
}

export function orderCancellationBlocker(state: AppState, order: MarketingOrder): string | null {
  if (order.status === 'cancelled' || order.status === 'closed') return 'Order is already closed.'
  const items = state.marketingOrderItems.filter((i) => i.orderId === order.id)
  if (items.some((i) => i.deliveredQty > 0))
    return 'An order with deliveries needs a return or credit process.'
  const itemIds = new Set(items.map((i) => i.id))
  const demandIds = new Set(
    state.demands.filter((d) => d.orderItemId && itemIds.has(d.orderItemId)).map((d) => d.id),
  )
  const active = state.manufacturingOrders.filter(
    (m) =>
      m.demandIds.some((id) => demandIds.has(id)) && !['draft', 'planned', 'cancelled'].includes(m.status),
  )
  return active.length ? `Cancel or complete ${active.map((m) => m.code).join(', ')} first.` : null
}

export function demandCancellationBlocker(state: AppState, demand: Demand): string | null {
  if (demand.status === 'cancelled' || demand.status === 'fulfilled') return 'Demand is already closed.'
  const active = state.manufacturingOrders.filter(
    (m) => m.demandIds.includes(demand.id) && !['draft', 'planned', 'cancelled'].includes(m.status),
  )
  return active.length ? `Cancel or complete ${active.map((m) => m.code).join(', ')} first.` : null
}

/** Assign existing aggregate reservations to live demands when opening legacy demo data. */
export function hydrateFgReservations(state: AppState): AppState {
  if (state.fgReservations) return state
  const remaining = new Map(state.fgStock.map((f) => [f.id, f.allocatedQty]))
  const reservations: FgReservation[] = []
  for (const demand of state.demands) {
    if (!['open', 'resolved'].includes(demand.status) || demand.allocatedQty <= 0) continue
    const item = state.marketingOrderItems.find((i) => i.id === demand.orderItemId)
    let left = Math.max(0, demand.allocatedQty - (item?.deliveredQty ?? 0))
    for (const stock of state.fgStock) {
      if (!left || stock.siteId !== demand.siteId || stock.productId !== demand.productId) continue
      const take = Math.min(left, remaining.get(stock.id) ?? 0)
      if (!take) continue
      remaining.set(stock.id, (remaining.get(stock.id) ?? 0) - take)
      reservations.push({ demandId: demand.id, stockId: stock.id, qty: take })
      left -= take
    }
  }
  return { ...state, fgReservations: reservations }
}

function releaseFgReservations(state: AppState, demandIds: Set<string>) {
  const released = new Map<string, number>()
  for (const reservation of state.fgReservations ?? []) {
    if (demandIds.has(reservation.demandId))
      released.set(reservation.stockId, (released.get(reservation.stockId) ?? 0) + reservation.qty)
  }
  return {
    stock: state.fgStock.map((f) => ({ ...f, allocatedQty: f.allocatedQty - (released.get(f.id) ?? 0) })),
    reservations: (state.fgReservations ?? []).filter((r) => !demandIds.has(r.demandId)),
  }
}

export function deliveryBlocker(state: AppState, item: MarketingOrderItem, qty: number): string | null {
  const order = state.marketingOrders.find((o) => o.id === item.orderId)
  if (!order || !['confirmed', 'fulfilling', 'ready', 'partially_delivered'].includes(order.status))
    return 'Order must be active before delivery.'
  if (!Number.isSafeInteger(qty) || qty <= 0) return 'Use a positive whole quantity.'
  if (item.deliveredQty + qty > item.qty) return `Only ${item.qty - item.deliveredQty} pieces remain.`
  const reserved = Math.min(qty, Math.max(0, item.allocatedQty - item.deliveredQty))
  const stock = state.fgStock.filter((f) => f.siteId === order.siteId && f.productId === item.productId)
  const demand = state.demands.find((d) => d.orderItemId === item.id)
  const ownReservations = (state.fgReservations ?? []).filter((r) => r.demandId === demand?.id)
  const ownReserved = ownReservations.reduce((sum, r) => sum + r.qty, 0)
  if (
    ownReserved < reserved ||
    stock.reduce((sum, f) => sum + f.qty, 0) < qty ||
    ownReservations.some((r) => {
      const row = stock.find((f) => f.id === r.stockId)
      return !row || row.allocatedQty < r.qty || row.qty < r.qty
    }) ||
    stock.reduce((sum, f) => sum + f.qty - f.allocatedQty, 0) < qty - reserved
  )
    return 'Finished goods at this site are insufficient for this delivery.'
  return null
}

/** Pre-release validation against the current engineering data and floor stock. */
export function validateMo(state: AppState, mo: ManufacturingOrder): Validation[] {
  const revision = currentRevision(state, mo.productId)
  const bom = state.boms.find((b) => b.id === revision?.bomId)
  const bor = state.bors.find((b) => b.id === revision?.borId)
  const bop = state.bops.find((b) => b.id === revision?.bopId)
  const specs = state.specifications.filter((s) => revision?.specIds.includes(s.id))
  const instructions = state.workInstructions.filter((w) => revision?.workInstructionIds.includes(w.id))
  const machines = state.machines.filter(
    (m) => m.active && bor?.items.some((i) => i.machineIds.includes(m.id)),
  )
  const eligible = machines.filter(
    (m) => m.maintenanceState !== 'in_maintenance' && m.maintenanceState !== 'unavailable',
  )
  const workCenters = new Set(bop?.operations.map((o) => o.workCenterId))
  const skills = new Set(bor?.items.flatMap((i) => i.skillIds))
  const qualified = state.people.filter((p) => p.role === 'operator' && p.siteIds.includes(mo.siteId))
  const uncovered = [...skills].filter((s) => !qualified.some((p) => (p.skills[s] ?? 0) >= 2))
  const short =
    bom?.items.filter((item) => {
      const need = item.qtyPerUnit * mo.qty * (1 + item.scrapFactor)
      const onHand = state.floorStock
        .filter((f) => f.materialId === item.materialId && f.siteId === mo.siteId)
        .reduce((s, f) => s + f.qty - f.reservedQty, 0)
      const lots = state.materialLots
        .filter((l) => l.materialId === item.materialId && l.siteId === mo.siteId && l.status === 'available')
        .reduce((s, l) => s + l.qty, 0)
      return onHand + lots < need
    }) ?? []
  const results: Record<Validation['check'], Validation> = {
    product_release: {
      check: 'product_release',
      ok: revision?.state === 'released',
      note: revision ? `Revision ${revision.rev} ${revision.state}` : 'No revision',
    },
    bom: { check: 'bom', ok: bom?.state === 'released', note: bom ? `${bom.code} ${bom.state}` : 'No BOM' },
    bor: { check: 'bor', ok: bor?.state === 'released', note: bor ? `${bor.code} ${bor.state}` : 'No BOR' },
    bop: {
      check: 'bop',
      ok: bop?.state === 'released',
      note: bop ? `${bop.code} · ${bop.operations.length} operations` : 'No BOP',
    },
    material: {
      check: 'material',
      ok: short.length === 0,
      note: short.length
        ? `${short.length} material${short.length > 1 ? 's' : ''} short`
        : 'All materials covered',
    },
    machine: {
      check: 'machine',
      ok: eligible.length > 0 && eligible.length === machines.length,
      note: `${eligible.length} of ${machines.length} machines available`,
    },
    work_center: {
      check: 'work_center',
      ok: [...workCenters].every((id) => state.orgNodes.some((n) => n.id === id)),
      note: `${workCenters.size} work centers`,
    },
    skills: {
      check: 'skills',
      ok: uncovered.length === 0,
      note: uncovered.length
        ? `${uncovered.length} skill${uncovered.length > 1 ? 's' : ''} uncovered`
        : `${skills.size} skills covered`,
    },
    quality: {
      check: 'quality',
      ok: specs.length > 0,
      note: `${specs.length} specification${specs.length === 1 ? '' : 's'}`,
    },
    work_instruction: {
      check: 'work_instruction',
      ok: instructions.length > 0,
      note: `${instructions.length} instruction${instructions.length === 1 ? '' : 's'}`,
    },
    schedule: {
      check: 'schedule',
      ok: toMs(mo.plannedEnd) > toMs(mo.plannedStart),
      note: 'Planned window valid',
    },
  }
  return VALIDATION_CHECKS.map((c) => results[c])
}

// ─── reducer ────────────────────────────────────────────────────

export function reduce(state: AppState, { action, meta }: Envelope): AppState {
  if (action.type.endsWith('/upsert') && 'item' in action) {
    if (action.type === 'inspections/upsert') {
      const previous = state.inspections.find((i) => i.id === action.item.id)
      if (previous && (previous.status === 'passed' || previous.status === 'failed')) return state
    }
    const key = stripUpsert(action.type)
    return { ...state, [key]: upsert(state[key] as { id: string }[], action.item) }
  }
  if (action.type.endsWith('/remove') && 'id' in action) {
    if (action.type === 'inspections/remove') {
      const inspection = state.inspections.find((i) => i.id === action.id)
      if (
        inspection &&
        (inspection.status === 'passed' ||
          inspection.status === 'failed' ||
          state.defectRecords.some((d) => d.inspectionId === action.id))
      )
        return state
    }
    if (action.type === 'demands/remove') {
      const demand = state.demands.find((d) => d.id === action.id)
      if (demand && (demand.orderItemId || demand.moIds.length || demand.allocatedQty)) return state
    }
    const key = stripUpsert(action.type)
    return { ...state, [key]: remove(state[key] as { id: string }[], action.id) }
  }

  switch (action.type) {
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    // ─── marketing and demand ───────────────────────────────────

    case 'marketingOrders/confirm': {
      const order = state.marketingOrders.find((o) => o.id === action.id)
      if (!order || order.status !== 'draft') return state
      const items = state.marketingOrderItems.filter((i) => i.orderId === order.id)
      let demands = state.demands
      let numbering = state.numbering
      let events = state.productionEvents
      for (const item of items) {
        if (state.demands.some((d) => d.orderItemId === item.id)) continue
        const code = codeOf({ ...state, numbering }, 'demand', 'DMD-')
        numbering = bumpNumbering({ ...state, numbering }, 'demand')
        const demand: Demand = {
          id: newId('dmd'),
          code,
          siteId: order.siteId,
          source: 'customer',
          productId: item.productId,
          qty: item.qty,
          requiredDate: item.requiredDate,
          status: 'open',
          orderItemId: item.id,
          allocatedQty: 0,
          requirementQty: 0,
          moIds: [],
          explanation:
            item.strategy === 'mts'
              ? 'Make-to-stock item: check available inventory first.'
              : 'Make-to-order item: the full quantity goes to production.',
          createdAt: meta.at,
        }
        demands = [...demands, demand]
        events = [
          ...events,
          {
            id: newId('evt'),
            siteId: order.siteId,
            type: 'demand.created',
            at: meta.at,
            by: meta.by,
            moId: null,
            woId: null,
            wipId: null,
            lotId: null,
            machineId: null,
            text: `${code} raised from ${order.code} line ${item.line}`,
          },
        ]
      }
      events = [
        ...events,
        {
          id: newId('evt'),
          siteId: order.siteId,
          type: 'marketing_order.confirmed',
          at: meta.at,
          by: meta.by,
          moId: null,
          woId: null,
          wipId: null,
          lotId: null,
          machineId: null,
          text: `${order.code} confirmed with ${items.length} lines`,
        },
      ]
      return {
        ...state,
        marketingOrders: patchItem(state.marketingOrders, order.id, (o) => ({ ...o, status: 'confirmed' })),
        demands,
        numbering,
        productionEvents: events,
      }
    }

    case 'marketingOrders/setStatus': {
      const order = state.marketingOrders.find((o) => o.id === action.id)
      if (!order || order.status === 'cancelled' || order.status === 'closed') return state
      if (action.status === 'cancelled') {
        if (orderCancellationBlocker(state, order)) return state
        const items = state.marketingOrderItems.filter((i) => i.orderId === order.id)
        const itemIds = new Set(items.map((i) => i.id))
        const demands = state.demands.filter((d) => d.orderItemId && itemIds.has(d.orderItemId))
        const demandIds = new Set(demands.map((d) => d.id))
        const linkedMos = state.manufacturingOrders.filter((m) => m.demandIds.some((id) => demandIds.has(id)))
        const { stock, reservations } = releaseFgReservations(state, demandIds)
        return {
          ...state,
          marketingOrders: patchItem(state.marketingOrders, order.id, (o) => ({ ...o, status: 'cancelled' })),
          marketingOrderItems: state.marketingOrderItems.map((i) =>
            itemIds.has(i.id) ? { ...i, status: 'cancelled', allocatedQty: 0 } : i,
          ),
          demands: state.demands.map((d) =>
            demandIds.has(d.id) ? { ...d, status: 'cancelled', allocatedQty: 0 } : d,
          ),
          manufacturingOrders: state.manufacturingOrders.map((m) =>
            linkedMos.some((own) => own.id === m.id) ? { ...m, status: 'cancelled' } : m,
          ),
          fgStock: stock,
          fgReservations: reservations,
          productionEvents: event(state, meta, 'marketing_order.confirmed', `${order.code} cancelled`, {
            siteId: order.siteId,
          }),
        }
      }
      const allowed: Record<string, MarketingOrderStatus[]> = {
        confirmed: ['on_hold', 'fulfilling', 'ready'],
        fulfilling: ['on_hold', 'ready'],
        ready: ['on_hold'],
        partially_delivered: ['on_hold', 'closed'],
        delivered: ['closed'],
        on_hold: ['confirmed', 'fulfilling', 'ready', 'partially_delivered'],
      }
      if (!allowed[order.status]?.includes(action.status)) return state
      return {
        ...state,
        marketingOrders: patchItem(state.marketingOrders, order.id, (o) => ({ ...o, status: action.status })),
      }
    }

    case 'marketingOrderItems/deliver': {
      const item = state.marketingOrderItems.find((i) => i.id === action.id)
      if (!item) return state
      const order = state.marketingOrders.find((o) => o.id === item.orderId)
      if (!order || deliveryBlocker(state, item, action.qty)) return state
      const demand = state.demands.find((d) => d.orderItemId === item.id)
      const reserved = Math.min(action.qty, Math.max(0, item.allocatedQty - item.deliveredQty))
      let reservedLeft = reserved
      let freeLeft = action.qty - reserved
      const reservedByStock = new Map<string, number>()
      const reservations = (state.fgReservations ?? [])
        .map((r) => {
          if (r.demandId !== demand?.id || reservedLeft <= 0) return r
          const take = Math.min(reservedLeft, r.qty)
          reservedLeft -= take
          reservedByStock.set(r.stockId, (reservedByStock.get(r.stockId) ?? 0) + take)
          return { ...r, qty: r.qty - take }
        })
        .filter((r) => r.qty > 0)
      const sources: string[] = []
      const stock = state.fgStock.map((f) => {
        if (f.siteId !== order.siteId || f.productId !== item.productId) return f
        const takeReserved = reservedByStock.get(f.id) ?? 0
        const takeFree = Math.min(freeLeft, f.qty - f.allocatedQty)
        freeLeft -= takeFree
        if (takeReserved + takeFree > 0)
          sources.push(
            `${state.inventoryLocations.find((l) => l.id === f.locationId)?.code ?? f.locationId}: ${takeReserved + takeFree}`,
          )
        return { ...f, qty: f.qty - takeReserved - takeFree, allocatedQty: f.allocatedQty - takeReserved }
      })
      const delivered = item.deliveredQty + action.qty
      const items = patchItem(state.marketingOrderItems, item.id, (i) => ({
        ...i,
        deliveredQty: delivered,
        status: delivered >= i.qty ? 'delivered' : i.status,
      }))
      const siblings = items.filter((i) => i.orderId === item.orderId)
      const all = siblings.every((i) => i.status === 'delivered')
      const some = siblings.some((i) => i.deliveredQty > 0)
      return {
        ...state,
        marketingOrderItems: items,
        fgStock: stock,
        fgReservations: reservations,
        marketingOrders: patchItem(state.marketingOrders, item.orderId, (o) => ({
          ...o,
          status: all ? 'delivered' : some ? 'partially_delivered' : o.status,
        })),
        demands: state.demands.map((d) =>
          d.orderItemId === item.id && delivered >= item.qty ? { ...d, status: 'fulfilled' } : d,
        ),
        productionEvents: event(
          state,
          meta,
          'marketing_order.delivered',
          `${order.code} line ${item.line}: ${action.qty} delivered from ${sources.join(', ')}`,
          { siteId: order.siteId },
        ),
      }
    }

    case 'demands/allocate': {
      const demand = state.demands.find((d) => d.id === action.id)
      if (
        !demand ||
        !['open', 'resolved'].includes(demand.status) ||
        !Number.isSafeInteger(action.qty) ||
        action.qty <= 0 ||
        action.qty > demand.qty - demand.allocatedQty - demand.requirementQty
      )
        return state
      if (
        state.fgStock
          .filter((f) => f.siteId === demand.siteId && f.productId === demand.productId)
          .reduce((sum, f) => sum + f.qty - f.allocatedQty, 0) < action.qty
      )
        return state
      let left = action.qty
      const reservations = [...(state.fgReservations ?? [])]
      const stock = state.fgStock.map((f) => {
        if (left <= 0 || f.productId !== demand.productId || f.siteId !== demand.siteId) return f
        const free = f.qty - f.allocatedQty
        const take = Math.min(free, left)
        left -= take
        if (take > 0) reservations.push({ demandId: demand.id, stockId: f.id, qty: take })
        return { ...f, allocatedQty: f.allocatedQty + take }
      })
      const allocated = demand.allocatedQty + (action.qty - left)
      const covered = allocated + demand.requirementQty >= demand.qty
      return {
        ...state,
        fgStock: stock,
        fgReservations: reservations,
        demands: patchItem(state.demands, demand.id, (d) => ({
          ...d,
          allocatedQty: allocated,
          status: covered ? 'resolved' : d.status,
          explanation:
            covered && d.requirementQty === 0 ? 'Fully allocated from finished goods stock.' : d.explanation,
        })),
        marketingOrderItems: demand.orderItemId
          ? patchItem(state.marketingOrderItems, demand.orderItemId, (i) => ({
              ...i,
              allocatedQty: allocated,
              status: allocated >= i.qty ? 'ready' : 'allocated',
            }))
          : state.marketingOrderItems,
        productionEvents: event(
          state,
          meta,
          'demand.allocated',
          `${demand.code}: ${action.qty - left} allocated from stock`,
          { siteId: demand.siteId },
        ),
      }
    }

    case 'demands/resolveWithMo': {
      const demand = state.demands.find((d) => d.id === action.id)
      if (
        !demand ||
        (demand.status !== 'open' && demand.status !== 'resolved') ||
        !action.draft.demandIds.includes(action.id) ||
        action.draft.siteId !== demand.siteId ||
        action.draft.productId !== demand.productId ||
        action.allocateQty < 0 ||
        action.draft.qty <= 0
      )
        return state
      const free = state.fgStock
        .filter((item) => item.siteId === demand.siteId && item.productId === demand.productId)
        .reduce((total, item) => total + Math.max(0, item.qty - item.allocatedQty), 0)
      if (
        action.allocateQty > free ||
        action.allocateQty + action.draft.qty > demand.qty - demand.allocatedQty - demand.requirementQty
      )
        return state
      const allocated =
        action.allocateQty > 0
          ? reduce(state, {
              action: { type: 'demands/allocate', id: action.id, qty: action.allocateQty },
              meta,
            })
          : state
      return createMo(allocated, meta, action.draft)
    }

    case 'demands/cancel': {
      const demand = state.demands.find((d) => d.id === action.id)
      if (!demand || demandCancellationBlocker(state, demand)) return state
      const { stock, reservations } = releaseFgReservations(state, new Set([demand.id]))
      return {
        ...state,
        fgStock: stock,
        fgReservations: reservations,
        demands: patchItem(state.demands, action.id, (d) => ({ ...d, status: 'cancelled', allocatedQty: 0 })),
        marketingOrderItems: demand.orderItemId
          ? patchItem(state.marketingOrderItems, demand.orderItemId, (i) => ({
              ...i,
              allocatedQty: 0,
              status: 'cancelled',
            }))
          : state.marketingOrderItems,
        manufacturingOrders: state.manufacturingOrders.map((m) =>
          m.demandIds.includes(demand.id) && ['draft', 'planned'].includes(m.status)
            ? { ...m, status: 'cancelled' }
            : m,
        ),
      }
    }

    case 'replenishments/run': {
      let numbering = state.numbering
      const created: Replenishment[] = []
      for (const policy of state.inventoryPolicies.filter((p) => p.siteId === action.siteId)) {
        if (
          state.replenishments.some(
            (r) =>
              r.productId === policy.productId &&
              (r.status === 'proposed' || r.status === 'approved' || r.status === 'in_production'),
          )
        )
          continue
        const onHand = state.fgStock
          .filter((f) => f.productId === policy.productId && f.siteId === action.siteId)
          .reduce((s, f) => s + f.qty - f.allocatedQty, 0)
        const openDemand = state.demands
          .filter((d) => d.productId === policy.productId && d.status === 'open')
          .reduce((s, d) => s + d.qty - d.allocatedQty - d.requirementQty, 0)
        const inbound = state.manufacturingOrders
          .filter(
            (m) =>
              m.productId === policy.productId && ['planned', 'released', 'in_progress'].includes(m.status),
          )
          .reduce((s, m) => s + m.qty - m.goodQty, 0)
        const projected = onHand - openDemand + inbound
        if (projected >= policy.reorderPoint) continue
        const raw = Math.max(policy.replenishQty, policy.maxStock - projected)
        const required = Math.ceil(raw / policy.productionMultiple) * policy.productionMultiple
        const code = codeOf({ ...state, numbering }, 'replenishment', 'RPL-')
        numbering = bumpNumbering({ ...state, numbering }, 'replenishment')
        created.push({
          id: newId('rpl'),
          code,
          siteId: action.siteId,
          productId: policy.productId,
          onHand,
          projected,
          reorderPoint: policy.reorderPoint,
          requiredQty: required,
          status: 'proposed',
          demandId: null,
          moId: null,
          createdAt: meta.at,
        })
      }
      if (!created.length) return state
      let events = state.productionEvents
      for (const r of created)
        events = [
          ...events,
          {
            id: newId('evt'),
            siteId: r.siteId,
            type: 'replenishment.created',
            at: meta.at,
            by: meta.by,
            moId: null,
            woId: null,
            wipId: null,
            lotId: null,
            machineId: null,
            text: `${r.code}: projected ${r.projected} below reorder point ${r.reorderPoint}`,
          },
        ]
      return {
        ...state,
        replenishments: [...state.replenishments, ...created],
        numbering,
        productionEvents: events,
      }
    }

    case 'replenishments/approve': {
      const r = state.replenishments.find((x) => x.id === action.id)
      if (!r) return state
      const next = createMo(state, meta, {
        siteId: r.siteId,
        productId: r.productId,
        qty: r.requiredQty,
        source: 'mts',
        demandIds: [],
        replenishmentId: r.id,
        priority: 'normal',
        lineId: action.lineId,
        plannedStart: action.plannedStart,
        plannedEnd: action.plannedEnd,
      })
      const mo = next.manufacturingOrders.at(-1)!
      return {
        ...next,
        replenishments: patchItem(next.replenishments, r.id, (x) => ({
          ...x,
          status: 'approved',
          moId: mo.id,
        })),
      }
    }

    case 'replenishments/dismiss':
      return {
        ...state,
        replenishments: patchItem(state.replenishments, action.id, (r) => ({ ...r, status: 'dismissed' })),
      }

    // ─── manufacturing orders ───────────────────────────────────

    case 'manufacturingOrders/create':
      return createMo(state, meta, action.draft)

    case 'manufacturingOrders/update':
      return {
        ...state,
        manufacturingOrders: patchItem(state.manufacturingOrders, action.id, (m) => ({
          ...m,
          ...action.patch,
        })),
      }

    case 'manufacturingOrders/plan': {
      const mo = state.manufacturingOrders.find((m) => m.id === action.id)
      if (!mo) return state
      return withMoEvent(
        state,
        action.id,
        { status: 'planned', validations: validateMo(state, mo) },
        meta,
        'manufacturing_order.planned',
        'Planned and validated',
      )
    }

    case 'manufacturingOrders/release':
      return releaseMo(state, meta, action.id)

    case 'manufacturingOrders/hold': {
      const reason = state.reasonCodes.find((r) => r.id === action.reasonCodeId)
      const held = withMoEvent(
        state,
        action.id,
        { status: 'on_hold', holdReasonId: action.reasonCodeId },
        meta,
        'manufacturing_order.held',
        `On hold: ${reason?.label ?? 'no reason'}${action.note ? ` · ${action.note}` : ''}`,
      )
      return {
        ...held,
        workOrders: held.workOrders.map((w) =>
          w.moId === action.id &&
          (w.status === 'in_progress' || w.status === 'ready' || w.status === 'assigned')
            ? {
                ...w,
                status: 'hold',
                holdReasonId: action.reasonCodeId,
                events: [...w.events, woEvent(meta, 'held', 'Held with the manufacturing order')],
              }
            : w,
        ),
      }
    }

    case 'manufacturingOrders/resume': {
      const mo = state.manufacturingOrders.find((m) => m.id === action.id)
      if (!mo) return state
      const wos = state.workOrders.map((w) =>
        w.moId === action.id && w.status === 'hold'
          ? {
              ...w,
              status: w.actualStart ? 'in_progress' : w.machineId ? 'assigned' : 'ready',
              holdReasonId: null,
              events: [...w.events, woEvent(meta, 'released', 'Hold released')],
            }
          : w,
      ) as WorkOrder[]
      const status = moProgressStatus({ ...mo, status: 'released' }, wos)
      return {
        ...withMoEvent(
          state,
          action.id,
          { status, holdReasonId: null },
          meta,
          'manufacturing_order.started',
          'Hold released',
        ),
        workOrders: wos,
      }
    }

    case 'manufacturingOrders/complete': {
      const mo = state.manufacturingOrders.find((m) => m.id === action.id)
      if (!mo || moCompletionBlocker(state, mo)) return state
      return withMoEvent(
        state,
        action.id,
        { status: 'completed', actualEnd: meta.at },
        meta,
        'manufacturing_order.completed',
        'Completed',
      )
    }

    case 'manufacturingOrders/close': {
      const mo = state.manufacturingOrders.find((m) => m.id === action.id)
      if (!mo || moCloseBlocker(state, mo)) return state
      const closed = withMoEvent(
        state,
        action.id,
        { status: 'closed' },
        meta,
        'manufacturing_order.completed',
        'Closed',
      )
      return {
        ...closed,
        replenishments: mo.replenishmentId
          ? patchItem(closed.replenishments, mo.replenishmentId, (r) => ({ ...r, status: 'received' }))
          : closed.replenishments,
      }
    }

    case 'manufacturingOrders/cancel': {
      const cancelled = withMoEvent(
        state,
        action.id,
        { status: 'cancelled' },
        meta,
        'manufacturing_order.held',
        'Cancelled',
      )
      return {
        ...cancelled,
        workOrders: cancelled.workOrders.map((w) =>
          w.moId === action.id && w.status !== 'completed'
            ? {
                ...w,
                status: 'cancelled',
                events: [...w.events, woEvent(meta, 'cancelled', 'Cancelled with the manufacturing order')],
              }
            : w,
        ),
      }
    }

    case 'manufacturingOrders/setPriority':
      return {
        ...withMoEvent(
          state,
          action.id,
          { priority: action.priority },
          meta,
          'manufacturing_order.planned',
          `Priority set to ${action.priority}`,
        ),
        workOrders: state.workOrders.map((w) =>
          w.moId === action.id && w.status !== 'completed' ? { ...w, priority: action.priority } : w,
        ),
      }

    case 'manufacturingOrders/setAtRisk':
      return withMoEvent(
        state,
        action.id,
        { atRisk: action.atRisk, atRiskReason: action.reason },
        meta,
        'manufacturing_order.held',
        action.atRisk ? `At risk: ${action.reason}` : 'Risk cleared',
      )

    // ─── work orders ────────────────────────────────────────────

    case 'workOrders/assign': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo) return state
      const a = action.assignment
      const machine = a.machineId ? state.machines.find((m) => m.id === a.machineId) : undefined
      const text = [
        machine ? `machine ${machine.code}` : null,
        a.operatorIds?.length
          ? `${a.operatorIds.length} operator${a.operatorIds.length > 1 ? 's' : ''}`
          : null,
        a.shiftId ? `shift ${state.shifts.find((s) => s.id === a.shiftId)?.code ?? ''}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      const status = wo.status === 'waiting' || wo.status === 'ready' ? 'assigned' : wo.status
      return withWoEvent(
        state,
        action.id,
        {
          machineId: a.machineId ?? wo.machineId,
          operatorIds: a.operatorIds ?? wo.operatorIds,
          shiftId: a.shiftId ?? wo.shiftId,
          toolIds: a.toolIds ?? wo.toolIds,
          moldIds: a.moldIds ?? wo.moldIds,
          status,
        },
        meta,
        wo.machineId ? 'reassigned' : 'assigned',
        `Assigned to ${text || 'resources'}`,
        null,
        'workorder.assigned',
      )
    }

    case 'workOrders/reschedule':
      return withWoEvent(
        state,
        action.id,
        { plannedStart: action.plannedStart, plannedEnd: action.plannedEnd },
        meta,
        'rescheduled',
        'Rescheduled',
      )

    case 'workOrders/hold': {
      const reason = state.reasonCodes.find((r) => r.id === action.reasonCodeId)
      return withWoEvent(
        state,
        action.id,
        { status: 'hold', holdReasonId: action.reasonCodeId },
        meta,
        'held',
        `On hold: ${reason?.label ?? ''}${action.note ? ` · ${action.note}` : ''}`,
        null,
        'workorder.paused',
      )
    }

    case 'workOrders/releaseHold': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo) return state
      return withWoEvent(
        state,
        action.id,
        { status: wo.actualStart ? 'in_progress' : wo.machineId ? 'assigned' : 'ready', holdReasonId: null },
        meta,
        'released',
        'Hold released',
        null,
        'workorder.resumed',
      )
    }

    case 'workOrders/setPriority':
      return withWoEvent(
        state,
        action.id,
        { priority: action.priority },
        meta,
        'priority',
        `Priority set to ${action.priority}`,
      )

    case 'workOrders/start': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo || (wo.status !== 'ready' && wo.status !== 'assigned')) return state
      const order = state.manufacturingOrders.find((m) => m.id === wo.moId)
      const bor = state.bors.find((b) => b.id === order?.snapshot?.borId)
      const borItem = bor?.items.find((item) => item.operationSeq === wo.operationSeq)
      const machine = state.machines.find((m) => m.id === wo.machineId)
      if ((borItem?.machineIds.length ?? 0) > 0 && !machine) return state
      if (
        machine &&
        (machine.workCenterId !== wo.workCenterId ||
          (borItem?.machineIds.length && !borItem.machineIds.includes(machine.id)) ||
          (machine.eligibleProductIds.length &&
            order &&
            !machine.eligibleProductIds.includes(order.productId)) ||
          machine.state === 'down' ||
          machine.maintenanceState === 'in_maintenance' ||
          machine.maintenanceState === 'unavailable')
      )
        return state
      const bop = state.bops.find((b) => b.id === order?.snapshot?.bopId)
      const predecessors = bop?.operations.find((op) => op.seq === wo.operationSeq)?.predecessorSeqs ?? []
      if (
        predecessors.some((seq) =>
          state.workOrders.some(
            (prior) => prior.moId === wo.moId && prior.operationSeq === seq && prior.status !== 'completed',
          ),
        )
      )
        return state
      if (
        state.materialRequirements.some(
          (r) =>
            r.moId === wo.moId &&
            r.operationSeq === wo.operationSeq &&
            (r.status === 'shortage' || r.status === 'partial'),
        )
      )
        return state
      const started = withWoEvent(
        state,
        action.id,
        { status: 'in_progress', actualStart: wo.actualStart ?? meta.at, pauseReason: null },
        meta,
        'started',
        'Started',
        null,
        'workorder.started',
      )
      const mo = started.manufacturingOrders.find((m) => m.id === wo.moId)
      const next =
        mo && mo.status === 'released'
          ? withMoEvent(
              started,
              mo.id,
              { status: 'in_progress', actualStart: mo.actualStart ?? meta.at },
              meta,
              'manufacturing_order.started',
              `Started at ${wo.operationName}`,
            )
          : started
      const machines = wo.machineId
        ? patchItem(next.machines, wo.machineId, (m) => ({ ...m, state: 'running' as const }))
        : next.machines
      // The input WIP for this operation moves to processing.
      const wips = next.wips.map((w) =>
        w.moId === wo.moId &&
        w.operationSeq === wo.operationSeq &&
        (w.state === 'queued' || w.state === 'waiting')
          ? { ...w, state: 'processing' as const, woId: wo.id, machineId: wo.machineId, updatedAt: meta.at }
          : w,
      )
      return { ...next, machines, wips }
    }

    case 'workOrders/pause':
      return withWoEvent(
        state,
        action.id,
        { status: 'paused', pauseReason: action.reason },
        meta,
        'paused',
        `Paused: ${action.reason}${action.note ? ` · ${action.note}` : ''}`,
        null,
        'workorder.paused',
      )

    case 'workOrders/resume':
      return withWoEvent(
        state,
        action.id,
        { status: 'in_progress', pauseReason: null },
        meta,
        'resumed',
        'Resumed',
        null,
        'workorder.resumed',
      )

    case 'workOrders/reportIssue':
      return withWoEvent(state, action.id, {}, meta, 'issue', action.text, null, 'machine.alarm.triggered')

    case 'workOrders/recordOutput':
      return recordOutput(state, meta, action.record)

    case 'workOrders/complete': {
      const wo = state.workOrders.find((w) => w.id === action.id)
      if (!wo || woCompletionBlocker(state, wo)) return state
      let next = withWoEvent(
        state,
        action.id,
        { status: 'completed', actualEnd: meta.at, pauseReason: null },
        meta,
        'completed',
        `Completed with ${wo.goodQty} good`,
        wo.goodQty,
        'workorder.completed',
      )
      // Successor operations become ready; the current input WIP is done.
      const successors = next.workOrders.filter(
        (w) => w.moId === wo.moId && w.operationSeq > wo.operationSeq && w.status === 'waiting',
      )
      const nextSeq = successors.length ? Math.min(...successors.map((w) => w.operationSeq)) : null
      next = {
        ...next,
        workOrders: next.workOrders.map((w) =>
          w.moId === wo.moId && w.operationSeq === nextSeq
            ? {
                ...w,
                status: w.machineId ? 'assigned' : 'ready',
                events: [...w.events, woEvent(meta, 'created', 'Ready: predecessor completed')],
              }
            : w,
        ),
        wips: next.wips.map((w) =>
          w.moId === wo.moId && w.operationSeq === wo.operationSeq && w.state === 'processing'
            ? { ...w, state: 'completed' as const, updatedAt: meta.at }
            : w,
        ),
        machines: wo.machineId
          ? patchItem(next.machines, wo.machineId, (m) =>
              m.state === 'running' ? { ...m, state: 'idle' } : m,
            )
          : next.machines,
      }
      const mo = next.manufacturingOrders.find((m) => m.id === wo.moId)
      if (mo && moProgressStatus(mo, next.workOrders) === 'completed' && !moCompletionBlocker(next, mo)) {
        next = withMoEvent(
          next,
          mo.id,
          { status: 'completed', actualEnd: meta.at },
          meta,
          'manufacturing_order.completed',
          'All operations completed',
        )
      }
      return next
    }

    case 'workOrders/cancel':
      return withWoEvent(state, action.id, { status: 'cancelled' }, meta, 'cancelled', 'Cancelled')

    // ─── manufacturing inventory ────────────────────────────────

    case 'materials/reserve':
      return materialMove(state, meta, {
        kind: 'reserve',
        moId: action.moId,
        woId: null,
        materialId: action.materialId,
        lotId: action.lotId,
        qty: action.qty,
        to: null,
        mode: 'manual',
        field: 'reservedQty',
        lotStatus: 'reserved',
        eventType: 'material.reserved',
        note: '',
      })

    case 'materials/stage':
      return materialMove(state, meta, {
        kind: 'stage',
        moId: action.moId,
        woId: null,
        materialId: action.materialId,
        lotId: action.lotId,
        qty: action.qty,
        to: action.toLocationId,
        mode: 'manual',
        field: 'stagedQty',
        lotStatus: 'staged',
        eventType: 'material.staged',
        note: '',
      })

    case 'materials/issue':
      return materialMove(state, meta, {
        kind: 'issue',
        moId: action.moId,
        woId: action.woId,
        materialId: action.materialId,
        lotId: action.lotId,
        qty: action.qty,
        to: null,
        mode: 'manual',
        field: 'issuedQty',
        lotStatus: 'staged',
        eventType: 'material.issued',
        note: '',
      })

    case 'materials/consume': {
      const next = materialMove(state, meta, {
        kind: 'consume',
        moId: action.moId,
        woId: action.woId,
        materialId: action.materialId,
        lotId: action.lotId,
        qty: action.qty,
        to: null,
        mode: action.mode,
        field: 'consumedQty',
        lotStatus: 'consumed',
        eventType: 'material.consumed',
        note: '',
      })
      const wo = state.workOrders.find((w) => w.id === action.woId)
      return {
        ...next,
        wips: next.wips.map((w) =>
          wo && w.moId === wo.moId && w.operationSeq === wo.operationSeq && !w.lotIds.includes(action.lotId)
            ? { ...w, lotIds: [...w.lotIds, action.lotId] }
            : w,
        ),
      }
    }

    case 'materials/return': {
      const reason = state.reasonCodes.find((r) => r.id === action.reasonCodeId)
      return materialMove(state, meta, {
        kind: 'return',
        moId: action.moId,
        woId: null,
        materialId: action.materialId,
        lotId: action.lotId,
        qty: action.qty,
        to: action.toLocationId,
        mode: 'manual',
        field: 'returnedQty',
        lotStatus: 'returned',
        eventType: 'material.returned',
        note: reason?.label ?? '',
      })
    }

    case 'materialLots/receive': {
      const code = codeOf(state, 'lot', 'LOT-')
      const lot: MaterialLot = { ...action.lot, id: newId('lot'), code, status: 'available' }
      return {
        ...state,
        materialLots: [...state.materialLots, lot],
        numbering: bumpNumbering(state, 'lot'),
        materialTxns: [
          ...state.materialTxns,
          {
            id: newId('mtx'),
            siteId: lot.siteId,
            kind: 'receipt',
            materialId: lot.materialId,
            lotId: lot.id,
            qty: lot.qty,
            uomId: lot.uomId,
            fromLocationId: null,
            toLocationId: lot.locationId,
            moId: null,
            woId: null,
            operationSeq: null,
            mode: 'manual',
            at: meta.at,
            by: meta.by,
            note: 'Received',
          },
        ],
        productionEvents: event(state, meta, 'material.required', `Lot ${code} received`, {
          siteId: lot.siteId,
          lotId: lot.id,
        }),
      }
    }

    case 'finishedGoods/receive': {
      const mo = state.manufacturingOrders.find((m) => m.id === action.moId)
      const location = state.inventoryLocations.find((l) => l.id === action.locationId)
      const received = state.finishedGoodsReceipts
        .filter((r) => r.moId === action.moId)
        .reduce((sum, r) => sum + r.qty, 0)
      if (
        !mo ||
        !['completed', 'closed'].includes(mo.status) ||
        !location ||
        location.siteId !== mo.siteId ||
        location.kind !== 'finished_goods' ||
        !Number.isSafeInteger(action.qty) ||
        action.qty <= 0 ||
        received + action.qty > mo.goodQty
      )
        return state
      const code = codeOf(state, 'fgReceipt', 'FGR-')
      const product = state.products.find((p) => p.id === mo.productId)
      const serialRule = state.serialRules.find((s) => s.productId === mo.productId)
      const serialIds: string[] = []
      let serials = state.serials
      let serialRules = state.serialRules
      if (product?.serialControlled && serialRule) {
        let seq = serialRule.nextSeq
        for (let i = 0; i < action.qty; i++) {
          const id = newId('ser')
          serialIds.push(id)
          serials = [
            ...serials,
            {
              id,
              serialNo: serialRule.pattern.replace('{seq}', String(seq++).padStart(6, '0')),
              productId: mo.productId,
              moId: mo.id,
              wipId: null,
              receiptId: null,
              customerId: null,
              status: 'finished',
            },
          ]
        }
        serialRules = patchItem(serialRules, serialRule.id, (s) => ({ ...s, nextSeq: seq }))
      }
      const receipt: FinishedGoodsReceipt = {
        id: newId('fgr'),
        code,
        siteId: mo.siteId,
        moId: mo.id,
        productId: mo.productId,
        qty: action.qty,
        uomId: mo.uomId,
        lotCode: `${mo.code}-FG`,
        locationId: action.locationId,
        serialIds,
        at: meta.at,
        by: meta.by,
      }
      const existing = state.fgStock.find(
        (f) => f.productId === mo.productId && f.locationId === action.locationId,
      )
      const fgStock = existing
        ? patchItem(state.fgStock, existing.id, (f) => ({ ...f, qty: f.qty + action.qty }))
        : [
            ...state.fgStock,
            {
              id: newId('fgs'),
              siteId: mo.siteId,
              productId: mo.productId,
              locationId: action.locationId,
              qty: action.qty,
              allocatedQty: 0,
            },
          ]
      const next = withMoEvent(
        {
          ...state,
          finishedGoodsReceipts: [...state.finishedGoodsReceipts, receipt],
          fgStock,
          serials: serials.map((s) => (serialIds.includes(s.id) ? { ...s, receiptId: receipt.id } : s)),
          serialRules,
          numbering: bumpNumbering(state, 'fgReceipt'),
        },
        mo.id,
        {},
        meta,
        'finished_goods.received',
        `${action.qty} received as ${code}`,
      )
      // Customer demand behind an MTO order moves to ready.
      return {
        ...next,
        marketingOrderItems: next.marketingOrderItems.map((i) =>
          next.demands.some((d) => mo.demandIds.includes(d.id) && d.orderItemId === i.id)
            ? {
                ...i,
                producedQty: Math.min(i.qty, i.producedQty + action.qty),
                status: i.producedQty + action.qty >= i.qty ? 'ready' : 'in_production',
              }
            : i,
        ),
      }
    }

    // ─── WIP ────────────────────────────────────────────────────

    case 'wips/move': {
      const wip = state.wips.find((w) => w.id === action.id)
      if (!wip) return state
      const location = state.inventoryLocations.find((l) => l.id === action.locationId)
      return {
        ...state,
        wips: patchItem(state.wips, action.id, (w) => ({
          ...w,
          locationId: action.locationId,
          state: action.state,
          updatedAt: meta.at,
        })),
        productionEvents: event(
          state,
          meta,
          'wip.moved',
          `${wip.code} moved to ${location?.name ?? action.locationId}`,
          { moId: wip.moId, wipId: wip.id, siteId: wip.siteId },
        ),
      }
    }

    case 'wips/split': {
      const wip = state.wips.find((w) => w.id === action.id)
      if (!wip) return state
      const total = action.qtys.reduce((s, q) => s + q, 0)
      if (total > wip.qty || action.qtys.some((q) => q <= 0)) return state
      const children: Wip[] = action.qtys.map((qty, i) => ({
        ...wip,
        id: newId('wip'),
        code: `${wip.code}-${String.fromCharCode(65 + i)}`,
        qty,
        parentIds: [wip.id],
        createdAt: meta.at,
        updatedAt: meta.at,
      }))
      const rest = wip.qty - total
      const wips =
        rest > 0
          ? patchItem(state.wips, wip.id, (w) => ({ ...w, qty: rest, updatedAt: meta.at }))
          : patchItem(state.wips, wip.id, (w) => ({
              ...w,
              qty: 0,
              state: 'completed' as const,
              updatedAt: meta.at,
            }))
      return {
        ...state,
        wips: [...wips, ...children],
        productionEvents: event(
          state,
          meta,
          'wip.created',
          `${wip.code} split into ${children.length} batches`,
          { moId: wip.moId, wipId: wip.id, siteId: wip.siteId },
        ),
      }
    }

    case 'wips/merge': {
      const parts = state.wips.filter((w) => action.ids.includes(w.id))
      const first = parts[0]
      if (
        parts.length < 2 ||
        !first ||
        parts.some((p) => p.moId !== first.moId || p.operationSeq !== first.operationSeq)
      )
        return state
      const merged: Wip = {
        ...first,
        id: newId('wip'),
        code: `${first.code.split('-').slice(0, 2).join('-')}-M`,
        qty: parts.reduce((s, p) => s + p.qty, 0),
        parentIds: parts.map((p) => p.id),
        lotIds: [...new Set(parts.flatMap((p) => p.lotIds))],
        createdAt: meta.at,
        updatedAt: meta.at,
      }
      return {
        ...state,
        wips: [
          ...state.wips.map((w) =>
            action.ids.includes(w.id) ? { ...w, qty: 0, state: 'completed' as const, updatedAt: meta.at } : w,
          ),
          merged,
        ],
        productionEvents: event(
          state,
          meta,
          'wip.created',
          `${parts.length} batches merged into ${merged.code}`,
          { moId: merged.moId, wipId: merged.id, siteId: merged.siteId },
        ),
      }
    }

    case 'wips/hold': {
      const wip = state.wips.find((w) => w.id === action.id)
      if (!wip) return state
      const holdLocation = state.inventoryLocations.find(
        (l) => l.siteId === wip.siteId && l.kind === 'qc_hold',
      )
      const code = codeOf(state, 'hold', 'QH-')
      const hold: QualityHold = {
        id: newId('qh'),
        code,
        siteId: wip.siteId,
        target: 'wip',
        targetId: wip.id,
        moId: wip.moId,
        reasonCodeId: action.reasonCodeId,
        note: action.note,
        status: 'active',
        heldBy: meta.by,
        heldAt: meta.at,
        releasedBy: null,
        releasedAt: null,
        disposition: null,
      }
      return {
        ...state,
        numbering: bumpNumbering(state, 'hold'),
        qualityHolds: [...state.qualityHolds, hold],
        wips: patchItem(state.wips, wip.id, (w) => ({
          ...w,
          state: 'quality_hold',
          locationId: holdLocation?.id ?? w.locationId,
          updatedAt: meta.at,
        })),
        productionEvents: event(state, meta, 'wip.held', `${wip.code} on quality hold (${code})`, {
          moId: wip.moId,
          wipId: wip.id,
          siteId: wip.siteId,
        }),
      }
    }

    case 'wips/release': {
      const wip = state.wips.find((w) => w.id === action.id)
      if (!wip) return state
      const hold = state.qualityHolds.find((h) => h.targetId === wip.id && h.status === 'active')
      const next = hold ? releaseHold(state, meta, hold.id, action.disposition) : state
      return {
        ...next,
        wips: patchItem(next.wips, wip.id, (w) => ({
          ...w,
          state: dispositionState(action.disposition),
          updatedAt: meta.at,
        })),
      }
    }

    // ─── quality ────────────────────────────────────────────────

    case 'inspections/request': {
      const code = codeOf(state, 'inspection', 'INS-')
      const inspection: Inspection = {
        ...action.inspection,
        id: newId('ins'),
        code,
        status: 'pending',
        completedAt: null,
        disposition: null,
        defectRecordIds: [],
      }
      return {
        ...state,
        numbering: bumpNumbering(state, 'inspection'),
        inspections: [...state.inspections, inspection],
        productionEvents: event(
          state,
          meta,
          'quality.check.requested',
          `${code} requested at operation ${inspection.operationSeq}`,
          {
            moId: inspection.moId,
            woId: inspection.woId,
            wipId: inspection.wipId,
            siteId: inspection.siteId,
          },
        ),
      }
    }

    case 'inspections/start':
      return {
        ...state,
        inspections: patchItem(state.inspections, action.id, (i) => ({
          ...i,
          status: 'in_progress',
          inspectorId: i.inspectorId ?? meta.by,
        })),
      }

    case 'inspections/record': {
      const inspection = state.inspections.find((i) => i.id === action.id)
      if (!inspection) return state
      const failed = action.measurements.some((m) => m.result === 'fail')
      const records: DefectRecord[] = action.defects
        .filter((d) => d.qty > 0)
        .map((d) => ({
          id: newId('dfr'),
          siteId: inspection.siteId,
          defectCodeId: d.defectCodeId,
          inspectionId: inspection.id,
          moId: inspection.moId,
          woId: inspection.woId,
          wipId: inspection.wipId,
          qty: d.qty,
          note: d.note,
          at: meta.at,
          by: meta.by,
        }))
      let next: AppState = {
        ...state,
        inspections: patchItem(state.inspections, inspection.id, (i) => ({
          ...i,
          status: failed ? 'failed' : 'passed',
          measurements: action.measurements,
          disposition: action.disposition,
          note: action.note,
          completedAt: meta.at,
          inspectorId: i.inspectorId ?? meta.by,
          defectRecordIds: records.map((r) => r.id),
        })),
        defectRecords: [...state.defectRecords, ...records],
        productionEvents: event(
          state,
          meta,
          failed ? 'quality.check.failed' : 'quality.check.passed',
          `${inspection.code} ${failed ? 'failed' : 'passed'} · ${action.disposition}`,
          {
            moId: inspection.moId,
            woId: inspection.woId,
            wipId: inspection.wipId,
            siteId: inspection.siteId,
          },
        ),
      }
      if (
        inspection.wipId &&
        (action.disposition === 'hold' ||
          (failed && action.disposition !== 'accept' && action.disposition !== 'use_as_is'))
      ) {
        const reason = state.reasonCodes.find((r) => r.kind === 'hold')
        next = reduce(next, {
          action: {
            type: 'wips/hold',
            id: inspection.wipId,
            reasonCodeId: reason?.id ?? '',
            note: `${inspection.code} ${action.disposition}`,
          },
          meta,
        })
      }
      return next
    }

    case 'qualityHolds/release':
      return releaseHold(state, meta, action.id, action.disposition)

    case 'scrap/record': {
      const wo = state.workOrders.find((w) => w.id === action.woId)
      if (!wo) return state
      const source = action.wipId ? state.wips.find((w) => w.id === action.wipId) : undefined
      if (
        !Number.isSafeInteger(action.qty) ||
        action.qty <= 0 ||
        (!action.inputAlreadyConsumed && (!source || source.moId !== wo.moId || source.qty < action.qty))
      )
        return state
      const reason = state.reasonCodes.find((r) => r.id === action.reasonCodeId)
      const scrap: ScrapRecord = {
        id: newId('scr'),
        siteId: wo.siteId,
        moId: action.moId,
        woId: action.woId,
        wipId: action.wipId,
        operationSeq: action.operationSeq,
        qty: action.qty,
        reasonCodeId: action.reasonCodeId,
        operatorId: meta.by,
        disposition: action.disposition,
        at: meta.at,
        note: action.note,
      }
      const next = withWoEvent(
        state,
        wo.id,
        { scrapQty: wo.scrapQty + action.qty },
        meta,
        'scrap',
        `${action.qty} scrapped: ${reason?.label ?? ''}`,
        action.qty,
        'product.scrapped',
      )
      return {
        ...next,
        scrapRecords: [...next.scrapRecords, scrap],
        manufacturingOrders: patchItem(next.manufacturingOrders, action.moId, (m) => ({
          ...m,
          scrapQty: m.scrapQty + action.qty,
        })),
        wips:
          action.wipId && !action.inputAlreadyConsumed
            ? patchItem(next.wips, action.wipId, (w) => ({
                ...w,
                qty: Math.max(0, w.qty - action.qty),
                state: w.qty - action.qty <= 0 ? 'scrapped' : w.state,
                updatedAt: meta.at,
              }))
            : next.wips,
      }
    }

    case 'rework/create': {
      const wo = state.workOrders.find((w) => w.id === action.sourceWoId)
      if (!wo) return state
      const source = action.sourceWipId ? state.wips.find((w) => w.id === action.sourceWipId) : undefined
      if (
        !Number.isSafeInteger(action.qty) ||
        action.qty <= 0 ||
        (!action.inputAlreadyConsumed && (!source || source.moId !== wo.moId || source.qty < action.qty))
      )
        return state
      const code = codeOf(state, 'rework', 'RWK-')
      const reworkLocation = state.inventoryLocations.find(
        (l) => l.siteId === wo.siteId && l.kind === 'rework',
      )
      const reworkWip: Wip = {
        id: newId('wip'),
        code: `${code}-W`,
        siteId: wo.siteId,
        moId: action.moId,
        woId: wo.id,
        productId:
          source?.productId ?? state.manufacturingOrders.find((m) => m.id === action.moId)?.productId ?? '',
        operationSeq: action.routeSeqs[0] ?? wo.operationSeq,
        qty: action.qty,
        state: 'rework',
        locationId: reworkLocation?.id ?? wo.workCenterId,
        batch: source?.batch ?? code,
        parentIds: source ? [source.id] : [],
        lotIds: source?.lotIds ?? [],
        machineId: null,
        createdAt: meta.at,
        updatedAt: meta.at,
      }
      const rework: ReworkOrder = {
        id: newId('rwk'),
        code,
        siteId: wo.siteId,
        moId: action.moId,
        sourceWoId: wo.id,
        sourceWipId: action.sourceWipId,
        reworkWipId: reworkWip.id,
        qty: action.qty,
        routeSeqs: action.routeSeqs,
        status: 'open',
        inspectionId: null,
        goodQty: 0,
        scrapQty: 0,
        reasonCodeId: action.reasonCodeId,
        createdAt: meta.at,
        closedAt: null,
      }
      const next = withWoEvent(
        state,
        wo.id,
        { reworkQty: wo.reworkQty + action.qty },
        meta,
        'rework',
        `${action.qty} sent to rework ${code}`,
        action.qty,
        'product.reworked',
      )
      return {
        ...next,
        numbering: bumpNumbering(next, 'rework'),
        reworkOrders: [...next.reworkOrders, rework],
        wips: [
          ...(source && !action.inputAlreadyConsumed
            ? patchItem(next.wips, source.id, (w) => ({
                ...w,
                qty: Math.max(0, w.qty - action.qty),
                updatedAt: meta.at,
              }))
            : next.wips),
          reworkWip,
        ],
        manufacturingOrders: patchItem(next.manufacturingOrders, action.moId, (m) => ({
          ...m,
          reworkQty: m.reworkQty + action.qty,
        })),
      }
    }

    case 'rework/setStatus':
      return {
        ...state,
        reworkOrders: patchItem(state.reworkOrders, action.id, (r) => ({ ...r, status: action.status })),
      }

    case 'rework/close': {
      const rework = state.reworkOrders.find((r) => r.id === action.id)
      if (!rework) return state
      return {
        ...state,
        reworkOrders: patchItem(state.reworkOrders, rework.id, (r) => ({
          ...r,
          status: 'closed',
          goodQty: action.goodQty,
          scrapQty: action.scrapQty,
          closedAt: meta.at,
        })),
        wips: rework.reworkWipId
          ? patchItem(state.wips, rework.reworkWipId, (w) => ({
              ...w,
              qty: action.goodQty,
              state: action.goodQty > 0 ? 'completed' : 'scrapped',
              updatedAt: meta.at,
            }))
          : state.wips,
        manufacturingOrders: patchItem(state.manufacturingOrders, rework.moId, (m) => ({
          ...m,
          goodQty: m.goodQty + action.goodQty,
          scrapQty: m.scrapQty + action.scrapQty,
        })),
        productionEvents: event(
          state,
          meta,
          'product.reworked',
          `${rework.code} closed: ${action.goodQty} good, ${action.scrapQty} scrap`,
          { moId: rework.moId, wipId: rework.reworkWipId, siteId: rework.siteId },
        ),
      }
    }

    case 'ncrs/setStatus':
      return {
        ...state,
        ncrs: patchItem(state.ncrs, action.id, (n) => ({
          ...n,
          status: action.status,
          disposition: action.disposition ?? n.disposition,
          containment: action.containment ?? n.containment,
          closedAt: action.status === 'closed' ? meta.at : n.closedAt,
        })),
      }

    // ─── PLM governance ─────────────────────────────────────────

    case 'ecos/submit':
      return { ...state, ecos: patchItem(state.ecos, action.id, (e) => ({ ...e, status: 'review' })) }

    case 'ecos/decide':
      return {
        ...state,
        ecos: patchItem(state.ecos, action.id, (e) => ({
          ...e,
          status: action.decision === 'approved' ? 'approved' : 'rejected',
          approvals: [
            ...e.approvals,
            { by: meta.by, at: meta.at, decision: action.decision, note: action.note },
          ],
        })),
      }

    case 'ecos/release': {
      const eco = state.ecos.find((e) => e.id === action.id)
      if (!eco || eco.status !== 'approved') return state
      const from = state.productRevisions.find((r) => r.id === eco.fromRevisionId)
      let revisions = state.productRevisions
      let toId = eco.toRevisionId
      if (!toId && from) {
        const rev = `R${String(Number(from.rev.replace(/\D/g, '')) + 1).padStart(2, '0')}`
        toId = newId('rev')
        revisions = [
          ...revisions,
          {
            ...from,
            id: toId,
            rev,
            state: 'released',
            effectiveFrom: action.effectiveFrom,
            effectiveUntil: null,
            releasedAt: meta.at,
            releasedBy: meta.by,
            changeReason: eco.title,
            createdAt: meta.at,
          },
        ]
      }
      revisions = revisions.map((r) =>
        r.id === toId
          ? {
              ...r,
              state: 'released',
              effectiveFrom: action.effectiveFrom,
              releasedAt: meta.at,
              releasedBy: meta.by,
            }
          : r.id === eco.fromRevisionId
            ? { ...r, state: 'obsolete', effectiveUntil: action.effectiveFrom }
            : r,
      )
      const product = state.products.find((p) => p.id === eco.productId)
      return {
        ...state,
        ecos: patchItem(state.ecos, eco.id, (e) => ({
          ...e,
          status: 'released',
          toRevisionId: toId,
          effectiveFrom: action.effectiveFrom,
          releasedAt: meta.at,
        })),
        productRevisions: revisions,
        products: patchItem(state.products, eco.productId, (p) => ({ ...p, currentRevisionId: toId })),
        productionEvents: event(
          state,
          meta,
          'eco.released',
          `${eco.code} released for ${product?.code ?? eco.productId}; running orders keep their snapshot`,
          { siteId: state.sites[0]!.id },
        ),
      }
    }

    case 'productRevisions/release': {
      const rev = state.productRevisions.find((r) => r.id === action.id)
      if (!rev) return state
      return {
        ...state,
        productRevisions: state.productRevisions.map((r) =>
          r.id === rev.id
            ? {
                ...r,
                state: 'released',
                releasedAt: meta.at,
                releasedBy: meta.by,
                effectiveFrom: r.effectiveFrom ?? meta.at,
              }
            : r.productId === rev.productId && r.state === 'released'
              ? { ...r, state: 'obsolete', effectiveUntil: meta.at }
              : r,
        ),
        products: patchItem(state.products, rev.productId, (p) => ({ ...p, currentRevisionId: rev.id })),
      }
    }

    // ─── integrations ───────────────────────────────────────────

    case 'integrationConnections/toggle':
      return {
        ...state,
        integrationConnections: patchItem(state.integrationConnections, action.id, (c) => ({
          ...c,
          enabled: action.enabled,
          state: action.enabled
            ? c.state === 'not_configured'
              ? 'not_configured'
              : 'connected'
            : 'disconnected',
        })),
      }

    case 'integrationConnections/sync': {
      const conn = state.integrationConnections.find((c) => c.id === action.id)
      if (!conn || !conn.enabled) return state
      return {
        ...state,
        integrationLogs: [
          ...state.integrationLogs,
          {
            id: newId('ilg'),
            system: conn.system,
            direction: 'out',
            at: meta.at,
            event: 'sync.requested',
            ref: conn.name,
            summary: 'Demo request only; no external system was contacted',
            status: 'pending',
            durationMs: 0,
          },
        ],
      }
    }

    case 'machines/setState': {
      const machine = state.machines.find((m) => m.id === action.id)
      if (!machine) return state
      const machineSiteId = state.orgNodes.find((n) => n.id === machine.workCenterId)?.siteId
      if (!machineSiteId) return state
      const next: AppState = {
        ...state,
        machines: patchItem(state.machines, machine.id, (m) => ({
          ...m,
          state: action.state,
          telemetry: { ...m.telemetry, at: meta.at, alarm: action.alarm },
        })),
      }
      if (action.state !== 'down') return next
      const running = next.workOrders.filter((w) => w.machineId === machine.id && w.status === 'in_progress')
      let out: AppState = {
        ...next,
        productionEvents: event(
          next,
          meta,
          'machine.downtime.started',
          `${machine.code} down${action.alarm ? `: ${action.alarm}` : ''}`,
          { machineId: machine.id, siteId: machineSiteId },
        ),
      }
      for (const wo of running) {
        out = withWoEvent(
          out,
          wo.id,
          { status: 'paused', pauseReason: 'machine' },
          meta,
          'paused',
          `Paused: machine ${machine.code} down`,
          null,
          'workorder.paused',
        )
        out = withMoEvent(
          out,
          wo.moId,
          { atRisk: true, atRiskReason: `${machine.code} down at ${wo.operationName}` },
          meta,
          'manufacturing_order.held',
          `At risk: ${machine.code} down`,
        )
      }
      return out
    }

    case 'maintenance/request': {
      const machine = state.machines.find((m) => m.id === action.machineId)
      if (!machine) return state
      const machineSiteId = state.orgNodes.find((n) => n.id === machine.workCenterId)?.siteId
      if (!machineSiteId) return state
      const code = codeOf(state, 'maintenance', 'CM-')
      const impacted = state.workOrders
        .filter((w) => w.machineId === machine.id && (w.status === 'in_progress' || w.status === 'paused'))
        .map((w) => w.id)
      const record: MaintenanceRecord = {
        id: newId('mnt'),
        code,
        machineId: machine.id,
        kind: 'request',
        status: 'requested',
        title: action.title,
        plannedStart: meta.at,
        plannedEnd: toIso(addHours(toMs(meta.at), 4)),
        completedAt: null,
        impactedWoIds: impacted,
        sourceAlarm: action.alarm,
      }
      return {
        ...state,
        numbering: bumpNumbering(state, 'maintenance'),
        maintenanceRecords: [...state.maintenanceRecords, record],
        machines: patchItem(state.machines, machine.id, (m) => ({
          ...m,
          maintenanceState: 'in_maintenance',
        })),
        integrationLogs: [
          ...state.integrationLogs,
          {
            id: newId('ilg'),
            system: 'cmms',
            direction: 'out',
            at: meta.at,
            event: 'maintenance.requested',
            ref: code,
            summary: `${machine.code}: ${action.title}`,
            status: 'ok',
            durationMs: 180,
          },
        ],
        productionEvents: event(state, meta, 'maintenance.requested', `${code} raised for ${machine.code}`, {
          machineId: machine.id,
          siteId: machineSiteId,
        }),
      }
    }

    case 'maintenance/complete': {
      const record = state.maintenanceRecords.find((r) => r.id === action.id)
      if (!record) return state
      const machine = state.machines.find((m) => m.id === record.machineId)
      const machineSiteId = state.orgNodes.find((n) => n.id === machine?.workCenterId)?.siteId
      if (!machineSiteId) return state
      let out: AppState = {
        ...state,
        maintenanceRecords: patchItem(state.maintenanceRecords, record.id, (r) => ({
          ...r,
          status: 'completed',
          completedAt: meta.at,
        })),
        machines: patchItem(state.machines, record.machineId, (m) => ({
          ...m,
          maintenanceState: 'available',
          state: m.state === 'down' || m.state === 'maintenance' ? 'idle' : m.state,
          telemetry: { ...m.telemetry, alarm: null },
        })),
        integrationLogs: [
          ...state.integrationLogs,
          {
            id: newId('ilg'),
            system: 'cmms',
            direction: 'in',
            at: meta.at,
            event: 'maintenance.completed',
            ref: record.code,
            summary: `${machine?.code ?? record.machineId} available again`,
            status: 'ok',
            durationMs: 120,
          },
        ],
        productionEvents: event(
          state,
          meta,
          'maintenance.completed',
          `${record.code} completed; ${machine?.code ?? ''} available`,
          { machineId: record.machineId, siteId: machineSiteId },
        ),
      }
      for (const woId of record.impactedWoIds) {
        const wo = out.workOrders.find((w) => w.id === woId)
        if (!wo || wo.status !== 'paused') continue
        out = withWoEvent(
          out,
          woId,
          { status: 'in_progress', pauseReason: null },
          meta,
          'resumed',
          'Resumed after maintenance',
          null,
          'workorder.resumed',
        )
        out = withMoEvent(
          out,
          wo.moId,
          { atRisk: false, atRiskReason: '' },
          meta,
          'manufacturing_order.started',
          'Risk cleared: machine available',
        )
      }
      return out
    }

    default:
      return state
  }
}

// ─── lifecycle helpers ──────────────────────────────────────────

function createMo(state: AppState, meta: ActionMeta, draft: MoDraft): AppState {
  const code = codeOf(state, 'mo', 'MO-')
  const product = state.products.find((p) => p.id === draft.productId)
  const mo: ManufacturingOrder = {
    id: draft.id ?? newId('mo'),
    code,
    siteId: draft.siteId,
    productId: draft.productId,
    qty: draft.qty,
    uomId: product?.uomId ?? state.uoms[0]!.id,
    source: draft.source,
    demandIds: draft.demandIds,
    replenishmentId: draft.replenishmentId,
    priority: draft.priority,
    status: 'draft',
    lineId: draft.lineId,
    plannedStart: draft.plannedStart,
    plannedEnd: draft.plannedEnd,
    actualStart: null,
    actualEnd: null,
    snapshot: null,
    validations: [],
    goodQty: 0,
    rejectQty: 0,
    reworkQty: 0,
    scrapQty: 0,
    holdReasonId: null,
    atRisk: false,
    atRiskReason: '',
    events: [moEvent(meta, 'manufacturing_order.created', `Created from ${draft.source}`)],
    createdBy: meta.by,
    createdAt: meta.at,
  }
  return {
    ...state,
    numbering: bumpNumbering(state, 'mo'),
    manufacturingOrders: [...state.manufacturingOrders, mo],
    demands: state.demands.map((d) =>
      draft.demandIds.includes(d.id)
        ? {
            ...d,
            requirementQty: d.requirementQty + draft.qty,
            moIds: [...d.moIds, mo.id],
            status: d.allocatedQty + d.requirementQty + draft.qty >= d.qty ? 'resolved' : d.status,
            explanation: `${draft.qty} sent to production as ${code}${d.allocatedQty ? ` after ${d.allocatedQty} from stock` : ''}.`,
          }
        : d,
    ),
    marketingOrderItems: state.marketingOrderItems.map((i) =>
      state.demands.some((d) => draft.demandIds.includes(d.id) && d.orderItemId === i.id)
        ? { ...i, status: 'in_production' }
        : i,
    ),
    productionEvents: event(
      state,
      meta,
      'manufacturing_order.created',
      `${code} created for ${product?.name ?? draft.productId} × ${draft.qty}`,
      { moId: mo.id, siteId: draft.siteId },
    ),
  }
}

function releaseMo(state: AppState, meta: ActionMeta, id: string): AppState {
  const mo = state.manufacturingOrders.find((m) => m.id === id)
  if (!mo || (mo.status !== 'draft' && mo.status !== 'planned')) return state
  const validations = validateMo(state, mo)
  if (
    validations.some((v) => !v.ok && v.check !== 'material' && v.check !== 'machine' && v.check !== 'skills')
  ) {
    return withMoEvent(
      state,
      id,
      { validations },
      meta,
      'manufacturing_order.planned',
      'Release blocked by validation',
    )
  }
  const revision = currentRevision(state, mo.productId)!
  const bom = state.boms.find((b) => b.id === revision.bomId)!
  const bop = state.bops.find((b) => b.id === revision.bopId)!
  const bor = state.bors.find((b) => b.id === revision.borId)!
  const snapshot = {
    productRevisionId: revision.id,
    rev: revision.rev,
    bomId: bom.id,
    borId: bor.id,
    bopId: bop.id,
    specIds: revision.specIds,
    workInstructionIds: revision.workInstructionIds,
    takenAt: meta.at,
  }
  let numbering = state.numbering
  const workOrders: WorkOrder[] = []
  let cursor = toMs(mo.plannedStart)
  for (const op of [...bop.operations].sort((a, b) => a.seq - b.seq)) {
    const borItem = bor.items.find((i) => i.operationSeq === op.seq)
    const durationMs =
      (op.setupMin + op.queueMin + op.transferMin) * 60_000 +
      (op.cycleSec * mo.qty * 1000) / Math.max(1, borItem?.operatorCount ?? 1)
    const start = cursor
    const end = start + Math.max(HOUR, durationMs)
    cursor = end
    const first = workOrders.length === 0
    workOrders.push({
      id: newId('wo'),
      code: `${mo.code}-${op.seq}`,
      siteId: mo.siteId,
      moId: mo.id,
      operationSeq: op.seq,
      operationCode: op.code,
      operationName: op.name,
      workCenterId: op.workCenterId,
      machineId: null,
      operatorIds: [],
      shiftId: null,
      toolIds: [],
      moldIds: [],
      status: first ? 'ready' : 'waiting',
      priority: mo.priority,
      plannedStart: toIso(start),
      plannedEnd: toIso(end),
      actualStart: null,
      actualEnd: null,
      targetQty: mo.qty,
      outputQty: 0,
      goodQty: 0,
      rejectQty: 0,
      reworkQty: 0,
      scrapQty: 0,
      pauseReason: null,
      holdReasonId: null,
      qualityRequired: op.qualityRequired,
      workInstructionId: op.workInstructionId,
      events: [woEvent(meta, 'created', `Generated from ${bop.code} operation ${op.seq}`)],
    })
  }
  const requirements: MaterialRequirement[] = bom.items.map((item) => ({
    id: newId('mrq'),
    moId: mo.id,
    materialId: item.materialId,
    operationSeq: item.consumeAtSeq,
    requiredQty: Math.ceil(item.qtyPerUnit * mo.qty * (1 + item.scrapFactor) * 1000) / 1000,
    uomId: item.uomId,
    reservedQty: 0,
    stagedQty: 0,
    issuedQty: 0,
    consumedQty: 0,
    returnedQty: 0,
    status: 'shortage',
  }))
  const firstOp = workOrders[0]
  const buffer = state.inventoryLocations.find((l) => l.siteId === mo.siteId && l.kind === 'line_buffer')
  const wip: Wip | null = firstOp
    ? {
        id: newId('wip'),
        code: `${mo.code}-B1`,
        siteId: mo.siteId,
        moId: mo.id,
        woId: null,
        productId: mo.productId,
        operationSeq: firstOp.operationSeq,
        qty: mo.qty,
        state: 'queued',
        locationId: buffer?.id ?? '',
        batch: `${mo.code}-B1`,
        parentIds: [],
        lotIds: [],
        machineId: null,
        createdAt: meta.at,
        updatedAt: meta.at,
      }
    : null
  let events = state.productionEvents
  events = [
    ...events,
    {
      id: newId('evt'),
      siteId: mo.siteId,
      type: 'manufacturing_order.released',
      at: meta.at,
      by: meta.by,
      moId: mo.id,
      woId: null,
      wipId: null,
      lotId: null,
      machineId: null,
      text: `${mo.code} released with snapshot ${revision.rev}; ${workOrders.length} work orders generated`,
    },
  ]
  for (const r of requirements)
    events = [
      ...events,
      {
        id: newId('evt'),
        siteId: mo.siteId,
        type: 'material.required',
        at: meta.at,
        by: meta.by,
        moId: mo.id,
        woId: null,
        wipId: null,
        lotId: null,
        machineId: null,
        text: `${mo.code} requires ${r.requiredQty} of ${state.materials.find((m) => m.id === r.materialId)?.code ?? r.materialId}`,
      },
    ]
  numbering = numbering.map((n) => (n.entity === 'wo' ? { ...n, next: n.next + workOrders.length } : n))
  return {
    ...state,
    numbering,
    manufacturingOrders: patchItem(state.manufacturingOrders, mo.id, (m) => ({
      ...m,
      status: 'released',
      validations,
      snapshot,
      plannedEnd: workOrders.length ? workOrders.at(-1)!.plannedEnd : m.plannedEnd,
      events: [
        ...m.events,
        moEvent(meta, 'manufacturing_order.released', `Released with engineering snapshot ${revision.rev}`),
      ],
    })),
    workOrders: [...state.workOrders, ...workOrders],
    materialRequirements: [...state.materialRequirements.filter((r) => r.moId !== mo.id), ...requirements],
    wips: wip ? [...state.wips, wip] : state.wips,
    productionEvents: events,
  }
}

function recordOutput(state: AppState, meta: ActionMeta, record: OutputRecord): AppState {
  const wo = state.workOrders.find((w) => w.id === record.id)
  if (!wo || outputBlocker(state, record)) return state
  const total = record.goodQty + record.rejectQty + record.reworkQty + record.scrapQty
  const parts = [
    record.goodQty ? `${record.goodQty} good` : null,
    record.rejectQty ? `${record.rejectQty} reject` : null,
    record.reworkQty ? `${record.reworkQty} rework` : null,
    record.scrapQty ? `${record.scrapQty} scrap` : null,
  ]
    .filter(Boolean)
    .join(', ')
  // Scrap and rework quantities are added to the order totals by scrap/record and rework/create below.
  let next = withWoEvent(
    state,
    wo.id,
    {
      outputQty: wo.outputQty + total,
      goodQty: wo.goodQty + record.goodQty,
      rejectQty: wo.rejectQty + record.rejectQty,
    },
    meta,
    'output',
    `Output: ${parts}${record.note ? ` · ${record.note}` : ''}`,
    total,
    'wip.created',
  )
  const mo = next.manufacturingOrders.find((m) => m.id === wo.moId)
  const successors = next.workOrders
    .filter((w) => w.moId === wo.moId && w.operationSeq > wo.operationSeq && w.status !== 'cancelled')
    .sort((a, b) => a.operationSeq - b.operationSeq)
  const successor = successors[0]
  next = {
    ...next,
    manufacturingOrders: patchItem(next.manufacturingOrders, wo.moId, (m) => ({
      ...m,
      goodQty: successor ? m.goodQty : m.goodQty + record.goodQty,
      rejectQty: m.rejectQty + record.rejectQty,
    })),
  }
  // Good output feeds the next operation's input buffer as new WIP.
  const inputs = next.wips.filter(
    (w) =>
      w.moId === wo.moId &&
      w.operationSeq === wo.operationSeq &&
      (w.state === 'processing' || w.state === 'queued'),
  )
  const input = inputs[0]
  const buffer = next.inventoryLocations.find((l) => l.siteId === wo.siteId && l.kind === 'line_buffer')
  if (record.goodQty > 0 && successor) {
    const existing = next.wips.find(
      (w) =>
        w.moId === wo.moId &&
        w.operationSeq === successor.operationSeq &&
        (w.state === 'queued' || w.state === 'waiting'),
    )
    next = existing
      ? {
          ...next,
          wips: patchItem(next.wips, existing.id, (w) => ({
            ...w,
            qty: w.qty + record.goodQty,
            updatedAt: meta.at,
          })),
        }
      : {
          ...next,
          wips: [
            ...next.wips,
            {
              id: newId('wip'),
              code: `${mo?.code ?? 'WIP'}-B${successor.operationSeq}`,
              siteId: wo.siteId,
              moId: wo.moId,
              woId: null,
              productId: input?.productId ?? mo?.productId ?? '',
              operationSeq: successor.operationSeq,
              qty: record.goodQty,
              state: 'queued',
              locationId: buffer?.id ?? '',
              batch: input?.batch ?? `${wo.code}-B`,
              parentIds: input ? [input.id] : [],
              lotIds: input?.lotIds ?? [],
              machineId: null,
              createdAt: meta.at,
              updatedAt: meta.at,
            },
          ],
        }
  }
  if (inputs.length) {
    let left = total
    next = {
      ...next,
      wips: next.wips.map((w) => {
        if (!inputs.some((source) => source.id === w.id) || left <= 0) return w
        const taken = Math.min(left, w.qty)
        left -= taken
        return { ...w, qty: w.qty - taken, updatedAt: meta.at }
      }),
    }
  }
  if (record.rejectQty > 0) {
    next = {
      ...next,
      productionEvents: event(next, meta, 'product.rejected', `${wo.code}: ${record.rejectQty} rejected`, {
        moId: wo.moId,
        woId: wo.id,
        siteId: wo.siteId,
      }),
    }
  }
  if (record.scrapQty > 0) {
    next = reduce(next, {
      action: {
        type: 'scrap/record',
        moId: wo.moId,
        woId: wo.id,
        wipId: input?.id ?? null,
        operationSeq: wo.operationSeq,
        qty: record.scrapQty,
        reasonCodeId: record.reasonCodeId ?? next.reasonCodes.find((r) => r.kind === 'scrap')?.id ?? '',
        disposition: 'scrap',
        note: record.note,
        inputAlreadyConsumed: true,
      },
      meta,
    })
  }
  if (record.reworkQty > 0) {
    const bop = next.bops.find((b) => b.id === mo?.snapshot?.bopId)
    const op = bop?.operations.find((o) => o.seq === wo.operationSeq)
    const route =
      op?.reworkToSeq !== null && op?.reworkToSeq !== undefined
        ? bop!.operations
            .filter((o) => o.seq >= op.reworkToSeq! && o.seq <= wo.operationSeq)
            .map((o) => o.seq)
        : [wo.operationSeq]
    next = reduce(next, {
      action: {
        type: 'rework/create',
        moId: wo.moId,
        sourceWoId: wo.id,
        sourceWipId: input?.id ?? null,
        qty: record.reworkQty,
        routeSeqs: route,
        reasonCodeId: record.reasonCodeId ?? next.reasonCodes.find((r) => r.kind === 'rework')?.id ?? '',
        inputAlreadyConsumed: true,
      },
      meta,
    })
  }
  return next
}

type MoveSpec = {
  kind: MaterialTxn['kind']
  moId: string
  woId: string | null
  materialId: string
  lotId: string
  qty: number
  to: string | null
  mode: ConsumptionMode
  field: 'reservedQty' | 'stagedQty' | 'issuedQty' | 'consumedQty' | 'returnedQty'
  lotStatus: MaterialLot['status']
  eventType: EventType
  note: string
}

function materialMove(state: AppState, meta: ActionMeta, spec: MoveSpec): AppState {
  const mo = state.manufacturingOrders.find((m) => m.id === spec.moId)
  const lot = state.materialLots.find((l) => l.id === spec.lotId)
  if (!mo || !lot) return state
  const wo = spec.woId ? state.workOrders.find((w) => w.id === spec.woId) : undefined
  const requirement = state.materialRequirements.find(
    (r) => r.moId === spec.moId && r.materialId === spec.materialId,
  )
  const floorLocation = state.inventoryLocations.find((l) => l.siteId === mo.siteId && l.kind === 'floor')
  const from = spec.kind === 'return' ? (floorLocation?.id ?? null) : lot.locationId
  const to =
    spec.kind === 'stage' || spec.kind === 'return'
      ? spec.to
      : spec.kind === 'issue'
        ? (floorLocation?.id ?? null)
        : spec.kind === 'consume'
          ? null
          : lot.locationId
  const txn: MaterialTxn = {
    id: newId('mtx'),
    siteId: mo.siteId,
    kind: spec.kind,
    materialId: spec.materialId,
    lotId: lot.id,
    qty: spec.qty,
    uomId: lot.uomId,
    fromLocationId: from,
    toLocationId: to,
    moId: mo.id,
    woId: spec.woId,
    operationSeq: wo?.operationSeq ?? requirement?.operationSeq ?? null,
    mode: spec.mode,
    at: meta.at,
    by: meta.by,
    note: spec.note,
  }
  const requirements = requirement
    ? patchItem(state.materialRequirements, requirement.id, (r) => {
        const next = { ...r, [spec.field]: r[spec.field] + spec.qty }
        // Quantities move along the chain: a staged quantity is no longer merely reserved, and so on.
        if (spec.kind === 'stage') next.reservedQty = Math.max(0, next.reservedQty - spec.qty)
        if (spec.kind === 'issue') next.stagedQty = Math.max(0, next.stagedQty - spec.qty)
        if (spec.kind === 'consume') next.issuedQty = Math.max(0, next.issuedQty - spec.qty)
        if (spec.kind === 'return') next.issuedQty = Math.max(0, next.issuedQty - spec.qty)
        return { ...next, status: requirementStatus(next) }
      })
    : state.materialRequirements
  let floorStock = state.floorStock
  const existing = floorStock.find((f) => f.lotId === lot.id && f.moId === mo.id)
  if (spec.kind === 'reserve') {
    floorStock = existing
      ? patchItem(floorStock, existing.id, (f) => ({
          ...f,
          reservedQty: f.reservedQty + spec.qty,
          qty: Math.max(f.qty, f.reservedQty + spec.qty),
        }))
      : [
          ...floorStock,
          {
            id: newId('fst'),
            siteId: mo.siteId,
            materialId: spec.materialId,
            lotId: lot.id,
            locationId: lot.locationId,
            qty: spec.qty,
            reservedQty: spec.qty,
            moId: mo.id,
          },
        ]
  } else if (spec.kind === 'stage' || spec.kind === 'issue') {
    floorStock = existing
      ? patchItem(floorStock, existing.id, (f) => ({ ...f, locationId: to ?? f.locationId }))
      : [
          ...floorStock,
          {
            id: newId('fst'),
            siteId: mo.siteId,
            materialId: spec.materialId,
            lotId: lot.id,
            locationId: to ?? lot.locationId,
            qty: spec.qty,
            reservedQty: spec.qty,
            moId: mo.id,
          },
        ]
  } else if (spec.kind === 'consume' || spec.kind === 'return') {
    floorStock = existing
      ? patchItem(floorStock, existing.id, (f) => ({
          ...f,
          qty: Math.max(0, f.qty - spec.qty),
          reservedQty: Math.max(0, f.reservedQty - spec.qty),
        })).filter((f) => f.qty > 0)
      : floorStock
  }
  const lotQty = spec.kind === 'consume' ? lot.qty - spec.qty : lot.qty
  const lots = patchItem(state.materialLots, lot.id, (l) => ({
    ...l,
    qty: Math.max(0, lotQty),
    status:
      lotQty <= 0
        ? 'consumed'
        : spec.kind === 'return'
          ? 'available'
          : spec.kind === 'consume'
            ? l.status
            : spec.lotStatus,
    locationId: spec.kind === 'stage' || spec.kind === 'return' ? (to ?? l.locationId) : l.locationId,
  }))
  const material = state.materials.find((m) => m.id === spec.materialId)
  return {
    ...state,
    materialRequirements: requirements,
    floorStock,
    materialLots: lots,
    materialTxns: [...state.materialTxns, txn],
    productionEvents: event(
      state,
      meta,
      spec.eventType,
      `${mo.code}: ${spec.qty} ${material?.code ?? ''} ${spec.kind} (lot ${lot.code})`,
      { moId: mo.id, woId: spec.woId, lotId: lot.id, siteId: mo.siteId },
    ),
  }
}

function dispositionState(disposition: Disposition): WipState {
  switch (disposition) {
    case 'accept':
    case 'use_as_is':
      return 'queued'
    case 'rework':
      return 'rework'
    case 'scrap':
      return 'scrapped'
    case 'hold':
      return 'quality_hold'
    case 'return':
      return 'waiting'
  }
}

function releaseHold(state: AppState, meta: ActionMeta, id: string, disposition: Disposition): AppState {
  const hold = state.qualityHolds.find((h) => h.id === id)
  if (!hold || hold.status === 'released') return state
  const next: AppState = {
    ...state,
    qualityHolds: patchItem(state.qualityHolds, id, (h) => ({
      ...h,
      status: 'released',
      releasedBy: meta.by,
      releasedAt: meta.at,
      disposition,
    })),
    productionEvents: event(state, meta, 'wip.released', `${hold.code} released · ${disposition}`, {
      moId: hold.moId,
      wipId: hold.target === 'wip' ? hold.targetId : null,
      lotId: hold.target === 'lot' ? hold.targetId : null,
      siteId: hold.siteId,
    }),
  }
  if (hold.target === 'wip') {
    const wip = state.wips.find((w) => w.id === hold.targetId)
    const buffer = state.inventoryLocations.find(
      (l) => l.siteId === hold.siteId && l.kind === (disposition === 'rework' ? 'rework' : 'line_buffer'),
    )
    return {
      ...next,
      wips: patchItem(next.wips, hold.targetId, (w) => ({
        ...w,
        state: dispositionState(disposition),
        locationId: disposition === 'scrap' ? w.locationId : (buffer?.id ?? w.locationId),
        updatedAt: meta.at,
      })),
      scrapRecords:
        disposition === 'scrap' && wip
          ? [
              ...next.scrapRecords,
              {
                id: newId('scr'),
                siteId: hold.siteId,
                moId: hold.moId,
                woId: wip.woId ?? '',
                wipId: wip.id,
                operationSeq: wip.operationSeq,
                qty: wip.qty,
                reasonCodeId: hold.reasonCodeId,
                operatorId: meta.by,
                disposition: 'scrap',
                at: meta.at,
                note: `Scrapped on hold release ${hold.code}`,
              },
            ]
          : next.scrapRecords,
    }
  }
  if (hold.target === 'lot')
    return {
      ...next,
      materialLots: patchItem(next.materialLots, hold.targetId, (l) => ({
        ...l,
        status: disposition === 'return' ? 'returned' : 'available',
      })),
    }
  if (hold.target === 'mo')
    return reduce(next, { action: { type: 'manufacturingOrders/resume', id: hold.targetId }, meta })
  if (hold.target === 'wo')
    return reduce(next, { action: { type: 'workOrders/releaseHold', id: hold.targetId }, meta })
  return next
}
