import { type WoAssignment, fromInput, toDateTimeInput } from '@mes/fixtures'
import type { Priority, WorkOrder } from '@mes/types'
import { PRIORITIES, PRIORITY_LABEL } from '@mes/types'
import {
  type ActionMenuItem,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
  Textarea,
  cn,
  toast,
} from '@mes/ui'
import { ArrowLeftRight, CalendarClock, Check, CircleX, Flag, Pause, Play, UserPlus, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useAuth } from '../../auth/auth'
import {
  MachinePicker,
  OperatorsPicker,
  ReasonPicker,
  ResourcesPicker,
  ShiftPicker,
} from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { type ResourceCheck, assignmentBlockers, validateAssignment } from './wo-lib'

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void; wo: WorkOrder }

/** Check rows shared by the assignment dialog and the WO detail card. */
export function ResourceChecks({ checks, compact = false }: { checks: ResourceCheck[]; compact?: boolean }) {
  return (
    <ul className={cn('gap-1 grid grid-cols-1', !compact && 'sm:grid-cols-2')}>
      {checks.map((c) => (
        <li key={c.key} className="gap-2 rounded-xl px-3 py-2 text-xs flex items-start bg-surface-2">
          {c.ok ? (
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <X className={cn('mt-0.5 size-4 shrink-0', c.blocking ? 'text-accent' : 'text-warning')} />
          )}
          <span className="min-w-0">
            <span className="font-semibold block">{c.label}</span>
            <span className="block text-muted">{c.note}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Assign machine, operators, shift and tooling. `mode="move"` only changes the machine. */
export function AssignDialog({
  open,
  onOpenChange,
  wo,
  mode = 'assign',
}: DialogProps & { mode?: 'assign' | 'move' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <AssignForm wo={wo} mode={mode} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ wo, mode, onDone }: { wo: WorkOrder; mode: 'assign' | 'move'; onDone: () => void }) {
  const s = useScoped()
  const [machineId, setMachineId] = useState<string | null>(wo.machineId)
  const [operatorIds, setOperatorIds] = useState(wo.operatorIds)
  const [shiftId, setShiftId] = useState<string | null>(wo.shiftId)
  const [toolIds, setToolIds] = useState(wo.toolIds)
  const [moldIds, setMoldIds] = useState(wo.moldIds)
  const [tried, setTried] = useState(false)

  const draft: WoAssignment =
    mode === 'move' ? { machineId } : { machineId, operatorIds, shiftId, toolIds, moldIds }
  const checks = validateAssignment(s, wo, draft)
  const blockers = assignmentBlockers(checks)
  const missing = mode === 'move' ? !machineId : !machineId && operatorIds.length === 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (blockers.length || missing) return
    s.dispatch({ type: 'workOrders/assign', id: wo.id, assignment: draft })
    toast(
      mode === 'move'
        ? 'Machine changed'
        : wo.machineId || wo.operatorIds.length
          ? 'Assignment updated'
          : 'Work order assigned',
      { tone: 'success' },
    )
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>
          {mode === 'move' ? `Move ${wo.code} to another machine` : `Assign ${wo.code}`}
        </DialogTitle>
        <DialogDescription>
          {wo.operationSeq} · {wo.operationName} at {s.orgName(wo.workCenterId)}. Invalid assignments are
          blocked.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField
          label="Machine"
          required={mode === 'move'}
          className="sm:col-span-2"
          error={tried && missing ? 'Pick a machine or at least one operator.' : undefined}
        >
          <MachinePicker
            workCenterId={wo.workCenterId}
            value={machineId}
            onChange={setMachineId}
            clearable={mode !== 'move'}
          />
        </FormField>
        {mode === 'assign' && (
          <>
            <FormField label="Operators" className="sm:col-span-2">
              <OperatorsPicker
                workCenterId={wo.workCenterId}
                values={operatorIds}
                onChange={setOperatorIds}
              />
            </FormField>
            <FormField label="Shift">
              <ShiftPicker value={shiftId} onChange={setShiftId} clearable />
            </FormField>
            <FormField label="Tools">
              <ResourcesPicker kind="tool" values={toolIds} onChange={setToolIds} />
            </FormField>
            <FormField label="Molds" className="sm:col-span-2">
              <ResourcesPicker kind="mold" values={moldIds} onChange={setMoldIds} />
            </FormField>
          </>
        )}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Resource validation</p>
        <ResourceChecks checks={mode === 'move' ? checks.slice(0, 2) : checks} />
        {blockers.length > 0 && (
          <p className="mt-2 rounded-xl px-3 py-2 text-xs font-medium bg-accent-soft text-accent-strong">
            Invalid assignments are blocked: {blockers.map((b) => b.note).join('; ')}.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={blockers.length > 0}>
          {mode === 'move' ? 'Move machine' : 'Save assignment'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RescheduleDialog({ open, onOpenChange, wo }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <RescheduleForm wo={wo} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RescheduleForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const { dispatch } = useScoped()
  const [start, setStart] = useState(toDateTimeInput(wo.plannedStart))
  const [end, setEnd] = useState(toDateTimeInput(wo.plannedEnd))
  const [tried, setTried] = useState(false)
  const error = !start || !end || end <= start ? 'The planned finish has to be after the start.' : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    dispatch({
      type: 'workOrders/reschedule',
      id: wo.id,
      plannedStart: fromInput(start),
      plannedEnd: fromInput(end),
    })
    toast('Work order rescheduled', { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Reschedule {wo.code}</DialogTitle>
        <DialogDescription>Moves the planned window only. The order's plan stays as it is.</DialogDescription>
      </DialogHeader>
      <div className="gap-4 grid grid-cols-1">
        <FormField label="Planned start" required>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </FormField>
        <FormField label="Planned finish" required error={tried ? (error ?? undefined) : undefined}>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            invalid={tried && !!error}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save window</Button>
      </DialogFooter>
    </form>
  )
}

export function HoldDialog({ open, onOpenChange, wo }: DialogProps) {
  const { dispatch } = useScoped()
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Put ${wo.code} on hold?`}
      description="The operator station blocks the operation until the hold is released."
      confirmLabel="Put on hold"
      confirmDisabled={!reason}
      onConfirm={() => {
        dispatch({ type: 'workOrders/hold', id: wo.id, reasonCodeId: reason!, note })
        toast('Work order on hold', { tone: 'default' })
        onOpenChange(false)
      }}
    >
      <div className="space-y-3">
        <FormField label="Reason" required>
          <ReasonPicker kind="hold" value={reason} onChange={setReason} />
        </FormField>
        <FormField label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
        </FormField>
      </div>
    </ConfirmDialog>
  )
}

export function PriorityDialog({ open, onOpenChange, wo }: DialogProps) {
  const { dispatch } = useScoped()
  const [priority, setPriority] = useState<Priority>(wo.priority)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Change priority of ${wo.code}`}
      description="Critical work sorts first on every dispatch column."
      confirmLabel="Set priority"
      confirmDisabled={priority === wo.priority}
      onConfirm={() => {
        dispatch({ type: 'workOrders/setPriority', id: wo.id, priority })
        toast(`Priority set to ${PRIORITY_LABEL[priority].toLowerCase()}`, { tone: 'success' })
        onOpenChange(false)
      }}
    >
      <FormField label="Priority">
        <NativeSelect
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        />
      </FormField>
    </ConfirmDialog>
  )
}

export function CancelWoDialog({ open, onOpenChange, wo }: DialogProps) {
  const { dispatch } = useScoped()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel ${wo.code}?`}
      description="Output already recorded stays on the order for traceability."
      confirmLabel="Cancel work order"
      destructive
      onConfirm={() => {
        dispatch({ type: 'workOrders/cancel', id: wo.id })
        toast('Work order cancelled', { tone: 'default' })
        onOpenChange(false)
      }}
    />
  )
}

export type WoDialogKind = 'assign' | 'move' | 'reschedule' | 'hold' | 'priority' | 'cancel'

/**
 * One set of dispatcher dialogs for a page. `items(wo)` builds the overflow menu for a work order,
 * `open(kind, wo)` opens a dialog directly and `dialogs` mounts them once.
 */
export function useWoActions() {
  const s = useScoped()
  const { can } = useAuth()
  const [active, setActive] = useState<{ kind: WoDialogKind; wo: WorkOrder } | null>(null)
  const dispatchAllowed = can('wo.dispatch')
  const open = (kind: WoDialogKind, wo: WorkOrder) => setActive({ kind, wo })
  const close = (next: boolean) => {
    if (!next) setActive(null)
  }

  const releaseHold = (wo: WorkOrder) => {
    s.dispatch({ type: 'workOrders/releaseHold', id: wo.id })
    toast('Hold released', { tone: 'success' })
  }

  const items = (wo: WorkOrder): ActionMenuItem[] => {
    if (!dispatchAllowed) return []
    const closed = wo.status === 'completed' || wo.status === 'cancelled'
    if (closed) return []
    const assigned = !!wo.machineId || wo.operatorIds.length > 0
    return [
      {
        key: 'assign',
        label: assigned ? 'Reassign' : 'Assign',
        icon: <UserPlus />,
        onSelect: () => open('assign', wo),
      },
      { key: 'move', label: 'Move machine', icon: <ArrowLeftRight />, onSelect: () => open('move', wo) },
      {
        key: 'reschedule',
        label: 'Reschedule',
        icon: <CalendarClock />,
        onSelect: () => open('reschedule', wo),
      },
      wo.status === 'hold'
        ? { key: 'release', label: 'Release hold', icon: <Play />, onSelect: () => releaseHold(wo) }
        : { key: 'hold', label: 'Hold', icon: <Pause />, onSelect: () => open('hold', wo) },
      { key: 'priority', label: 'Change priority', icon: <Flag />, onSelect: () => open('priority', wo) },
      {
        key: 'cancel',
        label: 'Cancel',
        icon: <CircleX />,
        destructive: true,
        onSelect: () => open('cancel', wo),
      },
    ]
  }

  const wo = active ? (s.maps.wo.get(active.wo.id) ?? active.wo) : null
  const dialogs: ReactNode = wo && active && (
    <>
      <AssignDialog open={active.kind === 'assign'} onOpenChange={close} wo={wo} />
      <AssignDialog open={active.kind === 'move'} onOpenChange={close} wo={wo} mode="move" />
      <RescheduleDialog open={active.kind === 'reschedule'} onOpenChange={close} wo={wo} />
      <HoldDialog key={`hold-${wo.id}`} open={active.kind === 'hold'} onOpenChange={close} wo={wo} />
      <PriorityDialog
        key={`priority-${wo.id}-${wo.priority}`}
        open={active.kind === 'priority'}
        onOpenChange={close}
        wo={wo}
      />
      <CancelWoDialog open={active.kind === 'cancel'} onOpenChange={close} wo={wo} />
    </>
  )

  return { items, open, releaseHold, dialogs, dispatchAllowed }
}
