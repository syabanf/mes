import type { ReactNode } from 'react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { cn } from '../lib/cn'
import { overlayClass } from '../lib/overlay'
import { buttonVariants } from './button'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  confirmDisabled?: boolean
  /** Extra content between the description and the buttons, such as a reason field. */
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlayClass} />
        <AlertDialogPrimitive.Content
          // Without a description, an explicit undefined tells Radix the omission is intended.
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-card p-6 text-foreground shadow-float outline-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold leading-tight">{title}</AlertDialogPrimitive.Title>
          {description !== undefined && (
            <AlertDialogPrimitive.Description className="mt-1.5 text-sm text-muted">
              {description}
            </AlertDialogPrimitive.Description>
          )}
          {children !== undefined && <div className="mt-4">{children}</div>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: 'outline' })}>
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              disabled={confirmDisabled}
              onClick={onConfirm}
              className={cn(
                buttonVariants({ variant: 'primary' }),
                destructive && 'bg-danger text-white shadow-none hover:bg-accent-strong',
              )}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
