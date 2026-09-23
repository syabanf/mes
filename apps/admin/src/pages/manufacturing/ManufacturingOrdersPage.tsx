import { fmtDateShort, fmtNumber, isMoDelayed, materialReadiness, moProgress } from '@mes/fixtures'
import type { ManufacturingOrder, MoStatus } from '@mes/types'
import { MO_STATUS_LABEL, OPEN_MO_STATUSES } from '@mes/types'
import {
  Button,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  Input,
  PageHeader,
  ProgressBar,
  StatCard,
} from '@mes/ui'
import { CalendarClock, ClipboardList, Plus, Search, Siren, TimerOff } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { MoStatusBadge, PriorityBadge, ReadinessBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'

const STATUS_CHIPS: MoStatus[] = [
  'draft',
  'planned',
  'released',
  'in_progress',
  'on_hold',
  'completed',
  'closed',
]
type View = 'all' | 'open' | 'at-risk' | 'delayed'

export function ManufacturingOrdersPage() {
  const s = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View | null) ?? 'all'
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<MoStatus | null>('status', null)
  const table = useTableHistory()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...s.manufacturingOrders]
      .filter((m) => {
        if (status && m.status !== status) return false
        if (view === 'open' && !OPEN_MO_STATUSES.includes(m.status)) return false
        if (view === 'at-risk' && !(m.atRisk && m.status !== 'closed' && m.status !== 'cancelled'))
          return false
        if (view === 'delayed' && !isMoDelayed(m, s.workOrders, now, s.settings.delayThresholdPct))
          return false
        if (!q) return true
        return `${m.code} ${s.productName(m.productId)} ${s.productCode(m.productId)}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [s, query, status, view, now])

  const stats = useMemo(() => {
    const open = s.manufacturingOrders.filter((m) => OPEN_MO_STATUSES.includes(m.status))
    return {
      open: open.length,
      inProgress: open.filter((m) => m.status === 'in_progress').length,
      atRisk: open.filter((m) => m.atRisk).length,
      delayed: open.filter((m) => isMoDelayed(m, s.workOrders, now, s.settings.delayThresholdPct)).length,
      dueThisWeek: open.filter((m) => {
        const remaining = Date.parse(m.plannedEnd) - now
        return remaining >= 0 && remaining < 7 * 86_400_000
      }).length,
    }
  }, [s, now])

  const setView = (next: View) =>
    setParams(
      (p) => {
        if (next === 'all') p.delete('view')
        else p.set('view', next)
        return p
      },
      { replace: true },
    )

  const columns: Column<ManufacturingOrder>[] = [
    {
      id: 'order',
      header: 'Order',
      sortValue: (m) => m.code,
      cell: (m) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{m.code}</p>
          <p className="text-sm truncate">{s.productName(m.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <MoStatusBadge status={m.status} />
            <PriorityBadge priority={m.priority} />
          </div>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (m) => m.qty,
      cell: (m) => <span className="tabular-nums">{fmtNumber(m.qty)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (m) => m.status,
      cell: (m) => <MoStatusBadge status={m.status} />,
    },
    {
      id: 'priority',
      header: 'Priority',
      hideBelow: 'md',
      sortValue: (m) => m.priority,
      cell: (m) => <PriorityBadge priority={m.priority} />,
    },
    {
      id: 'progress',
      header: 'Progress',
      hideBelow: 'lg',
      width: '10rem',
      sortValue: (m) => moProgress(m, s.workOrders).ratio,
      cell: (m) => {
        const p = moProgress(m, s.workOrders)
        return (
          <div>
            <ProgressBar
              value={p.ratio}
              tone={m.atRisk ? 'accent' : 'ink'}
              aria-label={`${Math.round(p.ratio * 100)}% complete`}
            />
            <p className="mt-1 text-[11px] text-muted">
              {p.completedOps}/{p.totalOps} ops · {fmtNumber(m.goodQty)} finished good
            </p>
          </div>
        )
      },
    },
    {
      id: 'material',
      header: 'Material',
      hideBelow: 'xl',
      cell: (m) =>
        m.status === 'released' || m.status === 'in_progress' || m.status === 'on_hold' ? (
          <ReadinessBadge readiness={materialReadiness(m.id, s.materialRequirements)} />
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'end',
      header: 'Planned finish',
      hideBelow: 'md',
      sortValue: (m) => m.plannedEnd,
      cell: (m) => {
        const late = OPEN_MO_STATUSES.includes(m.status) && now > Date.parse(m.plannedEnd)
        return <span className={late ? 'font-semibold text-accent' : ''}>{fmtDateShort(m.plannedEnd)}</span>
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Manufacturing orders"
        description="Parent transactions for production. Release one to snapshot its engineering data and generate work orders."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search orders"
              leftIcon={<Search />}
              placeholder="Search code or product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('mo.manage') && (
              <Button onClick={() => create.manufacturingOrder()}>
                <Plus />
                New order
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Open orders"
            value={stats.open}
            hint={`${stats.inProgress} in progress`}
            icon={<ClipboardList />}
            tone="ink"
            onClick={() => setView('open')}
          />
          <StatCard
            label="At risk"
            value={stats.atRisk}
            hint={stats.atRisk ? 'Machine or material problem' : 'No risks flagged'}
            icon={<Siren />}
            tone={stats.atRisk ? 'danger' : 'success'}
            onClick={() => setView('at-risk')}
          />
          <StatCard
            label="Delayed"
            value={stats.delayed}
            hint="Behind the planned window"
            icon={<TimerOff />}
            tone={stats.delayed ? 'warning' : 'default'}
            onClick={() => setView('delayed')}
          />
          <StatCard
            label="Due this week"
            value={stats.dueThisWeek}
            hint="Planned finish within 7 days"
            icon={<CalendarClock />}
            tone="info"
          />
        </div>
        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip
              variant="filter"
              active={!status && view === 'all'}
              count={s.manufacturingOrders.length}
              onClick={() => {
                setStatus(null)
                setView('all')
              }}
            >
              All
            </Chip>
            {STATUS_CHIPS.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={status === st}
                count={s.manufacturingOrders.filter((m) => m.status === st).length}
                onClick={() => setStatus(status === st ? null : st)}
              >
                {MO_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(m) => m.id}
          onRowClick={(m) => navigate(paths.mo(m.id))}
          resetPageKey={`${query}|${status}|${view}`}
          empty="No manufacturing orders match."
          {...table}
        />
      </div>
    </>
  )
}
