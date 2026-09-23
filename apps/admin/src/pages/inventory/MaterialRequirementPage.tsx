import { fmtNumber, fmtPercent, materialReadiness } from '@mes/fixtures'
import type { MaterialRequirement, RequirementStatus } from '@mes/types'
import { REQUIREMENT_STATUS_LABEL, RUNNING_MO_STATUSES } from '@mes/types'
import {
  Button,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  SegmentBar,
  StatCard,
} from '@mes/ui'
import { CircleAlert, CircleCheck, CircleDashed, ListChecks, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RequirementBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { MoPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { RequirementDialog } from './dialogs'
import { coverageSegments, coveredRatio } from './lib'

const STATUS_CHIPS: RequirementStatus[] = ['shortage', 'partial', 'ready', 'consumed']
const runningFilter = (status: string) =>
  RUNNING_MO_STATUSES.includes(status as (typeof RUNNING_MO_STATUSES)[number])

export function MaterialRequirementPage() {
  const s = useScoped()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const moId = params.get('mo')
  const view = params.get('view')
  const [chip, setChip] = useHistoryState<RequirementStatus | null>('status', null)
  const status = chip ?? (view === 'shortage' ? 'shortage' : null)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const table = useTableHistory()
  const manage = can('inventory.manage')

  const running = useMemo(
    () => s.manufacturingOrders.filter((m) => RUNNING_MO_STATUSES.includes(m.status)),
    [s.manufacturingOrders],
  )

  const rows = useMemo(() => {
    const ids = new Set(running.map((m) => m.id))
    return s.materialRequirements
      .filter((r) => (moId ? r.moId === moId : ids.has(r.moId)) && (!status || r.status === status))
      .sort(
        (a, b) =>
          (s.maps.mo.get(a.moId)?.code ?? '').localeCompare(s.maps.mo.get(b.moId)?.code ?? '') ||
          a.operationSeq - b.operationSeq,
      )
  }, [s, running, moId, status])

  const stats = useMemo(() => {
    const readiness = running.map((m) => materialReadiness(m.id, s.materialRequirements))
    const ids = new Set(running.map((m) => m.id))
    return {
      ready: readiness.filter((r) => r === 'ready').length,
      partial: readiness.filter((r) => r === 'partial').length,
      shortage: readiness.filter((r) => r === 'shortage').length,
      openLines: s.materialRequirements.filter((r) => ids.has(r.moId) && r.status !== 'consumed').length,
    }
  }, [s.materialRequirements, running])

  const setStatus = (next: RequirementStatus | null) => {
    setChip(next)
    if (view)
      setParams(
        (p) => {
          p.delete('view')
          return p
        },
        { replace: true },
      )
  }
  const setMo = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('mo', id)
        else p.delete('mo')
        return p
      },
      { replace: true },
    )

  const columns: Column<MaterialRequirement>[] = [
    {
      id: 'mo',
      header: 'Order',
      sortValue: (r) => s.maps.mo.get(r.moId)?.code ?? '',
      cell: (r) => (
        <div className="min-w-0">
          <MoLink moId={r.moId} />
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <RequirementBadge status={r.status} />
          </div>
        </div>
      ),
    },
    {
      id: 'material',
      header: 'Material',
      sortValue: (r) => s.materialName(r.materialId),
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{s.materialName(r.materialId)}</p>
          <p className="font-mono text-[11px] text-muted">{s.maps.material.get(r.materialId)?.code}</p>
        </div>
      ),
    },
    {
      id: 'op',
      header: 'Op',
      hideBelow: 'md',
      align: 'center',
      sortValue: (r) => r.operationSeq,
      cell: (r) => <span className="tabular-nums">{r.operationSeq}</span>,
    },
    {
      id: 'required',
      header: 'Required',
      align: 'right',
      sortValue: (r) => r.requiredQty,
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtNumber(r.requiredQty, 2)} <span className="text-xs text-muted">{s.uomCode(r.uomId)}</span>
        </span>
      ),
    },
    {
      id: 'coverage',
      header: 'Reserved · staged · issued · consumed',
      hideBelow: 'lg',
      width: '16rem',
      cell: (r) => (
        <div>
          <SegmentBar size="sm" segments={coverageSegments(r)} />
          <p className="mt-1 text-[11px] whitespace-nowrap text-muted tabular-nums">
            {fmtNumber(r.reservedQty, 1)} · {fmtNumber(r.stagedQty, 1)} · {fmtNumber(r.issuedQty, 1)} ·{' '}
            {fmtNumber(r.consumedQty, 1)}
          </p>
        </div>
      ),
    },
    {
      id: 'covered',
      header: 'Covered',
      hideBelow: 'sm',
      width: '8rem',
      sortValue: (r) => coveredRatio(r),
      cell: (r) => (
        <div>
          <ProgressBar
            value={coveredRatio(r)}
            tone={r.status === 'shortage' ? 'accent' : 'ink'}
            aria-label={`${fmtPercent(coveredRatio(r))} covered`}
          />
          <p className="mt-1 text-[11px] text-muted tabular-nums">{fmtPercent(coveredRatio(r))}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (r) => r.status,
      cell: (r) => <RequirementBadge status={r.status} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Material requirement"
        description="What every released order needs, and how much of it is reserved, staged, issued or consumed."
        actions={
          manage && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Add requirement
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Orders ready"
            value={stats.ready}
            hint="Every line covered"
            icon={<CircleCheck />}
            tone="success"
            onClick={() => setStatus('ready')}
          />
          <StatCard
            label="Partially covered"
            value={stats.partial}
            hint="Some lines short"
            icon={<CircleDashed />}
            tone={stats.partial ? 'warning' : 'default'}
            onClick={() => setStatus('partial')}
          />
          <StatCard
            label="Shortage"
            value={stats.shortage}
            hint="Nothing covered yet"
            icon={<CircleAlert />}
            tone={stats.shortage ? 'danger' : 'default'}
            onClick={() => setStatus('shortage')}
          />
          <StatCard
            label="Open lines"
            value={stats.openLines}
            hint={`${running.length} running orders`}
            icon={<ListChecks />}
            tone="ink"
            onClick={() => setStatus(null)}
          />
        </div>

        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip variant="filter" active={!status} onClick={() => setStatus(null)}>
              All
            </Chip>
            {STATUS_CHIPS.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={status === st}
                count={rows.filter((r) => r.status === st).length || undefined}
                onClick={() => setStatus(status === st ? null : st)}
              >
                {REQUIREMENT_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <MoPicker
            variant="inline"
            clearable
            value={moId}
            onChange={setMo}
            filter={runningFilter}
            placeholder="Any running order"
            aria-label="Filter by order"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(paths.requirement(r.id))}
          resetPageKey={`${status}|${moId}`}
          empty={
            <EmptyState
              compact
              title="No requirement lines"
              description={
                moId
                  ? 'This order has no material requirement. Requirements come from the BOM on release.'
                  : 'Release an order to calculate its requirement from the BOM.'
              }
            />
          }
          {...table}
        />
      </div>
      <RequirementDialog open={creating} onOpenChange={setCreating} moId={moId} />
    </>
  )
}
