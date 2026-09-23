import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../lib/cn'
import { rovingIndex } from '../lib/roving'

export type SegmentedOption = {
  value: string
  label: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger'
  icon?: ReactNode
}

export type SegmentedControlProps = {
  options: SegmentedOption[]
  value: string | null
  onChange: (value: string) => void
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

const selectedTone = {
  default: 'bg-ink text-on-ink',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-accent text-white',
} as const

/** Single choice pill group for answers such as Pass / Fail or Normal / Rough / Loud. */
export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  const selectedIndex = options.findIndex((option) => option.value === value)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    const next = rovingIndex(event.key, selectedIndex, options.length, () => true, true)
    const option = next === null ? undefined : options[next]
    if (next === null || !option) return
    event.preventDefault()
    onChange(option.value)
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full bg-surface p-1', className)}
    >
      {options.map((option, index) => {
        const selected = index === selectedIndex
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
              size === 'sm' ? 'h-8' : 'h-10',
              selected ? selectedTone[option.tone ?? 'default'] : 'text-body hover:bg-black/5',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
