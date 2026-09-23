// Organization, commercial partners, items, locations and the system master tables.
import type {
  CalendarDay,
  Category,
  Company,
  Customer,
  DefectCode,
  FulfillmentStrategy,
  InventoryLocation,
  InventoryLocationKind,
  InventoryPolicy,
  LotRule,
  Material,
  MaterialClass,
  NumberingSequence,
  OrgKind,
  OrgNode,
  Product,
  ProductionPolicy,
  ReasonCode,
  ReasonKind,
  SerialRule,
  Settings,
  Site,
  Supplier,
  Uom,
  UomConversion,
} from '../../packages/types/src/index.ts'
import { dayKey } from '../../packages/fixtures/src/dates.ts'
import { DAY, SITES, SITE_JKT, SITE_SBY, TODAY, isSunday, siteKey } from './common.ts'

export const company: Company = {
  id: 'co-lmn',
  name: 'PT Logam Mulia Nusantara',
  legalName: 'PT Logam Mulia Nusantara Tbk',
}

export const sites: Site[] = [
  {
    id: SITE_JKT,
    code: 'JKT',
    name: 'Refinery Jakarta',
    city: 'Jakarta (Pulogadung)',
    timezone: 'Asia/Jakarta',
  },
  { id: SITE_SBY, code: 'SBY', name: 'Plant Surabaya', city: 'Surabaya', timezone: 'Asia/Jakarta' },
]

// ─── Org hierarchy ──────────────────────────────────────────────

type OrgSpec = [suffix: string, parent: string | null, kind: OrgKind, code: string, name: string]
const o = (...spec: OrgSpec): OrgSpec => spec

function siteOrg(siteId: string): OrgNode[] {
  const full = siteId === SITE_JKT
  const k = siteKey(siteId)
  const specs: OrgSpec[] = [
    o('plant', null, 'plant', full ? 'P1' : 'P2', full ? 'Plant 1' : 'Plant 2'),
    o('cast', 'plant', 'area', 'CAST', 'Casting hall'),
    o('fin', 'plant', 'area', 'FIN', 'Finishing hall'),
    o('qc', 'plant', 'area', 'QCL', 'QC laboratory'),
    o('pack', 'plant', 'area', 'PACK', 'Packing'),
    o('line-a', 'cast', 'line', 'LINE-A', 'Line A (small bars)'),
    ...(full
      ? [
          o('line-b', 'cast', 'line', 'LINE-B', 'Line B (large bars)'),
          o('line-c', 'cast', 'line', 'LINE-C', 'Line C (silver)'),
        ]
      : []),
    o('line-fin', 'fin', 'line', 'LINE-F', 'Finishing line'),
    o('line-qc', 'qc', 'line', 'LINE-Q', 'QC bench'),
    o('line-pack', 'pack', 'line', 'LINE-P', 'Packing line'),
    o('wc-cast', 'line-a', 'work_center', 'WC-CAST', 'Casting'),
    o('wc-cool', 'line-a', 'work_center', 'WC-COOL', 'Cooling'),
    o('wc-press', 'line-fin', 'work_center', 'WC-PRESS', 'Pressing'),
    o('wc-pol', 'line-fin', 'work_center', 'WC-POL', 'Polishing'),
    ...(full ? [o('wc-eng', 'line-fin', 'work_center', 'WC-ENG', 'Engraving')] : []),
    o('wc-qc', 'line-qc', 'work_center', 'WC-QC', 'Quality control'),
    o('wc-pack', 'line-pack', 'work_center', 'WC-PACK', 'Packaging'),
    o('zone-cast', 'wc-cast', 'zone', 'Z-CAST', 'Casting buffer'),
    o('zone-press', 'wc-press', 'zone', 'Z-PRESS', 'Press buffer'),
    o('zone-pol', 'wc-pol', 'zone', 'Z-POL', 'Polishing buffer'),
    ...(full ? [o('zone-pack', 'wc-pack', 'zone', 'Z-PACK', 'Packing buffer')] : []),
  ]
  return specs.map(([suffix, parent, kind, code, name]) => ({
    id: `org-${k}-${suffix}`,
    siteId,
    parentId: parent ? `org-${k}-${parent}` : null,
    kind,
    code,
    name,
    ...(kind === 'work_center' ? { capacityHoursPerShift: 7.5 } : {}),
  }))
}

