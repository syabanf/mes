import { currentRevision, fmtIdr, fmtNumber } from '@mes/fixtures'
import type { Product } from '@mes/types'
import { STRATEGY_LABEL } from '@mes/types'
import {
  Button,
  Card,
  type Column,
  DataTable,
  EmptyState,
  IconTile,
  Input,
  PageHeader,
  PillTabs,
  SplitStats,
  StatCard,
} from '@mes/ui'
import { FileDiff, GitBranch, Package, Plus, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RevisionBadge, StrategyBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useScoped } from '../../state/scoped'
import { matches, openMosFor } from './lib'
import { ProductDialog } from './ProductDialog'

type View = 'cards' | 'table'

export function ProductsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useHistoryState('query', '')
  const [view, setView] = usePersistentState<View>('mes.admin.plm.products.view', 'cards')
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()

  const rows = useMemo(
    () =>
      s.products
        .filter((p) => p.active && matches(query, p.code, p.name, s.maps.category.get(p.categoryId)?.name))
        .map((p) => {
          const revision = currentRevision(s.state, p.id)
          return {
            product: p,
            revision,
            bomItems: revision?.bomId ? (s.maps.bom.get(revision.bomId)?.items.length ?? 0) : 0,
            operations: revision?.bopId ? (s.maps.bop.get(revision.bopId)?.operations.length ?? 0) : 0,
            openMos: openMosFor(s.manufacturingOrders, p.id).length,
          }
        })
        .sort((a, b) => a.product.code.localeCompare(b.product.code)),
    [s, query],
  )
  type Row = (typeof rows)[number]

  const stats = useMemo(
    () => ({
      products: s.products.filter((p) => p.active).length,
      released: s.productRevisions.filter((r) => r.state === 'released').length,
      pending: s.productRevisions.filter((r) => r.state === 'draft' || r.state === 'review').length,
      openEcos: s.ecos.filter((e) => e.status === 'draft' || e.status === 'review' || e.status === 'approved')
        .length,
    }),
    [s.products, s.productRevisions, s.ecos],
  )

  const columns: Column<Row>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (r) => r.product.code,
      cell: (r) => (
        <div className="min-w-0 gap-3 flex items-center">
          <IconTile tone="ink" size="sm">
            <Package />
          </IconTile>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{r.product.name}</p>
            <p className="font-mono text-[11px] text-muted">{r.product.code}</p>
            <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
              {r.revision && <RevisionBadge state={r.revision.state} />}
              <StrategyBadge strategy={r.product.defaultStrategy} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'lg',
      sortValue: (r) => s.maps.category.get(r.product.categoryId)?.name ?? '',
      cell: (r) => s.maps.category.get(r.product.categoryId)?.name ?? 'Uncategorised',
    },
    {
      id: 'revision',
      header: 'Revision',
      hideBelow: 'sm',
      sortValue: (r) => r.revision?.rev ?? '',
      cell: (r) =>
        r.revision ? (
          <span className="gap-2 inline-flex items-center">
            <span className="text-xs font-mono">{r.revision.rev}</span>
            <RevisionBadge state={r.revision.state} />
          </span>
        ) : (
          <span className="text-muted">No revision</span>
        ),
    },
    {
      id: 'strategy',
      header: 'Strategy',
      hideBelow: 'md',
      sortValue: (r) => r.product.defaultStrategy,
      cell: (r) => <StrategyBadge strategy={r.product.defaultStrategy} />,
    },
    {
      id: 'weight',
      header: 'Weight',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.product.unitWeightG,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.product.unitWeightG, 1)} g</span>,
    },
    {
      id: 'bom',
      header: 'BOM items',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.bomItems,
      cell: (r) => <span className="tabular-nums">{r.bomItems}</span>,
    },
    {
      id: 'ops',
      header: 'Operations',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.operations,
      cell: (r) => <span className="tabular-nums">{r.operations}</span>,
    },
    {
      id: 'mos',
      header: 'Open MOs',
      align: 'right',
      sortValue: (r) => r.openMos,
      cell: (r) => <span className="tabular-nums">{r.openMos}</span>,
    },
    {
      id: 'cost',
      header: 'Std cost',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (r) => r.product.standardCostIdr,
      cell: (r) => <span className="tabular-nums">{fmtIdr(r.product.standardCostIdr)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Products"
        description="Every product and the released revision that defines how it is made."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search products"
              leftIcon={<Search />}
              placeholder="Search code or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('plm.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Add product
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Products"
            value={stats.products}
            hint="Active in the catalogue"
            icon={<Package />}
            tone="ink"
          />
          <StatCard
            label="Released revisions"
            value={stats.released}
            hint="Ready for production"
            icon={<ShieldCheck />}
            tone="success"
          />
          <StatCard
            label="Draft or in review"
            value={stats.pending}
            hint="Revisions waiting for release"
            icon={<GitBranch />}
            tone={stats.pending ? 'warning' : 'default'}
            onClick={() => navigate('/plm/revisions')}
          />
          <StatCard
            label="Open ECOs"
            value={stats.openEcos}
            hint="Draft, in review or approved"
            icon={<FileDiff />}
            tone="info"
            onClick={() => navigate('/plm/eco')}
          />
        </div>
        <div className="gap-2 flex flex-wrap items-center justify-between">
          <PillTabs
            value={view}
            onValueChange={(v) => setView(v as View)}
            items={[
              { value: 'cards', label: 'Cards' },
              { value: 'table', label: 'Table' },
            ]}
          />
          <p className="text-xs text-muted">{fmtNumber(rows.length)} products</p>
        </div>
        {view === 'table' ? (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.product.id}
            onRowClick={(r) => navigate(paths.product(r.product.id))}
            resetPageKey={query}
            empty="No products match."
            {...table}
          />
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              title="No products match"
              description="Try another code or name, or add the product."
              action={
                can('plm.manage') ? <Button onClick={() => setCreating(true)}>Add product</Button> : undefined
              }
            />
          </Card>
        ) : (
          <div className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
            {rows.map((r) => (
              <ProductCard key={r.product.id} row={r} onOpen={() => navigate(paths.product(r.product.id))} />
            ))}
          </div>
        )}
      </div>
      <ProductDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(p) => navigate(paths.product(p.id))}
      />
    </>
  )
}

function ProductCard({
  row,
  onOpen,
}: {
  row: {
    product: Product
    revision: ReturnType<typeof currentRevision>
    bomItems: number
    operations: number
    openMos: number
  }
  onOpen: () => void
}) {
  const { product, revision } = row
  return (
    <Card
      className="p-5 flex cursor-pointer flex-col transition-colors hover:bg-surface-2"
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="gap-3 flex items-start">
        <IconTile tone="ink">
          <Package />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold truncate">{product.name}</p>
          <p className="text-xs font-mono text-muted">{product.code}</p>
        </div>
      </div>
      <div className="mt-4 gap-2 flex flex-wrap items-center">
        {revision ? (
          <>
            <span className="text-xs font-semibold font-mono">{revision.rev}</span>
            <RevisionBadge state={revision.state} />
          </>
        ) : (
          <span className="text-xs text-muted">No revision yet</span>
        )}
        <StrategyBadge strategy={product.defaultStrategy} />
        <span className="text-xs ml-auto text-muted">{STRATEGY_LABEL[product.defaultStrategy]}</span>
      </div>
      <SplitStats
        className="mt-5"
        items={[
          { label: 'BOM items', value: row.bomItems },
          { label: 'Operations', value: row.operations },
          { label: 'Open MOs', value: row.openMos },
        ]}
      />
    </Card>
  )
}
