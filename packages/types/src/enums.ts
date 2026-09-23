// Domain unions and their display labels. Label maps live beside the union they describe.

// ─── Organization and people ────────────────────────────────────

export type OrgKind = 'plant' | 'area' | 'line' | 'work_center' | 'zone'
export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  plant: 'Plant',
  area: 'Area',
  line: 'Line',
  work_center: 'Work center',
  zone: 'Production zone',
}
export const ORG_KINDS: OrgKind[] = ['plant', 'area', 'line', 'work_center', 'zone']

export type Role =
  | 'admin'
  | 'production_manager'
  | 'planner'
  | 'supervisor'
  | 'operator'
  | 'quality'
  | 'engineer'
  | 'marketing'
  | 'warehouse'
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  production_manager: 'Production manager',
  planner: 'Planner',
  supervisor: 'Shift supervisor',
  operator: 'Operator',
  quality: 'Quality inspector',
  engineer: 'Process engineer',
  marketing: 'Marketing',
  warehouse: 'Warehouse',
}
export const ROLES: Role[] = [
  'admin',
  'production_manager',
  'planner',
  'supervisor',
  'operator',
  'quality',
  'engineer',
  'marketing',
  'warehouse',
]

export type SkillLevel = 1 | 2 | 3 | 4
export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  1: 'Trainee',
  2: 'Qualified',
  3: 'Senior',
  4: 'Trainer',
}

export type Availability = 'on_shift' | 'off_shift' | 'leave'
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  on_shift: 'On shift',
  off_shift: 'Off shift',
  leave: 'On leave',
}

export type LoginMethod = 'rfid' | 'nfc' | 'qr' | 'pin'
export const LOGIN_METHOD_LABEL: Record<LoginMethod, string> = {
  rfid: 'RFID badge',
  nfc: 'NFC tag',
  qr: 'QR code',
  pin: 'PIN',
}

// ─── Resources ──────────────────────────────────────────────────

export type ResourceKind = 'tool' | 'mold' | 'fixture' | 'utility'
export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  tool: 'Tool',
  mold: 'Mold',
  fixture: 'Fixture',
  utility: 'Utility',
}
export const RESOURCE_KINDS: ResourceKind[] = ['tool', 'mold', 'fixture', 'utility']

export type ResourceStatus = 'available' | 'in_use' | 'maintenance' | 'retired'
export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  available: 'Available',
  in_use: 'In use',
  maintenance: 'Maintenance',
  retired: 'Retired',
}

/** Live state reported by Device Monitoring. */
export type MachineState = 'running' | 'idle' | 'setup' | 'down' | 'maintenance' | 'offline'
export const MACHINE_STATE_LABEL: Record<MachineState, string> = {
  running: 'Running',
  idle: 'Idle',
  setup: 'Setup',
  down: 'Down',
  maintenance: 'Maintenance',
  offline: 'Offline',
}

/** Availability reported by the CMMS. */
export type MaintenanceState = 'available' | 'planned' | 'in_maintenance' | 'unavailable'
export const MAINTENANCE_STATE_LABEL: Record<MaintenanceState, string> = {
  available: 'Available',
  planned: 'Maintenance planned',
  in_maintenance: 'In maintenance',
  unavailable: 'Unavailable',
}

export type MaintenanceKind = 'request' | 'planned' | 'corrective'
export const MAINTENANCE_KIND_LABEL: Record<MaintenanceKind, string> = {
  request: 'Work request',
  planned: 'Planned maintenance',
  corrective: 'Corrective',
}

export type MaintenanceStatus = 'requested' | 'scheduled' | 'in_progress' | 'completed'
export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
}

// ─── Product, material, PLM ─────────────────────────────────────

export type ItemKind = 'product' | 'material'

export type MaterialClass = 'raw' | 'consumable' | 'packaging' | 'semi_finished'
export const MATERIAL_CLASS_LABEL: Record<MaterialClass, string> = {
  raw: 'Raw material',
  consumable: 'Consumable',
  packaging: 'Packaging',
  semi_finished: 'Semi-finished',
}