export const orgNodes: OrgNode[] = SITES.flatMap(siteOrg)

// ─── Commercial ─────────────────────────────────────────────────

export const customers: Customer[] = [
  {
    id: 'cus-abc',
    code: 'C-001',
    name: 'PT ABC Indonesia',
    city: 'Jakarta',
    contact: 'Maria Tan',
    email: 'procurement@abc-indonesia.co.id',
    externalId: 'CRM-10021',
  },
  {
    id: 'cus-mandala',
    code: 'C-002',
    name: 'Bank Mandala Sejahtera',
    city: 'Jakarta',
    contact: 'Rudi Hartono',
    email: 'treasury@mandalasejahtera.co.id',
    externalId: 'CRM-10034',
  },
  {
    id: 'cus-nusyar',
    code: 'C-003',
    name: 'Bank Nusantara Syariah',
    city: 'Surabaya',
    contact: 'Aisyah Rahma',
    email: 'emas@nusantarasyariah.co.id',
    externalId: 'CRM-10047',
  },
  {
    id: 'cus-cahaya',
    code: 'C-004',
    name: 'Toko Emas Cahaya Abadi',
    city: 'Surabaya',
    contact: 'Hendry Lim',
    email: 'order@cahayaabadi.id',
    externalId: 'CRM-10052',
  },
  {
    id: 'cus-mutiara',
    code: 'C-005',
    name: 'Galeri Perhiasan Mutiara',
    city: 'Bandung',
    contact: 'Sinta Wulandari',
    email: 'purchasing@galerimutiara.id',
    externalId: 'CRM-10063',
  },
  {
    id: 'cus-investa',
    code: 'C-006',
    name: 'PT Investa Logam Digital',
    city: 'Jakarta',
    contact: 'Kevin Wijaya',
    email: 'ops@investalogam.id',
    externalId: 'CRM-10078',
  },
  {
    id: 'cus-koperasi',
    code: 'C-007',
    name: 'Koperasi Emas Rakyat',
    city: 'Yogyakarta',
    contact: 'Sugeng Riyanto',
    email: 'pengadaan@koperasiemas.or.id',
    externalId: null,
  },
  {
    id: 'cus-permata',
    code: 'C-008',
    name: 'CV Permata Jaya',
    city: 'Semarang',
    contact: 'Linda Kusuma',
    email: 'permatajaya@gmail.com',
    externalId: 'CRM-10091',
  },
]

export const suppliers: Supplier[] = [
  {
    id: 'sup-emas',
    code: 'S-001',
    name: 'PT Emas Murni Sentosa',
    city: 'Jakarta',
    contact: 'Yohanes Halim',
    materialIds: ['mat-au9999'],
    externalId: 'ERP-V-2001',
  },
  {
    id: 'sup-bullion',
    code: 'S-002',
    name: 'Nusantara Bullion Trading',
    city: 'Surabaya',
    contact: 'Dian Permata',
    materialIds: ['mat-au9999', 'mat-ag999'],
    externalId: 'ERP-V-2002',
  },
  {
    id: 'sup-argentum',
    code: 'S-003',
    name: 'Argentum Asia Pte Ltd',
    city: 'Singapore',
    contact: 'Wei Ling Chua',
    materialIds: ['mat-ag999'],
    externalId: 'ERP-V-2003',
  },
  {
    id: 'sup-kimia',
    code: 'S-004',
    name: 'PT Kimia Cor Indonesia',
    city: 'Jakarta',
    contact: 'Bagus Prakoso',
    materialIds: ['mat-flux', 'mat-polcmp', 'mat-argon', 'mat-solvent'],
    externalId: 'ERP-V-2004',
  },
  {
    id: 'sup-grafit',
    code: 'S-005',
    name: 'PT Grafit Prima',
    city: 'Surabaya',
    contact: 'Ratih Puspita',
    materialIds: ['mat-liner'],
    externalId: 'ERP-V-2005',
  },
  {
    id: 'sup-kemasan',
    code: 'S-006',
    name: 'PT Kemasan Aman Sejahtera',
    city: 'Jakarta',
    contact: 'Andi Saputra',
    materialIds: ['mat-blister-s', 'mat-blister-m', 'mat-blister-l', 'mat-box', 'mat-carton'],
    externalId: 'ERP-V-2006',
  },
  {
    id: 'sup-secureprint',
    code: 'S-007',
    name: 'SecurePrint Asia Pte Ltd',
    city: 'Singapore',
    contact: 'Daniel Ong',
    materialIds: ['mat-holo', 'mat-cert'],
    externalId: 'ERP-V-2007',
  },
]

