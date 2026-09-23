import { fmtAgo, fmtNumber, fmtWhen, isSameDay, startOfWeek, sumBy, toMs } from '@mes/fixtures'
import type { DefectRecord, Severity } from '@mes/types'
import { SEVERITY_LABEL } from '@mes/types'
import {
  ActionMenu,
  BarList,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  ChipRow,
  type Column,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import {
  Bug,
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Siren,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { NcrStatusBadge, SeverityBadge } from '../../components/badges'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { DefectRecordDialog, NcrDialog } from './dialogs'
import { SEVERITIES, matches } from './lib'

export function DefectsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [query, setQuery] = useHistoryState('query', '')
  const [severity, setSeverity] = useHistoryState<Severity | null>('severity', null)
  const [raising, setRaising] = useState(false)
  const [recording, setRecording] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const table = useTableHistory()
  const execute = can('quality.execute')
  const editingRecord = editingId ? s.defectRecords.find((r) => r.id === editingId) : undefined
  const deletingRecord = deletingId ? s.defectRecords.find((r) => r.id === deletingId) : undefined

  const openNcrs = useMemo(
    () =>
      s.ncrs
        .filter((n) => n.status !== 'closed')
        .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
        .slice(0, 6),
    [s.ncrs],
  )

  const codeOf = useCallback((r: DefectRecord) => s.maps.defectCode.get(r.defectCodeId), [s.maps.defectCode])

  const d = useMemo(() => {
    const operationOf = (r: DefectRecord) =>
      (r.woId ? s.maps.wo.get(r.woId)?.operationSeq : undefined) ??
      (r.inspectionId ? s.maps.inspection.get(r.inspectionId)?.operationSeq : undefined) ??
      null
    const opName = (seq: number) =>
      s.bops.flatMap((b) => b.operations).find((o) => o.seq === seq)?.name ?? `Operation ${seq}`
    const byCode = new Map<string, number>()
    const byOp = new Map<string, number>()
    for (const r of s.defectRecords) {
      byCode.set(r.defectCodeId, (byCode.get(r.defectCodeId) ?? 0) + r.qty)
      const seq = operationOf(r)
      const key = seq === null ? 'Unknown operation' : `${seq} · ${opName(seq)}`
      byOp.set(key, (byOp.get(key) ?? 0) + r.qty)
    }
    const pareto = [...byCode].sort((a, b) => b[1] - a[1])
    const top = pareto[0]
    return {
      today: sumBy(
        s.defectRecords.filter((r) => isSameDay(toMs(r.at), now)),
        (r) => r.qty,
      ),
      week: sumBy(
        s.defectRecords.filter((r) => toMs(r.at) >= startOfWeek(now)),
        (r) => r.qty,
      ),
      top: top ? { name: s.maps.defectCode.get(top[0])?.name ?? top[0], qty: top[1] } : null,
      critical: sumBy(
        s.defectRecords.filter((r) => codeOf(r)?.severity === 'critical'),
        (r) => r.qty,
      ),
      pareto,
      byOp: [...byOp].sort((a, b) => b[1] - a[1]),
      codes: [...s.defectCodes]
        .map((c) => ({
          ...c,
          qty: byCode.get(c.id) ?? 0,
          records: s.defectRecords.filter((r) => r.defectCodeId === c.id).length,
        }))
        .sort((a, b) => b.qty - a.qty || a.code.localeCompare(b.code)),
    }
  }, [s, codeOf, now])

  const rows = useMemo(
    () =>
      [...s.defectRecords]
        .filter((r) => {
          const code = codeOf(r)
          if (severity && code?.severity !== severity) return false
          return matches(
            query,
            code?.name,
            code?.code,
            s.maps.mo.get(r.moId)?.code,
            s.maps.wip.get(r.wipId ?? '')?.code,
            r.note,
          )
        })
        .sort((a, b) => b.at.localeCompare(a.at)),
    [s, codeOf, severity, query],
  )

  const columns: Column<DefectRecord>[] = [
    {
      id: 'when',
      header: 'When',
      sortValue: (r) => r.at,
      width: '8rem',
      cell: (r) => <span className="text-sm text-muted tabular-nums">{fmtWhen(r.at, now)}</span>,
    },
    {
      id: 'defect',
      header: 'Defect',
      sortValue: (r) => codeOf(r)?.name ?? '',
      cell: (r) => {
        const code = codeOf(r)
        return (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{code?.name ?? 'Unknown defect'}</p>
            <p className="text-xs font-mono text-muted">{code?.code}</p>
            <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
              {code && <SeverityBadge severity={code.severity} />}
            </div>
          </div>
        )
      },
    },
    {
      id: 'severity',
      header: 'Severity',
      hideBelow: 'sm',
      sortValue: (r) => codeOf(r)?.severity ?? '',
      cell: (r) => (codeOf(r) ? <SeverityBadge severity={codeOf(r)!.severity} /> : null),
    },
    {
      id: 'qty',
      header: 'Qty',
      align: 'right',
      sortValue: (r) => r.qty,
      cell: (r) => <span className="font-semibold tabular-nums">{fmtNumber(r.qty)}</span>,
    },
    { id: 'mo', header: 'Order', hideBelow: 'md', cell: (r) => <MoLink moId={r.moId} showProduct={false} /> },
    {
      id: 'wo',
      header: 'Work order',
      hideBelow: 'lg',
      cell: (r) => (r.woId ? <WoLink woId={r.woId} /> : <span className="text-muted">—</span>),
    },
    {
      id: 'wip',
      header: 'WIP',
      hideBelow: 'xl',
      cell: (r) =>
        r.wipId ? (
          <Link
            to={paths.wip(r.wipId)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-mono hover:text-accent"
          >
            {s.maps.wip.get(r.wipId)?.code ?? r.wipId}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'inspection',
      header: 'Inspection',
      hideBelow: 'lg',
      cell: (r) =>
        r.inspectionId ? (
          <Link
            to={paths.inspection(r.inspectionId)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-mono hover:text-accent"
          >
            {s.maps.inspection.get(r.inspectionId)?.code ?? r.inspectionId}
          </Link>
        ) : (
          <span className="text-muted">Operator</span>
        ),
    },
    { id: 'by', header: 'By', hideBelow: 'xl', cell: (r) => <PersonChip personId={r.by} /> },
    {
      id: 'note',
      header: 'Note',
      hideBelow: 'xl',
      cell: (r) => <span className="text-sm line-clamp-2 text-muted">{r.note || '—'}</span>,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '3rem',
      cell: (r) =>
        execute ? (
          <ActionMenu
            title={codeOf(r)?.name ?? 'Defect record'}
            items={[
              { key: 'edit', label: 'Edit record', icon: <Pencil />, onSelect: () => setEditingId(r.id) },
              {
                key: 'delete',
                label: 'Delete record',
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => setDeletingId(r.id),
              },
            ]}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Record actions">
                <MoreHorizontal />
              </Button>
            }
          />
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Defects"
        description="Every defect found at inspection or reported from the floor, ranked by code and operation so the biggest cause shows first."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search defects"
              leftIcon={<Search />}
              placeholder="Search defect, order or batch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-72 sm:flex-none flex-1"
            />
            {execute && (
              <Button onClick={() => setRecording(true)}>
                <Plus />
                Record defect
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Defects today"
            value={fmtNumber(d.today)}
            unit="pcs"
            icon={<Bug />}
            tone={d.today ? 'danger' : 'success'}
          />
          <StatCard
            label="This week"
            value={fmtNumber(d.week)}
            unit="pcs"
            hint="Since Monday"
            icon={<CalendarDays />}
            tone="ink"
          />
          <StatCard
            label="Top defect"
            value={d.top ? <span className="text-lg">{d.top.name}</span> : '—'}
            hint={d.top ? `${fmtNumber(d.top.qty)} pcs all time` : 'No defects recorded'}
            icon={<TrendingUp />}
            tone="warning"
          />
          <StatCard
            label="Critical"
            value={fmtNumber(d.critical)}
            unit="pcs"
            hint="Critical severity codes"
            icon={<Siren />}
            tone={d.critical ? 'accent' : 'default'}
          />
        </div>

        <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Pareto by defect code</CardTitle>
              <CardDescription>Quantity per code, largest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.pareto.length === 0 ? (
                <EmptyState
                  compact
                  title="No defects"
                  description="Defects recorded at inspection land here."
                />
              ) : (
                <BarList
                  ariaLabel="Defect quantity by code"
                  items={d.pareto.slice(0, 8).map(([id, qty], i) => ({
                    key: id,
                    label: s.maps.defectCode.get(id)?.name ?? id,
                    hint: s.maps.defectCode.get(id)?.code,
                    value: qty,
                    display: fmtNumber(qty),
                    emphasis: i === 0,
                  }))}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By operation</CardTitle>
              <CardDescription>Where in the routing the defects are found.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.byOp.length === 0 ? (
                <EmptyState
                  compact
                  title="No defects"
                  description="Defects are attributed through their work order."
                />
              ) : (
                <BarList
                  ariaLabel="Defect quantity by operation"
                  tone="info"
                  items={d.byOp
                    .slice(0, 8)
                    .map(([label, qty]) => ({ key: label, label, value: qty, display: fmtNumber(qty) }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <ChipRow>
          <Chip
            variant="filter"
            active={!severity}
            count={s.defectRecords.length}
            onClick={() => setSeverity(null)}
          >
            All
          </Chip>
          {SEVERITIES.map((sv) => (
            <Chip
              key={sv}
              variant="filter"
              active={severity === sv}
              count={s.defectRecords.filter((r) => codeOf(r)?.severity === sv).length}
              onClick={() => setSeverity(severity === sv ? null : sv)}
            >
              {SEVERITY_LABEL[sv]}
            </Chip>
          ))}
        </ChipRow>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          resetPageKey={`${query}|${severity}`}
          empty="No defect records match."
          {...table}
        />

        <Card>
          <CardHeader
            action={
              <div className="gap-2 flex flex-wrap items-center">
                <Button asChild variant="ghost" size="sm">
                  <Link to="/quality/release">All NCRs</Link>
                </Button>
                {execute && (
                  <Button variant="outline" size="sm" onClick={() => setRaising(true)}>
                    <Plus />
                    New NCR
                  </Button>
                )}
              </div>
            }
          >
            <CardTitle>Open non-conformance reports</CardTitle>
            <CardDescription>
              Defects that need containment and a decision beyond the inspection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {openNcrs.length === 0 ? (
              <EmptyState
                compact
                title="No open NCRs"
                description="Raise one for anything found by an operator, a customer, a supplier or an audit."
              />
            ) : (
              openNcrs.map((n) => (
                <Link
                  key={n.id}
                  to={paths.ncr(n.id)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{n.title}</span>
                    <span className="text-xs block truncate text-muted">
                      <span className="font-mono">{n.code}</span> ·{' '}
                      {s.maps.defectCode.get(n.defectCodeId)?.name ?? 'Unknown defect'} ·{' '}
                      {fmtAgo(n.raisedAt, now)}
                    </span>
                  </span>
                  <SeverityBadge severity={n.severity} />
                  <NcrStatusBadge status={n.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Defect codes</CardTitle>
            <CardDescription>
              The master list with how often each was used. Codes are maintained in master data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {d.codes.length === 0 ? (
              <EmptyState
                compact
                title="No defect codes"
                description="Add codes in master data before recording defects."
              />
            ) : (
              <ul className="gap-2 sm:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
                {d.codes.map((c) => (
                  <li key={c.id} className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-semibold block truncate">{c.name}</span>
                      <span className="text-xs block truncate text-muted">
                        <span className="font-mono">{c.code}</span> · {c.category}
                        {c.active ? '' : ' · inactive'}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="text-sm font-bold block tabular-nums">{fmtNumber(c.qty)}</span>
                      <span className="block text-[11px] text-muted">{c.records} records</span>
                    </span>
                    <SeverityBadge severity={c.severity} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <NcrDialog open={raising} onOpenChange={setRaising} />
      <DefectRecordDialog open={recording} onOpenChange={setRecording} />
      {editingRecord && (
        <DefectRecordDialog
          key={editingRecord.id}
          open
          onOpenChange={(open) => !open && setEditingId(null)}
          editing={editingRecord}
        />
      )}
      <ConfirmDialog
        open={!!deletingRecord}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete this defect record?"
        description={
          deletingRecord?.inspectionId
            ? 'It was recorded by an inspection. The inspection keeps its result; only this defect line and its quantity go.'
            : 'The record and its quantity disappear from the Pareto and the operation ranking.'
        }
        confirmLabel="Delete record"
        destructive
        onConfirm={() => {
          if (!deletingRecord) return
          s.dispatch({ type: 'defectRecords/remove', id: deletingRecord.id })
          setDeletingId(null)
          toast('Defect record deleted', { tone: 'default' })
        }}
      />
    </>
  )
}
