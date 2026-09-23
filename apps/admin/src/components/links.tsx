import { Avatar, cn } from '@mes/ui'
import { Link } from 'react-router'
import { useScoped } from '../state/scoped'

/** Routes for entity pages, shared by every feature. */
export const paths = {
  marketingOrder: (id: string) => `/demand/orders/${id}`,
  demand: (id: string) => `/demand/demands/${id}`,
  replenishment: (id: string) => `/demand/replenishment/${id}`,
  product: (id: string) => `/plm/products/${id}`,
  bom: (id: string) => `/plm/bom/${id}`,
  bor: (id: string) => `/plm/bor/${id}`,
  bop: (id: string) => `/plm/bop/${id}`,
  specification: (id: string) => `/plm/specifications/${id}`,
  workInstruction: (id: string) => `/plm/work-instructions/${id}`,
  eco: (id: string) => `/plm/eco/${id}`,
  mo: (id: string) => `/manufacturing/orders/${id}`,
  wo: (id: string) => `/manufacturing/work-orders/${id}`,
  station: (woId: string) => `/shopfloor/station?wo=${woId}`,
  requirement: (id: string) => `/inventory/requirements/${id}`,
  lotDetail: (id: string) => `/inventory/floor-stock/${id}`,
  wip: (id: string) => `/inventory/wip/${id}`,
  rework: (id: string) => `/inventory/rework/${id}`,
  lot: (id: string) => `/traceability/lots?id=${id}`,
  serial: (id: string) => `/traceability/serials?id=${id}`,
  genealogy: (moId: string) => `/traceability/genealogy?mo=${moId}`,
  inspection: (id: string) => `/quality/inspections/${id}`,
  hold: (id: string) => `/quality/holds/${id}`,
  ncr: (id: string) => `/quality/ncr/${id}`,
  capacity: (workCenterId: string) => `/planning/capacity/${workCenterId}`,
  schedule: (woId: string) => `/planning/schedule/${woId}`,
  machine: (id: string) => `/integration/device-monitoring?machine=${id}`,
}

/** Code + product of a manufacturing order, linking to its page. */
export function MoLink({
  moId,
  className,
  showProduct = true,
}: {
  moId: string
  className?: string
  showProduct?: boolean
}) {
  const { maps, productName } = useScoped()
  const mo = maps.mo.get(moId)
  if (!mo) return <span className="text-muted">Removed order</span>
  return (
    <Link
      to={paths.mo(mo.id)}
      onClick={(e) => e.stopPropagation()}
      className={cn('group min-w-0 inline-flex flex-col hover:text-accent', className)}
    >
      <span className="text-xs font-semibold truncate font-mono">{mo.code}</span>
      {showProduct && <span className="text-xs truncate text-muted">{productName(mo.productId)}</span>}
    </Link>
  )
}

export function WoLink({ woId, className }: { woId: string; className?: string }) {
  const { maps } = useScoped()
  const wo = maps.wo.get(woId)
  if (!wo) return null
  return (
    <Link
      to={paths.wo(wo.id)}
      onClick={(e) => e.stopPropagation()}
      className={cn('text-xs font-medium font-mono hover:text-accent hover:underline', className)}
    >
      {wo.code}
    </Link>
  )
}

export function ProductLink({ productId, className }: { productId: string; className?: string }) {
  const { maps } = useScoped()
  const product = maps.product.get(productId)
  if (!product) return <span className="text-muted">Unknown product</span>
  return (
    <Link
      to={paths.product(product.id)}
      onClick={(e) => e.stopPropagation()}
      className={cn('min-w-0 inline-flex flex-col hover:text-accent', className)}
    >
      <span className="font-medium truncate">{product.name}</span>
      <span className="truncate font-mono text-[11px] text-muted">{product.code}</span>
    </Link>
  )
}

export function MachineLink({ machineId, className }: { machineId: string | null; className?: string }) {
  const { maps } = useScoped()
  const machine = machineId ? maps.machine.get(machineId) : undefined
  if (!machine) return <span className="text-muted">Unassigned</span>
  return (
    <Link
      to={paths.machine(machine.id)}
      onClick={(e) => e.stopPropagation()}
      className={cn('min-w-0 inline-flex flex-col hover:text-accent', className)}
    >
      <span className="font-medium truncate">{machine.code}</span>
      <span className="truncate text-[11px] text-muted">{machine.name}</span>
    </Link>
  )
}

export function PersonAvatar({
  personId,
  size = 'sm',
  className,
}: {
  personId: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const { maps, personName } = useScoped()
  return (
    <Avatar
      name={personName(personId)}
      color={maps.person.get(personId)?.color}
      size={size}
      className={className}
    />
  )
}

/** Avatar + name, for key/value rows and lists. */
export function PersonChip({ personId, hint }: { personId: string | null; hint?: string }) {
  const { personName } = useScoped()
  if (!personId) return <span className="text-muted">Unassigned</span>
  return (
    <span className="min-w-0 gap-2 inline-flex items-center">
      <PersonAvatar personId={personId} size="xs" />
      <span className="min-w-0 truncate">{personName(personId)}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </span>
  )
}
