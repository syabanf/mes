import { dayKey, fmtDateShort, fmtDuration, fmtNumber, fmtPercent, groupBy, oeeAverage } from '@mes/fixtures'
import type { OeeSnapshot } from '@mes/types'
import {
  BarList,
  Banner,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ColumnChart,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  PillTabs,
  StatCard,
} from '@mes/ui'
import { Activity, Clock, Gauge, ShieldCheck, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { MoLink, WoLink } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { OEE_GROUPS, type OeeGroup, type OeeWindow, mesToOeePayload, oeeGroupKey, oeeWindow } from './lib'

export function OeePage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [window, setWindow] = useHistoryState<OeeWindow>('window', '7')
  const [group, setGroup] = useHistoryState<OeeGroup>('group', 'machine')
  const range = oeeWindow(window, now)

  const snaps = useMemo(
    () =>
      s.oeeSnapshots
        .filter((o) => o.date >= range.fromKey && o.date <= range.toKey)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [s.oeeSnapshots, range.fromKey, range.toKey],
  )
  const avg = useMemo(() => oeeAverage(snaps), [snaps])
  const groups = useMemo(() => {
    const labels = new Map<string, string>()
    const map = groupBy(snaps, (o) => {
      const g = oeeGroupKey(s, o, group)
      labels.set(g.key, g.label)
      return g.key
    })
    return [...map.entries()]
      .map(([key, list]) => ({
        key,
        label: labels.get(key) ?? key,
        value: Math.round(oeeAverage(list).oee * 100),
        count: list.length,
      }))
      .sort((a, b) => b.value - a.value)
  }, [snaps, group, s])
  const daily = useMemo(
    () =>
      range.days.map((d) => ({
        label: fmtDateShort(`${d}T00:00:00+07:00`),
        value: Math.round(oeeAverage(snaps.filter((o) => o.date === d)).oee * 100),
        highlight: d === dayKey(now),
      })),
    [range.days, snaps, now],
  )
  const running =
    s.workOrders.find((w) => w.status === 'in_progress' && w.machineId) ??
    s.workOrders.find((w) => w.status === 'in_progress')
  const payload = running ? mesToOeePayload(s, running) : null

  const columns: Column<OeeSnapshot>[] = [
    {
      id: 'date',
      header: 'Date',
      sortValue: (o) => o.date,
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold">{fmtDateShort(`${o.date}T00:00:00+07:00`)}</p>
          <p className="text-xs text-muted">{s.maps.shift.get(o.shiftId)?.name ?? o.shiftId}</p>
        </div>
      ),
    },
    {
      id: 'machine',
      header: 'Machine',
      sortValue: (o) => s.maps.machine.get(o.machineId)?.code ?? '',
      cell: (o) => (
        <span className="font-semibold">{s.maps.machine.get(o.machineId)?.code ?? o.machineId}</span>
      ),
    },
    {
      id: 'mo',
      header: 'MO / WO',
      hideBelow: 'md',
      cell: (o) =>
        o.moId ? (
          <span className="flex flex-col">
            <MoLink moId={o.moId} showProduct={false} />
            {o.woId && <WoLink woId={o.woId} className="text-muted" />}
          </span>
        ) : (
          <span className="text-muted">Idle</span>
        ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'lg',
      cell: (o) => (o.productId ? s.productName(o.productId) : <span className="text-muted">–</span>),
    },
    {
      id: 'operator',
      header: 'Operator',
      hideBelow: 'xl',
      cell: (o) => (o.operatorId ? s.personName(o.operatorId) : <span className="text-muted">–</span>),
    },
    {
      id: 'a',
      header: 'A',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (o) => o.availability,
      cell: (o) => <span className="tabular-nums">{fmtPercent(o.availability)}</span>,
    },
    {
      id: 'p',
      header: 'P',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (o) => o.performance,
      cell: (o) => <span className="tabular-nums">{fmtPercent(o.performance)}</span>,
    },
    {
      id: 'q',
      header: 'Q',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (o) => o.quality,
      cell: (o) => <span className="tabular-nums">{fmtPercent(o.quality)}</span>,
    },
    {
      id: 'oee',
      header: 'OEE',
      align: 'right',
      sortValue: (o) => o.oee,
      cell: (o) => (
        <span className={`font-semibold tabular-nums ${o.oee < 0.6 ? 'text-accent' : ''}`}>
          {fmtPercent(o.oee)}
        </span>
      ),
    },
    {
      id: 'down',
      header: 'Downtime',
      align: 'right',
      hideBelow: 'md',
      sortValue: (o) => o.downtimeMin,
      cell: (o) => <span className="tabular-nums">{fmtDuration(o.downtimeMin)}</span>,
    },
    {
      id: 'qty',
      header: 'Actual / target',
      align: 'right',
      hideBelow: 'lg',
      cell: (o) => (
        <span className="tabular-nums">
          {fmtNumber(o.actualQty)} / {fmtNumber(o.targetQty)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="OEE"
        description="Availability, performance and quality as the OEE system computes them, sliced by the production context MES supplied."
        actions={
          <PillTabs
            value={window}
            onValueChange={(v) => setWindow(v as OeeWindow)}
            items={[
              { value: 'today', label: 'Today' },
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
            ]}
          />
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-5 grid grid-cols-2">
          <StatCard
            label="OEE"
            value={fmtPercent(avg.oee)}
            hint={`${avg.count} snapshots`}
            icon={<Gauge />}
            tone={avg.oee >= 0.75 ? 'success' : avg.oee >= 0.6 ? 'warning' : 'danger'}
          />
          <StatCard
            label="Availability"
            value={fmtPercent(avg.availability)}
            icon={<Activity />}
            tone="ink"
          />
          <StatCard label="Performance" value={fmtPercent(avg.performance)} icon={<Timer />} />
          <StatCard label="Quality" value={fmtPercent(avg.quality)} icon={<ShieldCheck />} />
          <StatCard
            label="Downtime"
            value={fmtNumber(avg.downtimeMin)}
            unit="min"
            hint={fmtDuration(avg.downtimeMin)}
            icon={<Clock />}
            tone={avg.downtimeMin > 240 ? 'warning' : 'default'}
          />
        </div>

        <div className="gap-4 xl:grid-cols-2 grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Analyze by</CardTitle>
              <CardDescription>Average OEE per group over the window.</CardDescription>
              <PillTabs
                size="sm"
                className="mt-2"
                value={group}
                onValueChange={(v) => setGroup(v as OeeGroup)}
                items={OEE_GROUPS}
              />
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <EmptyState
                  compact
                  title="No snapshots in the window"
                  description="OEE snapshots arrive per shift and machine."
                />
              ) : (
                <BarList
                  max={100}
                  items={groups.map((g) => ({
                    key: g.key,
                    label: g.label,
                    value: g.value,
                    display: `${g.value}%`,
                    hint: `${g.count} snapshots`,
                    emphasis: g.value < 60,
                  }))}
                  ariaLabel={`OEE by ${OEE_GROUPS.find((g) => g.value === group)?.label}`}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Daily OEE</CardTitle>
              <CardDescription>Today is highlighted.</CardDescription>
            </CardHeader>
            <CardContent>
              <ColumnChart
                data={daily}
                format={(v) => `${v}%`}
                referenceLine={{ value: 85, label: 'World class' }}
                ariaLabel="Daily OEE percentage"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Snapshots</CardTitle>
          </CardHeader>
          <DataTable
            columns={columns}
            rows={snaps}
            getRowKey={(o) => o.id}
            pageSize={12}
            resetPageKey={window}
            empty={
              <EmptyState compact title="No snapshots" description="Nothing was reported in this window." />
            }
          />
        </Card>

        <div className="gap-4 xl:grid-cols-[minmax(0,1fr)_28rem] grid grid-cols-1">
          <Banner tone="neutral" title="OEE remains the calculation owner">
            MES does not duplicate the computation. It sends MO, WO, product, revision, operation, machine,
            shift, operator, standard cycle and target quantity, and reads availability, performance, quality,
            OEE, downtime and production loss back.
          </Banner>
          <Card>
            <CardHeader>
              <CardTitle>MES → OEE</CardTitle>
              <CardDescription>
                {running
                  ? `Context payload for ${running.code}, running now.`
                  : 'No work order is running; sample payload shown when one starts.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-2xl p-4 text-xs leading-relaxed text-white overflow-x-auto bg-ink">
                {JSON.stringify(
                  payload ?? {
                    mo: null,
                    wo: null,
                    product: null,
                    productRevision: null,
                    operation: null,
                    machine: null,
                    shift: null,
                    operator: [],
                    standardCycleSec: null,
                    targetQty: null,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
