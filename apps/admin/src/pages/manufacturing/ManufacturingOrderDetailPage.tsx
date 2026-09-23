import {
  fmtAgo,
  fmtDateTime,
  fmtNumber,
  fmtPercent,
  materialReadiness,
  moActualQty,
  moCloseBlocker,
  moCompletionBlocker,
  moProgress,
} from '@mes/fixtures'
import {
  ACTIVE_WIP_STATES,
  MO_SOURCE_LABEL,
  MO_STATUS_FLOW,
  MO_STATUS_LABEL,
  VALIDATION_LABEL,
} from '@mes/types'
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  KeyValue,
  ProgressBar,
  SplitStats,
  Steps,
  type StepState,
  Textarea,
  toast,
} from '@mes/ui'
import {
  Check,
  CircleX,
  GitBranch,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Rocket,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import {
  InspectionStatusBadge,
  MoStatusBadge,
  PriorityBadge,
  ReadinessBadge,
  RequirementBadge,
  WipStateBadge,
  WoStatusBadge,
} from '../../components/badges'
import { PersonChip, paths } from '../../components/links'
import { ManufacturingOrderDialog } from '../../components/ManufacturingOrderDialog'
import { ReasonPicker } from '../../components/pickers'
import { useNow, useScoped } from '../../state/scoped'

export function ManufacturingOrderDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const mo = s.maps.mo.get(id)
  const [editing, setEditing] = useState(false)
  const [holding, setHolding] = useState(false)
  const [holdReason, setHoldReason] = useState<string | null>(null)
  const [holdNote, setHoldNote] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const wos = useMemo(
    () => s.workOrders.filter((w) => w.moId === id).sort((a, b) => a.operationSeq - b.operationSeq),
    [s.workOrders, id],
  )
  const requirements = useMemo(
    () => s.materialRequirements.filter((r) => r.moId === id),
    [s.materialRequirements, id],
  )
  const wips = useMemo(
    () => s.wips.filter((w) => w.moId === id && ACTIVE_WIP_STATES.includes(w.state) && w.qty > 0),
    [s.wips, id],
  )
  const inspections = useMemo(() => s.inspections.filter((i) => i.moId === id), [s.inspections, id])

  if (!mo) {
    return (
      <Card>
        <EmptyState
          title="Order not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/manufacturing/orders" />}
        />
      </Card>
    )
  }

  const progress = moProgress(mo, s.workOrders)
  const readiness = materialReadiness(mo.id, s.materialRequirements)
  const manage = can('mo.manage')
  const release = can('mo.release')
  const product = s.maps.product.get(mo.productId)
  const demands = mo.demandIds.map((d) => s.maps.demand.get(d)).filter((d) => !!d)
  const completeBlocker = moCompletionBlocker(s.state, mo)
  const closeBlocker = moCloseBlocker(s.state, mo)

  const act = (label: string, fn: () => void) => () => {
    fn()
    toast(label, { tone: 'success' })
  }

  const steps = MO_STATUS_FLOW.map((status) => {
    const idx = MO_STATUS_FLOW.indexOf(status)
    const cur = MO_STATUS_FLOW.indexOf(mo.status)
    const state: StepState =
      mo.status === 'cancelled' ? 'skipped' : idx < cur ? 'done' : idx === cur ? 'current' : 'upcoming'
    return { key: status, label: MO_STATUS_LABEL[status], state }
  })

  const menu = [
    manage && (mo.status === 'draft' || mo.status === 'planned')
      ? { key: 'edit', label: 'Edit planning', icon: <Pencil />, onSelect: () => setEditing(true) }
      : null,
    manage && (mo.status === 'released' || mo.status === 'in_progress')
      ? { key: 'hold', label: 'Put on hold', icon: <Pause />, onSelect: () => setHolding(true) }
      : null,
    manage && mo.status === 'in_progress' && !completeBlocker
      ? {
          key: 'complete',
          label: 'Mark completed',
          icon: <Check />,
          onSelect: act('Order completed', () =>
            s.dispatch({ type: 'manufacturingOrders/complete', id: mo.id }),
          ),
        }
      : null,
    manage && mo.status === 'completed' && !closeBlocker
      ? {
          key: 'close',
          label: 'Close order',
          icon: <Square />,
          onSelect: act('Order closed', () => s.dispatch({ type: 'manufacturingOrders/close', id: mo.id })),
        }
      : null,
    manage && mo.atRisk
      ? {
          key: 'risk',
          label: 'Clear risk flag',
          icon: <ShieldCheck />,
          onSelect: act('Risk cleared', () =>
            s.dispatch({ type: 'manufacturingOrders/setAtRisk', id: mo.id, atRisk: false, reason: '' }),
          ),
        }
      : null,
    manage && mo.status !== 'closed' && mo.status !== 'cancelled'
      ? {
          key: 'cancel',
          label: 'Cancel order',
          icon: <CircleX />,
          destructive: true,
          onSelect: () => setCancelling(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/manufacturing/orders" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && mo.status === 'draft' && (
            <Button
              variant="outline"
              onClick={act('Order planned and validated', () =>
                s.dispatch({ type: 'manufacturingOrders/plan', id: mo.id }),
              )}
            >
              <ShieldCheck />
              Plan & validate
            </Button>
          )}
          {release && (mo.status === 'draft' || mo.status === 'planned') && (
            <Button
              onClick={act('Order released', () =>
                s.dispatch({ type: 'manufacturingOrders/release', id: mo.id }),
              )}
            >
              <Rocket />
              Release
            </Button>
          )}
          {manage && mo.status === 'on_hold' && (
            <Button
              onClick={act('Hold released', () =>
                s.dispatch({ type: 'manufacturingOrders/resume', id: mo.id }),
              )}
            >
              <Play />
              Resume
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={mo.code}
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

      {manage && mo.status === 'in_progress' && completeBlocker && (
        <Card className="p-4 text-sm">
          <span className="font-semibold">Cannot complete yet:</span> {completeBlocker}
        </Card>
      )}
      {manage && mo.status === 'completed' && closeBlocker && (
        <Card className="p-4 text-sm">
          <span className="font-semibold">Before closing:</span> {closeBlocker}
        </Card>
      )}

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{mo.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{s.productName(mo.productId)}</h1>
            <p className="text-sm text-on-ink-muted">
              {product?.code} · {MO_SOURCE_LABEL[mo.source]} ·{' '}
              {mo.lineId ? s.orgName(mo.lineId) : 'line not set'}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <MoStatusBadge status={mo.status} />
            <PriorityBadge priority={mo.priority} />
            {mo.atRisk && (
              <Badge variant="accent" dot>
                At risk
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <Metric label="Finished good" value={fmtNumber(mo.goodQty)} unit={`of ${fmtNumber(mo.qty)}`} />
          <Metric label="Reject" value={fmtNumber(mo.rejectQty)} />
          <Metric label="Rework" value={fmtNumber(mo.reworkQty)} />
          <Metric label="Scrap" value={fmtNumber(mo.scrapQty)} />
        </div>
        <p className="mt-4 text-xs text-on-ink-muted">
          {fmtNumber(moActualQty(mo, s.workOrders))} good reported at the furthest operation. Finished good
          counts only output from the final operation.
        </p>
        <div className="mt-4">
          <div className="mb-1.5 text-xs flex items-center justify-between text-on-ink-muted">
            <span>
              {progress.completedOps} of {progress.totalOps} operations
            </span>
            <span>{fmtPercent(progress.ratio)}</span>
          </div>
          <div className="h-1.5 bg-white/15 overflow-hidden rounded-full">
            <div
              className="bg-white h-full rounded-full"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
        </div>
        {mo.atRisk && <p className="mt-3 rounded-2xl px-3 py-2 text-sm bg-accent/20">{mo.atRiskReason}</p>}
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
            <CardTitle>Order</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Quantity', value: `${fmtNumber(mo.qty)} ${s.uomCode(mo.uomId)}` },
                {
                  label: 'Planned',
                  value: `${fmtDateTime(mo.plannedStart)} → ${fmtDateTime(mo.plannedEnd)}`,
                },
                {
                  label: 'Actual',
                  value: mo.actualStart
                    ? `${fmtDateTime(mo.actualStart)} → ${mo.actualEnd ? fmtDateTime(mo.actualEnd) : 'running'}`
                    : 'Not started',
                },
                { label: 'Source', value: MO_SOURCE_LABEL[mo.source] },
                {
                  label: 'Demand',
                  value: demands.length
                    ? demands.map((d) => (
                        <Link
                          key={d.id}
                          to={paths.demand(d.id)}
                          className="mr-2 text-xs font-mono hover:text-accent"
                        >
                          {d.code}
                        </Link>
                      ))
                    : mo.replenishmentId
                      ? (s.maps.replenishment.get(mo.replenishmentId)?.code ?? 'Replenishment')
                      : 'Internal',
                },
                { label: 'Material', value: <ReadinessBadge readiness={readiness} /> },
                { label: 'Hold reason', value: s.reasonLabel(mo.holdReasonId), hidden: !mo.holdReasonId },
                {
                  label: 'Created',
                  value: <PersonChip personId={mo.createdBy} hint={fmtAgo(mo.createdAt, now)} />,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to={paths.genealogy(mo.id)}>
                  <GitBranch />
                  Genealogy
                </Link>
              </Button>
            }
          >
            <CardTitle>Engineering snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {mo.snapshot ? (
              <KeyValue
                bare
                items={[
                  {
                    label: 'Revision',
                    value: `${mo.snapshot.rev} · taken ${fmtDateTime(mo.snapshot.takenAt)}`,
                  },
                  {
                    label: 'BOM',
                    value: (
                      <span className="text-xs font-mono">{s.maps.bom.get(mo.snapshot.bomId)?.code}</span>
                    ),
                  },
                  {
                    label: 'BOR',
                    value: (
                      <span className="text-xs font-mono">{s.maps.bor.get(mo.snapshot.borId)?.code}</span>
                    ),
                  },
                  {
                    label: 'BOP',
                    value: (
                      <span className="text-xs font-mono">{s.maps.bop.get(mo.snapshot.bopId)?.code}</span>
                    ),
                  },
                  {
                    label: 'Specs',
                    value:
                      mo.snapshot.specIds.map((sid) => s.maps.specification.get(sid)?.code).join(', ') ||
                      'None',
                  },
                  { label: 'Instructions', value: `${mo.snapshot.workInstructionIds.length} attached` },
                ]}
              />
            ) : (
              <EmptyState
                compact
                title="No snapshot yet"
                description="The snapshot is frozen when the order is released, so a later ECO never changes running work."
              />
            )}
            {mo.validations.length > 0 && (
              <ul className="mt-4 gap-1 sm:grid-cols-2 grid grid-cols-1">
                {mo.validations.map((v) => (
                  <li
                    key={v.check}
                    className="gap-2 rounded-xl px-3 py-2 text-xs flex items-center bg-surface-2"
                  >
                    {v.ok ? (
                      <Check className="size-4 shrink-0 text-success" />
                    ) : (
                      <X className="size-4 shrink-0 text-accent" />
                    )}
                    <span className="min-w-0">
                      <span className="font-semibold block">{VALIDATION_LABEL[v.check]}</span>
                      <span className="block truncate text-muted">{v.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={`/manufacturing/dispatch?mo=${mo.id}`}>Dispatch board</Link>
            </Button>
          }
        >
          <CardTitle>Work orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {wos.length === 0 ? (
            <EmptyState
              compact
              title="No work orders yet"
              description="Releasing the order generates one work order per BOP operation."
            />
          ) : (
            wos.map((wo) => (
              <Link
                key={wo.id}
                to={paths.wo(wo.id)}
                className="gap-3 rounded-2xl p-3 sm:grid-cols-[2.5rem_1fr_auto] grid grid-cols-[2.5rem_1fr] items-center bg-surface-2 transition-colors hover:bg-surface"
              >
                <span className="size-10 rounded-xl text-xs font-bold flex items-center justify-center bg-card tabular-nums shadow-card">
                  {wo.operationSeq}
                </span>
                <span className="min-w-0">
                  <span className="text-sm font-semibold block truncate">{wo.operationName}</span>
                  <span className="text-xs block truncate text-muted">
                    {wo.code} · {s.orgName(wo.workCenterId)} ·{' '}
                    {s.maps.machine.get(wo.machineId ?? '')?.code ?? 'no machine'} ·{' '}
                    {wo.operatorIds.length ? s.personName(wo.operatorIds[0]) : 'unassigned'}
                  </span>
                  <span className="mt-1.5 gap-2 sm:hidden flex flex-wrap items-center">
                    <WoStatusBadge status={wo.status} />
                    <span className="text-xs text-muted tabular-nums">
                      {fmtNumber(wo.goodQty)} / {fmtNumber(wo.targetQty)}
                    </span>
                  </span>
                </span>
                <span className="gap-1 sm:flex hidden flex-col items-end">
                  <WoStatusBadge status={wo.status} />
                  <span className="text-xs text-muted tabular-nums">
                    {fmtNumber(wo.goodQty)} / {fmtNumber(wo.targetQty)} good
                  </span>
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to={`/inventory/requirements?mo=${mo.id}`}>Open</Link>
              </Button>
            }
          >
            <CardTitle>Material requirement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requirements.length === 0 ? (
              <EmptyState
                compact
                title="Not calculated"
                description="Requirements come from the BOM on release."
              />
            ) : (
              requirements.map((r) => {
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
                      {fmtNumber(r.requiredQty, 2)} {s.uomCode(r.uomId)} required · op {r.operationSeq} ·{' '}
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
                <Link to={`/inventory/wip?mo=${mo.id}`}>Open</Link>
              </Button>
            }
          >
            <CardTitle>WIP on the floor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wips.length === 0 ? (
              <EmptyState
                compact
                title="No active WIP"
                description="Batches appear once operations report output."
              />
            ) : (
              wips.map((w) => (
                <div key={w.id} className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block truncate">{w.code}</span>
                    <span className="text-xs block truncate text-muted">
                      Op {w.operationSeq} · {s.locationName(w.locationId)} · {fmtAgo(w.updatedAt, now)}
                    </span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{fmtNumber(w.qty)}</span>
                  <WipStateBadge state={w.state} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Quality</CardTitle>
          </CardHeader>
          <CardContent>
            {inspections.length === 0 ? (
              <EmptyState
                compact
                title="No inspections"
                description="Quality checks attach here per operation."
              />
            ) : (
              <div className="space-y-2">
                {inspections.slice(0, 6).map((i) => (
                  <Link
                    key={i.id}
                    to={paths.inspection(i.id)}
                    className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-semibold block truncate">{i.code}</span>
                      <span className="text-xs block truncate text-muted">
                        Op {i.operationSeq} · {i.trigger} · {s.personName(i.inspectorId)}
                      </span>
                    </span>
                    <InspectionStatusBadge status={i.status} />
                  </Link>
                ))}
              </div>
            )}
            <SplitStats
              className="mt-5"
              items={[
                { label: 'Passed', value: inspections.filter((i) => i.status === 'passed').length },
                { label: 'Failed', value: inspections.filter((i) => i.status === 'failed').length },
                {
                  label: 'Holds',
                  value: s.qualityHolds.filter((h) => h.moId === mo.id && h.status === 'active').length,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[...mo.events].reverse().map((e) => (
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
            ))}
          </CardContent>
        </Card>
      </div>

      <ManufacturingOrderDialog
        open={editing}
        onOpenChange={setEditing}
        editing={mo}
        onSaved={() => toast('Planning updated', { tone: 'success' })}
      />
      <ConfirmDialog
        open={holding}
        onOpenChange={setHolding}
        title={`Put ${mo.code} on hold?`}
        description="Running and ready work orders pause until the hold is released."
        confirmLabel="Put on hold"
        confirmDisabled={!holdReason}
        onConfirm={() => {
          s.dispatch({
            type: 'manufacturingOrders/hold',
            id: mo.id,
            reasonCodeId: holdReason!,
            note: holdNote,
          })
          setHolding(false)
          toast('Order on hold', { tone: 'default' })
        }}
      >
        <div className="mt-4 space-y-3">
          <FormField label="Reason" required>
            <ReasonPicker kind="hold" value={holdReason} onChange={setHoldReason} />
          </FormField>
          <FormField label="Note">
            <Textarea value={holdNote} onChange={(e) => setHoldNote(e.target.value)} className="min-h-20" />
          </FormField>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${mo.code}?`}
        description="Open work orders are cancelled with it. Consumed material stays recorded for traceability."
        confirmLabel="Cancel order"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'manufacturingOrders/cancel', id: mo.id })
          setCancelling(false)
          toast('Order cancelled', { tone: 'default' })
        }}
      />
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
