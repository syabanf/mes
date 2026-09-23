import type { Machine, OrgKind } from '@mes/types'
import { ORG_KINDS } from '@mes/types'
import { useSearchParams } from 'react-router'
import type { PickItem } from './entity'

/** Entity tab inside a domain panel, kept in `?tab=` so links can deep-link to it. */
export function usePanelTab<T extends string>(tabs: readonly { value: T }[]): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const current = tabs.find((t) => t.value === raw)?.value ?? tabs[0]!.value
  const set = (tab: T) =>
    setParams(
      (p) => {
        p.set('tab', tab)
        return p
      },
      { replace: true },
    )
  return [current, set]
}

export const DOMAINS = [
  {
    key: 'organization',
    label: 'Organization',
    description: 'Sites and the plant, area, line, work center and zone hierarchy.',
  },
  {
    key: 'commercial',
    label: 'Commercial',
    description: 'Customers and suppliers, with their external ids.',
  },
  {
    key: 'product-material',
    label: 'Product & material',
    description: 'Products, materials, categories and units of measure.',
  },
  {
    key: 'engineering',
    label: 'Engineering',
    description: 'What PLM holds per product: BOM, BOR, BOP, specifications and work instructions.',
  },
  {
    key: 'resources',
    label: 'Resources',
    description: 'Machines with their canonical id, plus tools, molds, fixtures and utilities.',
  },
  {
    key: 'people',
    label: 'People',
    description: 'Operators, skills, qualification levels and the role matrix.',
  },
  {
    key: 'planning',
    label: 'Planning',
    description: 'Shifts, the production calendar and production policies.',
  },
  { key: 'inventory', label: 'Inventory', description: 'Locations, stock policies, lot and serial rules.' },
  { key: 'quality', label: 'Quality', description: 'Defect codes and inspection plans.' },
  { key: 'system', label: 'System', description: 'Reason codes, numbering, users and integration mappings.' },
] as const

export type DomainKey = (typeof DOMAINS)[number]['key']

export const isDomain = (value: string | undefined): value is DomainKey =>
  DOMAINS.some((d) => d.key === value)

/** Next org kind below a parent: plant → area → line → work_center → zone. */
export function childKind(parent: OrgKind | null): OrgKind | null {
  if (!parent) return 'plant'
  const idx = ORG_KINDS.indexOf(parent)
  return ORG_KINDS[idx + 1] ?? null
}

/** MACHINE-00042 style canonical id, one above the highest existing. */
export function nextMachineId(machines: readonly Machine[]): string {
  let max = 0
  for (const m of machines) {
    const n = Number(m.id.split('-').at(-1))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `MACHINE-${String(max + 1).padStart(5, '0')}`
}

export const pick = <T extends { id: string }>(
  items: readonly T[],
  label: (x: T) => string,
  description?: (x: T) => string,
): PickItem[] => items.map((x) => ({ id: x.id, label: label(x), description: description?.(x) }))
