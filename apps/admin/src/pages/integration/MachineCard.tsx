import { fmtNumber, fmtTime } from '@mes/fixtures'
import type { Machine, TelemetryPoint } from '@mes/types'
import { Sparkline, cn } from '@mes/ui'
import { MachineStateBadge } from '../../components/badges'
import { useScoped } from '../../state/scoped'
import { byTime, currentWo } from './lib'

export function MachineCard({
  machine,
  active,
  points,
  onSelect,
}: {
  machine: Machine
  active: boolean
  points: TelemetryPoint[]
  onSelect: () => void
}) {
  const s = useScoped()
  const wo = currentWo(s.workOrders, machine.id)
  const trend = [...points].sort(byTime).slice(-24)
  const useSpeed = trend.some((p) => p.speedRpm !== null)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'p-4 w-full rounded-card bg-card text-left shadow-card transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
        active && 'ring-2 ring-ink',
      )}
    >
      <div className="gap-2 flex items-center justify-between">
        <span className="min-w-0">
          <span className="text-sm font-semibold block truncate">{machine.code}</span>
          <span className="text-xs block truncate text-muted">{machine.name}</span>
        </span>
        <MachineStateBadge state={machine.state} />
      </div>
      {machine.telemetry.alarm && (
        <p className="mt-2 text-xs font-semibold text-accent">{machine.telemetry.alarm}</p>
      )}
      <p className="mt-2 font-mono text-[11px] text-muted">
        {wo ? `${s.maps.mo.get(wo.moId)?.code ?? ''} · ${wo.code}` : 'No work order running'}
      </p>
      {trend.length > 1 && (
        <Sparkline
          className="mt-2"
          data={trend.map((p) => (useSpeed ? (p.speedRpm ?? 0) : p.counter))}
          labels={trend.map((p) => fmtTime(p.at))}
          height={28}
          tone={machine.state === 'down' ? 'accent' : 'ink'}
          format={(v) => `${fmtNumber(v)} ${useSpeed ? 'RPM' : 'pcs'}`}
          ariaLabel={`${useSpeed ? 'Speed' : 'Counter'} trend for ${machine.code}`}
        />
      )}
    </button>
  )
}
