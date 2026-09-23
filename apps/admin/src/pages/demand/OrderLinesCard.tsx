import { deliveryBlocker, fmtNumber } from '@mes/fixtures'
import type { MarketingOrderItem } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  ProgressBar,
  toast,
} from '@mes/ui'
import { Truck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { ItemStatusBadge, StrategyBadge } from '../../components/badges'
import { MoLink, ProductLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'

export function OrderLinesCard({ items, canDeliver }: { items: MarketingOrderItem[]; canDeliver: boolean }) {
  const s = useScoped()
  const [delivering, setDelivering] = useState<MarketingOrderItem | null>(null)
  const demandOf = (item: MarketingOrderItem) => s.demands.find((d) => d.orderItemId === item.id)

  const columns: Column<MarketingOrderItem>[] = [
    {
      id: 'line',
      header: 'Line',
      sortValue: (i) => i.line,
      cell: (i) => (
        <div className="min-w-0 gap-3 flex items-start">
          <span className="size-8 rounded-xl text-xs font-bold flex shrink-0 items-center justify-center bg-surface-2 tabular-nums">
            {i.line}
          </span>
          <div className="min-w-0">
            <ProductLink productId={i.productId} />
            <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
              <StrategyBadge strategy={i.strategy} />
              <ItemStatusBadge status={i.status} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (i) => i.qty,
      cell: (i) => (
        <span className="tabular-nums">
          {fmtNumber(i.qty)} <span className="text-xs text-muted">{s.uomCode(i.uomId)}</span>
        </span>
      ),
    },
    {
      id: 'strategy',
      header: 'Strategy',
      hideBelow: 'sm',
      sortValue: (i) => i.strategy,
      cell: (i) => <StrategyBadge strategy={i.strategy} />,
    },
    {
      id: 'progress',
      header: 'Progress',
      hideBelow: 'md',
      width: '12rem',
      sortValue: (i) => i.deliveredQty / Math.max(1, i.qty),
      cell: (i) => (
        <div>
          <ProgressBar
            value={i.deliveredQty / Math.max(1, i.qty)}
            tone={i.status === 'delivered' ? 'success' : 'ink'}
            aria-label={`${fmtNumber(i.deliveredQty)} of ${fmtNumber(i.qty)} delivered`}
          />
          <p className="mt-1 text-[11px] text-muted tabular-nums">
            {fmtNumber(i.allocatedQty)} allocated · {fmtNumber(i.producedQty)} produced ·{' '}
            {fmtNumber(i.deliveredQty)} delivered
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (i) => i.status,
      cell: (i) => <ItemStatusBadge status={i.status} />,
    },
    {
      id: 'demand',
      header: 'Demand',
      hideBelow: 'lg',
      cell: (i) => {
        const demand = demandOf(i)
        if (!demand) return <span className="text-xs text-muted">Raised on confirm</span>
        return (
          <div className="gap-1 flex flex-col">
            <Link
              to={paths.demand(demand.id)}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-semibold font-mono hover:text-accent"
            >
              {demand.code}
            </Link>
            {demand.moIds.map((moId) => (
              <MoLink key={moId} moId={moId} showProduct={false} />
            ))}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (i) =>
        canDeliver && i.status === 'ready' && i.deliveredQty < i.qty ? (
          <Button size="sm" variant="outline" onClick={() => setDelivering(i)}>
            <Truck />
            Deliver
          </Button>
        ) : null,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lines</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            compact
            title="No lines"
            description="Add products to the order before confirming it."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            getRowKey={(i) => i.id}
            pageSize={0}
            initialSort={{ id: 'line' }}
          />
        )}
      </CardContent>
      <DeliverDialog item={delivering} onOpenChange={(open) => !open && setDelivering(null)} />
    </Card>
  )
}

function DeliverDialog({
  item,
  onOpenChange,
}: {
  item: MarketingOrderItem | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {item && <DeliverForm item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DeliverForm({ item, onDone }: { item: MarketingOrderItem; onDone: () => void }) {
  const s = useScoped()
  const { dispatch, productName, uomCode } = s
  const remaining = item.qty - item.deliveredQty
  const [qty, setQty] = useState(String(remaining))
  const [tried, setTried] = useState(false)
  const n = Number(qty)
  const error = deliveryBlocker(s.state, item, n)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    dispatch({ type: 'marketingOrderItems/deliver', id: item.id, qty: n })
    toast(`${fmtNumber(n)} ${uomCode(item.uomId)} delivered`, {
      tone: 'success',
      description: productName(item.productId),
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Deliver line {item.line}</DialogTitle>
        <DialogDescription>
          {productName(item.productId)} · {fmtNumber(remaining)} {uomCode(item.uomId)} left to deliver. Stock
          is taken from this order's site.
        </DialogDescription>
      </DialogHeader>
      <FormField label="Quantity" required error={tried ? error : null}>
        <Input
          type="number"
          min={1}
          max={remaining}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          invalid={tried && !!error}
          autoFocus
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Deliver</Button>
      </DialogFooter>
    </form>
  )
}
