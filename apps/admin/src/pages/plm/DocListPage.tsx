import { fmtDateShort } from '@mes/fixtures'
import type { RevisionState } from '@mes/types'
import { REVISION_STATE_LABEL } from '@mes/types'
import { Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { FileCheck, FilePen, Lock, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RevisionBadge } from '../../components/badges'
import { ProductLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { DocDialog } from './DocDialog'
import { DOC_KIND_LABEL, type DocKind, REVISION_STATES, matches } from './lib'
import { LockBadge } from './tables'

export interface DocLike {
  id: string
  code: string
  productId: string
  rev: string
  state: RevisionState
  createdAt: string
}

export interface DocListPageProps<T extends DocLike> {
  title: string
  description: string
  kind: DocKind
  docs: T[]
  countOf: (doc: T) => number
  countLabel: string
  /** Extra column between count and created, for the BOP operation trail. */
  extra?: Column<T>
}

/** Shared list of BOMs, BORs and BOPs: chip filters, search and a table that opens the document page. */
export function DocListPage<T extends DocLike>({
  title,
  description,
  kind,
  docs,
  countOf,
  countLabel,
  extra,
}: DocListPageProps<T>) {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useHistoryState('query', '')
  const [state, setState] = useHistoryState<RevisionState | null>('state', null)
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()
  const label = DOC_KIND_LABEL[kind]
  const path = paths[kind]

  const rows = useMemo(
    () =>
      docs
        .filter(
          (d) =>
            (!state || d.state === state) &&
            matches(query, d.code, d.rev, s.productName(d.productId), s.productCode(d.productId)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [docs, state, query, s],
  )

  const columns: Column<T>[] = [
    {
      id: 'code',
      header: label,
      sortValue: (d) => d.code,
      cell: (d) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{d.code}</p>
          <p className="text-sm truncate">{s.productName(d.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <span className="font-mono text-[11px] text-muted">{d.rev}</span>
            {d.state === 'released' ? <LockBadge /> : <RevisionBadge state={d.state} />}
          </div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'lg',
      sortValue: (d) => s.productCode(d.productId),
      cell: (d) => <ProductLink productId={d.productId} />,
    },
    {
      id: 'rev',
      header: 'Rev',
      hideBelow: 'sm',
      sortValue: (d) => d.rev,
      cell: (d) => <span className="text-xs font-mono">{d.rev}</span>,
    },
    {
      id: 'state',
      header: 'State',
      hideBelow: 'sm',
      sortValue: (d) => d.state,
      cell: (d) => (d.state === 'released' ? <LockBadge /> : <RevisionBadge state={d.state} />),
    },
    {
      id: 'count',
      header: countLabel,
      align: 'right',
      sortValue: countOf,
      cell: (d) => <span className="tabular-nums">{countOf(d)}</span>,
    },
    ...(extra ? [extra] : []),
    {
      id: 'created',
      header: 'Created',
      hideBelow: 'md',
      sortValue: (d) => d.createdAt,
      cell: (d) => fmtDateShort(d.createdAt),
    },
  ]

  const counts = (st: RevisionState) => docs.filter((d) => d.state === st).length

  // The list used to open a side panel from `?id=`; those links now land on the document page.
  const deepLink = params.get('id')
  if (deepLink) return <Navigate to={path(deepLink)} replace />

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Input
              variant="pill"
              aria-label={`Search ${title.toLowerCase()}`}
              leftIcon={<Search />}
              placeholder="Search code or product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('plm.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New {label}
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 grid grid-cols-3">
          <StatCard
            label="Released"
            value={counts('released')}
            hint="Locked, in use by production"
            icon={<Lock />}
            tone="success"
            onClick={() => setState('released')}
          />
          <StatCard
            label="Draft"
            value={counts('draft')}
            hint="Editable"
            icon={<FilePen />}
            tone={counts('draft') ? 'warning' : 'default'}
            onClick={() => setState('draft')}
          />
          <StatCard
            label="In review"
            value={counts('review')}
            hint="Waiting for approval"
            icon={<FileCheck />}
            tone="info"
            onClick={() => setState('review')}
          />
        </div>
        <ChipRow className="max-w-full">
          <Chip variant="filter" active={!state} count={docs.length} onClick={() => setState(null)}>
            All
          </Chip>
          {REVISION_STATES.map((st) => (
            <Chip
              key={st}
              variant="filter"
              active={state === st}
              count={counts(st)}
              onClick={() => setState(state === st ? null : st)}
            >
              {REVISION_STATE_LABEL[st]}
            </Chip>
          ))}
        </ChipRow>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(d) => d.id}
          onRowClick={(d) => navigate(path(d.id))}
          resetPageKey={`${query}|${state}`}
          empty={`No ${label} matches.`}
          {...table}
        />
      </div>
      <DocDialog kind={kind} open={creating} onOpenChange={setCreating} />
    </>
  )
}
