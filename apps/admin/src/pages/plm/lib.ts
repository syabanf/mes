import { type AppState, toMs } from '@mes/fixtures'
import type {
  Bom,
  Eco,
  ManufacturingOrder,
  Material,
  ProductRevision,
  RevisionState,
  SpecKind,
} from '@mes/types'
import { OPEN_MO_STATUSES } from '@mes/types'

export const REVISION_STATES: RevisionState[] = ['draft', 'review', 'released', 'obsolete']

export type EcoAffects = Eco['affects'][number]
export const ECO_AFFECTS: EcoAffects[] = ['bom', 'bor', 'bop', 'spec', 'work_instruction']
export const ECO_AFFECTS_LABEL: Record<EcoAffects, string> = {
  bom: 'BOM',
  bor: 'BOR',
  bop: 'BOP',
  spec: 'Specification',
  work_instruction: 'Work instruction',
}

/** Product detail tabs, also the value carried in `?tab=`. */
export type ProductTab = 'overview' | 'bom' | 'bor' | 'bop' | 'spec' | 'wi' | 'eco'
export const PRODUCT_TABS: ProductTab[] = ['overview', 'bom', 'bor', 'bop', 'spec', 'wi', 'eco']
export const productTabPath = (productId: string, tab: ProductTab) => `/plm/products/${productId}?tab=${tab}`

/** Case-insensitive match of a query against any of the given fields. */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f && f.toLowerCase().includes(q))
}

/** Revisions of one product, oldest first. */
export const revisionsOf = (revisions: readonly ProductRevision[], productId: string) =>
  revisions.filter((r) => r.productId === productId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** Material cost of one finished unit, including the scrap allowance. */
export function bomUnitCost(bom: Bom, material: (id: string) => Material | undefined): number {
  return bom.items.reduce(
    (sum, item) =>
      sum + item.qtyPerUnit * (1 + item.scrapFactor) * (material(item.materialId)?.unitCostIdr ?? 0),
    0,
  )
}

export const openMosFor = (mos: readonly ManufacturingOrder[], productId: string) =>
  mos.filter((m) => m.productId === productId && OPEN_MO_STATUSES.includes(m.status))

export interface MoImpact {
  open: ManufacturingOrder[]
  released: ManufacturingOrder[]
  running: ManufacturingOrder[]
  future: ManufacturingOrder[]
}

/** Orders of the ECO's product, split by how the release will reach them. */
export function moImpact(
  mos: readonly ManufacturingOrder[],
  productId: string,
  effectiveFrom: string | null,
): MoImpact {
  const own = mos.filter((m) => m.productId === productId)
  const cutoff = effectiveFrom ? toMs(effectiveFrom) : null
  return {
    open: own.filter((m) => m.status === 'draft' || m.status === 'planned'),
    released: own.filter((m) => m.status === 'released'),
    running: own.filter((m) => m.status === 'in_progress' || m.status === 'on_hold'),
    future: own.filter(
      (m) => OPEN_MO_STATUSES.includes(m.status) && cutoff !== null && toMs(m.plannedStart) > cutoff,
    ),
  }
}

/** Seconds → "45 s" or "1m 30s" for cycle times. */
export function fmtSeconds(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`
  const m = Math.floor(sec / 60)
  const rest = Math.round(sec % 60)
  return rest ? `${m}m ${rest}s` : `${m}m`
}

// ─── Engineering documents (BOM, BOR, BOP, specs, work instructions) ──

export type DocKind = 'bom' | 'bor' | 'bop'
export const DOC_KIND_LABEL: Record<DocKind, string> = { bom: 'BOM', bor: 'BOR', bop: 'BOP' }
export const DOC_LIST_PATH: Record<DocKind, string> = { bom: '/plm/bom', bor: '/plm/bor', bop: '/plm/bop' }

/** Items can change while the document is a draft or in review. Released and obsolete are locked. */
export const isEditableState = (state: RevisionState) => state === 'draft' || state === 'review'

/** R03 → R04. A revision without a trailing number gets "-2". */
export function bumpRev(rev: string): string {
  const m = /^(.*?)(\d+)$/.exec(rev)
  if (!m) return `${rev}-2`
  return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2]!.length, '0')}`
}

/** The revision after the highest one the product already has in this collection, R01 when none. */
export function nextRev(docs: readonly { productId: string; rev: string }[], productId: string): string {
  const revs = docs.filter((d) => d.productId === productId).map((d) => d.rev)
  if (!revs.length) return 'R01'
  return bumpRev(revs.sort().at(-1)!)
}

/** Product code without dashes, the middle part of every document code: GB-001 → GB001. */
const codeStem = (productCode: string) => productCode.replace(/-/g, '')

export const docCode = (kind: DocKind, productCode: string, rev: string) =>
  `${DOC_KIND_LABEL[kind]}-${codeStem(productCode)}-${rev}`

const SPEC_SUFFIX: Record<SpecKind, string> = { product: 'PRD', process: 'PRC', quality: 'QLT' }
export const specCode = (productCode: string, kind: SpecKind) =>
  `SPEC-${codeStem(productCode)}-${SPEC_SUFFIX[kind]}`
export const wiCode = (productCode: string, operationSeq: number) =>
  `WI-${codeStem(productCode)}-${operationSeq}`

/** Swap the trailing "-R03" of a code for the new revision, or append it when the code has none. */
export const withRev = (code: string, rev: string) =>
  /-R\d+$/.test(code) ? code.replace(/-R\d+$/, `-${rev}`) : `${code}-${rev}`

/** Where a document is referenced: product revisions and orders whose frozen snapshot points at it. */
export interface DocUsage {
  revisions: ProductRevision[]
  mos: ManufacturingOrder[]
}

type UsageState = Pick<AppState, 'productRevisions' | 'manufacturingOrders'>

export function docUsage(state: UsageState, field: 'bomId' | 'borId' | 'bopId', id: string): DocUsage {
  return {
    revisions: state.productRevisions.filter((r) => r[field] === id),
    mos: state.manufacturingOrders.filter((m) => m.snapshot?.[field] === id),
  }
}

export function listUsage(state: UsageState, field: 'specIds' | 'workInstructionIds', id: string): DocUsage {
  return {
    revisions: state.productRevisions.filter((r) => r[field].includes(id)),
    mos: state.manufacturingOrders.filter((m) => m.snapshot?.[field].includes(id) ?? false),
  }
}

/** Newline separated text → trimmed non-empty lines, for checklist editors. */
export const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
