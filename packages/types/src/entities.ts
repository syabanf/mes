import type {
  Availability,
  ConnectionState,
  ConsumptionMode,
  DemandSource,
  DemandStatus,
  Disposition,
  EcoDecision,
  EcoStatus,
  EventType,
  FulfillmentStrategy,
  HoldStatus,
  HoldTarget,
  InspectionStatus,
  InspectionTrigger,
  InstructionStepKind,
  IntegrationDirection,
  IntegrationStatus,
  IntegrationSystem,
  InventoryLocationKind,
  ItemFulfillmentStatus,
  LoginMethod,
  LotStatus,
  MachineState,
  MaintenanceKind,
  MaintenanceState,
  MaintenanceStatus,
  MarketingOrderStatus,
  MaterialClass,
  MaterialTxnKind,
  MeasurementType,
  MoSource,
  MoStatus,
  NcrStatus,
  OrgKind,
  PauseReason,
  Priority,
  ReasonKind,
  ReplenishmentStatus,
  RequirementStatus,
  ResourceKind,
  ResourceStatus,
  RevisionState,
  ReworkStatus,
  Role,
  Severity,
  SkillLevel,
  SpecKind,
  ValidationCheck,
  Weekday,
  WipState,
  WoEventKind,
  WoStatus,
} from './enums'

/** ISO 8601 timestamp with offset, e.g. 2026-09-23T08:12:00+07:00 */
export type IsoDate = string

// ─── Organization ───────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  legalName: string
}

export interface Site {
  id: string
  code: string
  name: string
  city: string
  timezone: string
}

/** Plant → area → line → work center → zone. Every node hangs off a site. */
export interface OrgNode {
  id: string
  siteId: string
  parentId: string | null
  kind: OrgKind
  code: string
  name: string
  /** Work centers only: hours of capacity per shift. */
  capacityHoursPerShift?: number
}

// ─── Commercial ─────────────────────────────────────────────────

export interface Customer {
  id: string
  code: string
  name: string
  city: string
  contact: string
  email: string
  /** ID in the CRM, mapped through integration mapping. */
  externalId: string | null
}

export interface Supplier {
  id: string
  code: string
  name: string
  city: string
  contact: string
  materialIds: string[]
  externalId: string | null
}

// ─── Product and material ───────────────────────────────────────

export interface Category {
  id: string
  code: string
  name: string
  kind: 'product' | 'material'
}

export interface Uom {
  id: string
  code: string
  name: string
  /** Number of decimals a quantity in this unit carries. */
  precision: number
}

export interface UomConversion {
  id: string
  fromUomId: string
  toUomId: string
  factor: number
  /** Conversion valid for one item only (e.g. 1 tray = 50 pcs of a product). */
  itemId: string | null
}

export interface Product {
  id: string
  code: string
  name: string
  categoryId: string
  uomId: string
  /** Weight of one piece in grams, for the gold and silver bar family. */
  unitWeightG: number
  defaultStrategy: FulfillmentStrategy
  lotControlled: boolean
  serialControlled: boolean
  currentRevisionId: string | null
  standardCostIdr: number
  active: boolean
}

export interface Material {
  id: string
  code: string
  name: string
  categoryId: string
  materialClass: MaterialClass
  uomId: string
  lotControlled: boolean
  supplierId: string | null
  unitCostIdr: number
  active: boolean
}

// ─── PLM ────────────────────────────────────────────────────────

export interface ProductRevision {
  id: string
  productId: string
  rev: string
  state: RevisionState
  bomId: string | null
  borId: string | null
  bopId: string | null
  specIds: string[]
  workInstructionIds: string[]
  effectiveFrom: IsoDate | null
  effectiveUntil: IsoDate | null
  releasedAt: IsoDate | null
  releasedBy: string | null
  changeReason: string
  createdAt: IsoDate
}

export interface BomItem {
  id: string
  materialId: string
  qtyPerUnit: number
  uomId: string
  scrapFactor: number
  /** Operation sequence in the BOP where this material is consumed. */
  consumeAtSeq: number
  substituteMaterialIds: string[]
  /** Nested BOM for a semi-finished material. */
  childBomId: string | null
}

export interface Bom {
  id: string
  code: string
  productId: string
  rev: string
  state: RevisionState
  items: BomItem[]
  createdAt: IsoDate
}

