import { cn } from '@mes/ui'
import { Link } from 'react-router'

const tones = {
  ink: 'bg-ink text-on-ink',
  accent: 'bg-accent-strong text-white shadow-glow',
  card: 'bg-card',
} as const

/** Mobile stat tile: big number over a short label. Three of them make the hub summary row. */
export function StatTile({
  to,
  value,
  label,
  tone,
}: {
  to: string
  value: number
  label: string
  tone: keyof typeof tones
}) {
  return (
    <Link
      to={to}
      className={cn(
        'px-4 py-5 rounded-[24px] shadow-card transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]',
        tones[tone],
      )}
    >
      <span className="font-bold block text-[32px] leading-none tabular-nums">{value}</span>
      <span className="mt-2 text-xs font-medium leading-tight block">{label}</span>
    </Link>
  )
}
