import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@mes/ui'
import type { ReactNode } from 'react'

/** Bottom sheet for one operator action: title, one-line helper, then the form. The body unmounts on close. */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" {...(description ? {} : { 'aria-describedby': undefined })}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="px-5 pb-2">{open && children}</div>
      </SheetContent>
    </Sheet>
  )
}
