import {
  fmtAgo,
  fmtDateTime,
  fmtNumber,
  fmtTime,
  materialReadiness,
  woCompletionBlocker,
} from '@mes/fixtures'
import type { WorkOrder } from '@mes/types'
import { OPEN_WO_STATUSES, WO_EVENT_LABEL } from '@mes/types'
import { Banner, Button, Card, EmptyState, KeyValue, SegmentedTabs, cn, toast } from '@mes/ui'
import { CheckCircle2, ClipboardCheck, Pause, Play, ScanLine, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  InspectionStatusBadge,
  MachineStateBadge,
  MaintenanceStateBadge,
  RequirementBadge,
} from '../../components/badges'
import { InstructionView, checklistKeys } from '../../components/InstructionView'
import { StickyBar } from '../../components/StickyBar'
import { DetailHeader } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import {
  inspectionRequest,
  instructionFor,
  isRunning,
  isStartable,
  requirementsFor,
  startBlocker,
} from '../../lib/wo'
import { useMobileScope, useNow } from '../../state/scope'
import { CompleteSheet, ConsumeSheet, IssueSheet, OutputSheet, PauseSheet } from './sheets'
import { WoHero } from './WoHero'

type Tab = 'instructions' | 'material' | 'quality' | 'machine'
type Sheet = 'pause' | 'issue' | 'output' | 'complete' | null

export function WorkOrderPage() {
  const { id = '' } = useParams()
  const s = useMobileScope()
  const wo = s.canOpen(id) ? s.maps.wo.get(id) : undefined
  if (!wo) {
    return (
      <div className="space-y-5">
        <DetailHeader title="Work order" fallback={paths.work} />
        <Card>
          <EmptyState
            title="Not on your board"
            description="This operation is not dispatched to you or to your work centers."
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.work}>My work</Link>
              </Button>
            }
          />
        </Card>
      </div>
    )
  }
  return <Station key={wo.id} wo={wo} />
}