// ─── Items ──────────────────────────────────────────────────────

export const categories: Category[] = [
  { id: 'cat-gold-bar', code: 'GOLD', name: 'Gold bars', kind: 'product' },
  { id: 'cat-silver-bar', code: 'SILVER', name: 'Silver bars', kind: 'product' },
  { id: 'cat-precious', code: 'PM', name: 'Precious metal', kind: 'material' },
  { id: 'cat-casting', code: 'CAST', name: 'Casting consumables', kind: 'material' },
  { id: 'cat-packaging', code: 'PACK', name: 'Packaging', kind: 'material' },
  { id: 'cat-utility', code: 'UTIL', name: 'Utility consumables', kind: 'material' },
]

export const uoms: Uom[] = [
  { id: 'uom-pcs', code: 'pcs', name: 'Pieces', precision: 0 },
  { id: 'uom-g', code: 'g', name: 'Gram', precision: 3 },
  { id: 'uom-kg', code: 'kg', name: 'Kilogram', precision: 3 },
  { id: 'uom-ml', code: 'ml', name: 'Millilitre', precision: 0 },
  { id: 'uom-l', code: 'l', name: 'Litre', precision: 2 },
  { id: 'uom-roll', code: 'roll', name: 'Roll', precision: 0 },
  { id: 'uom-box', code: 'box', name: 'Box', precision: 0 },
]

export const uomConversions: UomConversion[] = [
  { id: 'uc-kg-g', fromUomId: 'uom-kg', toUomId: 'uom-g', factor: 1000, itemId: null },
  { id: 'uc-l-ml', fromUomId: 'uom-l', toUomId: 'uom-ml', factor: 1000, itemId: null },
  { id: 'uc-box-pcs-gb001', fromUomId: 'uom-box', toUomId: 'uom-pcs', factor: 50, itemId: 'prod-gb001' },
  { id: 'uc-roll-pcs-holo', fromUomId: 'uom-roll', toUomId: 'uom-pcs', factor: 1000, itemId: 'mat-holo' },
]

export interface ProductSpec {
  key: string
  code: string
  name: string
  w: number
  metal: 'au' | 'ag'
  strategy: FulfillmentStrategy
  serial: boolean
  rev: string
  /** Blister card size class. */
  size: 'S' | 'M' | 'L'
}

