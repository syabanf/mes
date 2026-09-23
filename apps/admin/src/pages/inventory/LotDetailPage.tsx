import { fmtAgo, fmtDate, fmtDateShort, fmtDateTime, fmtNumber, sumBy } from '@mes/fixtures'
import { MATERIAL_CLASS_LABEL } from '@mes/types'
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
  toast,
} from '@mes/ui'
import { GitBranch, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { LotStatusBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { HeroMetric, TxnTable } from './detail'
import { LotDialog } from './dialogs'
import { lotDeleteBlocker } from './lib'

export function LotDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const lot = s.maps.lot.get(id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const rows = useMemo(() => s.floorStock.filter((f) => f.lotId === id), [s.floorStock, id])
  const txns = useMemo(
    () => s.materialTxns.filter((t) => t.lotId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [s.materialTxns, id],
  )

  if (!lot) {
    return (
      <Card>
        <EmptyState
          title="Lot not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/inventory/floor-stock" />}
        />
      </Card>
    )
  }

  const material = s.maps.material.get(lot.materialId)
  const supplier = lot.supplierId ? s.maps.supplier.get(lot.supplierId) : undefined
  const uom = s.uomCode(lot.uomId)
  const qty = (n: number) => `${fmtNumber(n, 2)} ${uom}`
  const reserved = sumBy(rows, (f) => f.reservedQty)
  const moIds = [...new Set(rows.map((f) => f.moId).filter((m): m is string => !!m))]
  const hold = s.qualityHolds.find(
    (h) => h.target === 'lot' && h.targetId === lot.id && h.status === 'active',
  )
  const manage = can('inventory.manage')
  const blocker = lotDeleteBlocker(lot, s.floorStock)

  const menu = [
    manage ? { key: 'edit', label: 'Edit lot', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete lot',
          icon: <Trash2 />,
          destructive: true,
          disabled: !!blocker,
          description: blocker ?? undefined,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/inventory/floor-stock" />
        <div className="gap-2 flex flex-wrap items-center">
          <Button asChild variant="outline">
            <Link to={paths.lot(lot.id)}>
              <GitBranch />
              Trace forward
            </Link>
          </Button>
          {menu.length > 0 && (
            <ActionMenu
              title={lot.code}
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

      <Card variant="ink" className="p-5">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{material?.code ?? lot.materialId}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight font-mono">{lot.code}</h1>
            <p className="text-sm text-on-ink-muted">
              {s.materialName(lot.materialId)} · {s.locationName(lot.locationId)} ·{' '}
              {supplier?.name ?? 'No supplier'}
            </p>
          </div>
          <LotStatusBadge status={lot.status} />
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <HeroMetric label="Quantity" value={fmtNumber(lot.qty, 2)} unit={uom} />
          <HeroMetric label="Reserved" value={fmtNumber(reserved, 2)} unit={uom} />
          <HeroMetric
            label="Received"
            value={fmtAgo(lot.receivedAt, now)}
            unit={fmtDateShort(lot.receivedAt)}
          />
          <HeroMetric label="Expires" value={lot.expiresAt ? fmtDateShort(lot.expiresAt) : 'None'} />
        </div>
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Lot</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                {
                  label: 'Material',
                  value: (
                    <span className="min-w-0 flex flex-col">
                      <span className="truncate">{s.materialName(lot.materialId)}</span>
                      <span className="truncate font-mono text-[11px] text-muted">
                        {material?.code} · {material ? MATERIAL_CLASS_LABEL[material.materialClass] : ''}
                      </span>
                    </span>
                  ),
                },
                {
                  label: 'Supplier',
                  value: supplier ? `${supplier.name} · ${supplier.city}` : 'No supplier',
                },
                { label: 'Location', value: s.locationName(lot.locationId) },
                {
                  label: 'Received',
                  value: `${fmtDateTime(lot.receivedAt)} · ${fmtAgo(lot.receivedAt, now)}`,
                },
                { label: 'Expires', value: lot.expiresAt ? fmtDate(lot.expiresAt) : 'No expiry' },
                {
                  label: 'Orders',
                  value: moIds.length ? (
                    <span className="gap-x-4 gap-y-1 flex flex-wrap">
                      {moIds.map((moId) => (
                        <MoLink key={moId} moId={moId} />
                      ))}
                    </span>
                  ) : (
                    'Not reserved'
                  ),
                },
                {
                  label: 'Quality hold',
                  value: hold ? (
                    <Link to={paths.hold(hold.id)} className="text-xs font-mono hover:text-accent">
                      {hold.code} · {s.reasonLabel(hold.reasonCodeId)}
                    </Link>
                  ) : null,
                  hidden: !hold,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Floor stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 ? (
              <EmptyState
                compact
                title="No floor stock rows"
                description="Rows appear when the lot is reserved or staged for an order."
              />
            ) : (
              rows.map((f) => (
                <div key={f.id} className="gap-3 rounded-2xl p-3 flex flex-wrap items-center bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">
                      {s.locationName(f.locationId)}
                    </span>
                    <span className="text-xs block truncate text-muted">
                      {qty(f.reservedQty)} reserved of {qty(f.qty)}
                    </span>
                  </span>
                  {f.moId ? (
                    <MoLink moId={f.moId} showProduct={false} />
                  ) : (
                    <span className="text-xs text-muted">Unreserved</span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <TxnTable txns={txns} now={now} lotColumn={false} />
      </Card>

      <LotDialog open={editing} onOpenChange={setEditing} lot={lot} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${lot.code}?`}
        description="Removes the lot record. Its transactions stay in the history without a lot to open."
        confirmLabel="Delete lot"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'materialLots/remove', id: lot.id })
          setDeleting(false)
          toast('Lot deleted', { tone: 'default' })
          navigate('/inventory/floor-stock')
        }}
      />
    </div>
  )
}
