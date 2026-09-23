import { DAY, fmtWhen, fromDayKey, toMs } from '@mes/fixtures'
import type { ProductionEvent } from '@mes/types'
import { Chip, ChipRow, type Column, DataTable, Input, PageHeader, StatCard } from '@mes/ui'
import { Activity, CalendarDays, Search, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { MachinePicker, MoPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { EVENT_FAMILIES, EVENT_FAMILY_LABEL, type EventFamily, eventFamily, eventText } from './lib'

export function ProductionHistoryPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [family, setFamily] = useHistoryState<EventFamily | null>('family', null)
  const [moId, setMoId] = useHistoryState<string | null>('mo', null)
  const [machineId, setMachineId] = useHistoryState<string | null>('machine', null)
  const [from, setFrom] = useHistoryState('from', '')
  const [to, setTo] = useHistoryState('to', '')
  const [query, setQuery] = useHistoryState('query', '')
  const table = useTableHistory()

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromMs = from ? fromDayKey(from) : null
    const toMsEnd = to ? fromDayKey(to) + DAY : null
    return s.productionEvents
      .filter((e) => {
        if (family && eventFamily(e.type) !== family) return false
        if (moId && e.moId !== moId) return false
        if (machineId && e.machineId !== machineId) return false
        const at = toMs(e.at)
        if (fromMs !== null && at < fromMs) return false
        if (toMsEnd !== null && at >= toMsEnd) return false
        if (
          q &&
          !eventText(e).includes(q) &&
          !(
            s.maps.mo
              .get(e.moId ?? '')
              ?.code.toLowerCase()
              .includes(q) ?? false
          )
        )
          return false
        return true
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [s, family, moId, machineId, from, to, query])

  const stats = useMemo(() => {
    const today = rows.filter((e) => toMs(e.at) >= now - DAY).length
    return { total: rows.length, today, people: new Set(rows.map((e) => e.by)).size }
  }, [rows, now])

  const familyCounts = useMemo(() => {
    const counts = new Map<EventFamily, number>()
    for (const e of s.productionEvents) {
      const f = eventFamily(e.type)
      if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
    }
    return counts
  }, [s.productionEvents])

  const columns: Column<ProductionEvent>[] = [
    {
      id: 'when',
      header: 'When',
      width: '8.5rem',
      sortValue: (e) => e.at,
      cell: (e) => <span className="text-sm text-muted tabular-nums">{fmtWhen(e.at, now)}</span>,
    },
    {
      id: 'text',
      header: 'Event',
      cell: (e) => (
        <div className="min-w-0">
          <p className="text-sm">{e.text}</p>
          <p className="font-mono text-[11px] text-muted">{e.type}</p>
          <div className="mt-1.5 gap-2 text-xs sm:hidden flex flex-wrap">
            {e.moId && <MoLink moId={e.moId} showProduct={false} />}
            {e.woId && <WoLink woId={e.woId} />}
          </div>
        </div>
      ),
    },
    {
      id: 'refs',
      header: 'References',
      hideBelow: 'sm',
      cell: (e) => (
        <span className="gap-2 text-xs flex flex-wrap items-center">
          {e.moId && <MoLink moId={e.moId} showProduct={false} />}
          {e.woId && <WoLink woId={e.woId} />}
          {e.wipId && (
            <Link
              to={paths.wip(e.wipId)}
              onClick={(x) => x.stopPropagation()}
              className="font-mono hover:text-accent"
            >
              {s.maps.wip.get(e.wipId)?.code ?? e.wipId}
            </Link>
          )}
          {e.lotId && (
            <Link
              to={paths.lot(e.lotId)}
              onClick={(x) => x.stopPropagation()}
              className="font-mono hover:text-accent"
            >
              {s.maps.lot.get(e.lotId)?.code ?? e.lotId}
            </Link>
          )}
          {e.machineId && (
            <Link
              to={paths.machine(e.machineId)}
              onClick={(x) => x.stopPropagation()}
              className="font-mono hover:text-accent"
            >
              {s.maps.machine.get(e.machineId)?.code ?? e.machineId}
            </Link>
          )}
          {!e.moId && !e.woId && !e.wipId && !e.lotId && !e.machineId && (
            <span className="text-muted">—</span>
          )}
        </span>
      ),
    },
    {
      id: 'by',
      header: 'By',
      hideBelow: 'md',
      sortValue: (e) => s.personName(e.by),
      cell: (e) => <PersonChip personId={e.by} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Production history"
        description="The event log behind every order, batch and machine. Filter by family, order, machine or date to rebuild what happened."
        actions={
          <Input
            variant="pill"
            aria-label="Search events"
            leftIcon={<Search />}
            placeholder="Search text or type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 sm:w-72 sm:flex-none flex-1"
          />
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-3 grid grid-cols-2">
          <StatCard
            label="Events"
            value={stats.total}
            hint="Matching the filters"
            icon={<Activity />}
            tone="ink"
          />
          <StatCard label="Last 24 hours" value={stats.today} icon={<CalendarDays />} tone="info" />
          <StatCard
            label="People involved"
            value={stats.people}
            icon={<Users />}
            className="xl:col-span-1 col-span-2"
          />
        </div>
        <ChipRow>
          <Chip
            variant="filter"
            active={!family}
            count={s.productionEvents.length}
            onClick={() => setFamily(null)}
          >
            All
          </Chip>
          {EVENT_FAMILIES.map((f) => (
            <Chip
              key={f}
              variant="filter"
              active={family === f}
              count={familyCounts.get(f) ?? 0}
              onClick={() => setFamily(family === f ? null : f)}
            >
              {EVENT_FAMILY_LABEL[f]}
            </Chip>
          ))}
        </ChipRow>
        <div className="gap-2 sm:grid-cols-2 xl:grid-cols-4 grid grid-cols-1">
          <MoPicker
            variant="inline"
            value={moId}
            onChange={setMoId}
            clearable
            placeholder="Any order"
            aria-label="Order"
          />
          <MachinePicker
            variant="inline"
            value={machineId}
            onChange={setMachineId}
            clearable
            placeholder="Any machine"
            aria-label="Machine"
          />
          <Input
            type="date"
            variant="soft"
            aria-label="From date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            variant="soft"
            aria-label="To date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
          pageSize={25}
          resetPageKey={`${family}|${moId}|${machineId}|${from}|${to}|${query}`}
          empty="No events match. Every dispatch on the platform writes a line here."
          {...table}
        />
      </div>
    </>
  )
}