export const PRODUCT_SPECS: ProductSpec[] = [
  {
    key: 'gb05',
    code: 'GB-0.5',
    name: 'Gold Bar 0.5g',
    w: 0.5,
    metal: 'au',
    strategy: 'mts',
    serial: false,
    rev: 'R02',
    size: 'S',
  },
  {
    key: 'gb001',
    code: 'GB-001',
    name: 'Gold Bar 1g',
    w: 1,
    metal: 'au',
    strategy: 'mts',
    serial: false,
    rev: 'R02',
    size: 'S',
  },
  {
    key: 'gb002',
    code: 'GB-002',
    name: 'Gold Bar 2g',
    w: 2,
    metal: 'au',
    strategy: 'mts',
    serial: false,
    rev: 'R02',
    size: 'S',
  },
  {
    key: 'gb005',
    code: 'GB-005',
    name: 'Gold Bar 5g',
    w: 5,
    metal: 'au',
    strategy: 'mts',
    serial: false,
    rev: 'R03',
    size: 'S',
  },
  {
    key: 'gb010',
    code: 'GB-010',
    name: 'Gold Bar 10g',
    w: 10,
    metal: 'au',
    strategy: 'mto',
    serial: false,
    rev: 'R03',
    size: 'M',
  },
  {
    key: 'gb025',
    code: 'GB-025',
    name: 'Gold Bar 25g',
    w: 25,
    metal: 'au',
    strategy: 'mto',
    serial: true,
    rev: 'R02',
    size: 'M',
  },
  {
    key: 'gb050',
    code: 'GB-050',
    name: 'Gold Bar 50g',
    w: 50,
    metal: 'au',
    strategy: 'mto',
    serial: true,
    rev: 'R02',
    size: 'L',
  },
  {
    key: 'gb100',
    code: 'GB-100',
    name: 'Gold Bar 100g',
    w: 100,
    metal: 'au',
    strategy: 'mto',
    serial: true,
    rev: 'R03',
    size: 'L',
  },
  {
    key: 'sb100',
    code: 'SB-100',
    name: 'Silver Bar 100g',
    w: 100,
    metal: 'ag',
    strategy: 'hybrid',
    serial: false,
    rev: 'R02',
    size: 'L',
  },
  {
    key: 'sb250',
    code: 'SB-250',
    name: 'Silver Bar 250g',
    w: 250,
    metal: 'ag',
    strategy: 'mto',
    serial: true,
    rev: 'R02',
    size: 'L',
  },
]

export const productId = (key: string) => `prod-${key}`
export const productSpec = (id: string): ProductSpec => PRODUCT_SPECS.find((p) => productId(p.key) === id)!
export const revisionId = (key: string, rev: string) => `rev-${key}-${rev.toLowerCase()}`
/** Products the Surabaya plant is tooled for. */
export const SBY_PRODUCT_KEYS = ['gb05', 'gb001', 'gb002', 'gb005']

export const products: Product[] = PRODUCT_SPECS.map((p) => ({
  id: productId(p.key),
  code: p.code,
  name: p.name,
  categoryId: p.metal === 'au' ? 'cat-gold-bar' : 'cat-silver-bar',
  uomId: 'uom-pcs',
  unitWeightG: p.w,
  defaultStrategy: p.strategy,
  lotControlled: true,
  serialControlled: p.serial,
  currentRevisionId: revisionId(p.key, p.rev),
  standardCostIdr:
    p.metal === 'au' ? Math.round(p.w * 1_900_000 * 1.03 + 25_000) : Math.round(p.w * 15_500 + 45_000),
  active: true,
}))

interface MaterialSpec {
  id: string
  code: string
  name: string
  cls: MaterialClass
  cat: string
  uom: string
  lot: boolean
  supplier: string
  cost: number
}

