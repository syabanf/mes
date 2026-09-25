import { hydrateFgReservations, type AppState } from './store'
import boms from '../data/boms.json'
import bops from '../data/bops.json'
import bors from '../data/bors.json'
import calendarDays from '../data/calendar-days.json'
import categories from '../data/categories.json'
import company from '../data/company.json'
import customers from '../data/customers.json'
import defectCodes from '../data/defect-codes.json'
import defectRecords from '../data/defect-records.json'
import demands from '../data/demands.json'
import ecos from '../data/ecos.json'
import fgStock from '../data/fg-stock.json'
import finishedGoodsReceipts from '../data/finished-goods-receipts.json'
import floorStock from '../data/floor-stock.json'
import inspectionPlans from '../data/inspection-plans.json'
import inspections from '../data/inspections.json'
import integrationConnections from '../data/integration-connections.json'
import integrationLogs from '../data/integration-logs.json'
import integrationMappings from '../data/integration-mappings.json'
import inventoryLocations from '../data/inventory-locations.json'
import inventoryPolicies from '../data/inventory-policies.json'
import lotRules from '../data/lot-rules.json'
import machines from '../data/machines.json'
import maintenanceRecords from '../data/maintenance-records.json'
import manufacturingOrders from '../data/manufacturing-orders.json'
import marketingOrderItems from '../data/marketing-order-items.json'
import marketingOrders from '../data/marketing-orders.json'
import materialLots from '../data/material-lots.json'
import materialRequirements from '../data/material-requirements.json'
import materialTxns from '../data/material-txns.json'
import materials from '../data/materials.json'
import ncrs from '../data/ncrs.json'
import numbering from '../data/numbering.json'
import oeeSnapshots from '../data/oee-snapshots.json'
import orgNodes from '../data/org-nodes.json'
import people from '../data/people.json'
import productRevisions from '../data/product-revisions.json'
import productionEvents from '../data/production-events.json'
import productionPolicies from '../data/production-policies.json'
import products from '../data/products.json'
import qualityHolds from '../data/quality-holds.json'
import reasonCodes from '../data/reason-codes.json'
import replenishments from '../data/replenishments.json'
import resources from '../data/resources.json'
import reworkOrders from '../data/rework-orders.json'
import scrapRecords from '../data/scrap-records.json'
import serialRules from '../data/serial-rules.json'
import serials from '../data/serials.json'
import settings from '../data/settings.json'
import shifts from '../data/shifts.json'
import sites from '../data/sites.json'
import skills from '../data/skills.json'
import specifications from '../data/specifications.json'
import suppliers from '../data/suppliers.json'
import telemetry from '../data/telemetry.json'
import uomConversions from '../data/uom-conversions.json'
import uoms from '../data/uoms.json'
import wips from '../data/wips.json'
import workInstructions from '../data/work-instructions.json'
import workOrders from '../data/work-orders.json'

const seed = {
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
  productionEvents,
  oeeSnapshots,
  telemetry,
  maintenanceRecords,
  settings,
} as AppState

/** A fresh copy of the seed, so reducers never mutate the module-level data. */
export const seedState = (): AppState => hydrateFgReservations(structuredClone(seed))
