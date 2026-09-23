import { Banner, cn, useMediaQuery } from '@mes/ui'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigationType } from 'react-router'
import { CreateProvider } from '../components/create'
import { usePersistentState } from '../lib/storage'
import { Header } from './Header'
import { leafFor, sectionFor } from './nav'
import { PhoneNav } from './PhoneNav'
import { useStore } from '../state/store'
import { SideRail } from './SideRail'
import { useNavCounts } from './useNavCounts'

const GLOW =
  'radial-gradient(38% 34% at 72% 22%, rgb(237 28 36 / 0.09), transparent 70%), radial-gradient(28% 30% at 92% 48%, rgb(237 28 36 / 0.06), transparent 70%), radial-gradient(34% 30% at 55% 8%, rgb(255 214 222 / 0.55), transparent 72%)'

// Scroll position of `main` per history entry key, for Back and Forward.
const scrollTops = new Map<string, number>()

export function AdminLayout() {
  const { storageError } = useStore()
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  const [expandedPref, setExpandedPref] = usePersistentState('mes.admin.rail', true)
  const [moreOpen, setMoreOpen] = useState(false)
  const { key, pathname } = useLocation()
  const navigationType = useNavigationType()
  const mainRef = useRef<HTMLElement>(null)
  const entryKey = useRef(key)
  const expanded = expandedPref && isDesktop

  // Scroll events arrive after the commit that changed the page, so they save under the entry now showing.
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const save = () => scrollTops.set(entryKey.current, main.scrollTop)
    main.addEventListener('scroll', save, { passive: true })
    return () => main.removeEventListener('scroll', save)
  }, [])

  // A new page starts at the top of the scroll box. Back and Forward return to where the user left it.
  useLayoutEffect(() => {
    entryKey.current = key
  }, [key])
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: navigationType === 'POP' ? (scrollTops.get(key) ?? 0) : 0 })
  }, [pathname])

  return (
    <CreateProvider>
      {/* overflow-clip, not hidden: a hidden box can still be scrolled by focus and scrollIntoView. */}
      <div className="gap-4 p-3 lg:p-4 relative flex h-dvh overflow-clip bg-surface">
        {/* The glow is clipped by its own box so the shell never gains scrollable overflow. */}
        <div aria-hidden className="inset-0 pointer-events-none absolute overflow-hidden">
          <div
            className="blur-xl absolute -top-[30%] -right-[8%] h-[120%] w-[70%] opacity-70"
            style={{ background: GLOW }}
          />
        </div>
        <div className="md:block relative hidden shrink-0">
          <SideRail
            expanded={expanded}
            canExpand={isDesktop}
            onToggle={() => setExpandedPref(!expandedPref)}
          />
        </div>
        <div className="min-w-0 gap-4 relative flex flex-1 flex-col">
          <Header onMenu={() => setMoreOpen(true)} />
          <main ref={mainRef} className="min-h-0 pb-24 pr-0.5 md:pb-2 relative flex-1 overflow-y-auto">
            {storageError && (
              <Banner tone="danger" title="Changes cannot be saved">
                Browser storage is unavailable or full. Changes in this demo will be lost when you reload.
              </Banner>
            )}
            <SectionTabs />
            <Outlet />
          </main>
        </div>
        <PhoneNav moreOpen={moreOpen} onMoreChange={setMoreOpen} />
      </div>
    </CreateProvider>
  )
}

/** Pill tabs across the pages of the current section, on its list pages only. */
function SectionTabs() {
  const { pathname } = useLocation()
  const counts = useNavCounts()
  const section = sectionFor(pathname)
  const leaf = leafFor(pathname)
  if (!section.items || !leaf || pathname !== leaf.to) return null
  return (
    <nav
      aria-label={`${section.label} pages`}
      className="mb-4 xl:hidden no-scrollbar flex max-w-full overflow-x-auto"
    >
      <div className="gap-1 p-1 inline-flex shrink-0 rounded-full bg-card shadow-card">
        {section.items.map((item) => {
          const count = item.badge ? counts[item.badge] : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'h-9 gap-2 px-4 text-sm font-semibold inline-flex items-center rounded-full whitespace-nowrap transition-colors',
                  isActive ? 'bg-ink text-on-ink' : 'text-muted hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'px-1.5 font-bold rounded-full text-[11px]',
                        isActive ? 'bg-white/20' : 'bg-accent-soft text-accent',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