const MATERIAL_SPECS: MaterialSpec[] = [
  {
    id: 'mat-au9999',
    code: 'AU-9999',
    name: 'Gold granule 99.99',
    cls: 'raw',
    cat: 'cat-precious',
    uom: 'uom-g',
    lot: true,
    supplier: 'sup-emas',
    cost: 1_900_000,
  },
  {
    id: 'mat-ag999',
    code: 'AG-999',
    name: 'Silver granule 99.9',
    cls: 'raw',
    cat: 'cat-precious',
    uom: 'uom-g',
    lot: true,
    supplier: 'sup-argentum',
    cost: 15_500,
  },
  {
    id: 'mat-flux',
    code: 'FLX-01',
    name: 'Casting flux',
    cls: 'consumable',
    cat: 'cat-casting',
    uom: 'uom-g',
    lot: true,
    supplier: 'sup-kimia',
    cost: 850,
  },
  {
    id: 'mat-liner',
    code: 'CRU-LNR',
    name: 'Graphite crucible liner',
    cls: 'consumable',
    cat: 'cat-casting',
    uom: 'uom-pcs',
    lot: false,
    supplier: 'sup-grafit',
    cost: 1_250_000,
  },
  {
    id: 'mat-polcmp',
    code: 'POL-CMP',
    name: 'Polishing compound',
    cls: 'consumable',
    cat: 'cat-casting',
    uom: 'uom-g',
    lot: true,
    supplier: 'sup-kimia',
    cost: 420,
  },
  {
    id: 'mat-blister-s',
    code: 'BLS-S',
    name: 'Blister card small (0.5-5g)',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: true,
    supplier: 'sup-kemasan',
    cost: 3_200,
  },
  {
    id: 'mat-blister-m',
    code: 'BLS-M',
    name: 'Blister card medium (10-25g)',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: true,
    supplier: 'sup-kemasan',
    cost: 4_100,
  },
  {
    id: 'mat-blister-l',
    code: 'BLS-L',
    name: 'Blister card large (50g+, silver)',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: true,
    supplier: 'sup-kemasan',
    cost: 5_600,
  },
  {
    id: 'mat-holo',
    code: 'HOL-SEC',
    name: 'Security hologram seal',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: true,
    supplier: 'sup-secureprint',
    cost: 1_800,
  },
  {
    id: 'mat-cert',
    code: 'CRT-CARD',
    name: 'Certificate card',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: true,
    supplier: 'sup-secureprint',
    cost: 2_400,
  },
  {
    id: 'mat-box',
    code: 'BOX-RTL',
    name: 'Retail box',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: false,
    supplier: 'sup-kemasan',
    cost: 9_500,
  },
  {
    id: 'mat-argon',
    code: 'GAS-ARG',
    name: 'Argon gas (laser engraving)',
    cls: 'consumable',
    cat: 'cat-utility',
    uom: 'uom-l',
    lot: false,
    supplier: 'sup-kimia',
    cost: 95,
  },
  {
    id: 'mat-solvent',
    code: 'SLV-CLN',
    name: 'Cleaning solvent',
    cls: 'consumable',
    cat: 'cat-casting',
    uom: 'uom-ml',
    lot: true,
    supplier: 'sup-kimia',
    cost: 60,
  },
  {
    id: 'mat-carton',
    code: 'CTN-PCK',
    name: 'Packing carton (50 pcs)',
    cls: 'packaging',
    cat: 'cat-packaging',
    uom: 'uom-pcs',
    lot: false,
    supplier: 'sup-kemasan',
    cost: 6_500,
  },
]

export const materials: Material[] = MATERIAL_SPECS.map((m) => ({
  id: m.id,
  code: m.code,
  name: m.name,
  categoryId: m.cat,
  materialClass: m.cls,
  uomId: m.uom,
  lotControlled: m.lot,
  supplierId: m.supplier,
  unitCostIdr: m.cost,
  active: true,
}))

// ─── Inventory master ───────────────────────────────────────────

type LocSpec = [suffix: string, code: string, name: string, kind: InventoryLocationKind, org: string | null]
const l = (...spec: LocSpec): LocSpec => spec

