import type { Readiness } from '@mes/fixtures'
import type {
  ConnectionState,
  DemandStatus,
  Disposition,
  EcoStatus,
  FulfillmentStrategy,
  InspectionStatus,
  ItemFulfillmentStatus,
  LotStatus,
  MachineState,
  MaintenanceState,
  MarketingOrderStatus,
  MoStatus,
  NcrStatus,
  Priority,
  ReplenishmentStatus,
  RequirementStatus,
  RevisionState,
  ReworkStatus,
  Severity,
  WipState,
  WoStatus,
} from '@mes/types'
import {
  CONNECTION_STATE_LABEL,
  DEMAND_STATUS_LABEL,
  DISPOSITION_LABEL,
  ECO_STATUS_LABEL,
  INSPECTION_STATUS_LABEL,
  ITEM_FULFILLMENT_LABEL,
  LOT_STATUS_LABEL,
  MACHINE_STATE_LABEL,
  MAINTENANCE_STATE_LABEL,
  MO_ORDER_STATUS_LABEL,
  MO_STATUS_LABEL,
  NCR_STATUS_LABEL,
  PRIORITY_LABEL,
  REPLENISHMENT_STATUS_LABEL,
  REQUIREMENT_STATUS_LABEL,
  REVISION_STATE_LABEL,
  REWORK_STATUS_LABEL,
  SEVERITY_LABEL,
  STRATEGY_SHORT,
  WIP_STATE_LABEL,
  WO_STATUS_LABEL,
} from '@mes/types'
import { Badge, type BadgeProps } from '@mes/ui'

type Variant = NonNullable<BadgeProps['variant']>

const MO_STATUS_VARIANT: Record<MoStatus, Variant> = {
  draft: 'outline',
  planned: 'default',
  released: 'ink',
  in_progress: 'info',
  completed: 'success',
  closed: 'muted',
  on_hold: 'warning',
  cancelled: 'muted',
}
export function MoStatusBadge({ status }: { status: MoStatus }) {
  return (
    <Badge variant={MO_STATUS_VARIANT[status]} dot={status === 'in_progress' || status === 'on_hold'}>
      {MO_STATUS_LABEL[status]}
    </Badge>
  )
}

const WO_STATUS_VARIANT: Record<WoStatus, Variant> = {
  waiting: 'muted',
  ready: 'default',
  assigned: 'ink',
  in_progress: 'info',
  paused: 'warning',
  hold: 'danger',
  completed: 'success',
  cancelled: 'muted',
}
export function WoStatusBadge({ status }: { status: WoStatus }) {
  return (
    <Badge variant={WO_STATUS_VARIANT[status]} dot={status === 'in_progress' || status === 'paused'}>
      {WO_STATUS_LABEL[status]}
    </Badge>
  )
}

const PRIORITY_VARIANT: Record<Priority, Variant> = {
  critical: 'accent',
  high: 'danger',
  normal: 'default',
  low: 'muted',
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>
}

const ORDER_STATUS_VARIANT: Record<MarketingOrderStatus, Variant> = {
  draft: 'outline',
  confirmed: 'ink',
  fulfilling: 'info',
  ready: 'success',
  partially_delivered: 'warning',
  delivered: 'success',
  closed: 'muted',
  on_hold: 'warning',
  cancelled: 'muted',
}
export function OrderStatusBadge({ status }: { status: MarketingOrderStatus }) {
  return <Badge variant={ORDER_STATUS_VARIANT[status]}>{MO_ORDER_STATUS_LABEL[status]}</Badge>
}

const ITEM_STATUS_VARIANT: Record<ItemFulfillmentStatus, Variant> = {
  open: 'outline',
  allocated: 'info',
  in_production: 'ink',
  ready: 'success',
  delivered: 'muted',
  cancelled: 'muted',
}
export function ItemStatusBadge({ status }: { status: ItemFulfillmentStatus }) {
  return <Badge variant={ITEM_STATUS_VARIANT[status]}>{ITEM_FULFILLMENT_LABEL[status]}</Badge>
}

const STRATEGY_VARIANT: Record<FulfillmentStrategy, Variant> = { mto: 'ink', mts: 'info', hybrid: 'warning' }
export function StrategyBadge({ strategy }: { strategy: FulfillmentStrategy }) {
  return <Badge variant={STRATEGY_VARIANT[strategy]}>{STRATEGY_SHORT[strategy]}</Badge>
}

const DEMAND_VARIANT: Record<DemandStatus, Variant> = {
  open: 'accent',
  resolved: 'info',
  fulfilled: 'success',
  cancelled: 'muted',
}
export function DemandStatusBadge({ status }: { status: DemandStatus }) {
  return <Badge variant={DEMAND_VARIANT[status]}>{DEMAND_STATUS_LABEL[status]}</Badge>
}

const REPLENISHMENT_VARIANT: Record<ReplenishmentStatus, Variant> = {
  proposed: 'warning',
  approved: 'ink',
  in_production: 'info',
  received: 'success',
  dismissed: 'muted',
}
export function ReplenishmentStatusBadge({ status }: { status: ReplenishmentStatus }) {
  return <Badge variant={REPLENISHMENT_VARIANT[status]}>{REPLENISHMENT_STATUS_LABEL[status]}</Badge>
}

const REVISION_VARIANT: Record<RevisionState, Variant> = {
  draft: 'outline',
  review: 'warning',
  released: 'success',
  obsolete: 'muted',
}
export function RevisionBadge({ state }: { state: RevisionState }) {
  return <Badge variant={REVISION_VARIANT[state]}>{REVISION_STATE_LABEL[state]}</Badge>
}