export type RevisionState = 'draft' | 'review' | 'released' | 'obsolete'
export const REVISION_STATE_LABEL: Record<RevisionState, string> = {
  draft: 'Draft',
  review: 'In review',
  released: 'Released',
  obsolete: 'Obsolete',
}

export type EcoStatus = 'draft' | 'review' | 'approved' | 'released' | 'rejected'
export const ECO_STATUS_LABEL: Record<EcoStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  released: 'Released',
  rejected: 'Rejected',
}
export const ECO_STATUS_FLOW: EcoStatus[] = ['draft', 'review', 'approved', 'released']

export type EcoDecision = 'approved' | 'rejected'

export type SpecKind = 'product' | 'process' | 'quality'
export const SPEC_KIND_LABEL: Record<SpecKind, string> = {
  product: 'Product spec',
  process: 'Process spec',
  quality: 'Quality characteristic',
}

export type InstructionStepKind = 'text' | 'checklist' | 'image' | 'pdf' | 'video' | 'safety' | 'setup'
export const INSTRUCTION_STEP_LABEL: Record<InstructionStepKind, string> = {
  text: 'Instruction',
  checklist: 'Checklist',
  image: 'Image',
  pdf: 'PDF',
  video: 'Video',
  safety: 'Safety',
  setup: 'Machine setup',
}

// ─── Demand and fulfillment ─────────────────────────────────────

export type Priority = 'low' | 'normal' | 'high' | 'critical'
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
}
export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'critical']
export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 }

export type FulfillmentStrategy = 'mto' | 'mts' | 'hybrid'
export const STRATEGY_LABEL: Record<FulfillmentStrategy, string> = {
  mto: 'Make to order',
  mts: 'Make to stock',
  hybrid: 'Hybrid',
}
export const STRATEGY_SHORT: Record<FulfillmentStrategy, string> = {
  mto: 'MTO',
  mts: 'MTS',
  hybrid: 'Hybrid',
}

export type MarketingOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'fulfilling'
  | 'ready'
  | 'partially_delivered'
  | 'delivered'
  | 'closed'
  | 'on_hold'
  | 'cancelled'
export const MO_ORDER_STATUS_LABEL: Record<MarketingOrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  fulfilling: 'Fulfilling',
  ready: 'Ready',
  partially_delivered: 'Partially delivered',
  delivered: 'Delivered',
  closed: 'Closed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
}
export const MARKETING_ORDER_FLOW: MarketingOrderStatus[] = [
  'draft',
  'confirmed',
  'fulfilling',
  'ready',
  'delivered',
  'closed',
]
export const OPEN_MARKETING_ORDER_STATUSES: MarketingOrderStatus[] = [
  'draft',
  'confirmed',
  'fulfilling',
  'ready',
  'partially_delivered',
  'on_hold',
]

export type ItemFulfillmentStatus =
  'open' | 'allocated' | 'in_production' | 'ready' | 'delivered' | 'cancelled'
export const ITEM_FULFILLMENT_LABEL: Record<ItemFulfillmentStatus, string> = {
  open: 'Open',
  allocated: 'Allocated',
  in_production: 'In production',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export type DemandSource = 'customer' | 'replenishment' | 'forecast' | 'internal' | 'rework'
export const DEMAND_SOURCE_LABEL: Record<DemandSource, string> = {
  customer: 'Customer',
  replenishment: 'Replenishment',
  forecast: 'Forecast',
  internal: 'Internal',
  rework: 'Rework',
}

export type DemandStatus = 'open' | 'resolved' | 'fulfilled' | 'cancelled'
export const DEMAND_STATUS_LABEL: Record<DemandStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}

export type ReplenishmentStatus = 'proposed' | 'approved' | 'in_production' | 'received' | 'dismissed'
export const REPLENISHMENT_STATUS_LABEL: Record<ReplenishmentStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  in_production: 'In production',
  received: 'Received',
  dismissed: 'Dismissed',
}

// ─── Manufacturing execution ────────────────────────────────────

export type MoStatus =
  'draft' | 'planned' | 'released' | 'in_progress' | 'completed' | 'closed' | 'on_hold' | 'cancelled'