function siteLocations(siteId: string): InventoryLocation[] {
  const full = siteId === SITE_JKT
  const k = siteKey(siteId)
  const specs: LocSpec[] = [
    l('wh01', 'WH-01', 'Main warehouse', 'warehouse', null),
    l('stg01', 'STG-01', 'Production staging', 'staging', 'cast'),
    l('fl01', 'FL-01', 'Floor stock', 'floor', 'plant'),
    l('lb-a', 'LB-A', 'Line A buffer', 'line_buffer', 'line-a'),
    ...(full
      ? [
          l('lb-b', 'LB-B', 'Line B buffer', 'line_buffer', 'line-b'),
          l('lb-c', 'LB-C', 'Line C buffer', 'line_buffer', 'line-c'),
        ]
      : []),
    l('mb-press', 'MB-PRESS', 'Press machine buffer', 'machine_buffer', 'wc-press'),
    l('mb-pol', 'MB-POL', 'Polishing machine buffer', 'machine_buffer', 'wc-pol'),
    l('qch01', 'QCH-01', 'QC hold cage', 'qc_hold', 'qc'),
    l('rwk01', 'RWK-01', 'Rework area', 'rework', 'fin'),
    l('trf01', 'TRF-01', 'Transfer area', 'transfer', null),
    l('fg01', 'FG-01', 'Finished goods vault', 'finished_goods', null),
    l('ret01', 'RET-01', 'Return location', 'return', null),
  ]
  return specs.map(([suffix, code, name, kind, org]) => ({
    id: `loc-${k}-${suffix}`,
    siteId,
    code,
    name,
    kind,
    orgNodeId: org ? `org-${k}-${org}` : null,
  }))
}

export const inventoryLocations: InventoryLocation[] = SITES.flatMap(siteLocations)

/** Line buffer that receives WIP for a product at a site. */
export function lineBufferFor(siteId: string, key: string): string {
  if (siteId !== SITE_JKT) return `loc-sby-lb-a`
  const spec = PRODUCT_SPECS.find((p) => p.key === key)!
  return spec.metal === 'ag' ? 'loc-jkt-lb-c' : spec.w <= 5 ? 'loc-jkt-lb-a' : 'loc-jkt-lb-b'
}

/** Scheduling line for a product at a site. */
export function lineFor(siteId: string, key: string): string {
  if (siteId !== SITE_JKT) return 'org-sby-line-a'
  const spec = PRODUCT_SPECS.find((p) => p.key === key)!
  return spec.metal === 'ag' ? 'org-jkt-line-c' : spec.w <= 5 ? 'org-jkt-line-a' : 'org-jkt-line-b'
}

const POLICY: Record<
  string,
  [safety: number, min: number, reorder: number, max: number, replenish: number, multiple: number]
> = {
  gb05: [3000, 5000, 6000, 20000, 10000, 500],
  gb001: [5000, 8000, 10000, 30000, 15000, 500],
  gb002: [2000, 3000, 4000, 12000, 6000, 500],
  gb005: [1500, 2500, 3000, 10000, 5000, 250],
  sb100: [300, 500, 600, 2000, 1000, 100],
}

export const inventoryPolicies: InventoryPolicy[] = SITES.flatMap((siteId) =>
  Object.entries(POLICY)
    .filter(([key]) => siteId === SITE_JKT || SBY_PRODUCT_KEYS.includes(key))
    .map(([key, [safetyStock, minStock, reorderPoint, maxStock, replenishQty, productionMultiple]]) => {
      const f = siteId === SITE_JKT ? 1 : 0.5
      return {
        id: `inv-${siteKey(siteId)}-${key}`,
        siteId,
        productId: productId(key),
        safetyStock: safetyStock * f,
        minStock: minStock * f,
        reorderPoint: reorderPoint * f,
        maxStock: maxStock * f,
        replenishQty: replenishQty * f,
        productionMultiple,
      }
    }),
)

export const lotRules: LotRule[] = [
  { id: 'lr-au9999', itemId: 'mat-au9999', itemKind: 'material', pattern: 'LOT-{seq}', expiryDays: null },
  { id: 'lr-ag999', itemId: 'mat-ag999', itemKind: 'material', pattern: 'LOT-{seq}', expiryDays: null },
  { id: 'lr-flux', itemId: 'mat-flux', itemKind: 'material', pattern: 'LOT-{seq}', expiryDays: 365 },
  { id: 'lr-polcmp', itemId: 'mat-polcmp', itemKind: 'material', pattern: 'LOT-{seq}', expiryDays: 365 },
  { id: 'lr-solvent', itemId: 'mat-solvent', itemKind: 'material', pattern: 'LOT-{seq}', expiryDays: 180 },
  { id: 'lr-holo', itemId: 'mat-holo', itemKind: 'material', pattern: 'LOT-{seq}', expiryDays: null },
  { id: 'lr-fg', itemId: 'prod-gb001', itemKind: 'product', pattern: '{mo}-FG', expiryDays: null },
]

