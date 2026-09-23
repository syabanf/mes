import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BadgeCheck,
  Blocks,
  BookOpenText,
  Boxes,
  CalendarRange,
  ChartNoAxesGantt,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Database,
  Factory,
  FileStack,
  Flame,
  Gauge,
  GitBranch,
  GitCompareArrows,
  Handshake,
  History,
  Inbox,
  Layers3,
  LayoutGrid,
  ListChecks,
  Microscope,
  MonitorCog,
  Package,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  PauseOctagon,
  Plug,
  Recycle,
  Route,
  ScanLine,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Split,
  Tags,
  Trash2,
  TrendingUp,
  Undo2,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'

/** Counts shown on navigation items. */
export type BadgeKey =
  | 'draftOrders'
  | 'openDemand'
  | 'proposedReplenishment'
  | 'ecoReview'
  | 'readyToDispatch'
  | 'activeHolds'
  | 'pendingInspections'
  | 'atRisk'
  | 'shortages'

export interface NavLeaf {
  to: string
  label: string
  icon: LucideIcon
  badge?: BadgeKey
}

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  to: string
  items?: NavLeaf[]
}

export const NAV: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, to: '/' },
  {
    id: 'demand',
    label: 'Marketing & Demand',
    icon: ShoppingCart,
    to: '/demand/orders',
    items: [
      { to: '/demand/orders', label: 'Marketing orders', icon: ShoppingCart, badge: 'draftOrders' },
      { to: '/demand/demands', label: 'Demand', icon: Inbox, badge: 'openDemand' },
      { to: '/demand/fulfillment', label: 'Fulfillment', icon: Split },
      {
        to: '/demand/replenishment',
        label: 'Replenishment',
        icon: PackageSearch,
        badge: 'proposedReplenishment',
      },
    ],
  },
  {
    id: 'plm',
    label: 'PLM',
    icon: Layers3,
    to: '/plm/products',
    items: [
      { to: '/plm/products', label: 'Products', icon: Tags },
      { to: '/plm/bom', label: 'BOM', icon: Blocks },
      { to: '/plm/bor', label: 'BOR', icon: Cpu },
      { to: '/plm/bop', label: 'BOP', icon: Route },
      { to: '/plm/specifications', label: 'Specifications', icon: ListChecks },
      { to: '/plm/work-instructions', label: 'Work instructions', icon: BookOpenText },
      { to: '/plm/eco', label: 'ECO', icon: GitCompareArrows, badge: 'ecoReview' },
      { to: '/plm/revisions', label: 'Revisions', icon: GitBranch },
    ],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    icon: Factory,
    to: '/manufacturing/orders',
    items: [
      { to: '/manufacturing/orders', label: 'Manufacturing orders', icon: ClipboardList, badge: 'atRisk' },
      { to: '/manufacturing/work-orders', label: 'Work orders', icon: FileStack },
      { to: '/manufacturing/dispatch', label: 'Dispatch', icon: ChartNoAxesGantt, badge: 'readyToDispatch' },
      { to: '/manufacturing/control', label: 'Production control', icon: MonitorCog },
    ],
  },
  {
    id: 'shopfloor',
    label: 'Shop floor',
    icon: Flame,
    to: '/shopfloor/station',
    items: [
      { to: '/shopfloor/station', label: 'Operator station', icon: ScanLine },
      { to: '/shopfloor/execution', label: 'Production execution', icon: Activity },
      { to: '/shopfloor/instructions', label: 'Work instructions', icon: BookOpenText },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    to: '/inventory/requirements',
    items: [
      { to: '/inventory/requirements', label: 'Material requirement', icon: ListChecks, badge: 'shortages' },
      { to: '/inventory/reservations', label: 'Reservation', icon: PackageCheck },
      { to: '/inventory/floor-stock', label: 'Floor stock', icon: Warehouse },
      { to: '/inventory/issue', label: 'Material issue', icon: PackageOpen },
      { to: '/inventory/consumption', label: 'Consumption', icon: Package },
      { to: '/inventory/wip', label: 'WIP', icon: Boxes },
      { to: '/inventory/scrap', label: 'Scrap', icon: Trash2 },
      { to: '/inventory/rework', label: 'Rework', icon: Recycle },
      { to: '/inventory/returns', label: 'Return', icon: Undo2 },
      { to: '/inventory/finished-goods', label: 'Finished goods', icon: PackageCheck },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: ShieldCheck,
    to: '/quality/inspections',
    items: [
      { to: '/quality/inspections', label: 'Inspection', icon: Microscope, badge: 'pendingInspections' },
      { to: '/quality/checks', label: 'Quality check', icon: ClipboardCheck },
      { to: '/quality/defects', label: 'Defects', icon: Tags },
      { to: '/quality/holds', label: 'Hold', icon: PauseOctagon, badge: 'activeHolds' },
      { to: '/quality/release', label: 'Release', icon: BadgeCheck },
    ],
  },
  {
    id: 'traceability',
    label: 'Traceability',
    icon: GitBranch,
    to: '/traceability/lots',
    items: [
      { to: '/traceability/lots', label: 'Lot trace', icon: PackageSearch },
      { to: '/traceability/serials', label: 'Serial trace', icon: ScanLine },
      { to: '/traceability/genealogy', label: 'Genealogy', icon: GitBranch },
      { to: '/traceability/history', label: 'Production history', icon: History },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: CalendarRange,
    to: '/planning/capacity',
    items: [
      { to: '/planning/capacity', label: 'Capacity', icon: Gauge },
      { to: '/planning/schedule', label: 'Schedule', icon: ChartNoAxesGantt },
      { to: '/planning/resource-load', label: 'Resource load', icon: TrendingUp },
    ],
  },
  {
    id: 'master-data',
    label: 'Master data',
    icon: Database,
    to: '/master-data/organization',
    items: [
      { to: '/master-data/organization', label: 'Organization', icon: Factory },
      { to: '/master-data/commercial', label: 'Commercial', icon: Handshake },
      { to: '/master-data/product-material', label: 'Product & material', icon: Tags },
      { to: '/master-data/engineering', label: 'Engineering', icon: Route },
      { to: '/master-data/resources', label: 'Resources', icon: Wrench },
      { to: '/master-data/people', label: 'People', icon: Users },
      { to: '/master-data/planning', label: 'Planning', icon: CalendarRange },
      { to: '/master-data/inventory', label: 'Inventory', icon: Warehouse },
      { to: '/master-data/quality', label: 'Quality', icon: ShieldCheck },
      { to: '/master-data/system', label: 'System', icon: Settings2 },
    ],
  },
  {
    id: 'integration',
    label: 'Integration',
    icon: Plug,
    to: '/integration/device-monitoring',
    items: [
      { to: '/integration/device-monitoring', label: 'Device monitoring', icon: Activity },
      { to: '/integration/oee', label: 'OEE', icon: Gauge },
      { to: '/integration/cmms', label: 'CMMS', icon: Wrench },
      { to: '/integration/external', label: 'External systems', icon: SlidersHorizontal },
    ],
  },
]

/** The section a path belongs to, by its first segment. */
export function sectionFor(pathname: string): NavSection {
  const segment = pathname.split('/')[1] ?? ''
  return NAV.find((s) => s.id === segment) ?? NAV[0]!
}

/** The section item a path belongs to (longest matching prefix). */
export function leafFor(pathname: string): NavLeaf | undefined {
  const items = sectionFor(pathname).items ?? []
  return [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
}
