import { fmtAgo, fmtNumber, sumBy, wipAgeHours } from '@mes/fixtures'
import type { Wip, WipState } from '@mes/types'
import { ACTIVE_WIP_STATES, WIP_STATE_LABEL } from '@mes/types'
import {
  Banner,
  BarList,
  Button,
  Card,
  CardContent,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  PillTabs,
  StatCard,
  cn,
} from '@mes/ui'
import { Boxes, Hourglass, Layers, Microscope, Plus, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { WipStateBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { MoPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { operationName, rankBy } from './lib'
import { WipDialog } from './wip-dialogs'

const STATE_CHIPS: WipState[] = [
  'waiting',
  'queued',
  'processing',
  'hold',
  'quality_hold',
  'rework',
  'completed',
  'scrapped',
]
type Group = 'operation' | 'location' | 'mo' | 'state'
const GROUPS: { value: Group; label: string }[] = [
  { value: 'operation', label: 'Operation' },
  { value: 'location', label: 'Location' },
  { value: 'mo', label: 'Order' },
  { value: 'state', label: 'State' },
]
export function WipPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const moId = params.get('mo')
  const paramId = params.get('id')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const [state, setState] = useHistoryState<WipState | 'active'>('state', 'active')
  const [group, setGroup] = useHistoryState<Group>('group', 'operation')
  const [groupValue, setGroupValue] = useHistoryState<string | null>('groupValue', null)
  const table = useTableHistory()
  const manage = can('shopfloor.execute') || can('inventory.manage')

  const aging = (w: Wip) => wipAgeHours(w, now) > s.settings.wipAgingHours
  const keyOf = (w: Wip): string =>
    group === 'operation'
      ? String(w.operationSeq)
      : group === 'location'
        ? w.locationId
        : group === 'mo'
          ? w.moId
          : w.state
  const labelOf = (key: string): string => {
    if (group === 'operation') {
      const sample = s.wips.find((w) => String(w.operationSeq) === key)
      return `Op ${key} · ${operationName(s, sample ? s.maps.mo.get(sample.moId) : undefined, Number(key))}`
    }
    if (group === 'location') return s.locationName(key)
    if (group === 'mo') return s.maps.mo.get(key)?.code ?? key
    return WIP_STATE_LABEL[key as WipState]
  }

  const base = useMemo(
    () =>
      s.wips.filter(
        (w) =>
          (!moId || w.moId === moId) &&
          (state === 'active' ? ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0 : w.state === state),
      ),
    [s.wips, moId, state],
  )
  const rows = useMemo(
    () =>
      base
        .filter((w) => !groupValue || keyOf(w) === groupValue)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [base, groupValue, group],
  )
  const groups = useMemo(() => rankBy(base, keyOf, (w) => w.qty), [base, group])

  const stats = useMemo(() => {
    const active = s.wips.filter(
      (w) => ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0 && (!moId || w.moId === moId),
    )
    return {
      qty: sumBy(active, (w) => w.qty),
      batches: active.length,
      qualityHold: active.filter((w) => w.state === 'quality_hold').length,
      rework: active.filter((w) => w.state === 'rework').length,
      aging: active.filter(aging).length,
      active,
    }
  }, [s.wips, s.settings.wipAgingHours, moId, now])

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )
  const exitMo = moId ? s.maps.mo.get(moId) : undefined

  const columns: Column<Wip>[] = [
    {
      id: 'code',
      header: 'Batch',
      sortValue: (w) => w.code,
      cell: (w) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{w.code}</p>
          <p className="text-sm truncate">{s.productName(w.productId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <WipStateBadge state={w.state} />
          </div>
        </div>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'md',
      sortValue: (w) => s.maps.mo.get(w.moId)?.code ?? '',
      cell: (w) => <MoLink moId={w.moId} showProduct={false} />,
    },
    {
      id: 'op',
      header: 'Operation',
      hideBelow: 'lg',
      sortValue: (w) => w.operationSeq,
      cell: (w) => (
        <span className="whitespace-nowrap">
          {w.operationSeq} · {operationName(s, s.maps.mo.get(w.moId), w.operationSeq)}
        </span>
      ),
    },
    {
      id: 'qty',
      header: 'Qty',
      align: 'right',
      sortValue: (w) => w.qty,
      cell: (w) => <span className="font-semibold tabular-nums">{fmtNumber(w.qty)}</span>,
    },
    {
      id: 'state',
      header: 'State',
      hideBelow: 'sm',
      sortValue: (w) => w.state,
      cell: (w) => <WipStateBadge state={w.state} />,
    },
    {
      id: 'location',
      header: 'Location',
      hideBelow: 'lg',
      sortValue: (w) => s.locationName(w.locationId),
      cell: (w) => s.locationName(w.locationId),
    },
    {
      id: 'batch',
      header: 'Lot batch',
      hideBelow: 'xl',
      cell: (w) => <span className="text-xs font-mono">{w.batch}</span>,
    },
    {
      id: 'age',
      header: 'Age',
      hideBelow: 'md',
      sortValue: (w) => w.updatedAt,
      cell: (w) => (
        <span className={cn('whitespace-nowrap', aging(w) ? 'font-semibold text-warning' : 'text-muted')}>
          {fmtAgo(w.updatedAt, now)}
        </span>
      ),
    },
    {
      id: 'lots',
      header: 'Lots',
      hideBelow: 'xl',
      align: 'right',
      sortValue: (w) => w.lotIds.length,
      cell: (w) => <span className="tabular-nums">{w.lotIds.length}</span>,
    },
  ]

  if (paramId) return <Navigate to={paths.wip(paramId)} replace />

  return (
    <>
      <PageHeader
        title="Work in progress"
        description="WIP is inventory: every batch has a quantity, an operation, a location and a state, and it moves, splits, merges and holds like stock."
        actions={
          manage && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Add WIP
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-5 grid grid-cols-2">
          <StatCard
            label="Active WIP"
            value={fmtNumber(stats.qty)}
            unit="pcs"
            hint={`${stats.batches} batches`}
            icon={<Boxes />}
            tone="ink"
            onClick={() => setState('active')}
          />
          <StatCard label="Batches" value={stats.batches} icon={<Layers />} tone="default" />
          <StatCard
            label="Quality hold"
            value={stats.qualityHold}
            icon={<Microscope />}
            tone={stats.qualityHold ? 'danger' : 'success'}
            onClick={() => setState('quality_hold')}
          />
          <StatCard
            label="In rework"
            value={stats.rework}
            icon={<Wrench />}
            tone={stats.rework ? 'warning' : 'default'}
            onClick={() => setState('rework')}
          />
          <StatCard
            label="Aging"
            value={stats.aging}
            hint={`Untouched over ${s.settings.wipAgingHours}h`}
            icon={<Hourglass />}
            tone={stats.aging ? 'warning' : 'success'}
            className="xl:col-span-1 col-span-2"
          />
        </div>

        {exitMo && (
          <Banner
            tone="info"
            title={`${exitMo.code}: ${fmtNumber(stats.qty)} pieces of WIP in ${stats.batches} ${stats.batches === 1 ? 'batch' : 'batches'}`}
            action={
              <Button variant="outline" size="sm" onClick={() => setParam('mo', null)}>
                Clear
              </Button>
            }
          >
            {stats.batches === 0 ? (
              'No active WIP on this order.'
            ) : (
              <span className="space-x-1 text-xs block">
                <span>
                  Operations:{' '}
                  {rankBy(
                    stats.active,
                    (w) => `${w.operationSeq}`,
                    (w) => w.qty,
                  )
                    .map((g) => `op ${g.key} ${fmtNumber(g.value)}`)
                    .join(', ')}
                  .
                </span>
                <span>
                  Locations:{' '}
                  {rankBy(
                    stats.active,
                    (w) => w.locationId,
                    (w) => w.qty,
                  )
                    .map((g) => `${s.locationName(g.key)} ${fmtNumber(g.value)}`)
                    .join(', ')}
                  .
                </span>
                <span>
                  States:{' '}
                  {rankBy(
                    stats.active,
                    (w) => w.state,
                    (w) => w.qty,
                  )
                    .map((g) => `${WIP_STATE_LABEL[g.key as WipState]} ${fmtNumber(g.value)}`)
                    .join(', ')}
                  .
                </span>
                <span>Batches: {[...new Set(stats.active.map((w) => w.batch))].join(', ')}.</span>
              </span>
            )}
          </Banner>
        )}

        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip variant="filter" active={state === 'active'} onClick={() => setState('active')}>
              Active
            </Chip>
            {STATE_CHIPS.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={state === st}
                count={s.wips.filter((w) => w.state === st && (!moId || w.moId === moId)).length || undefined}
                onClick={() => setState(state === st ? 'active' : st)}
              >
                {WIP_STATE_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <MoPicker
            variant="inline"
            clearable
            value={moId}
            onChange={(id) => setParam('mo', id)}
            placeholder="Any order"
            aria-label="Filter by order"
          />
        </div>

        <div className="gap-4 xl:grid-cols-[minmax(0,22rem)_1fr] grid grid-cols-1">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <PillTabs
                size="sm"
                items={GROUPS}
                value={group}
                onValueChange={(v) => {
                  setGroup(v as Group)
                  setGroupValue(null)
                }}
              />
              {groups.length === 0 ? (
                <EmptyState compact title="No WIP in this view" />
              ) : (
                <BarList
                  ariaLabel={`WIP by ${group}`}
                  items={groups.map((g) => ({
                    key: g.key,
                    label: labelOf(g.key),
                    value: g.value,
                    display: `${fmtNumber(g.value)} pcs`,
                    hint: `${g.count} ${g.count === 1 ? 'batch' : 'batches'}`,
                    emphasis: groupValue === g.key,
                    onClick: () => setGroupValue(groupValue === g.key ? null : g.key),
                  }))}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(w) => w.id}
              onRowClick={(w) => navigate(paths.wip(w.id))}
              resetPageKey={`${state}|${moId}|${group}|${groupValue}`}
              empty={
                <EmptyState
                  compact
                  title="No WIP batches"
                  description="Batches appear once an operation reports output."
                />
              }
              rowClassName={(w) => (aging(w) ? 'bg-warning-soft/40' : undefined)}
              {...table}
            />
          </Card>
        </div>
      </div>
      <WipDialog
        open={creating}
        onOpenChange={setCreating}
        moId={moId}
        onSaved={(w) => navigate(paths.wip(w.id))}
      />
    </>
  )
}
