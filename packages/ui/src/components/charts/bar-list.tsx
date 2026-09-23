import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BarListItem = {
  key: string
  label: ReactNode
  value: number
  /** Replaces the formatted number on the right. */
  display?: ReactNode
  hint?: ReactNode
  /** Fill this row in accent. */
  emphasis?: boolean
  onClick?: () => void
}

export type BarListProps = {
  items: BarListItem[]
  /** Value of a full bar; defaults to the largest item. */
  max?: number
  tone?: 'ink' | 'info'
  className?: string
  ariaLabel?: string
}

/** Ranked rows: label and value on one line, a thin bar underneath. */
export function BarList({ items, max, tone = 'ink', className, ariaLabel }: BarListProps) {
  const top = max ?? Math.max(0, ...items.map((item) => item.value))

  return (
    <ul aria-label={ariaLabel} className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => {
        const fraction = top > 0 ? Math.min(1, Math.max(0, item.value / top)) : 0
        const body = (
          <>
            <span className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {item.label}
                {item.hint !== undefined && <span className="ml-1.5 text-xs text-muted">{item.hint}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{item.display ?? item.value.toLocaleString()}</span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface">
              <span
                className={cn(
                  'block h-full rounded-full',
                  item.emphasis ? 'bg-accent' : tone === 'info' ? 'bg-info' : 'bg-ink',
                )}
                style={{ width: `${fraction * 100}%` }}
              />
            </span>
          </>
        )
        return (
          <li key={item.key}>
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
              >
                {body}
              </button>
            ) : (
              <div className="py-1.5">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
