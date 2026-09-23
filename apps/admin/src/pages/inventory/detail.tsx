import { fmtAgo, fmtNumber, fmtWhen } from '@mes/fixtures'
import type { MaterialTxn, ProductionEvent } from '@mes/types'
import { MATERIAL_TXN_LABEL } from '@mes/types'
import { Badge, type Column, DataTable, EmptyState } from '@mes/ui'
import { Link } from 'react-router'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { TXN_KIND_VARIANT } from './lib'

/** One big number inside a dark hero card. */
export function HeroMetric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex items-end leading-none">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}

/** Material transactions of one lot or one requirement line, newest first. */
export function TxnTable({
  txns,
  now,
  lotColumn = true,
}: {
  txns: MaterialTxn[]
  now: number
  lotColumn?: boolean
}) {
  const s = useScoped()
  const lot: Column<MaterialTxn> = {
    id: 'lot',
    header: 'Lot',
    hideBelow: 'md',
    cell: (t) =>
      t.lotId ? (
        <Link
          to={paths.lotDetail(t.lotId)}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-mono hover:text-accent"
        >
          {s.maps.lot.get(t.lotId)?.code ?? t.lotId}
        </Link>
      ) : (
        <span className="text-muted">—</span>
      ),
  }
  const columns: Column<MaterialTxn>[] = [
    {
      id: 'when',
      header: 'When',
      sortValue: (t) => t.at,
      cell: (t) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-muted">{fmtWhen(t.at, now)}</p>
          <div className="mt-1.5 sm:hidden">
            <Badge variant={TXN_KIND_VARIANT[t.kind]}>{MATERIAL_TXN_LABEL[t.kind]}</Badge>
          </div>
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Type',
      hideBelow: 'sm',
      sortValue: (t) => t.kind,
      cell: (t) => <Badge variant={TXN_KIND_VARIANT[t.kind]}>{MATERIAL_TXN_LABEL[t.kind]}</Badge>,
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (t) => t.qty,
      cell: (t) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtNumber(t.qty, 2)} <span className="text-xs text-muted">{s.uomCode(t.uomId)}</span>
        </span>
      ),
    },
    ...(lotColumn ? [lot] : []),
    {
      id: 'route',
      header: 'From → to',
      hideBelow: 'lg',
      cell: (t) => (
        <span className="text-muted">
          {t.fromLocationId ? s.locationName(t.fromLocationId) : 'Outside'} →{' '}
          {t.toLocationId
            ? s.locationName(t.toLocationId)
            : t.kind === 'consume'
              ? 'Consumed'
              : s.locationName(t.fromLocationId)}
        </span>
      ),
    },
    {
      id: 'ref',
      header: 'Order',
      hideBelow: 'md',
      cell: (t) => (
        <span className="gap-x-3 gap-y-1 flex flex-wrap items-center">
          {t.moId && <MoLink moId={t.moId} showProduct={false} />}
          {t.woId && <WoLink woId={t.woId} />}
          {!t.moId && !t.woId && <span className="text-muted">—</span>}
        </span>
      ),
    },
    { id: 'by', header: 'By', hideBelow: 'xl', cell: (t) => <PersonChip personId={t.by} /> },
  ]
  return (
    <DataTable
      columns={columns}
      rows={txns}
      getRowKey={(t) => t.id}
      pageSize={10}
      empty={
        <EmptyState
          compact
          title="No transactions"
          description="Reservations, moves and consumption show here as they happen."
        />
      }
    />
  )
}

/** Production events for one record, newest first. */
export function EventList({ events, now, empty }: { events: ProductionEvent[]; now: number; empty: string }) {
  const s = useScoped()
  if (events.length === 0) return <EmptyState compact title="No events yet" description={empty} />
  return (
    <div className="space-y-1">
      {events.map((e) => (
        <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
          <span className="w-16 pt-0.5 text-xs shrink-0 text-muted tabular-nums">{fmtAgo(e.at, now)}</span>
          <span className="min-w-0 flex-1">
            <span className="text-sm block">{e.text}</span>
            <span className="block text-[11px] text-muted">
              {s.personName(e.by)} · <span className="font-mono">{e.type}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
