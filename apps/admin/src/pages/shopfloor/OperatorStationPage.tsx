import { fmtAgo, fmtNumber, fmtPercent, fmtTime, nowIso } from '@mes/fixtures'
import type { LoginMethod, Person, Specification, WorkOrder } from '@mes/types'
import { LOGIN_METHOD_LABEL, OPEN_WO_STATUSES, PAUSE_REASON_LABEL, ROLE_LABEL } from '@mes/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FormField,
  KeyValue,
  PageHeader,
  PillTabs,
  cn,
  toast,
} from '@mes/ui'
import {
  ArrowLeft,
  CheckCircle2,
  Delete,
  KeyRound,
  LogOut,
  Nfc,
  Pause,
  Play,
  QrCode,
  Radio,
  ScanLine,
  TriangleAlert,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import {
  InspectionStatusBadge,
  MachineStateBadge,
  MaintenanceStateBadge,
  RequirementBadge,
  WoStatusBadge,
} from '../../components/badges'
import { PersonAvatar, paths } from '../../components/links'
import { PersonPicker } from '../../components/pickers'
import { useNow, useScoped } from '../../state/scoped'
import { instructionFor, stationWorkOrders, startChecks } from '../manufacturing/wo-lib'
import { InstructionView } from './InstructionView'
import {
  CompleteDialog,
  ConsumeDialog,
  IssueDialog,
  OutputDialog,
  PauseDialog,
  completionBlocked,
} from './execution-dialogs'
import { woCompletionBlocker } from '@mes/fixtures'

const METHODS: LoginMethod[] = ['rfid', 'nfc', 'qr', 'pin']
const METHOD_ICON: Record<LoginMethod, ReactNode> = {
  rfid: <Radio />,
  nfc: <Nfc />,
  qr: <QrCode />,
  pin: <KeyRound />,
}
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

export function OperatorStationPage() {
  const s = useScoped()
  const { can, stationOperatorId: operatorId, setStationOperatorId: setOperatorId } = useAuth()
  const [params, setParams] = useSearchParams()
  const operator = operatorId ? s.maps.person.get(operatorId) : undefined
  const woId = params.get('wo')
  const wo =
    woId && operator && stationWorkOrders(s, operator.id).some((item) => item.id === woId)
      ? s.maps.wo.get(woId)
      : undefined

  const selectWo = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('wo', id)
        else p.delete('wo')
        return p
      },
      { replace: true },
    )
  const logout = () => {
    setOperatorId(null)
    selectWo(null)
  }

  return (
    <>
      <PageHeader
        title="Operator station"
        description="Log in with your badge, pick the work order and run the operation. Everything here comes from the order's frozen snapshot."
      />
      <div className="space-y-4">
        {!operator ? (
          <LoginPanel
            onLogin={(person) => {
              setOperatorId(person.id)
              const active = stationWorkOrders(s, person.id).find(
                (candidate) =>
                  candidate.operatorIds.includes(person.id) &&
                  (candidate.status === 'in_progress' || candidate.status === 'paused'),
              )
              if (active && !woId) selectWo(active.id)
              toast(`Welcome, ${person.name}`, { tone: 'success' })
            }}
          />
        ) : !wo ? (
          <ChooseWorkOrder operator={operator} onPick={selectWo} onLogout={logout} />
        ) : (
          <Station
            key={wo.id}
            wo={wo}
            operator={operator}
            onBack={() => selectWo(null)}
            onLogout={logout}
            canExecute={can('shopfloor.execute')}
          />
        )}
      </div>
    </>
  )
}

