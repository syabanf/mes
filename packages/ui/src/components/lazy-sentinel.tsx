import { cn } from '../lib/cn'

export type LazySentinelProps = {
  remaining: number
  onLoad: () => void
  sentinelRef: (el: Element | null) => void
  className?: string
}

/** The "N more · Load" row under a lazy list. Pair it with `useLazyList`. */
export function LazySentinel({ remaining, onLoad, sentinelRef, className }: LazySentinelProps) {
  if (remaining <= 0) return null
  return (
    <div ref={sentinelRef} className={cn('flex items-center justify-center gap-2 py-4 text-xs text-muted', className)}>
      <span className="tabular-nums">{remaining} more</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        onClick={onLoad}
        className="rounded-full px-1 font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        Load
      </button>
    </div>
  )
}
