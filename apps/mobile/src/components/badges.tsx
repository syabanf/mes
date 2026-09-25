import type {
  Disposition,
  InspectionStatus,
  MachineState,
  MaintenanceState,
  RequirementStatus,
  WoStatus,
} from '@mes/types'
import {
  DISPOSITION_LABEL,
  INSPECTION_STATUS_LABEL,
  MACHINE_STATE_LABEL,
  MAINTENANCE_STATE_LABEL,
  REQUIREMENT_STATUS_LABEL,
  WO_STATUS_LABEL,
} from '@mes/types'
import { Badge, type BadgeProps, StatusDot, type Tone, cn } from '@mes/ui'
import { WO_TONE } from '../lib/wo'

type Variant = NonNullable<BadgeProps['variant']>

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-muted',
  danger: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  ink: 'text-foreground',
  accent: 'text-accent',
}

/** Small status line on a card: a dot and a short label, in the tone of the status. */
export function StatusText({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'gap-1.5 font-semibold flex shrink-0 items-center text-[11px]',
        TONE_TEXT[tone],
        className,
      )}
    >
      <StatusDot tone={tone} pulse={tone === 'accent'} className="size-1.5" />
      {label}
    </span>
  )
}

export function WoStatusText({ status, className }: { status: WoStatus; className?: string }) {
  return <StatusText tone={WO_TONE[status]} label={WO_STATUS_LABEL[status]} className={className} />
}

const WO_VARIANT: Record<WoStatus, Variant> = {
  waiting: 'muted',
  ready: 'default',
  assigned: 'ink',
  in_progress: 'accent',
  paused: 'warning',
  hold: 'danger',
  completed: 'success',
  cancelled: 'muted',
}
export function WoStatusBadge({ status, onInk = false }: { status: WoStatus; onInk?: boolean }) {
  return (
    <Badge
      variant={WO_VARIANT[status]}
      dot={status === 'in_progress' || status === 'paused'}
      className={cn(onInk && WO_VARIANT[status] !== 'accent' && 'bg-white/10 text-white')}
    >
      {WO_STATUS_LABEL[status]}
    </Badge>
  )
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
export const INSPECTION_TONE: Record<InspectionStatus, Tone> = {
  pending: 'warning',
  in_progress: 'info',
  passed: 'success',
  failed: 'danger',
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
  if (!disposition) return <Badge variant="outline">No disposition</Badge>
  return <Badge variant={DISPOSITION_VARIANT[disposition]}>{DISPOSITION_LABEL[disposition]}</Badge>
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