export interface BorItem {
  id: string
  operationSeq: number
  /** Org node code of the work center (WC-CAST); the same code resolves to a node per site. */
  workCenterCode: string
  machineIds: string[]
  toolIds: string[]
  moldIds: string[]
  fixtureIds: string[]
  utilityIds: string[]
  skillIds: string[]
  operatorCount: number
  standardSetupMin: number
  standardCycleSec: number
  laborMinPerUnit: number
}

export interface Bor {
  id: string
  code: string
  productId: string
  rev: string
  state: RevisionState
  items: BorItem[]
  createdAt: IsoDate
}

export interface Operation {
  id: string
  seq: number
  code: string
  name: string
  /** Org node code of the work center; resolved per site when the order is released. */
  workCenterCode: string
  setupMin: number
  cycleSec: number
  queueMin: number
  transferMin: number
  predecessorSeqs: number[]
  parallel: boolean
  /** Sequence the operation routes to on rework, or null when rework is not allowed here. */
  reworkToSeq: number | null
  qualityRequired: boolean
  workInstructionId: string | null
}

export interface Bop {
  id: string
  code: string
  productId: string
  rev: string
  state: RevisionState
  operations: Operation[]
  createdAt: IsoDate
}

export interface Characteristic {
  id: string
  name: string
  type: MeasurementType
  target: number | null
  min: number | null
  max: number | null
  unit: string
  method: string
  /** Operation the characteristic is measured at. */
  operationSeq: number
}

export interface Specification {
  id: string
  code: string
  productId: string
  rev: string
  kind: SpecKind
  state: RevisionState
  characteristics: Characteristic[]
  createdAt: IsoDate
}

export interface InstructionStep {
  id: string
  kind: InstructionStepKind
  title: string
  body: string
  /** Checklist steps: the lines the operator ticks. */
  items: string[]
  /** Image, PDF or video: a file name shown as an attachment. */
  attachment: string | null
}

export interface WorkInstruction {
  id: string
  code: string
  productId: string
  operationSeq: number
  rev: string
  state: RevisionState
  title: string
  steps: InstructionStep[]
  createdAt: IsoDate
}

export interface EcoApproval {
  by: string
  at: IsoDate
  decision: EcoDecision
  note: string
}

export interface Eco {
  id: string
  code: string
  title: string
  productId: string
  fromRevisionId: string
  /** The revision the change produces; null while the ECO is a draft. */
  toRevisionId: string | null
  reasonCodeId: string
  description: string
  status: EcoStatus
  affects: ('bom' | 'bor' | 'bop' | 'spec' | 'work_instruction')[]
  requestedBy: string
  requestedAt: IsoDate
  effectiveFrom: IsoDate | null
  approvals: EcoApproval[]
  releasedAt: IsoDate | null
}

// ─── Resources ──────────────────────────────────────────────────

export interface Telemetry {
  at: IsoDate
  temperatureC: number | null
  speedRpm: number | null
  currentA: number | null
  pressureBar: number | null
  vibrationMmS: number | null
  counter: number
  alarm: string | null
}

export interface Machine {
  /** Canonical id shared with OEE, Device Monitoring and CMMS, e.g. MACHINE-00001. */
  id: string
  code: string
  name: string
  workCenterId: string
  lineId: string
  model: string
  state: MachineState
  maintenanceState: MaintenanceState
  /** Product ids this machine may run; empty means any. */
  eligibleProductIds: string[]
  telemetry: Telemetry
  active: boolean
}

export interface Resource {
  id: string
  code: string
  name: string
  kind: ResourceKind
  workCenterId: string | null
  status: ResourceStatus
  /** Molds: cavities per shot. */
  cavities: number | null
  /** Tools and molds: shots since the last refurbishment against the life limit. */
  usageCount: number
  lifeLimit: number | null
}

// ─── People ─────────────────────────────────────────────────────

export interface Skill {
  id: string
  code: string
  name: string
}

export interface Person {
  id: string
  code: string
  name: string
  role: Role
  email: string
  siteIds: string[]
  shiftId: string | null
  /** skillId → level */
  skills: Record<string, SkillLevel>
  /** Work centers the person is qualified to run. */
  workCenterIds: string[]
  loginMethod: LoginMethod
  badge: string
  availability: Availability
  color: string
}

// ─── Planning master ────────────────────────────────────────────

