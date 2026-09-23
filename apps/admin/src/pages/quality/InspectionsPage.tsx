import { fmtAgo, fmtPercent } from '@mes/fixtures'
import type { Inspection, InspectionStatus, InspectionTrigger } from '@mes/types'
import { INSPECTION_STATUS_LABEL, INSPECTION_TRIGGER_LABEL } from '@mes/types'
import { Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { CircleCheck, CircleX, ClipboardCheck, Hourglass, Plus, Search, Target } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { DispositionBadge, InspectionStatusBadge } from '../../components/badges'
import { MoLink, PersonChip, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { RequestInspectionDialog } from './dialogs'
import {
  INSPECTION_STATUSES,
  INSPECTION_TRIGGERS,
  failedToday,
  firstPassYield,
  matches,
  passedToday,
} from './lib'

export function InspectionsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const creating = params.get('new') === '1'
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<InspectionStatus | null>('status', null)
  const [trigger, setTrigger] = useHistoryState<InspectionTrigger | null>('trigger', null)
  const table = useTableHistory()

  const setCreating = (open: boolean) =>
    setParams(
      (p) => {
        if (open) p.set('new', '1')
        else p.delete('new')
        return p
      },
      { replace: true },
    )

  const stats = useMemo(() => {
    const fpy = firstPassYield(s.inspections, now)
    return {
      pending: s.inspections.filter((i) => i.status === 'pending').length,
      inProgress: s.inspections.filter((i) => i.status === 'in_progress').length,
      passedToday: passedToday(s.inspections, now),
      failedToday: failedToday(s.inspections, now),
      fpy,
    }
  }, [s.inspections, now])

  const rows = useMemo(
    () =>
      [...s.inspections]
        .filter(
          (i) =>
            (!status || i.status === status) &&
            (!trigger || i.trigger === trigger) &&
            matches(
              query,
              i.code,
              s.maps.mo.get(i.moId)?.code,
              s.productName(i.productId),
              s.maps.wip.get(i.wipId ?? '')?.code,
            ),
        )
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [s, status, trigger, query],
  )

  const columns: Column<Inspection>[] = [
    {
      id: 'code',
      header: 'Inspection',
      sortValue: (i) => i.code,
      cell: (i) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{i.code}</p>
          <p className="text-sm truncate">{s.productName(i.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <InspectionStatusBadge status={i.status} />
            <DispositionBadge disposition={i.disposition} />
          </div>
        </div>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'md',
      sortValue: (i) => s.maps.mo.get(i.moId)?.code ?? '',
      cell: (i) => <MoLink moId={i.moId} showProduct={false} />,
    },
    {
      id: 'op',
      header: 'Operation',
      hideBelow: 'lg',
      sortValue: (i) => i.operationSeq,
      cell: (i) => (
        <span className="text-sm">
          {i.operationSeq} · {s.maps.wo.get(i.woId ?? '')?.operationName ?? 'n/a'}
        </span>
      ),
    },
    {
      id: 'trigger',
      header: 'Trigger',
      hideBelow: 'xl',
      sortValue: (i) => i.trigger,
      cell: (i) => <span className="text-sm">{INSPECTION_TRIGGER_LABEL[i.trigger]}</span>,
    },
    {
      id: 'wip',
      header: 'WIP / lot',
      hideBelow: 'xl',
      cell: (i) => (
        <span className="text-xs font-mono">
          {s.maps.wip.get(i.wipId ?? '')?.code ?? s.maps.lot.get(i.lotId ?? '')?.code ?? '—'}
        </span>
      ),
    },
    {
      id: 'inspector',
      header: 'Inspector',
      hideBelow: 'lg',
      sortValue: (i) => s.personName(i.inspectorId),
      cell: (i) => <PersonChip personId={i.inspectorId} />,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (i) => i.status,
      cell: (i) => <InspectionStatusBadge status={i.status} />,
    },
    {
      id: 'disposition',
      header: 'Disposition',
      hideBelow: 'sm',
      sortValue: (i) => i.disposition ?? '',
      cell: (i) => <DispositionBadge disposition={i.disposition} />,
    },
    {
      id: 'requested',
      header: 'Requested',
      hideBelow: 'md',
      sortValue: (i) => i.requestedAt,
      cell: (i) => <span className="text-sm text-muted">{fmtAgo(i.requestedAt, now)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Inspections"
        description="Quality checks raised by the process at start, per batch, per quantity, on time or after a changeover. Record the results here."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search inspections"
              leftIcon={<Search />}
              placeholder="Search code, order or batch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('quality.execute') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Request inspection
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5 grid grid-cols-2">
          <StatCard
            label="Pending"
            value={stats.pending}
            hint="Waiting for an inspector"
            icon={<Hourglass />}
            tone={stats.pending ? 'warning' : 'default'}
            onClick={() => setStatus(status === 'pending' ? null : 'pending')}
          />
          <StatCard
            label="In progress"
            value={stats.inProgress}
            hint="Being measured now"
            icon={<ClipboardCheck />}
            tone="info"
            onClick={() => setStatus(status === 'in_progress' ? null : 'in_progress')}
          />
          <StatCard label="Passed today" value={stats.passedToday} icon={<CircleCheck />} tone="success" />
          <StatCard
            label="Failed today"
            value={stats.failedToday}
            icon={<CircleX />}
            tone={stats.failedToday ? 'danger' : 'default'}
          />
          <StatCard
            label="First-pass yield"
            value={stats.fpy === null ? '—' : fmtPercent(stats.fpy)}
            hint="Passed of completed, last 7 days"
            icon={<Target />}
            tone="ink"
            className="md:col-span-1 col-span-2"
          />
        </div>
        <ChipRow>
          <Chip
            variant="filter"
            active={!status}
            count={s.inspections.length}
            onClick={() => setStatus(null)}
          >
            All
          </Chip>
          {INSPECTION_STATUSES.map((st) => (
            <Chip
              key={st}
              variant="filter"
              active={status === st}
              count={s.inspections.filter((i) => i.status === st).length}
              onClick={() => setStatus(status === st ? null : st)}
            >
              {INSPECTION_STATUS_LABEL[st]}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow>
          {INSPECTION_TRIGGERS.map((t) => (
            <Chip
              key={t}
              active={trigger === t}
              count={s.inspections.filter((i) => i.trigger === t).length}
              onClick={() => setTrigger(trigger === t ? null : t)}
            >
              {INSPECTION_TRIGGER_LABEL[t]}
            </Chip>
          ))}
        </ChipRow>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(i) => i.id}
          onRowClick={(i) => navigate(paths.inspection(i.id))}
          resetPageKey={`${query}|${status}|${trigger}`}
          empty="No inspections match. Requests appear here when an operation with a quality check starts."
          {...table}
        />
      </div>
      <RequestInspectionDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