/** nextSeq is patched once serials are generated. */
export const serialRules: SerialRule[] = PRODUCT_SPECS.filter((p) => p.serial).map((p) => ({
  id: `sr-${p.key}`,
  productId: productId(p.key),
  pattern: `LMN-${p.code.replace('-', '')}-{seq}`,
  nextSeq: 1,
}))

// ─── System master ──────────────────────────────────────────────

const REASONS: Record<ReasonKind, [code: string, label: string][]> = {
  scrap: [
    ['SCR-POR', 'Porosity'],
    ['SCR-UW', 'Underweight'],
    ['SCR-CRK', 'Crack'],
    ['SCR-SPL', 'Short pour / spill'],
    ['SCR-PKG', 'Packaging damage'],
  ],
  reject: [
    ['REJ-SUR', 'Surface defect'],
    ['REJ-DIM', 'Out of dimension'],
    ['REJ-PUR', 'Purity below spec'],
    ['REJ-ENG', 'Engraving misaligned'],
  ],
  rework: [
    ['RWK-POL', 'Re-polish'],
    ['RWK-PRS', 'Re-press'],
    ['RWK-CLN', 'Re-clean'],
  ],
  hold: [
    ['HLD-QC', 'Pending QC result'],
    ['HLD-DOC', 'Documentation missing'],
    ['HLD-CUS', 'Customer request'],
  ],
  pause: [
    ['PSE-MAT', 'Waiting for material'],
    ['PSE-MCH', 'Machine issue'],
    ['PSE-BRK', 'Shift break'],
    ['PSE-CHG', 'Changeover'],
  ],
  downtime: [
    ['DT-MEC', 'Mechanical failure'],
    ['DT-ELE', 'Electrical failure'],
    ['DT-UTL', 'Utility outage'],
    ['DT-PM', 'Planned maintenance'],
  ],
  change: [
    ['CHG-COST', 'Cost reduction'],
    ['CHG-QLT', 'Quality improvement'],
    ['CHG-SUP', 'Supplier change'],
    ['CHG-REG', 'Regulatory'],
  ],
  return: [
    ['RET-EXC', 'Excess issue'],
    ['RET-DMG', 'Damaged packaging'],
    ['RET-WRG', 'Wrong material'],
  ],
}

export const reasonCodes: ReasonCode[] = (Object.keys(REASONS) as ReasonKind[]).flatMap((kind) =>
  REASONS[kind].map(([code, label]) => ({ id: `rc-${code.toLowerCase()}`, kind, code, label, active: true })),
)
export const reason = (code: string) => `rc-${code.toLowerCase()}`

export const defectCodes: DefectCode[] = [
  {
    id: 'def-01',
    code: 'DEF-01',
    name: 'Surface scratch',
    category: 'Surface',
    severity: 'minor',
    active: true,
  },
  { id: 'def-02', code: 'DEF-02', name: 'Underweight', category: 'Weight', severity: 'major', active: true },
  { id: 'def-03', code: 'DEF-03', name: 'Porosity', category: 'Casting', severity: 'major', active: true },
  {
    id: 'def-04',
    code: 'DEF-04',
    name: 'Engraving misalignment',
    category: 'Marking',
    severity: 'minor',
    active: true,
  },
  {
    id: 'def-05',
    code: 'DEF-05',
    name: 'Discoloration',
    category: 'Surface',
    severity: 'minor',
    active: true,
  },
  {
    id: 'def-06',
    code: 'DEF-06',
    name: 'Blister damage',
    category: 'Packaging',
    severity: 'minor',
    active: true,
  },
  {
    id: 'def-07',
    code: 'DEF-07',
    name: 'Purity below spec',
    category: 'Purity',
    severity: 'critical',
    active: true,
  },
  { id: 'def-08', code: 'DEF-08', name: 'Edge burr', category: 'Pressing', severity: 'minor', active: true },
  {
    id: 'def-09',
    code: 'DEF-09',
    name: 'Dimension out of tolerance',
    category: 'Dimension',
    severity: 'major',
    active: true,
  },
  {
    id: 'def-10',
    code: 'DEF-10',
    name: 'Hologram missing',
    category: 'Packaging',
    severity: 'major',
    active: true,
  },
]

