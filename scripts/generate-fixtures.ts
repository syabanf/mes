// Seeded, deterministic fixture generator. Writes JSON into packages/fixtures/data.
// Run with: pnpm gen:fixtures
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppState } from '../packages/fixtures/src/store.ts'
import { runChecks } from './seed/checks.ts'
import { drainEvents } from './seed/common.ts'
import {
  blueprintOrder,
  demands,
  linkProduction,
  marketingOrderItems,
  marketingOrders,
  replenishments,
} from './seed/demand.ts'
import {
  integrationConnections,
  integrationLogs,
  integrationMappings,
  LAST_CM_SEQ,
  maintenanceRecords,
  oeeSnapshots,
  telemetry,
} from './seed/integration.ts'
import {
  LAST_FGR_SEQ,
  LAST_LOT_SEQ,
  fgStock,
  finishedGoodsReceipts,
  floorStock,
  materialLots,
  materialRequirements,
  materialTxns,
  serials,
  wips,
} from './seed/inventory.ts'
import { machines, resources } from './seed/machines.ts'
import {
  buildNumbering,
  calendarDays,
  categories,
  company,
  customers,
  defectCodes,
  inventoryLocations,
  inventoryPolicies,
  lotRules,
  materials,
  productionPolicies,
  products,
  reasonCodes,
  serialRules,
  settings,
  sites,
  suppliers,
  uomConversions,
  uoms,
  orgNodes,
} from './seed/master.ts'
import { people, shifts, skills } from './seed/people.ts'
import {
  boms,
  bops,
  bors,
  ecos,
  inspectionPlans,
  productRevisions,
  specifications,
  workInstructions,
} from './seed/plm.ts'
import { LAST_MO_SEQ, atRiskMo, manufacturingOrders, pausedWo, workOrders } from './seed/production.ts'
import {
  LAST_INS_SEQ,
  LAST_QH_SEQ,
  LAST_RWK_SEQ,
  defectRecords,
  inspections,
  ncrs,
  qualityHolds,
  reworkOrders,
  scrapRecords,
} from './seed/quality.ts'

linkProduction(manufacturingOrders)

// Tooling in use on running work orders; utilities that are always live.
const inUse = new Set(
  workOrders
    .filter((w) => w.status === 'in_progress' || w.status === 'paused')
    .flatMap((w) => [...w.toolIds, ...w.moldIds]),
)
for (const r of resources) {
  if (inUse.has(r.id) || r.id === 'res-utl-air' || r.id === 'res-utl-cw') r.status = 'in_use'
  else if (r.id === 'res-mold-gb100') r.status = 'maintenance'
}

const maxSeq = (codes: string[], prefix: string) =>
  Math.max(0, ...codes.filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length))))
const numbering = buildNumbering({
  mo: LAST_MO_SEQ,
  wo: workOrders.length,
  demand: maxSeq(
    demands.map((d) => d.code),
    'DMD-',
  ),
  replenishment: maxSeq(
    replenishments.map((r) => r.code),
    'RPL-',
  ),
  lot: LAST_LOT_SEQ,
  fgReceipt: LAST_FGR_SEQ,
  hold: LAST_QH_SEQ,
  inspection: LAST_INS_SEQ,
  rework: LAST_RWK_SEQ,
  maintenance: LAST_CM_SEQ,
  marketingOrder: maxSeq(
    marketingOrders.map((o) => o.code),
    'MKT-2026-',
  ),
  eco: maxSeq(
    ecos.map((e) => e.code),
    'ECO-',
  ),
  ncr: maxSeq(
    ncrs.map((n) => n.code),
    'NCR-',
  ),
})

const state: AppState = {
  company,
  sites,
  orgNodes,
  customers,
  suppliers,
  categories,
  uoms,
  uomConversions,
  products,
  materials,
  productRevisions,
  boms,
  bors,
  bops,
  specifications,
  workInstructions,
  ecos,
  machines,
  resources,
  skills,
  people,
  shifts,
  calendarDays,
  productionPolicies,
  inventoryLocations,
  inventoryPolicies,
  lotRules,
  serialRules,
  reasonCodes,
  numbering,
  integrationMappings,
  integrationConnections,
  integrationLogs,
  marketingOrders,
  marketingOrderItems,
  demands,
  replenishments,
  manufacturingOrders,
  workOrders,
  materialLots,
  floorStock,
  materialRequirements,
  materialTxns,
  finishedGoodsReceipts,
  fgStock,
  serials,
  wips,
  inspectionPlans,
  inspections,
  defectCodes,
  defectRecords,
  qualityHolds,
  scrapRecords,
  reworkOrders,
  ncrs,
  productionEvents: drainEvents(),
  oeeSnapshots,
  telemetry,
  maintenanceRecords,
  settings,
}

