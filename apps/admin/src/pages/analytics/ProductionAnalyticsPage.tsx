import {
  DAY,
  DIMENSIONS,
  DIMENSION_LABEL,
  DIMENSION_NEXT,
  METRICS,
  type Dimension,
  type MaterialVarianceRow,
  type MetricId,
  analyticsInput,
  bottleneckRanking,
  delayReasonCounts,
  fmtDateShort,
  fmtDuration,
  fmtNumber,
  fmtPercent,
  materialVarianceRows,
  metricByDimension,
  outputByDay,
  throughputByDay,
  wipAgingBuckets,
} from '@mes/fixtures'
import {
  BarList,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Chip,
  ChipRow,
  type Column,
  ColumnChart,
  Combobox,
  DataTable,
  EmptyState,
  LineChart,
  PageHeader,
  PillTabs,
  ProgressBar,
  SegmentBar,
  StatCard,
  type Tone,
  cn,
} from '@mes/ui'
import { Boxes, CalendarCheck, Gauge, Hourglass, PackageX, Recycle, Timer, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { MoLink, paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { dimensionPath, fmtMetric } from './lib'

const WINDOWS = [7, 14, 30]
const BUCKET_COLORS = ['bg-success', 'bg-info', 'bg-warning', 'bg-accent']

interface Filter {
  dimension: Dimension
  key: string
  label: string
}

const toneByThreshold = (value: number, good: number, fair: number, higherIsBetter = true): Tone => {
  const ok = higherIsBetter ? value >= good : value <= good
  const fine = higherIsBetter ? value >= fair : value <= fair
  return ok ? 'success' : fine ? 'warning' : 'danger'
}

export function ProductionAnalyticsPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [days, setDays] = useHistoryState('window', 7)
  const [dimension, setDimension] = useHistoryState<Dimension>('dimension', 'line')
  const [metric, setMetric] = useHistoryState<MetricId>('metric', 'scheduleAdherence')
  const [filter, setFilter] = useHistoryState<Filter | null>('filter', null)

  const input = useMemo(
    () =>
      analyticsInput(
        s,
        now - days * DAY,
        now,
        now,
        filter ? { dimension: filter.dimension, key: filter.key } : null,
      ),
    [s, now, days, filter],
  )

  const d = useMemo(() => {
    const overall = (id: MetricId) => metricByDimension(id, input, 'plant')
    const cycle = overall('cycleTime')
    const buckets = wipAgingBuckets(input)
    return {
      adherence: overall('scheduleAdherence').overall,
      throughput: overall('throughput').overall,
      cycle: cycle.overall,
      cycleStandard: cycle.standard ?? 0,
      leadTime: overall('leadTime').overall,
      yieldRate: overall('yieldRate').overall,
      scrapRate: overall('scrapRate').overall,
      reworkRate: overall('reworkRate').overall,
      buckets,
      aging: buckets.filter((b) => b.key !== 'fresh').reduce((n, b) => n + b.count, 0),
      output: outputByDay(input),
      throughputDays: throughputByDay(input),
      bottlenecks: bottleneckRanking(input).slice(0, 6),
      delays: delayReasonCounts(input).slice(0, 8),
      variance: materialVarianceRows(input)
        .filter((r) => r.variance !== 0)
        .slice(0, 40),
    }
  }, [input])

  const grouped = useMemo(() => metricByDimension(metric, input, dimension), [metric, input, dimension])
  const metricMeta = METRICS.find((m) => m.id === metric)!
  const next = DIMENSION_NEXT[dimension]

  const drill = (key: string, label: string) => {
    if (!next || key === 'none') return
    setFilter({ dimension, key, label })
    setDimension(next)
  }

  const plannedTotal = d.output.reduce((n, day) => n + day.planned, 0)
  const actualTotal = d.output.reduce((n, day) => n + day.actual, 0)
  const activeDays = d.output.filter((day) => day.planned > 0).length
  const lastWithOutput = d.output.map((day) => day.actual > 0).lastIndexOf(true)

  const varianceColumns: Column<MaterialVarianceRow>[] = [
    {
      id: 'mo',
      header: 'Order',
      sortValue: (r) => s.maps.mo.get(r.moId)?.code ?? r.moId,
      cell: (r) => <MoLink moId={r.moId} showProduct={false} />,
    },
    {
      id: 'material',
      header: 'Material',
      sortValue: (r) => s.materialName(r.materialId),
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{s.materialName(r.materialId)}</p>
          <p className="sm:hidden text-[11px] text-muted tabular-nums">
            {fmtNumber(r.requiredQty, 1)} required · {fmtNumber(r.consumedQty, 1)} consumed
          </p>
        </div>
      ),
    },
    {
      id: 'required',
      header: 'Required',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.requiredQty,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.requiredQty, 1)}</span>,
    },
    {
      id: 'consumed',
      header: 'Consumed',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.consumedQty,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.consumedQty, 1)}</span>,
    },
    {
      id: 'variance',
      header: 'Variance',
      align: 'right',
      sortValue: (r) => Math.abs(r.variance),
      cell: (r) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            Math.abs(r.variance) > 0.05 ? 'text-accent' : r.variance > 0 ? 'text-warning' : 'text-success',
          )}
        >
          {r.variance > 0 ? '+' : ''}
          {fmtPercent(r.variance, 1)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Production analytics"
        description="Execution history as metrics you can drill from plant to operator. Pick a window, choose what to group by, and open a row to go one level finer."
        actions={
          <PillTabs
            size="sm"
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
            items={WINDOWS.map((w) => ({ value: String(w), label: `${w} days` }))}
          />
        }
      />
      <div className="space-y-4">
        <div className="gap-2 flex flex-wrap items-center justify-between">
          <div className="gap-2 min-w-0 flex flex-wrap items-center">
            <span className="text-xs font-semibold text-muted">Analyze by</span>
            <PillTabs
              size="sm"
              value={dimension}
              onValueChange={(v) => setDimension(v as Dimension)}
              items={DIMENSIONS.map((dim) => ({ value: dim, label: DIMENSION_LABEL[dim] }))}
            />
          </div>
          {filter && (
            <ChipRow>
              <Chip variant="filter" active icon={<X />} onClick={() => setFilter(null)}>
                {DIMENSION_LABEL[filter.dimension]}: {filter.label}
              </Chip>
            </ChipRow>
          )}
        </div>

        <div className="gap-3 sm:gap-4 md:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Schedule adherence"
            value={fmtPercent(d.adherence)}
            hint="Finished by planned end"
            icon={<CalendarCheck />}
            tone={toneByThreshold(d.adherence, 0.9, 0.7)}
          />
          <StatCard
            label="Throughput"
            value={fmtNumber(d.throughput)}
            unit="pcs/h"
            hint="Good pieces per run hour"
            icon={<Gauge />}
            tone="ink"
          />
          <StatCard
            label="Cycle time"
            value={fmtNumber(d.cycle, 1)}
            unit="s/pc"
            hint={d.cycleStandard ? `Standard ${fmtNumber(d.cycleStandard, 1)} s` : 'No standard in BOP'}
            icon={<Timer />}
            tone={
              d.cycleStandard
                ? toneByThreshold(d.cycle, d.cycleStandard * 1.1, d.cycleStandard * 1.3, false)
                : 'default'
            }
          />
          <StatCard
            label="Lead time"
            value={fmtNumber(d.leadTime, 1)}
            unit="h"
            hint="First start to last finish per order"
            icon={<Hourglass />}
          />
          <StatCard
            label="Yield"
            value={fmtPercent(d.yieldRate, 1)}
            hint="Good of everything produced"
            icon={<Boxes />}
            tone={toneByThreshold(d.yieldRate, 0.98, 0.95)}
          />
          <StatCard
            label="Scrap rate"
            value={fmtPercent(d.scrapRate, 1)}
            icon={<Trash2 />}
            tone={toneByThreshold(d.scrapRate, 0.01, 0.03, false)}
          />
          <StatCard
            label="Rework rate"
            value={fmtPercent(d.reworkRate, 1)}
            icon={<Recycle />}
            tone={toneByThreshold(d.reworkRate, 0.01, 0.03, false)}
          />
          <StatCard
            label="WIP aging"
            value={d.aging}
            unit="batches"
            hint={`Older than ${input.wipAgingHours}h`}
            icon={<PackageX />}
            tone={d.aging === 0 ? 'success' : d.aging < 5 ? 'warning' : 'danger'}
          />
        </div>

        <div className="gap-4 xl:grid-cols-2 grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Plan vs actual per day</CardTitle>
            </CardHeader>
            <CardContent>
              <ColumnChart
                ariaLabel="Good output per day against the planned quantity"
                data={d.output.map((day, i) => ({
                  label: fmtDateShort(day.ms),
                  value: day.actual,
                  highlight: i === lastWithOutput,
                }))}
                format={(v) => fmtNumber(v)}
                referenceLine={
                  activeDays ? { value: plannedTotal / activeDays, label: 'Planned per day' } : undefined
                }
              />
              <p className="mt-3 text-xs text-muted">
                {fmtNumber(actualTotal)} good of {fmtNumber(plannedTotal)} planned at the final operation
                {plannedTotal ? ` · ${fmtPercent(actualTotal / plannedTotal)}` : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Throughput per day</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart
                ariaLabel="Good pieces per run hour per day"
                data={d.throughputDays.map((day) => ({
                  label: fmtDateShort(day.ms),
                  value: day.value > 0 ? day.value : null,
                }))}
                format={(v) => `${fmtNumber(v)}/h`}
                area
              />
            </CardContent>
          </Card>
        </div>

        <div className="gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] grid grid-cols-1">
          <Card>
            <CardHeader
              action={
                <Combobox
                  variant="inline"
                  aria-label="Metric"
                  items={METRICS}
                  getKey={(m) => m.id}
                  getLabel={(m) => m.label}
                  getDescription={(m) => m.description}
                  value={metric}
                  onChange={(v) => v && setMetric(v as MetricId)}
                  className="sm:w-64 w-full"
                />
              }
            >
              <CardTitle>
                {metricMeta.label} by {DIMENSION_LABEL[dimension].toLowerCase()}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                {metricMeta.description}. Overall {fmtMetric(metricMeta.unit, grouped.overall)}
                {grouped.standard ? ` against standard ${fmtMetric(metricMeta.unit, grouped.standard)}` : ''}.
                {next ? ` Open a row to group by ${DIMENSION_LABEL[next].toLowerCase()}.` : ''}
              </p>
            </CardHeader>
            <CardContent>
              {grouped.rows.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing to group"
                  description="No work orders finished in this window with the current filter. Widen the window or clear the filter."
                />
              ) : (
                <BarList
                  ariaLabel={`${metricMeta.label} by ${DIMENSION_LABEL[dimension]}`}
                  items={grouped.rows.slice(0, 12).map((row) => {
                    const to = dimensionPath(dimension, row.key)
                    return {
                      key: row.key,
                      label: to ? (
                        <Link to={to} onClick={(e) => e.stopPropagation()} className="hover:text-accent">
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      ),
                      value: row.value,
                      display: fmtMetric(metricMeta.unit, row.value),
                      hint:
                        row.standard !== undefined && row.standard > 0
                          ? `${row.count} · std ${fmtMetric(metricMeta.unit, row.standard)}`
                          : `${row.count}`,
                      emphasis: filter?.key === row.key,
                      onClick: next && row.key !== 'none' ? () => drill(row.key, row.label) : undefined,
                    }
                  })}
                />
              )}
            </CardContent>
          </Card>

          <div className="gap-4 grid grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Bottlenecks</CardTitle>
                <p className="mt-0.5 text-xs text-muted">
                  Queue minutes before an operation starts, with the planned load of the work center.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.bottlenecks.length === 0 ? (
                  <EmptyState
                    compact
                    title="No queues"
                    description="Queue time appears once operations follow each other."
                  />
                ) : (
                  d.bottlenecks.map((row, i) => (
                    <Link
                      key={row.workCenterId}
                      to={paths.capacity(row.workCenterId)}
                      className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                    >
                      <span className="size-9 rounded-xl text-xs font-bold flex shrink-0 items-center justify-center bg-card tabular-nums shadow-card">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="gap-2 flex items-baseline justify-between">
                          <span className="text-sm font-semibold truncate">
                            {s.orgName(row.workCenterId)}
                          </span>
                          <span className="text-sm font-semibold shrink-0 tabular-nums">
                            {fmtDuration(row.avgQueueMin)}
                          </span>
                        </span>
                        <span className="mt-1.5 gap-2 flex items-center">
                          <ProgressBar
                            value={Math.min(1, row.load)}
                            tone={row.load > 1 ? 'accent' : row.load > 0.8 ? 'warning' : 'ink'}
                            className="flex-1"
                            aria-label={`Load ${Math.round(row.load * 100)}%`}
                          />
                          <span className="shrink-0 text-[11px] text-muted tabular-nums">
                            {fmtPercent(row.load)} load · {row.woCount} WO
                          </span>
                        </span>
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delay reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {d.delays.length === 0 ? (
                  <EmptyState
                    compact
                    title="No delays recorded"
                    description="Pauses, holds and risk flags land here."
                  />
                ) : (
                  <BarList
                    tone="info"
                    ariaLabel="Delay events by reason"
                    items={d.delays.map((row) => ({
                      key: row.key,
                      label: row.label,
                      value: row.value,
                      display: fmtNumber(row.value),
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Material variance</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Consumed against the BOM-required quantity for orders finished in the window.
              </p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={varianceColumns}
                rows={d.variance}
                getRowKey={(r) => r.requirementId}
                pageSize={8}
                initialSort={{ id: 'variance', desc: true }}
                resetPageKey={`${days}|${filter?.key ?? ''}`}
                empty={
                  <EmptyState
                    compact
                    title="Consumption on plan"
                    description="Every finished order consumed exactly what the BOM required."
                  />
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WIP aging</CardTitle>
            </CardHeader>
            <CardContent>
              <SegmentBar
                segments={d.buckets.map((b, i) => ({
                  key: b.key,
                  value: b.count,
                  label: b.label,
                  className: BUCKET_COLORS[i]!,
                }))}
              />
              <ul className="mt-3 space-y-1.5">
                {d.buckets.map((b, i) => (
                  <li key={b.key} className="gap-2 text-sm flex items-center justify-between">
                    <span className="gap-2 inline-flex items-center">
                      <span className={cn('size-2 rounded-full', BUCKET_COLORS[i])} />
                      {b.label}
                    </span>
                    <span className="text-muted tabular-nums">
                      <span className="font-semibold text-foreground">{b.count}</span> · {fmtNumber(b.qty)}{' '}
                      pcs
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/inventory/wip" className="mt-3 text-xs font-semibold block hover:text-accent">
                Open WIP view
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
