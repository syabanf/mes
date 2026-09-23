import { fmtDateShort } from '@mes/fixtures'
import type { RevisionState, WorkInstruction } from '@mes/types'
import { REVISION_STATE_LABEL } from '@mes/types'
import { Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { FileText, ListChecks, Plus, Search, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RevisionBadge } from '../../components/badges'
import { ProductLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { REVISION_STATES, matches } from './lib'
import { LockBadge, StepKindTrail } from './tables'
import { WorkInstructionDialog } from './WorkInstructionDialog'

export function WorkInstructionsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useHistoryState('query', '')
  const [state, setState] = useHistoryState<RevisionState | null>('state', null)
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()

  const rows = useMemo(
    () =>
      s.workInstructions
        .filter(
          (w) =>
            (!state || w.state === state) &&
            matches(query, w.code, w.title, s.productName(w.productId), s.productCode(w.productId)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s, query, state],
  )

  const stats = useMemo(
    () => ({
      released: s.workInstructions.filter((w) => w.state === 'released').length,
      safety: s.workInstructions.filter((w) => w.steps.some((st) => st.kind === 'safety')).length,
      checklists: s.workInstructions.reduce(
        (n, w) => n + w.steps.filter((st) => st.kind === 'checklist').length,
        0,
      ),
    }),
    [s.workInstructions],
  )

  const columns: Column<WorkInstruction>[] = [
    {
      id: 'code',
      header: 'Instruction',
      sortValue: (w) => w.code,
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{w.code}</p>
          <p className="text-sm truncate">{w.title}</p>
          <p className="text-xs truncate text-muted">{s.productName(w.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <span className="text-[11px] text-muted">Op {w.operationSeq}</span>
            {w.state === 'released' ? <LockBadge /> : <RevisionBadge state={w.state} />}
          </div>
        </div>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      hideBelow: 'lg',
      sortValue: (w) => s.productCode(w.productId),
      cell: (w) => <ProductLink productId={w.productId} />,
    },
    {
      id: 'op',
      header: 'Operation',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (w) => w.operationSeq,
      cell: (w) => <span className="tabular-nums">Op {w.operationSeq}</span>,
    },
    {
      id: 'rev',
      header: 'Rev',
      hideBelow: 'md',
      sortValue: (w) => w.rev,
      cell: (w) => <span className="text-xs font-mono">{w.rev}</span>,
    },
    {
      id: 'state',
      header: 'State',
      hideBelow: 'sm',
      sortValue: (w) => w.state,
      cell: (w) => (w.state === 'released' ? <LockBadge /> : <RevisionBadge state={w.state} />),
    },
    {
      id: 'steps',
      header: 'Steps',
      sortValue: (w) => w.steps.length,
      cell: (w) => (
        <span className="gap-2 inline-flex items-center">
          <span className="tabular-nums">{w.steps.length}</span>
          <span className="md:inline-flex hidden">
            <StepKindTrail steps={w.steps} />
          </span>
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Created',
      hideBelow: 'xl',
      sortValue: (w) => w.createdAt,
      cell: (w) => fmtDateShort(w.createdAt),
    },
  ]

  // The list used to open a side panel from `?id=`; those links now land on the instruction page.
  const deepLink = params.get('id')
  if (deepLink) return <Navigate to={paths.workInstruction(deepLink)} replace />

  return (
    <>
      <PageHeader
        title="Work instructions"
        description="Step by step guidance the operator sees at the station for each operation."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search work instructions"
              leftIcon={<Search />}
              placeholder="Search code, title or product"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('plm.manage') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New instruction
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 grid grid-cols-3">
          <StatCard
            label="Released"
            value={stats.released}
            hint="Visible on the shop floor"
            icon={<FileText />}
            tone="success"
            onClick={() => setState('released')}
          />
          <StatCard
            label="With safety steps"
            value={stats.safety}
            hint="Show a warning first"
            icon={<ShieldAlert />}
            tone="danger"
          />
          <StatCard
            label="Checklists"
            value={stats.checklists}
            hint="Operator tick lists"
            icon={<ListChecks />}
            tone="info"
          />
        </div>
        <ChipRow className="max-w-full">
          <Chip
            variant="filter"
            active={!state}
            count={s.workInstructions.length}
            onClick={() => setState(null)}
          >
            All
          </Chip>
          {REVISION_STATES.map((st) => (
            <Chip
              key={st}
              variant="filter"
              active={state === st}
              count={s.workInstructions.filter((w) => w.state === st).length}
              onClick={() => setState(state === st ? null : st)}
            >
              {REVISION_STATE_LABEL[st]}
            </Chip>
          ))}
        </ChipRow>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(w) => w.id}
          onRowClick={(w) => navigate(paths.workInstruction(w.id))}
          resetPageKey={`${query}|${state}`}
          empty="No work instructions match."
          {...table}
        />
      </div>
      <WorkInstructionDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
