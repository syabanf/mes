import { fmtDateShort, fmtNumber, monthKey, toMs } from '@mes/fixtures'
import type { FulfillmentStrategy, MarketingOrder, MarketingOrderStatus } from '@mes/types'
import { MO_ORDER_STATUS_LABEL, OPEN_MARKETING_ORDER_STATUSES, STRATEGY_SHORT } from '@mes/types'
import { Badge, Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { FileClock, Factory, PackageCheck, Plus, Search, Truck } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { OrderStatusBadge, PriorityBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { paths } from '../../components/links'
import { CustomerPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { orderTotals, strategyMix } from './lib'

const STATUS_CHIPS: MarketingOrderStatus[] = [
  'draft',
  'confirmed',
  'fulfilling',
  'ready',
  'partially_delivered',
  'delivered',
  'on_hold',
  'closed',
]
const STRATEGIES: FulfillmentStrategy[] = ['mto', 'mts', 'hybrid']

/** Deep-linkable views the stat tiles and the rest of the app use. */
type View = 'all' | 'draft' | 'fulfilling' | 'ready' | 'delivered'
const VIEW_STATUSES: Record<Exclude<View, 'all'>, MarketingOrderStatus[]> = {
  draft: ['draft'],
  fulfilling: ['confirmed', 'fulfilling'],
  ready: ['ready', 'partially_delivered'],
  delivered: ['delivered', 'closed'],
}

export function MarketingOrdersPage() {
  const s = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View | null) ?? 'all'
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<MarketingOrderStatus | null>('status', null)
  const [customerId, setCustomerId] = useHistoryState<string | null>('customer', null)
  const table = useTableHistory()

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, typeof s.marketingOrderItems>()
    for (const item of s.marketingOrderItems) {
      const list = map.get(item.orderId)
      if (list) list.push(item)
      else map.set(item.orderId, [item])
    }
    return map
  }, [s.marketingOrderItems])
  const itemsOf = (orderId: string) => itemsByOrder.get(orderId) ?? []
  const customerName = (id: string) => s.maps.customer.get(id)?.name ?? 'Unknown customer'
  const customers = s.maps.customer

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...s.marketingOrders]
      .filter((o) => {
        if (status && o.status !== status) return false
        if (view !== 'all' && !VIEW_STATUSES[view].includes(o.status)) return false
        if (customerId && o.customerId !== customerId) return false
        if (!q) return true
        return `${o.code} ${o.reference} ${customers.get(o.customerId)?.name ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [s.marketingOrders, customers, query, status, view, customerId])

  const stats = useMemo(() => {
    const month = monthKey(now)
    return {
      draft: s.marketingOrders.filter((o) => o.status === 'draft').length,
      fulfilling: s.marketingOrders.filter((o) => VIEW_STATUSES.fulfilling.includes(o.status)).length,
      ready: s.marketingOrders.filter((o) => VIEW_STATUSES.ready.includes(o.status)).length,
      delivered: s.marketingOrders.filter(
        (o) => VIEW_STATUSES.delivered.includes(o.status) && monthKey(toMs(o.requiredDate)) === month,
      ).length,
    }
  }, [s.marketingOrders, now])

  const setView = (next: View) =>
    setParams(
      (p) => {
        if (next === 'all') p.delete('view')
        else p.set('view', next)
        return p
      },
      { replace: true },
    )

  const columns: Column<MarketingOrder>[] = [
    {
      id: 'order',
      header: 'Order',
      sortValue: (o) => o.code,
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{o.code}</p>
          <p className="text-sm truncate">{customerName(o.customerId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <OrderStatusBadge status={o.status} />
            <PriorityBadge priority={o.priority} />
          </div>
        </div>
      ),
    },
    {
      id: 'lines',
      header: 'Lines',
      align: 'right',
      hideBelow: 'md',
      sortValue: (o) => itemsOf(o.id).length,
      cell: (o) => <span className="tabular-nums">{itemsOf(o.id).length}</span>,
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (o) => orderTotals(itemsOf(o.id)).qty,
      cell: (o) => <span className="tabular-nums">{fmtNumber(orderTotals(itemsOf(o.id)).qty)}</span>,
    },
    {
      id: 'mix',
      header: 'Strategy',
      hideBelow: 'lg',
      cell: (o) => {
        const mix = strategyMix(itemsOf(o.id))
        const present = STRATEGIES.filter((k) => mix[k] > 0)
        if (!present.length) return <span className="text-muted">No lines</span>
        return (
          <div className="gap-1 flex flex-wrap">
            {present.map((k) => (
              <Badge key={k} variant={k === 'mto' ? 'ink' : k === 'mts' ? 'info' : 'warning'}>
                {STRATEGY_SHORT[k]} {mix[k]}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'required',
      header: 'Required',
      hideBelow: 'md',
      sortValue: (o) => o.requiredDate,
      cell: (o) => {
        const late = OPEN_MARKETING_ORDER_STATUSES.includes(o.status) && toMs(o.requiredDate) < now
        return <span className={late ? 'font-semibold text-accent' : ''}>{fmtDateShort(o.requiredDate)}</span>
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      hideBelow: 'xl',
      sortValue: (o) => o.priority,
      cell: (o) => <PriorityBadge priority={o.priority} />,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (o) => o.status,
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Marketing orders"
        description="Customer orders are the root of every demand. Confirm one to raise a demand line per product."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search orders"
              leftIcon={<Search />}
              placeholder="Search code, customer or reference"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('order.manage') && (
              <Button onClick={() => create.marketingOrder()}>
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
            label="Draft"
            value={stats.draft}
            hint="Awaiting confirmation"
            icon={<FileClock />}
            tone={stats.draft ? 'warning' : 'default'}
            onClick={() => setView('draft')}
          />
          <StatCard
            label="Fulfilling"
            value={stats.fulfilling}
            hint="Confirmed, demand in progress"
            icon={<Factory />}
            tone="ink"
            onClick={() => setView('fulfilling')}
          />
          <StatCard
            label="Ready to deliver"
            value={stats.ready}
            hint="Stock or production complete"
            icon={<PackageCheck />}
            tone="success"
            onClick={() => setView('ready')}
          />
          <StatCard
            label="Delivered this month"
            value={stats.delivered}
            hint="Required date in this month"
            icon={<Truck />}
            tone="info"
            onClick={() => setView('delivered')}
          />
        </div>
        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip
              variant="filter"
              active={!status && view === 'all'}
              count={s.marketingOrders.length}
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
                count={s.marketingOrders.filter((o) => o.status === st).length}
                onClick={() => setStatus(status === st ? null : st)}
              >
                {MO_ORDER_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <CustomerPicker
            variant="inline"
            clearable
            value={customerId}
            onChange={setCustomerId}
            placeholder="Any customer"
            aria-label="Filter by customer"
            className="sm:w-56 w-full"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(o) => o.id}
          onRowClick={(o) => navigate(paths.marketingOrder(o.id))}
          resetPageKey={`${query}|${status}|${view}|${customerId}`}
          empty="No marketing orders match. New orders start as drafts and raise demand once confirmed."
          {...table}
        />
      </div>
    </>
  )
}
