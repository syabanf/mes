import type { ComponentProps, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../lib/cn'

const cardVariants = cva('', {
  variants: {
    variant: {
      default: 'rounded-card bg-card shadow-card',
      // `isolate` lets the blob sit at -z-10: behind the content, above the ink fill.
      ink: 'relative isolate overflow-hidden rounded-hero bg-ink text-on-ink shadow-float',
      accent: 'rounded-card bg-accent text-white shadow-glow',
      soft: 'rounded-2xl bg-surface-2',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type CardProps = ComponentProps<'div'> & { variant?: 'default' | 'ink' | 'accent' | 'soft' }

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div data-variant={variant} className={cn(cardVariants({ variant }), className)} {...props}>
      {variant === 'ink' && (
        <div
          aria-hidden="true"
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute -z-10 rounded-full bg-accent/30"
        />
      )}
      {children}
    </div>
  )
}

export type CardHeaderProps = ComponentProps<'div'> & { action?: ReactNode }

export function CardHeader({ action, className, children, ...props }: CardHeaderProps) {
  if (action === undefined || action === null) {
    return (
      <div className={cn('gap-1 p-5 flex flex-col', className)} {...props}>
        {children}
      </div>
    )
  }
  return (
    <div className={cn('gap-2 p-5 flex flex-wrap items-start justify-between', className)} {...props}>
      <div className="min-w-0 gap-1 flex flex-1 flex-col">{children}</div>
      <div className="min-w-0 gap-2 flex max-w-full flex-wrap items-center">{action}</div>
    </div>
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold leading-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0 flex items-center', className)} {...props} />
}
