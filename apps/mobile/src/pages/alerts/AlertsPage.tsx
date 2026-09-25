import { fmtAgo } from '@mes/fixtures'
import type { Machine, QualityHold, WorkOrder } from '@mes/types'
import { HOLD_TARGET_LABEL, PAUSE_REASON_LABEL } from '@mes/types'
import { Button, Card, EmptyState, IconTile, type Tone } from '@mes/ui'
import { BellOff, Pause, Siren, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusText } from '../../components/badges'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { useMobileScope, useNow } from '../../state/scope'

/** Holds, paused operations and machine alarms at the operator's work centers. */
export function AlertsPage() {
  const s = useMobileScope()
  const now = useNow()
  const woIds = new Set(s.operatorWorkOrders.map((w) => w.id))
  const moIds = new Set(s.operatorWorkOrders.map((w) => w.moId))
  const holds = s.qualityHolds.filter((h) => (h.moId && moIds.has(h.moId)) || woIds.has(h.targetId))
  const paused = s.operatorWorkOrders.filter((w) => w.status === 'paused' || w.status === 'hold')
  const alarms = s.machines.filter((m) => m.telemetry.alarm || m.state === 'down')
  const total = holds.length + paused.length + alarms.length

  return (
    <div className="space-y-6">
      <ScreenHeader
        greeting={`${total} open at ${s.workCenters.map((c) => c.name).join(', ') || s.site.name}`}
        title="Alerts"
      />

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff />}
            title="All clear"
            description="No holds, paused operations or machine alarms at your work centers."
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.work}>Open my work</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {alarms.map((m) => (
            <MachineAlarmCard key={m.id} machine={m} now={now} />
          ))}
          {holds.map((h) => (
            <HoldCard key={h.id} hold={h} now={now} />
          ))}
          {paused.map((w) => (
            <PausedCard key={w.id} wo={w} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  to,
  tone,
  icon,
  code,
  status,
  subtitle,
  message,
  footer,
}: {
  to?: string
  tone: Tone
  icon: ReactNode
  code: string
  status: string
  subtitle: string
  message: string
  footer: string
}) {
  const body = (
    <>
      <div className="gap-3 flex items-center">
        <IconTile tone={tone} size="lg" shape="round">
          {icon}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="gap-2 flex items-center justify-between">
            <span className="font-semibold truncate font-mono text-[13px]">{code}</span>
            <StatusText tone={tone} label={status} />
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>
        </div>
      </div>
      <p className="mt-3 font-semibold leading-snug text-[15px]">{message}</p>
      <p className="mt-2.5 text-sm text-muted">{footer}</p>
    </>
  )
  const className = 'block rounded-[24px] bg-card p-4 shadow-card transition-transform active:scale-[0.98]'
  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

function MachineAlarmCard({ machine, now }: { machine: Machine; now: number }) {
  const s = useMobileScope()
  const wo = s.operatorWorkOrders.find((w) => w.machineId === machine.id)
  return (
    <AlertCard
      to={wo ? paths.workOrder(wo.id) : undefined}
      tone="accent"
      icon={<Siren />}
      code={machine.code}
      status={machine.state === 'down' ? 'Down' : 'Alarm'}
      subtitle={`${machine.name} · ${s.orgName(machine.workCenterId)}`}
      message={machine.telemetry.alarm ?? 'Machine reported down'}
      footer={`${fmtAgo(machine.telemetry.at, now)}${wo ? ` · running ${wo.code}` : ''}`}
    />
  )
}

function HoldCard({ hold, now }: { hold: QualityHold; now: number }) {
  const s = useMobileScope()
  const wo =
    hold.target === 'wo'
      ? s.maps.wo.get(hold.targetId)
      : s.operatorWorkOrders.find((w) => w.moId === hold.moId)
  const target =
    hold.target === 'wip'
      ? (s.maps.wip.get(hold.targetId)?.code ?? hold.targetId)
      : hold.target === 'lot'
        ? (s.maps.lot.get(hold.targetId)?.code ?? hold.targetId)
        : hold.target === 'mo'
          ? (s.maps.mo.get(hold.targetId)?.code ?? hold.targetId)
          : (s.maps.wo.get(hold.targetId)?.code ?? hold.targetId)
  return (
    <AlertCard
      to={wo ? paths.workOrder(wo.id) : undefined}
      tone="danger"
      icon={<TriangleAlert />}
      code={hold.code}
      status="Quality hold"
      subtitle={`${HOLD_TARGET_LABEL[hold.target]} ${target}`}
      message={s.reasonLabel(hold.reasonCodeId)}
      footer={`${hold.note ? `${hold.note} · ` : ''}held by ${s.personName(hold.heldBy)} ${fmtAgo(hold.heldAt, now)}`}
    />
  )
}

function PausedCard({ wo, now }: { wo: WorkOrder; now: number }) {
  const s = useMobileScope()
  const mo = s.maps.mo.get(wo.moId)
  const last = wo.events.at(-1)
  return (
    <AlertCard
      to={paths.workOrder(wo.id)}
      tone="warning"
      icon={<Pause />}
      code={wo.code}
      status={wo.status === 'hold' ? 'On hold' : 'Paused'}
      subtitle={`${wo.operationName} · ${mo ? s.productName(mo.productId) : ''}`}
      message={
        wo.status === 'hold'
          ? `On hold: ${s.reasonLabel(wo.holdReasonId)}`
          : `Paused: ${wo.pauseReason ? PAUSE_REASON_LABEL[wo.pauseReason] : 'no reason given'}`
      }
      footer={last ? `${last.text} · ${fmtAgo(last.at, now)}` : s.orgName(wo.workCenterId)}
    />
  )
}
