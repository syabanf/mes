import type { Person } from '@mes/types'
import { ROLE_LABEL, STRATEGY_SHORT } from '@mes/types'
import { Avatar, Combobox } from '@mes/ui'
import { useMemo } from 'react'
import { useMobileScope } from '../state/scope'

type Single = {
  id?: string
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  clearable?: boolean
  invalid?: boolean
  variant?: 'default' | 'soft' | 'inline'
  className?: string
  'aria-label'?: string
}

/** Operators to simulate a badge scan with. Takes its own list because the login screen has no scope yet. */
export function OperatorPicker({
  people,
  shiftName,
  ...p
}: Single & { people: Person[]; shiftName: (id: string | null) => string }) {
  return (
    <Combobox
      {...p}
      items={people}
      placeholder={p.placeholder ?? 'Pick an operator'}
      searchPlaceholder="Search name or badge"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) =>
        `${ROLE_LABEL[x.role]} · ${x.badge}${x.shiftId ? ` · ${shiftName(x.shiftId)}` : ''}`
      }
      getKeywords={(x) => [x.badge, x.code]}
      renderIcon={(x) => <Avatar name={x.name} color={x.color} size="xs" />}
    />
  )
}

export function ProductPicker(p: Single) {
  const { products } = useMobileScope()
  const items = useMemo(() => products.filter((x) => x.active), [products])
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Select product'}
      searchPlaceholder="Search code or name"
      getKey={(x) => x.id}
      getLabel={(x) => x.name}
      getDescription={(x) => `${x.code} · ${STRATEGY_SHORT[x.defaultStrategy]}`}
      getKeywords={(x) => [x.code]}
    />
  )
}

export function LotPicker({ materialId, ...p }: Single & { materialId: string }) {
  const { materialLots, locationName } = useMobileScope()
  const items = useMemo(
    () => materialLots.filter((l) => l.materialId === materialId && l.status !== 'consumed' && l.qty > 0),
    [materialLots, materialId],
  )
  return (
    <Combobox
      {...p}
      items={items}
      placeholder={p.placeholder ?? 'Scan or pick a lot'}
      searchPlaceholder="Search lot code"
      getKey={(x) => x.id}
      getLabel={(x) => x.code}
      getDescription={(x) => `${x.qty} left · ${locationName(x.locationId)} · ${x.status}`}
    />
  )
}

export function ReasonPicker({
  kind,
  ...p
}: Single & { kind: 'scrap' | 'reject' | 'rework' | 'hold' | 'pause' | 'downtime' | 'change' | 'return' }) {
  const { reasonCodes } = useMobileScope()
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
  const { defectCodes } = useMobileScope()
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
