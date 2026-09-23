import { DAY, fmtAgo, nowMs, toMs } from '@mes/fixtures'
import type { Eco, EcoStatus } from '@mes/types'
import { ECO_STATUS_LABEL } from '@mes/types'
import { Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { ArrowRight, CheckCircle2, FileDiff, FileSearch, Plus, Rocket, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { EcoStatusBadge } from '../../components/badges'
import { PersonChip, ProductLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { EcoDialog } from './EcoDialog'
import { ECO_AFFECTS_LABEL, matches } from './lib'

const STATUS_CHIPS: EcoStatus[] = ['draft', 'review', 'approved', 'released', 'rejected']

export function EcoPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<EcoStatus | null>('status', null)
  const table = useTableHistory()
  const creating = params.get('new') === '1'
  const presetProduct = params.get('product')
  const setCreating = (open: boolean) =>
    setParams(
      (p) => {
        if (open) p.set('new', '1')
        else {
          p.delete('new')
          p.delete('product')
        }
        return p
      },
      { replace: true },
    )

  const rows = useMemo(
    () =>
      s.ecos
        .filter(
          (e) =>
            (!status || e.status === status) &&
            matches(query, e.code, e.title, s.productName(e.productId), s.productCode(e.productId)),
        )
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [s, query, status],
  )

  const stats = useMemo(() => {
    const cutoff = nowMs() - 30 * DAY
    return {
      draft: s.ecos.filter((e) => e.status === 'draft').length,
      review: s.ecos.filter((e) => e.status === 'review').length,
      approved: s.ecos.filter((e) => e.status === 'approved').length,
      released: s.ecos.filter((e) => e.status === 'released' && e.releasedAt && toMs(e.releasedAt) >= cutoff)
        .length,
    }
  }, [s.ecos])

  const rev = (id: string | null) => (id ? (s.maps.revision.get(id)?.rev ?? '?') : null)

  const columns: Column<Eco>[] = [
    {
      id: 'code',
      header: 'ECO',
      sortValue: (e) => e.code,
      cell: (e) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{e.code}</p>
          <p className="text-sm truncate">{e.title}</p>
          <p className="text-xs lg:hidden truncate text-muted">{s.productName(e.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <EcoStatusBadge status={e.status} />
          </div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'lg',
      sortValue: (e) => s.productCode(e.productId),
      cell: (e) => <ProductLink productId={e.productId} />,
    },
    {
      id: 'revs',
      header: 'Revision',
      hideBelow: 'md',
      sortValue: (e) => rev(e.fromRevisionId) ?? '',
      cell: (e) => (
        <span className="gap-1.5 text-xs inline-flex items-center font-mono">
          {rev(e.fromRevisionId)}
          <ArrowRight className="size-3 text-muted" />
          {rev(e.toRevisionId) ?? <span className="text-muted">next</span>}
        </span>
      ),
    },
    {
      id: 'affects',
      header: 'Affects',
      hideBelow: 'xl',
      cell: (e) => (
        <span className="gap-1 flex flex-wrap">
          {e.affects.map((a) => (
            <span key={a} className="px-2 py-0.5 rounded-full bg-surface text-[11px]">
              {ECO_AFFECTS_LABEL[a]}
            </span>
          ))}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (e) => e.status,
      cell: (e) => <EcoStatusBadge status={e.status} />,
    },
    {
      id: 'requested',
      header: 'Requested',
      hideBelow: 'md',
      sortValue: (e) => e.requestedAt,
      cell: (e) => <PersonChip personId={e.requestedBy} hint={fmtAgo(e.requestedAt, now)} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Engineering change orders"
        description="Controlled changes to released product data. An approved and released ECO produces the next revision."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search change orders"
              leftIcon={<Search />}
              placeholder="Search code, title or product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('plm.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New ECO
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Draft"
            value={stats.draft}
            hint="Being described"
            icon={<FileDiff />}
            tone="default"
            onClick={() => setStatus('draft')}
          />
          <StatCard
            label="In review"
            value={stats.review}
            hint="Waiting for a decision"
            icon={<FileSearch />}
            tone={stats.review ? 'warning' : 'default'}
            onClick={() => setStatus('review')}
          />
          <StatCard
            label="Approved"
            value={stats.approved}
            hint="Ready to release"
            icon={<CheckCircle2 />}
            tone="info"
            onClick={() => setStatus('approved')}
          />
          <StatCard
            label="Released"
            value={stats.released}
            hint="Last 30 days"
            icon={<Rocket />}
            tone="success"
            onClick={() => setStatus('released')}
          />
        </div>
        <ChipRow className="max-w-full">
          <Chip variant="filter" active={!status} count={s.ecos.length} onClick={() => setStatus(null)}>
            All
          </Chip>
          {STATUS_CHIPS.map((st) => (
            <Chip
              key={st}
              variant="filter"
              active={status === st}
              count={s.ecos.filter((e) => e.status === st).length}
              onClick={() => setStatus(status === st ? null : st)}
            >
              {ECO_STATUS_LABEL[st]}
            </Chip>
          ))}
        </ChipRow>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
          onRowClick={(e) => navigate(paths.eco(e.id))}
          resetPageKey={`${query}|${status}`}
          empty="No change orders match."
          {...table}
        />
      </div>
      <EcoDialog
        open={creating}
        onOpenChange={setCreating}
        productId={presetProduct}
        onSaved={(eco) => navigate(paths.eco(eco.id))}
      />
    </>
  )
}
