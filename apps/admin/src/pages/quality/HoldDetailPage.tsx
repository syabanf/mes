import { fmtAgo, fmtDateTime, fmtNumber } from '@mes/fixtures'
import { DISPOSITION_LABEL, HOLD_TARGET_LABEL } from '@mes/types'
import {
  ActionMenu,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  toast,
} from '@mes/ui'
import { LockOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { DispositionBadge, InspectionStatusBadge } from '../../components/badges'
import { MoLink, PersonChip, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { DispositionDialog, HoldDialog } from './dialogs'
import { HoldStatusBadge } from './HoldStatusBadge'
import { holdHours, holdTargetCode, holdTargetPath } from './lib'

const LIST = '/quality/holds'

export function HoldDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const hold = s.maps.hold.get(id)
  const [releasing, setReleasing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const inspections = useMemo(
    () =>
      hold?.target === 'wip'
        ? s.inspections
            .filter((i) => i.wipId === hold.targetId)
            .sort((a, b) => (b.completedAt ?? b.requestedAt).localeCompare(a.completedAt ?? a.requestedAt))
        : [],
    [s.inspections, hold],
  )
  const events = useMemo(
    () =>
      hold
        ? s.productionEvents
            .filter((e) => e.text.includes(hold.code))
            .sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [s.productionEvents, hold],
  )

  if (!hold) {
    return (
      <Card>
        <EmptyState
          title="Hold not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback={LIST} />}
        />
      </Card>
    )
  }

  const active = hold.status === 'active'
  const targetCode = holdTargetCode(s.state, hold)
  const hours = holdHours(hold, now)
  const manage = can('quality.execute')

  const menu = [
    manage ? { key: 'edit', label: 'Edit hold', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete hold',
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
          {active && can('quality.release') && (
            <Button onClick={() => setReleasing(true)}>
              <LockOpen />
              Release hold
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={hold.code}
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
            <p className="text-xs font-mono text-on-ink-muted">{hold.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {HOLD_TARGET_LABEL[hold.target]}{' '}
              <Link to={holdTargetPath(hold)} className="font-mono hover:underline">
                {targetCode}
              </Link>
            </h1>
            <p className="text-sm text-on-ink-muted">
              {s.reasonLabel(hold.reasonCodeId)} · {s.maps.mo.get(hold.moId)?.code ?? 'no order'}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <HoldStatusBadge status={hold.status} />
            <DispositionBadge disposition={hold.disposition} />
          </div>
        </div>
        <div className="mt-5 gap-4 grid grid-cols-3">
          <Metric label="On hold" value={fmtNumber(hours, 1)} unit={active ? 'h and counting' : 'h'} />
          <Metric label="Held" value={fmtAgo(hold.heldAt, now)} unit={s.personName(hold.heldBy)} />
          <Metric
            label="Released"
            value={hold.releasedAt ? fmtAgo(hold.releasedAt, now) : '—'}
            unit={hold.releasedBy ? s.personName(hold.releasedBy) : 'pending'}
          />
        </div>
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Hold</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                {
                  label: 'Target',
                  value: (
                    <span className="text-sm">
                      {HOLD_TARGET_LABEL[hold.target]} ·{' '}
                      <Link
                        to={holdTargetPath(hold)}
                        className="text-xs font-semibold font-mono hover:text-accent"
                      >
                        {targetCode}
                      </Link>
                    </span>
                  ),
                },
                { label: 'Order', value: <MoLink moId={hold.moId} /> },
                { label: 'Reason', value: s.reasonLabel(hold.reasonCodeId) },
                { label: 'Note', value: hold.note || 'None' },
                {
                  label: 'Held by',
                  value: <PersonChip personId={hold.heldBy} hint={fmtDateTime(hold.heldAt)} />,
                },
                {
                  label: 'Released by',
                  value: (
                    <PersonChip
                      personId={hold.releasedBy}
                      hint={hold.releasedAt ? fmtDateTime(hold.releasedAt) : undefined}
                    />
                  ),
                  hidden: !hold.releasedBy,
                },
                {
                  label: 'Disposition',
                  value: <DispositionBadge disposition={hold.disposition} />,
                  hidden: !hold.disposition,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inspections on the batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inspections.length === 0 ? (
              <EmptyState
                compact
                title="No inspection linked"
                description={
                  hold.target === 'wip'
                    ? 'Failed inspections on this batch appear here.'
                    : 'Only holds on a WIP batch trace back to an inspection.'
                }
              />
            ) : (
              inspections.map((i) => (
                <Link
                  key={i.id}
                  to={paths.inspection(i.id)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{i.code}</span>
                    <span className="text-xs block truncate text-muted">
                      Op {i.operationSeq} · {i.measurements.filter((m) => m.result === 'fail').length} failed
                      · {fmtAgo(i.completedAt ?? i.requestedAt, now)}
                    </span>
                  </span>
                  <InspectionStatusBadge status={i.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {events.length === 0 ? (
            <EmptyState
              compact
              title="No events yet"
              description="Holding and releasing write a production event that mentions this hold."
            />
          ) : (
            events.map((e) => (
              <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                <span className="w-16 pt-0.5 text-xs shrink-0 text-muted tabular-nums">
                  {fmtAgo(e.at, now)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm block">{e.text}</span>
                  <span className="block text-[11px] text-muted">
                    {s.personName(e.by)} · <span className="font-mono">{e.type}</span>
                  </span>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <DispositionDialog
        key={hold.id}
        open={releasing}
        onOpenChange={setReleasing}
        title={`Release ${hold.code}?`}
        description={
          hold.target === 'wip'
            ? 'Accept and use-as-is return the batch to the line buffer, rework sends it to the rework area, scrap records a scrap entry.'
            : hold.target === 'lot'
              ? 'Return marks the lot returned; any other disposition makes it available again.'
              : 'The order or operation resumes once the hold is released.'
        }
        confirmLabel="Release"
        onConfirm={(disposition) => {
          s.dispatch({ type: 'qualityHolds/release', id: hold.id, disposition })
          setReleasing(false)
          toast('Hold released', {
            tone: 'success',
            description: `${hold.code} released as ${DISPOSITION_LABEL[disposition].toLowerCase()}.`,
          })
        }}
      />
      <HoldDialog open={editing} onOpenChange={setEditing} editing={hold} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${hold.code}?`}
        description={
          active
            ? `This hold is still active. Deleting the record does not release ${targetCode}; it stays where it is. Release the hold with a disposition unless the record was created by mistake.`
            : 'The released hold disappears from the list. Production events that mention it stay.'
        }
        confirmLabel="Delete hold"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'qualityHolds/remove', id: hold.id })
          setDeleting(false)
          toast('Hold deleted', { tone: 'default', description: `${hold.code} removed.` })
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
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold truncate text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
