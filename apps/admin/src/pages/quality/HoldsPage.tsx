import { fmtAgo, fmtNumber, isSameDay, toMs } from '@mes/fixtures'
import type { HoldStatus, QualityHold } from '@mes/types'
import { HOLD_TARGET_LABEL } from '@mes/types'
import { Button, Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { Clock, LockOpen, PauseOctagon, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { DispositionBadge } from '../../components/badges'
import { MoLink, PersonChip, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { HoldDialog } from './dialogs'
import { HoldStatusBadge } from './HoldStatusBadge'
import { holdHours, holdTargetCode, holdTargetPath, matches } from './lib'

export function HoldsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params] = useSearchParams()
  const openId = params.get('id')
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<HoldStatus | null>('status', 'active')
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()

  const stats = useMemo(() => {
    const active = s.qualityHolds.filter((h) => h.status === 'active')
    const hours = s.qualityHolds.map((h) => holdHours(h, now))
    return {
      active: active.length,
      releasedToday: s.qualityHolds.filter((h) => h.releasedAt && isSameDay(toMs(h.releasedAt), now)).length,
      avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0,
    }
  }, [s.qualityHolds, now])

  const rows = useMemo(
    () =>
      [...s.qualityHolds]
        .filter(
          (h) =>
            (!status || h.status === status) &&
            matches(
              query,
              h.code,
              holdTargetCode(s.state, h),
              h.moId ? s.maps.mo.get(h.moId)?.code : undefined,
              s.reasonLabel(h.reasonCodeId),
            ),
        )
        .sort((a, b) => b.heldAt.localeCompare(a.heldAt)),
    [s, status, query],
  )

  // The list used to open a side panel from `?id=`; that deep link now lands on the hold page.
  if (openId) return <Navigate to={paths.hold(openId)} replace />

  const columns: Column<QualityHold>[] = [
    {
      id: 'code',
      header: 'Hold',
      sortValue: (h) => h.code,
      cell: (h) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{h.code}</p>
          <p className="text-sm truncate">
            {HOLD_TARGET_LABEL[h.target]} · {holdTargetCode(s.state, h)}
          </p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <HoldStatusBadge status={h.status} />
            <DispositionBadge disposition={h.disposition} />
          </div>
        </div>
      ),
    },
    {
      id: 'target',
      header: 'Target',
      hideBelow: 'md',
      sortValue: (h) => h.target,
      cell: (h) => (
        <span className="text-sm">
          {HOLD_TARGET_LABEL[h.target]} ·{' '}
          <Link
            to={holdTargetPath(h)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold font-mono hover:text-accent"
          >
            {holdTargetCode(s.state, h)}
          </Link>
        </span>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'lg',
      cell: (h) =>
        h.moId ? <MoLink moId={h.moId} showProduct={false} /> : <span className="text-muted">No order</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      hideBelow: 'md',
      sortValue: (h) => s.reasonLabel(h.reasonCodeId),
      cell: (h) => <span className="text-sm">{s.reasonLabel(h.reasonCodeId)}</span>,
    },
    {
      id: 'held',
      header: 'Held',
      hideBelow: 'lg',
      sortValue: (h) => h.heldAt,
      cell: (h) => <PersonChip personId={h.heldBy} hint={fmtAgo(h.heldAt, now)} />,
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (h) => h.status,
      cell: (h) => <HoldStatusBadge status={h.status} />,
    },
    {
      id: 'released',
      header: 'Released',
      hideBelow: 'xl',
      sortValue: (h) => h.releasedAt ?? '',
      cell: (h) =>
        h.releasedBy ? (
          <PersonChip personId={h.releasedBy} hint={h.releasedAt ? fmtAgo(h.releasedAt, now) : undefined} />
        ) : (
          <span className="text-sm text-muted">{fmtNumber(holdHours(h, now), 1)} h so far</span>
        ),
    },
    {
      id: 'disposition',
      header: 'Disposition',
      hideBelow: 'sm',
      sortValue: (h) => h.disposition ?? '',
      cell: (h) => <DispositionBadge disposition={h.disposition} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Quality holds"
        description="Batches, lots, orders and operations stopped for a quality decision. Nothing on hold moves until it is released with a disposition."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search holds"
              leftIcon={<Search />}
              placeholder="Search hold, target or order"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {can('quality.execute') && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Create hold
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-3 grid grid-cols-2">
          <StatCard
            label="Active holds"
            value={stats.active}
            hint="Waiting for a disposition"
            icon={<PauseOctagon />}
            tone={stats.active ? 'danger' : 'success'}
            onClick={() => setStatus('active')}
          />
          <StatCard
            label="Released today"
            value={stats.releasedToday}
            icon={<LockOpen />}
            tone="success"
            onClick={() => setStatus('released')}
          />
          <StatCard
            label="Average hold time"
            value={fmtNumber(stats.avgHours, 1)}
            unit="h"
            hint="Across every hold, active ones counted to now"
            icon={<Clock />}
            tone="ink"
            className="xl:col-span-1 col-span-2"
          />
        </div>
        <ChipRow>
          <Chip
            variant="filter"
            active={!status}
            count={s.qualityHolds.length}
            onClick={() => setStatus(null)}
          >
            All
          </Chip>
          <Chip
            variant="filter"
            active={status === 'active'}
            count={s.qualityHolds.filter((h) => h.status === 'active').length}
            onClick={() => setStatus(status === 'active' ? null : 'active')}
          >
            Active
          </Chip>
          <Chip
            variant="filter"
            active={status === 'released'}
            count={s.qualityHolds.filter((h) => h.status === 'released').length}
            onClick={() => setStatus(status === 'released' ? null : 'released')}
          >
            Released
          </Chip>
        </ChipRow>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(h) => h.id}
          onRowClick={(h) => navigate(paths.hold(h.id))}
          resetPageKey={`${query}|${status}`}
          empty="No holds match. Failed inspections and manual holds appear here."
          {...table}
        />
      </div>
      <HoldDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