export const MO_STATUS_LABEL: Record<MoStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  released: 'Released',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
}
export const MO_STATUS_FLOW: MoStatus[] = [
  'draft',
  'planned',
  'released',
  'in_progress',
  'completed',
  'closed',
]
export const OPEN_MO_STATUSES: MoStatus[] = ['draft', 'planned', 'released', 'in_progress', 'on_hold']
export const RUNNING_MO_STATUSES: MoStatus[] = ['released', 'in_progress', 'on_hold']

export type MoSource = 'mto' | 'mts' | 'internal' | 'rework'
export const MO_SOURCE_LABEL: Record<MoSource, string> = {
  mto: 'Customer demand',
  mts: 'Replenishment',
  internal: 'Internal demand',
  rework: 'Rework',
}

export type WoStatus =
  'waiting' | 'ready' | 'assigned' | 'in_progress' | 'paused' | 'hold' | 'completed' | 'cancelled'
export const WO_STATUS_LABEL: Record<WoStatus, string> = {
  waiting: 'Waiting',
  ready: 'Ready',
  assigned: 'Assigned',
  in_progress: 'In progress',
  paused: 'Paused',
  hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
export const WO_STATUS_FLOW: WoStatus[] = ['waiting', 'ready', 'assigned', 'in_progress', 'completed']
export const OPEN_WO_STATUSES: WoStatus[] = ['waiting', 'ready', 'assigned', 'in_progress', 'paused', 'hold']
export const DISPATCHABLE_WO_STATUSES: WoStatus[] = ['ready', 'assigned', 'paused', 'hold']

export type WoEventKind =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'rescheduled'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'held'
  | 'released'
  | 'output'
  | 'reject'
  | 'rework'
  | 'scrap'
  | 'issue'
  | 'completed'
  | 'cancelled'
  | 'priority'
export const WO_EVENT_LABEL: Record<WoEventKind, string> = {
  created: 'Created',
  assigned: 'Assigned',
  reassigned: 'Reassigned',
  rescheduled: 'Rescheduled',
  started: 'Started',
  paused: 'Paused',
  resumed: 'Resumed',
  held: 'Put on hold',
  released: 'Hold released',
  output: 'Output recorded',
  reject: 'Reject recorded',
  rework: 'Rework recorded',
  scrap: 'Scrap recorded',
  issue: 'Issue reported',
  completed: 'Completed',
  cancelled: 'Cancelled',
  priority: 'Priority changed',
}

export type PauseReason = 'material' | 'machine' | 'quality' | 'operator' | 'changeover' | 'break' | 'other'
export const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  material: 'Waiting for material',
  machine: 'Machine issue',
  quality: 'Quality check',
  operator: 'Operator unavailable',
  changeover: 'Changeover',
  break: 'Shift break',
  other: 'Other',
}

/** A pre-release check on a manufacturing order. */
export type ValidationCheck =
  | 'product_release'
  | 'bom'
  | 'bor'
  | 'bop'
  | 'material'
  | 'machine'
  | 'work_center'
  | 'skills'
  | 'quality'
  | 'work_instruction'
  | 'schedule'
export const VALIDATION_LABEL: Record<ValidationCheck, string> = {
  product_release: 'Product revision released',
  bom: 'BOM released',
  bor: 'BOR released',
  bop: 'BOP released',
  material: 'Material available',
  machine: 'Machines eligible',
  work_center: 'Work centers active',
  skills: 'Required skills covered',
  quality: 'Quality specification defined',
  work_instruction: 'Work instructions attached',
  schedule: 'Schedule feasible',
}
export const VALIDATION_CHECKS: ValidationCheck[] = [
  'product_release',
  'bom',
  'bor',
  'bop',
  'material',
  'machine',
  'work_center',
  'skills',
  'quality',
  'work_instruction',
  'schedule',
]

// ─── Inventory and WIP ──────────────────────────────────────────

export type InventoryLocationKind =
  | 'warehouse'
  | 'staging'
  | 'floor'
  | 'line_buffer'
  | 'machine_buffer'
  | 'qc_hold'
  | 'rework'
  | 'transfer'
  | 'finished_goods'
  | 'return'
