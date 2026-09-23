import { ROLE_LABEL, type Role } from '@mes/types'
import {
  Avatar,
  BottomBar,
  BottomBarAction,
  BottomBarItem,
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  cn,
} from '@mes/ui'
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Factory,
  Flame,
  House,
  LayoutGrid,
  LogOut,
  Microscope,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/auth'
import { usePersistentState } from '../lib/storage'
import { CreateMenu } from './CreateMenu'
import { NAV, leafFor, sectionFor } from './nav'
import { useNavCounts } from './useNavCounts'

const ROLE_SECTIONS: Record<Role, string[]> = {
  admin: ['dashboard', 'manufacturing', 'quality'],
  production_manager: ['manufacturing', 'planning', 'shopfloor'],
  planner: ['planning', 'demand', 'manufacturing'],
  supervisor: ['manufacturing', 'shopfloor', 'quality'],
  operator: ['shopfloor', 'manufacturing'],
  quality: ['quality', 'traceability', 'shopfloor'],
  engineer: ['plm', 'manufacturing', 'master-data'],
  marketing: ['demand', 'manufacturing'],
  warehouse: ['inventory', 'demand', 'traceability'],
}

type Shortcut = { label: string; to: string; icon: LucideIcon; badge?: 'atRisk' | 'activeHolds' }
const ROLE_SHORTCUTS: Record<Role, [Shortcut, Shortcut, Shortcut]> = {
  admin: [
    { label: 'Orders', to: '/manufacturing/orders', icon: ClipboardList, badge: 'atRisk' },
    { label: 'Station', to: '/shopfloor/station', icon: Flame },
    { label: 'Quality', to: '/quality/inspections', icon: ShieldCheck, badge: 'activeHolds' },
  ],
  production_manager: [
    { label: 'Control', to: '/manufacturing/control', icon: Factory },
    { label: 'Dispatch', to: '/manufacturing/dispatch', icon: ClipboardList },
    { label: 'Orders', to: '/manufacturing/orders', icon: Factory, badge: 'atRisk' },
  ],
  planner: [
    { label: 'Demand', to: '/demand/demands', icon: ClipboardList },
    { label: 'Schedule', to: '/planning/schedule', icon: CalendarDays },
    { label: 'Orders', to: '/manufacturing/orders', icon: Factory },
  ],
  supervisor: [
    { label: 'Dispatch', to: '/manufacturing/dispatch', icon: ClipboardList },
    { label: 'Work orders', to: '/manufacturing/work-orders', icon: Factory },
    { label: 'Quality', to: '/quality/inspections', icon: ShieldCheck, badge: 'activeHolds' },
  ],
  operator: [
    { label: 'Work orders', to: '/manufacturing/work-orders', icon: ClipboardList },
    { label: 'Instructions', to: '/shopfloor/instructions', icon: ShieldCheck },
    { label: 'Production', to: '/shopfloor/execution', icon: Factory },
  ],
  quality: [
    { label: 'Inspections', to: '/quality/inspections', icon: Microscope },
    { label: 'Holds', to: '/quality/holds', icon: ShieldCheck, badge: 'activeHolds' },
    { label: 'Defects', to: '/quality/defects', icon: ClipboardList },
  ],
  engineer: [
    { label: 'Products', to: '/plm/products', icon: Boxes },
    { label: 'Revisions', to: '/plm/revisions', icon: ClipboardList },
    { label: 'Instructions', to: '/plm/work-instructions', icon: ShieldCheck },
  ],
  marketing: [
    { label: 'Orders', to: '/demand/orders', icon: Truck },
    { label: 'Fulfillment', to: '/demand/fulfillment', icon: Boxes },
    { label: 'Demand', to: '/demand/demands', icon: ClipboardList },
  ],
  warehouse: [
    { label: 'Finished', to: '/inventory/finished-goods', icon: Warehouse },
    { label: 'Material', to: '/inventory/issue', icon: Boxes },
    { label: 'WIP', to: '/inventory/wip', icon: Factory },
  ],
}

