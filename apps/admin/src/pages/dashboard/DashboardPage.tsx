import {
  fmtAgo,
  fmtNumber,
  fmtPercent,
  fmtTime,
  isMoDelayed,
  materialReadiness,
  moActualQty,
  moProgress,
  sumBy,
} from '@mes/fixtures'
import { ACTIVE_WIP_STATES, OPEN_MO_STATUSES, type MoStatus, MO_STATUS_LABEL } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CountBadge,
  Donut,
  EmptyState,
  PillTabs,
  SegmentBar,
  StatCard,
  cn,
} from '@mes/ui'
import {
  ArrowUpRight,
  Boxes,
  CircleAlert,
  ClipboardList,
  Factory,
  Microscope,
  PackageX,
  PauseOctagon,
  Siren,
  TimerOff,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'
import { MoStatusBadge, ReadinessBadge, WoStatusBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useAuth } from '../../auth/auth'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { RoleHome } from './RoleHome'

const OVERVIEW: { status: MoStatus; tone: 'default' | 'ink' | 'info' | 'success' | 'warning' }[] = [
  { status: 'planned', tone: 'default' },
  { status: 'released', tone: 'ink' },
  { status: 'in_progress', tone: 'info' },
  { status: 'completed', tone: 'success' },
  { status: 'on_hold', tone: 'warning' },
]

export function DashboardPage() {
  const { user } = useAuth()
  if (user?.role !== 'admin' && user?.role !== 'production_manager') return <RoleHome />
  return <PlantDashboard />
}

function PlantDashboard() {
  const s = useScoped()
  const now = useNow(60_000)
  const [view, setView] = usePersistentState('mes.admin.dashboard.view', 'operations')

  const d = useMemo(() => {
    const open = s.manufacturingOrders.filter((m) => OPEN_MO_STATUSES.includes(m.status))
    const delayed = open.filter((m) => isMoDelayed(m, s.workOrders, now, s.settings.delayThresholdPct))
    const running = s.workOrders.filter((w) => w.status === 'in_progress' || w.status === 'paused')
    const activeWip = s.wips.filter((w) => ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0)
    const readiness = open
      .filter((m) => m.status === 'released' || m.status === 'in_progress')
      .map((m) => ({ mo: m, readiness: materialReadiness(m.id, s.materialRequirements) }))
    const featured =
      open.find((m) => m.atRisk) ??
      [...open]
        .filter((m) => m.status === 'in_progress')
        .sort((a, b) => a.plannedEnd.localeCompare(b.plannedEnd))[0] ??
      null
    const planned = sumBy(open, (m) => m.qty)
    const actual = sumBy(open, (m) => moActualQty(m, s.workOrders))
    const wipByOp = [
      ...s.wips
        .filter((w) => ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0)
        .reduce(
          (map, w) => map.set(w.operationSeq, (map.get(w.operationSeq) ?? 0) + w.qty),
          new Map<number, number>(),
        ),
    ].sort((a, b) => a[0] - b[0])
    return {
      open,
      delayed,
      running,
      activeWip,
      readiness,
      featured,
      planned,
      actual,
      wipByOp,
      attention: {
        shortage: readiness.filter((r) => r.readiness === 'shortage').length,
        holds: s.qualityHolds.filter((h) => h.status === 'active').length,
        maintenance: s.machines.filter((m) => m.maintenanceState === 'in_maintenance' || m.state === 'down')
          .length,
        operators: s.workOrders.filter(
          (w) =>
            ['ready', 'assigned', 'in_progress', 'paused', 'hold'].includes(w.status) &&
            w.operatorIds.some((id) => s.maps.person.get(id)?.availability === 'leave'),
        ).length,
        delayedWo: running.filter((w) => now > Date.parse(w.plannedEnd)).length,
        atRisk: open.filter((m) => m.atRisk).length,
      },
      counts: OVERVIEW.map((o) => ({
        ...o,
        count: s.manufacturingOrders.filter((m) => m.status === o.status).length,
      })),
    }
  }, [s, now])

  const OP_NAMES: Record<number, string> = useMemo(() => {
    const names: Record<number, string> = {}
    for (const bop of s.bops) for (const op of bop.operations) names[op.seq] ??= op.name
    return names
  }, [s.bops])
  const wipColors = [
    'var(--color-ink)',
    'var(--color-info)',
    'var(--color-accent)',
    'var(--color-warning)',
    'var(--color-success)',
    'var(--color-chart-muted)',
  ]

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <PillTabs
          value={view}
          onValueChange={setView}
          items={[
            { value: 'operations', label: 'Control tower' },
            { value: 'shift', label: 'Shift view' },
          ]}
        />
        <p className="text-xs md:block hidden text-muted">
          {s.site.name} · updated {fmtTime(now)} WIB
        </p>
      </div>

      <Card className="p-4" aria-labelledby="attention-title">
        <div className="gap-3 flex flex-wrap items-center justify-between">
          <div>
            <h2 id="attention-title" className="font-semibold">
              Attention required
            </h2>
            <p className="text-xs text-muted">Open the queue that needs action first.</p>
          </div>
          <div className="gap-2 sm:grid-cols-3 xl:w-auto grid w-full grid-cols-2">
            {[
              {
                to: '/manufacturing/orders?view=at-risk',
                icon: <Siren />,
                label: 'At-risk MO',
                count: d.attention.atRisk,
                urgent: true,
              },
              {
                to: '/inventory/requirements?view=shortage',
                icon: <PackageX />,
                label: 'Material shortage',
                count: d.attention.shortage,
                urgent: true,
              },
              {
                to: '/quality/holds',
                icon: <PauseOctagon />,
                label: 'Quality hold',
                count: d.attention.holds,
                urgent: true,
              },
              {
                to: '/integration/cmms',
                icon: <Wrench />,
                label: 'Maintenance',
                count: d.attention.maintenance,
              },
              {
                to: '/manufacturing/work-orders?view=delayed',
                icon: <TimerOff />,
                label: 'Delayed WO',
                count: d.attention.delayedWo,
              },
              {
                to: '/manufacturing/work-orders?view=operator-issue',
                icon: <CircleAlert />,
                label: 'WO with absent operator',
                count: d.attention.operators,
              },
            ]
              .filter((item) => item.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((item) => (
                <AttentionLink key={item.label} {...item} />
              ))}
            {Object.values(d.attention).every((count) => count === 0) && (
              <p className="py-3 text-sm col-span-2 text-muted">No active issues.</p>
            )}
          </div>
        </div>
      </Card>

      {view === 'shift' ? <ShiftView now={now} /> : null}

      {view === 'operations' && (
        <>
          <div className="gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] grid grid-cols-1">
            <FeaturedMo mo={d.featured} now={now} />
            <div className="gap-3 sm:gap-4 grid grid-cols-1">
              <Card variant="accent" className="p-5 flex flex-col">
                <p className="font-semibold text-white/80 text-[13px]">Orders in progress</p>
                <p className="mt-1 text-5xl font-bold tracking-tight leading-none tabular-nums">
                  {d.counts.find((c) => c.status === 'in_progress')?.count ?? 0}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {d.running.length} running work orders · {d.delayed.length} delayed
                </p>
                <div className="mt-4 h-1.5 bg-white/25 overflow-hidden rounded-full">
                  <div
                    className="bg-white h-full rounded-full"
                    style={{ width: `${Math.round((d.planned ? d.actual / d.planned : 0) * 100)}%` }}
                  />
                </div>
                <div className="mt-4 gap-2 flex flex-wrap items-center justify-between">
                  <span className="text-xs text-white/80">
                    {fmtNumber(d.actual)} good reported in production of {fmtNumber(d.planned)} planned
                  </span>
                  <Button asChild variant="onInk" size="sm">
                    <Link to="/manufacturing/orders?view=open">Open list</Link>
                  </Button>
                </div>
              </Card>
              <div className="gap-3 sm:gap-4 grid grid-cols-2">
                <StatCard
                  label="Production output vs plan"
                  value={fmtPercent(d.planned ? d.actual / d.planned : 0)}
                  hint={`${fmtNumber(d.actual)} good at furthest reported operations; ${fmtNumber(d.planned)} planned`}
                  icon={<Factory />}
                  tone="ink"
                />
                <StatCard
                  label="Active WIP"
                  value={fmtNumber(sumBy(d.activeWip, (w) => w.qty))}
                  hint={`pcs in ${d.activeWip.length} batches on the floor`}
                  icon={<Boxes />}
                  tone="info"
                />
              </div>
            </div>
          </div>

          <div className="gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6 grid grid-cols-2">
            {d.counts.map((c) => (
              <StatCard
                key={c.status}
                label={MO_STATUS_LABEL[c.status]}
                value={c.count}
                tone={c.tone}
                icon={<ClipboardList />}
              />
            ))}
            <StatCard
              label="Delayed"
              value={d.delayed.length}
              tone={d.delayed.length ? 'danger' : 'success'}
              icon={<TimerOff />}
              hint={d.delayed.length ? 'Behind the planned window' : 'All on schedule'}
            />
          </div>

          <div className="gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem] grid grid-cols-1">
            <Card>
              <CardHeader
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/manufacturing/work-orders?view=running">View all</Link>
                  </Button>
                }
              >
                <CardTitle className="gap-2 flex items-center">
                  Running work orders <CountBadge count={d.running.length} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.running.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nothing running"
                    description="Dispatch a ready work order to start production."
                  />
                ) : (
                  d.running.slice(0, 5).map((wo) => (
                    <Link
                      key={wo.id}
                      to={paths.wo(wo.id)}
                      className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                    >
                      <span className="size-10 rounded-xl text-xs font-bold flex shrink-0 items-center justify-center bg-card tabular-nums shadow-card">
                        {wo.operationSeq}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-semibold block truncate">{wo.operationName}</span>
                        <span className="text-xs block truncate text-muted">
                          {wo.code} · {s.maps.machine.get(wo.machineId ?? '')?.code ?? 'no machine'} ·{' '}
                          {s.personName(wo.operatorIds[0] ?? null)}
                        </span>
                        <span className="mt-1.5 gap-2 sm:hidden flex items-center">
                          <WoStatusBadge status={wo.status} />
                        </span>
                      </span>
                      <span className="gap-1 sm:flex hidden shrink-0 flex-col items-end">
                        <WoStatusBadge status={wo.status} />
                        <span className="text-xs text-muted tabular-nums">
                          {fmtNumber(wo.goodQty)} / {fmtNumber(wo.targetQty)}
                        </span>
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/inventory/requirements">View all</Link>
                  </Button>
                }
              >
                <CardTitle className="gap-2 flex items-center">
                  Material readiness{' '}
                  <CountBadge count={d.readiness.filter((r) => r.readiness !== 'ready').length} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.readiness.length === 0 ? (
                  <EmptyState
                    compact
                    title="No released orders"
                    description="Material requirements appear once an order is released."
                  />
                ) : (
                  [...d.readiness]
                    .sort(
                      (a, b) => (a.readiness === 'shortage' ? -1 : 1) - (b.readiness === 'shortage' ? -1 : 1),
                    )
                    .slice(0, 5)
                    .map(({ mo, readiness }) => (
                      <Link
                        key={mo.id}
                        to={paths.mo(mo.id)}
                        className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-sm font-semibold block truncate">
                            {s.productName(mo.productId)}
                          </span>
                          <span className="text-xs block truncate text-muted">
                            {mo.code} · {fmtNumber(mo.qty)} pcs · ends {fmtAgo(mo.plannedEnd, now)}
                          </span>
                        </span>
                        <ReadinessBadge readiness={readiness} />
                      </Link>
                    ))
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2 xl:col-span-1">
              <CardHeader>
                <CardTitle>WIP by operation</CardTitle>
              </CardHeader>
              <CardContent>
                {d.wipByOp.length === 0 ? (
                  <EmptyState
                    compact
                    title="No WIP"
                    description="Work in progress shows up as operations report output."
                  />
                ) : (
                  <Donut
                    ariaLabel="WIP quantity by operation"
                    segments={d.wipByOp.map(([seq, qty], i) => ({
                      key: String(seq),
                      label: `${seq} ${OP_NAMES[seq] ?? ''}`,
                      value: qty,
                      color: wipColors[i % wipColors.length]!,
                    }))}
                    centerValue={fmtNumber(sumBy(d.activeWip, (w) => w.qty))}
                    centerLabel="pcs"
                  />
                )}
                <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
                  <Link to="/inventory/wip">
                    Open WIP view <ArrowUpRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function FeaturedMo({
  mo,
  now,
}: {
  mo: ReturnType<typeof useScoped>['manufacturingOrders'][number] | null
  now: number
}) {
  const s = useScoped()
  if (!mo) {
    return (
      <Card variant="ink" className="p-8 flex items-center justify-center">
        <EmptyState
          icon={<Factory />}
          title="No open orders"
          description="Release a manufacturing order to see it here."
          className="text-on-ink [&_p]:text-on-ink-muted"
        />
      </Card>
    )
  }
  const progress = moProgress(mo, s.workOrders)
  const wos = s.workOrders.filter((w) => w.moId === mo.id).sort((a, b) => a.operationSeq - b.operationSeq)
  const line = mo.lineId ? s.orgName(mo.lineId) : 'Line not set'
  const latest = [...mo.events].at(-1)
  return (
    <Card variant="ink" className="p-5 relative flex flex-col overflow-hidden">
      <div className="gap-3 flex flex-wrap items-start justify-between">
        <div className="min-w-0">
          <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">
            {mo.atRisk ? 'At risk' : 'Featured order'}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight truncate">{s.productName(mo.productId)}</h2>
          <p className="text-sm text-on-ink-muted">
            {mo.code} · {line} · revision {mo.snapshot?.rev ?? 'n/a'}
          </p>
        </div>
        <MoStatusBadge status={mo.status} />
      </div>
      <div className="mt-6 gap-2 flex items-end leading-none">
        <span className="text-6xl font-bold tracking-tight tabular-nums">
          {fmtNumber(moActualQty(mo, s.workOrders))}
        </span>
        <span className="pb-1 text-sm font-semibold text-on-ink-muted">
          good at furthest reported operation of {fmtNumber(mo.qty)} planned
        </span>
      </div>
      <div className="mt-4 gap-2 flex flex-wrap">
        {wos.map((wo) => (
          <Link
            key={wo.id}
            to={paths.wo(wo.id)}
            className={cn(
              'h-8 gap-1.5 px-3 text-xs font-semibold inline-flex items-center rounded-full border transition-colors',
              wo.status === 'in_progress' || wo.status === 'paused'
                ? 'text-white border-accent bg-accent'
                : wo.status === 'completed'
                  ? 'border-white/10 bg-white/10 text-white'
                  : 'border-white/10 hover:bg-white/10 text-on-ink-muted',
            )}
          >
            {wo.operationSeq} {wo.operationName}
          </Link>
        ))}
      </div>
      {latest && (
        <div className="mt-4 rounded-2xl bg-white/5 p-3 text-sm">
          <span className="font-semibold">Latest</span>{' '}
          <span className="text-on-ink-muted">{fmtAgo(latest.at, now)}</span>
          <p className="mt-0.5 text-on-ink-muted">{latest.text}</p>
        </div>
      )}
      <div className="gap-2 pt-5 mt-auto flex flex-wrap items-center justify-between">
        <span className="text-xs text-on-ink-muted">
          {progress.completedOps} of {progress.totalOps} operations · {fmtPercent(progress.ratio)}
        </span>
        <Button asChild variant="onInk" size="sm">
          <Link to={paths.mo(mo.id)}>Open order</Link>
        </Button>
      </div>
      <div
        aria-hidden
        className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
      />
    </Card>
  )
}

function ShiftView({ now }: { now: number }) {
  const s = useScoped()
  const since = now - 8 * 3_600_000
  const events = s.productionEvents.filter((e) => Date.parse(e.at) >= since)
  const output = s.workOrders.filter((w) =>
    w.events.some((e) => e.kind === 'output' && Date.parse(e.at) >= since),
  )
  const good = sumBy(
    output.flatMap((w) => w.events.filter((e) => e.kind === 'output' && Date.parse(e.at) >= since)),
    (e) => e.qty ?? 0,
  )
  const downtime = s.oeeSnapshots.filter(
    (o) => o.date === new Date(now + 7 * 3_600_000).toISOString().slice(0, 10),
  )
  const segments = [
    { key: 'good', value: sumBy(s.workOrders, (w) => w.goodQty), className: 'bg-success', label: 'Good' },
    {
      key: 'rework',
      value: sumBy(s.workOrders, (w) => w.reworkQty),
      className: 'bg-warning',
      label: 'Rework',
    },
    { key: 'reject', value: sumBy(s.workOrders, (w) => w.rejectQty), className: 'bg-info', label: 'Reject' },
    { key: 'scrap', value: sumBy(s.workOrders, (w) => w.scrapQty), className: 'bg-accent', label: 'Scrap' },
  ]
  return (
    <div className="space-y-4">
      <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
        <StatCard
          label="Output this shift"
          value={fmtNumber(good)}
          unit="pcs"
          hint={`${output.length} work orders reported`}
          icon={<Factory />}
          tone="ink"
        />
        <StatCard label="Events logged" value={events.length} hint="Last 8 hours" icon={<ClipboardList />} />
        <StatCard
          label="Downtime today"
          value={fmtNumber(sumBy(downtime, (o) => o.downtimeMin))}
          unit="min"
          hint={`${downtime.length} OEE snapshots`}
          icon={<Wrench />}
          tone={sumBy(downtime, (o) => o.downtimeMin) > 120 ? 'warning' : 'success'}
        />
        <StatCard
          label="Inspections open"
          value={s.inspections.filter((i) => i.status !== 'passed' && i.status !== 'failed').length}
          icon={<Microscope />}
          tone="info"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quality mix across open orders</CardTitle>
        </CardHeader>
        <CardContent>
          <SegmentBar segments={segments} />
          <div className="mt-3 gap-4 text-xs flex flex-wrap text-muted">
            {segments.map((seg) => (
              <span key={seg.key} className="gap-1.5 inline-flex items-center">
                <span className={cn('size-2 rounded-full', seg.className)} /> {seg.label}{' '}
                {fmtNumber(seg.value)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Shift log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {events.length === 0 ? (
            <EmptyState compact title="Quiet shift" description="No events in the last eight hours." />
          ) : (
            [...events]
              .reverse()
              .slice(0, 12)
              .map((e) => (
                <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                  <span className="w-14 pt-0.5 text-xs shrink-0 text-muted tabular-nums">
                    {fmtTime(e.at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm block">{e.text}</span>
                    <span className="block font-mono text-[11px] text-muted">{e.type}</span>
                  </span>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AttentionLink({
  to,
  icon,
  label,
  count,
  urgent = false,
}: {
  to: string
  icon: ReactNode
  label: string
  count: number
  urgent?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'min-w-0 gap-3 rounded-2xl px-3 py-2.5 flex items-center transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
        urgent && count > 0
          ? 'bg-accent-soft text-accent-strong hover:bg-accent-soft/70'
          : 'bg-surface text-foreground hover:bg-surface-2',
      )}
    >
      <span aria-hidden="true" className="[&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-lg font-bold block leading-none tabular-nums">{count}</span>
        <span className="font-semibold block truncate text-[11px]">{label}</span>
      </span>
    </Link>
  )
}
