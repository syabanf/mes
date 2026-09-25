import type { LucideIcon } from 'lucide-react'
import { ClipboardList, House, LayoutGrid, ShieldCheck } from 'lucide-react'
import { paths } from '../lib/paths'

export type TabId = 'home' | 'work' | 'quality' | 'more'

export interface TabDef {
  id: TabId
  to: string
  label: string
  icon: LucideIcon
}

export const TABS: TabDef[] = [
  { id: 'home', to: paths.home, label: 'Home', icon: House },
  { id: 'work', to: paths.work, label: 'Work', icon: ClipboardList },
  { id: 'quality', to: paths.quality, label: 'Quality', icon: ShieldCheck },
  { id: 'more', to: paths.more, label: 'More', icon: LayoutGrid },
]

/** Screens that keep the bottom bar. Instructions and alerts hang off More; detail screens hide it. */
const TAB_ROOTS: Record<string, TabId> = {
  [paths.home]: 'home',
  [paths.work]: 'work',
  [paths.quality]: 'quality',
  [paths.more]: 'more',
  [paths.alerts]: 'more',
  [paths.instructions()]: 'more',
}

export const activeTab = (pathname: string): TabId | null => TAB_ROOTS[pathname] ?? null