/** Phone navigation: floating ink bar plus a dark bottom sheet with every destination. */
export function PhoneNav({
  moreOpen,
  onMoreChange,
}: {
  moreOpen: boolean
  onMoreChange: (open: boolean) => void
}) {
  const { pathname } = useLocation()
  const counts = useNavCounts()
  const { user, signOut, can } = useAuth()
  const navigate = useNavigate()
  const is = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
  const currentLeaf = leafFor(pathname)
  const currentSection = sectionFor(pathname)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(currentSection.id)
  const [recentPaths, setRecentPaths] = usePersistentState<string[]>('mes.admin.recent-nav', [])
  const destinations = NAV.flatMap(
    (section) => section.items ?? [{ to: section.to, label: section.label, icon: section.icon }],
  )
  const recent = recentPaths.map((path) => destinations.find((d) => d.to === path)).filter((d) => !!d)
  const preferredIds = user ? ROLE_SECTIONS[user.role] : []
  const shortcuts = ROLE_SHORTCUTS[user?.role ?? 'admin']
  const [first, second, third] = shortcuts
  const FirstIcon = first.icon
  const SecondIcon = second.icon
  const ThirdIcon = third.icon
  const canCreate =
    can('order.manage') ||
    can('mo.manage') ||
    can('inventory.manage') ||
    can('quality.execute') ||
    can('plm.manage')
  const orderedSections = [...NAV].sort((a, b) => {
    const rank = (id: string) =>
      id === currentSection.id ? -1 : preferredIds.includes(id) ? preferredIds.indexOf(id) : NAV.length
    return rank(a.id) - rank(b.id) || NAV.indexOf(a) - NAV.indexOf(b)
  })
  const normalizedQuery = query.trim().toLowerCase()

  useEffect(() => {
    if (moreOpen) {
      setExpandedId(currentSection.id)
      setQuery('')
    }
  }, [moreOpen, currentSection.id])

  const visit = (path: string) => {
    setRecentPaths((previous) => [path, ...previous.filter((p) => p !== path)].slice(0, 4))
    onMoreChange(false)
  }

  return (
    <>
      <BottomBar>
        <BottomBarItem asChild icon={<House />} label="Home" active={is('/')}>
          <Link to="/" />
        </BottomBarItem>
        <BottomBarItem
          asChild
          icon={<FirstIcon />}
          label={first.label}
          active={is(first.to)}
          badge={first.badge ? counts[first.badge] : undefined}
        >
          <Link to={first.to} />
        </BottomBarItem>
        {canCreate ? (
          <CreateMenu
            trigger={
              <BottomBarAction label="Create">
                <Plus />
              </BottomBarAction>
            }
          />
        ) : (
          <BottomBarAction label="Open station" onClick={() => navigate('/shopfloor/station')}>
            <Flame />
          </BottomBarAction>
        )}
        <BottomBarItem
          asChild
          icon={<SecondIcon />}
          label={second.label}
          active={is(second.to)}
          badge={second.badge ? counts[second.badge] : undefined}
        >
          <Link to={second.to} />
        </BottomBarItem>
        <BottomBarItem
          asChild
          icon={<ThirdIcon />}
          label={third.label}
          active={is(third.to)}
          badge={third.badge ? counts[third.badge] : undefined}
        >
          <Link to={third.to} />
        </BottomBarItem>
        <BottomBarItem
          icon={<LayoutGrid />}
          label="More"
          active={moreOpen}
          onClick={() => onMoreChange(true)}
        />
      </BottomBar>

      <Sheet open={moreOpen} onOpenChange={onMoreChange}>
        <SheetContent side="bottom" tone="dark" hideClose aria-describedby={undefined}>
          <SheetTitle className="sr-only">All destinations</SheetTitle>
          <div className="px-4 pb-3 pt-4 top-0 sticky z-10 bg-ink">
            <label className="gap-2 px-3 h-11 rounded-2xl bg-white/10 flex items-center">
              <Search aria-hidden="true" className="size-4 text-on-ink-muted" />
              <span className="sr-only">Find a page</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a page"
                className="min-w-0 text-sm text-white flex-1 bg-transparent outline-none placeholder:text-on-ink-muted"
              />
            </label>
          </div>
          {!normalizedQuery && recent.length > 0 && (
            <div className="px-5 pb-2">
              <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">Recent</p>
              <div className="gap-2 mt-2 flex flex-wrap">
                {recent.map((destination) => (
                  <Link
                    key={destination.to}
                    to={destination.to}
                    onClick={() => visit(destination.to)}
                    className="px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-full"
                  >
                    {destination.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {orderedSections.map((section) => {
            const sectionDestinations = section.items ?? [
              { to: section.to, label: section.label, icon: section.icon },
            ]
            const matchesSection = section.label.toLowerCase().includes(normalizedQuery)
            const visibleDestinations = normalizedQuery
              ? sectionDestinations.filter(
                  (d) => matchesSection || d.label.toLowerCase().includes(normalizedQuery),
                )
              : sectionDestinations
            if (visibleDestinations.length === 0) return null
            const expanded = !!normalizedQuery || expandedId === section.id
            return (
              <div key={section.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : section.id)}
                  className="px-5 py-3 font-semibold tracking-wider hover:text-white flex w-full items-center justify-between text-left text-[11px] text-on-ink-muted uppercase"
                >
                  {section.label}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-4 transition-transform', expanded && 'rotate-180')}
                  />
                </button>
                {expanded && (
                  <div className="gap-2 px-3 pb-2 grid grid-cols-3">
                    {visibleDestinations.map((d) => {
                      const Icon = d.icon
                      const active = section.items
                        ? currentLeaf?.to === d.to
                        : currentSection.id === section.id
                      const badge = 'badge' in d && d.badge ? counts[d.badge] : 0
                      return (
                        <Link
                          key={d.to}
                          to={d.to}
                          onClick={() => visit(d.to)}
                          className="gap-2 rounded-2xl p-3 hover:bg-white/10 flex flex-col items-center text-center transition-colors"
                        >
                          <span
                            className={cn(
                              'size-11 rounded-2xl bg-white/10 [&_svg]:size-5 relative flex items-center justify-center',
                              active && 'text-white bg-accent shadow-glow',
                            )}
                          >
                            <Icon />
                            {badge > 0 && (
                              <span className="-right-1 -top-1 bg-white px-1 font-bold absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full text-[10px] text-ink">
                                {badge}
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-medium leading-tight">{d.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {user && (
            <div className="mt-3 gap-3 border-white/10 px-5 pt-4 flex items-center border-t">
              <Avatar name={user.name} color={user.color} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-xs truncate text-on-ink-muted">{ROLE_LABEL[user.role]}</p>
              </div>
              <Button
                variant="onInk"
                size="sm"
                onClick={() => {
                  onMoreChange(false)
                  signOut()
                  navigate('/login')
                }}
              >
                <LogOut />
                Sign out
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
