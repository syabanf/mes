import {
  type AppAction,
  RECOMMENDATION_KINDS,
  RECOMMENDATION_KIND_LABEL,
  type Recommendation,
  type RecommendationKind,
  fmtWhen,
  nowIso,
  recommendations,
} from '@mes/fixtures'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Chip,
  ChipRow,
  ConfirmDialog,
  EmptyState,
  FormField,
  PageHeader,
  StatCard,
  Textarea,
  toast,
} from '@mes/ui'
import { Check, CircleCheck, CircleSlash, ShieldAlert, Sparkles, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { PersonChip } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { usePersistentState } from '../../lib/storage'
import { useNow, useScoped } from '../../state/scoped'
import { DECISIONS_KEY, type Decision, evidencePath } from './lib'

const KIND_VARIANT: Record<RecommendationKind, 'ink' | 'info' | 'warning' | 'danger' | 'default' | 'accent'> =
  {
    reschedule: 'ink',
    reassign: 'info',
    maintenance_aware: 'warning',
    quality_routing: 'danger',
    material_priority: 'default',
    bottleneck: 'accent',
  }

export function OptimizationPage() {
  const s = useScoped()
  const { user, can } = useAuth()
  const now = useNow(60_000)
  const [decisions, setDecisions] = usePersistentState<Decision[]>(DECISIONS_KEY, [])
  const [kind, setKind] = useHistoryState<RecommendationKind | null>('kind', null)
  const [confirming, setConfirming] = useState<Recommendation | null>(null)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)

  const all = useMemo(() => recommendations(s, now), [s, now])
  const decided = useMemo(() => new Map(decisions.map((d) => [d.id, d])), [decisions])
  const open = useMemo(() => all.filter((r) => !decided.has(r.id)), [all, decided])
  const visible = kind ? open.filter((r) => r.kind === kind) : open

  const allowed = (action: AppAction) =>
    action.type.startsWith('workOrders/') ? can('wo.dispatch') : can('mo.manage')

  const record = (rec: Recommendation, decision: Decision['decision'], why: string) =>
    setDecisions((prev) => [
      {
        id: rec.id,
        kind: rec.kind,
        title: rec.title,
        decision,
        by: user?.id ?? 'system',
        at: nowIso(),
        reason: why,
      },
      ...prev.filter((d) => d.id !== rec.id),
    ])

  const apply = (rec: Recommendation, why: string) => {
    if (!rec.action) return
    s.dispatch(rec.action)
    record(rec, 'applied', why)
    toast(`Applied: ${rec.title}`, { tone: 'success' })
  }

  const dismiss = (rec: Recommendation) => {
    record(rec, 'dismissed', '')
    toast('Recommendation dismissed')
  }

  const restore = (id: string) => setDecisions((prev) => prev.filter((d) => d.id !== id))

  const confirmApply = () => {
    if (!confirming) return
    if (!reason.trim()) {
      setTried(true)
      return
    }
    apply(confirming, reason.trim())
    setConfirming(null)
    setReason('')
    setTried(false)
  }

  const applied = decisions.filter((d) => d.decision === 'applied').length
  const dismissed = decisions.filter((d) => d.decision === 'dismissed').length
  const highImpact = open.filter((r) => r.highImpact).length

  return (
    <>
      <PageHeader
        title="Optimization"
        description="Recommendations built from the current schedule, machines, material and quality record. Apply the ones you agree with; the store records who decided."
      />
      <div className="space-y-4">
        <Banner tone="info" icon={<ShieldAlert />} title="Guardrail">
          The platform recommends; a person authorizes every high-impact change. High-impact actions ask for a
          reason before they run.
        </Banner>

        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Open"
            value={open.length}
            icon={<Sparkles />}
            tone={open.length ? 'ink' : 'success'}
          />
          <StatCard
            label="Applied"
            value={applied}
            icon={<CircleCheck />}
            tone="success"
            hint="By anyone on this device"
          />
          <StatCard label="Dismissed" value={dismissed} icon={<CircleSlash />} />
          <StatCard
            label="High impact"
            value={highImpact}
            icon={<ShieldAlert />}
            tone={highImpact ? 'danger' : 'default'}
            hint="Need a reason to apply"
          />
        </div>

        <ChipRow>
          <Chip variant="filter" active={kind === null} count={open.length} onClick={() => setKind(null)}>
            All
          </Chip>
          {RECOMMENDATION_KINDS.map((k) => (
            <Chip
              key={k}
              variant="filter"
              active={kind === k}
              count={open.filter((r) => r.kind === k).length}
              onClick={() => setKind(kind === k ? null : k)}
            >
              {RECOMMENDATION_KIND_LABEL[k]}
            </Chip>
          ))}
        </ChipRow>

        {visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Sparkles />}
              title={open.length ? 'Nothing of this kind' : 'No open recommendations'}
              description={
                open.length
                  ? 'Pick another kind or clear the filter.'
                  : 'Recommendations appear when maintenance, overlaps, shortages, quality or capacity threaten the plan.'
              }
              action={
                dismissed ? (
                  <Button
                    variant="outline"
                    onClick={() => setDecisions((prev) => prev.filter((d) => d.decision !== 'dismissed'))}
                  >
                    <Undo2 />
                    Restore dismissed
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="gap-4 md:grid-cols-2 grid grid-cols-1">
            {visible.map((rec) => (
              <Card key={rec.id} className="p-5 flex flex-col">
                <div className="gap-2 flex flex-wrap items-center">
                  <Badge variant={KIND_VARIANT[rec.kind]}>{RECOMMENDATION_KIND_LABEL[rec.kind]}</Badge>
                  {rec.highImpact && (
                    <Badge variant="danger" dot>
                      High impact
                    </Badge>
                  )}
                </div>
                <h3 className="mt-3 text-base font-semibold leading-snug">{rec.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{rec.rationale}</p>
                <div className="mt-3 gap-1.5 flex flex-wrap">
                  {rec.evidence.map((e, i) => (
                    <Link
                      key={`${e.kind}-${e.id}-${i}`}
                      to={evidencePath(e)}
                      className="h-7 px-2.5 text-xs font-medium inline-flex items-center rounded-full bg-surface-2 transition-colors hover:bg-surface hover:text-accent"
                    >
                      {e.label}
                    </Link>
                  ))}
                </div>
                <p className="mt-3 rounded-2xl px-3 py-2 text-sm bg-surface-2">
                  <span className="font-semibold">Impact</span> {rec.impact}
                </p>
                <div className="gap-2 pt-4 mt-auto flex flex-wrap items-center justify-end">
                  <Button variant="outline" size="sm" onClick={() => dismiss(rec)}>
                    <X />
                    Dismiss
                  </Button>
                  {rec.action ? (
                    <Button
                      size="sm"
                      disabled={!allowed(rec.action)}
                      onClick={() => (rec.highImpact ? setConfirming(rec) : apply(rec, ''))}
                    >
                      <Check />
                      Apply
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">Evidence only</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Decision log</CardTitle>
            <p className="mt-0.5 text-xs text-muted">
              Who applied or dismissed each recommendation, and why.
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            {decisions.length === 0 ? (
              <EmptyState
                compact
                title="No decisions yet"
                description="Applied and dismissed recommendations are listed here."
              />
            ) : (
              decisions.slice(0, 20).map((d) => (
                <div key={d.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                  <span className="pt-0.5 shrink-0">
                    {d.decision === 'applied' ? (
                      <Badge variant="success">Applied</Badge>
                    ) : (
                      <Badge variant="muted">Dismissed</Badge>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium block truncate">{d.title}</span>
                    <span className="text-xs block text-muted">
                      {RECOMMENDATION_KIND_LABEL[d.kind]} · {fmtWhen(d.at, now)}
                      {d.reason ? ` · ${d.reason}` : ''}
                    </span>
                    <span className="mt-1 text-xs block">
                      <PersonChip personId={d.by} />
                    </span>
                  </span>
                  {d.decision === 'dismissed' && (
                    <Button variant="ghost" size="sm" onClick={() => restore(d.id)} aria-label="Restore">
                      <Undo2 />
                      Restore
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(o) => {
          if (!o) {
            setConfirming(null)
            setReason('')
            setTried(false)
          }
        }}
        title="Authorize a high-impact change"
        description={confirming ? `${confirming.title}. ${confirming.impact}` : undefined}
        confirmLabel="Apply"
        onConfirm={confirmApply}
      >
        <FormField
          label="Reason"
          required
          error={tried && !reason.trim() ? 'Give a reason for the log.' : undefined}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change is the right call now"
            rows={3}
          />
        </FormField>
      </ConfirmDialog>
    </>
  )
}
