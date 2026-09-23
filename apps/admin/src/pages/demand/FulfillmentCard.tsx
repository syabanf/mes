import { fmtNumber } from '@mes/fixtures'
import type { MarketingOrder, MarketingOrderItem } from '@mes/types'
import { STRATEGY_LABEL } from '@mes/types'
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, SegmentBar } from '@mes/ui'
import { Link } from 'react-router'
import { StrategyBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { demandGap } from './lib'

/** Explains, line by line, how much of the order comes from stock and how much from production. */
export function FulfillmentCard({ order, items }: { order: MarketingOrder; items: MarketingOrderItem[] }) {
  const s = useScoped()

  return (
    <Card>
      <CardHeader
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/demand/fulfillment">Fulfillment</Link>
          </Button>
        }
      >
        <CardTitle>Fulfillment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {order.status === 'draft' ? (
          <EmptyState
            compact
            title="No demand yet"
            description="Confirming the order raises one demand line per product. Each line then resolves from stock, from production, or both."
          />
        ) : items.length === 0 ? (
          <EmptyState compact title="No lines" description="There is nothing to fulfil on this order." />
        ) : (
          items.map((item) => {
            const demand = s.demands.find((d) => d.orderItemId === item.id)
            const gap = demand ? demandGap(demand) : item.qty
            const fromStock = demand?.allocatedQty ?? 0
            const fromProduction = demand?.requirementQty ?? 0
            return (
              <div key={item.id} className="rounded-2xl p-3 bg-surface-2">
                <div className="gap-2 flex flex-wrap items-center justify-between">
                  <span className="min-w-0 text-sm font-semibold truncate">
                    Line {item.line} · {s.productName(item.productId)}
                  </span>
                  <StrategyBadge strategy={item.strategy} />
                </div>
                <SegmentBar
                  className="mt-2"
                  size="sm"
                  segments={[
                    { key: 'stock', value: fromStock, className: 'bg-info', label: 'From stock' },
                    {
                      key: 'production',
                      value: fromProduction,
                      className: 'bg-ink',
                      label: 'From production',
                    },
                    { key: 'open', value: gap, className: 'bg-silver', label: 'Unresolved' },
                  ]}
                />
                <p className="mt-2 text-sm">
                  <span className="font-semibold tabular-nums">{fmtNumber(item.qty)}</span>{' '}
                  <span className="text-muted">{s.uomCode(item.uomId)}:</span>{' '}
                  <span className="tabular-nums">{fmtNumber(fromStock)}</span> from stock,{' '}
                  <span className="tabular-nums">{fmtNumber(fromProduction)}</span> from production
                  {gap > 0 && (
                    <>
                      , <span className="font-semibold text-accent tabular-nums">{fmtNumber(gap)}</span>{' '}
                      unresolved
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {demand
                    ? demand.explanation
                    : `${STRATEGY_LABEL[item.strategy]} line. Demand appears once the order is confirmed.`}
                </p>
                {demand && (
                  <div className="mt-2 gap-x-3 gap-y-1 flex flex-wrap items-center">
                    <Link
                      to={paths.demand(demand.id)}
                      className="text-xs font-semibold font-mono hover:text-accent"
                    >
                      {demand.code}
                    </Link>
                    {demand.moIds.map((moId) => (
                      <MoLink key={moId} moId={moId} showProduct={false} />
                    ))}
                    {gap > 0 && (
                      <Button asChild variant="outline" size="sm" className="ml-auto">
                        <Link to={paths.demand(demand.id)}>Resolve gap</Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
