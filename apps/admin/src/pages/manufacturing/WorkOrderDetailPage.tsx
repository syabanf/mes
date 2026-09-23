import { fmtAgo, fmtDateTime, fmtNumber, fmtPercent } from '@mes/fixtures'
import { ACTIVE_WIP_STATES, WO_EVENT_LABEL, WO_STATUS_FLOW, WO_STATUS_LABEL } from '@mes/types'
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  KeyValue,
  ProgressBar,
  Steps,
  type StepState,
} from '@mes/ui'
import { MonitorPlay, MoreHorizontal, Play, UserPlus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import {
  InspectionStatusBadge,
  PriorityBadge,
  RequirementBadge,
  WipStateBadge,
  WoStatusBadge,
} from '../../components/badges'
import { MachineLink, PersonChip, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { ResourceChecks, useWoActions } from './wo-dialogs'
import { instructionFor, startChecks, validateAssignment } from './wo-lib'

export function WorkOrderDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const now = useNow(60_000)
  const actions = useWoActions()
  const wo = s.maps.wo.get(id)

  const related = useMemo(() => {
    if (!wo) return null
    return {
      requirements: s.materialRequirements.filter(
        (r) => r.moId === wo.moId && r.operationSeq === wo.operationSeq,
      ),
      wips: s.wips.filter(
        (w) =>
          w.moId === wo.moId &&
          w.operationSeq === wo.operationSeq &&
          ACTIVE_WIP_STATES.includes(w.state) &&
          w.qty > 0,
      ),
      inspections: s.inspections.filter((i) => i.woId === wo.id),
      instruction: instructionFor(s, wo),
      checks: validateAssignment(s, wo),
      startChecks: startChecks(s, wo),
    }
  }, [s, wo])

  if (!wo || !related) {
    return (
      <Card>
        <EmptyState
          title="Work order not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/manufacturing/work-orders" />}
        />
      </Card>
    )
  }

  const mo = s.maps.mo.get(wo.moId)
  const ratio = wo.goodQty / Math.max(1, wo.targetQty)
  const assigned = !!wo.machineId || wo.operatorIds.length > 0
  const beforeStart = wo.status === 'ready' || wo.status === 'assigned' || wo.status === 'waiting'
  const startBlockers = related.startChecks.filter((check) => check.blocking && !check.ok)
  const menu = actions.items(wo)

  const position =
    wo.status === 'paused'
      ? 'in_progress'
      : wo.status === 'hold'
        ? wo.actualStart
          ? 'in_progress'
          : wo.machineId
            ? 'assigned'
            : 'ready'
        : wo.status
  const cur = WO_STATUS_FLOW.indexOf(position)
  const steps = WO_STATUS_FLOW.map((status, idx) => {
    const state: StepState =
      wo.status === 'cancelled' ? 'skipped' : idx < cur ? 'done' : idx === cur ? 'current' : 'upcoming'
    const hint =
      idx === cur && (wo.status === 'paused' || wo.status === 'hold') ? WO_STATUS_LABEL[wo.status] : undefined
    return { key: status, label: WO_STATUS_LABEL[status], state, hint }
  })

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/manufacturing/work-orders" />
        <div className="gap-2 flex flex-wrap items-center">
          <Button asChild variant="ghost" size="sm">
            <Link to={paths.station(wo.id)}>
              <MonitorPlay />
              Open in operator station
            </Link>
          </Button>
          {actions.dispatchAllowed && wo.status === 'hold' && (
            <Button onClick={() => actions.releaseHold(wo)}>
              <Play />
              Release hold
            </Button>
          )}
          {actions.dispatchAllowed && wo.status !== 'completed' && wo.status !== 'cancelled' && (
            <Button
              variant={wo.status === 'hold' ? 'outline' : 'primary'}
              onClick={() => actions.open('assign', wo)}
            >
              <UserPlus />
              {assigned ? 'Reassign' : 'Assign'}
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={wo.code}
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

      {beforeStart && (
        <Card className="p-4">
          <div>
            <p className="text-sm font-semibold">
              {startBlockers.length ? 'Before this can start' : 'Ready for the operator'}
            </p>
            {startBlockers.length ? (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {startBlockers.map((check) => (
                  <li key={check.key}>• {check.note}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Open the operator station to begin.</p>
            )}
          </div>
        </Card>
      )}

      <Card variant="ink" className="p-5">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{wo.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {wo.operationSeq} · {wo.operationName}
            </h1>
            <p className="mt-1 gap-x-2 text-sm flex flex-wrap items-center text-on-ink-muted">
              {mo && (
                <Link
                  to={paths.mo(mo.id)}
                  className="text-xs font-semibold font-mono text-on-ink hover:text-accent"
                >
                  {mo.code}
                </Link>
              )}
              {mo && <span>{s.productName(mo.productId)}</span>}
              <span>· {s.orgName(wo.workCenterId)}</span>
              <span>· {s.maps.machine.get(wo.machineId ?? '')?.code ?? 'no machine'}</span>
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <WoStatusBadge status={wo.status} />
            <PriorityBadge priority={wo.priority} />
            {wo.qualityRequired && <Badge variant="outline">Quality required</Badge>}
          </div>
        </div>
        {!beforeStart && (
          <div className="mt-5 gap-4 sm:grid-cols-5 grid grid-cols-2">
            <Metric label="Output" value={fmtNumber(wo.outputQty)} />
            <Metric label="Good" value={fmtNumber(wo.goodQty)} unit={`of ${fmtNumber(wo.targetQty)}`} />
            <Metric label="Reject" value={fmtNumber(wo.rejectQty)} />
            <Metric label="Rework" value={fmtNumber(wo.reworkQty)} />
            <Metric label="Scrap" value={fmtNumber(wo.scrapQty)} />
          </div>
        )}
        {beforeStart && (
          <p className="mt-4 text-sm text-on-ink-muted">
            Target {fmtNumber(wo.targetQty)} · Planned {fmtDateTime(wo.plannedStart)} →{' '}
            {fmtDateTime(wo.plannedEnd)}
          </p>
        )}
        {!beforeStart && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs flex items-center justify-between text-on-ink-muted">
              <span>
                {wo.actualStart
                  ? `Started ${fmtAgo(wo.actualStart, now)}`
                  : `Planned ${fmtDateTime(wo.plannedStart)}`}
                {wo.pauseReason ? ` · paused: ${wo.pauseReason}` : ''}
                {wo.holdReasonId ? ` · hold: ${s.reasonLabel(wo.holdReasonId)}` : ''}
              </span>
              <span>{fmtPercent(ratio)}</span>
            </div>
            <ProgressBar value={ratio} tone="white" aria-label={`${Math.round(ratio * 100)}% of target`} />
          </div>
        )}
      </Card>

      <Card className="p-5">
        <Steps steps={steps} />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Resource validation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceChecks checks={related.checks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              actions.dispatchAllowed && wo.status !== 'completed' && wo.status !== 'cancelled' ? (
                <Button variant="outline" size="sm" onClick={() => actions.open('assign', wo)}>
                  {assigned ? 'Reassign' : 'Assign'}
                </Button>
              ) : undefined
            }
          >
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Machine', value: <MachineLink machineId={wo.machineId} /> },
                {
                  label: 'Operators',
                  value: wo.operatorIds.length ? (
                    <div className="gap-1 flex flex-col">
                      {wo.operatorIds.map((pid) => (
                        <PersonChip
                          key={pid}
                          personId={pid}
                          hint={s.maps.person.get(pid)?.availability.replace('_', ' ')}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">Unassigned</span>
                  ),
                },
                {
                  label: 'Shift',
                  value: wo.shiftId ? (
                    (s.maps.shift.get(wo.shiftId)?.name ?? 'Shift')
                  ) : (
                    <span className="text-muted">Not set</span>
                  ),
                },
                {
                  label: 'Tools',
                  value: wo.toolIds.length ? (
                    wo.toolIds.map((t) => s.maps.resource.get(t)?.code ?? t).join(', ')
                  ) : (
                    <span className="text-muted">None</span>
                  ),
                },
                {
                  label: 'Molds',
                  value: wo.moldIds.length ? (
                    wo.moldIds.map((t) => s.maps.resource.get(t)?.code ?? t).join(', ')
                  ) : (
                    <span className="text-muted">None</span>
                  ),
                },
                {
                  label: 'Planned',
                  value: `${fmtDateTime(wo.plannedStart)} → ${fmtDateTime(wo.plannedEnd)}`,
                },
                {
                  label: 'Actual',
                  value: wo.actualStart
                    ? `${fmtDateTime(wo.actualStart)} → ${wo.actualEnd ? fmtDateTime(wo.actualEnd) : 'running'}`
                    : 'Not started',
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to={`/inventory/requirements?mo=${wo.moId}`}>Open</Link>
              </Button>
            }
          >
            <CardTitle>Material at this operation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {related.requirements.length === 0 ? (
              <EmptyState
                compact
                title="No material consumed here"
                description="Requirements come from the BOM lines that consume at this operation."
              />
            ) : (
              related.requirements.map((r) => {
                const covered =
                  (r.reservedQty + r.stagedQty + r.issuedQty + r.consumedQty) / Math.max(1, r.requiredQty)
                return (
                  <div key={r.id} className="rounded-2xl p-3 bg-surface-2">
                    <div className="gap-2 flex items-center justify-between">
                      <span className="min-w-0 text-sm font-semibold truncate">
                        {s.materialName(r.materialId)}
                      </span>
                      <RequirementBadge status={r.status} />
                    </div>
                    <ProgressBar
                      value={covered}
                      tone={r.status === 'shortage' ? 'accent' : 'ink'}
                      className="mt-2"
                      aria-label={`${Math.round(covered * 100)}% covered`}
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      {fmtNumber(r.requiredQty, 2)} {s.uomCode(r.uomId)} required ·{' '}
                      {fmtNumber(r.consumedQty, 2)} consumed
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to={`/inventory/wip?mo=${wo.moId}`}>Open</Link>
              </Button>
            }
          >
            <CardTitle>WIP at this operation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {related.wips.length === 0 ? (
              <EmptyState
                compact
                title="No WIP here"
                description="Batches queue at this operation once the predecessor reports good output."
              />
            ) : (
              related.wips.map((w) => (
                <Link
                  key={w.id}
                  to={paths.wip(w.id)}
                  className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{w.code}</span>
                    <span className="text-xs block truncate text-muted">
                      {s.locationName(w.locationId)} · {fmtAgo(w.updatedAt, now)}
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{fmtNumber(w.qty)}</span>
                  <WipStateBadge state={w.state} />
                </Link>
              ))
            )}
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
                title="No inspections yet"
                description={
                  wo.qualityRequired
                    ? 'This operation needs a passed inspection before it can complete.'
                    : 'Requests appear here when an inspection is raised for this work order.'
                }
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
                      {i.trigger} · {s.personName(i.inspectorId)} ·{' '}
                      {fmtAgo(i.completedAt ?? i.requestedAt, now)}
                    </span>
                  </span>
                  <InspectionStatusBadge status={i.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              related.instruction ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/shopfloor/instructions?wi=${related.instruction.id}`}>Open</Link>
                </Button>
              ) : undefined
            }
          >
            <CardTitle>Work instruction</CardTitle>
          </CardHeader>
          <CardContent>
            {related.instruction ? (
              <div className="rounded-2xl p-3 bg-surface-2">
                <p className="text-sm font-semibold">{related.instruction.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {related.instruction.code} · rev {related.instruction.rev} ·{' '}
                  {related.instruction.steps.length} steps
                </p>
                <ol className="mt-2 space-y-1 text-xs text-muted">
                  {related.instruction.steps.slice(0, 4).map((st, i) => (
                    <li key={st.id} className="truncate">
                      {i + 1}. {st.title}
                    </li>
                  ))}
                  {related.instruction.steps.length > 4 && (
                    <li>+{related.instruction.steps.length - 4} more</li>
                  )}
                </ol>
              </div>
            ) : (
              <EmptyState
                compact
                title="No instruction attached"
                description="Attach one to the operation in PLM. Running orders keep the revision from their snapshot."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {wo.events.length === 0 ? (
            <EmptyState compact title="No events yet" />
          ) : (
            [...wo.events].reverse().map((e) => (
              <div key={e.id} className="gap-3 rounded-2xl px-3 py-2 flex items-start hover:bg-surface-2">
                <span className="w-16 pt-0.5 text-xs shrink-0 text-muted tabular-nums">
                  {fmtAgo(e.at, now)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm block">
                    <span className="font-semibold">{WO_EVENT_LABEL[e.kind]}</span>
                    {e.qty !== null && (
                      <span className="ml-1 text-muted tabular-nums">× {fmtNumber(e.qty)}</span>
                    )}
                  </span>
                  <span className="text-xs block text-muted">
                    {e.text} · {s.personName(e.by)}
                  </span>
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {actions.dialogs}
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
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