export const LOCATION_KIND_LABEL: Record<InventoryLocationKind, string> = {
  warehouse: 'Warehouse',
  staging: 'Production staging',
  floor: 'Floor stock',
  line_buffer: 'Line buffer',
  machine_buffer: 'Machine buffer',
  qc_hold: 'QC hold',
  rework: 'Rework area',
  transfer: 'Transfer area',
  finished_goods: 'Finished goods',
  return: 'Return location',
}

export type LotStatus = 'available' | 'reserved' | 'staged' | 'consumed' | 'hold' | 'returned'
export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  staged: 'Staged',
  consumed: 'Consumed',
  hold: 'On hold',
  returned: 'Returned',
}

export type MaterialTxnKind =
  'reserve' | 'stage' | 'issue' | 'consume' | 'return' | 'scrap' | 'receipt' | 'transfer'
export const MATERIAL_TXN_LABEL: Record<MaterialTxnKind, string> = {
  reserve: 'Reservation',
  stage: 'Staged',
  issue: 'Issued',
  consume: 'Consumed',
  return: 'Returned',
  scrap: 'Scrapped',
  receipt: 'Receipt',
  transfer: 'Transfer',
}

export type ConsumptionMode = 'manual' | 'scan' | 'automatic'
export const CONSUMPTION_MODE_LABEL: Record<ConsumptionMode, string> = {
  manual: 'Manual',
  scan: 'Scanned',
  automatic: 'Automatic',
}

export type RequirementStatus = 'shortage' | 'partial' | 'ready' | 'consumed'
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  shortage: 'Shortage',
  partial: 'Partial',
  ready: 'Ready',
  consumed: 'Consumed',
}

export type WipState =
  'waiting' | 'queued' | 'processing' | 'hold' | 'quality_hold' | 'rework' | 'completed' | 'scrapped'
export const WIP_STATE_LABEL: Record<WipState, string> = {
  waiting: 'Waiting',
  queued: 'Queued',
  processing: 'Processing',
  hold: 'On hold',
  quality_hold: 'Quality hold',
  rework: 'Rework',
  completed: 'Completed',
  scrapped: 'Scrapped',
}
export const ACTIVE_WIP_STATES: WipState[] = [
  'waiting',
  'queued',
  'processing',
  'hold',
  'quality_hold',
  'rework',
]

// ─── Quality ────────────────────────────────────────────────────

export type InspectionTrigger = 'start' | 'batch' | 'quantity' | 'time' | 'changeover' | 'end'
export const INSPECTION_TRIGGER_LABEL: Record<InspectionTrigger, string> = {
  start: 'Start of production',
  batch: 'Per batch',
  quantity: 'Per quantity',
  time: 'Timed',
  changeover: 'After changeover',
  end: 'End of production',
}

export type InspectionStatus = 'pending' | 'in_progress' | 'passed' | 'failed'
export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  passed: 'Passed',
  failed: 'Failed',
}

export type MeasurementType = 'numeric' | 'pass_fail' | 'checklist' | 'visual' | 'photo'
export const MEASUREMENT_TYPE_LABEL: Record<MeasurementType, string> = {
  numeric: 'Numeric',
  pass_fail: 'Pass / fail',
  checklist: 'Checklist',
  visual: 'Visual',
  photo: 'Photo evidence',
}

export type Disposition = 'accept' | 'rework' | 'scrap' | 'use_as_is' | 'hold' | 'return'
export const DISPOSITION_LABEL: Record<Disposition, string> = {
  accept: 'Accept',
  rework: 'Rework',
  scrap: 'Scrap',
  use_as_is: 'Use as is',
  hold: 'Hold',
  return: 'Return',
}
export const DISPOSITIONS: Disposition[] = ['accept', 'rework', 'scrap', 'use_as_is', 'hold', 'return']

export type Severity = 'minor' | 'major' | 'critical'
export const SEVERITY_LABEL: Record<Severity, string> = {
  minor: 'Minor',
  major: 'Major',
  critical: 'Critical',
}