export interface Shift {
  id: string
  code: string
  name: string
  /** "07:00" */
  start: string
  end: string
  days: Weekday[]
  breakMin: number
}

export interface CalendarDay {
  id: string
  siteId: string
  /** YYYY-MM-DD */
  date: string
  working: boolean
  note: string
}

export interface ProductionPolicy {
  id: string
  siteId: string
  key: string
  label: string
  value: string
  description: string
}

// ─── Inventory master ───────────────────────────────────────────

export interface InventoryLocation {
  id: string
  siteId: string
  code: string
  name: string
  kind: InventoryLocationKind
  orgNodeId: string | null
}

export interface InventoryPolicy {
  id: string
  siteId: string
  productId: string
  safetyStock: number
  minStock: number
  reorderPoint: number
  maxStock: number
  replenishQty: number
  productionMultiple: number
}

export interface LotRule {
  id: string
  itemId: string
  itemKind: 'product' | 'material'
  pattern: string
  expiryDays: number | null
}

export interface SerialRule {
  id: string
  productId: string
  pattern: string
  nextSeq: number
}

// ─── System master ──────────────────────────────────────────────

export interface ReasonCode {
  id: string
  kind: ReasonKind
  code: string
  label: string
  active: boolean
}

export interface NumberingSequence {
  id: string
  entity: string
  label: string
  prefix: string
  pattern: string
  next: number
}

export interface IntegrationMapping {
  id: string
  system: IntegrationSystem
  entityKind: 'machine' | 'product' | 'material' | 'customer' | 'supplier' | 'operator' | 'location'
  internalId: string
  externalId: string
}

export interface IntegrationConnection {
  id: string
  system: IntegrationSystem
  name: string
  state: ConnectionState
  endpoint: string
  lastSyncAt: IsoDate | null
  /** Events per hour over the last day. */
  throughput: number
  enabled: boolean
}

export interface IntegrationLog {
  id: string
  system: IntegrationSystem
  direction: IntegrationDirection
  at: IsoDate
  event: EventType | string
  ref: string
  summary: string
  status: IntegrationStatus
  durationMs: number
}

// ─── Marketing and demand ───────────────────────────────────────

export interface MarketingOrder {
  id: string
  code: string
  siteId: string
  customerId: string
  orderDate: IsoDate
  requiredDate: IsoDate
  priority: Priority
  reference: string
  status: MarketingOrderStatus
  note: string
  /** Set when the last line is delivered. */
  deliveredAt: IsoDate | null
  closedAt: IsoDate | null
  createdBy: string
  createdAt: IsoDate
}

export interface MarketingOrderItem {
  id: string
  orderId: string
  line: number
  productId: string
  qty: number
  uomId: string
  requiredDate: IsoDate
  strategy: FulfillmentStrategy
  status: ItemFulfillmentStatus
  allocatedQty: number
  producedQty: number
  deliveredQty: number
}

export interface Demand {
  id: string
  code: string
  siteId: string
  source: DemandSource
  productId: string
  qty: number
  requiredDate: IsoDate
  status: DemandStatus
  /** Marketing order item that raised it, for customer demand. */
  orderItemId: string | null
  /** Quantity satisfied from stock. */
  allocatedQty: number
  /** Quantity handed to production. */
  requirementQty: number
  moIds: string[]
  /** Why production is needed, in one sentence. */
  explanation: string
  createdAt: IsoDate
}

export interface Replenishment {
  id: string
  code: string
  siteId: string
  productId: string
  onHand: number
  projected: number
  reorderPoint: number
  requiredQty: number
  status: ReplenishmentStatus
  demandId: string | null
  moId: string | null
  createdAt: IsoDate
}

// ─── Manufacturing ──────────────────────────────────────────────

export interface PlmSnapshot {
  productRevisionId: string
  rev: string
  bomId: string
  borId: string
  bopId: string
  specIds: string[]
  workInstructionIds: string[]
  takenAt: IsoDate
}

export interface Validation {
  check: ValidationCheck
  ok: boolean
  note: string
}

export interface MoEvent {
  id: string
  at: IsoDate
  by: string
  type: EventType
  text: string
}