const NUMBERING: [entity: string, label: string, prefix: string][] = [
  ['mo', 'Manufacturing order', 'MO-2026-'],
  ['wo', 'Work order', 'WO-2026-'],
  ['demand', 'Demand', 'DMD-'],
  ['replenishment', 'Replenishment', 'RPL-'],
  ['lot', 'Material lot', 'LOT-'],
  ['fgReceipt', 'Finished goods receipt', 'FGR-'],
  ['hold', 'Quality hold', 'QH-'],
  ['inspection', 'Inspection', 'INS-'],
  ['rework', 'Rework order', 'RWK-'],
  ['maintenance', 'Maintenance record', 'CM-'],
  ['marketingOrder', 'Marketing order', 'MKT-2026-'],
  ['eco', 'Engineering change order', 'ECO-'],
  ['ncr', 'Non-conformance report', 'NCR-'],
]

/** Numbering rows with `next` set past the highest seeded sequence per entity. */
export const buildNumbering = (maxSeq: Record<string, number>): NumberingSequence[] =>
  NUMBERING.map(([entity, label, prefix]) => ({
    id: `num-${entity}`,
    entity,
    label,
    prefix,
    pattern: `${prefix}00000`,
    next: (maxSeq[entity] ?? 0) + 1,
  }))

export const settings: Settings = {
  wipAgingHours: 8,
  delayThresholdPct: 20,
  defaultSampleSize: 5,
  shiftSummaryLeadMin: 30,
}

export const calendarDays: CalendarDay[] = SITES.flatMap((siteId) => {
  const rows: CalendarDay[] = []
  for (let d = 0; d <= 42; d++) {
    const ms = TODAY + d * DAY
    if (isSunday(ms))
      rows.push({
        id: `cal-${siteKey(siteId)}-${dayKey(ms)}`,
        siteId,
        date: dayKey(ms),
        working: false,
        note: 'Sunday',
      })
  }
  rows.push({
    id: `cal-${siteKey(siteId)}-2026-10-12`,
    siteId,
    date: '2026-10-12',
    working: false,
    note: 'Company foundation day',
  })
  return rows.sort((a, b) => a.date.localeCompare(b.date))
})

export const productionPolicies: ProductionPolicy[] = SITES.flatMap((siteId) =>
  (
    [
      [
        'batch_size_default',
        'Default batch size',
        '500',
        'Pieces per WIP batch when an MO is released without an explicit batch size.',
      ],
      [
        'changeover_buffer_min',
        'Changeover buffer',
        '20',
        'Minutes reserved between work orders of different products on the same machine.',
      ],
      [
        'auto_backflush',
        'Automatic backflush',
        'true',
        'Consume packaging and consumables automatically when an operation completes.',
      ],
      ['shift_handover_min', 'Shift handover', '15', 'Minutes of overlap for the handover between shifts.'],
      [
        'max_wip_per_line',
        'Max WIP batches per line',
        siteId === SITE_JKT ? '12' : '6',
        'Queued and processing batches allowed on a line before dispatch warns.',
      ],
    ] as [string, string, string, string][]
  ).map(([key, label, value, description]) => ({
    id: `pp-${siteKey(siteId)}-${key.replace(/_/g, '-')}`,
    siteId,
    key,
    label,
    value,
    description,
  })),
)
