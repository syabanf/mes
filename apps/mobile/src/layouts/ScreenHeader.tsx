import { Avatar } from '@mes/ui'
import { Link } from 'react-router'
import { paths } from '../lib/paths'
import { useMobileScope } from '../state/scope'

/** Tab screen header: muted context line, big title ending in the accent period, avatar to the profile. */
export function ScreenHeader({ greeting, title }: { greeting: string; title: string }) {
  const { user } = useMobileScope()
  return (
    <header className="gap-3 pt-3 flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm truncate text-muted">{greeting}</p>
        <h1 className="mt-0.5 font-bold leading-tight tracking-tight text-[28px]">
          {title}
          <span className="text-accent">.</span>
        </h1>
      </div>
      <Link
        to={paths.more}
        aria-label="Your profile"
        className="shrink-0 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-95"
      >
        <Avatar name={user.name} color={user.color} size="lg" ring />
      </Link>
    </header>
  )
}
