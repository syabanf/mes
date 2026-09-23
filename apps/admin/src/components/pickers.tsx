import type { Machine, Person, Product } from '@mes/types'
import { MATERIAL_CLASS_LABEL, ORG_KIND_LABEL, ROLE_LABEL, STRATEGY_SHORT } from '@mes/types'
import { Avatar, Combobox, MultiCombobox } from '@mes/ui'
import { useMemo } from 'react'
import { useScoped } from '../state/scoped'

type Common = {
  id?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  invalid?: boolean
  variant?: 'default' | 'soft' | 'inline'
  className?: string
  'aria-label'?: string
}
type Single = Common & { value: string | null; onChange: (value: string | null) => void }
type Multi = Common & { values: string[]; onChange: (values: string[]) => void }

export function ProductPicker({ filter, ...p }: Single & { filter?: (product: Product) => boolean }) {
  const { products, maps } = useScoped()
  const items = useMemo(() => products.filter((x) => x.active && (!filter || filter(x))), [products, filter])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select product'}
      searchPlaceholder="Search code or name"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) =>
        `${x.code} · ${STRATEGY_SHORT[x.defaultStrategy]} · ${maps.category.get(x.categoryId)?.name ?? ''}`
      }
      getKeywords={(x) => [x.code]}
    />
  )
}

export function MaterialPicker(p: Single) {
  const { materials, maps } = useScoped()
  const items = useMemo(() => materials.filter((m) => m.active), [materials])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select material'}
      searchPlaceholder="Search code or name"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) =>
        `${x.code} · ${MATERIAL_CLASS_LABEL[x.materialClass]} · ${maps.uom.get(x.uomId)?.code ?? ''}`
      }
      getKeywords={(x) => [x.code]}
    />
  )
}

export function CustomerPicker(p: Single) {
  const { customers } = useScoped()
  return (
    <Combobox
      {...p}
      items={customers}
      placeholder={p.placeholder ?? 'Select customer'}
      searchPlaceholder="Search customers"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${x.city}`}
    />
  )
}

export function SupplierPicker(p: Single) {
  const { suppliers } = useScoped()
  return (
    <Combobox
      {...p}
      items={suppliers}
      placeholder={p.placeholder ?? 'Select supplier'}
      searchPlaceholder="Search suppliers"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${x.city}`}
    />
  )
}

/** Any org node, or only nodes of one kind (lines, work centers). */
export function OrgNodePicker({
  kind,
  ...p
}: Single & { kind?: 'plant' | 'area' | 'line' | 'work_center' | 'zone' }) {
  const { orgNodes, orgPath } = useScoped()
  const items = useMemo(() => orgNodes.filter((n) => !kind || n.kind === kind), [orgNodes, kind])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={
        p.placeholder ?? (kind ? `Select ${ORG_KIND_LABEL[kind].toLowerCase()}` : 'Select location')
      }
      searchPlaceholder="Search plants, areas, lines"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${orgPath(x.parentId)}`}
      getKeywords={(x) => [x.code, ORG_KIND_LABEL[x.kind]]}
    />
  )
}

export function MachinePicker({
  workCenterId,
  filter,
  ...p
}: Single & { workCenterId?: string | null; filter?: (m: Machine) => boolean }) {
  const { machines, orgName } = useScoped()
  const items = useMemo(
    () =>
      machines.filter(
        (m) => m.active && (!workCenterId || m.workCenterId === workCenterId) && (!filter || filter(m)),
      ),
    [machines, workCenterId, filter],
  )
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select machine'}
      searchPlaceholder="Search machines"
      getKey={(x) => x.id}
      getLabel={(x) => `${x.code} · ${x.name}`}
      getDescription={(x) => `${orgName(x.workCenterId)} · ${x.state}`}
      getKeywords={(x) => [x.id, x.model]}
      getDisabledReason={(x) =>
        x.maintenanceState === 'in_maintenance'
          ? 'In maintenance'
          : x.maintenanceState === 'unavailable'
            ? 'Unavailable'
            : null
      }
    />
  )
}

function personDescription(p: Person, shiftName: (id: string | null) => string) {
  return `${ROLE_LABEL[p.role]}${p.shiftId ? ` · ${shiftName(p.shiftId)}` : ''}`
}

export function PersonPicker({ people, ...p }: Single & { people?: Person[] }) {
  const scoped = useScoped()
  const items = people ?? scoped.people
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select person'}
      searchPlaceholder="Search people"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) =>
        personDescription(x, (id) => (id ? (scoped.maps.shift.get(id)?.name ?? '') : ''))
      }
      getKeywords={(x) => [x.code, x.email]}
      renderIcon={(x) => <Avatar name={x.name} color={x.color} size="xs" />}
    />
  )
}

/** Operators only; people on leave are greyed out. */
export function OperatorsPicker({ workCenterId, ...p }: Multi & { workCenterId?: string | null }) {
  const scoped = useScoped()
  const items = useMemo(
    () =>
      scoped.operators.filter(
        (o) => !workCenterId || o.workCenterIds.includes(workCenterId) || o.workCenterIds.length === 0,
      ),
    [scoped.operators, workCenterId],
  )
  return (
    <MultiCombobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select operators'}
      searchPlaceholder="Search operators"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) =>
        personDescription(x, (id) => (id ? (scoped.maps.shift.get(id)?.name ?? '') : ''))
      }
      getDisabledReason={(x) => (x.availability === 'leave' ? 'On leave' : null)}
      renderIcon={(x) => <Avatar name={x.name} color={x.color} size="xs" />}
    />
  )
}

export function ShiftPicker(p: Single) {
  const { shifts } = useScoped()
  return (
    <Combobox
      {...p}
      items={shifts}
      placeholder={p.placeholder ?? 'Select shift'}
      searchPlaceholder="Search shifts"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${x.start}–${x.end}`}
    />
  )
}

