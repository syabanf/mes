import { HOUR, fmtAgo, fmtNumber, fmtTime, fmtWhen, toMs } from '@mes/fixtures'
import type { TelemetryPoint } from '@mes/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type Column,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Input,
  LineChart,
  PageHeader,
  PillTabs,
  cn,
  toast,
} from '@mes/ui'
import { BellOff, Siren, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { MachineStateBadge } from '../../components/badges'
import { WoLink } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { SIGNALS, type SignalKey, byTime, currentWo, woSegments } from './lib'
import { MachineCard } from './MachineCard'

export function DeviceMonitoringPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(30_000)
  const [params, setParams] = useSearchParams()
  const [signal, setSignal] = useState<SignalKey>('temperatureC')
  const [alarmOpen, setAlarmOpen] = useState(false)
  const [alarmText, setAlarmText] = useState('Spindle temperature above limit')
  const [cmmsOpen, setCmmsOpen] = useState(false)
  const [cmmsTitle, setCmmsTitle] = useState('')

  const machines = useMemo(
    () =>
      [...s.machines]
        .filter((m) => m.active)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [s.machines],
  )
  const requested = params.get('machine')
  const machine =
    machines.find((m) => m.id === requested) ??
    machines.find((m) => m.state === 'down') ??
    machines.find((m) => m.state === 'running') ??
    machines[0]
  const select = (id: string) =>
    setParams(
      (p) => {
        p.set('machine', id)
        return p
      },
      { replace: true },
    )

  const points = useMemo(
    () => (machine ? s.telemetry.filter((t) => t.machineId === machine.id).sort(byTime) : []),
    [s.telemetry, machine],
  )
  const recent = useMemo(() => points.filter((p) => toMs(p.at) >= now - 12 * HOUR), [points, now])
  const segments = useMemo(() => woSegments(recent), [recent])
  const wo = machine ? currentWo(s.workOrders, machine.id) : undefined
  const mo = wo ? s.maps.mo.get(wo.moId) : undefined
  const manage = can('integration.manage')
  const sig = SIGNALS.find((x) => x.key === signal)!

  const columns: Column<TelemetryPoint>[] = [
    {
      id: 'at',
      header: 'Time',
      sortValue: (p) => p.at,
      cell: (p) => <span className="text-xs tabular-nums">{fmtWhen(p.at, now)}</span>,
    },
    { id: 'state', header: 'State', cell: (p) => <MachineStateBadge state={p.state} /> },
    { id: 'temp', header: '°C', align: 'right', hideBelow: 'sm', cell: (p) => num(p.temperatureC, 0) },
    { id: 'speed', header: 'RPM', align: 'right', hideBelow: 'sm', cell: (p) => num(p.speedRpm, 0) },
    { id: 'current', header: 'A', align: 'right', hideBelow: 'md', cell: (p) => num(p.currentA, 1) },
    { id: 'pressure', header: 'bar', align: 'right', hideBelow: 'lg', cell: (p) => num(p.pressureBar, 1) },
    { id: 'vib', header: 'mm/s', align: 'right', hideBelow: 'lg', cell: (p) => num(p.vibrationMmS, 2) },
    {
      id: 'counter',
      header: 'Counter',
      align: 'right',
      hideBelow: 'md',
      sortValue: (p) => p.counter,
      cell: (p) => <span className="tabular-nums">{fmtNumber(p.counter)}</span>,
    },
    {
      id: 'alarm',
      header: 'Alarm',
      hideBelow: 'xl',
      cell: (p) =>
        p.alarm ? (
          <span className="text-xs font-semibold text-accent">{p.alarm}</span>
        ) : (
          <span className="text-muted">–</span>
        ),
    },
    {
      id: 'wo',
      header: 'WO',
      hideBelow: 'sm',
      cell: (p) => (p.woId ? <WoLink woId={p.woId} /> : <span className="text-muted">Idle</span>),
    },
  ]

  return (
    <>
      <PageHeader
        title="Device monitoring"
        description="Machine telemetry from Device Monitoring, shown with the MO, WO, product and operation MES was running at the time."
      />
      <div className="space-y-4">
        <Banner tone="neutral" title="Device Monitoring owns the signals; MES provides the context">
          State, alarms, temperature, pressure, current, vibration, speed and counters come from the devices.
          MES attaches MO, WO, product, operation, operator, batch and WIP so any historical point maps onto a
          production run.
        </Banner>

        {!machine ? (
          <Card>
            <EmptyState
              title="No machines"
              description="Add machines under Master data › Resources to see telemetry."
            />
          </Card>
        ) : (
          <div className="gap-4 xl:grid-cols-[20rem_minmax(0,1fr)] grid grid-cols-1">
            <div className="space-y-2">
              {machines.map((m) => (
                <MachineCard
                  key={m.id}
                  machine={m}
                  active={m.id === machine.id}
                  points={s.telemetry.filter((t) => t.machineId === m.id)}
                  onSelect={() => select(m.id)}
                />
              ))}
            </div>

            <div className="space-y-4">
              <Card variant="ink" className="p-5">
                <div className="gap-3 flex flex-wrap items-start justify-between">
                  <div>
                    <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">
                      Combined context
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">Machine {machine.code}</h2>
                    <p className="text-sm text-on-ink-muted">
                      {machine.name} · {s.orgName(machine.workCenterId)} · updated{' '}
                      {fmtAgo(machine.telemetry.at, now)}
                    </p>
                  </div>
                  <div className="gap-2 flex flex-wrap">
                    <MachineStateBadge state={machine.state} />
                    {machine.telemetry.alarm && (
                      <Badge variant="accent" dot>
                        {machine.telemetry.alarm}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
                  <Ctx label="MO" value={mo?.code ?? '–'} mono />
                  <Ctx label="WO" value={wo?.code ?? '–'} mono />
                  <Ctx label="Product" value={mo ? s.productName(mo.productId) : 'Idle'} />
                  <Ctx label="Operation" value={wo ? wo.operationName : '–'} />
                </div>
                <div className="mt-5 gap-4 sm:grid-cols-3 lg:grid-cols-6 grid grid-cols-2">
                  <Ctx
                    label="Temperature"
                    value={fmtSignal(machine.telemetry.temperatureC, 0)}
                    unit="°C"
                    big
                  />
                  <Ctx label="Speed" value={fmtSignal(machine.telemetry.speedRpm, 0)} unit="RPM" big />
                  <Ctx label="Current" value={fmtSignal(machine.telemetry.currentA, 1)} unit="A" big />
                  <Ctx label="Pressure" value={fmtSignal(machine.telemetry.pressureBar, 1)} unit="bar" big />
                  <Ctx
                    label="Vibration"
                    value={fmtSignal(machine.telemetry.vibrationMmS, 2)}
                    unit="mm/s"
                    big
                  />
                  <Ctx label="Counter" value={fmtNumber(machine.telemetry.counter)} unit="pcs" big />
                </div>
                {manage && (
                  <div className="mt-5 gap-2 flex flex-wrap">
                    <Button
                      variant="onInk"
                      size="sm"
                      disabled={machine.state === 'down'}
                      onClick={() => setAlarmOpen(true)}
                    >
                      <Siren />
                      Simulate alarm
                    </Button>
                    <Button
                      variant="onInk"
                      size="sm"
                      disabled={machine.maintenanceState === 'in_maintenance'}
                      onClick={() => {
                        setCmmsTitle(
                          machine.telemetry.alarm
                            ? `Investigate: ${machine.telemetry.alarm}`
                            : `Inspection requested for ${machine.code}`,
                        )
                        setCmmsOpen(true)
                      }}
                    >
                      <Wrench />
                      Raise CMMS request
                    </Button>
                    <Button
                      variant="onInk"
                      size="sm"
                      disabled={!machine.telemetry.alarm && machine.state !== 'down'}
                      onClick={() => {
                        s.dispatch({ type: 'machines/setState', id: machine.id, state: 'idle', alarm: null })
                        toast(`${machine.code} alarm cleared`, { tone: 'success' })
                      }}
                    >
                      <BellOff />
                      Clear alarm
                    </Button>
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader
                  action={
                    <PillTabs
                      size="sm"
                      value={signal}
                      onValueChange={(v) => setSignal(v as SignalKey)}
                      items={SIGNALS.map((x) => ({ value: x.key, label: x.label }))}
                    />
                  }
                >
                  <CardTitle>Last 12 hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <LineChart
                    data={recent.map((p) => ({ label: fmtTime(p.at), value: p[signal] }))}
                    format={(v) => `${fmtNumber(v, sig.digits)} ${sig.unit}`}
                    area
                    tone={machine.state === 'down' ? 'accent' : 'ink'}
                    ariaLabel={`${sig.label} of ${machine.code} over the last 12 hours`}
                  />
                  <div className="mt-3 gap-1.5 flex flex-wrap items-center">
                    <span className="font-semibold tracking-wider text-[11px] text-muted uppercase">
                      Production runs
                    </span>
                    {segments.length === 0 && (
                      <span className="text-xs text-muted">No telemetry in the window.</span>
                    )}
                    {segments.map((seg, i) => (
                      <span
                        key={`${seg.woId}-${i}`}
                        className={cn(
                          'gap-1.5 px-2.5 py-0.5 text-xs inline-flex items-center rounded-full',
                          seg.woId ? 'bg-ink text-on-ink' : 'bg-surface text-muted',
                        )}
                      >
                        {seg.woId ? <WoLink woId={seg.woId} className="text-on-ink" /> : 'Idle'}
                        <span className={seg.woId ? 'text-on-ink-muted' : ''}>
                          {fmtTime(seg.from)}–{fmtTime(seg.to)} · {seg.count} pts
                        </span>
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Telemetry points</CardTitle>
                </CardHeader>
                <DataTable
                  columns={columns}
                  rows={[...points].reverse()}
                  getRowKey={(p) => p.id}
                  pageSize={10}
                  resetPageKey={machine.id}
                  empty={
                    <EmptyState
                      compact
                      title="No telemetry"
                      description="Points appear once Device Monitoring streams this machine."
                    />
                  }
                />
              </Card>
            </div>
          </div>
        )}
      </div>

      {machine && (
        <>
          <ConfirmDialog
            open={alarmOpen}
            onOpenChange={setAlarmOpen}
            title={`Simulate an alarm on ${machine.code}?`}
            description="Device Monitoring sets the machine down. MES pauses the running work order and flags its order at risk."
            confirmLabel="Trigger alarm"
            destructive
            confirmDisabled={!alarmText.trim()}
            onConfirm={() => {
              s.dispatch({
                type: 'machines/setState',
                id: machine.id,
                state: 'down',
                alarm: alarmText.trim(),
              })
              setAlarmOpen(false)
              toast(`${machine.code} down`, { tone: 'danger', description: alarmText.trim() })
            }}
          >
            <FormField label="Alarm text" required>
              <Input value={alarmText} onChange={(e) => setAlarmText(e.target.value)} />
            </FormField>
          </ConfirmDialog>
          <ConfirmDialog
            open={cmmsOpen}
            onOpenChange={setCmmsOpen}
            title={`Raise a CMMS work request for ${machine.code}?`}
            description="The machine becomes unavailable for assignment until the CMMS completes the work."
            confirmLabel="Raise request"
            confirmDisabled={!cmmsTitle.trim()}
            onConfirm={() => {
              s.dispatch({
                type: 'maintenance/request',
                machineId: machine.id,
                title: cmmsTitle.trim(),
                alarm: machine.telemetry.alarm,
              })
              setCmmsOpen(false)
              toast('CMMS work request raised', { tone: 'success', description: cmmsTitle.trim() })
            }}
          >
            <FormField label="Request title" required>
              <Input value={cmmsTitle} onChange={(e) => setCmmsTitle(e.target.value)} />
            </FormField>
          </ConfirmDialog>
        </>
      )}
    </>
  )
}

function Ctx({
  label,
  value,
  unit,
  mono = false,
  big = false,
}: {
  label: string
  value: string
  unit?: string
  mono?: boolean
  big?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p
        className={cn(
          'mt-1 gap-1 flex items-end leading-none',
          big ? 'text-2xl font-bold tabular-nums' : cn('text-sm font-semibold truncate', mono && 'font-mono'),
        )}
      >
        <span className="truncate">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}

const fmtSignal = (v: number | null, digits: number) => (v === null ? '–' : fmtNumber(v, digits))
const num = (v: number | null, digits: number) => (
  <span className={cn('tabular-nums', v === null && 'text-muted')}>{fmtSignal(v, digits)}</span>
)
