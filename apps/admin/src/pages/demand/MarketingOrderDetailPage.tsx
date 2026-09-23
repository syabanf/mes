import { fmtAgo, fmtDate, fmtDateTime, fmtNumber, orderCancellationBlocker, toMs } from '@mes/fixtures'
import type { MarketingOrderStatus } from '@mes/types'
import { MARKETING_ORDER_FLOW, MO_ORDER_STATUS_LABEL } from '@mes/types'
import {
  ActionMenu,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  Steps,
  type StepState,
  toast,
} from '@mes/ui'
import { Check, CircleX, MoreHorizontal, Pause, Play, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { OrderStatusBadge, PriorityBadge } from '../../components/badges'
import { PersonChip } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { FulfillmentCard } from './FulfillmentCard'
import { orderTotals, resumeStatus } from './lib'
import { OrderLinesCard } from './OrderLinesCard'

const HOLDABLE: MarketingOrderStatus[] = ['confirmed', 'fulfilling', 'ready', 'partially_delivered']

export function MarketingOrderDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const order = s.maps.marketingOrder.get(id)
  const [holding, setHolding] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const items = useMemo(
    () => s.marketingOrderItems.filter((i) => i.orderId === id).sort((a, b) => a.line - b.line),
    [s.marketingOrderItems, id],
  )
  const history = useMemo(() => {
    if (!order) return []
    const codes = [
      order.code,
      ...s.demands.filter((d) => items.some((i) => i.id === d.orderItemId)).map((d) => d.code),
    ]
    return s.productionEvents
      .filter((e) => codes.some((c) => e.text.includes(c)))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [order, items, s.demands, s.productionEvents])

  if (!order) {
    return (
      <Card>
        <EmptyState
          title="Order not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/demand/orders" />}
        />
      </Card>
    )
  }

  const manage = can('order.manage')
  const customer = s.maps.customer.get(order.customerId)
  const totals = orderTotals(items)
  const open = order.status !== 'closed' && order.status !== 'cancelled'
  const late = open && order.status !== 'delivered' && toMs(order.requiredDate) < now
  const cancelBlocker = orderCancellationBlocker(s.state, order)
  const linkedDemands = s.demands.filter((d) => items.some((i) => i.id === d.orderItemId))
  const linkedMos = s.manufacturingOrders.filter((m) => linkedDemands.some((d) => m.demandIds.includes(d.id)))

  const setStatus = (status: MarketingOrderStatus, label: string) => {
    s.dispatch({ type: 'marketingOrders/setStatus', id: order.id, status })
    toast(label, { tone: status === 'cancelled' ? 'default' : 'success' })
  }
  const confirm = () => {
    s.dispatch({ type: 'marketingOrders/confirm', id: order.id })
    toast('Order confirmed', {
      tone: 'success',
      description: `${fmtNumber(items.length)} demand lines raised.`,
    })
  }

  const stepStatus: MarketingOrderStatus =
    order.status === 'partially_delivered' ? 'ready' : order.status === 'on_hold' ? 'confirmed' : order.status
  const cur = MARKETING_ORDER_FLOW.indexOf(stepStatus)
  const steps = MARKETING_ORDER_FLOW.map((status, idx) => {
    const state: StepState =
      order.status === 'cancelled' ? 'skipped' : idx < cur ? 'done' : idx === cur ? 'current' : 'upcoming'
    const hint = idx === cur && stepStatus !== order.status ? MO_ORDER_STATUS_LABEL[order.status] : undefined
    return { key: status, label: MO_ORDER_STATUS_LABEL[status], state, hint }
  })

  const menu = [
    manage && HOLDABLE.includes(order.status)
      ? { key: 'hold', label: 'Put on hold', icon: <Pause />, onSelect: () => setHolding(true) }
      : null,
    manage && order.status === 'delivered'
      ? {
          key: 'close',
          label: 'Close order',
          icon: <Square />,
          onSelect: () => setStatus('closed', 'Order closed'),
        }
      : null,
    manage && open
      ? {
          key: 'cancel',
          label: 'Cancel order',
          icon: <CircleX />,
          destructive: true,
          onSelect: () => setCancelling(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/demand/orders" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && order.status === 'draft' && (
            <Button onClick={confirm} disabled={items.length === 0}>
              <Check />
              Confirm
            </Button>
          )}
          {manage && order.status === 'on_hold' && (
            <Button onClick={() => setStatus(resumeStatus(items), 'Order resumed')}>
              <Play />
              Resume
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={order.code}
              items={menu}
              trigger={
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{order.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{customer?.name ?? 'Unknown customer'}</h1>
            <p className="text-sm text-on-ink-muted">
              Required {fmtDate(order.requiredDate)} ·{' '}
              <span className={late ? 'font-semibold text-white' : ''}>
                {fmtAgo(order.requiredDate, now)}
                {late && ', overdue'}
              </span>
              {order.reference && <> · ref {order.reference}</>}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <OrderStatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} />
          </div>
        </div>
        <div className="mt-5 gap-4 grid grid-cols-3">
          <Metric label="Lines" value={fmtNumber(totals.lines)} />
          <Metric label="Total quantity" value={fmtNumber(totals.qty)} />
          <Metric
            label="Delivered"
            value={fmtNumber(totals.delivered)}
            unit={`of ${fmtNumber(totals.qty)}`}
          />
        </div>
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      <Card className="p-5">
        <Steps steps={steps} />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Order</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                {
                  label: 'Customer',
                  value: customer ? `${customer.name} · ${customer.city}` : 'Unknown customer',
                },
                { label: 'Contact', value: customer ? `${customer.contact} · ${customer.email}` : 'Unknown' },
                { label: 'Reference', value: order.reference || 'None' },
                { label: 'Order date', value: fmtDate(order.orderDate) },
                {
                  label: 'Required',
                  value: (
                    <span className={late ? 'font-semibold text-accent' : ''}>
                      {fmtDate(order.requiredDate)}
                    </span>
                  ),
                },
                { label: 'Priority', value: <PriorityBadge priority={order.priority} /> },
                { label: 'Note', value: order.note, hidden: !order.note },
                {
                  label: 'Created',
                  value: <PersonChip personId={order.createdBy} hint={fmtDateTime(order.createdAt)} />,
                },
              ]}
            />
          </CardContent>
        </Card>
        <FulfillmentCard order={order} items={items} />
      </div>

      <OrderLinesCard items={items} canDeliver={manage && order.status !== 'on_hold' && open} />

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {history.length === 0 ? (
            <EmptyState
              compact
              title="No events yet"
              description="Confirmation, demand and allocation events for this order appear here."
            />
          ) : (
            history.map((e) => (
              <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                <span className="w-16 pt-0.5 text-xs shrink-0 text-muted tabular-nums">
                  {fmtAgo(e.at, now)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm block">{e.text}</span>
                  <span className="block text-[11px] text-muted">
                    {s.personName(e.by)} · <span className="font-mono">{e.type}</span>
                  </span>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={holding}
        onOpenChange={setHolding}
        title={`Put ${order.code} on hold?`}
        description="Demand lines stay as they are. Nothing new is allocated or delivered until the order resumes."
        confirmLabel="Put on hold"
        onConfirm={() => {
          setStatus('on_hold', 'Order on hold')
          setHolding(false)
        }}
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${order.code}?`}
        description={
          cancelBlocker ??
          `This cancels ${linkedDemands.length} demand line${linkedDemands.length === 1 ? '' : 's'} and ${linkedMos.length} draft or planned manufacturing order${linkedMos.length === 1 ? '' : 's'}, and releases reserved stock.`
        }
        confirmLabel="Cancel order"
        confirmDisabled={!!cancelBlocker}
        destructive
        onConfirm={() => {
          setStatus('cancelled', 'Order cancelled')
          setCancelling(false)
        }}
      />
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex items-end leading-none">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
