import {
  addDays,
  fmtDateTime,
  fmtDuration,
  fmtNumber,
  fromInput,
  startOfDay,
  toDateTimeInput,
  toIso,
  toMs,
} from '@mes/fixtures'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  cn,
  toast,
} from '@mes/ui'
import { CalendarClock, Check, Minus, Pencil, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { PriorityBadge, WoStatusBadge } from '../../components/badges'
import { MachineLink, MoLink, PersonChip, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { conflictsFor, constraintStatuses, durationMs, isMovable } from './lib'
import { ScheduleGantt } from './ScheduleGantt'
import { WorkOrderPlanningDialog } from './WorkOrderPlanningDialog'

const LIST = '/planning/schedule'
const GANTT_DAYS_AROUND = 2

export function ScheduleDetailPage() {
  const { woId = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const wo = s.maps.wo.get(woId)
  const [start, setStart] = useState(() => (wo ? toDateTimeInput(wo.plannedStart) : ''))
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const sequence = useMemo(
    () =>
      wo
        ? s.workOrders
            .filter((w) => w.moId === wo.moId && w.status !== 'cancelled')
            .sort((a, b) => a.operationSeq - b.operationSeq)
        : [],
    [s.workOrders, wo],
  )
  const machineWos = useMemo(
    () => (wo?.machineId ? s.workOrders.filter((w) => w.machineId === wo.machineId) : []),
    [s.workOrders, wo?.machineId],
  )

  if (!wo || wo.siteId !== s.siteId) {
    return (
      <Card>
        <EmptyState
          title="Work order not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback={LIST} />}
        />
      </Card>
    )
  }

  const canEdit = can('planning.manage') || can('wo.dispatch')
  const mo = s.maps.mo.get(wo.moId)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  const duration = durationMs(wo)
  const plannedStartMs = toMs(wo.plannedStart)
  const startMs = start ? toMs(fromInput(start)) : plannedStartMs
  const endMs = startMs + duration
  const conflicts = conflictsFor(wo, startMs, endMs, s.workOrders)
  const currentConflicts = conflictsFor(wo, plannedStartMs, toMs(wo.plannedEnd), s.workOrders)
  const changed = startMs !== plannedStartMs
  const movable = canEdit && isMovable(wo)
  const constraints = constraintStatuses(s, wo, now)
  const failing = constraints.filter((c) => c.ok === false).length
  const ganttFrom = addDays(startOfDay(plannedStartMs), -GANTT_DAYS_AROUND)
  const ganttDays = Array.from({ length: GANTT_DAYS_AROUND * 2 + 1 }, (_, i) => addDays(ganttFrom, i))

  const apply = () => {
    s.dispatch({
      type: 'workOrders/reschedule',
      id: wo.id,
      plannedStart: toIso(startMs),
      plannedEnd: toIso(endMs),
    })
    toast(`${wo.code} rescheduled`, {
      tone: 'success',
      description: `${fmtDateTime(startMs)} → ${fmtDateTime(endMs)}`,
    })
  }

  const remove = () => {
    s.dispatch({ type: 'workOrders/remove', id: wo.id })
    setDeleting(false)
    toast(`${wo.code} removed`, { tone: 'default' })
    navigate(LIST, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback={LIST} />
        <div className="gap-2 flex flex-wrap items-center">
          <Button asChild variant="outline">
            <Link to={paths.wo(wo.id)}>Work order</Link>
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{wo.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Operation {wo.operationSeq} · {wo.operationName}
            </h1>
            <p className="text-sm text-on-ink-muted">
              {mo ? `${mo.code} · ${s.productName(mo.productId)}` : 'Removed order'} ·{' '}
              {s.orgName(wo.workCenterId)}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <WoStatusBadge status={wo.status} />
            <PriorityBadge priority={wo.priority} />
            {currentConflicts.length > 0 && (
              <Badge variant="danger" dot>
                Machine conflict
              </Badge>
            )}
            {mo?.atRisk && (
              <Badge variant="accent" dot>
                Order at risk
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <Metric label="Planned start" value={fmtDateTime(wo.plannedStart)} />
          <Metric
            label="Planned end"
            value={fmtDateTime(wo.plannedEnd)}
            unit={fmtDuration(duration / 60_000)}
          />
          <Metric label="Machine" value={machine?.code ?? 'Unassigned'} unit={machine?.name} />
          <Metric
            label="Constraints"
            value={String(constraints.length - failing)}
            unit={`of ${constraints.length} met`}
          />
        </div>
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      <div className="gap-4 xl:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="gap-2 flex items-center">
                <CalendarClock className="size-4" /> What-if
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted">
              Move the start and check the machine before applying. Duration stays{' '}
              {fmtDuration(duration / 60_000)}.
            </p>
            <div className="mt-3 gap-3 sm:grid-cols-2 grid grid-cols-1">
              <FormField label="New start">
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={!movable}
                />
              </FormField>
              <FormField label="Resulting end">
                <Input value={fmtDateTime(endMs)} readOnly />
              </FormField>
            </div>
            <div className="mt-3">
              {!machine ? (
                <p className="text-xs text-muted">
                  No machine assigned, so there is nothing to collide with. Assign one with Edit or on the
                  dispatch board.
                </p>
              ) : conflicts.length === 0 ? (
                <Badge variant="success" dot>
                  No conflict on {machine.code}
                </Badge>
              ) : (
                <div className="space-y-1.5">
                  <Badge variant="danger" dot>
                    {conflicts.length} conflicting work order{conflicts.length > 1 ? 's' : ''}
                  </Badge>
                  {conflicts.map((c) => (
                    <p key={c.id} className="text-xs">
                      <Link
                        to={paths.schedule(c.id)}
                        className="font-medium font-mono hover:text-accent hover:underline"
                      >
                        {c.code}
                      </Link>{' '}
                      <span className="text-muted">
                        {fmtDateTime(c.plannedStart)} → {fmtDateTime(c.plannedEnd)}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            {!movable && canEdit && (
              <p className="mt-3 text-xs text-muted">
                Started work cannot be moved from the schedule. Pause or complete it on the station first.
              </p>
            )}
            {movable && (
              <div className="mt-4 gap-2 flex flex-wrap justify-end">
                <Button
                  variant="outline"
                  disabled={!changed}
                  onClick={() => setStart(toDateTimeInput(wo.plannedStart))}
                >
                  Reset
                </Button>
                <Button onClick={apply} disabled={!changed}>
                  Apply new start
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Constraints</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="gap-1.5 sm:grid-cols-2 grid grid-cols-1">
              {constraints.map((c) => (
                <li key={c.key} className="gap-2 rounded-xl px-3 py-2 text-xs flex items-start bg-surface-2">
                  <span
                    className={cn(
                      'mt-0.5 size-4 [&_svg]:size-3 flex shrink-0 items-center justify-center rounded-full',
                      c.ok === null
                        ? 'bg-surface text-muted'
                        : c.ok
                          ? 'bg-success-soft text-success'
                          : 'bg-danger-soft text-accent',
                    )}
                  >
                    {c.ok === null ? <Minus /> : c.ok ? <Check /> : <X />}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold block">{c.label}</span>
                    <span className="block text-muted">{c.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to={LIST}>Full schedule</Link>
            </Button>
          }
        >
          <CardTitle>{machine ? `${machine.code} around this work order` : 'Machine timeline'}</CardTitle>
        </CardHeader>
        <CardContent>
          {machine ? (
            <ScheduleGantt
              machines={[machine]}
              workOrders={machineWos}
              days={ganttDays}
              from={ganttFrom}
              now={now}
              selectedId={wo.id}
              canEdit={canEdit}
              onSelect={(id) => {
                if (id !== wo.id) navigate(paths.schedule(id))
              }}
              onMove={(m) => {
                s.dispatch({ type: 'workOrders/reschedule', ...m })
                toast(`${s.maps.wo.get(m.id)?.code ?? 'Work order'} moved`, { tone: 'success' })
              }}
            />
          ) : (
            <EmptyState
              compact
              title="No machine assigned"
              description="The timeline shows the machine's other work orders once one is assigned."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Output</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValue
            bare
            items={[
              {
                label: 'What',
                value: mo
                  ? `${s.productName(mo.productId)} · ${wo.operationName} · ${fmtNumber(wo.targetQty)} ${s.uomCode(mo.uomId)}`
                  : wo.operationName,
              },
              { label: 'Order', value: <MoLink moId={wo.moId} /> },
              {
                label: 'Where',
                value: (
                  <span className="gap-2 flex flex-wrap items-center">
                    {s.orgName(wo.workCenterId)} · <MachineLink machineId={wo.machineId} />
                  </span>
                ),
              },
              {
                label: 'When',
                value: `${fmtDateTime(wo.plannedStart)} → ${fmtDateTime(wo.plannedEnd)}`,
              },
              {
                label: 'Actual',
                value: wo.actualStart
                  ? `${fmtDateTime(wo.actualStart)} → ${wo.actualEnd ? fmtDateTime(wo.actualEnd) : 'running'}`
                  : 'Not started',
              },
              {
                label: 'Who',
                value: wo.operatorIds.length ? (
                  <span className="gap-3 flex flex-wrap">
                    {wo.operatorIds.map((id) => (
                      <PersonChip key={id} personId={id} />
                    ))}
                  </span>
                ) : (
                  'Unassigned'
                ),
              },
              {
                label: 'Shift',
                value: wo.shiftId ? (s.maps.shift.get(wo.shiftId)?.name ?? 'Unknown') : 'Not set',
              },
              { label: 'Quantity', value: `${fmtNumber(wo.goodQty)} good of ${fmtNumber(wo.targetQty)}` },
              {
                label: 'Sequence',
                value: (
                  <span className="gap-1.5 flex flex-wrap items-center">
                    {sequence.map((w) => (
                      <span
                        key={w.id}
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          w.id === wo.id ? 'bg-ink text-on-ink' : 'bg-surface-2',
                        )}
                      >
                        {w.operationSeq}{' '}
                        {w.id === wo.id ? (
                          <span className="font-medium font-mono">{w.code}</span>
                        ) : (
                          <Link
                            to={paths.schedule(w.id)}
                            className="font-medium font-mono hover:text-accent hover:underline"
                          >
                            {w.code}
                          </Link>
                        )}
                      </span>
                    ))}
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <WorkOrderPlanningDialog
        open={editing}
        onOpenChange={setEditing}
        wo={wo}
        onSaved={(saved) => {
          setStart(toDateTimeInput(saved.plannedStart))
          toast('Planning updated', { tone: 'success' })
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${wo.code}?`}
        description={
          wo.actualStart
            ? 'This work order has already started on the station, so it cannot be deleted. Cancel it from the work order page instead.'
            : 'The work order leaves the schedule, the dispatch board and its manufacturing order. This cannot be undone.'
        }
        confirmLabel="Delete work order"
        destructive
        confirmDisabled={!!wo.actualStart}
        onConfirm={remove}
      />
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-lg font-bold leading-tight tracking-tight truncate tabular-nums">{value}</p>
      {unit && <p className="text-xs font-semibold truncate text-on-ink-muted">{unit}</p>}
    </div>
  )
}