export function ResourcesPicker({ kind, ...p }: Multi & { kind?: 'tool' | 'mold' | 'fixture' | 'utility' }) {
  const { resources, orgName } = useScoped()
  const items = useMemo(
    () => resources.filter((r) => r.status !== 'retired' && (!kind || r.kind === kind)),
    [resources, kind],
  )
  return (
    <MultiCombobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? `Select ${kind ?? 'resource'}s`}
      searchPlaceholder="Search resources"
      getKey={(x) => x.id}
      getLabel={(x) => `${x.code} · ${x.name}`}
      getDescription={(x) => `${orgName(x.workCenterId)} · ${x.status}`}
      getDisabledReason={(x) => (x.status === 'maintenance' ? 'In maintenance' : null)}
    />
  )
}

export function LocationPicker({ kind, ...p }: Single & { kind?: string }) {
  const { inventoryLocations } = useScoped()
  const items = useMemo(
    () => inventoryLocations.filter((l) => !kind || l.kind === kind),
    [inventoryLocations, kind],
  )
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select location'}
      searchPlaceholder="Search locations"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${x.kind.replace('_', ' ')}`}
    />
  )
}

export function ReasonPicker({
  kind,
  ...p
}: Single & { kind: 'scrap' | 'reject' | 'rework' | 'hold' | 'pause' | 'downtime' | 'change' | 'return' }) {
  const { reasonCodes } = useScoped()
  const items = useMemo(() => reasonCodes.filter((r) => r.kind === kind && r.active), [reasonCodes, kind])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select reason'}
      searchPlaceholder="Search reasons"
      getKey={(x) => x.id}
      getLabel={(x) => x.label}
      getDescription={(x) => x.code}
    />
  )
}

export function DefectCodePicker(p: Single) {
  const { defectCodes } = useScoped()
  const items = useMemo(() => defectCodes.filter((d) => d.active), [defectCodes])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select defect'}
      searchPlaceholder="Search defects"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${x.category} · ${x.severity}`}
    />
  )
}

export function LotPicker({ materialId, ...p }: Single & { materialId?: string | null }) {
  const { materialLots, locationName, materialName } = useScoped()
  const items = useMemo(
    () => materialLots.filter((l) => (!materialId || l.materialId === materialId) && l.status !== 'consumed'),
    [materialLots, materialId],
  )
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select lot'}
      searchPlaceholder="Search lots"
      getKey={(x) => x.id}
      getLabel={(x) => x.code}
      getDescription={(x) =>
        `${materialName(x.materialId)} · ${x.qty} · ${locationName(x.locationId)} · ${x.status}`
      }
    />
  )
}

export function MoPicker({ filter, ...p }: Single & { filter?: (moStatus: string) => boolean }) {
  const { manufacturingOrders, productName } = useScoped()
  const items = useMemo(
    () =>
      [...manufacturingOrders]
        .filter((m) => !filter || filter(m.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [manufacturingOrders, filter],
  )
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select manufacturing order'}
      searchPlaceholder="Search orders"
      getKey={(x) => x.id}
      getLabel={(x) => x.code}
      getDescription={(x) => `${productName(x.productId)} × ${x.qty} · ${x.status}`}
    />
  )
}
