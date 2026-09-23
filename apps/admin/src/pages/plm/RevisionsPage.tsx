import { fmtDate, fmtDateShort } from '@mes/fixtures'
import type { ProductRevision, RevisionState } from '@mes/types'
import { REVISION_STATE_LABEL } from '@mes/types'
import {
  Button,
  Card,
  Chip,
  ChipRow,
  type Column,
  ConfirmDialog,
  DataTable,
  Input,
  PageHeader,
  toast,
} from '@mes/ui'
import { ArrowRight, Rocket, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RevisionBadge } from '../../components/badges'
import { PersonChip, ProductLink, paths } from '../../components/links'
import { ProductPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { REVISION_STATES, matches } from './lib'

export function RevisionsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useHistoryState('query', '')
  const [state, setState] = useHistoryState<RevisionState | null>('state', null)
  const [productId, setProductId] = useHistoryState<string | null>('product', null)
  const [releasing, setReleasing] = useState<ProductRevision | null>(null)
  const table = useTableHistory()
  const manage = can('plm.manage')

  const rows = useMemo(
    () =>
      s.productRevisions
        .filter(
          (r) =>
            (!state || r.state === state) &&
            (!productId || r.productId === productId) &&
            matches(query, r.rev, r.changeReason, s.productName(r.productId), s.productCode(r.productId)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s, query, state, productId],
  )

  const governance = useMemo(() => {
    const eco = (st: string) => s.ecos.filter((e) => e.status === st).length
    return [
      {
        label: 'Current revision',
        count: s.productRevisions.filter((r) => r.state === 'released').length,
        hint: 'released',
        to: '/plm/revisions',
      },
      { label: 'ECO', count: s.ecos.length, hint: 'raised', to: '/plm/eco' },
      { label: 'Proposed', count: eco('draft'), hint: 'draft', to: '/plm/eco' },
      { label: 'Review', count: eco('review'), hint: 'in review', to: '/plm/eco' },
      { label: 'Approval', count: eco('approved'), hint: 'approved', to: '/plm/eco' },
      { label: 'Release', count: eco('released'), hint: 'released', to: '/plm/eco' },
      {
        label: 'New revision',
        count: s.productRevisions.filter((r) => r.state === 'draft' || r.state === 'review').length,
        hint: 'pending',
        to: '/plm/revisions',
      },
    ]
  }, [s.ecos, s.productRevisions])

  const doc = (id: string | null, map: Map<string, { code: string }>) =>
    id ? (map.get(id)?.code ?? id) : null
  const previousReleased = releasing
    ? s.productRevisions.find(
        (r) => r.productId === releasing.productId && r.state === 'released' && r.id !== releasing.id,
      )
    : undefined

  const columns: Column<ProductRevision>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (r) => s.productCode(r.productId),
      cell: (r) => (
        <div className="min-w-0">
          <ProductLink productId={r.productId} />
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap items-center">
            <span className="text-xs font-semibold font-mono">{r.rev}</span>
            <RevisionBadge state={r.state} />
          </div>
        </div>
      ),
    },
    {
      id: 'rev',
      header: 'Rev',
      hideBelow: 'sm',
      sortValue: (r) => r.rev,
      cell: (r) => <span className="text-xs font-semibold font-mono">{r.rev}</span>,
    },
    {
      id: 'state',
      header: 'State',
      hideBelow: 'sm',
      sortValue: (r) => r.state,
      cell: (r) => <RevisionBadge state={r.state} />,
    },
    {
      id: 'effective',
      header: 'Effective',
      hideBelow: 'md',
      sortValue: (r) => r.effectiveFrom ?? '',
      cell: (r) =>
        r.effectiveFrom ? (
          <span className="gap-1.5 text-xs inline-flex items-center">
            {fmtDateShort(r.effectiveFrom)}
            <ArrowRight className="size-3 text-muted" />
            {r.effectiveUntil ? fmtDateShort(r.effectiveUntil) : 'open'}
          </span>
        ) : (
          <span className="text-xs text-muted">Not effective</span>
        ),
    },
    {
      id: 'released',
      header: 'Released',
      hideBelow: 'lg',
      sortValue: (r) => r.releasedAt ?? '',
      cell: (r) =>
        r.releasedBy ? (
          <PersonChip personId={r.releasedBy} hint={r.releasedAt ? fmtDateShort(r.releasedAt) : undefined} />
        ) : (
          <span className="text-xs text-muted">Not released</span>
        ),
    },
    {
      id: 'docs',
      header: 'BOM / BOR / BOP',
      hideBelow: 'xl',
      cell: (r) => (
        <span className="flex flex-col font-mono text-[11px] text-muted">
          <DocRef id={r.bomId} code={doc(r.bomId, s.maps.bom)} path={paths.bom} empty="no BOM" />
          <DocRef id={r.borId} code={doc(r.borId, s.maps.bor)} path={paths.bor} empty="no BOR" />
          <DocRef id={r.bopId} code={doc(r.bopId, s.maps.bop)} path={paths.bop} empty="no BOP" />
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Change reason',
      hideBelow: 'lg',
      cell: (r) => (
        <span className="text-xs line-clamp-2">
          {r.changeReason || <span className="text-muted">Initial revision</span>}
        </span>
      ),
    },
    {
      id: 'action',
      header: '',
      width: '7rem',
      cell: (r) =>
        manage && (r.state === 'draft' || r.state === 'review') ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              setReleasing(r)
            }}
          >
            <Rocket />
            Release
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Revisions"
        description="Every product revision, when it was effective and who released it."
        actions={
          <Input
            variant="pill"
            aria-label="Search revisions"
            leftIcon={<Search />}
            placeholder="Search product or reason"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 sm:w-72 sm:flex-none flex-1"
          />
        }
      />
      <div className="space-y-4">
        <Card className="p-5">
          <div className="gap-2 flex flex-wrap items-start justify-between">
            <div>
              <h2 className="font-semibold">Revision governance</h2>
              <p className="text-xs text-muted">
                Released data is never edited in place. A change travels this path and ends as a new revision.
              </p>
            </div>
          </div>
          <ol className="mt-4 gap-2 pb-1 no-scrollbar flex overflow-x-auto">
            {governance.map((g, idx) => (
              <li key={g.label} className="gap-2 flex shrink-0 items-center">
                {idx > 0 && <ArrowRight className="size-4 shrink-0 text-muted" />}
                <Link
                  to={g.to}
                  className="rounded-2xl px-3 py-2 flex min-w-[7.5rem] flex-col bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="font-semibold tracking-wider text-[11px] text-muted uppercase">
                    {g.label}
                  </span>
                  <span className="text-xl font-bold tabular-nums">{g.count}</span>
                  <span className="text-[11px] text-muted">{g.hint}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full flex-1">
            <Chip
              variant="filter"
              active={!state}
              count={s.productRevisions.length}
              onClick={() => setState(null)}
            >
              All
            </Chip>
            {REVISION_STATES.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={state === st}
                count={s.productRevisions.filter((r) => r.state === st).length}
                onClick={() => setState(state === st ? null : st)}
              >
                {REVISION_STATE_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <ProductPicker
            variant="inline"
            clearable
            value={productId}
            onChange={setProductId}
            placeholder="All products"
            aria-label="Filter by product"
            className="sm:w-64 w-full"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(paths.product(r.productId))}
          resetPageKey={`${query}|${state}|${productId}`}
          empty="No revisions match."
          {...table}
        />
      </div>
      <ConfirmDialog
        open={!!releasing}
        onOpenChange={(open) => !open && setReleasing(null)}
        title={releasing ? `Release ${s.productName(releasing.productId)} ${releasing.rev}?` : ''}
        description={
          releasing
            ? previousReleased
              ? `${previousReleased.rev} becomes obsolete from now and ${releasing.rev} is the current revision for new orders. Effective from ${releasing.effectiveFrom ? fmtDate(releasing.effectiveFrom) : 'today'}. Running orders keep their snapshot.`
              : `${releasing.rev} becomes the current revision for new orders. Running orders keep their snapshot.`
            : undefined
        }
        confirmLabel="Release revision"
        onConfirm={() => {
          if (!releasing) return
          s.dispatch({ type: 'productRevisions/release', id: releasing.id })
          toast(`${releasing.rev} released`, {
            tone: 'success',
            description: previousReleased ? `${previousReleased.rev} is now obsolete.` : undefined,
          })
          setReleasing(null)
        }}
      />
    </>
  )
}

function DocRef({
  id,
  code,
  path,
  empty,
}: {
  id: string | null
  code: string | null
  path: (id: string) => string
  empty: string
}) {
  if (!id || !code) return <span>{empty}</span>
  return (
    <Link to={path(id)} onClick={(e) => e.stopPropagation()} className="hover:text-accent hover:underline">
      {code}
    </Link>
  )
}
