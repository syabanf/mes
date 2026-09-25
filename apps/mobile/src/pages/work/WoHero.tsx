import { fmtAgo, fmtNumber, fmtPercent } from '@mes/fixtures'
import type { WorkOrder } from '@mes/types'
import { PAUSE_REASON_LABEL } from '@mes/types'
import { Badge, Card, ProgressBar } from '@mes/ui'
import { WoStatusBadge } from '../../components/badges'
import { useMobileScope } from '../../state/scope'

/** Dark hero: order, product, operation, machine, status, and the good count against target. */
export function WoHero({ wo, now }: { wo: WorkOrder; now: number }) {
  const s = useMobileScope()
  const mo = s.maps.mo.get(wo.moId)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  const ratio = wo.goodQty / Math.max(1, wo.targetQty)
  return (
    <Card variant="ink" className="p-6">
      <div className="gap-3 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs truncate font-mono text-on-ink-muted">
            {mo?.code ?? wo.moId} · {wo.code}
          </p>
          <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">
            {wo.operationSeq} · {wo.operationName}
          </h2>
          <p className="mt-1 text-sm truncate text-on-ink-muted">
            {mo ? s.productName(mo.productId) : 'Unknown product'}
          </p>
        </div>
        <WoStatusBadge status={wo.status} onInk />
      </div>
      <div className="mt-3 gap-2 flex flex-wrap">
        <Badge className="bg-white/10 text-white">
          {machine ? `${machine.code} · ${machine.name}` : 'No machine yet'}
        </Badge>
        {wo.qualityRequired && <Badge className="bg-white/10 text-white">Quality required</Badge>}
      </div>

      <div className="mt-7">
        <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">
          Good against target
        </p>
        <p className="mt-1 gap-2 flex flex-wrap items-end leading-none">
          <span className="font-bold tracking-tight text-[56px] tabular-nums">{fmtNumber(wo.goodQty)}</span>
          <span className="pb-1.5 text-lg font-semibold text-on-ink-muted">/ {fmtNumber(wo.targetQty)}</span>
        </p>
        <ProgressBar value={ratio} tone="white" size="xs" className="mt-3" aria-label="Progress" />
        <p className="mt-2 gap-x-4 text-sm flex flex-wrap text-on-ink-muted tabular-nums">
          <span>{fmtPercent(ratio)} of target</span>
          <span>{fmtNumber(wo.rejectQty)} reject</span>
          <span>{fmtNumber(wo.reworkQty)} rework</span>
          <span>{fmtNumber(wo.scrapQty)} scrap</span>
          {wo.actualStart && <span>started {fmtAgo(wo.actualStart, now)}</span>}
        </p>
      </div>

      {wo.status === 'paused' && wo.pauseReason && (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm bg-warning/20">
          Paused: {PAUSE_REASON_LABEL[wo.pauseReason]}
        </p>
      )}
      {wo.status === 'hold' && (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm bg-accent/20">
          On hold: {s.reasonLabel(wo.holdReasonId)}. A supervisor releases it from the dispatch board.
        </p>
      )}
    </Card>
  )
}
