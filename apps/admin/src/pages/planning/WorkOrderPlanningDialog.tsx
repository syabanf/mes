import { fmtDateTime, fromInput, toDateTimeInput, toMs } from '@mes/fixtures'
import type { Priority, WorkOrder } from '@mes/types'
import { PRIORITIES, PRIORITY_LABEL } from '@mes/types'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { WoLink } from '../../components/links'
import { MachinePicker, ShiftPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { conflictsFor } from './lib'

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))

/** Edits the planning fields of a work order: window, machine, priority and shift. */
export function WorkOrderPlanningDialog({
  open,
  onOpenChange,
  wo,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wo: WorkOrder
  onSaved?: (wo: WorkOrder) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <PlanningForm
            wo={wo}
            onDone={(saved) => {
              onOpenChange(false)
              if (saved) onSaved?.(saved)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PlanningForm({ wo, onDone }: { wo: WorkOrder; onDone: (saved: WorkOrder | null) => void }) {
  const s = useScoped()
  const [start, setStart] = useState(toDateTimeInput(wo.plannedStart))
  const [end, setEnd] = useState(toDateTimeInput(wo.plannedEnd))
  const [machineId, setMachineId] = useState<string | null>(wo.machineId)
  const [priority, setPriority] = useState<Priority>(wo.priority)
  const [shiftId, setShiftId] = useState<string | null>(wo.shiftId)
  const [tried, setTried] = useState(false)

  const errors = {
    window: !start || !end || end <= start ? 'The planned end has to be after the start.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)
  const conflicts =
    start && end && end > start
      ? conflictsFor({ ...wo, machineId }, toMs(fromInput(start)), toMs(fromInput(end)), s.workOrders)
      : []

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const item: WorkOrder = {
      ...wo,
      plannedStart: fromInput(start),
      plannedEnd: fromInput(end),
      machineId,
      priority,
      shiftId,
    }
    s.dispatch({ type: 'workOrders/upsert', item })
    onDone(item)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit {wo.code}</DialogTitle>
        <DialogDescription>
          Planning fields only. Operators, tools and output stay as the dispatch board and the station set
          them.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Planned start" required>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </FormField>
        <FormField label="Planned end" required error={show(errors.window)}>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            invalid={!!show(errors.window)}
          />
        </FormField>
        <FormField
          label="Machine"
          hint={`Machines on ${s.orgName(wo.workCenterId)}`}
          className="sm:col-span-2"
        >
          <MachinePicker workCenterId={wo.workCenterId} value={machineId} onChange={setMachineId} clearable />
          {machineId && (
            <div className="mt-2 space-y-1">
              {conflicts.length === 0 ? (
                <Badge variant="success" dot>
                  No conflict on {s.maps.machine.get(machineId)?.code}
                </Badge>
              ) : (
                <>
                  <Badge variant="danger" dot>
                    {conflicts.length} conflicting work order{conflicts.length > 1 ? 's' : ''}
                  </Badge>
                  {conflicts.map((c) => (
                    <p key={c.id} className="text-xs">
                      <WoLink woId={c.id} />{' '}
                      <span className="text-muted">
                        {fmtDateTime(c.plannedStart)} → {fmtDateTime(c.plannedEnd)}
                      </span>
                    </p>
                  ))}
                </>
              )}
            </div>
          )}
        </FormField>
        <FormField label="Priority">
          <NativeSelect
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
        </FormField>
        <FormField label="Shift">
          <ShiftPicker value={shiftId} onChange={setShiftId} clearable />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">Save changes</Button>
      </DialogFooter>
    </form>
  )
}
