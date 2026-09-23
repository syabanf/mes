import { fmtDateShort, fmtNumber, fmtTime, isSameDay, toMs } from '@mes/fixtures'
import type { WoStatus, WorkOrder } from '@mes/types'
import { WO_STATUS_LABEL } from '@mes/types'
import {
  AvatarStack,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  Input,
  PageHeader,
  ProgressBar,
  cn,
} from '@mes/ui'
import { Search } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { WoStatusBadge, PriorityBadge } from '../../components/badges'
import { MachineLink, MoLink, paths } from '../../components/links'
import { MachinePicker, OrgNodePicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { isWoLate, sortForDispatch } from './wo-lib'

const STATUS_CHIPS: WoStatus[] = [
  'waiting',
  'ready',
  'assigned',
  'in_progress',
  'paused',
  'hold',
  'completed',
  'cancelled',
]
type View = 'active' | 'all' | 'running' | 'blocked' | 'delayed' | 'ready' | 'operator-issue'

export function WorkOrdersPage() {
  const s = useScoped()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View | null) ?? 'active'
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<WoStatus | null>('status', null)
  const [workCenterId, setWorkCenterId] = useHistoryState<string | null>('wc', null)
  const [machineId, setMachineId] = useHistoryState<string | null>('machine', null)
  const table = useTableHistory()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortForDispatch(
      s.workOrders.filter((w) => {
        if (status && w.status !== status) return false
        if (workCenterId && w.workCenterId !== workCenterId) return false
        if (machineId && w.machineId !== machineId) return false
        if (view === 'active' && !['ready', 'assigned', 'in_progress', 'paused', 'hold'].includes(w.status))
          return false
        if (view === 'running' && w.status !== 'in_progress' && w.status !== 'paused') return false
        if (view === 'blocked' && w.status !== 'paused' && w.status !== 'hold') return false
        if (view === 'delayed' && !isWoLate(w, now)) return false
        if (view === 'ready' && w.status !== 'ready') return false
        if (
          view === 'operator-issue' &&
          (!['ready', 'assigned', 'in_progress', 'paused', 'hold'].includes(w.status) ||
            !w.operatorIds.some((id) => s.maps.person.get(id)?.availability === 'leave'))
        )
          return false
        if (!q) return true
        const mo = s.maps.mo.get(w.moId)
        return `${w.code} ${w.operationName} ${mo?.code ?? ''} ${mo ? s.productName(mo.productId) : ''}`
          .toLowerCase()
          .includes(q)
      }),
    )
  }, [s, query, status, workCenterId, machineId, view, now])

  const stats = useMemo(
    () => ({
      ready: s.workOrders.filter((w) => w.status === 'ready').length,
      assigned: s.workOrders.filter((w) => w.status === 'assigned').length,
      running: s.workOrders.filter((w) => w.status === 'in_progress').length,
      paused: s.workOrders.filter((w) => w.status === 'paused' || w.status === 'hold').length,
      completedToday: s.workOrders.filter(
        (w) => w.status === 'completed' && w.actualEnd && isSameDay(toMs(w.actualEnd), now),
      ).length,
    }),
    [s.workOrders, now],
  )

  const setView = (next: View) =>
    setParams(
      (p) => {
        if (next === 'active') p.delete('view')
        else p.set('view', next)
        return p
      },
      { replace: true },
    )

  const columns: Column<WorkOrder>[] = [
    {
      id: 'code',
      header: 'Work order',
      sortValue: (w) => w.code,
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{w.code}</p>
          <p className="text-sm truncate">
            {w.operationSeq} · {w.operationName}
          </p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <WoStatusBadge status={w.status} />
            <PriorityBadge priority={w.priority} />
          </div>
          <p className="mt-1.5 leading-4 md:hidden text-[11px] text-muted">
            {s.maps.machine.get(w.machineId ?? '')?.code ?? 'Machine unassigned'} ·{' '}
            {w.operatorIds.length
              ? w.operatorIds.map((id) => s.personName(id)).join(', ')
              : 'Operator unassigned'}
            {' · '}Due {fmtDateShort(w.plannedEnd)}
          </p>
        </div>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'md',
      sortValue: (w) => s.maps.mo.get(w.moId)?.code ?? '',
      cell: (w) => <MoLink moId={w.moId} />,
    },
    {
      id: 'wc',
      header: 'Work center',
      hideBelow: 'lg',
      sortValue: (w) => s.orgName(w.workCenterId),
      cell: (w) => <span className="text-sm">{s.orgName(w.workCenterId)}</span>,
    },
    {
      id: 'machine',
      header: 'Machine',
      hideBelow: 'md',
      sortValue: (w) => s.maps.machine.get(w.machineId ?? '')?.code ?? '',
      cell: (w) => <MachineLink machineId={w.machineId} />,
    },
    {
      id: 'operators',
      header: 'Operators',
      hideBelow: 'lg',
      cell: (w) =>
        w.operatorIds.length ? (
          <AvatarStack
            people={w.operatorIds.map((id) => ({
              name: s.personName(id),
              color: s.maps.person.get(id)?.color,
            }))}
            size="xs"
          />
        ) : (
          <span className="text-xs text-muted">Unassigned</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (w) => w.status,
      cell: (w) => <WoStatusBadge status={w.status} />,
    },
    {
      id: 'output',
      header: 'Output',
      hideBelow: 'sm',
      width: '9rem',
      sortValue: (w) => w.goodQty / Math.max(1, w.targetQty),
      cell: (w) => (
        <div>
          <ProgressBar
            value={w.goodQty / Math.max(1, w.targetQty)}
            tone={w.status === 'hold' ? 'accent' : 'ink'}
            aria-label={`${w.goodQty} of ${w.targetQty} good`}
          />
          <p className="mt-1 text-[11px] text-muted tabular-nums">
            {fmtNumber(w.goodQty)} / {fmtNumber(w.targetQty)} good
          </p>
        </div>
      ),
    },
    {
      id: 'planned',
      header: 'Planned',
      hideBelow: 'xl',
      sortValue: (w) => w.plannedStart,
      cell: (w) => {
        const late = isWoLate(w, now)
        return (
          <span className={cn('text-xs tabular-nums', late && 'font-semibold text-accent')}>
            {fmtDateShort(w.plannedStart)} {fmtTime(w.plannedStart)} → {fmtDateShort(w.plannedEnd)}{' '}
            {fmtTime(w.plannedEnd)}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Work orders"
        description="One operation of a manufacturing order at one work center. Dispatch, follow and close them here."
        actions={
          <Input
            variant="pill"
            aria-label="Search work orders"
            leftIcon={<Search />}
            placeholder="Search code, operation or order"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 sm:w-72 sm:flex-none flex-1"
          />
        }
      />
      <div className="space-y-4">
        <div className="gap-2 grid grid-cols-5" aria-label="Work order summary">
          {(
            [
              ['Ready', stats.ready, 'ready'],
              ['Assigned', stats.assigned, 'assigned'],
              ['Running', stats.running, 'running'],
              ['Blocked', stats.paused, 'blocked'],
              ['Done', stats.completedToday, 'completed'],
            ] as const
          ).map(([label, count, target]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setStatus(target === 'assigned' || target === 'completed' ? target : null)
                setView(target === 'ready' || target === 'running' || target === 'blocked' ? target : 'all')
              }}
              className="min-w-0 rounded-xl px-2 py-2 border border-border bg-surface text-left hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="text-base font-bold sm:text-xl leading-none tabular-nums">{count}</span>
              <span className="mt-1 sm:text-xs block truncate text-[10px] text-muted">{label}</span>
            </button>
          ))}
        </div>
        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip
              variant="filter"
              active={!status && view === 'active'}
              count={
                s.workOrders.filter((w) =>
                  ['ready', 'assigned', 'in_progress', 'paused', 'hold'].includes(w.status),
                ).length
              }
              onClick={() => {
                setStatus(null)
                setView('active')
              }}
            >
              Active
            </Chip>
            <Chip
              variant="filter"
              active={!status && view === 'all'}
              count={s.workOrders.length}
              onClick={() => {
                setStatus(null)
                setView('all')
              }}
            >
              All
            </Chip>
            {STATUS_CHIPS.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={status === st}
                count={s.workOrders.filter((w) => w.status === st).length}
                onClick={() => {
                  setStatus(status === st ? null : st)
                  setView('all')
                }}
              >
                {WO_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <div className="gap-1 flex flex-wrap items-center">
            <OrgNodePicker
              kind="work_center"
              variant="inline"
              value={workCenterId}
              onChange={setWorkCenterId}
              clearable
              placeholder="Any work center"
              aria-label="Filter by work center"
            />
            <MachinePicker
              variant="inline"
              workCenterId={workCenterId}
              value={machineId}
              onChange={setMachineId}
              clearable
              placeholder="Any machine"
              aria-label="Filter by machine"
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(w) => w.id}
          onRowClick={(w) => navigate(paths.wo(w.id))}
          resetPageKey={`${query}|${status}|${view}|${workCenterId}|${machineId}`}
          empty="No work orders match. Release a manufacturing order to generate them."
          {...table}
        />
      </div>
    </>
  )
}
