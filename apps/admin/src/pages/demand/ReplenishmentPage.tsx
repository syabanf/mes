import { DAY, fmtAgo, fmtNumber, toMs } from '@mes/fixtures'
import type { Replenishment } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type Column,
  ConfirmDialog,
  DataTable,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import { Ban, Check, CircleCheckBig, Factory, Hourglass, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { ReplenishmentStatusBadge } from '../../components/badges'
import { MoLink, ProductLink, paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { ApproveReplenishmentDialog } from './ApproveReplenishmentDialog'
import { PolicyTable } from './PolicyTable'
import { ReplenishmentDialog } from './ReplenishmentDialog'

export function ReplenishmentPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const table = useTableHistory()
  const [creating, setCreating] = useState(false)
  const [approving, setApproving] = useState<Replenishment | null>(null)
  const [dismissing, setDismissing] = useState<Replenishment | null>(null)
  const manage = can('demand.manage')

  // The reducer runs synchronously, so the count before the dispatch is compared with the count after the next render.
  const countBeforeRun = useRef<number | null>(null)
  const [runKey, setRunKey] = useState(0)
  const total = s.replenishments.length
  useEffect(() => {
    if (countBeforeRun.current === null) return
    const created = total - countBeforeRun.current
    countBeforeRun.current = null
    if (created > 0)
      toast(`${fmtNumber(created)} ${created === 1 ? 'proposal' : 'proposals'} created`, {
        tone: 'success',
        description: 'Approve each one to create its manufacturing order.',
      })
    else
      toast('Nothing to replenish', {
        description: 'Every product with a policy projects above its reorder point.',
      })
  }, [runKey, total])
  const run = () => {
    countBeforeRun.current = total
    s.dispatch({ type: 'replenishments/run', siteId: s.siteId })
    setRunKey((k) => k + 1)
  }

  const rows = [...s.replenishments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const stats = {
    proposed: rows.filter((r) => r.status === 'proposed').length,
    inProduction: rows.filter((r) => r.status === 'approved' || r.status === 'in_production').length,
    received: rows.filter((r) => r.status === 'received' && now - toMs(r.createdAt) < 30 * DAY).length,
    dismissed: rows.filter((r) => r.status === 'dismissed').length,
  }

  const columns: Column<Replenishment>[] = [
    {
      id: 'code',
      header: 'Proposal',
      sortValue: (r) => r.code,
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{r.code}</p>
          <p className="text-xs sm:hidden truncate text-muted">{s.productName(r.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <ReplenishmentStatusBadge status={r.status} />
          </div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'sm',
      sortValue: (r) => s.productName(r.productId),
      cell: (r) => <ProductLink productId={r.productId} />,
    },
    {
      id: 'onHand',
      header: 'On hand',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.onHand,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.onHand)}</span>,
    },
    {
      id: 'projected',
      header: 'Projected',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.projected,
      cell: (r) => (
        <span
          className={r.projected < r.reorderPoint ? 'font-semibold text-accent tabular-nums' : 'tabular-nums'}
        >
          {fmtNumber(r.projected)}
        </span>
      ),
    },
    {
      id: 'reorder',
      header: 'Reorder point',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (r) => r.reorderPoint,
      cell: (r) => <span className="text-muted tabular-nums">{fmtNumber(r.reorderPoint)}</span>,
    },
    {
      id: 'required',
      header: 'Required',
      align: 'right',
      sortValue: (r) => r.requiredQty,
      cell: (r) => <span className="font-semibold tabular-nums">{fmtNumber(r.requiredQty)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (r) => r.status,
      cell: (r) => <ReplenishmentStatusBadge status={r.status} />,
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'lg',
      cell: (r) =>
        r.moId ? <MoLink moId={r.moId} showProduct={false} /> : <span className="text-muted">—</span>,
    },
    {
      id: 'created',
      header: 'Created',
      hideBelow: 'xl',
      sortValue: (r) => r.createdAt,
      cell: (r) => <span className="text-muted">{fmtAgo(r.createdAt, now)}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        manage && r.status === 'proposed' ? (
          <div className="gap-1.5 flex flex-wrap justify-end">
            <Button size="sm" onClick={() => setApproving(r)}>
              <Check />
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissing(r)}>
              <Ban />
              Dismiss
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Replenishment"
        description="Make-to-stock proposals for products whose projected stock falls below the reorder point."
        actions={
          manage && (
            <>
              <Button variant="outline" onClick={() => setCreating(true)}>
                <Plus />
                New proposal
              </Button>
              <Button onClick={run}>
                <RefreshCw />
                Run replenishment check
              </Button>
            </>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Proposed"
            value={stats.proposed}
            hint="Waiting for approval"
            icon={<Hourglass />}
            tone={stats.proposed ? 'warning' : 'default'}
          />
          <StatCard
            label="In production"
            value={stats.inProduction}
            hint="Approved, order running"
            icon={<Factory />}
            tone="ink"
          />
          <StatCard
            label="Received"
            value={stats.received}
            hint="Last 30 days"
            icon={<CircleCheckBig />}
            tone="success"
          />
          <StatCard
            label="Dismissed"
            value={stats.dismissed}
            hint="Not acted on"
            icon={<Ban />}
            tone="default"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(paths.replenishment(r.id))}
          empty="No proposals yet. Run the check to compare projected stock with each reorder point."
          {...table}
        />
        <Card>
          <CardHeader>
            <CardTitle>Projected stock</CardTitle>
          </CardHeader>
          <CardContent>
            <PolicyTable />
          </CardContent>
        </Card>
      </div>
      <ReplenishmentDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(r) => {
          toast('Proposal created', { tone: 'success', description: r.code })
          navigate(paths.replenishment(r.id))
        }}
      />
      <ApproveReplenishmentDialog
        replenishment={approving}
        onOpenChange={(open) => !open && setApproving(null)}
      />
      <ConfirmDialog
        open={!!dismissing}
        onOpenChange={(open) => !open && setDismissing(null)}
        title={`Dismiss ${dismissing?.code ?? ''}?`}
        description="The proposal is kept for reference. The next check proposes the product again if it is still below the reorder point."
        confirmLabel="Dismiss"
        destructive
        onConfirm={() => {
          if (dismissing) s.dispatch({ type: 'replenishments/dismiss', id: dismissing.id })
          setDismissing(null)
          toast('Proposal dismissed', { tone: 'default' })
        }}
      />
    </>
  )
}