function Station({ wo }: { wo: WorkOrder }) {
  const s = useMobileScope()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('instructions')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [consume, setConsume] = useState<{ materialId: string; remaining: number } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  const mo = s.maps.mo.get(wo.moId)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  const instruction = instructionFor(s, wo)
  const requirements = requirementsFor(s, wo)
  const inspections = s.inspections.filter((i) => i.woId === wo.id)
  const pendingInspection = inspections.find((i) => i.status === 'pending' || i.status === 'in_progress')
  const blocker = startBlocker(s, wo)
  const completionBlocker = woCompletionBlocker(s.state, wo)
  const readiness = mo ? materialReadiness(mo.id, s.materialRequirements) : 'shortage'
  const isOpen = OPEN_WO_STATUSES.includes(wo.status) && wo.status !== 'hold'
  const running = isRunning(wo)
  const paused = wo.status === 'paused'
  const startable = isStartable(wo)
  const history = [...wo.events].reverse().slice(0, 5)

  const start = () => {
    if (blocker) {
      toast('Cannot start yet', { tone: 'danger', description: blocker })
      return
    }
    s.dispatch({ type: 'workOrders/start', id: wo.id })
    toast('Operation started', {
      tone: 'success',
      description: `${wo.code} on ${machine?.code ?? 'the line'}`,
    })
  }
  const resume = () => {
    s.dispatch({ type: 'workOrders/resume', id: wo.id })
    toast('Operation resumed', { tone: 'success' })
  }
  const requestInspection = () => {
    const action = inspectionRequest(s, wo)
    if (!action || pendingInspection) return
    s.dispatch(action)
    toast('Inspection requested', {
      tone: 'success',
      description: 'The inspector sees it in the quality queue.',
    })
    setTab('quality')
  }
  const toggleCheck = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const checklist = instruction ? checklistKeys(instruction) : []
  const ticked = checklist.filter((k) => checked.has(k)).length

  const primary = startable
    ? { label: 'Start', icon: <Play />, onClick: start, disabled: !!blocker }
    : running
      ? { label: 'Record output', icon: <CheckCircle2 />, onClick: () => setSheet('output'), disabled: false }
      : paused
        ? { label: 'Resume', icon: <Play />, onClick: resume, disabled: false }
        : null

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'instructions', label: 'Steps', count: instruction?.steps.length },
    { value: 'material', label: 'Material', count: requirements.length },
    { value: 'quality', label: 'Quality', count: inspections.length },
    { value: 'machine', label: 'Machine' },
  ]

  return (
    <div className={cn('space-y-5', primary && 'pb-28')}>
      <DetailHeader
        title={wo.code}
        mono
        subtitle={`${s.orgName(wo.workCenterId)} · ${wo.shiftId ? (s.maps.shift.get(wo.shiftId)?.name ?? 'No shift') : 'No shift'}`}
        fallback={paths.work}
      />

      <WoHero wo={wo} now={now} />

      {startable && blocker && (
        <Banner tone="warning" title="Not ready to start">
          {blocker}
        </Banner>
      )}
      {(running || paused) && completionBlocker && wo.qualityRequired && (
        <Banner tone="info" title="Quality gate">
          {completionBlocker}
        </Banner>
      )}

      <KeyValue
        items={[
          { label: 'Work center', value: s.orgName(wo.workCenterId) },
          {
            label: 'Shift',
            value: wo.shiftId ? (s.maps.shift.get(wo.shiftId)?.name ?? 'Unknown') : 'Not assigned',
          },
          {
            label: 'Planned',
            value: `${fmtDateTime(wo.plannedStart)} to ${fmtTime(wo.plannedEnd)}`,
          },
          {
            label: 'Materials',
            value: (
              <RequirementBadge
                status={readiness === 'ready' ? 'ready' : readiness === 'partial' ? 'partial' : 'shortage'}
              />
            ),
          },
          {
            label: 'Quality',
            value: wo.qualityRequired ? 'Inspection required before completion' : 'No gate',
          },
          {
            label: 'Operators',
            value: wo.operatorIds.map((id) => s.personName(id)).join(', ') || 'Unassigned',
          },
        ]}
      />

      {isOpen && (
        <div className="gap-2 flex flex-wrap">
          {startable && (
            <Button size="lg" onClick={start} disabled={!!blocker}>
              <Play />
              Start
            </Button>
          )}
          {running && (
            <Button size="lg" variant="secondary" onClick={() => setSheet('pause')}>
              <Pause />
              Pause
            </Button>
          )}
          {paused && (
            <Button size="lg" onClick={resume}>
              <Play />
              Resume
            </Button>
          )}
          {running && (
            <Button size="lg" variant="secondary" onClick={() => setSheet('output')}>
              <CheckCircle2 />
              Record output
            </Button>
          )}
          <Button size="lg" variant="card" onClick={() => setSheet('issue')}>
            <TriangleAlert />
            Report issue
          </Button>
          {(running || paused) && (
            <Button size="lg" variant="card" onClick={() => setSheet('complete')}>
              <ClipboardCheck />
              Complete
            </Button>
          )}
        </div>
      )}

      <SegmentedTabs
        items={tabs}
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="[&_[role=tab]]:h-11"
      />

      {tab === 'instructions' &&
        (instruction ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {instruction.title} · rev {instruction.rev} from the order snapshot
              {checklist.length ? ` · ${ticked} of ${checklist.length} ticked` : ''}
            </p>
            <InstructionView instruction={instruction} checked={checked} onToggle={toggleCheck} />
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              title="No instruction for this operation"
              description="The order snapshot has no work instruction here. Follow the supervisor briefing."
              action={
                <Button asChild variant="outline" className="h-11">
                  <Link to={paths.instructions()}>Browse instructions</Link>
                </Button>
              }
            />
          </Card>
        ))}

      {tab === 'material' && (
        <div className="space-y-3">
          {requirements.length === 0 ? (
            <Card>
              <EmptyState
                compact
                title="No material at this operation"
                description="Nothing from the BOM is consumed here."
              />
            </Card>
          ) : (
            requirements.map((r) => {
              const remaining = Math.max(0, r.requiredQty - r.consumedQty)
              return (
                <div key={r.id} className="p-4 rounded-[24px] bg-card shadow-card">
                  <div className="gap-2 flex items-center justify-between">
                    <span className="min-w-0 font-semibold truncate text-[15px]">
                      {s.materialName(r.materialId)}
                    </span>
                    <RequirementBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted tabular-nums">
                    {fmtNumber(r.requiredQty, 2)} {s.uomCode(r.uomId)} required ·{' '}
                    {fmtNumber(r.consumedQty, 2)} consumed · {fmtNumber(r.stagedQty + r.issuedQty, 2)} at the
                    line
                  </p>
                  {isOpen && remaining > 0 && (
                    <Button
                      variant="soft"
                      size="lg"
                      className="mt-3 w-full"
                      onClick={() => setConsume({ materialId: r.materialId, remaining })}
                    >
                      <ScanLine />
                      Consume
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'quality' && (
        <div className="space-y-3">
          {pendingInspection && (
            <Banner tone="info" title="Waiting for results">
              {pendingInspection.code}
              {pendingInspection.inspectorId
                ? ` · ${s.personName(pendingInspection.inspectorId)}`
                : ' · no inspector yet'}
            </Banner>
          )}
          {inspections.length === 0 ? (
            <Card>
              <EmptyState
                compact
                title="No inspections yet"
                description="Request one when the first pieces are ready to measure."
              />
            </Card>
          ) : (
            inspections.map((i) => (
              <Link
                key={i.id}
                to={paths.inspection(i.id)}
                className="min-h-14 gap-3 px-4 py-3 flex items-center rounded-[24px] bg-card shadow-card transition-transform active:scale-[0.98]"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold block truncate font-mono">{i.code}</span>
                  <span className="text-xs block truncate text-muted">
                    {i.measurements.length} characteristics · {s.personName(i.inspectorId)} ·{' '}
                    {fmtAgo(i.completedAt ?? i.requestedAt, now)}
                  </span>
                </span>
                <InspectionStatusBadge status={i.status} />
              </Link>
            ))
          )}
          {isOpen && !pendingInspection && !inspections.some((i) => i.status === 'passed') && (
            <Button variant="outline" size="lg" className="w-full" onClick={requestInspection}>
              <ClipboardCheck />
              {inspections.length ? 'Request reinspection' : 'Request inspection'}
            </Button>
          )}
        </div>
      )}

      {tab === 'machine' &&
        (machine ? (
          <div className="p-4 rounded-[24px] bg-card shadow-card">
            <div className="gap-2 flex flex-wrap items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold truncate text-[15px]">
                  {machine.code} · {machine.name}
                </p>
                <p className="text-sm text-muted">{machine.model}</p>
              </div>
              <div className="gap-2 flex">
                <MachineStateBadge state={machine.state} />
                <MaintenanceStateBadge state={machine.maintenanceState} />
              </div>
            </div>
            {machine.telemetry.alarm && (
              <p className="mt-3 rounded-2xl px-3 py-2 text-sm font-semibold bg-accent-soft text-accent-strong">
                Alarm: {machine.telemetry.alarm}
              </p>
            )}
            <div className="mt-3 gap-2 grid grid-cols-2">
              <Reading label="Temperature" value={machine.telemetry.temperatureC} unit="°C" digits={1} />
              <Reading label="Speed" value={machine.telemetry.speedRpm} unit="rpm" />
              <Reading label="Current" value={machine.telemetry.currentA} unit="A" digits={1} />
              <Reading label="Pressure" value={machine.telemetry.pressureBar} unit="bar" digits={1} />
              <Reading label="Vibration" value={machine.telemetry.vibrationMmS} unit="mm/s" digits={2} />
              <Reading label="Counter" value={machine.telemetry.counter} unit="pcs" />
            </div>
            <p className="mt-3 text-xs text-muted">
              Reported {fmtTime(machine.telemetry.at)} · {fmtAgo(machine.telemetry.at, now)}
            </p>
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              title="No machine assigned"
              description="The dispatcher assigns a machine before the operation starts."
            />
          </Card>
        ))}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-bold">Recent activity</h2>
          <ol className="px-4 divide-y divide-border rounded-[24px] bg-card shadow-card">
            {history.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <div className="gap-2 flex items-center justify-between">
                  <span className="font-semibold">{WO_EVENT_LABEL[e.kind]}</span>
                  <span className="text-xs shrink-0 text-muted">{fmtAgo(e.at, now)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {e.text} · {s.personName(e.by)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {primary && (
        <StickyBar note={startable && blocker ? blocker : undefined}>
          <Button size="lg" className="h-14 w-full" onClick={primary.onClick} disabled={primary.disabled}>
            {primary.icon}
            {primary.label}
          </Button>
        </StickyBar>
      )}

      <PauseSheet open={sheet === 'pause'} onOpenChange={(o) => !o && setSheet(null)} wo={wo} />
      <IssueSheet open={sheet === 'issue'} onOpenChange={(o) => !o && setSheet(null)} wo={wo} />
      <OutputSheet open={sheet === 'output'} onOpenChange={(o) => !o && setSheet(null)} wo={wo} />
      <CompleteSheet open={sheet === 'complete'} onOpenChange={(o) => !o && setSheet(null)} wo={wo} />
      {consume && (
        <ConsumeSheet
          key={consume.materialId}
          open
          onOpenChange={(o) => !o && setConsume(null)}
          wo={wo}
          materialId={consume.materialId}
          remaining={consume.remaining}
        />
      )}
    </div>
  )
}

function Reading({
  label,
  value,
  unit,
  digits = 0,
}: {
  label: string
  value: number | null
  unit: string
  digits?: number
}) {
  return (
    <div className="rounded-2xl px-3 py-2.5 bg-surface">
      <p className="font-semibold tracking-wider text-[11px] text-muted uppercase">{label}</p>
      <p className="mt-1 gap-1 flex items-start leading-none">
        <span className="text-2xl font-bold tracking-tight tabular-nums">
          {value === null ? 'n/a' : fmtNumber(value, digits)}
        </span>
        {value !== null && <span className="pt-0.5 text-xs font-semibold text-muted">{unit}</span>}
      </p>
    </div>
  )
}