export interface ManufacturingOrder {
  id: string
  code: string
  siteId: string
  productId: string
  qty: number
  uomId: string
  source: MoSource
  demandIds: string[]
  replenishmentId: string | null
  priority: Priority
  status: MoStatus
  lineId: string | null
  plannedStart: IsoDate
  plannedEnd: IsoDate
  actualStart: IsoDate | null
  actualEnd: IsoDate | null
  snapshot: PlmSnapshot | null
  validations: Validation[]
  goodQty: number
  rejectQty: number
  reworkQty: number
  scrapQty: number
  holdReasonId: string | null
  /** Set by the CMMS or planner when a machine failure threatens the plan. */
  atRisk: boolean
  atRiskReason: string
  events: MoEvent[]
  createdBy: string
  createdAt: IsoDate
}

export interface WoEvent {
  id: string
  at: IsoDate
  by: string
  kind: WoEventKind
  text: string
  qty: number | null
}

export interface WorkOrder {
  id: string
  code: string
  siteId: string
  moId: string
  operationSeq: number
  operationCode: string
  operationName: string
  workCenterId: string
  machineId: string | null
  operatorIds: string[]
  shiftId: string | null
  toolIds: string[]
  moldIds: string[]
  status: WoStatus
  priority: Priority
  plannedStart: IsoDate
  plannedEnd: IsoDate
  actualStart: IsoDate | null
  actualEnd: IsoDate | null
  targetQty: number
  outputQty: number
  goodQty: number
  rejectQty: number
  reworkQty: number
  scrapQty: number
  pauseReason: PauseReason | null
  holdReasonId: string | null
  qualityRequired: boolean
  workInstructionId: string | null
  events: WoEvent[]
}

// ─── Manufacturing inventory ────────────────────────────────────

export interface MaterialLot {
  id: string
  code: string
  siteId: string
  materialId: string
  supplierId: string | null
  qty: number
  uomId: string
  locationId: string
  status: LotStatus
  receivedAt: IsoDate
  expiresAt: IsoDate | null
}

export interface FloorStock {
  id: string
  siteId: string
  materialId: string
  lotId: string
  locationId: string
  qty: number
  reservedQty: number
  /** Manufacturing order the reservation belongs to. */
  moId: string | null
}

export interface MaterialRequirement {
  id: string
  moId: string
  materialId: string
  operationSeq: number
  requiredQty: number
  uomId: string
  reservedQty: number
  stagedQty: number
  issuedQty: number
  consumedQty: number
  returnedQty: number
  status: RequirementStatus
}

export interface MaterialTxn {
  id: string
  siteId: string
  kind: MaterialTxnKind
  materialId: string
  lotId: string | null
  qty: number
  uomId: string
  fromLocationId: string | null
  toLocationId: string | null
  moId: string | null
  woId: string | null
  operationSeq: number | null
  mode: ConsumptionMode
  at: IsoDate
  by: string
  note: string
}

export interface FinishedGoodsReceipt {
  id: string
  code: string
  siteId: string
  moId: string
  productId: string
  qty: number
  uomId: string
  lotCode: string
  locationId: string
  serialIds: string[]
  at: IsoDate
  by: string
}

export interface Serial {
  id: string
  serialNo: string
  productId: string
  moId: string
  wipId: string | null
  receiptId: string | null
  customerId: string | null
  status: 'in_production' | 'finished' | 'delivered' | 'scrapped'
}

// ─── WIP ────────────────────────────────────────────────────────

export interface Wip {
  id: string
  code: string
  siteId: string
  moId: string
  woId: string | null
  productId: string
  operationSeq: number
  qty: number
  state: WipState
  locationId: string
  batch: string
  /** WIP ids this one was split from or merged out of. */
  parentIds: string[]
  /** Material lots that went into it. */
  lotIds: string[]
  machineId: string | null
  createdAt: IsoDate
  updatedAt: IsoDate
}

// ─── Quality ────────────────────────────────────────────────────

export interface InspectionPlan {
  id: string
  code: string
  productId: string
  operationSeq: number
  trigger: InspectionTrigger
  specId: string
  sampleSize: number
  /** Batches, pieces or minutes between inspections depending on the trigger. */
  every: number
}

export interface Measurement {
  characteristicId: string
  name: string
  type: MeasurementType
  value: number | null
  result: 'pass' | 'fail' | null
  note: string
  target: number | null
  min: number | null
  max: number | null
  unit: string
}

