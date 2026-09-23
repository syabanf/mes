import {
  capacityByWorkCenter,
  fmtDateShort,
  fmtDateTime,
  fmtNumber,
  fmtPercent,
  fmtWeekday,
  toMs,
} from '@mes/fixtures'
import { MAINTENANCE_STATUS_LABEL } from '@mes/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ColumnChart,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  PillTabs,
  toast,
} from '@mes/ui'
import { Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { MachineStateBadge, MaintenanceStateBadge, WoStatusBadge } from '../../components/badges'
import { MoLink, WoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import {
  type CapacityWindow,
  capacityWindow,
  inWindow,
  isOpenWo,
  parseCapacityWindow,
  requiredHoursPerDay,
} from './lib'
import { WorkCenterDialog } from './WorkCenterDialog'

const LIST = '/planning/capacity'

export function CapacityDetailPage() {
  const { workCenterId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const window = parseCapacityWindow(params.get('window'))
  const range = capacityWindow(window, now)
  const wc = s.maps.orgNode.get(workCenterId)
  const row = useMemo(
    () =>
      capacityByWorkCenter(s.state, s.siteId, range.from, range.to).find(
        (r) => r.workCenterId === workCenterId,
      ),
    [s.state, s.siteId, range.from, range.to, workCenterId],
  )
  const wos = useMemo(
    () =>
      s.workOrders
        .filter((w) => w.workCenterId === workCenterId && isOpenWo(w) && inWindow(w, range.from, range.to))
        .sort((a, b) => toMs(a.plannedStart) - toMs(b.plannedStart)),
    [s.workOrders, workCenterId, range.from, range.to],
  )
  const machines = s.machines.filter((m) => m.workCenterId === workCenterId && m.active)
  const referencingWos = s.workOrders.filter((w) => w.workCenterId === workCenterId).length

  if (!wc || wc.kind !== 'work_center' || !row) {
    return (
      <Card>
        <EmptyState
          title="Work center not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback={LIST} />}
        />
      </Card>
    )
  }

  const manage = can('masterdata.manage') || can('planning.manage')
  const inMaintenance = machines.filter(
    (m) => m.maintenanceState === 'in_maintenance' || m.maintenanceState === 'unavailable',
  )
  const nonWorking = s.calendarDays.filter((d) => {
    const ms = toMs(`${d.date}T00:00:00+07:00`)
    return !d.working && ms >= range.from && ms < range.to
  })
  const operators = s.operators.filter((o) => o.workCenterIds.length === 0 || o.workCenterIds.includes(wc.id))
  const onLeave = operators.filter((o) => o.availability === 'leave')
  const tools = s.resources.filter((r) => r.workCenterId === wc.id && r.status !== 'retired')
  const toolsDown = tools.filter((r) => r.status === 'maintenance')
  const planned = s.maintenanceRecords.filter(
    (r) => machines.some((m) => m.id === r.machineId) && r.status !== 'completed',
  )
  const perDay = requiredHoursPerDay(wos, range.from, range.to)
  const dailyCapacity = row.availableHours / Math.max(1, perDay.length)
  const deleteBlocked =
    machines.length > 0
      ? `${machines.length} machines still belong to it`
      : referencingWos > 0
        ? `${referencingWos} work orders reference it`
        : null

  const setWindow = (v: string) =>
    setParams(
      (p) => {
        p.set('window', v)
        return p
      },
      { replace: true },
    )

  const remove = () => {
    s.dispatch({ type: 'orgNodes/remove', id: wc.id })
    setDeleting(false)
    toast(`${wc.code} removed`, { tone: 'default' })
    navigate(LIST, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback={LIST} />
        <div className="gap-2 flex flex-wrap items-center">
          <PillTabs
            value={window}
            onValueChange={(v) => setWindow(v as CapacityWindow)}
            items={[
              { value: 'this', label: 'This week' },
              { value: 'next', label: 'Next week' },
              { value: 'four', label: '4 weeks' },
            ]}
          />
          {manage && (
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
            <p className="text-xs font-mono text-on-ink-muted">{wc.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{wc.name}</h1>
            <p className="text-sm text-on-ink-muted">
              {s.orgPath(wc.parentId) || 'No parent line'} · {range.label}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            {row.load > 1 ? (
              <Badge variant="danger" dot>
                Conflict
              </Badge>
            ) : (
              <Badge variant={row.load > 0.85 ? 'warning' : 'success'} dot>
                {row.load > 0.85 ? 'Near capacity' : 'Within capacity'}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <Metric label="Load" value={fmtPercent(row.load)} accent={row.load > 1} />
          <Metric label="Required" value={fmtNumber(row.requiredHours, 1)} unit="h" />
          <Metric label="Available" value={fmtNumber(row.availableHours, 1)} unit="h" />
          <Metric
            label="Machines"
            value={String(machines.length - inMaintenance.length)}
            unit={`of ${machines.length} available`}
          />
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-xs flex items-center justify-between text-on-ink-muted">
            <span>{wos.length} open work orders in the window</span>
            <span>{fmtPercent(Math.min(1, row.load))} of capacity</span>
          </div>
          <div className="h-1.5 bg-white/15 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${row.load > 1 ? 'bg-accent' : 'bg-white'}`}
              style={{ width: `${Math.round(Math.min(1, row.load) * 100)}%` }}
            />
          </div>
        </div>
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required hours per day</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnChart
            data={perDay.map((d) => ({
              label: `${fmtWeekday(d.day)} ${fmtDateShort(d.day)}`,
              value: Math.round(d.hours * 10) / 10,
              highlight: d.hours > dailyCapacity,
            }))}
            format={(v) => `${fmtNumber(v, 1)} h`}
            referenceLine={{ value: Math.round(dailyCapacity * 10) / 10, label: 'Daily capacity' }}
            ariaLabel={`Required hours per day on ${wc.name}`}
          />
        </CardContent>
      </Card>

      <div className="gap-4 xl:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/planning/schedule">Schedule</Link>
              </Button>
            }
          >
            <CardTitle>Work orders in the window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wos.length === 0 ? (
              <EmptyState
                compact
                title="No work orders"
                description="Nothing open is planned on this work center in the window."
              />
            ) : (
              wos.map((w) => (
                <div key={w.id} className="rounded-2xl p-3 bg-surface-2">
                  <div className="gap-2 flex flex-wrap items-center justify-between">
                    <span className="gap-2 flex items-center">
                      <WoLink woId={w.id} />
                      <span className="text-xs text-muted">
                        op {w.operationSeq} · {w.operationName}
                      </span>
                    </span>
                    <WoStatusBadge status={w.status} />
                  </div>
                  <div className="mt-2 gap-2 text-xs flex flex-wrap items-center justify-between text-muted">
                    <MoLink moId={w.moId} />
                    <span>
                      {fmtDateTime(w.plannedStart)} → {fmtDateTime(w.plannedEnd)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {w.machineId
                      ? (s.maps.machine.get(w.machineId)?.code ?? 'Unknown machine')
                      : 'No machine'}
                    {' · '}
                    <Link to={paths.schedule(w.id)} className="hover:text-accent hover:underline">
                      Open in schedule
                    </Link>
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              labelWidth="lg"
              items={[
                {
                  label: 'Shifts',
                  value: s.shifts.length
                    ? s.shifts.map((sh) => `${sh.name} ${sh.start}–${sh.end}`).join(', ')
                    : 'No shifts defined',
                },
                {
                  label: 'Capacity per shift',
                  value: wc.capacityHoursPerShift
                    ? `${wc.capacityHoursPerShift} h`
                    : 'Derived from shift length',
                },
                {
                  label: 'Calendar',
                  value: nonWorking.length
                    ? `${nonWorking.length} non-working days: ${nonWorking.map((d) => fmtDateShort(toMs(`${d.date}T00:00:00+07:00`))).join(', ')}`
                    : 'No non-working days in the window',
                },
                {
                  label: 'Machines',
                  value: `${machines.length - inMaintenance.length} of ${machines.length} available${inMaintenance.length ? ` · ${inMaintenance.map((m) => m.code).join(', ')} in maintenance` : ''}`,
                },
                {
                  label: 'CMMS availability',
                  value: planned.length
                    ? planned
                        .map(
                          (r) =>
                            `${r.code} ${fmtDateShort(r.plannedStart)} (${MAINTENANCE_STATUS_LABEL[r.status]})`,
                        )
                        .join(', ')
                    : 'No open maintenance',
                },
                {
                  label: 'Operators',
                  value: `${operators.length - onLeave.length} of ${operators.length} available${onLeave.length ? ` · ${onLeave.map((o) => o.name).join(', ')} on leave` : ''}`,
                },
                {
                  label: 'Tools and molds',
                  value: tools.length
                    ? `${tools.length - toolsDown.length} of ${tools.length} available${toolsDown.length ? ` · ${toolsDown.map((t) => t.code).join(', ')} in maintenance` : ''}`
                    : 'None assigned to this work center',
                },
                { label: 'As of', value: fmtDateTime(now) },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/planning/resource-load">Resource load</Link>
            </Button>
          }
        >
          <CardTitle>Machines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {machines.length === 0 ? (
            <EmptyState
              compact
              title="No machines"
              description="Assign machines to this work center under Master data › Resources."
            />
          ) : (
            machines.map((m) => (
              <Link
                key={m.id}
                to={paths.machine(m.id)}
                className="gap-3 rounded-2xl p-3 flex flex-wrap items-center bg-surface-2 transition-colors hover:bg-surface"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold block truncate">{m.code}</span>
                  <span className="text-xs block truncate text-muted">
                    {m.name} · {m.model} · {wos.filter((w) => w.machineId === m.id).length} open WOs in window
                  </span>
                </span>
                <span className="gap-1.5 flex flex-wrap">
                  <MachineStateBadge state={m.state} />
                  <MaintenanceStateBadge state={m.maintenanceState} />
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <WorkCenterDialog
        open={editing}
        onOpenChange={setEditing}
        editing={wc}
        onSaved={() => toast('Work center updated', { tone: 'success' })}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${wc.code}?`}
        description={
          deleteBlocked
            ? `This work center cannot be deleted while ${deleteBlocked}. Move them first.`
            : 'The work center disappears from capacity, the schedule and dispatch. This cannot be undone.'
        }
        confirmLabel="Delete work center"
        destructive
        confirmDisabled={!!deleteBlocked}
        onConfirm={remove}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string
  value: string
  unit?: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex items-end leading-none">
        <span className={`text-3xl font-bold tracking-tight tabular-nums ${accent ? 'text-accent' : ''}`}>
          {value}
        </span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
