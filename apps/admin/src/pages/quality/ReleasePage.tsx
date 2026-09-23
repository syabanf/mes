import { fmtAgo } from '@mes/fixtures'
import type { Ncr } from '@mes/types'
import { HOLD_TARGET_LABEL } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  CountBadge,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import { Boxes, ClipboardX, FileWarning, PauseOctagon, Plus, Recycle } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { NcrStatusBadge, SeverityBadge, WipStateBadge } from '../../components/badges'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { DispositionDialog, NcrDialog, ReworkCloseDialog } from './dialogs'
import { NCR_SOURCES, holdTargetCode } from './lib'

type Pending =
  { kind: 'inspection' | 'hold' | 'wip' | 'ncr'; id: string } | { kind: 'rework'; id: string } | null

export function ReleasePage() {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const [pending, setPending] = useState<Pending>(null)
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()
  const release = can('quality.release')

  const q = useMemo(() => {
    const activeHolds = s.qualityHolds.filter((h) => h.status === 'active')
    const held = new Set(activeHolds.map((h) => h.targetId))
    return {
      inspections: s.inspections
        .filter((i) => i.status === 'failed' && !i.disposition)
        .sort((a, b) => (a.completedAt ?? a.requestedAt).localeCompare(b.completedAt ?? b.requestedAt)),
      holds: [...activeHolds].sort((a, b) => a.heldAt.localeCompare(b.heldAt)),
      reworks: s.reworkOrders.filter((r) => r.status === 'inspection'),
      wips: s.wips.filter((w) => w.state === 'quality_hold' && w.qty > 0 && !held.has(w.id)),
      ncrs: s.ncrs.filter((n) => n.status === 'disposition'),
    }
  }, [s])
  const total = q.inspections.length + q.holds.length + q.reworks.length + q.wips.length + q.ncrs.length

  const ncrs = useMemo(
    () =>
      [...s.ncrs].sort(
        (a, b) =>
          (a.status === 'closed' ? 1 : 0) - (b.status === 'closed' ? 1 : 0) ||
          b.raisedAt.localeCompare(a.raisedAt),
      ),
    [s.ncrs],
  )

  const done = (label: string, description?: string) => {
    setPending(null)
    toast(label, { tone: 'success', description })
  }

  const columns: Column<Ncr>[] = [
    {
      id: 'code',
      header: 'NCR',
      sortValue: (n) => n.code,
      cell: (n) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{n.code}</p>
          <p className="text-sm truncate">{n.title}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <NcrStatusBadge status={n.status} />
            <SeverityBadge severity={n.severity} />
          </div>
        </div>
      ),
    },
    {
      id: 'defect',
      header: 'Defect',
      hideBelow: 'md',
      sortValue: (n) => s.maps.defectCode.get(n.defectCodeId)?.name ?? '',
      cell: (n) => (
        <span className="text-sm">{s.maps.defectCode.get(n.defectCodeId)?.name ?? 'Unknown'}</span>
      ),
    },
    {
      id: 'severity',
      header: 'Severity',
      hideBelow: 'sm',
      sortValue: (n) => n.severity,
      cell: (n) => <SeverityBadge severity={n.severity} />,
    },
    {
      id: 'source',
      header: 'Source',
      hideBelow: 'lg',
      sortValue: (n) => n.source,
      cell: (n) => <span className="text-sm">{NCR_SOURCES.find((x) => x.value === n.source)?.label}</span>,
    },
    {
      id: 'ref',
      header: 'MO / WO / lot',
      hideBelow: 'lg',
      cell: (n) => (
        <span className="gap-2 text-xs flex flex-wrap items-center">
          {n.moId ? <MoLink moId={n.moId} showProduct={false} /> : null}
          {n.woId ? <WoLink woId={n.woId} /> : null}
          {n.lotId ? (
            <Link
              to={paths.lotDetail(n.lotId)}
              onClick={(e) => e.stopPropagation()}
              className="font-mono hover:text-accent"
            >
              {s.maps.lot.get(n.lotId)?.code}
            </Link>
          ) : null}
          {!n.moId && !n.woId && !n.lotId && <span className="text-muted">—</span>}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (n) => n.status,
      cell: (n) => <NcrStatusBadge status={n.status} />,
    },
    {
      id: 'raised',
      header: 'Raised',
      hideBelow: 'md',
      sortValue: (n) => n.raisedAt,
      cell: (n) => <PersonChip personId={n.raisedBy} hint={fmtAgo(n.raisedAt, now)} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="Release and disposition"
        description="Everything waiting for a quality decision, in one queue. Each card is closed with a disposition: accept, rework, scrap, use as is, hold or return."
        actions={
          can('quality.execute') && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New NCR
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6 grid grid-cols-2">
          <StatCard
            label="Waiting"
            value={total}
            hint="Decisions in the queue"
            icon={<ClipboardX />}
            tone={total ? 'accent' : 'success'}
          />
          <StatCard
            label="Failed inspections"
            value={q.inspections.length}
            icon={<ClipboardX />}
            tone={q.inspections.length ? 'danger' : 'default'}
          />
          <StatCard
            label="Active holds"
            value={q.holds.length}
            icon={<PauseOctagon />}
            tone={q.holds.length ? 'danger' : 'default'}
          />
          <StatCard
            label="Rework to check"
            value={q.reworks.length}
            icon={<Recycle />}
            tone={q.reworks.length ? 'warning' : 'default'}
          />
          <StatCard
            label="WIP on hold"
            value={q.wips.length}
            hint="Without a hold record"
            icon={<Boxes />}
            tone={q.wips.length ? 'warning' : 'default'}
          />
          <StatCard
            label="NCR decisions"
            value={q.ncrs.length}
            icon={<FileWarning />}
            tone={q.ncrs.length ? 'info' : 'default'}
          />
        </div>

        {total === 0 ? (
          <Card>
            <EmptyState
              title="Queue is clear"
              description="Failed inspections, holds, finished rework and NCRs waiting for a disposition appear here."
            />
          </Card>
        ) : (
          <div className="gap-4 lg:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
            <QueueCard
              title="Failed inspections"
              description="Failed without a disposition."
              count={q.inspections.length}
            >
              {q.inspections.map((i) => (
                <QueueRow
                  key={i.id}
                  title={i.code}
                  subtitle={`${s.productName(i.productId)} · op ${i.operationSeq} · ${i.measurements.filter((m) => m.result === 'fail').length} failed`}
                  when={fmtAgo(i.completedAt ?? i.requestedAt, now)}
                  to={paths.inspection(i.id)}
                  action={
                    release && (
                      <Button size="sm" onClick={() => setPending({ kind: 'inspection', id: i.id })}>
                        Decide
                      </Button>
                    )
                  }
                />
              ))}
            </QueueCard>
            <QueueCard
              title="Active holds"
              description="Batches, lots, orders and operations held."
              count={q.holds.length}
            >
              {q.holds.map((h) => (
                <QueueRow
                  key={h.id}
                  title={h.code}
                  subtitle={`${HOLD_TARGET_LABEL[h.target]} ${holdTargetCode(s.state, h)} · ${s.reasonLabel(h.reasonCodeId)}`}
                  when={fmtAgo(h.heldAt, now)}
                  to={paths.hold(h.id)}
                  action={
                    release && (
                      <Button size="sm" onClick={() => setPending({ kind: 'hold', id: h.id })}>
                        Release
                      </Button>
                    )
                  }
                />
              ))}
            </QueueCard>
            <QueueCard
              title="Rework awaiting inspection"
              description="Close with the good and scrap split."
              count={q.reworks.length}
            >
              {q.reworks.map((r) => (
                <QueueRow
                  key={r.id}
                  title={r.code}
                  subtitle={`${s.maps.mo.get(r.moId)?.code ?? ''} · ${r.qty} pcs · ${s.reasonLabel(r.reasonCodeId)}`}
                  when={fmtAgo(r.createdAt, now)}
                  to={`/inventory/rework?id=${r.id}`}
                  action={
                    release && (
                      <Button size="sm" onClick={() => setPending({ kind: 'rework', id: r.id })}>
                        Close
                      </Button>
                    )
                  }
                />
              ))}
            </QueueCard>
            <QueueCard
              title="WIP on quality hold"
              description="Held batches with no hold record."
              count={q.wips.length}
            >
              {q.wips.map((w) => (
                <QueueRow
                  key={w.id}
                  title={w.code}
                  subtitle={`${s.maps.mo.get(w.moId)?.code ?? ''} · op ${w.operationSeq} · ${w.qty} pcs`}
                  when={fmtAgo(w.updatedAt, now)}
                  to={paths.wip(w.id)}
                  badge={<WipStateBadge state={w.state} />}
                  action={
                    release && (
                      <Button size="sm" onClick={() => setPending({ kind: 'wip', id: w.id })}>
                        Release
                      </Button>
                    )
                  }
                />
              ))}
            </QueueCard>
            <QueueCard
              title="NCR in disposition"
              description="Containment done, decision pending."
              count={q.ncrs.length}
            >
              {q.ncrs.map((n) => (
                <QueueRow
                  key={n.id}
                  title={n.code}
                  subtitle={n.title}
                  when={fmtAgo(n.raisedAt, now)}
                  badge={<SeverityBadge severity={n.severity} />}
                  to={paths.ncr(n.id)}
                  action={
                    release && (
                      <Button size="sm" onClick={() => setPending({ kind: 'ncr', id: n.id })}>
                        Close
                      </Button>
                    )
                  }
                />
              ))}
            </QueueCard>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Non-conformance reports</CardTitle>
            <CardDescription>
              Open → containment → disposition → closed. Open a row to see the report and move it on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              rows={ncrs}
              getRowKey={(n) => n.id}
              onRowClick={(n) => navigate(paths.ncr(n.id))}
              empty="No NCRs raised. Use New NCR for anything found by an operator, a customer, a supplier or an audit."
              {...table}
            />
          </CardContent>
        </Card>
      </div>

      {pending?.kind === 'inspection' && (
        <DispositionDialog
          key={pending.id}
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={`Disposition for ${s.maps.inspection.get(pending.id)?.code ?? 'inspection'}`}
          description="The recorded measurements stay as they are. Anything other than accept or use-as-is puts the batch on quality hold."
          confirmLabel="Record disposition"
          onConfirm={(disposition) => {
            const i = s.maps.inspection.get(pending.id)
            if (!i) return
            s.dispatch({
              type: 'inspections/record',
              id: i.id,
              measurements: i.measurements,
              disposition,
              note: i.note,
              defects: [],
            })
            done('Disposition recorded', `${i.code} closed as ${disposition.replace('_', ' ')}.`)
          }}
        />
      )}
      {pending?.kind === 'hold' && (
        <DispositionDialog
          key={pending.id}
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={`Release ${s.maps.hold.get(pending.id)?.code ?? 'hold'}?`}
          description="The target moves according to the disposition: back to the line, to rework, or to scrap."
          confirmLabel="Release"
          onConfirm={(disposition) => {
            s.dispatch({ type: 'qualityHolds/release', id: pending.id, disposition })
            done('Hold released')
          }}
        />
      )}
      {pending?.kind === 'wip' && (
        <DispositionDialog
          key={pending.id}
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={`Release ${s.maps.wip.get(pending.id)?.code ?? 'batch'}?`}
          description="Accept and use-as-is queue the batch again, rework routes it to rework, scrap scraps it."
          confirmLabel="Release"
          onConfirm={(disposition) => {
            s.dispatch({ type: 'wips/release', id: pending.id, disposition })
            done('Batch released')
          }}
        />
      )}
      {pending?.kind === 'ncr' && (
        <DispositionDialog
          key={pending.id}
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={`Close ${s.maps.ncr.get(pending.id)?.code ?? 'NCR'}`}
          description="Closing records the disposition and the closing time."
          confirmLabel="Close NCR"
          onConfirm={(disposition) => {
            s.dispatch({ type: 'ncrs/setStatus', id: pending.id, status: 'closed', disposition })
            done('NCR closed')
          }}
        />
      )}
      <ReworkCloseDialog
        open={pending?.kind === 'rework'}
        onOpenChange={(open) => !open && setPending(null)}
        reworkId={pending?.kind === 'rework' ? pending.id : null}
      />

      <NcrDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

function QueueCard({
  title,
  description,
  count,
  children,
}: {
  title: string
  description: string
  count: number
  children: ReactNode
}) {
  if (count === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="gap-2 flex items-center">
          {title} <CountBadge count={count} />
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  )
}

function QueueRow({
  title,
  subtitle,
  when,
  to,
  badge,
  action,
}: {
  title: string
  subtitle: string
  when: string
  to: string
  badge?: ReactNode
  action?: ReactNode
}) {
  const body = (
    <span className="min-w-0 flex-1">
      <span className="text-xs font-semibold block truncate font-mono">{title}</span>
      <span className="text-xs block truncate text-muted">{subtitle}</span>
      <span className="mt-1 gap-2 flex flex-wrap items-center text-[11px] text-muted">
        {badge}
        {when}
      </span>
    </span>
  )
  return (
    <div className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2">
      <Link to={to} className="min-w-0 flex flex-1 hover:text-accent">
        {body}
      </Link>
      {action}
    </div>
  )
}
