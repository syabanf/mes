import { fmtNumber, groupBy, materialReadiness, sumBy } from '@mes/fixtures'
import type { FloorStock } from '@mes/types'
import { RUNNING_MO_STATUSES } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
} from '@mes/ui'
import { Boxes, ClipboardList, PackageCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { LotStatusBadge, ReadinessBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { MaterialPicker, MoPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { MaterialMoveDialog } from './dialogs'

const runningFilter = (status: string) =>
  RUNNING_MO_STATUSES.includes(status as (typeof RUNNING_MO_STATUSES)[number])

export function ReservationPage() {
  const s = useScoped()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const moId = params.get('mo')
  const [materialId, setMaterialId] = useHistoryState<string | null>('material', null)
  const [staging, setStaging] = useState<FloorStock | null>(null)
  const manage = can('inventory.manage')

  const reserved = useMemo(
    () => s.floorStock.filter((f) => f.reservedQty > 0 && f.moId !== null),
    [s.floorStock],
  )
  const groups = useMemo(() => {
    const rows = reserved.filter(
      (f) => (!moId || f.moId === moId) && (!materialId || f.materialId === materialId),
    )
    return [...groupBy(rows, (f) => f.moId!)]
      .map(([id, list]) => ({
        mo: s.maps.mo.get(id),
        rows: list.sort((a, b) => s.materialName(a.materialId).localeCompare(s.materialName(b.materialId))),
      }))
      .filter((g): g is { mo: NonNullable<typeof g.mo>; rows: FloorStock[] } => !!g.mo)
      .sort((a, b) => a.mo.code.localeCompare(b.mo.code))
  }, [s, reserved, moId, materialId])

  const stats = useMemo(
    () => ({
      orders: new Set(reserved.map((f) => f.moId)).size,
      lots: reserved.length,
      toStage: reserved.filter((f) => s.maps.lot.get(f.lotId)?.status === 'reserved').length,
    }),
    [reserved, s.maps.lot],
  )

  const setMo = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('mo', id)
        else p.delete('mo')
        return p
      },
      { replace: true },
    )

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Lots locked to an order before they move. A reservation ends when the lot is staged, issued or consumed; there is no separate un-reserve step."
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-3 grid grid-cols-2">
          <StatCard
            label="Orders with reservations"
            value={stats.orders}
            icon={<ClipboardList />}
            tone="ink"
          />
          <StatCard
            label="Reserved lots"
            value={stats.lots}
            hint="Floor stock rows with a reserved quantity"
            icon={<Boxes />}
            tone="info"
          />
          <StatCard
            label="Waiting to stage"
            value={stats.toStage}
            hint="Reserved but still in the warehouse"
            icon={<PackageCheck />}
            tone={stats.toStage ? 'warning' : 'success'}
            className="xl:col-span-1 col-span-2"
          />
        </div>

        <div className="gap-2 flex flex-wrap items-center">
          <MoPicker
            variant="inline"
            clearable
            value={moId}
            onChange={setMo}
            filter={runningFilter}
            placeholder="Any order"
            aria-label="Filter by order"
          />
          <MaterialPicker
            variant="inline"
            clearable
            value={materialId}
            onChange={setMaterialId}
            placeholder="Any material"
            aria-label="Filter by material"
          />
        </div>

        {groups.length === 0 ? (
          <Card>
            <EmptyState
              title="No reservations"
              description="Reserve a lot from a requirement line and it appears here under its order."
              action={
                <Button asChild variant="outline">
                  <Link to="/inventory/requirements">Open requirements</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
            {groups.map(({ mo, rows }) => (
              <Card key={mo.id}>
                <CardHeader
                  action={<ReadinessBadge readiness={materialReadiness(mo.id, s.materialRequirements)} />}
                >
                  <CardTitle>
                    <MoLink moId={mo.id} showProduct={false} />
                  </CardTitle>
                  <CardDescription>
                    {s.productName(mo.productId)} · {rows.length} reserved{' '}
                    {rows.length === 1 ? 'lot' : 'lots'} ·{' '}
                    {fmtNumber(
                      sumBy(rows, (f) => f.reservedQty),
                      1,
                    )}{' '}
                    units
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rows.map((f) => {
                    const lot = s.maps.lot.get(f.lotId)
                    return (
                      <div
                        key={f.id}
                        className="gap-3 rounded-2xl p-3 flex flex-wrap items-center bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <Link
                            to={paths.lotDetail(f.lotId)}
                            className="text-xs font-semibold block truncate font-mono hover:text-accent"
                          >
                            {lot?.code ?? f.lotId}
                          </Link>
                          <span className="text-sm block truncate">{s.materialName(f.materialId)}</span>
                          <span className="text-xs block truncate text-muted">
                            {s.locationName(f.locationId)}
                          </span>
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {fmtNumber(f.reservedQty, 2)}{' '}
                          <span className="text-xs font-medium text-muted">
                            {s.uomCode(lot?.uomId ?? '')}
                          </span>
                        </span>
                        {lot && <LotStatusBadge status={lot.status} />}
                        {manage && lot?.status === 'reserved' && (
                          <Button size="sm" variant="outline" onClick={() => setStaging(f)}>
                            Stage
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {staging && staging.moId && (
        <MaterialMoveDialog
          open
          onOpenChange={(open) => !open && setStaging(null)}
          mode="stage"
          moId={staging.moId}
          materialId={staging.materialId}
          lotId={staging.lotId}
        />
      )}
    </>
  )
}
