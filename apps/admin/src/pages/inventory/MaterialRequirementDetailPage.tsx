import { fmtNumber, fmtPercent, materialOnHand } from '@mes/fixtures'
import {
  ActionMenu,
  Banner,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  ProgressBar,
  SegmentBar,
  cn,
  toast,
} from '@mes/ui'
import { Flame, Forklift, MoreHorizontal, PackageCheck, PackagePlus, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { LotStatusBadge, RequirementBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { HeroMetric, TxnTable } from './detail'
import { MaterialMoveDialog, type MoveMode, RequirementDialog } from './dialogs'
import { coverageSegments, coveredQty, coveredRatio, operationName, shortfall } from './lib'

export function MaterialRequirementDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const r = s.materialRequirements.find((x) => x.id === id)
  const [move, setMove] = useState<MoveMode | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const lots = useMemo(
    () => s.floorStock.filter((f) => r && f.moId === r.moId && f.materialId === r.materialId),
    [s.floorStock, r],
  )
  const txns = useMemo(
    () =>
      s.materialTxns
        .filter((t) => r && t.moId === r.moId && t.materialId === r.materialId)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [s.materialTxns, r],
  )

  if (!r) {
    return (
      <Card>
        <EmptyState
          title="Requirement line not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/inventory/requirements" />}
        />
      </Card>
    )
  }

  const mo = s.maps.mo.get(r.moId)
  const material = s.maps.material.get(r.materialId)
  const uom = s.uomCode(r.uomId)
  const qty = (n: number) => `${fmtNumber(n, 2)} ${uom}`
  const ratio = coveredRatio(r)
  const short = shortfall(r)
  const free = materialOnHand(s, r.materialId, s.siteId)
  const manage = can('inventory.manage')
  const open = r.status !== 'consumed'
  const segments = [
    ...coverageSegments(r),
    { key: 'returned', value: r.returnedQty, className: 'bg-silver', label: 'Returned' },
  ]

  const menu = [
    manage && open
      ? { key: 'issue', label: 'Issue to floor', icon: <Forklift />, onSelect: () => setMove('issue') }
      : null,
    manage && open
      ? { key: 'consume', label: 'Record consumption', icon: <Flame />, onSelect: () => setMove('consume') }
      : null,
    manage && open ? ('separator' as const) : null,
    manage ? { key: 'edit', label: 'Edit line', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete line',
          icon: <Trash2 />,
          destructive: true,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/inventory/requirements" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && open && (
            <>
              <Button variant="outline" onClick={() => setMove('reserve')}>
                <PackagePlus />
                Reserve
              </Button>
              <Button onClick={() => setMove('stage')}>
                <PackageCheck />
                Stage
              </Button>
            </>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={s.materialName(r.materialId)}
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
            <p className="text-xs font-mono text-on-ink-muted">
              {material?.code} · {mo?.code ?? 'Order removed'}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{s.materialName(r.materialId)}</h1>
            <p className="text-sm text-on-ink-muted">
              Op {r.operationSeq} · {operationName(s, mo, r.operationSeq)}
              {mo ? ` · ${s.productName(mo.productId)}` : ''}
            </p>
          </div>
          <RequirementBadge status={r.status} />
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <HeroMetric label="Required" value={fmtNumber(r.requiredQty, 2)} unit={uom} />
          <HeroMetric label="Covered" value={fmtPercent(ratio)} unit={qty(coveredQty(r))} />
          <HeroMetric label="Consumed" value={fmtNumber(r.consumedQty, 2)} unit={uom} />
          <HeroMetric label="Free on hand" value={fmtNumber(free, 2)} unit={uom} />
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-xs flex items-center justify-between text-on-ink-muted">
            <span>
              {qty(coveredQty(r))} of {qty(r.requiredQty)} covered
            </span>
            <span>{fmtPercent(ratio)}</span>
          </div>
          <ProgressBar value={ratio} tone="white" aria-label={`${fmtPercent(ratio)} covered`} />
        </div>
      </Card>

      {short > 0 && (
        <Banner tone={free >= short ? 'warning' : 'danger'} title={`Short by ${qty(short)}`}>
          {free >= short
            ? `${qty(free)} free in available lots. Reserve a lot to cover it.`
            : `Only ${qty(free)} free in available lots. The rest has to be received first; purchasing sits outside this screen.`}
        </Banner>
      )}

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <SegmentBar segments={segments} />
            <ul className="mt-4 gap-2 sm:grid-cols-3 grid grid-cols-2">
              {segments.map((seg) => (
                <li
                  key={seg.key}
                  className="gap-2 rounded-xl px-3 py-2 text-xs flex items-center bg-surface-2"
                >
                  <span className={cn('size-2.5 shrink-0 rounded-full', seg.className)} />
                  <span className="min-w-0">
                    <span className="block text-muted">{seg.label}</span>
                    <span className="font-semibold block tabular-nums">{qty(seg.value)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Order', value: mo ? <MoLink moId={mo.id} /> : 'Removed' },
                { label: 'Operation', value: `${r.operationSeq} · ${operationName(s, mo, r.operationSeq)}` },
                {
                  label: 'Material',
                  value: <span className="text-xs font-mono">{material?.code ?? r.materialId}</span>,
                },
                { label: 'Required', value: qty(r.requiredQty) },
                {
                  label: 'Still to issue',
                  value: qty(Math.max(0, r.requiredQty - r.issuedQty - r.consumedQty)),
                },
                { label: 'Free on hand', value: qty(free) },
                { label: 'Status', value: <RequirementBadge status={r.status} /> },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lots on this line</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lots.length === 0 ? (
            <EmptyState
              compact
              title="No lots on this line"
              description="Reserve a lot to lock it to this order; it shows here with its location and status."
              action={
                manage && open ? (
                  <Button size="sm" variant="outline" onClick={() => setMove('reserve')}>
                    <PackagePlus />
                    Reserve
                  </Button>
                ) : undefined
              }
            />
          ) : (
            lots.map((f) => {
              const lot = s.maps.lot.get(f.lotId)
              return (
                <Link
                  key={f.id}
                  to={paths.lotDetail(f.lotId)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-xs font-semibold block truncate font-mono">
                      {lot?.code ?? f.lotId}
                    </span>
                    <span className="text-xs block truncate text-muted">
                      {s.locationName(f.locationId)} · {qty(f.reservedQty)} reserved of {qty(f.qty)}
                    </span>
                  </span>
                  {lot && <LotStatusBadge status={lot.status} />}
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <TxnTable txns={txns} now={now} />
      </Card>

      <MaterialMoveDialog
        open={!!move}
        onOpenChange={(o) => !o && setMove(null)}
        mode={move ?? 'reserve'}
        moId={r.moId}
        materialId={r.materialId}
      />
      <RequirementDialog open={editing} onOpenChange={setEditing} editing={r} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this requirement line?"
        description="Removes the line from the order. Transactions already recorded stay on the lot history."
        confirmLabel="Delete line"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'materialRequirements/remove', id: r.id })
          setDeleting(false)
          toast('Requirement line deleted', { tone: 'default' })
          navigate('/inventory/requirements')
        }}
      />
    </div>
  )
}
