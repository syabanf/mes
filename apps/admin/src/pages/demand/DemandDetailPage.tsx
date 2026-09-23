import {
  demandCancellationBlocker,
  fmtAgo,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  productOnHand,
} from '@mes/fixtures'
import { DEMAND_SOURCE_LABEL, STRATEGY_LABEL } from '@mes/types'
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  Kicker,
  toast,
} from '@mes/ui'
import { Ban, Factory, MoreHorizontal, Pencil, Trash2, Warehouse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { DemandStatusBadge, MoStatusBadge, StrategyBadge } from '../../components/badges'
import { useCreate } from '../../components/create'
import { PersonChip, ProductLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { AllocateDialog } from './AllocateDialog'
import { DemandDialog } from './DemandDialog'
import { demandGap, demandStrategy, moSourceFor, orderOfDemand } from './lib'

const LIST = '/demand/demands'

export function DemandDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const create = useCreate()
  const now = useNow(60_000)
  const demand = s.maps.demand.get(id)
  const [allocating, setAllocating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const history = useMemo(
    () =>
      demand
        ? s.productionEvents
            .filter((e) => e.text.includes(demand.code))
            .sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [s.productionEvents, demand],
  )

  if (!demand) {
    return (
      <Card>
        <EmptyState
          title="Demand not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback={LIST} />}
        />
      </Card>
    )
  }

  const gap = demandGap(demand)
  const { free } = productOnHand(s, demand.productId, s.siteId)
  const { item, order } = orderOfDemand(s, demand)
  const strategy = demandStrategy(s, demand)
  const product = s.maps.product.get(demand.productId)
  const mos = demand.moIds.map((moId) => s.maps.mo.get(moId)).filter((mo) => !!mo)
  const manage = can('demand.manage')
  const live = demand.status === 'open' || demand.status === 'resolved'
  const cancelBlocker = demandCancellationBlocker(s.state, demand)
  const canDelete = !demand.orderItemId && !demand.moIds.length && !demand.allocatedQty
  const openMo = () =>
    create.manufacturingOrder({
      productId: demand.productId,
      qty: gap,
      source: moSourceFor(demand),
      demandIds: [demand.id],
      priority: order?.priority ?? 'normal',
    })

  const menu = [
    manage ? { key: 'edit', label: 'Edit demand', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage && live
      ? { key: 'cancel', label: 'Cancel demand', icon: <Ban />, onSelect: () => setCancelling(true) }
      : null,
    manage && canDelete
      ? {
          key: 'delete',
          label: 'Delete demand',
          icon: <Trash2 />,
          destructive: true,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback={LIST} />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && live && (
            <Button variant="outline" disabled={gap === 0 || free === 0} onClick={() => setAllocating(true)}>
              <Warehouse />
              Allocate from stock
            </Button>
          )}
          {manage && live && (
            <Button disabled={gap === 0} onClick={openMo}>
              <Factory />
              Create manufacturing order
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={demand.code}
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
            <p className="text-xs font-mono text-on-ink-muted">{demand.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{s.productName(demand.productId)}</h1>
            <p className="text-sm text-on-ink-muted">
              {product?.code} · {DEMAND_SOURCE_LABEL[demand.source]} demand · required{' '}
              {fmtDate(demand.requiredDate)}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <DemandStatusBadge status={demand.status} />
            <StrategyBadge strategy={strategy} />
          </div>
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <Metric label="Demanded" value={fmtNumber(demand.qty)} unit={s.uomCode(product?.uomId ?? '')} />
          <Metric label="From stock" value={fmtNumber(demand.allocatedQty)} />
          <Metric label="From production" value={fmtNumber(demand.requirementQty)} />
          <Metric
            label="Unresolved"
            value={fmtNumber(gap)}
            unit={gap > 0 ? `${fmtNumber(free)} free` : undefined}
          />
        </div>
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Demand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl p-3 bg-surface-2">
              <Kicker>Why production is needed</Kicker>
              <p className="mt-1 text-sm">{demand.explanation}</p>
              {gap > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {fmtNumber(gap)} still unresolved. {fmtNumber(free)} free in finished goods.
                </p>
              )}
            </div>
            <KeyValue
              bare
              items={[
                { label: 'Product', value: <ProductLink productId={demand.productId} /> },
                {
                  label: 'Source',
                  value: <Badge variant="outline">{DEMAND_SOURCE_LABEL[demand.source]}</Badge>,
                },
                { label: 'Strategy', value: STRATEGY_LABEL[strategy] },
                { label: 'Required', value: fmtDate(demand.requiredDate) },
                {
                  label: 'Order',
                  value: order ? (
                    <Link
                      to={paths.marketingOrder(order.id)}
                      className="text-xs font-semibold font-mono hover:text-accent"
                    >
                      {order.code} line {item?.line}
                    </Link>
                  ) : (
                    'None'
                  ),
                  hidden: !order,
                },
                {
                  label: 'Customer',
                  value: s.maps.customer.get(order?.customerId ?? '')?.name ?? '',
                  hidden: !order,
                },
                { label: 'Created', value: fmtDateTime(demand.createdAt) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manufacturing orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mos.length === 0 ? (
              <EmptyState
                compact
                title="No manufacturing order yet"
                description={
                  gap > 0
                    ? 'Create one for the unresolved quantity, or allocate it from stock.'
                    : 'This demand is covered without production.'
                }
              />
            ) : (
              mos.map((mo) => (
                <Link
                  key={mo.id}
                  to={paths.mo(mo.id)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block font-mono">{mo.code}</span>
                    <span className="text-xs block truncate text-muted">
                      {fmtNumber(mo.goodQty)} of {fmtNumber(mo.qty)} good ·{' '}
                      {mo.lineId ? s.orgName(mo.lineId) : 'line not set'}
                    </span>
                  </span>
                  <MoStatusBadge status={mo.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {history.length === 0 ? (
            <EmptyState
              compact
              title="No events yet"
              description="Allocations and orders raised from this demand appear here."
            />
          ) : (
            history.map((e) => (
              <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                <span className="w-16 pt-0.5 text-xs shrink-0 text-muted tabular-nums">
                  {fmtAgo(e.at, now)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm block">{e.text}</span>
                  <span className="mt-0.5 gap-2 flex items-center text-[11px] text-muted">
                    <PersonChip personId={e.by} />
                    <span className="font-mono">{e.type}</span>
                  </span>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AllocateDialog demand={allocating ? demand : null} onOpenChange={setAllocating} />
      <DemandDialog
        open={editing}
        onOpenChange={setEditing}
        editing={demand}
        onSaved={() => toast('Demand updated', { tone: 'success' })}
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${demand.code}?`}
        description={
          cancelBlocker ??
          'Reserved stock is released and linked draft or planned manufacturing orders are cancelled.'
        }
        confirmLabel="Cancel demand"
        confirmDisabled={!!cancelBlocker}
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'demands/cancel', id: demand.id })
          setCancelling(false)
          toast('Demand cancelled', { tone: 'default' })
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${demand.code}?`}
        description="The line disappears from every list. Manufacturing orders raised from it keep running and lose the link."
        confirmLabel="Delete demand"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'demands/remove', id: demand.id })
          setDeleting(false)
          toast('Demand deleted', { tone: 'default' })
          navigate(LIST, { replace: true })
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
