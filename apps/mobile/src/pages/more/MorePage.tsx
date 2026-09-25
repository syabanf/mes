import { ROLE_LABEL } from '@mes/types'
import { Avatar, Button, ConfirmDialog, CountBadge, KeyValue } from '@mes/ui'
import { Bell, BookOpen, ChevronRight, LogOut, RotateCcw, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { APP_VERSION, paths } from '../../lib/paths'
import { clearAppStorage } from '../../lib/storage'
import { useMobileScope } from '../../state/scope'
import { useStore } from '../../state/store'

export function MorePage() {
  const { user, site, workCenters, maps, qualityHolds } = useMobileScope()
  const { storageError } = useStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)

  const leave = () => {
    signOut()
    navigate(paths.login, { replace: true })
  }
  const reset = () => {
    clearAppStorage()
    window.location.assign(paths.login)
  }

  return (
    <div className="space-y-6">
      <ScreenHeader greeting={site.name} title="More" />

      <div className="p-6 flex flex-col items-center rounded-[24px] bg-card text-center shadow-card">
        <Avatar name={user.name} color={user.color} size="xl" ring />
        <h2 className="mt-3 text-xl font-bold">{user.name}</h2>
        <p className="text-sm text-muted">{ROLE_LABEL[user.role]}</p>
        <KeyValue
          bare
          className="mt-4 w-full text-left"
          items={[
            { label: 'Badge', value: <span className="text-xs font-mono">{user.badge}</span> },
            { label: 'Site', value: `${site.name} · ${site.city}` },
            {
              label: 'Shift',
              value: user.shiftId ? (maps.shift.get(user.shiftId)?.name ?? 'Unknown') : 'Not assigned',
            },
            {
              label: 'Work centers',
              value: workCenters.map((c) => c.name).join(', ') || 'None at this site',
            },
          ]}
        />
      </div>

      <nav aria-label="Screens" className="divide-y divide-border rounded-[24px] bg-card shadow-card">
        <Row
          to={paths.alerts}
          icon={Bell}
          label="Alerts"
          hint="Holds, pauses and machine alarms"
          badge={qualityHolds.length}
        />
        <Row
          to={paths.instructions()}
          icon={BookOpen}
          label="Work instructions"
          hint="Released steps per product"
        />
      </nav>

      <div className="space-y-2">
        <Button variant="outline" size="lg" className="w-full" onClick={leave}>
          <LogOut />
          Change operator
        </Button>
        <Button variant="ghost" size="lg" className="w-full text-accent" onClick={() => setResetting(true)}>
          <RotateCcw />
          Reset demo data
        </Button>
      </div>

      <p className="text-xs text-center text-muted">
        MES Operator {APP_VERSION}
        {storageError ? ' · changes are not being saved in this browser' : ''}
      </p>

      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title="Reset demo data?"
        description="Every change made on this phone is dropped and the seed dataset loads again. You will need to scan in again."
        confirmLabel="Reset"
        destructive
        onConfirm={reset}
      />
    </div>
  )
}

function Row({
  to,
  icon: Icon,
  label,
  hint,
  badge = 0,
}: {
  to: string
  icon: LucideIcon
  label: string
  hint: string
  badge?: number
}) {
  return (
    <Link to={to} className="min-h-16 gap-3 px-4 py-3 flex items-center transition-colors active:bg-surface">
      <span className="size-11 [&_svg]:size-5 relative flex shrink-0 items-center justify-center rounded-full bg-surface text-body">
        <Icon />
        <CountBadge count={badge} className="-right-1 -top-1 absolute" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-semibold block">{label}</span>
        <span className="text-xs block truncate text-muted">{hint}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
    </Link>
  )
}
