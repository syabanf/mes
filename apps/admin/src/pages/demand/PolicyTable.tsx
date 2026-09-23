import { fmtNumber } from '@mes/fixtures'
import { Badge, type Column, DataTable, EmptyState } from '@mes/ui'
import { useMemo } from 'react'
import { ProductLink } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { type PolicyRow, policyRows } from './lib'

/** Inventory policies with live on-hand, free and projected stock. Shared by Fulfillment and Replenishment. */
export function PolicyTable() {
  const s = useScoped()
  const rows = useMemo(
    () =>
      policyRows(s).sort(
        (a, b) => a.projected - a.policy.reorderPoint - (b.projected - b.policy.reorderPoint),
      ),
    [s],
  )

  const columns: Column<PolicyRow>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (r) => s.productName(r.policy.productId),
      cell: (r) => (
        <div className="min-w-0">
          <ProductLink productId={r.policy.productId} />
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <span className="text-xs text-muted tabular-nums">
              {fmtNumber(r.projected)} projected · reorder at {fmtNumber(r.policy.reorderPoint)}
            </span>
            {r.belowReorder && <Badge variant="warning">Below reorder point</Badge>}
          </div>
        </div>
      ),
    },
    {
      id: 'onHand',
      header: 'On hand',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.onHand,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.onHand)}</span>,
    },
    {
      id: 'free',
      header: 'Free',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.free,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.free)}</span>,
    },
    {
      id: 'safety',
      header: 'Safety',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (r) => r.policy.safetyStock,
      cell: (r) => <span className="text-muted tabular-nums">{fmtNumber(r.policy.safetyStock)}</span>,
    },
    {
      id: 'reorder',
      header: 'Reorder point',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.policy.reorderPoint,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.policy.reorderPoint)}</span>,
    },
    {
      id: 'max',
      header: 'Max',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (r) => r.policy.maxStock,
      cell: (r) => <span className="text-muted tabular-nums">{fmtNumber(r.policy.maxStock)}</span>,
    },
    {
      id: 'projected',
      header: 'Projected',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.projected,
      cell: (r) => (
        <div className="gap-1 flex flex-col items-end">
          <span className={r.belowReorder ? 'font-semibold text-accent tabular-nums' : 'tabular-nums'}>
            {fmtNumber(r.projected)}
          </span>
          <span className="text-[11px] text-muted tabular-nums">
            −{fmtNumber(r.openDemand)} demand · +{fmtNumber(r.inbound)} inbound
          </span>
        </div>
      ),
    },
    {
      id: 'flag',
      header: '',
      hideBelow: 'sm',
      cell: (r) =>
        r.belowReorder ? (
          <Badge variant="warning">Below reorder point</Badge>
        ) : (
          <Badge variant="success">Covered</Badge>
        ),
    },
  ]

  if (rows.length === 0)
    return (
      <EmptyState
        compact
        title="No inventory policies"
        description="Policies set the safety stock, reorder point and maximum per product. Add them under master data."
      />
    )
  return <DataTable columns={columns} rows={rows} getRowKey={(r) => r.policy.id} pageSize={0} />
}
