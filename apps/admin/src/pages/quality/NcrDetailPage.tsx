import { fmtAgo, fmtDateTime } from '@mes/fixtures'
import type { NcrStatus } from '@mes/types'
import { DISPOSITION_LABEL, NCR_STATUS_LABEL, SEVERITY_LABEL } from '@mes/types'
import {
  ActionMenu,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  KeyValue,
  Steps,
  type StepState,
  Textarea,
  toast,
} from '@mes/ui'
import { ArrowRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import {
  DispositionBadge,
  InspectionStatusBadge,
  NcrStatusBadge,
  SeverityBadge,
} from '../../components/badges'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { DispositionDialog, NcrDialog } from './dialogs'
import { HoldStatusBadge } from './HoldStatusBadge'
import { NCR_SOURCES, holdTargetCode } from './lib'

const LIST = '/quality/release'
const NCR_FLOW: NcrStatus[] = ['open', 'containment', 'disposition', 'closed']

export function NcrDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const ncr = s.maps.ncr.get(id)
  const [containing, setContaining] = useState(false)
  const [containment, setContainment] = useState('')
  const [closing, setClosing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const related = useMemo(() => {
    if (!ncr) return { inspections: [], holds: [] }
    const onRecord = (moId: string | null, wipId: string | null) =>
      (ncr.wipId && wipId === ncr.wipId) || (!ncr.wipId && !!ncr.moId && moId === ncr.moId)
    return {
      inspections: s.inspections
        .filter((i) => onRecord(i.moId, i.wipId))
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
        .slice(0, 6),
      holds: s.qualityHolds
        .filter((h) => onRecord(h.moId, h.target === 'wip' ? h.targetId : null))
        .sort((a, b) => b.heldAt.localeCompare(a.heldAt))
        .slice(0, 6),
    }
  }, [s.inspections, s.qualityHolds, ncr])

  if (!ncr) {
    return (
      <Card>
        <EmptyState
          title="NCR not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback={LIST} />}
        />
      </Card>
    )
  }

  const idx = NCR_FLOW.indexOf(ncr.status)
  const next = NCR_FLOW[idx + 1]
  const steps = NCR_FLOW.map((st, i) => ({
    key: st,
    label: NCR_STATUS_LABEL[st],
    state: (i < idx ? 'done' : i === idx ? 'current' : 'upcoming') as StepState,
  }))
  const defect = s.maps.defectCode.get(ncr.defectCodeId)
  const lot = ncr.lotId ? s.maps.lot.get(ncr.lotId) : undefined
  const wip = ncr.wipId ? s.maps.wip.get(ncr.wipId) : undefined
  const release = can('quality.release')
  const manage = can('quality.execute')

  const moveTo = (status: NcrStatus, extra: { containment?: string } = {}) => {
    s.dispatch({ type: 'ncrs/setStatus', id: ncr.id, status, ...extra })
    toast(`${ncr.code} moved to ${NCR_STATUS_LABEL[status].toLowerCase()}`, { tone: 'success' })
  }

  const menu = [
    manage ? { key: 'edit', label: 'Edit NCR', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete NCR',
          icon: <Trash2 />,
          destructive: true,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback={LIST} />
        <div className="gap-2 flex flex-wrap items-center">
          {release && next === 'containment' && (
            <Button
              onClick={() => {
                setContainment(ncr.containment)
                setContaining(true)
              }}
            >
              Move to containment
              <ArrowRight />
            </Button>
          )}
          {release && next === 'disposition' && (
            <Button onClick={() => moveTo('disposition')}>
              Move to disposition
              <ArrowRight />
            </Button>
          )}
          {release && next === 'closed' && (
            <Button onClick={() => setClosing(true)}>
              Close NCR
              <ArrowRight />
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={ncr.code}
              items={menu}
              trigger={
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{ncr.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{ncr.title}</h1>
            <p className="text-sm text-on-ink-muted">
              {defect ? `${defect.name} (${defect.code})` : 'Unknown defect'} ·{' '}
              {NCR_SOURCES.find((x) => x.value === ncr.source)?.label}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <NcrStatusBadge status={ncr.status} />
            <SeverityBadge severity={ncr.severity} />
          </div>
        </div>
        <div className="mt-5 gap-4 grid grid-cols-3">
          <Metric label="Severity" value={SEVERITY_LABEL[ncr.severity]} />
          <Metric label="Raised" value={fmtAgo(ncr.raisedAt, now)} unit={s.personName(ncr.raisedBy)} />
          <Metric
            label={ncr.closedAt ? 'Closed' : 'Disposition'}
            value={
              ncr.closedAt
                ? fmtAgo(ncr.closedAt, now)
                : ncr.disposition
                  ? DISPOSITION_LABEL[ncr.disposition]
                  : '—'
            }
            unit={ncr.closedAt ? undefined : 'pending'}
          />
        </div>
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      <Card className="p-5">
        <Steps steps={steps} />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Report</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                {
                  label: 'Defect',
                  value: defect ? (
                    <span className="gap-2 inline-flex flex-wrap items-center">
                      {defect.name} <span className="text-xs font-mono text-muted">{defect.code}</span>
                    </span>
                  ) : (
                    'Unknown'
                  ),
                },
                { label: 'Severity', value: <SeverityBadge severity={ncr.severity} /> },
                { label: 'Source', value: NCR_SOURCES.find((x) => x.value === ncr.source)?.label },
                { label: 'Order', value: ncr.moId ? <MoLink moId={ncr.moId} /> : 'None' },
                {
                  label: 'Work order',
                  value: ncr.woId ? <WoLink woId={ncr.woId} /> : null,
                  hidden: !ncr.woId,
                },
                {
                  label: 'Lot',
                  value: lot ? (
                    <Link to={paths.lotDetail(lot.id)} className="text-xs font-mono hover:text-accent">
                      {lot.code}
                    </Link>
                  ) : null,
                  hidden: !lot,
                },
                {
                  label: 'WIP',
                  value: wip ? (
                    <Link to={paths.wip(wip.id)} className="text-xs font-mono hover:text-accent">
                      {wip.code}
                    </Link>
                  ) : null,
                  hidden: !wip,
                },
                {
                  label: 'Raised by',
                  value: <PersonChip personId={ncr.raisedBy} hint={fmtDateTime(ncr.raisedAt)} />,
                },
                { label: 'Closed at', value: ncr.closedAt ? fmtDateTime(ncr.closedAt) : 'Open' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                {
                  label: 'Containment',
                  value: ncr.containment || (
                    <span className="text-muted">Not recorded. Required to move past Open.</span>
                  ),
                },
                { label: 'Disposition', value: <DispositionBadge disposition={ncr.disposition} /> },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Inspections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {related.inspections.length === 0 ? (
              <EmptyState
                compact
                title="No inspections"
                description="Inspections on the same batch, or on the order when no batch is set, appear here."
              />
            ) : (
              related.inspections.map((i) => (
                <Link
                  key={i.id}
                  to={paths.inspection(i.id)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{i.code}</span>
                    <span className="text-xs block truncate text-muted">
                      Op {i.operationSeq} · {fmtAgo(i.completedAt ?? i.requestedAt, now)}
                    </span>
                  </span>
                  <InspectionStatusBadge status={i.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality holds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {related.holds.length === 0 ? (
              <EmptyState
                compact
                title="No holds"
                description="Holds on the same batch or order appear here."
              />
            ) : (
              related.holds.map((h) => (
                <Link
                  key={h.id}
                  to={paths.hold(h.id)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{h.code}</span>
                    <span className="text-xs block truncate text-muted">
                      {holdTargetCode(s.state, h)} · {s.reasonLabel(h.reasonCodeId)} · {fmtAgo(h.heldAt, now)}
                    </span>
                  </span>
                  <HoldStatusBadge status={h.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={containing}
        onOpenChange={setContaining}
        title={`Move ${ncr.code} to containment`}
        description="Record what was quarantined, stopped or segregated. The report cannot leave Open without it."
        confirmLabel="Move to containment"
        confirmDisabled={!containment.trim()}
        onConfirm={() => {
          moveTo('containment', { containment })
          setContaining(false)
        }}
      >
        <div className="mt-4">
          <FormField label="Containment" required>
            <Textarea
              value={containment}
              onChange={(e) => setContainment(e.target.value)}
              className="min-h-20"
            />
          </FormField>
        </div>
      </ConfirmDialog>
      <DispositionDialog
        key={ncr.id}
        open={closing}
        onOpenChange={setClosing}
        title={`Close ${ncr.code}`}
        description="Closing records the disposition and the closing time."
        confirmLabel="Close NCR"
        initial={ncr.disposition ?? 'accept'}
        onConfirm={(disposition) => {
          s.dispatch({ type: 'ncrs/setStatus', id: ncr.id, status: 'closed', disposition })
          setClosing(false)
          toast('NCR closed', {
            tone: 'success',
            description: `${ncr.code} closed as ${DISPOSITION_LABEL[disposition].toLowerCase()}.`,
          })
        }}
      />
      <NcrDialog open={editing} onOpenChange={setEditing} editing={ncr} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${ncr.code}?`}
        description="The report is removed from the queue and the list. Holds and inspections it refers to stay."
        confirmLabel="Delete NCR"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'ncrs/remove', id: ncr.id })
          setDeleting(false)
          toast('NCR deleted', { tone: 'default', description: `${ncr.code} removed.` })
          navigate(LIST)
        }}
      />
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex flex-wrap items-end leading-none">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold truncate text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
