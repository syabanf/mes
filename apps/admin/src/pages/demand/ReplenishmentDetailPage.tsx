import { fmtAgo, fmtDateTime, fmtNumber } from '@mes/fixtures'
import type { ReplenishmentStatus } from '@mes/types'
import { REPLENISHMENT_STATUS_LABEL } from '@mes/types'
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
import { Ban, Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { ReplenishmentStatusBadge } from '../../components/badges'
import { MoLink, PersonChip, ProductLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { ApproveReplenishmentDialog } from './ApproveReplenishmentDialog'
import { ReplenishmentDialog } from './ReplenishmentDialog'
import { projectedStock } from './lib'

const LIST = '/demand/replenishment'
const FLOW: ReplenishmentStatus[] = ['proposed', 'approved', 'in_production', 'received']

export function ReplenishmentDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const r = s.maps.replenishment.get(id)
  const [approving, setApproving] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const history = useMemo(
    () =>
      r
        ? s.productionEvents.filter((e) => e.text.includes(r.code)).sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [s.productionEvents, r],
  )

  if (!r) {
    return (
      <Card>
        <EmptyState
          title="Proposal not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback={LIST} />}
        />
      </Card>
    )
  }

  const manage = can('demand.manage')
  const product = s.maps.product.get(r.productId)
  const policy = s.inventoryPolicies.find((p) => p.productId === r.productId)
  const live = projectedStock(s, r.productId)
  const demand = r.demandId ? s.maps.demand.get(r.demandId) : undefined
  const below = r.projected < r.reorderPoint

  const steps = FLOW.map((status) => {
    const idx = FLOW.indexOf(status)
    const cur = FLOW.indexOf(r.status)
    const state: StepState =
      r.status === 'dismissed' ? 'skipped' : idx < cur ? 'done' : idx === cur ? 'current' : 'upcoming'
    return { key: status, label: REPLENISHMENT_STATUS_LABEL[status], state }
  })

  const menu = [
    manage
      ? { key: 'edit', label: 'Edit proposal', icon: <Pencil />, onSelect: () => setEditing(true) }
      : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete proposal',
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
          {manage && r.status === 'proposed' && (
            <Button variant="outline" onClick={() => setDismissing(true)}>
              <Ban />
              Dismiss
            </Button>
          )}
          {manage && r.status === 'proposed' && (
            <Button onClick={() => setApproving(true)}>
              <Check />
              Approve
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={r.code}
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
            <p className="text-xs font-mono text-on-ink-muted">{r.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{s.productName(r.productId)}</h1>
            <p className="text-sm text-on-ink-muted">
              {product?.code} · make to stock · proposed {fmtAgo(r.createdAt, now)}
            </p>
          </div>
          <ReplenishmentStatusBadge status={r.status} />
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <Metric label="On hand" value={fmtNumber(r.onHand)} unit={s.uomCode(product?.uomId ?? '')} />
          <Metric
            label="Projected"
            value={fmtNumber(r.projected)}
            unit={below ? 'below reorder point' : undefined}
            accent={below}
          />
          <Metric label="Reorder point" value={fmtNumber(r.reorderPoint)} />
          <Metric label="Required" value={fmtNumber(r.requiredQty)} unit="to produce" />
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
            <CardTitle>Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Product', value: <ProductLink productId={r.productId} /> },
                {
                  label: 'On hand',
                  value: `${fmtNumber(r.onHand)} when proposed · ${fmtNumber(live.free)} free now`,
                },
                {
                  label: 'Projected',
                  value: `${fmtNumber(r.projected)} when proposed · ${fmtNumber(live.projected)} now`,
                },
                {
                  label: 'Demand',
                  value: demand ? (
                    <Link
                      to={paths.demand(demand.id)}
                      className="text-xs font-semibold font-mono hover:text-accent"
                    >
                      {demand.code}
                    </Link>
                  ) : (
                    <span className="text-muted">No demand line</span>
                  ),
                },
                {
                  label: 'Order',
                  value: r.moId ? (
                    <MoLink moId={r.moId} />
                  ) : (
                    <span className="text-muted">
                      {r.status === 'proposed' ? 'Created on approval' : 'No manufacturing order'}
                    </span>
                  ),
                },
                { label: 'Created', value: fmtDateTime(r.createdAt) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to={LIST}>Projected stock</Link>
              </Button>
            }
          >
            <CardTitle>Inventory policy</CardTitle>
          </CardHeader>
          <CardContent>
            {policy ? (
              <KeyValue
                bare
                items={[
                  { label: 'Safety stock', value: fmtNumber(policy.safetyStock) },
                  { label: 'Minimum', value: fmtNumber(policy.minStock) },
                  { label: 'Reorder point', value: fmtNumber(policy.reorderPoint) },
                  { label: 'Maximum', value: fmtNumber(policy.maxStock) },
                  { label: 'Replenish qty', value: fmtNumber(policy.replenishQty) },
                  { label: 'Production multiple', value: fmtNumber(policy.productionMultiple) },
                ]}
              />
            ) : (
              <EmptyState
                compact
                title="No policy for this product"
                description="The replenishment check only proposes products with an inventory policy at this site."
              />
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
              description="Proposals raised by the check and their approvals appear here."
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

      <ApproveReplenishmentDialog replenishment={approving ? r : null} onOpenChange={setApproving} />
      <ReplenishmentDialog
        open={editing}
        onOpenChange={setEditing}
        editing={r}
        onSaved={() => toast('Proposal updated', { tone: 'success' })}
      />
      <ConfirmDialog
        open={dismissing}
        onOpenChange={setDismissing}
        title={`Dismiss ${r.code}?`}
        description="The proposal is kept for reference. The next check proposes the product again if it is still below the reorder point."
        confirmLabel="Dismiss"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'replenishments/dismiss', id: r.id })
          setDismissing(false)
          toast('Proposal dismissed', { tone: 'default' })
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${r.code}?`}
        description="The proposal disappears from the list. A manufacturing order created from it keeps running."
        confirmLabel="Delete proposal"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'replenishments/remove', id: r.id })
          setDeleting(false)
          toast('Proposal deleted', { tone: 'default' })
          navigate(LIST, { replace: true })
        }}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string
  value: string
  unit?: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex items-end leading-none">
        <span
          className={
            accent
              ? 'text-3xl font-bold tracking-tight text-accent tabular-nums'
              : 'text-3xl font-bold tracking-tight tabular-nums'
          }
        >
          {value}
        </span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