runChecks(state)

// ─── Write ──────────────────────────────────────────────────────

const FILE_NAMES: Record<Exclude<keyof AppState, 'fgReservations'>, string> = {
  company: 'company',
  sites: 'sites',
  orgNodes: 'org-nodes',
  customers: 'customers',
  suppliers: 'suppliers',
  categories: 'categories',
  uoms: 'uoms',
  uomConversions: 'uom-conversions',
  products: 'products',
  materials: 'materials',
  productRevisions: 'product-revisions',
  boms: 'boms',
  bors: 'bors',
  bops: 'bops',
  specifications: 'specifications',
  workInstructions: 'work-instructions',
  ecos: 'ecos',
  machines: 'machines',
  resources: 'resources',
  skills: 'skills',
  people: 'people',
  shifts: 'shifts',
  calendarDays: 'calendar-days',
  productionPolicies: 'production-policies',
  inventoryLocations: 'inventory-locations',
  inventoryPolicies: 'inventory-policies',
  lotRules: 'lot-rules',
  serialRules: 'serial-rules',
  reasonCodes: 'reason-codes',
  numbering: 'numbering',
  integrationMappings: 'integration-mappings',
  integrationConnections: 'integration-connections',
  integrationLogs: 'integration-logs',
  marketingOrders: 'marketing-orders',
  marketingOrderItems: 'marketing-order-items',
  demands: 'demands',
  replenishments: 'replenishments',
  manufacturingOrders: 'manufacturing-orders',
  workOrders: 'work-orders',
  materialLots: 'material-lots',
  floorStock: 'floor-stock',
  materialRequirements: 'material-requirements',
  materialTxns: 'material-txns',
  finishedGoodsReceipts: 'finished-goods-receipts',
  fgStock: 'fg-stock',
  serials: 'serials',
  wips: 'wips',
  inspectionPlans: 'inspection-plans',
  inspections: 'inspections',
  defectCodes: 'defect-codes',
  defectRecords: 'defect-records',
  qualityHolds: 'quality-holds',
  scrapRecords: 'scrap-records',
  reworkOrders: 'rework-orders',
  ncrs: 'ncrs',
  productionEvents: 'production-events',
  oeeSnapshots: 'oee-snapshots',
  telemetry: 'telemetry',
  maintenanceRecords: 'maintenance-records',
  settings: 'settings',
}

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '../packages/fixtures/data')
mkdirSync(dataDir, { recursive: true })
let total = 0
const rows: [string, number, number][] = []
for (const key of Object.keys(FILE_NAMES) as (keyof typeof FILE_NAMES)[]) {
  const value = state[key]
  const json = JSON.stringify(value)
  total += json.length
  writeFileSync(join(dataDir, `${FILE_NAMES[key]}.json`), json)
  rows.push([FILE_NAMES[key], Array.isArray(value) ? value.length : 1, json.length])
}

const width = Math.max(...rows.map(([n]) => n.length))
console.log(`${'collection'.padEnd(width)}  rows    KB`)
for (const [name, count, bytes] of rows)
  console.log(`${name.padEnd(width)}  ${String(count).padStart(4)}  ${(bytes / 1024).toFixed(0).padStart(4)}`)
console.log(`total ${(total / 1024).toFixed(0)} KB`)

const byStatus = manufacturingOrders.reduce<Record<string, number>>(
  (acc, m) => ({
    ...acc,
    [`${m.siteId.slice(5)}:${m.status}`]: (acc[`${m.siteId.slice(5)}:${m.status}`] ?? 0) + 1,
  }),
  {},
)
console.log('manufacturing orders by site and status', byStatus)
console.log(
  `blueprint marketing order ${blueprintOrder.code}; at-risk MO ${atRiskMo.code}; paused WO ${pausedWo.code}`,
)
const DEMO_IDS = [
  'per-admin',
  'per-pm',
  'per-planner',
  'per-supervisor',
  'per-operator',
  'per-quality',
  'per-engineer',
  'per-marketing',
  'per-warehouse',
]
console.log(
  `demo accounts: ${DEMO_IDS.map((id) => people.find((p) => p.id === id)!)
    .map((p) => `${p.id} (${p.role}, ${p.name})`)
    .join(', ')}`,
)
