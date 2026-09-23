import { fmtNumber, productOnHand } from '@mes/fixtures'
import type { Demand, FulfillmentStrategy } from '@mes/types'
import { STRATEGY_LABEL, STRATEGY_SHORT } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  IconTile,
  Kicker,
  PageHeader,
  type Tone,
} from '@mes/ui'
import { Factory, Layers, Sparkles, Warehouse } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { StrategyBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { ProductLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { AllocateDialog } from './AllocateDialog'
import {
  demandStrategy,
  isLiveDemand,
  moSourceFor,
  orderOfDemand,
  resolutionOf,
  splitGap,
  suggestedAction,
} from './lib'
import { PolicyTable } from './PolicyTable'

interface Row {
  demand: Demand
  strategy: FulfillmentStrategy
  free: number
  gap: number
  allocate: number
  produce: number
}

const EXPLAINERS: {
  strategy: FulfillmentStrategy
  flow: string
  body: string
  icon: ReactNode
  tone: Tone
}[] = [
  {
    strategy: 'mto',
    flow: 'Customer demand → Manufacturing requirement',
    body: 'The full quantity goes to production. A manufacturing order is created for the demand line.',
    icon: <Factory />,
    tone: 'ink',
  },
  {
    strategy: 'mts',
    flow: 'Customer demand → Available inventory → Allocation',
    body: 'Finished goods on hand are allocated first. Stock is refilled by the replenishment check.',
    icon: <Warehouse />,
    tone: 'info',
  },
  {
    strategy: 'hybrid',
    flow: 'Part from stock, part from production',
    body: 'What stock can cover is allocated, and a manufacturing order is created for the rest.',
    icon: <Layers />,
    tone: 'warning',
  },
]

export function FulfillmentPage() {
  const s = useScoped()
  const { can } = useAuth()
  const create = useCreate()
  const [allocating, setAllocating] = useState<{ demand: Demand; resolveAll: boolean } | null>(null)
  const manage = can('demand.manage')

  const rows = useMemo<Row[]>(
    () =>
      s.demands
        .filter(isLiveDemand)
        .map((demand) => {
          const { free } = productOnHand(s, demand.productId, s.siteId)
          return { demand, strategy: demandStrategy(s, demand), free, ...splitGap(demand, free) }
        })
        .sort((a, b) => b.gap - a.gap || a.demand.requiredDate.localeCompare(b.demand.requiredDate)),
    [s],
  )
  const counts = useMemo(() => {
    const c: Record<FulfillmentStrategy, number> = { mto: 0, mts: 0, hybrid: 0 }
    for (const r of rows) {
      const res = resolutionOf(r.demand)
      if (res) c[res] += 1
    }
    return c
  }, [rows])
  const unresolved = rows.filter((r) => r.gap > 0).length

  const openMo = (r: Row, qty: number, lockQty = false) => {
    const { order } = orderOfDemand(s, r.demand)
    create.manufacturingOrder({
      productId: r.demand.productId,
      qty,
      source: moSourceFor(r.demand),
      demandIds: [r.demand.id],
      priority: order?.priority ?? 'normal',
      lockQty,
    })
  }
  const resolve = (r: Row) => {
    if (r.allocate > 0 && r.produce > 0) {
      create.manufacturingOrder({
        productId: r.demand.productId,
        qty: r.produce,
        source: moSourceFor(r.demand),
        demandIds: [r.demand.id],
        priority: orderOfDemand(s, r.demand).order?.priority ?? 'normal',
        lockQty: true,
        allocation: { demandId: r.demand.id, qty: r.allocate },
      })
    } else if (r.allocate > 0) {
      setAllocating({ demand: r.demand, resolveAll: true })
    } else if (r.produce > 0) {
      openMo(r, r.produce, true)
    }
  }

  const columns: Column<Row>[] = [
    {
      id: 'product',
      header: 'Demand line',
      sortValue: (r) => s.productName(r.demand.productId),
      cell: (r) => (
        <div className="min-w-0">
          <ProductLink productId={r.demand.productId} />
          <Link
            to={paths.demand(r.demand.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block font-mono text-[11px] text-muted hover:text-accent"
          >
            {r.demand.code}
          </Link>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap items-center">
            <StrategyBadge strategy={r.strategy} />
            <span className={r.gap > 0 ? 'text-xs font-semibold text-accent' : 'text-xs text-muted'}>
              {suggestedAction(r.demand, r.free)}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'strategy',
      header: 'Strategy',
      hideBelow: 'sm',
      sortValue: (r) => r.strategy,
      cell: (r) => <StrategyBadge strategy={r.strategy} />,
    },
    {
      id: 'qty',
      header: 'Demanded',
      align: 'right',
      sortValue: (r) => r.demand.qty,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.demand.qty)}</span>,
    },
    {
      id: 'free',
      header: 'Free stock',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.free,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.free)}</span>,
    },
    {
      id: 'allocated',
      header: 'Allocated',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.demand.allocatedQty,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.demand.allocatedQty)}</span>,
    },
    {
      id: 'requirement',
      header: 'Requirement',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.demand.requirementQty,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.demand.requirementQty)}</span>,
    },
    {
      id: 'gap',
      header: 'Gap',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.gap,
      cell: (r) => (
        <span className={r.gap > 0 ? 'font-semibold text-accent tabular-nums' : 'text-muted tabular-nums'}>
          {fmtNumber(r.gap)}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Suggested',
      hideBelow: 'xl',
      cell: (r) => (
        <span className={r.gap > 0 ? 'text-sm' : 'text-sm text-muted'}>
          {suggestedAction(r.demand, r.free)}
        </span>
      ),
    },
    {
      id: 'buttons',
      header: '',
      align: 'right',
      cell: (r) =>
        manage && r.gap > 0 ? (
          <div className="gap-1.5 flex flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={r.allocate === 0}
              onClick={() => setAllocating({ demand: r.demand, resolveAll: false })}
            >
              Allocate
            </Button>
            <Button size="sm" variant="outline" onClick={() => openMo(r, r.gap)}>
              Produce
            </Button>
            <Button size="sm" variant="secondary" onClick={() => resolve(r)}>
              <Sparkles />
              Resolve
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Fulfillment"
        description="How each open demand line resolves: from finished goods, from production, or both."
      />
      <div className="space-y-4">
        <div className="gap-4 md:grid-cols-3 grid grid-cols-1">
          {EXPLAINERS.map((x) => (
            <Card key={x.strategy} className="p-5">
              <div className="gap-3 flex items-start justify-between">
                <div className="min-w-0">
                  <Kicker>{STRATEGY_SHORT[x.strategy]}</Kicker>
                  <h3 className="mt-1 text-base font-semibold">{STRATEGY_LABEL[x.strategy]}</h3>
                </div>
                <IconTile tone={x.tone}>{x.icon}</IconTile>
              </div>
              <p className="mt-3 text-sm font-medium">{x.flow}</p>
              <p className="mt-1 text-sm text-muted">{x.body}</p>
              <p className="mt-4 gap-1.5 flex items-end leading-none">
                <span className="text-3xl font-bold tracking-tight tabular-nums">
                  {fmtNumber(counts[x.strategy])}
                </span>
                <span className="pb-0.5 text-xs font-semibold text-muted">open lines resolved this way</span>
              </p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/demand/demands">All demand</Link>
              </Button>
            }
          >
            <CardTitle>
              Open demand lines
              {unresolved > 0 && (
                <span className="ml-2 text-sm font-medium text-accent">
                  {fmtNumber(unresolved)} with a gap
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(r) => r.demand.id}
              empty="No open demand. Confirm a marketing order or run the replenishment check to raise some."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/demand/replenishment">Replenishment</Link>
              </Button>
            }
          >
            <CardTitle>Inventory policies</CardTitle>
          </CardHeader>
          <CardContent>
            <PolicyTable />
          </CardContent>
        </Card>
      </div>
      <AllocateDialog
        demand={allocating?.demand ?? null}
        resolveAll={allocating?.resolveAll ?? false}
        onOpenChange={(open) => !open && setAllocating(null)}
      />
    </>
  )
}
