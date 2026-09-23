import type { ComponentProps } from 'react'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '../lib/cn'
import { closeButtonClass, overlayClass } from '../lib/overlay'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

const rightSizes = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
} as const

export type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  side?: 'right' | 'bottom'
  tone?: 'light' | 'dark'
  size?: keyof typeof rightSizes
  hideClose?: boolean
}

/**
 * `side="right"` is a floating detail panel for tablet and up. `side="bottom"` is the phone
 * sheet used for every menu, filter and picker below `md`.
 */
export function SheetContent({
  side = 'right',
  tone = 'light',
  size = 'md',
  hideClose = false,
  className,
  children,
  ...props
}: SheetContentProps) {
  const dark = tone === 'dark'
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 shadow-float outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
          dark ? 'bg-ink text-on-ink' : 'bg-card text-foreground',
          side === 'right'
            ? [
                'inset-y-3 right-3 flex w-[calc(100%-1.5rem)] flex-col rounded-hero data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
                rightSizes[size],
              ]
            : 'inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[28px] pb-[max(env(safe-area-inset-bottom),1rem)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
          className,
        )}
        {...props}
      >
        {side === 'bottom' && (
          <div
            aria-hidden="true"
            className={cn('mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full', dark ? 'bg-white/20' : 'bg-border')}
          />
        )}
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className={cn(
              closeButtonClass,
              dark
                ? 'text-on-ink-muted hover:bg-white/10 hover:text-white'
                : 'text-muted hover:bg-surface hover:text-foreground',
            )}
          >
            <X aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-5 pb-3 pr-14 pt-5', className)} {...props} />
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold leading-tight', className)} {...props} />
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-5', className)} {...props} />
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-border px-5 py-4', className)} {...props} />
}