const ECO_VARIANT: Record<EcoStatus, Variant> = {
  draft: 'outline',
  review: 'warning',
  approved: 'info',
  released: 'success',
  rejected: 'danger',
}
export function EcoStatusBadge({ status }: { status: EcoStatus }) {
  return <Badge variant={ECO_VARIANT[status]}>{ECO_STATUS_LABEL[status]}</Badge>
}

const WIP_VARIANT: Record<WipState, Variant> = {
  waiting: 'muted',
  queued: 'default',
  processing: 'info',
  hold: 'warning',
  quality_hold: 'danger',
  rework: 'warning',
  completed: 'success',
  scrapped: 'muted',
}
export function WipStateBadge({ state }: { state: WipState }) {
  return (
    <Badge variant={WIP_VARIANT[state]} dot={state === 'processing' || state === 'quality_hold'}>
      {WIP_STATE_LABEL[state]}
    </Badge>
  )
}

const REQUIREMENT_VARIANT: Record<RequirementStatus, Variant> = {
  shortage: 'danger',
  partial: 'warning',
  ready: 'success',
  consumed: 'muted',
}
export function RequirementBadge({ status }: { status: RequirementStatus }) {
  return (
    <Badge variant={REQUIREMENT_VARIANT[status]} dot>
      {REQUIREMENT_STATUS_LABEL[status]}
    </Badge>
  )
}

const READINESS_VARIANT: Record<Readiness, Variant> = {
  ready: 'success',
  partial: 'warning',
  shortage: 'danger',
}
const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready',
  partial: 'Partial',
  shortage: 'Shortage',
}
export function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  return (
    <Badge variant={READINESS_VARIANT[readiness]} dot>
      {READINESS_LABEL[readiness]}
    </Badge>
  )
}

const LOT_VARIANT: Record<LotStatus, Variant> = {
  available: 'success',
  reserved: 'info',
  staged: 'ink',
  consumed: 'muted',
  hold: 'danger',
  returned: 'warning',
}
export function LotStatusBadge({ status }: { status: LotStatus }) {
  return <Badge variant={LOT_VARIANT[status]}>{LOT_STATUS_LABEL[status]}</Badge>
}

const INSPECTION_VARIANT: Record<InspectionStatus, Variant> = {
  pending: 'warning',
  in_progress: 'info',
  passed: 'success',
  failed: 'danger',
}
export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  return (
    <Badge variant={INSPECTION_VARIANT[status]} dot={status === 'in_progress'}>
      {INSPECTION_STATUS_LABEL[status]}
    </Badge>
  )
}

const DISPOSITION_VARIANT: Record<Disposition, Variant> = {
  accept: 'success',
  rework: 'warning',
  scrap: 'danger',
  use_as_is: 'info',
  hold: 'danger',
  return: 'muted',
}
export function DispositionBadge({ disposition }: { disposition: Disposition | null }) {
  if (!disposition) return <Badge variant="outline">Pending</Badge>
  return <Badge variant={DISPOSITION_VARIANT[disposition]}>{DISPOSITION_LABEL[disposition]}</Badge>
}

const SEVERITY_VARIANT: Record<Severity, Variant> = { critical: 'accent', major: 'danger', minor: 'warning' }
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={SEVERITY_VARIANT[severity]} dot>
      {SEVERITY_LABEL[severity]}
    </Badge>
  )
}

const NCR_VARIANT: Record<NcrStatus, Variant> = {
  open: 'accent',
  containment: 'warning',
  disposition: 'info',
  closed: 'muted',
}
export function NcrStatusBadge({ status }: { status: NcrStatus }) {
  return <Badge variant={NCR_VARIANT[status]}>{NCR_STATUS_LABEL[status]}</Badge>
}

const REWORK_VARIANT: Record<ReworkStatus, Variant> = {
  open: 'warning',
  in_progress: 'info',
  inspection: 'ink',
  closed: 'muted',
}
export function ReworkStatusBadge({ status }: { status: ReworkStatus }) {
  return <Badge variant={REWORK_VARIANT[status]}>{REWORK_STATUS_LABEL[status]}</Badge>
}

const MACHINE_VARIANT: Record<MachineState, Variant> = {
  running: 'success',
  idle: 'default',
  setup: 'info',
  down: 'accent',
  maintenance: 'warning',
  offline: 'muted',
}
export function MachineStateBadge({ state }: { state: MachineState }) {
  return (
    <Badge variant={MACHINE_VARIANT[state]} dot>
      {MACHINE_STATE_LABEL[state]}
    </Badge>
  )
}

const MAINTENANCE_VARIANT: Record<MaintenanceState, Variant> = {
  available: 'success',
  planned: 'info',
  in_maintenance: 'warning',
  unavailable: 'danger',
}
export function MaintenanceStateBadge({ state }: { state: MaintenanceState }) {
  return <Badge variant={MAINTENANCE_VARIANT[state]}>{MAINTENANCE_STATE_LABEL[state]}</Badge>
}

const CONNECTION_VARIANT: Record<ConnectionState, Variant> = {
  connected: 'success',
  degraded: 'warning',
  disconnected: 'danger',
  not_configured: 'muted',
}
export function ConnectionBadge({ state }: { state: ConnectionState }) {
  return (
    <Badge variant={CONNECTION_VARIANT[state]} dot={state !== 'not_configured'}>
      {CONNECTION_STATE_LABEL[state]}
    </Badge>
  )
}
