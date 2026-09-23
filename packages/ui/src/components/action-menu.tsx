import { useState, type ReactElement, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useIsPhone } from '../lib/use-media-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { IconTile } from './icon-tile'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './sheet'

export type ActionMenuItem = {
  key: string
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  description?: ReactNode
}

export type ActionMenuProps = {
  /** Rendered with `asChild`, so it must forward its ref and props (Button does). */
  trigger: ReactElement
  items: (ActionMenuItem | 'separator')[]
  title?: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
}

function ItemText({ item }: { item: ActionMenuItem }) {
  return (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate">{item.label}</span>
      {item.description !== undefined && (
        <span className="block truncate text-xs font-normal text-muted">{item.description}</span>
      )}
    </span>
  )
}

/** Overflow menu: an anchored dropdown from `md` up, a light bottom sheet on phones. */
export function ActionMenu({ trigger, items, title, align = 'end', side = 'bottom' }: ActionMenuProps) {
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(false)

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" hideClose aria-describedby={undefined}>
          <SheetHeader className={cn('pb-2 pt-3', title === undefined && 'sr-only')}>
            <SheetTitle className="text-base">{title ?? 'Actions'}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-3 pb-2">
            {items.map((item, index) =>
              item === 'separator' ? (
                <div key={`separator-${index}`} role="separator" className="mx-3 my-1 h-px bg-border" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
                    item.destructive && 'text-accent',
                  )}
                >
                  {item.icon !== undefined && (
                    <IconTile size="sm" tone={item.destructive ? 'danger' : 'default'}>
                      {item.icon}
                    </IconTile>
                  )}
                  <ItemText item={item} />
                </button>
              ),
            )}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side}>
        {title !== undefined && <DropdownMenuLabel>{title}</DropdownMenuLabel>}
        {items.map((item, index) =>
          item === 'separator' ? (
            <DropdownMenuSeparator key={`separator-${index}`} />
          ) : (
            <DropdownMenuItem
              key={item.key}
              destructive={item.destructive}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.icon}
              <ItemText item={item} />
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