export type HoldTarget = 'wip' | 'lot' | 'mo' | 'wo'
export const HOLD_TARGET_LABEL: Record<HoldTarget, string> = {
  wip: 'WIP',
  lot: 'Material lot',
  mo: 'Manufacturing order',
  wo: 'Work order',
}

export type HoldStatus = 'active' | 'released'

export type NcrStatus = 'open' | 'containment' | 'disposition' | 'closed'
export const NCR_STATUS_LABEL: Record<NcrStatus, string> = {
  open: 'Open',
  containment: 'Containment',
  disposition: 'Disposition',
  closed: 'Closed',
}

export type ReworkStatus = 'open' | 'in_progress' | 'inspection' | 'closed'
export const REWORK_STATUS_LABEL: Record<ReworkStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  inspection: 'Awaiting inspection',
  closed: 'Closed',
}

export type ReasonKind = 'scrap' | 'reject' | 'rework' | 'hold' | 'pause' | 'downtime' | 'change' | 'return'
export const REASON_KIND_LABEL: Record<ReasonKind, string> = {
  scrap: 'Scrap',
  reject: 'Reject',
  rework: 'Rework',
  hold: 'Hold',
  pause: 'Pause',
  downtime: 'Downtime',
  change: 'Engineering change',
  return: 'Material return',
}
export const REASON_KINDS: ReasonKind[] = [
  'scrap',
  'reject',
  'rework',
  'hold',
  'pause',
  'downtime',
  'change',
  'return',
]

// ─── Integration ────────────────────────────────────────────────

export type IntegrationSystem = 'device_monitoring' | 'oee' | 'cmms' | 'erp' | 'wms' | 'hris' | 'crm'
export const INTEGRATION_SYSTEM_LABEL: Record<IntegrationSystem, string> = {
  device_monitoring: 'Device Monitoring',
  oee: 'OEE',
  cmms: 'CMMS',
  erp: 'ERP',
  wms: 'WMS',
  hris: 'HRIS',
  crm: 'CRM',
}
export const INTEGRATION_SYSTEMS: IntegrationSystem[] = [
  'device_monitoring',
  'oee',
  'cmms',
  'erp',
  'wms',
  'hris',
  'crm',
]

export type IntegrationDirection = 'in' | 'out'
export type IntegrationStatus = 'ok' | 'error' | 'pending'

export type ConnectionState = 'connected' | 'degraded' | 'disconnected' | 'not_configured'
export const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
  connected: 'Connected',
  degraded: 'Degraded',
  disconnected: 'Disconnected',
  not_configured: 'Not configured',
}

/** Names of the events on the platform bus (blueprint section 14). */
export type EventType =
  | 'marketing_order.created'
  | 'marketing_order.confirmed'
  | 'marketing_order.delivered'
  | 'demand.created'
  | 'demand.allocated'
  | 'replenishment.created'
  | 'manufacturing_order.created'
  | 'manufacturing_order.planned'
  | 'manufacturing_order.released'
  | 'manufacturing_order.started'
  | 'manufacturing_order.held'
  | 'manufacturing_order.completed'
  | 'workorder.created'
  | 'workorder.assigned'
  | 'workorder.started'
  | 'workorder.paused'
  | 'workorder.resumed'
  | 'workorder.completed'
  | 'material.required'
  | 'material.reserved'
  | 'material.staged'
  | 'material.issued'
  | 'material.consumed'
  | 'material.returned'
  | 'wip.created'
  | 'wip.moved'
  | 'wip.held'
  | 'wip.released'
  | 'quality.check.requested'
  | 'quality.check.passed'
  | 'quality.check.failed'
  | 'product.rejected'
  | 'product.reworked'
  | 'product.scrapped'
  | 'machine.alarm.triggered'
  | 'machine.downtime.started'
  | 'machine.downtime.ended'
  | 'maintenance.requested'
  | 'maintenance.completed'
  | 'finished_goods.received'
  | 'eco.released'

export type IntervalUnit = 'day' | 'week' | 'month' | 'year'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
