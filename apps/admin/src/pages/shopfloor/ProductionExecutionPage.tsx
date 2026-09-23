import {
  HOUR,
  fmtAgo,
  fmtNumber,
  fmtPercent,
  fmtTime,
  isSameDay,
  shiftAt,
  sumBy,
  toMs,
  woCompletionBlocker,
} from '@mes/fixtures'
import type { WorkOrder } from '@mes/types'
import { PAUSE_REASON_LABEL } from '@mes/types'
import {
  AvatarStack,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
  toast,
} from '@mes/ui'
import { Activity, CheckCircle2, Pause, PauseOctagon, Play, ShieldX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { WoStatusBadge } from '../../components/badges'
import { MachineLink, MoLink, PersonAvatar, WoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { sortForDispatch } from '../manufacturing/wo-lib'
import { CompleteDialog, PauseDialog, completionBlocked } from './execution-dialogs'

const FEED_TYPES = /^(workorder|wip|quality)\./

export function ProductionExecutionPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(30_000)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<{ kind: 'pause' | 'complete'; wo: WorkOrder } | null>(null)
  const execute = can('shopfloor.execute')

  const live = useMemo(() => {
    const running = s.workOrders.filter((w) => w.status === 'in_progress')
    const paused = s.workOrders.filter((w) => w.status === 'paused')
    const hourAgo = now - HOUR
    const outputLastHour = sumBy(
      s.workOrders.flatMap((w) => w.events.filter((e) => e.kind === 'output' && toMs(e.at) >= hourAgo)),
      (e) => e.qty ?? 0,
    )
    const today = s.workOrders.filter((w) =>
      w.events.some((e) => e.kind === 'output' && isSameDay(toMs(e.at), now)),
    )
    const output = sumBy(today, (w) => w.outputQty)
    const feed = s.productionEvents
      .filter((e) => toMs(e.at) >= now - 4 * HOUR && FEED_TYPES.test(e.type))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20)
    return {
      rows: sortForDispatch([...running, ...paused]),
      running: running.length,
      paused: paused.length,
      outputLastHour,
      rejectRate: output ? sumBy(today, (w) => w.rejectQty) / output : 0,
      feed,
    }
  }, [s, now])

  const currentShift = shiftAt(s.shifts, now)
  const woOf = (personId: string) =>
    s.workOrders.find(
      (w) => (w.status === 'in_progress' || w.status === 'paused') && w.operatorIds.includes(personId),
    )

  const resume = (wo: WorkOrder) => {
    s.dispatch({ type: 'workOrders/resume', id: wo.id })
    toast(`${wo.code} resumed`, { tone: 'success' })
  }

  const columns: Column<WorkOrder>[] = [
    {
      id: 'op',
      header: 'Operation',
      sortValue: (w) => w.code,
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{w.code}</p>
          <p className="text-sm truncate">
            {w.operationSeq} · {w.operationName}
          </p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <WoStatusBadge status={w.status} />
          </div>
        </div>
      ),
    },
    { id: 'mo', header: 'Order', hideBelow: 'md', cell: (w) => <MoLink moId={w.moId} /> },
    {
      id: 'machine',
      header: 'Machine',
      hideBelow: 'md',
      cell: (w) => <MachineLink machineId={w.machineId} />,
    },
    {
      id: 'operators',
      header: 'Operators',
      hideBelow: 'lg',
      cell: (w) =>
        w.operatorIds.length ? (
          <AvatarStack
            people={w.operatorIds.map((id) => ({
              name: s.personName(id),
              color: s.maps.person.get(id)?.color,
            }))}
            size="xs"
          />
        ) : (
          <span className="text-xs text-muted">Unassigned</span>
        ),
    },
    {
      id: 'started',
      header: 'Started',
      hideBelow: 'sm',
      sortValue: (w) => w.actualStart ?? '',
      cell: (w) => (
        <span className="text-xs text-muted tabular-nums">
          {w.actualStart ? fmtAgo(w.actualStart, now) : 'not started'}
        </span>
      ),
    },
    {
      id: 'progress',
      header: 'Output',
      hideBelow: 'sm',
      width: '9rem',
      sortValue: (w) => w.goodQty / Math.max(1, w.targetQty),
      cell: (w) => (
        <div>
          <ProgressBar
            value={w.goodQty / Math.max(1, w.targetQty)}
            tone={w.status === 'paused' ? 'warning' : 'info'}
            aria-label={`${w.goodQty} of ${w.targetQty}`}
          />
          <p className="mt-1 text-[11px] text-muted tabular-nums">
            {fmtNumber(w.goodQty)} / {fmtNumber(w.targetQty)}
          </p>
        </div>
      ),
    },
    {
      id: 'pause',
      header: 'Pause reason',
      hideBelow: 'lg',
      cell: (w) =>
        w.pauseReason ? (
          <Badge variant="warning">{PAUSE_REASON_LABEL[w.pauseReason]}</Badge>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (w) =>
        execute ? (
          <div className="gap-1 flex justify-end">
            {w.status === 'paused' ? (
              <Button variant="outline" size="sm" onClick={() => resume(w)}>
                <Play />
                Resume
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'pause', wo: w })}>
                <Pause />
                Pause
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={completionBlocked(s, w)}
              title={woCompletionBlocker(s.state, w) ?? undefined}
              onClick={() => setDialog({ kind: 'complete', wo: w })}
            >
              <CheckCircle2 />
              Complete
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Production execution"
        description="Live supervisor view: what is running, what is paused, and who is on the floor."
        actions={<p className="text-xs text-muted">Updated {fmtTime(now)} WIB</p>}
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Running"
            value={live.running}
            hint="Work orders in progress"
            icon={<Play />}
            tone="info"
            onClick={() => navigate('/manufacturing/work-orders?view=running')}
          />
          <StatCard
            label="Paused"
            value={live.paused}
            hint={live.paused ? 'Need a resume or a decision' : 'Nothing waiting'}
            icon={<PauseOctagon />}
            tone={live.paused ? 'warning' : 'success'}
          />
          <StatCard
            label="Output last hour"
            value={fmtNumber(live.outputLastHour)}
            unit="pcs"
            hint="All operations, all products"
            icon={<Activity />}
            tone="ink"
          />
          <StatCard
            label="Reject rate today"
            value={fmtPercent(live.rejectRate, 1)}
            hint="Reject over total output reported today"
            icon={<ShieldX />}
            tone={live.rejectRate > 0.05 ? 'danger' : 'success'}
          />
        </div>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/manufacturing/dispatch">Dispatch board</Link>
              </Button>
            }
          >
            <CardTitle>Running and paused work orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              rows={live.rows}
              getRowKey={(w) => w.id}
              onRowClick={(w) => navigate(paths.wo(w.id))}
              pageSize={0}
              empty="Nothing is running. Start a work order from the operator station."
            />
          </CardContent>
        </Card>

        <div className="gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Event feed</CardTitle>
              <p className="text-xs text-muted">Work order, WIP and quality events of the last four hours.</p>
            </CardHeader>
            <CardContent className="space-y-1">
              {live.feed.length === 0 ? (
                <EmptyState
                  compact
                  title="Quiet floor"
                  description="Events show up here as operators start, pause and report output."
                />
              ) : (
                live.feed.map((e) => (
                  <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                    <span className="w-12 pt-0.5 text-xs shrink-0 text-muted tabular-nums">
                      {fmtTime(e.at)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm block">{e.text}</span>
                      <span className="mt-0.5 gap-x-2 gap-y-0.5 flex flex-wrap items-center text-[11px] text-muted">
                        <span className="font-mono">{e.type}</span>
                        {e.moId && <MoLink moId={e.moId} showProduct={false} />}
                        {e.woId && <WoLink woId={e.woId} />}
                        {e.machineId && (
                          <Link to={paths.machine(e.machineId)} className="font-mono hover:text-accent">
                            {s.maps.machine.get(e.machineId)?.code ?? e.machineId}
                          </Link>
                        )}
                        <span>· {s.personName(e.by)}</span>
                      </span>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shift board</CardTitle>
              <p className="text-xs text-muted">Operators on shift and the work order they are on.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.shifts.map((shift) => {
                const people = s.operators.filter(
                  (o) => o.shiftId === shift.id && o.availability === 'on_shift',
                )
                const current = currentShift?.id === shift.id
                return (
                  <div key={shift.id} className="rounded-2xl p-3 bg-surface-2">
                    <div className="gap-2 flex flex-wrap items-center justify-between">
                      <p className="text-sm font-semibold">
                        {shift.name}{' '}
                        <span className="text-xs font-normal text-muted">
                          {shift.start}–{shift.end}
                        </span>
                      </p>
                      {current ? (
                        <Badge variant="ink" dot>
                          Now
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">{people.length} on shift</span>
                      )}
                    </div>
                    {people.length === 0 ? (
                      <p className="mt-2 text-xs text-muted">No operator clocked on this shift.</p>
                    ) : (
                      <ul className="mt-2 gap-1 sm:grid-cols-2 grid grid-cols-1">
                        {people.map((p) => {
                          const wo = woOf(p.id)
                          return (
                            <li key={p.id} className="gap-2 rounded-xl px-2.5 py-2 flex items-center bg-card">
                              <PersonAvatar personId={p.id} size="xs" />
                              <span className="min-w-0 flex-1">
                                <span className="text-sm font-medium block truncate">{p.name}</span>
                                <span className="block truncate text-[11px] text-muted">
                                  {wo ? `${wo.operationSeq} · ${wo.operationName}` : 'No work order'}
                                </span>
                              </span>
                              {wo && <WoLink woId={wo.id} />}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {dialog?.kind === 'pause' && (
        <PauseDialog key={dialog.wo.id} open onOpenChange={(o) => !o && setDialog(null)} wo={dialog.wo} />
      )}
      {dialog?.kind === 'complete' && (
        <CompleteDialog key={dialog.wo.id} open onOpenChange={(o) => !o && setDialog(null)} wo={dialog.wo} />
      )}
    </>
  )
}
