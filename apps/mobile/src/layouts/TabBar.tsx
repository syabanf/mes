import { CountBadge, cn } from '@mes/ui'
import { Link, useLocation } from 'react-router'
import { useMobileScope } from '../state/scope'
import { TABS, type TabDef, type TabId, activeTab } from './tabs'

/** Fixed bottom bar: white sheet with an upward shadow, the active tab as an accent pill. */
export function TabBar() {
  const { pathname } = useLocation()
  const { myWorkOrders, operatorInspections, qualityHolds } = useMobileScope()
  const current = activeTab(pathname)
  const badges: Partial<Record<TabId, number>> = {
    work: myWorkOrders.filter((w) => w.status === 'ready' || w.status === 'assigned').length,
    quality: operatorInspections.filter((i) => i.status === 'pending' || i.status === 'in_progress').length,
    more: qualityHolds.length,
  }

  return (
    <nav aria-label="Main" className="inset-x-0 bottom-0 max-w-md fixed z-40 mx-auto w-full">
      <div
        aria-hidden="true"
        className="h-8 pointer-events-none bg-linear-to-t from-surface to-transparent"
      />
      <div className="rounded-t-[28px] bg-card safe-b shadow-up">
        <div className="px-3 pb-2 pt-2 flex items-stretch">
          {TABS.map((tab) => (
            <TabLink key={tab.id} tab={tab} active={current === tab.id} badge={badges[tab.id] ?? 0} />
          ))}
        </div>
      </div>
    </nav>
  )
}

function TabLink({ tab, active, badge }: { tab: TabDef; active: boolean; badge: number }) {
  const Icon = tab.icon
  return (
    <Link
      to={tab.to}
      aria-current={active ? 'page' : undefined}
      aria-label={badge > 0 ? `${tab.label}, ${badge} waiting` : tab.label}
      className="group min-h-14 gap-1 py-1.5 flex flex-1 flex-col items-center justify-center focus-visible:outline-none"
    >
      <span
        className={cn(
          'h-9 w-14 relative flex items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent/40',
          active ? 'text-white bg-accent-strong shadow-glow' : 'text-muted group-active:bg-surface',
        )}
      >
        <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
        <CountBadge count={badge} className="-right-1 -top-1 absolute" />
      </span>
      <span className={cn('font-semibold text-[11px]', active ? 'text-accent-strong' : 'text-muted')}>
        {tab.label}
      </span>
    </Link>
  )
}
