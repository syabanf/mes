import {
  fmtNumber,
  fmtPercent,
  fmtTime,
  isMoDelayed,
  materialReadiness,
  moActualQty,
  orgAncestor,
  sumBy,
} from '@mes/fixtures'
import type { MoStatus, OrgKind, Wip } from '@mes/types'
import { ACTIVE_WIP_STATES, MO_STATUS_LABEL, OPEN_MO_STATUSES, ORG_KIND_LABEL } from '@mes/types'
import {
  BarList,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ColumnChart,
  EmptyState,
  PageHeader,
  PillTabs,
  ProgressBar,
  SegmentBar,
  StatCard,
  StatusDot,
  cn,
} from '@mes/ui'
import {
  ArrowUpRight,
  CircleAlert,
  ClipboardList,
  PackageX,
  PauseOctagon,
  Siren,
  TimerOff,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { MoStatusBadge, ReadinessBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { MACHINE_TONE, isWoLate } from './wo-lib'

const OVERVIEW: { status: MoStatus; tone: 'default' | 'ink' | 'info' | 'success' | 'warning' }[] = [
  { status: 'planned', tone: 'default' },
  { status: 'released', tone: 'ink' },
  { status: 'in_progress', tone: 'info' },
  { status: 'completed', tone: 'success' },
  { status: 'on_hold', tone: 'warning' },
]

type WipDimension = OrgKind | 'operation'
const DIMENSIONS: { value: WipDimension; label: string }[] = [
  { value: 'plant', label: ORG_KIND_LABEL.plant },
  { value: 'area', label: ORG_KIND_LABEL.area },
  { value: 'line', label: ORG_KIND_LABEL.line },
  { value: 'work_center', label: ORG_KIND_LABEL.work_center },
  { value: 'operation', label: 'Operation' },
]

export function ProductionControlPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const [dimension, setDimension] = usePersistentState<WipDimension>('mes.admin.control.wip', 'work_center')

  const d = useMemo(() => {
    const open = s.manufacturingOrders.filter((m) => OPEN_MO_STATUSES.includes(m.status))
    const delayed = open.filter((m) => isMoDelayed(m, s.workOrders, now, s.settings.delayThresholdPct))
    const readiness = open
      .filter((m) => m.status === 'released' || m.status === 'in_progress' || m.status === 'on_hold')
      .map((m) => ({ mo: m, readiness: materialReadiness(m.id, s.materialRequirements) }))
    const chart = [...open].sort((a, b) => a.plannedEnd.localeCompare(b.plannedEnd)).slice(0, 8)
    const activeWip = s.wips.filter((w) => ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0)
    const openWoIds = new Set(
      s.workOrders.filter((w) => w.status !== 'completed' && w.status !== 'cancelled').map((w) => w.id),
    )
    const operatorsOnLeave = s.operators.filter(
      (o) =>
        o.availability === 'leave' &&
        s.workOrders.some((w) => openWoIds.has(w.id) && w.operatorIds.includes(o.id)),
    )
    return {
      open,
      counts: OVERVIEW.map((o) => ({
        ...o,
        count: s.manufacturingOrders.filter((m) => m.status === o.status).length,
      })),
      delayed,
      chart,
      planned: sumBy(open, (m) => m.qty),
      mix: [
        { key: 'good', value: sumBy(open, (m) => m.goodQty), className: 'bg-success', label: 'Good' },
        { key: 'rework', value: sumBy(open, (m) => m.reworkQty), className: 'bg-warning', label: 'Rework' },
        { key: 'reject', value: sumBy(open, (m) => m.rejectQty), className: 'bg-info', label: 'Reject' },
        { key: 'scrap', value: sumBy(open, (m) => m.scrapQty), className: 'bg-accent', label: 'Scrap' },
      ],
      readiness,
      activeWip,
      attention: {
        shortage: readiness.filter((r) => r.readiness === 'shortage').length,
        holds: s.qualityHolds.filter((h) => h.status === 'active').length,
        maintenance: s.machines.filter((m) => m.maintenanceState === 'in_maintenance' || m.state === 'down')
          .length,
        operators: operatorsOnLeave.length,
        delayedWo: s.workOrders.filter((w) => isWoLate(w, now)).length,
        atRisk: open.filter((m) => m.atRisk).length,
      },
    }
  }, [s, now])

  const wipGroups = useMemo(() => {
    const opName = (seq: number) =>
      s.workOrders.find((w) => w.operationSeq === seq)?.operationName ??
      s.bops.flatMap((b) => b.operations).find((o) => o.seq === seq)?.name ??
      ''
    const keyOf = (w: Wip): { key: string; label: string } => {
      if (dimension === 'operation')
        return { key: String(w.operationSeq), label: `${w.operationSeq} · ${opName(w.operationSeq)}` }
      const location = s.maps.location.get(w.locationId)
      const wo = w.woId ? s.maps.wo.get(w.woId) : undefined
      const machine = w.machineId ? s.maps.machine.get(w.machineId) : undefined
      const node =
        orgAncestor(s.orgNodes, location?.orgNodeId ?? null, dimension) ??
        orgAncestor(s.orgNodes, wo?.workCenterId ?? machine?.workCenterId ?? null, dimension)
      return node ? { key: node.id, label: node.name } : { key: 'none', label: 'Not on a plant node' }
    }
    const groups = new Map<string, { label: string; qty: number; batches: number }>()
    for (const w of d.activeWip) {
      const { key, label } = keyOf(w)
      const g = groups.get(key) ?? { label, qty: 0, batches: 0 }
      g.qty += w.qty
      g.batches += 1
      groups.set(key, g)
    }
    return [...groups].map(([key, g]) => ({ key, ...g })).sort((a, b) => b.qty - a.qty)
  }, [s, d.activeWip, dimension])

  const currentWoByMachine = useMemo(
    () =>
      new Map(
        s.workOrders.filter((w) => w.status === 'in_progress' && w.machineId).map((w) => [w.machineId!, w]),
      ),
    [s.workOrders],
  )

  return (
    <>
      <PageHeader
        title="Production control"
        description="One operational view of the site: orders, plan against actual, material, WIP and what needs a decision."
        actions={<p className="text-xs text-muted">Updated {fmtTime(now)} WIB</p>}
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6 grid grid-cols-2">
          {d.counts.map((c) => (
            <StatCard
              key={c.status}
              label={MO_STATUS_LABEL[c.status]}
              value={c.count}
              tone={c.tone}
              icon={<ClipboardList />}
              onClick={() => navigate('/manufacturing/orders')}
            />
          ))}
          <StatCard
            label="Delayed"
            value={d.delayed.length}
            tone={d.delayed.length ? 'danger' : 'success'}
            icon={<TimerOff />}
            hint={d.delayed.length ? 'Behind the planned window' : 'All on schedule'}
            onClick={() => navigate('/manufacturing/orders?view=delayed')}
          />
        </div>

        <Card className="p-4">
          <div className="gap-3 flex flex-wrap items-center justify-between">
            <div>
              <h2 className="font-semibold">Attention required</h2>
              <p className="text-xs text-muted">Open the queue that needs action first.</p>
            </div>
            <div className="gap-2 sm:grid-cols-3 xl:w-auto xl:grid-cols-6 grid w-full grid-cols-2">
              <AttentionLink
                to="/inventory/requirements?view=shortage"
                icon={<PackageX />}
                label="Material shortage"
                count={d.attention.shortage}
                urgent
              />
              <AttentionLink
                to="/quality/holds"
                icon={<PauseOctagon />}
                label="Quality hold"
                count={d.attention.holds}
                urgent
              />
              <AttentionLink
                to="/integration/cmms"
                icon={<Wrench />}
                label="Machine maintenance"
                count={d.attention.maintenance}
              />
              <AttentionLink
                to="/master-data/people"
                icon={<CircleAlert />}
                label="Operator issue"
                count={d.attention.operators}
              />
              <AttentionLink
                to="/manufacturing/work-orders?view=delayed"
                icon={<TimerOff />}
                label="Delayed WO"
                count={d.attention.delayedWo}
              />
              <AttentionLink
                to="/manufacturing/orders?view=at-risk"
                icon={<Siren />}
                label="At-risk MO"
                count={d.attention.atRisk}
                urgent
              />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <h2 className="font-semibold">Machine status</h2>
            <p className="text-xs text-muted">
              {s.machines.filter((m) => m.state === 'running').length} running of {s.machines.length}
            </p>
          </div>
          {s.machines.length === 0 ? (
            <EmptyState
              compact
              title="No machines"
              description="Machines arrive through the CMMS and device monitoring mappings."
            />
          ) : (
            <div className="mt-3 gap-2 flex flex-wrap">
              {s.machines.map((m) => {
                const wo = currentWoByMachine.get(m.id)
                return (
                  <Link
                    key={m.id}
                    to={paths.machine(m.id)}
                    className="h-9 gap-2 pl-3 pr-3.5 text-xs font-semibold inline-flex items-center rounded-full bg-surface-2 transition-colors hover:bg-surface"
                    title={`${m.name} · ${m.state}`}
                  >
                    <StatusDot tone={MACHINE_TONE[m.state]} pulse={m.state === 'running'} />
                    <span className="font-mono">{m.code}</span>
                    <span className={cn('font-normal font-mono', wo ? 'text-foreground' : 'text-muted')}>
                      {wo ? wo.code : 'idle'}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        <div className="gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Plan vs furthest operation</CardTitle>
              <p className="text-xs text-muted">
                Good output at the furthest reported operation for the eight orders due first. Accent marks an
                order behind schedule.
              </p>
            </CardHeader>
            <CardContent>
              {d.chart.length === 0 ? (
                <EmptyState
                  compact
                  title="No open orders"
                  description="Release a manufacturing order to follow its output here."
                />
              ) : (
                <>
                  <ColumnChart
                    ariaLabel="Good quantity at furthest operation per open order"
                    height={200}
                    data={d.chart.map((m) => ({
                      label: m.code,
                      value: moActualQty(m, s.workOrders),
                      highlight: d.delayed.includes(m),
                    }))}
                    format={(v) => fmtNumber(v)}
                  />
                  <ul className="mt-4 space-y-2">
                    {d.chart.map((m) => (
                      <li key={m.id}>
                        <Link
                          to={paths.mo(m.id)}
                          className="rounded-2xl px-2 py-1.5 block transition-colors hover:bg-surface-2"
                        >
                          <span className="gap-2 text-sm flex items-center justify-between">
                            <span className="min-w-0 truncate">
                              <span className="text-xs font-semibold font-mono">{m.code}</span>{' '}
                              <span className="text-muted">{s.productName(m.productId)}</span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {fmtNumber(m.goodQty)} <span className="text-muted">/ {fmtNumber(m.qty)}</span>
                            </span>
                          </span>
                          <ProgressBar
                            value={m.goodQty / Math.max(1, m.qty)}
                            tone={d.delayed.includes(m) ? 'accent' : 'ink'}
                            size="xs"
                            className="mt-1.5"
                            aria-label={`${fmtPercent(m.goodQty / Math.max(1, m.qty))} of plan`}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <SegmentBar segments={d.mix} />
                    <div className="mt-2 gap-4 text-xs flex flex-wrap text-muted">
                      {d.mix.map((seg) => (
                        <span key={seg.key} className="gap-1.5 inline-flex items-center">
                          <span className={cn('size-2 rounded-full', seg.className)} /> {seg.label}{' '}
                          {fmtNumber(seg.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="gap-4 grid grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Material readiness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="gap-2 grid grid-cols-3">
                  <MiniTile
                    label="Ready"
                    value={d.readiness.filter((r) => r.readiness === 'ready').length}
                    className="bg-success-soft text-success"
                  />
                  <MiniTile
                    label="Partial"
                    value={d.readiness.filter((r) => r.readiness === 'partial').length}
                    className="bg-warning-soft text-warning"
                  />
                  <MiniTile
                    label="Shortage"
                    value={d.readiness.filter((r) => r.readiness === 'shortage').length}
                    className="bg-accent-soft text-accent-strong"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {d.readiness.filter((r) => r.readiness === 'shortage').length === 0 ? (
                    <p className="px-1 text-xs text-muted">No order is short of material.</p>
                  ) : (
                    d.readiness
                      .filter((r) => r.readiness === 'shortage')
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
                              {mo.code} · <MoStatusBadge status={mo.status} />
                            </span>
                          </span>
                          <ReadinessBadge readiness={readiness} />
                        </Link>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WIP on the floor</CardTitle>
                <PillTabs
                  size="sm"
                  value={dimension}
                  onValueChange={(v) => setDimension(v as WipDimension)}
                  items={DIMENSIONS}
                  className="mt-1"
                />
              </CardHeader>
              <CardContent>
                {wipGroups.length === 0 ? (
                  <EmptyState
                    compact
                    title="No active WIP"
                    description="Batches appear once operations report output."
                  />
                ) : (
                  <BarList
                    ariaLabel={`Active WIP by ${dimension}`}
                    items={wipGroups.map((g) => ({
                      key: g.key,
                      label: g.label,
                      value: g.qty,
                      display: `${fmtNumber(g.qty)} pcs`,
                      hint: `${g.batches} batches`,
                      onClick: () => navigate('/inventory/wip'),
                    }))}
                  />
                )}
                <Link
                  to="/inventory/wip"
                  className="mt-3 gap-1 text-xs font-semibold inline-flex items-center hover:text-accent"
                >
                  Open WIP view <ArrowUpRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

function MiniTile({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={cn('rounded-2xl px-3 py-2.5', className)}>
      <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
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
