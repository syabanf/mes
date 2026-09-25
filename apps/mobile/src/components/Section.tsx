import { cn } from '@mes/ui'
import type { ReactNode } from 'react'

/** A titled block on a mobile screen: bold heading, optional count and action, then the content. */
export function Section({
  title,
  count,
  action,
  className,
  children,
}: {
  title: string
  count?: number
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="min-h-8 gap-2 flex items-center justify-between">
        <h2 className="gap-2 text-base font-bold flex items-center">
          {title}
          {count !== undefined && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-card text-body tabular-nums shadow-card">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
