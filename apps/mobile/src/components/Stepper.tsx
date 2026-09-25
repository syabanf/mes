import { Button, cn } from '@mes/ui'
import { Minus, Plus } from 'lucide-react'

/** Big +/- counter for piece counts. The emphasised one is the good count. */
export function Stepper({
  label,
  value,
  onChange,
  emphasis = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  emphasis?: boolean
}) {
  const set = (v: number) => onChange(Math.max(0, Math.floor(Number.isFinite(v) ? v : 0)))
  return (
    <div className={cn('rounded-2xl p-3', emphasis ? 'bg-ink text-on-ink' : 'bg-surface')}>
      <p className={cn('text-xs font-semibold', emphasis ? 'text-on-ink-muted' : 'text-muted')}>{label}</p>
      <div className="mt-2 gap-2 flex items-center">
        <Button
          type="button"
          variant={emphasis ? 'onInk' : 'card'}
          size="icon-lg"
          className="size-12"
          aria-label={`Decrease ${label}`}
          onClick={() => set(value - 1)}
          disabled={value <= 0}
        >
          <Minus />
        </Button>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          aria-label={label}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className={cn(
            'h-12 min-w-0 rounded-2xl text-2xl font-bold flex-1 bg-transparent text-center tabular-nums focus:ring-2 focus:ring-accent/40 focus:outline-none',
            emphasis ? 'text-white' : 'text-foreground',
          )}
        />
        <Button
          type="button"
          variant={emphasis ? 'primary' : 'secondary'}
          size="icon-lg"
          className="size-12"
          aria-label={`Increase ${label}`}
          onClick={() => set(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
