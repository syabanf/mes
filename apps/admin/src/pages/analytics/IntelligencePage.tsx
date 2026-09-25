import {
  type CharacteristicRisk,
  type DelayRisk,
  FACTOR_LABEL,
  type FactorKind,
  type MachineCorrelation,
  type MaterialRiskRow,
  PROBLEM_LABEL,
  type ProblemKind,
  delayPrediction,
  dimensionContext,
  fmtDuration,
  fmtNumber,
  fmtPercent,
  fmtTime,
  maintenanceCorrelation,
  materialRisk,
  qualityRisk,
  rootCauseCandidates,
  shiftSummary,
} from '@mes/fixtures'
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  NativeSelect,
  PageHeader,
  PillTabs,
  ProgressBar,
  Sparkline,
  Steps,
  type StepState,
  cn,
} from '@mes/ui'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { MachineLink, MoLink, WoLink, paths } from '../../components/links'
import { MoPicker } from '../../components/pickers'
import { useNow, useScoped } from '../../state/scoped'

const STAGES = ['Connect', 'Collect', 'Contextualize', 'Execute', 'Analyze', 'Predict', 'Optimize']
const CURRENT_STAGE = 'Predict'

const factorPath = (factor: FactorKind, id: string): string | null => {
  switch (factor) {
    case 'machine':
    case 'downtime':
      return paths.machine(id)
    case 'lot':
      return paths.lot(id)
    case 'quality':
      return paths.inspection(id)
    case 'operator':
      return '/master-data/people'
    case 'process':
      return null
  }
}

