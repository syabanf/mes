import { type TraceNode, type TraceNodeKind, fmtWhen } from '@mes/fixtures'
import { Button, IconTile, type Tone, cn } from '@mes/ui'
import {
  Boxes,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  Factory,
  GitBranch,
  Hash,
  Layers,
  Package,
  PackageCheck,
  Truck,
  User,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'

const KIND: Record<TraceNodeKind, { icon: ReactNode; tone: Tone; label: string }> = {
  product: { icon: <Package />, tone: 'ink', label: 'Finished product' },
  receipt: { icon: <PackageCheck />, tone: 'success', label: 'Finished goods receipt' },
  serial: { icon: <Hash />, tone: 'default', label: 'Serial' },
  batch: { icon: <Layers />, tone: 'info', label: 'Batch' },
  wip: { icon: <Boxes />, tone: 'info', label: 'WIP' },
  operation: { icon: <Factory />, tone: 'default', label: 'Operation' },
  machine: { icon: <Cpu />, tone: 'warning', label: 'Machine' },
  operator: { icon: <User />, tone: 'default', label: 'Operator' },
  lot: { icon: <Truck />, tone: 'accent', label: 'Material lot' },
  supplier: { icon: <Building2 />, tone: 'default', label: 'Supplier' },
  customer: { icon: <Building2 />, tone: 'success', label: 'Customer' },
  mo: { icon: <GitBranch />, tone: 'ink', label: 'Manufacturing order' },
  inspection: { icon: <ClipboardCheck />, tone: 'warning', label: 'Inspection' },
}

/** Nested trace rendered as expandable rows with a guide line down the left. */
export function TraceTree({
  root,
  now,
  expandDepth = 2,
  className,
}: {
  root: TraceNode
  now: number
  expandDepth?: number
  className?: string
}) {
  const s = useScoped()
  const linkFor = (node: TraceNode): string | null => {
    switch (node.kind) {
      case 'mo':
      case 'product':
        return s.maps.mo.has(node.id) ? paths.mo(node.id) : null
      case 'wip':
        return s.maps.wip.has(node.id) ? paths.wip(node.id) : null
      case 'lot':
        return s.maps.lot.has(node.id) ? paths.lot(node.id) : null
      case 'operation':
        return s.maps.wo.has(node.id) ? paths.wo(node.id) : null
      case 'inspection':
        return s.maps.inspection.has(node.id) ? paths.inspection(node.id) : null
      case 'machine':
        return s.maps.machine.has(node.id) ? paths.machine(node.id) : null
      case 'serial':
        return paths.serial(node.id)
      default:
        return null
    }
  }
  return (
    <ul className={cn('space-y-1', className)}>
      <TreeRow node={root} depth={0} expandDepth={expandDepth} now={now} linkFor={linkFor} />
    </ul>
  )
}

function TreeRow({
  node,
  depth,
  expandDepth,
  now,
  linkFor,
}: {
  node: TraceNode
  depth: number
  expandDepth: number
  now: number
  linkFor: (node: TraceNode) => string | null
}) {
  const [open, setOpen] = useState(depth < expandDepth)
  const kind = KIND[node.kind]
  const to = linkFor(node)
  const hasChildren = node.children.length > 0
  return (
    <li>
      <div
        className={cn(
          'gap-2 rounded-2xl p-2 flex items-center transition-colors hover:bg-surface-2',
          depth === 0 && 'bg-surface-2',
        )}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronRight className={cn('transition-transform', open && 'rotate-90')} />
          </Button>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
        <IconTile tone={kind.tone} size="sm">
          {kind.icon}
        </IconTile>
        <span className="min-w-0 flex-1">
          {to ? (
            <Link to={to} className="text-sm font-semibold block truncate hover:text-accent">
              {node.title}
            </Link>
          ) : (
            <span className="text-sm font-semibold block truncate">{node.title}</span>
          )}
          <span className="text-xs block truncate text-muted">
            {kind.label}
            {node.subtitle ? ` · ${node.subtitle}` : ''}
          </span>
        </span>
        {node.at && (
          <span className="text-xs sm:block hidden shrink-0 text-muted tabular-nums">
            {fmtWhen(node.at, now)}
          </span>
        )}
      </div>
      {hasChildren && open && (
        <ul className="ml-6 space-y-1 pl-3 border-l-2 border-border">
          {node.children.map((child) => (
            <TreeRow
              key={`${child.kind}:${child.id}`}
              node={child}
              depth={depth + 1}
              expandDepth={expandDepth}
              now={now}
              linkFor={linkFor}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