function LoginPanel({ onLogin }: { onLogin: (person: Person) => void }) {
  const s = useScoped()
  const { user } = useAuth()
  const [method, setMethod] = useState<LoginMethod>('rfid')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)

  const submitPin = () => {
    const match = s.operators.find((o) => o.badge === pin || o.badge.slice(-4) === pin)
    if (match) {
      onLogin(match)
      return
    }
    setPinError('No operator on this site has that PIN.')
    setPin('')
  }
  const press = (key: (typeof KEYS)[number]) => {
    setPinError(null)
    if (key === 'clear') setPin('')
    else if (key === 'back') setPin((p) => p.slice(0, -1))
    else if (pin.length < 8) setPin((p) => p + key)
  }
  const simulate = () => {
    const person = (picked ? s.maps.person.get(picked) : undefined) ?? user
    if (person) onLogin(person)
  }

  return (
    <Card className="max-w-3xl p-6 sm:p-8 mx-auto w-full">
      <h2 className="text-2xl font-bold tracking-tight text-center">Operator login</h2>
      <p className="mt-1 text-sm text-center text-muted">Choose how you identify yourself at this station.</p>
      <div className="mt-6 gap-3 sm:grid-cols-4 grid grid-cols-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={method === m}
            onClick={() => setMethod(m)}
            className={cn(
              'h-28 gap-2 text-sm font-semibold [&_svg]:size-7 flex flex-col items-center justify-center rounded-[24px] transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]',
              method === m ? 'bg-ink text-on-ink' : 'bg-surface-2 hover:bg-surface',
            )}
          >
            {METHOD_ICON[m]}
            {LOGIN_METHOD_LABEL[m]}
          </button>
        ))}
      </div>

      {method === 'pin' ? (
        <div className="mt-6 max-w-xs mx-auto w-full">
          <div
            className="h-14 gap-3 flex items-center justify-center"
            aria-live="polite"
            aria-label={`${pin.length} digits entered`}
          >
            {pin.length === 0 ? (
              <span className="text-sm text-muted">Enter your PIN</span>
            ) : (
              Array.from(pin).map((_, i) => <span key={i} className="size-3 rounded-full bg-ink" />)
            )}
          </div>
          <div className="gap-2 grid grid-cols-3">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={k === 'back' ? 'Delete last digit' : k === 'clear' ? 'Clear' : k}
                className="h-14 rounded-2xl text-xl font-semibold [&_svg]:size-5 flex items-center justify-center bg-surface-2 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
              >
                {k === 'back' ? <Delete /> : k === 'clear' ? <span className="text-sm">Clear</span> : k}
              </button>
            ))}
          </div>
          {pinError && <p className="mt-2 text-xs text-center text-danger">{pinError}</p>}
          <Button size="lg" className="mt-3 h-14 w-full" disabled={pin.length < 4} onClick={submitPin}>
            Log in
          </Button>
          <p className="mt-2 text-xs text-center text-muted">Your badge number or its last four digits.</p>
        </div>
      ) : (
        <div className="mt-6 max-w-sm mx-auto w-full">
          <div className="h-44 relative flex items-center justify-center overflow-hidden rounded-[24px] bg-surface-2">
            <span
              aria-hidden
              className="size-24 animate-ping absolute rounded-full border-2 border-accent/40"
            />
            <span
              aria-hidden
              className="size-36 animate-pulse absolute rounded-full border border-accent/20"
            />
            <span className="size-16 [&_svg]:size-7 relative flex items-center justify-center rounded-full bg-ink text-on-ink">
              {METHOD_ICON[method]}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-center">
            Tap your {LOGIN_METHOD_LABEL[method].toLowerCase()} on the reader
          </p>
          <FormField label="Or pick an operator to simulate" className="mt-4">
            <PersonPicker
              people={s.operators}
              value={picked}
              onChange={setPicked}
              clearable
              placeholder="Current user"
            />
          </FormField>
          <Button size="lg" className="mt-3 h-14 w-full" onClick={simulate}>
            <ScanLine />
            Simulate scan
          </Button>
        </div>
      )}
    </Card>
  )
}

