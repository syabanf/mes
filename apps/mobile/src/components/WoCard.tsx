import { fmtNumber } from '@mes/fixtures'
import type { WorkOrder } from '@mes/types'
import { IconTile, cn } from '@mes/ui'
import { Link } from 'react-router'
import { paths } from '../lib/paths'
import { WO_TONE } from '../lib/wo'
import { useMobileScope } from '../state/scope'
import { WoStatusText } from './badges'

const closed = (wo: WorkOrder) => wo.status === 'completed' || wo.status === 'cancelled'

/** List card: operation sequence tile, operation name, order and product, status, output against target. */
export function WoCard({ wo }: { wo: WorkOrder }) {
  const { maps, productName } = useMobileScope()
  const mo = maps.mo.get(wo.moId)
  const machine = wo.machineId ? maps.machine.get(wo.machineId) : undefined
  return (
    <Link
      to={paths.workOrder(wo.id)}
      className={cn(
        'p-4 block rounded-[24px] shadow-card transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]',
        closed(wo) ? 'bg-card/70' : 'bg-card',
      )}
    >
      <div className="gap-3 flex items-center">
        <IconTile
          tone={WO_TONE[wo.status]}
          size="lg"
          shape="round"
          className="text-base font-bold tabular-nums"
        >
          {wo.operationSeq}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="gap-2 flex items-center justify-between">
            <span className="font-semibold truncate text-[15px]">{wo.operationName}</span>
            <WoStatusText status={wo.status} />
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            <span className="font-mono">{mo?.code ?? wo.moId}</span> ·{' '}
            {mo ? productName(mo.productId) : 'Unknown product'}
          </p>
        </div>
      </div>
      <div className="mt-3 gap-2 text-sm flex items-center justify-between">
        <span className="truncate text-muted">
          {machine ? `${machine.code} · ${machine.name}` : 'No machine yet'}
        </span>
        <span className="font-bold shrink-0 tabular-nums">
          {fmtNumber(wo.goodQty)}
          <span className="font-medium text-muted"> / {fmtNumber(wo.targetQty)}</span>
        </span>
      </div>
    </Link>
  )
}

/** Compact card for the horizontal rail on the home screen. */
export function WoRailCard({ wo }: { wo: WorkOrder }) {
  const { maps, productName } = useMobileScope()
  const mo = maps.mo.get(wo.moId)
  return (
    <Link
      to={paths.workOrder(wo.id)}
      className="w-44 p-4 flex shrink-0 snap-start flex-col rounded-[24px] bg-card shadow-card transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
    >
      <div className="gap-2 flex items-center justify-between">
        <IconTile
          tone={WO_TONE[wo.status]}
          size="sm"
          shape="round"
          className="text-sm font-bold tabular-nums"
        >
          {wo.operationSeq}
        </IconTile>
        <span className="text-sm font-bold tabular-nums">
          {fmtNumber(wo.goodQty)}
          <span className="font-medium text-muted">/{fmtNumber(wo.targetQty)}</span>
        </span>
      </div>
      <p className="mt-3 truncate font-mono text-[11px] text-muted">{mo?.code}</p>
      <p className="mt-0.5 text-sm font-semibold leading-snug line-clamp-2">{wo.operationName}</p>
      <p className="mt-0.5 text-xs truncate text-muted">{mo ? productName(mo.productId) : ''}</p>
      <WoStatusText status={wo.status} className="pt-3 mt-auto" />
    </Link>
  )
}
