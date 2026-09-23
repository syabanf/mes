import { fmtDateShort } from '@mes/fixtures'
import { ROLE_LABEL } from '@mes/types'
import { Button, Card, EmptyState, PageHeader } from '@mes/ui'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { borItemFor, startChecks, stationWorkOrders } from '../manufacturing/wo-lib'

type WorkItem = { id: string; title: string; detail: string; to: string }

export function RoleHome() {
  const s = useScoped()
  const role = s.user.role
  const operatorWork = stationWorkOrders(s, s.user.id).sort((a, b) => {
    const rank = (wo: typeof a) =>
      wo.operatorIds.includes(s.user.id) ? (wo.status === 'in_progress' || wo.status === 'paused' ? 0 : 1) : 2
    return rank(a) - rank(b)
  })
  const dispatchWork = s.workOrders.filter(
    (wo) =>
      (wo.status === 'ready' || wo.status === 'assigned') &&
      (((borItemFor(s, wo)?.machineIds.length ?? 0) > 0 && !wo.machineId) ||
        !wo.operatorIds.length ||
        !wo.shiftId),
  )
  const pending = s.inspections.filter((i) => i.status === 'pending' || i.status === 'in_progress')
  const demand = s.demands.filter((d) => d.status === 'open' && d.qty > d.allocatedQty + d.requirementQty)
  const items: WorkItem[] =
    role === 'operator'
      ? operatorWork
          .slice(0, 6)
          .map((wo) => ({
            id: wo.id,
            title: `${wo.code} · ${wo.operationName}`,
            detail: `${(wo.status === 'ready' || wo.status === 'assigned') && startChecks(s, wo).some((check) => check.blocking && !check.ok) ? 'Waiting for dispatch' : wo.status.replaceAll('_', ' ')} · ${s.orgName(wo.workCenterId)}`,
            to: paths.station(wo.id),
          }))
      : role === 'supervisor'
        ? dispatchWork
            .slice(0, 6)
            .map((wo) => ({
              id: wo.id,
              title: `${wo.code} · ${wo.operationName}`,
              detail: `Due ${fmtDateShort(wo.plannedEnd)} · ${s.orgName(wo.workCenterId)}`,
              to: `/manufacturing/dispatch?wo=${wo.id}`,
            }))
        : role === 'quality'
          ? [
              ...pending.map((i) => ({
                id: i.id,
                title: i.code,
                detail: `${s.maps.mo.get(i.moId)?.code ?? ''} · ${i.status.replaceAll('_', ' ')}`,
                to: paths.inspection(i.id),
              })),
              ...s.qualityHolds
                .filter((h) => h.status === 'active')
                .map((h) => ({
                  id: h.id,
                  title: `${h.code} · quality hold`,
                  detail: s.maps.mo.get(h.moId)?.code ?? '',
                  to: paths.hold(h.id),
                })),
            ].slice(0, 6)
          : role === 'planner' || role === 'marketing'
            ? demand
                .slice(0, 6)
                .map((d) => ({
                  id: d.id,
                  title: `${d.code} · ${s.productName(d.productId)}`,
                  detail: `Gap ${d.qty - d.allocatedQty - d.requirementQty} · needed ${fmtDateShort(d.requiredDate)}`,
                  to: paths.demand(d.id),
                }))
            : role === 'warehouse'
              ? s.materialRequirements
                  .filter((r) => r.status === 'shortage' || r.status === 'partial')
                  .slice(0, 6)
                  .map((r) => ({
                    id: r.id,
                    title: s.materialName(r.materialId),
                    detail: `${s.maps.mo.get(r.moId)?.code ?? ''} · ${r.status}`,
                    to: paths.requirement(r.id),
                  }))
              : s.ecos
                  .filter((e) => e.status === 'review')
                  .slice(0, 6)
                  .map((e) => ({ id: e.id, title: e.code, detail: e.title, to: paths.eco(e.id) }))
  const destination =
    role === 'operator'
      ? '/shopfloor/station'
      : role === 'supervisor'
        ? '/manufacturing/dispatch'
        : role === 'quality'
          ? '/quality/inspections'
          : role === 'planner'
            ? '/demand/fulfillment'
            : role === 'marketing'
              ? '/demand/orders'
              : role === 'warehouse'
                ? '/inventory/requirements'
                : '/plm/eco'
  const label =
    role === 'operator'
      ? 'Open operator station'
      : role === 'supervisor'
        ? 'Open dispatch'
        : role === 'quality'
          ? 'Open inspections'
          : role === 'planner'
            ? 'Open fulfillment'
            : role === 'marketing'
              ? 'Open orders'
              : role === 'warehouse'
                ? 'Open requirements'
                : 'Open engineering changes'
  const heading =
    role === 'operator'
      ? 'My work'
      : role === 'supervisor'
        ? 'Needs dispatch'
        : role === 'quality'
          ? 'Quality actions'
          : role === 'planner' || role === 'marketing'
            ? 'Demand to resolve'
            : role === 'warehouse'
              ? 'Material shortages'
              : 'Engineering reviews'

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${ROLE_LABEL[role]} home`}
        description={`Your next actions at ${s.site.name}.`}
        actions={
          <Button asChild>
            <Link to={destination}>{label}</Link>
          </Button>
        }
      />
      <Card className="p-5">
        <h2 className="text-lg font-semibold">{heading}</h2>
        {items.length === 0 ? (
          <EmptyState
            compact
            title="Nothing waiting right now"
            description="New work will appear here when it needs your role."
          />
        ) : (
          <div className="mt-4 gap-2 sm:grid-cols-2 grid">
            {items.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="rounded-2xl p-4 bg-surface-2 hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span className="text-sm font-semibold block">{item.title}</span>
                <span className="mt-1 text-xs block text-muted">{item.detail}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
