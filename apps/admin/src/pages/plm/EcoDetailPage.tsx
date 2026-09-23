import { addHours, fmtDate, fmtDateTime, fromInput, nowMs, toDateTimeInput, toIso } from '@mes/fixtures'
import type { EcoDecision, ManufacturingOrder, ProductRevision } from '@mes/types'
import { ECO_STATUS_FLOW, ECO_STATUS_LABEL } from '@mes/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  Steps,
  type StepState,
  Textarea,
  toast,
} from '@mes/ui'
import { Check, Rocket, Send, X } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { EcoStatusBadge, RevisionBadge } from '../../components/badges'
import { MoLink, PersonChip, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { ECO_AFFECTS_LABEL, type EcoAffects, moImpact } from './lib'

interface DocRef {
  id: string
  code: string
  path: string
}

export function EcoDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const eco = s.maps.eco.get(id)
  const [deciding, setDeciding] = useState<EcoDecision | null>(null)
  const [note, setNote] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [effective, setEffective] = useState(() => toDateTimeInput(toIso(addHours(nowMs(), 24))))

  const impact = useMemo(
    () =>
      eco
        ? moImpact(
            s.manufacturingOrders,
            eco.productId,
            eco.effectiveFrom ?? (eco.status === 'released' ? null : fromInput(effective)),
          )
        : null,
    [s.manufacturingOrders, eco, effective],
  )

  if (!eco || !impact) {
    return (
      <Card>
        <EmptyState
          title="Change order not found"
          description="It may have been removed."
          action={<BackButton fallback="/plm/eco" />}
        />
      </Card>
    )
  }

  const from = s.maps.revision.get(eco.fromRevisionId)
  const to = eco.toRevisionId ? s.maps.revision.get(eco.toRevisionId) : undefined
  const manage = can('plm.manage')
  const approve = can('eco.approve')

  const flowIdx = ECO_STATUS_FLOW.indexOf(eco.status)
  const steps = ECO_STATUS_FLOW.map((st, idx) => {
    let state: StepState
    if (eco.status === 'rejected') state = idx <= 1 ? 'done' : 'skipped'
    else state = idx < flowIdx ? 'done' : idx === flowIdx ? 'current' : 'upcoming'
    const hint =
      st === 'released' && eco.releasedAt
        ? fmtDate(eco.releasedAt)
        : st === 'draft'
          ? fmtDate(eco.requestedAt)
          : undefined
    return { key: st, label: ECO_STATUS_LABEL[st], state, hint }
  })
  if (eco.status === 'rejected')
    steps.push({ key: 'rejected', label: ECO_STATUS_LABEL.rejected, state: 'current', hint: undefined })

  const submit = () => {
    s.dispatch({ type: 'ecos/submit', id: eco.id })
    toast('Submitted for review', { tone: 'success' })
  }
  const decide = () => {
    if (!deciding) return
    s.dispatch({ type: 'ecos/decide', id: eco.id, decision: deciding, note: note.trim() })
    toast(deciding === 'approved' ? 'ECO approved' : 'ECO rejected', {
      tone: deciding === 'approved' ? 'success' : 'danger',
    })
    setDeciding(null)
    setNote('')
  }
  const release = () => {
    s.dispatch({ type: 'ecos/release', id: eco.id, effectiveFrom: fromInput(effective) })
    toast('ECO released', {
      tone: 'success',
      description: 'A new revision is now current. Running orders keep their snapshot.',
    })
    setReleasing(false)
  }

  const ref = (
    id: string | null | undefined,
    code: string | undefined,
    path: (id: string) => string,
  ): DocRef[] => (id ? [{ id, code: code ?? id, path: path(id) }] : [])
  const docs: { key: EcoAffects; label: string; refs: DocRef[] }[] = [
    {
      key: 'bom',
      label: 'BOM',
      refs: ref(from?.bomId, from?.bomId ? s.maps.bom.get(from.bomId)?.code : undefined, paths.bom),
    },
    {
      key: 'bor',
      label: 'BOR',
      refs: ref(from?.borId, from?.borId ? s.maps.bor.get(from.borId)?.code : undefined, paths.bor),
    },
    {
      key: 'bop',
      label: 'BOP',
      refs: ref(from?.bopId, from?.bopId ? s.maps.bop.get(from.bopId)?.code : undefined, paths.bop),
    },
    {
      key: 'spec',
      label: 'Specifications',
      refs: (from?.specIds ?? []).flatMap((x) =>
        ref(x, s.maps.specification.get(x)?.code, paths.specification),
      ),
    },
    {
      key: 'work_instruction',
      label: 'Work instructions',
      refs: (from?.workInstructionIds ?? []).flatMap((x) =>
        ref(x, s.maps.workInstruction.get(x)?.code, paths.workInstruction),
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/plm/eco" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && eco.status === 'draft' && (
            <Button onClick={submit}>
              <Send />
              Submit for review
            </Button>
          )}
          {approve && eco.status === 'review' && (
            <>
              <Button variant="outline" onClick={() => setDeciding('rejected')}>
                <X />
                Reject
              </Button>
              <Button onClick={() => setDeciding('approved')}>
                <Check />
                Approve
              </Button>
            </>
          )}
          {manage && eco.status === 'approved' && (
            <Button onClick={() => setReleasing(true)}>
              <Rocket />
              Release
            </Button>
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{eco.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{eco.title}</h1>
            <p className="text-sm text-on-ink-muted">
              {s.productName(eco.productId)} · {s.productCode(eco.productId)} · from {from?.rev ?? '?'}{' '}
              {to ? `to ${to.rev}` : ''}
            </p>
          </div>
          <EcoStatusBadge status={eco.status} />
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <Metric label="Open" value={impact.open.length} />
          <Metric label="Released" value={impact.released.length} />
          <Metric label="Running" value={impact.running.length} />
          <Metric label="Future" value={impact.future.length} />
        </div>
      </Card>

      <Card className="p-5">
        <Steps steps={steps} />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Change details</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                {
                  label: 'Product',
                  value: (
                    <Link to={paths.product(eco.productId)} className="font-medium hover:text-accent">
                      {s.productName(eco.productId)}
                    </Link>
                  ),
                },
                { label: 'Reason', value: s.reasonLabel(eco.reasonCodeId) },
                {
                  label: 'Affects',
                  value: (
                    <span className="gap-1 flex flex-wrap">
                      {eco.affects.map((a) => (
                        <Badge key={a} variant="outline">
                          {ECO_AFFECTS_LABEL[a]}
                        </Badge>
                      ))}
                    </span>
                  ),
                },
                {
                  label: 'Description',
                  value: eco.description || <span className="text-muted">No description</span>,
                },
                {
                  label: 'Requested',
                  value: <PersonChip personId={eco.requestedBy} hint={fmtDateTime(eco.requestedAt)} />,
                },
                {
                  label: 'Effective from',
                  value: eco.effectiveFrom ? fmtDateTime(eco.effectiveFrom) : 'Set at release',
                },
                {
                  label: 'Released',
                  value: eco.releasedAt ? fmtDateTime(eco.releasedAt) : undefined,
                  hidden: !eco.releasedAt,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impact analysis</CardTitle>
            <p className="text-sm text-muted">What the release replaces and which orders it can reach.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="gap-1.5 sm:grid-cols-2 grid grid-cols-1">
              {docs.map((d) => {
                const affected = eco.affects.includes(d.key)
                return (
                  <li
                    key={d.key}
                    className="gap-2 rounded-xl px-3 py-2 text-xs flex items-center justify-between bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold block">{d.label}</span>
                      <span className="gap-x-2 flex flex-wrap font-mono text-muted">
                        {d.refs.length === 0
                          ? 'Not attached'
                          : d.refs.map((r) => (
                              <Link key={r.id} to={r.path} className="hover:text-accent hover:underline">
                                {r.code}
                              </Link>
                            ))}
                      </span>
                    </span>
                    {affected ? (
                      <Badge variant="accent">Affected</Badge>
                    ) : (
                      <Badge variant="muted">Unchanged</Badge>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
              <ImpactList
                title="Open"
                hint="Draft and planned: will snapshot the new revision"
                mos={impact.open}
              />
              <ImpactList title="Released" hint="Snapshot taken, not started" mos={impact.released} />
              <ImpactList title="Running" hint="In progress or on hold" mos={impact.running} />
              <ImpactList title="Future" hint="Planned start after the effective date" mos={impact.future} />
            </div>
            <Banner tone="warning" title="Running orders are not changed automatically">
              Orders keep the engineering snapshot they were released with. Cancel and recreate an order to
              move it to the new revision.
            </Banner>
          </CardContent>
        </Card>
      </div>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {eco.approvals.length === 0 ? (
              <EmptyState
                compact
                title="No decisions yet"
                description={
                  eco.status === 'review'
                    ? 'A reviewer with ECO approval rights can decide now.'
                    : 'Decisions appear here once the ECO is in review.'
                }
              />
            ) : (
              <ol className="space-y-3">
                {eco.approvals.map((a, idx) => (
                  <li key={idx} className="gap-3 rounded-2xl p-3 flex items-start bg-surface-2">
                    <span
                      className={`mt-0.5 size-6 [&_svg]:size-3.5 flex shrink-0 items-center justify-center rounded-full ${a.decision === 'approved' ? 'bg-success-soft text-success' : 'bg-danger-soft text-accent'}`}
                    >
                      {a.decision === 'approved' ? <Check /> : <X />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="gap-2 text-sm flex flex-wrap items-center">
                        <PersonChip personId={a.by} />
                        <Badge variant={a.decision === 'approved' ? 'success' : 'danger'}>
                          {a.decision === 'approved' ? 'Approved' : 'Rejected'}
                        </Badge>
                      </span>
                      <span className="mt-1 text-xs block text-muted">{fmtDateTime(a.at)}</span>
                      {a.note && <span className="mt-1 text-sm block">{a.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revision comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
              <RevisionCard title="From" revision={from} />
              <RevisionCard
                title="To"
                revision={to}
                placeholder={eco.status === 'released' ? 'Revision missing' : 'Created at release'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deciding !== null}
        onOpenChange={(open) => !open && setDeciding(null)}
        title={deciding === 'approved' ? `Approve ${eco.code}?` : `Reject ${eco.code}?`}
        description={
          deciding === 'approved'
            ? 'An approved ECO can be released with an effective date.'
            : 'The requester sees your note and can raise a new ECO.'
        }
        confirmLabel={deciding === 'approved' ? 'Approve' : 'Reject'}
        destructive={deciding === 'rejected'}
        confirmDisabled={deciding === 'rejected' && !note.trim()}
        onConfirm={decide}
      >
        <FormField label="Note" required={deciding === 'rejected'}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-20"
            placeholder={deciding === 'rejected' ? 'Why the change is not accepted' : 'Optional remark'}
          />
        </FormField>
      </ConfirmDialog>

      <ConfirmDialog
        open={releasing}
        onOpenChange={setReleasing}
        title={`Release ${eco.code}?`}
        description={`Revision ${from?.rev ?? '?'} becomes obsolete and the next revision is current from the effective date. Orders released before then keep their snapshot; running orders are never changed.`}
        confirmLabel="Release"
        confirmDisabled={!effective}
        onConfirm={release}
      >
        <FormField
          label="Effective from"
          required
          hint={`${impact.future.length} planned orders start after this date and will use the new revision.`}
        >
          <Input type="datetime-local" value={effective} onChange={(e) => setEffective(e.target.value)} />
        </FormField>
      </ConfirmDialog>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight leading-none tabular-nums">{value}</p>
    </div>
  )
}

function ImpactList({ title, hint, mos }: { title: string; hint: string; mos: ManufacturingOrder[] }) {
  return (
    <div className="rounded-2xl p-3 bg-surface-2">
      <div className="gap-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-base font-bold tabular-nums">{mos.length}</span>
      </div>
      <p className="text-[11px] text-muted">{hint}</p>
      {mos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {mos.slice(0, 4).map((m) => (
            <li key={m.id}>
              <MoLink moId={m.id} showProduct={false} />
            </li>
          ))}
          {mos.length > 4 && <li className="text-[11px] text-muted">and {mos.length - 4} more</li>}
        </ul>
      )}
    </div>
  )
}

function RevisionCard({
  title,
  revision,
  placeholder = 'None',
}: {
  title: string
  revision: ProductRevision | undefined
  placeholder?: string
}) {
  const s = useScoped()
  let body: ReactNode
  if (!revision) body = <p className="text-sm text-muted">{placeholder}</p>
  else
    body = (
      <KeyValue
        bare
        labelWidth="sm"
        items={[
          {
            label: 'Rev',
            value: (
              <span className="gap-2 inline-flex items-center">
                <span className="text-xs font-semibold font-mono">{revision.rev}</span>
                <RevisionBadge state={revision.state} />
              </span>
            ),
          },
          {
            label: 'Effective',
            value: revision.effectiveFrom
              ? `${fmtDate(revision.effectiveFrom)} → ${revision.effectiveUntil ? fmtDate(revision.effectiveUntil) : 'open'}`
              : 'Not effective',
          },
          {
            label: 'Released by',
            value: revision.releasedBy ? (
              <PersonChip
                personId={revision.releasedBy}
                hint={revision.releasedAt ? fmtDate(revision.releasedAt) : undefined}
              />
            ) : (
              'Not released'
            ),
          },
          {
            label: 'BOM',
            value: revision.bomId ? (
              <Link
                to={paths.bom(revision.bomId)}
                className="text-xs font-mono hover:text-accent hover:underline"
              >
                {s.maps.bom.get(revision.bomId)?.code ?? revision.bomId}
              </Link>
            ) : (
              <span className="text-xs font-mono">None</span>
            ),
          },
          {
            label: 'BOP',
            value: revision.bopId ? (
              <Link
                to={paths.bop(revision.bopId)}
                className="text-xs font-mono hover:text-accent hover:underline"
              >
                {s.maps.bop.get(revision.bopId)?.code ?? revision.bopId}
              </Link>
            ) : (
              <span className="text-xs font-mono">None</span>
            ),
          },
        ]}
      />
    )
  return (
    <div className="rounded-2xl px-4 py-3 bg-surface-2">
      <p className="font-semibold tracking-wider text-[11px] text-muted uppercase">{title}</p>
      {body}
    </div>
  )
}