export function IntelligencePage() {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const [which, setWhich] = useState<'current' | 'previous'>('current')
  const [problem, setProblem] = useState<ProblemKind>('scrap')
  const [problemMo, setProblemMo] = useState<string | null>(null)

  const ctx = useMemo(() => dimensionContext(s), [s])
  const shift = useMemo(() => shiftSummary(s, now, which), [s, now, which])
  const causes = useMemo(
    () => rootCauseCandidates({ kind: problem, moId: problemMo }, s, ctx).slice(0, 8),
    [problem, problemMo, s, ctx],
  )
  const delays = useMemo(
    () => delayPrediction(s.manufacturingOrders, s.materialRequirements, ctx, now),
    [s, ctx, now],
  )
  const materials = useMemo(
    () => materialRisk(s.materialRequirements, s.materialTxns, s.materialLots, now),
    [s, now],
  )
  const quality = useMemo(() => qualityRisk(s.inspections, s.specifications), [s])
  const machines = useMemo(
    () =>
      maintenanceCorrelation(
        s.machines,
        s.oeeSnapshots,
        s.workOrders,
        s.inspections,
        s.maintenanceRecords,
        ctx,
        now,
      ),
    [s, ctx, now],
  )

  const steps = STAGES.map((stage) => {
    const idx = STAGES.indexOf(stage)
    const cur = STAGES.indexOf(CURRENT_STAGE)
    const state: StepState = idx < cur ? 'done' : idx === cur ? 'current' : 'upcoming'
    return { key: stage, label: stage, state }
  })

  const delayColumns: Column<DelayRisk>[] = [
    {
      id: 'mo',
      header: 'Order',
      cell: (r) => (
        <div className="min-w-0">
          <MoLink moId={r.moId} />
          <div className="mt-1.5 sm:hidden">
            <ProgressBar value={r.risk} tone={r.risk >= 0.7 ? 'accent' : 'warning'} aria-label="Risk" />
          </div>
        </div>
      ),
    },
    {
      id: 'risk',
      header: 'Risk',
      hideBelow: 'sm',
      width: '9rem',
      sortValue: (r) => r.risk,
      cell: (r) => (
        <div>
          <ProgressBar
            value={r.risk}
            tone={r.risk >= 0.7 ? 'accent' : 'warning'}
            aria-label={`Risk ${Math.round(r.risk * 100)}%`}
          />
          <p className="mt-1 text-[11px] text-muted tabular-nums">{fmtPercent(r.risk)}</p>
        </div>
      ),
    },
    {
      id: 'time',
      header: 'Left vs needed',
      align: 'right',
      sortValue: (r) => r.hoursLeft - r.hoursNeeded,
      cell: (r) => (
        <span className="text-xs tabular-nums">
          <span className={cn('font-semibold', r.hoursLeft < 0 && 'text-accent')}>
            {r.hoursLeft < 0 ? `${fmtNumber(-r.hoursLeft, 1)}h over` : `${fmtNumber(r.hoursLeft, 1)}h left`}
          </span>
          <span className="block text-muted">{fmtNumber(r.hoursNeeded, 1)}h needed</span>
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Why',
      hideBelow: 'md',
      cell: (r) => <span className="text-xs text-muted">{r.reason}</span>,
    },
  ]

  const materialColumns: Column<MaterialRiskRow>[] = [
    {
      id: 'material',
      header: 'Material',
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{s.materialName(r.materialId)}</p>
          <p className="sm:hidden text-[11px] text-muted tabular-nums">
            {fmtNumber(r.freeQty)} free · {fmtNumber(r.openQty)} open
          </p>
        </div>
      ),
    },
    {
      id: 'cover',
      header: 'Days of cover',
      align: 'right',
      sortValue: (r) => r.daysOfCover ?? 9999,
      cell: (r) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            r.daysOfCover !== null && r.daysOfCover < 3 ? 'text-accent' : '',
          )}
        >
          {r.daysOfCover === null ? 'No use' : `${fmtNumber(r.daysOfCover, 1)} d`}
        </span>
      ),
    },
    {
      id: 'free',
      header: 'Free',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.freeQty,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.freeQty)}</span>,
    },
    {
      id: 'open',
      header: 'Open requirement',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.openQty,
      cell: (r) => (
        <span className="tabular-nums">
          {fmtNumber(r.openQty)}
          {r.shortfall > 0 && (
            <span className="ml-1 text-[11px] text-accent">short {fmtNumber(r.shortfall)}</span>
          )}
        </span>
      ),
    },
    {
      id: 'link',
      header: '',
      hideBelow: 'md',
      align: 'right',
      cell: (r) =>
        r.requirementIds[0] ? (
          <Link
            to={paths.requirement(r.requirementIds[0])}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold hover:text-accent"
          >
            {r.requirementIds.length} requirement{r.requirementIds.length === 1 ? '' : 's'}
          </Link>
        ) : null,
    },
  ]

  const machineColumns: Column<MachineCorrelation>[] = [
    {
      id: 'machine',
      header: 'Machine',
      cell: (r) => (
        <div className="min-w-0">
          <MachineLink machineId={r.machineId} />
          <div className="mt-1.5 sm:hidden">
            <CorrelationBadge flagged={r.flagged} />
          </div>
        </div>
      ),
    },
    {
      id: 'downtime',
      header: 'Downtime',
      align: 'right',
      sortValue: (r) => r.downtimeMin,
      cell: (r) => <span className="tabular-nums">{fmtDuration(r.downtimeMin)}</span>,
    },
    {
      id: 'failed',
      header: 'Failed insp.',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.failedInspectionRate ?? -1,
      cell: (r) => (
        <span
          className={cn('tabular-nums', (r.failedInspectionRate ?? 0) >= 0.2 && 'font-semibold text-accent')}
        >
          {r.failedInspectionRate === null ? '—' : fmtPercent(r.failedInspectionRate)}
        </span>
      ),
    },
    {
      id: 'cycle',
      header: 'Cycle vs std',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.cycleDeviation ?? -1,
      cell: (r) => (
        <span className={cn('tabular-nums', (r.cycleDeviation ?? 0) >= 0.15 && 'font-semibold text-warning')}>
          {r.cycleDeviation === null
            ? '—'
            : `${r.cycleDeviation > 0 ? '+' : ''}${fmtPercent(r.cycleDeviation)}`}
        </span>
      ),
    },
    {
      id: 'maintenance',
      header: 'Maint.',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.maintenanceCount,
      cell: (r) => <span className="tabular-nums">{r.maintenanceCount}</span>,
    },
    {
      id: 'note',
      header: 'Reading',
      hideBelow: 'lg',
      cell: (r) => <span className="text-xs text-muted">{r.note}</span>,
    },
    {
      id: 'badge',
      header: '',
      hideBelow: 'sm',
      align: 'right',
      cell: (r) => <CorrelationBadge flagged={r.flagged} />,
    },
  ]

  const qualityIssues = shift.failedInspectionIds.length + shift.holdIds.length

  return (
    <>
      <PageHeader
        title="Intelligence"
        description="Summaries, correlations and predictions built on the execution record. Every reading links to the orders, machines and inspections behind it."
      />
      <div className="space-y-4">
        <Card className="p-5">
          <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Connect to optimize: the platform is at the predict stage
          </p>
          <Steps steps={steps} />
        </Card>

        <div className="gap-4 xl:grid-cols-2 grid grid-cols-1">
          <Card variant="ink" className="p-5 relative overflow-hidden">
            <div className="gap-3 flex flex-wrap items-start justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wider text-on-ink-muted uppercase">
                  Shift summary
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">
                  {shift.window.shift ? `${shift.window.shift.name} shift` : 'Outside shift hours'}
                </h2>
                <p className="text-sm text-on-ink-muted">
                  {fmtTime(shift.window.from)} to {fmtTime(shift.window.to)}
                </p>
              </div>
              <PillTabs
                size="sm"
                value={which}
                onValueChange={(v) => setWhich(v as 'current' | 'previous')}
                items={[
                  { value: 'current', label: 'Current' },
                  { value: 'previous', label: 'Last shift' },
                ]}
              />
            </div>
            <div className="mt-5 gap-4 sm:grid-cols-5 grid grid-cols-3">
              <Metric label="Output" value={fmtNumber(shift.outputQty)} unit="pcs" />
              <Metric label="Delayed" value={shift.delayed.length} unit="WO" />
              <Metric label="Quality issues" value={qualityIssues} />
              <Metric label="Downtime" value={fmtNumber(shift.downtimeMin)} unit="min" />
              <Metric label="Shortages" value={shift.shortageRequirementIds.length} />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-on-ink-muted">{shift.paragraph}</p>
            <div className="mt-4 gap-x-4 gap-y-1 text-xs flex flex-wrap items-center">
              <span className="font-semibold text-on-ink-muted">Evidence</span>
              {shift.delayed.slice(0, 3).map((d) => (
                <WoLink key={d.woId} woId={d.woId} className="text-white" />
              ))}
              {shift.holdIds.slice(0, 2).map((id) => (
                <Link key={id} to={paths.hold(id)} className="font-medium font-mono hover:text-accent">
                  {s.maps.hold.get(id)?.code ?? 'Hold'}
                </Link>
              ))}
              {shift.failedInspectionIds.slice(0, 2).map((id) => (
                <Link key={id} to={paths.inspection(id)} className="font-medium font-mono hover:text-accent">
                  {s.maps.inspection.get(id)?.code ?? 'Inspection'}
                </Link>
              ))}
              {shift.downtimeByMachine.slice(0, 2).map((d) => (
                <Link
                  key={d.machineId}
                  to={paths.machine(d.machineId)}
                  className="font-medium hover:text-accent"
                >
                  {s.maps.machine.get(d.machineId)?.code ?? d.machineId} {fmtDuration(d.minutes)}
                </Link>
              ))}
              {shift.shortageRequirementIds.length > 0 && (
                <Link to="/inventory/requirements?view=shortage" className="font-medium hover:text-accent">
                  Shortages
                </Link>
              )}
              {shift.delayed.length +
                shift.holdIds.length +
                shift.failedInspectionIds.length +
                shift.downtimeByMachine.length ===
                0 && <span className="text-on-ink-muted">Nothing to flag.</span>}
            </div>
            <div
              aria-hidden
              className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Root cause assistant</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Compares the rate on each factor with the site average. Higher lift, stronger signal.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] grid grid-cols-1">
                <NativeSelect
                  aria-label="Problem"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value as ProblemKind)}
                  options={(Object.keys(PROBLEM_LABEL) as ProblemKind[]).map((k) => ({
                    value: k,
                    label: PROBLEM_LABEL[k],
                  }))}
                />
                <MoPicker
                  value={problemMo}
                  onChange={setProblemMo}
                  clearable
                  placeholder="Any order"
                  aria-label="Narrow to an order"
                />
              </div>
              {causes.length === 0 ? (
                <EmptyState
                  compact
                  title="No correlated factor"
                  description="Nothing in the selected scope shows this problem, or no factor stands out from the site average."
                />
              ) : (
                <ul className="space-y-2">
                  {causes.map((f) => {
                    const to = factorPath(f.factor, f.id)
                    return (
                      <li key={`${f.factor}-${f.id}`} className="rounded-2xl p-3 bg-surface-2">
                        <div className="gap-2 flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="gap-2 flex flex-wrap items-center">
                              <Badge variant="outline">{FACTOR_LABEL[f.factor]}</Badge>
                              {to ? (
                                <Link to={to} className="text-sm font-semibold truncate hover:text-accent">
                                  {f.label}
                                </Link>
                              ) : (
                                <span className="text-sm font-semibold truncate">{f.label}</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted">{f.evidence}</p>
                          </div>
                          <span className="text-sm font-bold shrink-0 tabular-nums">
                            {fmtPercent(f.score)}
                          </span>
                        </div>
                        <ProgressBar
                          value={f.score}
                          tone={f.score >= 0.5 ? 'accent' : 'ink'}
                          className="mt-2"
                          aria-label={`Lift ${Math.round(f.score * 100)}%`}
                        />
                        <div className="mt-2 gap-2 flex flex-wrap items-center">
                          {f.woIds.slice(0, 4).map((id) => (
                            <WoLink key={id} woId={id} />
                          ))}
                          {f.woIds.length > 4 && (
                            <span className="text-[11px] text-muted">+{f.woIds.length - 4} more</span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delay prediction</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Remaining operations at standard cycle against the time left before the planned end.
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={delayColumns}
                rows={delays}
                getRowKey={(r) => r.moId}
                pageSize={6}
                onRowClick={(r) => navigate(paths.mo(r.moId))}
                empty={
                  <EmptyState
                    compact
                    title="Every open order fits its plan"
                    description="Orders appear here once the work left outgrows the time left."
                  />
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Material risk</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Free stock against open requirements at the consumption rate of the last seven days.
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={materialColumns}
                rows={materials}
                getRowKey={(r) => r.materialId}
                pageSize={6}
                onRowClick={(r) =>
                  navigate(
                    r.requirementIds[0] ? paths.requirement(r.requirementIds[0]) : '/inventory/requirements',
                  )
                }
                empty={
                  <EmptyState
                    compact
                    title="Stock covers the plan"
                    description="Materials appear here when free stock runs out before open requirements are met."
                  />
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality risk</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Characteristics whose last ten readings drift toward a limit, and operations whose pass rate
                dropped.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {quality.characteristics.length === 0 && quality.fpy.length === 0 ? (
                <EmptyState
                  compact
                  title="Process is centred"
                  description="No numeric characteristic sits near a limit and first-pass yield is steady."
                />
              ) : (
                <>
                  {quality.characteristics.slice(0, 6).map((c) => (
                    <CharacteristicRow
                      key={c.characteristicId}
                      c={c}
                      productName={s.productName(c.productId)}
                    />
                  ))}
                  {quality.fpy.map((f) => (
                    <div key={`${f.productId}-${f.operationSeq}`} className="rounded-2xl p-3 bg-surface-2">
                      <div className="gap-2 flex flex-wrap items-center justify-between">
                        <span className="text-sm font-semibold">
                          {s.productName(f.productId)} · operation {f.operationSeq}
                        </span>
                        <Badge variant="warning">FPY drop</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Pass rate {fmtPercent(f.recent)} on the last {f.inspectionIds.length} inspections,
                        down from {fmtPercent(f.previous)}.{' '}
                        <Link
                          to={paths.inspection(f.inspectionIds.at(-1)!)}
                          className="font-semibold hover:text-accent"
                        >
                          Latest inspection
                        </Link>
                      </p>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance correlation</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Downtime, failed inspections and cycle time deviation per machine next to its CMMS history.
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={machineColumns}
                rows={machines}
                getRowKey={(r) => r.machineId}
                pageSize={6}
                onRowClick={(r) => navigate(paths.machine(r.machineId))}
                empty={
                  <EmptyState
                    compact
                    title="No machines"
                    description="Machines appear once the site has equipment."
                  />
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1 flex items-baseline leading-none">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}

function CorrelationBadge({ flagged }: { flagged: boolean }) {
  return flagged ? (
    <Badge variant="accent" dot>
      Correlated
    </Badge>
  ) : (
    <Badge variant="muted">Normal</Badge>
  )
}

function CharacteristicRow({ c, productName }: { c: CharacteristicRisk; productName: string }) {
  return (
    <div className="rounded-2xl p-3 bg-surface-2">
      <div className="gap-3 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {c.name} · {productName}
          </p>
          <p className="text-[11px] text-muted tabular-nums">
            {c.min !== null ? `min ${c.min}` : ''}
            {c.min !== null && c.max !== null ? ' · ' : ''}
            {c.max !== null ? `max ${c.max}` : ''}
            {c.target !== null ? ` · target ${c.target}` : ''} {c.unit}
          </p>
        </div>
        <Badge variant={c.severity === 'risk' ? 'danger' : 'warning'}>
          {c.severity === 'risk' ? 'Trending to limit' : 'Near limit'}
        </Badge>
      </div>
      <Sparkline
        className="mt-2"
        data={c.readings}
        highlightLast={c.severity === 'risk'}
        format={(v) => `${v} ${c.unit}`}
        ariaLabel={`Last ${c.readings.length} readings of ${c.name}`}
      />
      <p className="mt-2 text-xs text-muted">
        {c.note}{' '}
        <Link to={paths.inspection(c.inspectionIds.at(-1)!)} className="font-semibold hover:text-accent">
          Latest inspection
        </Link>
      </p>
    </div>
  )
}
