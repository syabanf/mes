import { HOUR, fmtDateShort, fmtTime, orgAncestor, startOfDay, toMs } from '@mes/fixtures'
import type { Machine, WoStatus, WorkOrder } from '@mes/types'
import { PRIORITY_RANK, WO_STATUS_LABEL } from '@mes/types'
import {
  ActionMenu,
  AvatarStack,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  PageHeader,
  PillTabs,
  cn,
} from '@mes/ui'
import { Lock, MoreHorizontal, UserPlus } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  MachineStateBadge,
  MaintenanceStateBadge,
  PriorityBadge,
  WoStatusBadge,
} from '../../components/badges'
import { paths } from '../../components/links'
import { OrgNodePicker, ShiftPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { useWoActions } from './wo-dialogs'
import { BOARD_STATUSES, borItemFor, isMachineUnavailable, sortForDispatch } from './wo-lib'

type View = 'needs' | 'wc' | 'machine' | 'timeline'
const HOURS = 72
const HOUR_W = 3 // rem per hour column

export function DispatchPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const [view, setView] = usePersistentState<View>('mes.admin.dispatch.view', 'needs')
  const [showEmpty, setShowEmpty] = useState(false)
  const [shiftId, setShiftId] = useHistoryState<string | null>('shift', null)
  const [lineId, setLineId] = useHistoryState<string | null>('line', null)
  const [statuses, setStatuses] = useHistoryState<WoStatus[]>('statuses', BOARD_STATUSES)
  const actions = useWoActions()
  const moFilter = params.get('mo')
  const focusWo = params.get('wo')

  const lineByWorkCenter = useMemo(
    () => new Map(s.workCenters.map((wc) => [wc.id, orgAncestor(s.orgNodes, wc.id, 'line')?.id ?? null])),
    [s.workCenters, s.orgNodes],
  )
  const onLine = (workCenterId: string) => !lineId || lineByWorkCenter.get(workCenterId) === lineId

  const wos = useMemo(
    () =>
      sortForDispatch(
        s.workOrders.filter((w) => {
          if (!statuses.includes(w.status)) return false
          if (shiftId && w.shiftId !== shiftId) return false
          if (lineId && lineByWorkCenter.get(w.workCenterId) !== lineId) return false
          if (moFilter && w.moId !== moFilter) return false
          return true
        }),
      ),
    [s.workOrders, lineByWorkCenter, statuses, shiftId, lineId, moFilter],
  )

  const workCenters = s.workCenters.filter((wc) => onLine(wc.id))
  const machines = s.machines.filter(
    (m) => m.active && (!lineId || m.lineId === lineId || onLine(m.workCenterId)),
  )
  const needs = [...wos]
    .filter((w) => {
      if (w.status !== 'ready' && w.status !== 'assigned') return false
      const bor = borItemFor(s, w)
      return ((bor?.machineIds.length ?? 0) > 0 && !w.machineId) || w.operatorIds.length === 0 || !w.shiftId
    })
    .sort(
      (a, b) =>
        a.plannedEnd.localeCompare(b.plannedEnd) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    )

  const toggleStatus = (st: WoStatus) =>
    setStatuses((prev) => (prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st]))
  const clearMo = () =>
    setParams(
      (p) => {
        p.delete('mo')
        return p
      },
      { replace: true },
    )

  const mo = moFilter ? s.maps.mo.get(moFilter) : undefined

  return (
    <>
      <PageHeader
        title="Dispatch board"
        description="Assign machines, operators and shifts to ready work, and move it when the floor changes."
        actions={
          <PillTabs
            value={view}
            onValueChange={(v) => setView(v as View)}
            items={[
              { value: 'needs', label: `Needs assignment (${needs.length})` },
              { value: 'wc', label: 'By work center' },
              { value: 'machine', label: 'By machine' },
              { value: 'timeline', label: 'Timeline' },
            ]}
          />
        }
      />
      <div className="space-y-4">
        {moFilter && (
          <Banner
            tone={mo ? 'info' : 'warning'}
            title={mo ? `Showing ${mo.code} · ${s.productName(mo.productId)}` : 'Order not found'}
            action={
              <Button variant="outline" size="sm" onClick={clearMo}>
                Show all orders
              </Button>
            }
          >
            {mo
              ? 'Only the work orders of this manufacturing order are on the board.'
              : 'The order id in the link does not exist on this site.'}
          </Banner>
        )}
        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            {BOARD_STATUSES.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={statuses.includes(st)}
                count={s.workOrders.filter((w) => w.status === st).length}
                onClick={() => toggleStatus(st)}
              >
                {WO_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <div className="gap-1 flex flex-wrap items-center">
            <ShiftPicker
              variant="inline"
              value={shiftId}
              onChange={setShiftId}
              clearable
              placeholder="Any shift"
              aria-label="Filter by shift"
            />
            <OrgNodePicker
              kind="line"
              variant="inline"
              value={lineId}
              onChange={setLineId}
              clearable
              placeholder="Any line"
              aria-label="Filter by line"
            />
          </div>
        </div>

        {view === 'needs' && (
          <Card className="p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Needs assignment</h2>
            <p className="text-sm text-muted">
              Earliest planned finish first. Assign the missing resources from each row.
            </p>
            {needs.length === 0 ? (
              <EmptyState
                compact
                title="No assignments waiting"
                description="All visible ready work has its required dispatch resources."
              />
            ) : (
              <div className="mt-4 space-y-2">
                {needs.map((wo) => {
                  const bor = borItemFor(s, wo)
                  const missing = [
                    (bor?.machineIds.length ?? 0) > 0 && !wo.machineId ? 'machine' : null,
                    wo.operatorIds.length === 0 ? 'operator' : null,
                    !wo.shiftId ? 'shift' : null,
                  ]
                    .filter(Boolean)
                    .join(', ')
                  return (
                    <div
                      key={wo.id}
                      className="gap-3 rounded-2xl p-3 sm:flex-row sm:items-center flex flex-col bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <Link to={paths.wo(wo.id)} className="text-sm font-semibold hover:text-accent">
                          {wo.code} · {wo.operationName}
                        </Link>
                        <p className="text-xs text-muted">
                          {s.orgName(wo.workCenterId)} · due {fmtDateShort(wo.plannedEnd)}{' '}
                          {fmtTime(wo.plannedEnd)} · missing {missing}
                        </p>
                      </div>
                      <div className="gap-2 flex items-center">
                        <PriorityBadge priority={wo.priority} />
                        <Button
                          size="sm"
                          onClick={() => actions.open('assign', wo)}
                          disabled={!actions.dispatchAllowed}
                        >
                          <UserPlus />
                          Assign
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}

        {(view === 'wc' || view === 'machine') && (
          <label className="gap-2 text-sm flex items-center text-muted">
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
            Show empty columns
          </label>
        )}

        {view === 'wc' && (
          <Board
            empty={workCenters.length === 0}
            columns={workCenters
              .filter((wc) => showEmpty || wos.some((w) => w.workCenterId === wc.id))
              .map((wc) => ({
                key: wc.id,
                header: (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{wc.name}</p>
                    <p className="text-xs truncate text-muted">{s.orgPath(wc.parentId)}</p>
                  </div>
                ),
                wos: wos.filter((w) => w.workCenterId === wc.id),
              }))}
            focusWo={focusWo}
            actions={actions}
          />
        )}

        {view === 'machine' && (
          <Board
            empty={machines.length === 0}
            columns={[
              {
                key: 'none',
                header: (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">No machine</p>
                    <p className="text-xs text-muted">Assign to put them on a machine</p>
                  </div>
                ),
                wos: wos.filter((w) => !w.machineId),
              },
              ...machines
                .filter((m) => showEmpty || wos.some((w) => w.machineId === m.id))
                .map((m) => ({
                  key: m.id,
                  header: <MachineHeader machine={m} />,
                  locked: isMachineUnavailable(m),
                  wos: wos.filter((w) => w.machineId === m.id),
                })),
            ]}
            focusWo={focusWo}
            actions={actions}
          />
        )}

        {view === 'timeline' && <Timeline machines={machines} wos={wos} now={now} focusWo={focusWo} />}
      </div>
      {actions.dialogs}
    </>
  )
}

function MachineHeader({ machine }: { machine: Machine }) {
  const s = useScoped()
  const locked = isMachineUnavailable(machine)
  return (
    <div className="min-w-0">
      <p className="gap-1.5 text-sm font-semibold flex items-center truncate">
        {locked && <Lock className="size-3.5 shrink-0 text-accent" aria-label="Assignment blocked" />}
        <Link to={paths.machine(machine.id)} className="truncate hover:text-accent">
          {machine.code} · {machine.name}
        </Link>
      </p>
      <p className="text-xs truncate text-muted">{s.orgName(machine.workCenterId)}</p>
      <div className="mt-1.5 gap-1 flex flex-wrap">
        <MachineStateBadge state={machine.state} />
        <MaintenanceStateBadge state={machine.maintenanceState} />
      </div>
    </div>
  )
}

type BoardColumn = { key: string; header: ReactNode; wos: WorkOrder[]; locked?: boolean }

function Board({
  columns,
  empty,
  focusWo,
  actions,
}: {
  columns: BoardColumn[]
  empty: boolean
  focusWo: string | null
  actions: ReturnType<typeof useWoActions>
}) {
  if (empty || columns.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nothing to dispatch here"
          description="Pick another line, or release a manufacturing order to generate work orders."
        />
      </Card>
    )
  }
  return (
    <div className="gap-4 pb-2 no-scrollbar flex overflow-x-auto">
      {columns.map((col) => (
        <Card
          key={col.key}
          className={cn('w-72 min-w-72 p-3 flex shrink-0 flex-col', col.locked && 'opacity-80')}
        >
          <div className="gap-2 px-1 pb-3 flex items-start justify-between">
            {col.header}
            <span className="px-2 py-0.5 font-bold shrink-0 rounded-full bg-surface text-[11px] tabular-nums">
              {col.wos.length}
            </span>
          </div>
          <div className="gap-2 flex flex-col">
            {col.wos.length === 0 ? (
              <p className="rounded-2xl px-3 py-6 text-xs bg-surface-2 text-center text-muted">
                {col.locked ? 'Machine unavailable' : 'No work here'}
              </p>
            ) : (
              col.wos.map((wo) => (
                <WoCard key={wo.id} wo={wo} focused={wo.id === focusWo} actions={actions} />
              ))
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

function WoCard({
  wo,
  focused,
  actions,
}: {
  wo: WorkOrder
  focused: boolean
  actions: ReturnType<typeof useWoActions>
}) {
  const s = useScoped()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [focused])
  const mo = s.maps.mo.get(wo.moId)
  const machine = s.maps.machine.get(wo.machineId ?? '')
  const items = actions.items(wo)
  return (
    <div
      ref={ref}
      role="link"
      tabIndex={0}
      onClick={() => navigate(paths.wo(wo.id))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(paths.wo(wo.id))
      }}
      className={cn(
        'rounded-2xl p-3 cursor-pointer bg-surface-2 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
        focused && 'ring-2 ring-accent',
      )}
    >
      <div className="gap-2 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{wo.code}</p>
          <p className="text-sm font-semibold truncate">
            {wo.operationSeq} · {wo.operationName}
          </p>
          {mo && <p className="text-xs truncate text-muted">{s.productName(mo.productId)}</p>}
        </div>
        {items.length > 0 && (
          <ActionMenu
            title={wo.code}
            items={items}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${wo.code}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal />
              </Button>
            }
          />
        )}
      </div>
      <div className="mt-2 gap-1.5 flex flex-wrap items-center">
        <PriorityBadge priority={wo.priority} />
        <WoStatusBadge status={wo.status} />
        {machine && <Badge variant="outline">{machine.code}</Badge>}
      </div>
      <div className="mt-2 gap-2 flex items-center justify-between">
        <span className="text-[11px] text-muted tabular-nums">
          {fmtDateShort(wo.plannedStart)} {fmtTime(wo.plannedStart)} → {fmtTime(wo.plannedEnd)}
        </span>
        {wo.operatorIds.length > 0 && (
          <AvatarStack
            people={wo.operatorIds.map((id) => ({
              name: s.personName(id),
              color: s.maps.person.get(id)?.color,
            }))}
            size="xs"
            max={3}
          />
        )}
      </div>
    </div>
  )
}

function Timeline({
  machines,
  wos,
  now,
  focusWo,
}: {
  machines: Machine[]
  wos: WorkOrder[]
  now: number
  focusWo: string | null
}) {
  const s = useScoped()
  const navigate = useNavigate()
  const from = startOfDay(now)
  const span = HOURS * HOUR
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - from) / span) * 100))
  const trackWidth = `${HOURS * HOUR_W}rem`
  const rows = machines.map((m) => ({
    machine: m,
    wos: wos.filter(
      (w) => w.machineId === m.id && toMs(w.plannedEnd) > from && toMs(w.plannedStart) < from + span,
    ),
  }))
  const bar = (w: WorkOrder) => {
    const start = pct(toMs(w.plannedStart))
    const end = pct(toMs(w.plannedEnd))
    const color =
      w.priority === 'critical'
        ? 'bg-accent text-white'
        : w.status === 'in_progress'
          ? 'bg-info text-white'
          : w.status === 'paused' || w.status === 'hold'
            ? 'bg-warning text-white'
            : w.status === 'assigned'
              ? 'bg-ink text-on-ink'
              : 'bg-silver text-foreground'
    return { start, width: Math.max(0.6, end - start), color }
  }

  if (machines.length === 0) {
    return (
      <Card>
        <EmptyState title="No machines on this line" description="Pick another line to see its schedule." />
      </Card>
    )
  }

  return (
    <Card className="p-3">
      <div className="no-scrollbar overflow-x-auto">
        <div className="grid grid-cols-[10rem_auto]" style={{ minWidth: `calc(10rem + ${trackWidth})` }}>
          <div className="left-0 px-2 pb-2 text-xs font-semibold sticky z-10 bg-card text-muted">Machine</div>
          <div className="pb-2 relative" style={{ width: trackWidth }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${HOURS}, ${HOUR_W}rem)` }}>
              {Array.from({ length: HOURS }, (_, h) => (
                <div
                  key={h}
                  className={cn(
                    'text-[11px] text-muted tabular-nums',
                    h % 24 === 0
                      ? 'pl-1 font-semibold border-l border-border text-foreground'
                      : h % 3 === 0
                        ? 'pl-1 border-l border-border/60'
                        : '',
                  )}
                >
                  {h % 24 === 0 ? fmtDateShort(from + h * HOUR) : h % 3 === 0 ? fmtTime(from + h * HOUR) : ''}
                </div>
              ))}
            </div>
            <span
              className="top-0 px-1.5 font-bold text-white absolute -translate-x-1/2 rounded-full bg-accent text-[10px]"
              style={{ left: `${pct(now)}%` }}
            >
              now
            </span>
          </div>
          {rows.map(({ machine, wos: mwos }) => (
            <div key={machine.id} className="contents">
              <div className="left-0 gap-2 px-2 py-2 sticky z-10 flex items-center border-t border-border bg-card">
                <span className="min-w-0">
                  <Link
                    to={paths.machine(machine.id)}
                    className="text-xs font-semibold block truncate hover:text-accent"
                  >
                    {machine.code}
                  </Link>
                  <span className="block truncate text-[11px] text-muted">
                    {s.orgName(machine.workCenterId)}
                  </span>
                </span>
              </div>
              <div className="h-12 relative border-t border-border" style={{ width: trackWidth }}>
                <div
                  className="inset-0 absolute grid"
                  style={{ gridTemplateColumns: `repeat(${HOURS}, ${HOUR_W}rem)` }}
                  aria-hidden
                >
                  {Array.from({ length: HOURS }, (_, h) => (
                    <div
                      key={h}
                      className={cn(
                        h % 24 === 0
                          ? 'border-l border-border'
                          : h % 3 === 0
                            ? 'border-l border-border/40'
                            : '',
                      )}
                    />
                  ))}
                </div>
                <div
                  className="inset-y-0 pointer-events-none absolute z-10 w-px bg-accent"
                  style={{ left: `${pct(now)}%` }}
                  aria-hidden
                />
                {mwos.map((w) => {
                  const b = bar(w)
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => navigate(paths.wo(w.id))}
                      title={`${w.code} · ${w.operationName} · ${fmtTime(w.plannedStart)}–${fmtTime(w.plannedEnd)}`}
                      className={cn(
                        'top-2 h-8 rounded-lg px-2 font-semibold leading-8 absolute truncate text-left text-[11px] transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
                        b.color,
                        w.id === focusWo && 'ring-2 ring-accent ring-offset-2',
                      )}
                      style={{ left: `${b.start}%`, width: `${b.width}%` }}
                    >
                      {w.code} · {w.operationName}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 gap-4 px-2 flex flex-wrap text-[11px] text-muted">
        <Legend className="bg-silver" label="Ready" />
        <Legend className="bg-ink" label="Assigned" />
        <Legend className="bg-info" label="In progress" />
        <Legend className="bg-warning" label="Paused or hold" />
        <Legend className="bg-accent" label="Critical priority" />
      </p>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="gap-1.5 inline-flex items-center">
      <span className={cn('size-2 rounded-full', className)} /> {label}
    </span>
  )
}
