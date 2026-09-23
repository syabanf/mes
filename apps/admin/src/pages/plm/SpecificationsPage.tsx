import { fmtDateShort } from '@mes/fixtures'
import type { RevisionState, SpecKind, Specification } from '@mes/types'
import { REVISION_STATE_LABEL, SPEC_KIND_LABEL } from '@mes/types'
import { Badge, Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { FlaskConical, Plus, Ruler, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RevisionBadge } from '../../components/badges'
import { ProductLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { REVISION_STATES, matches } from './lib'
import { SpecificationDialog } from './SpecificationDialog'
import { LockBadge } from './tables'

const SPEC_KINDS: SpecKind[] = ['product', 'process', 'quality']
const KIND_VARIANT: Record<SpecKind, 'ink' | 'info' | 'warning'> = {
  product: 'ink',
  process: 'info',
  quality: 'warning',
}

export function SpecKindBadge({ kind }: { kind: SpecKind }) {
  return <Badge variant={KIND_VARIANT[kind]}>{SPEC_KIND_LABEL[kind]}</Badge>
}

export function SpecificationsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useHistoryState('query', '')
  const [state, setState] = useHistoryState<RevisionState | null>('state', null)
  const [kind, setKind] = useHistoryState<SpecKind | null>('kind', null)
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()

  const rows = useMemo(
    () =>
      s.specifications
        .filter(
          (x) =>
            (!state || x.state === state) &&
            (!kind || x.kind === kind) &&
            matches(query, x.code, s.productName(x.productId), s.productCode(x.productId)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s, query, state, kind],
  )

  const countKind = (k: SpecKind) => s.specifications.filter((x) => x.kind === k).length

  const columns: Column<Specification>[] = [
    {
      id: 'code',
      header: 'Specification',
      sortValue: (x) => x.code,
      cell: (x) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{x.code}</p>
          <p className="text-sm truncate">{s.productName(x.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <SpecKindBadge kind={x.kind} />
            {x.state === 'released' ? <LockBadge /> : <RevisionBadge state={x.state} />}
          </div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'lg',
      sortValue: (x) => s.productCode(x.productId),
      cell: (x) => <ProductLink productId={x.productId} />,
    },
    {
      id: 'kind',
      header: 'Kind',
      hideBelow: 'sm',
      sortValue: (x) => x.kind,
      cell: (x) => <SpecKindBadge kind={x.kind} />,
    },
    {
      id: 'rev',
      header: 'Rev',
      hideBelow: 'md',
      sortValue: (x) => x.rev,
      cell: (x) => <span className="text-xs font-mono">{x.rev}</span>,
    },
    {
      id: 'state',
      header: 'State',
      hideBelow: 'sm',
      sortValue: (x) => x.state,
      cell: (x) => (x.state === 'released' ? <LockBadge /> : <RevisionBadge state={x.state} />),
    },
    {
      id: 'count',
      header: 'Characteristics',
      align: 'right',
      sortValue: (x) => x.characteristics.length,
      cell: (x) => <span className="tabular-nums">{x.characteristics.length}</span>,
    },
    {
      id: 'created',
      header: 'Created',
      hideBelow: 'md',
      sortValue: (x) => x.createdAt,
      cell: (x) => fmtDateShort(x.createdAt),
    },
  ]

  // The list used to open a side panel from `?id=`; those links now land on the specification page.
  const deepLink = params.get('id')
  if (deepLink) return <Navigate to={paths.specification(deepLink)} replace />

  return (
    <>
      <PageHeader
        title="Specifications"
        description="Product, process and quality characteristics with targets and limits, measured at an operation."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search specifications"
              leftIcon={<Search />}
              placeholder="Search code or product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('plm.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New specification
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 grid grid-cols-3">
          <StatCard
            label={SPEC_KIND_LABEL.product}
            value={countKind('product')}
            icon={<Ruler />}
            tone="ink"
            onClick={() => setKind(kind === 'product' ? null : 'product')}
          />
          <StatCard
            label={SPEC_KIND_LABEL.process}
            value={countKind('process')}
            icon={<FlaskConical />}
            tone="info"
            onClick={() => setKind(kind === 'process' ? null : 'process')}
          />
          <StatCard
            label={SPEC_KIND_LABEL.quality}
            value={countKind('quality')}
            icon={<ShieldCheck />}
            tone="warning"
            onClick={() => setKind(kind === 'quality' ? null : 'quality')}
          />
        </div>
        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip
              variant="filter"
              active={!state && !kind}
              count={s.specifications.length}
              onClick={() => {
                setState(null)
                setKind(null)
              }}
            >
              All
            </Chip>
            {REVISION_STATES.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={state === st}
                count={s.specifications.filter((x) => x.state === st).length}
                onClick={() => setState(state === st ? null : st)}
              >
                {REVISION_STATE_LABEL[st]}
              </Chip>
            ))}
            {SPEC_KINDS.map((k) => (
              <Chip
                key={k}
                variant="filter"
                active={kind === k}
                count={countKind(k)}
                onClick={() => setKind(kind === k ? null : k)}
              >
                {SPEC_KIND_LABEL[k]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(x) => x.id}
          onRowClick={(x) => navigate(paths.specification(x.id))}
          resetPageKey={`${query}|${state}|${kind}`}
          empty="No specifications match."
          {...table}
        />
      </div>
      <SpecificationDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