function OperatorBar({
  operator,
  onLogout,
  children,
}: {
  operator: Person
  onLogout: () => void
  children?: ReactNode
}) {
  const s = useScoped()
  return (
    <div className="gap-2 flex flex-wrap items-center justify-between">
      <div className="min-w-0 gap-3 flex items-center">
        <PersonAvatar personId={operator.id} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Acting as {operator.name}</p>
          <p className="text-xs truncate text-muted">
            {ROLE_LABEL[operator.role]}
            {operator.shiftId ? ` · ${s.maps.shift.get(operator.shiftId)?.name ?? ''}` : ''}
          </p>
        </div>
      </div>
      <div className="gap-2 flex flex-wrap items-center">
        {children}
        <Button variant="ghost" size="lg" onClick={onLogout}>
          <LogOut />
          Change operator
        </Button>
      </div>
    </div>
  )
}

function ChooseWorkOrder({
  operator,
  onPick,
  onLogout,
}: {
  operator: Person
  onPick: (id: string) => void
  onLogout: () => void
}) {
  const s = useScoped()
  const wos = stationWorkOrders(s, operator.id)
  const groups = [
    {
      title: 'In progress for me',
      rows: wos.filter(
        (w) => w.operatorIds.includes(operator.id) && (w.status === 'in_progress' || w.status === 'paused'),
      ),
    },
    {
      title: 'Assigned to my shift',
      rows: wos.filter(
        (w) => w.operatorIds.includes(operator.id) && w.status !== 'in_progress' && w.status !== 'paused',
      ),
    },
    { title: 'Available at my work centers', rows: wos.filter((w) => !w.operatorIds.includes(operator.id)) },
  ]
  return (
    <>
      <OperatorBar operator={operator} onLogout={onLogout} />
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Choose work order</h2>
        <p className="text-sm text-muted">
          Continue active work first, then pick assigned or available operations.
        </p>
        {wos.length === 0 ? (
          <EmptyState
            title="No work for you right now"
            description="Ask the supervisor to dispatch a work order to you or to one of your work centers."
          />
        ) : (
          <div className="mt-4 space-y-5">
            {groups
              .filter((group) => group.rows.length > 0)
              .map((group) => (
                <section key={group.title}>
                  <h3 className="mb-2 text-sm font-semibold">
                    {group.title} <span className="text-muted">({group.rows.length})</span>
                  </h3>
                  <div className="gap-3 md:grid-cols-2 grid grid-cols-1">
                    {group.rows.map((w) => {
                      const mo = s.maps.mo.get(w.moId)
                      const blocker = startChecks(s, w).find((check) => check.blocking && !check.ok)
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => onPick(w.id)}
                          className="h-24 gap-4 px-5 flex w-full items-center rounded-[24px] bg-surface-2 text-left transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.99]"
                        >
                          <span className="size-12 rounded-2xl text-base font-bold flex shrink-0 items-center justify-center bg-card tabular-nums shadow-card">
                            {w.operationSeq}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="text-base font-semibold block truncate">{w.operationName}</span>
                            <span className="text-sm block truncate text-muted">
                              {w.code} · {mo ? s.productName(mo.productId) : ''} ·{' '}
                              {s.maps.machine.get(w.machineId ?? '')?.code ?? 'no machine'}
                            </span>
                          </span>
                          <span className="gap-1 flex shrink-0 flex-col items-end">
                            <WoStatusBadge status={w.status} />
                            <span className="text-xs text-muted tabular-nums">
                              {blocker && (w.status === 'ready' || w.status === 'assigned')
                                ? blocker.key === 'machine'
                                  ? 'Waiting for dispatch'
                                  : 'Not ready to start'
                                : `${fmtNumber(w.goodQty)} / ${fmtNumber(w.targetQty)}`}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
          </div>
        )}
      </Card>
    </>
  )
}

type Tab = 'instructions' | 'quality' | 'material' | 'machine'
type StationDialog = 'pause' | 'issue' | 'output' | 'complete' | null

function Station({
  wo,
  operator,
  onBack,
  onLogout,
  canExecute,
}: {
  wo: WorkOrder
  operator: Person
  onBack: () => void
  onLogout: () => void
  canExecute: boolean
}) {
  const s = useScoped()
  const now = useNow(30_000)
  const [tab, setTab] = useState<Tab>('instructions')
  const [dialog, setDialog] = useState<StationDialog>(null)
  const [consume, setConsume] = useState<{ materialId: string; remaining: number } | null>(null)
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  const mo = s.maps.mo.get(wo.moId)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  const ratio = wo.goodQty / Math.max(1, wo.targetQty)
  const blocked = completionBlocked(s, wo)
  const completionReason = woCompletionBlocker(s.state, wo)
  const instruction = instructionFor(s, wo)
  const inspections = s.inspections.filter((i) => i.woId === wo.id)
  const pendingInspection = inspections.find((i) => i.status === 'pending' || i.status === 'in_progress')
  const checks = startChecks(s, wo)
  const startBlockers = checks.filter((check) => check.blocking && !check.ok)
  const requirements = s.materialRequirements.filter(
    (r) => r.moId === wo.moId && r.operationSeq === wo.operationSeq,
  )

  const running = wo.status === 'in_progress'
  const paused = wo.status === 'paused'
  const startable = wo.status === 'ready' || wo.status === 'assigned'
  const isOpen = OPEN_WO_STATUSES.includes(wo.status)

  const start = () => {
    if (startBlockers.length) return
    s.dispatch({ type: 'workOrders/start', id: wo.id })
    toast('Operation started', { tone: 'success' })
  }
  const resume = () => {
    s.dispatch({ type: 'workOrders/resume', id: wo.id })
    toast('Operation resumed', { tone: 'success' })
  }
  const requestInspection = () => {
    if (!mo || pendingInspection) return
    const plan = s.inspectionPlans.find(
      (p) => p.productId === mo.productId && p.operationSeq === wo.operationSeq,
    )
    const specIds = plan ? [plan.specId] : (mo.snapshot?.specIds ?? [])
    const specs = specIds
      .map((id) => s.maps.specification.get(id))
      .filter((sp): sp is Specification => !!sp && (!!plan || sp.kind === 'quality'))
    const measurements = specs
      .flatMap((sp) => sp.characteristics)
      .filter((c) => c.operationSeq === wo.operationSeq)
      .map((c) => ({
        characteristicId: c.id,
        name: c.name,
        type: c.type,
        value: null,
        result: null,
        note: '',
        target: c.target,
        min: c.min,
        max: c.max,
        unit: c.unit,
      }))
    const wip = s.wips.find(
      (w) => w.moId === wo.moId && w.operationSeq === wo.operationSeq && w.state === 'processing',
    )
    s.dispatch({
      type: 'inspections/request',
      inspection: {
        siteId: wo.siteId,
        planId: plan?.id ?? null,
        productId: mo.productId,
        moId: mo.id,
        woId: wo.id,
        wipId: wip?.id ?? null,
        lotId: null,
        operationSeq: wo.operationSeq,
        trigger: plan?.trigger ?? 'quantity',
        sampleSize: plan?.sampleSize ?? s.settings.defaultSampleSize,
        measurements,
        inspectorId: null,
        requestedAt: nowIso(),
        photos: [],
        note: `Requested at the station by ${operator.name}`,
      },
    })
    toast('Inspection requested', {
      tone: 'success',
      description: `${measurements.length} characteristics to measure`,
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

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'instructions', label: 'Instructions', count: instruction?.steps.length },
    { value: 'quality', label: 'Quality', count: inspections.length },
    { value: 'material', label: 'Material', count: requirements.length },
    { value: 'machine', label: 'Machine' },
  ]

  return (
    <>
      <OperatorBar operator={operator} onLogout={onLogout}>
        <Button variant="outline" size="lg" onClick={onBack}>
          <ArrowLeft />
          Work orders
        </Button>
      </OperatorBar>

      <div className="gap-4 xl:grid-cols-[minmax(0,1.4fr)_1fr] grid grid-cols-1">
        <Card variant="ink" className="p-5 sm:p-6 flex flex-col">
          <div className="gap-3 flex flex-wrap items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-mono text-on-ink-muted">
                {mo?.code} · {wo.code}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {wo.operationSeq} · {wo.operationName}
              </h2>
              <p className="mt-1 text-sm text-on-ink-muted">
                {mo ? s.productName(mo.productId) : ''} · {s.orgName(wo.workCenterId)} ·{' '}
                {machine ? `${machine.code} ${machine.name}` : 'no machine'}
              </p>
            </div>
            <div className="gap-2 flex flex-wrap">
              <WoStatusBadge status={wo.status} />
              {wo.qualityRequired && <Badge variant="outline">Quality required</Badge>}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold tracking-wider text-on-ink-muted uppercase">
              Target vs output
            </p>
            <p className="mt-1 gap-2 flex flex-wrap items-end leading-none">
              <span className="text-6xl font-bold tracking-tight sm:text-7xl tabular-nums">
                {fmtNumber(wo.goodQty)}
              </span>
              <span className="pb-1 text-lg font-semibold text-on-ink-muted">
                / {fmtNumber(wo.targetQty)} good
              </span>
            </p>
            <div className="mt-3 h-1 bg-white/15 overflow-hidden rounded-full">
              <div
                className="bg-white h-full rounded-full"
                style={{ width: `${Math.round(Math.min(1, ratio) * 100)}%` }}
              />
            </div>
            <p className="mt-2 gap-x-4 text-sm flex flex-wrap text-on-ink-muted">
              <span>{fmtPercent(ratio)} of target</span>
              <span>{fmtNumber(wo.rejectQty)} reject</span>
              <span>{fmtNumber(wo.reworkQty)} rework</span>
              <span>{fmtNumber(wo.scrapQty)} scrap</span>
              {wo.actualStart && <span>started {fmtAgo(wo.actualStart, now)}</span>}
            </p>
          </div>

          {paused && wo.pauseReason && (
            <p className="mt-4 rounded-2xl px-3 py-2 text-sm bg-warning/20">
              Paused: {PAUSE_REASON_LABEL[wo.pauseReason]}
            </p>
          )}
          {wo.status === 'hold' && (
            <p className="mt-4 rounded-2xl px-3 py-2 text-sm bg-accent/20">
              On hold: {s.reasonLabel(wo.holdReasonId)}. A supervisor releases it from the dispatch board.
            </p>
          )}
          {(running || paused) && blocked && (
            <p className="mt-4 gap-2 rounded-2xl px-3 py-2 text-sm flex items-start bg-accent/20">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{completionReason}</span>
            </p>
          )}

          {startable && (
            <div className="mt-4 rounded-2xl px-4 py-3 text-sm bg-white/10">
              <p className="font-semibold">Pre-start checklist</p>
              <ul className="mt-2 space-y-1">
                {checks.map((check) => (
                  <li key={check.key} className="gap-2 flex">
                    <span aria-hidden="true">{check.ok ? '✓' : check.blocking ? '!' : 'i'}</span>
                    <span>
                      <strong>{check.label}:</strong> {check.note}
                    </span>
                  </li>
                ))}
              </ul>
              {startBlockers.length > 0 && (
                <div className="mt-3 gap-x-4 gap-y-1 font-semibold flex flex-wrap">
                  {startBlockers.some((check) => check.key === 'machine') && (
                    <Link to={`/manufacturing/dispatch?wo=${wo.id}`} className="underline">
                      Ask dispatch to assign a machine
                    </Link>
                  )}
                  {startBlockers.some((check) => check.key === 'material') && (
                    <Link to="/inventory/requirements" className="underline">
                      View material requirements
                    </Link>
                  )}
                  {startBlockers.some((check) => check.key === 'predecessor') && (
                    <Link to={paths.mo(wo.moId)} className="underline">
                      View previous operations
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {canExecute && isOpen && wo.status !== 'hold' && (
            <div className="mt-6 gap-2 flex flex-wrap">
              {startable && (
                <Button size="lg" onClick={start} disabled={startBlockers.length > 0}>
                  <Play />
                  Start
                </Button>
              )}
              {running && (
                <Button size="lg" onClick={() => setDialog('output')}>
                  <CheckCircle2 />
                  Record output
                </Button>
              )}
              {running && (
                <Button size="lg" variant="onInk" onClick={() => setDialog('pause')}>
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
              <Button size="lg" variant="onInk" onClick={() => setDialog('issue')}>
                <TriangleAlert />
                Report issue
              </Button>
              {(running || paused) && (
                <Button
                  size="lg"
                  variant="onInk"
                  disabled={blocked}
                  title={completionReason ?? undefined}
                  onClick={() => setDialog('complete')}
                >
                  <CheckCircle2 />
                  Complete operation
                </Button>
              )}
            </div>
          )}
          {!canExecute && (
            <p className="mt-6 text-sm text-on-ink-muted">
              Your role can view this station but not execute operations.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <PillTabs value={tab} onValueChange={(v) => setTab(v as Tab)} items={tabs} className="mb-4" />

          {tab === 'instructions' &&
            (instruction ? (
              <>
                <p className="mb-3 text-sm text-muted">
                  {instruction.title} · rev {instruction.rev} from the order snapshot
                </p>
                <InstructionView instruction={instruction} checked={checked} onToggle={toggleCheck} large />
              </>
            ) : (
              <EmptyState
                title="No instruction for this operation"
                description="The order snapshot has no work instruction attached here. Follow the supervisor's briefing."
              />
            ))}

          {tab === 'quality' && (
            <div className="space-y-3">
              {wo.qualityRequired && (
                <Banner tone="info" title="Quality-sensitive operation">
                  A passed inspection is required before this operation can be completed.
                </Banner>
              )}
              {pendingInspection && (
                <Banner tone="info" title="Waiting for inspector">
                  <Link to={paths.inspection(pendingInspection.id)} className="font-semibold underline">
                    Open {pendingInspection.code}
                  </Link>
                  {pendingInspection.inspectorId
                    ? ` · ${s.personName(pendingInspection.inspectorId)}`
                    : ' · No inspector assigned yet'}
                </Banner>
              )}
              {inspections.length === 0 ? (
                <EmptyState
                  compact
                  title="No inspections yet"
                  description="Request one when the first pieces are ready to measure."
                />
              ) : (
                inspections.map((i) => (
                  <Link
                    key={i.id}
                    to={paths.inspection(i.id)}
                    className="min-h-14 gap-3 rounded-2xl px-4 py-3 flex items-center bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-base font-semibold block truncate">{i.code}</span>
                      <span className="text-sm block truncate text-muted">
                        {i.measurements.length} characteristics · {s.personName(i.inspectorId)} ·{' '}
                        {fmtAgo(i.completedAt ?? i.requestedAt, now)}
                      </span>
                    </span>
                    <InspectionStatusBadge status={i.status} />
                  </Link>
                ))
              )}
              {canExecute &&
                isOpen &&
                !pendingInspection &&
                !inspections.some((i) => i.status === 'passed') && (
                  <Button variant="outline" size="lg" className="w-full" onClick={requestInspection}>
                    {inspections.length ? 'Request reinspection' : 'Request inspection'}
                  </Button>
                )}
            </div>
          )}

          {tab === 'material' && (
            <div className="space-y-3">
              {requirements.length === 0 ? (
                <EmptyState
                  compact
                  title="No material at this operation"
                  description="Nothing from the BOM is consumed here."
                />
              ) : (
                requirements.map((r) => {
                  const remaining = Math.max(0, r.requiredQty - r.consumedQty)
                  return (
                    <div key={r.id} className="rounded-2xl p-4 bg-surface-2">
                      <div className="gap-2 flex items-center justify-between">
                        <span className="min-w-0 text-base font-semibold truncate">
                          {s.materialName(r.materialId)}
                        </span>
                        <RequirementBadge status={r.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {fmtNumber(r.requiredQty, 2)} {s.uomCode(r.uomId)} required ·{' '}
                        {fmtNumber(r.consumedQty, 2)} consumed · {fmtNumber(r.stagedQty + r.issuedQty, 2)} at
                        the line
                      </p>
                      {canExecute && isOpen && remaining > 0 && (
                        <Button
                          variant="soft"
                          size="lg"
                          className="mt-3 sm:w-auto w-full"
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

          {tab === 'machine' &&
            (machine ? (
              <div>
                <div className="gap-2 flex flex-wrap items-center justify-between">
                  <div>
                    <p className="text-base font-semibold">
                      {machine.code} · {machine.name}
                    </p>
                    <p className="text-sm text-muted">{machine.model}</p>
                  </div>
                  <div className="gap-2 flex">
                    <MachineStateBadge state={machine.state} />
                    <MaintenanceStateBadge state={machine.maintenanceState} />
                  </div>
                </div>
                <KeyValue
                  bare
                  labelWidth="md"
                  className="mt-3"
                  items={[
                    {
                      label: 'Temperature',
                      value:
                        machine.telemetry.temperatureC === null
                          ? 'n/a'
                          : `${fmtNumber(machine.telemetry.temperatureC, 1)} °C`,
                    },
                    {
                      label: 'Speed',
                      value:
                        machine.telemetry.speedRpm === null
                          ? 'n/a'
                          : `${fmtNumber(machine.telemetry.speedRpm)} rpm`,
                    },
                    {
                      label: 'Current',
                      value:
                        machine.telemetry.currentA === null
                          ? 'n/a'
                          : `${fmtNumber(machine.telemetry.currentA, 1)} A`,
                    },
                    {
                      label: 'Pressure',
                      value:
                        machine.telemetry.pressureBar === null
                          ? 'n/a'
                          : `${fmtNumber(machine.telemetry.pressureBar, 1)} bar`,
                    },
                    { label: 'Counter', value: fmtNumber(machine.telemetry.counter) },
                    {
                      label: 'Alarm',
                      value: machine.telemetry.alarm ?? 'None',
                      hidden: !machine.telemetry.alarm,
                    },
                    {
                      label: 'Reported',
                      value: `${fmtTime(machine.telemetry.at)} · ${fmtAgo(machine.telemetry.at, now)}`,
                    },
                  ]}
                />
              </div>
            ) : (
              <EmptyState
                compact
                title="No machine assigned"
                description="The dispatcher assigns a machine before the operation starts."
              />
            ))}
        </Card>
      </div>

      <PauseDialog open={dialog === 'pause'} onOpenChange={(o) => !o && setDialog(null)} wo={wo} />
      <IssueDialog open={dialog === 'issue'} onOpenChange={(o) => !o && setDialog(null)} wo={wo} />
      <OutputDialog open={dialog === 'output'} onOpenChange={(o) => !o && setDialog(null)} wo={wo} />
      <CompleteDialog open={dialog === 'complete'} onOpenChange={(o) => !o && setDialog(null)} wo={wo} />
      {consume && (
        <ConsumeDialog
          key={consume.materialId}
          open
          onOpenChange={(o) => !o && setConsume(null)}
          wo={wo}
          materialId={consume.materialId}
          remaining={consume.remaining}
        />
      )}
    </>
  )
}
