import { fmtDateShort, fmtNumber, sumBy, toMs } from '@mes/fixtures'
import type { Demand, DemandSource, DemandStatus } from '@mes/types'
import { DEMAND_SOURCE_LABEL, DEMAND_STATUS_LABEL } from '@mes/types'
import {
  Badge,
  Button,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  Input,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import { CircleCheckBig, Inbox, Plus, RefreshCw, Search, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { DemandStatusBadge } from '../../components/badges'
import { MoLink, ProductLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { DemandDialog } from './DemandDialog'
import { demandGap, isLiveDemand } from './lib'

const STATUS_CHIPS: DemandStatus[] = ['open', 'resolved', 'fulfilled', 'cancelled']
const SOURCE_CHIPS: DemandSource[] = ['customer', 'replenishment', 'forecast', 'internal', 'rework']

export function DemandPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<DemandStatus | null>('status', null)
  const [source, setSource] = useHistoryState<DemandSource | null>('source', null)
  const table = useTableHistory()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...s.demands]
      .filter((d) => {
        if (status && d.status !== status) return false
        if (source && d.source !== source) return false
        if (!q) return true
        return `${d.code} ${s.productName(d.productId)} ${s.productCode(d.productId)}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [s, query, status, source])

  const stats = useMemo(
    () => ({
      openQty: sumBy(
        s.demands.filter((d) => d.status === 'open'),
        demandGap,
      ),
      openCount: s.demands.filter((d) => d.status === 'open').length,
      resolved: s.demands.filter((d) => d.status === 'resolved').length,
      fulfilled: s.demands.filter((d) => d.status === 'fulfilled').length,
      replenishment: s.demands.filter((d) => d.source === 'replenishment').length,
    }),
    [s.demands],
  )

  // Older links opened the demand in a side panel on this list.
  const legacyId = params.get('id')
  if (legacyId) return <Navigate to={paths.demand(legacyId)} replace />

  const columns: Column<Demand>[] = [
    {
      id: 'code',
      header: 'Demand',
      sortValue: (d) => d.code,
      cell: (d) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{d.code}</p>
          <p className="text-xs sm:hidden truncate text-muted">{s.productName(d.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <DemandStatusBadge status={d.status} />
            <Badge variant="outline">{DEMAND_SOURCE_LABEL[d.source]}</Badge>
          </div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'sm',
      sortValue: (d) => s.productName(d.productId),
      cell: (d) => <ProductLink productId={d.productId} />,
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (d) => d.qty,
      cell: (d) => <span className="tabular-nums">{fmtNumber(d.qty)}</span>,
    },
    {
      id: 'source',
      header: 'Source',
      hideBelow: 'lg',
      sortValue: (d) => d.source,
      cell: (d) => <Badge variant="outline">{DEMAND_SOURCE_LABEL[d.source]}</Badge>,
    },
    {
      id: 'required',
      header: 'Required',
      hideBelow: 'md',
      sortValue: (d) => d.requiredDate,
      cell: (d) => {
        const late = isLiveDemand(d) && toMs(d.requiredDate) < now
        return <span className={late ? 'font-semibold text-accent' : ''}>{fmtDateShort(d.requiredDate)}</span>
      },
    },
    {
      id: 'resolution',
      header: 'Allocated / requirement',
      align: 'right',
      hideBelow: 'md',
      sortValue: (d) => d.allocatedQty + d.requirementQty,
      cell: (d) => (
        <span className="tabular-nums">
          {fmtNumber(d.allocatedQty)} <span className="text-muted">/</span> {fmtNumber(d.requirementQty)}{' '}
          <span className="text-xs text-muted">of {fmtNumber(d.qty)}</span>
        </span>
      ),
    },
    {
      id: 'mos',
      header: 'Orders',
      hideBelow: 'xl',
      cell: (d) =>
        d.moIds.length ? (
          <div className="gap-1 flex flex-col">
            {d.moIds.map((moId) => (
              <MoLink key={moId} moId={moId} showProduct={false} />
            ))}
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (d) => d.status,
      cell: (d) => <DemandStatusBadge status={d.status} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Demand"
        description="Every reason production or stock is needed at this site. Each line says where its quantity comes from."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search demand"
              leftIcon={<Search />}
              placeholder="Search code or product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('demand.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New demand
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Open demand"
            value={fmtNumber(stats.openQty)}
            unit="pcs"
            hint={`${fmtNumber(stats.openCount)} lines unresolved`}
            icon={<Inbox />}
            tone={stats.openQty ? 'accent' : 'default'}
            onClick={() => setStatus('open')}
          />
          <StatCard
            label="Resolved"
            value={stats.resolved}
            hint="Covered by stock or an order"
            icon={<CircleCheckBig />}
            tone="ink"
            onClick={() => setStatus('resolved')}
          />
          <StatCard
            label="Fulfilled"
            value={stats.fulfilled}
            hint="Delivered or received"
            icon={<Truck />}
            tone="success"
            onClick={() => setStatus('fulfilled')}
          />
          <StatCard
            label="From replenishment"
            value={stats.replenishment}
            hint="Raised by the stock check"
            icon={<RefreshCw />}
            tone="info"
            onClick={() => setSource('replenishment')}
          />
        </div>
        <div className="gap-2 flex flex-col">
          <ChipRow className="max-w-full">
            <Chip variant="filter" active={!status} count={s.demands.length} onClick={() => setStatus(null)}>
              All
            </Chip>
            {STATUS_CHIPS.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={status === st}
                count={s.demands.filter((d) => d.status === st).length}
                onClick={() => setStatus(status === st ? null : st)}
              >
                {DEMAND_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow className="max-w-full">
            <Chip variant="filter" active={!source} onClick={() => setSource(null)}>
              Any source
            </Chip>
            {SOURCE_CHIPS.map((src) => (
              <Chip
                key={src}
                variant="filter"
                active={source === src}
                count={s.demands.filter((d) => d.source === src).length}
                onClick={() => setSource(source === src ? null : src)}
              >
                {DEMAND_SOURCE_LABEL[src]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(d) => d.id}
          onRowClick={(d) => navigate(paths.demand(d.id))}
          resetPageKey={`${query}|${status}|${source}`}
          empty="No demand matches. Confirming a marketing order or running the replenishment check raises demand."
          {...table}
        />
      </div>
      <DemandDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(d) => {
          toast('Demand created', { tone: 'success', description: d.code })
          navigate(paths.demand(d.id))
        }}
      />
    </>
  )
}