export interface Inspection {
  id: string
  code: string
  siteId: string
  planId: string | null
  productId: string
  moId: string
  woId: string | null
  wipId: string | null
  lotId: string | null
  operationSeq: number
  trigger: InspectionTrigger
  status: InspectionStatus
  sampleSize: number
  measurements: Measurement[]
  inspectorId: string | null
  requestedAt: IsoDate
  completedAt: IsoDate | null
  disposition: Disposition | null
  defectRecordIds: string[]
  photos: string[]
  note: string
}

export interface DefectCode {
  id: string
  code: string
  name: string
  category: string
  severity: Severity
  active: boolean
}

export interface DefectRecord {
  id: string
  siteId: string
  defectCodeId: string
  inspectionId: string | null
  moId: string
  woId: string | null
  wipId: string | null
  qty: number
  note: string
  at: IsoDate
  by: string
}

export interface QualityHold {
  id: string
  code: string
  siteId: string
  target: HoldTarget
  targetId: string
  /** Order the held item belongs to; null for an incoming lot outside any order. */
  moId: string | null
  reasonCodeId: string
  note: string
  status: HoldStatus
  heldBy: string
  heldAt: IsoDate
  releasedBy: string | null
  releasedAt: IsoDate | null
  disposition: Disposition | null
}

export interface ScrapRecord {
  id: string
  siteId: string
  moId: string
  woId: string
  wipId: string | null
  operationSeq: number
  qty: number
  reasonCodeId: string
  operatorId: string
  disposition: Disposition
  at: IsoDate
  note: string
}

export interface ReworkOrder {
  id: string
  code: string
  siteId: string
  moId: string
  sourceWoId: string
  sourceWipId: string | null
  reworkWipId: string | null
  qty: number
  /** Operation sequences the rework routes through. */
  routeSeqs: number[]
  status: ReworkStatus
  inspectionId: string | null
  goodQty: number
  scrapQty: number
  reasonCodeId: string
  createdAt: IsoDate
  closedAt: IsoDate | null
}

export interface Ncr {
  id: string
  code: string
  siteId: string
  title: string
  defectCodeId: string
  severity: Severity
  source: 'inspection' | 'operator' | 'customer' | 'supplier' | 'audit'
  moId: string | null
  woId: string | null
  lotId: string | null
  wipId: string | null
  containment: string
  disposition: Disposition | null
  status: NcrStatus
  raisedBy: string
  raisedAt: IsoDate
  closedAt: IsoDate | null
}

// ─── Traceability ───────────────────────────────────────────────

/** One line of the production history and the electronic manufacturing record. */
export interface ProductionEvent {
  id: string
  siteId: string
  type: EventType
  at: IsoDate
  by: string
  moId: string | null
  woId: string | null
  wipId: string | null
  lotId: string | null
  machineId: string | null
  text: string
}

// ─── Integration snapshots ──────────────────────────────────────

export interface OeeSnapshot {
  id: string
  machineId: string
  /** YYYY-MM-DD */
  date: string
  shiftId: string
  moId: string | null
  woId: string | null
  productId: string | null
  operatorId: string | null
  availability: number
  performance: number
  quality: number
  oee: number
  downtimeMin: number
  lossMin: number
  targetQty: number
  actualQty: number
}

export interface TelemetryPoint {
  id: string
  machineId: string
  at: IsoDate
  temperatureC: number | null
  speedRpm: number | null
  currentA: number | null
  pressureBar: number | null
  vibrationMmS: number | null
  counter: number
  state: MachineState
  alarm: string | null
  moId: string | null
  woId: string | null
}

export interface MaintenanceRecord {
  id: string
  code: string
  machineId: string
  kind: MaintenanceKind
  status: MaintenanceStatus
  title: string
  plannedStart: IsoDate
  plannedEnd: IsoDate
  completedAt: IsoDate | null
  /** Work orders the outage paused. */
  impactedWoIds: string[]
  sourceAlarm: string | null
}

// ─── Settings ───────────────────────────────────────────────────

export interface Settings {
  /** WIP older than this many hours counts as aging. */
  wipAgingHours: number
  /** Percent of planned time left before an MO is flagged as delayed. */
  delayThresholdPct: number
  /** Default sample size for inspections without a plan. */
  defaultSampleSize: number
  /** Minutes before shift end a shift summary is prepared. */
  shiftSummaryLeadMin: number
}

/** Finished goods on hand per product and location: what MTS demand allocates against. */
export interface FgStock {
  id: string
  siteId: string
  productId: string
  locationId: string
  qty: number
  allocatedQty: number
}
