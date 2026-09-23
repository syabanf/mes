import { type AppAction, nowIso, nowMs, orgPath } from '@mes/fixtures'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useStore } from './store'

/** The store plus a dispatch that stamps the signed-in user and the app clock on every action. */
export function useAppState() {
  const { state, send } = useStore()
  const { user } = useAuth()
  const by = user?.id ?? 'system'
  const dispatch = useCallback(
    (action: AppAction) => send({ action, meta: { by, at: nowIso() } }),
    [send, by],
  )
  return { state, dispatch }
}

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]))

/** Everything a page needs for the current site, memoised on the store state. */
export function useScoped() {
  const { state, dispatch } = useAppState()
  const { user, site } = useAuth()
  if (!user || !site) throw new Error('useScoped needs a signed-in user')
  const siteId = site.id

  return useMemo(() => {
    const inSite = <T extends { siteId: string }>(list: readonly T[]) =>
      list.filter((x) => x.siteId === siteId)
    const orgNodes = inSite(state.orgNodes)
    const orgIds = new Set(orgNodes.map((n) => n.id))
    const machines = state.machines.filter((m) => orgIds.has(m.workCenterId))
    const machineIds = new Set(machines.map((m) => m.id))
    const people = state.people.filter((p) => p.siteIds.includes(siteId))
    const manufacturingOrders = inSite(state.manufacturingOrders)
    const moIds = new Set(manufacturingOrders.map((m) => m.id))
    const marketingOrders = inSite(state.marketingOrders)
    const orderIds = new Set(marketingOrders.map((o) => o.id))
    const maps = {
      site: byId(state.sites),
      orgNode: byId(state.orgNodes),
      customer: byId(state.customers),
      supplier: byId(state.suppliers),
      category: byId(state.categories),
      uom: byId(state.uoms),
      product: byId(state.products),
      material: byId(state.materials),
      revision: byId(state.productRevisions),
      bom: byId(state.boms),
      bor: byId(state.bors),
      bop: byId(state.bops),
      specification: byId(state.specifications),
      workInstruction: byId(state.workInstructions),
      eco: byId(state.ecos),
      machine: byId(state.machines),
      resource: byId(state.resources),
      skill: byId(state.skills),
      person: byId(state.people),
      shift: byId(state.shifts),
      location: byId(state.inventoryLocations),
      reasonCode: byId(state.reasonCodes),
      marketingOrder: byId(state.marketingOrders),
      marketingOrderItem: byId(state.marketingOrderItems),
      demand: byId(state.demands),
      replenishment: byId(state.replenishments),
      mo: byId(state.manufacturingOrders),
      wo: byId(state.workOrders),
      lot: byId(state.materialLots),
      wip: byId(state.wips),
      inspection: byId(state.inspections),
      defectCode: byId(state.defectCodes),
      hold: byId(state.qualityHolds),
      rework: byId(state.reworkOrders),
      ncr: byId(state.ncrs),
      maintenance: byId(state.maintenanceRecords),
    }
    return {
      user,
      site,
      siteId,
      state,
      dispatch,
      settings: state.settings,
      // organization
      orgNodes,
      workCenters: orgNodes.filter((n) => n.kind === 'work_center'),
      lines: orgNodes.filter((n) => n.kind === 'line'),
      machines,
      resources: state.resources.filter((r) => r.workCenterId === null || orgIds.has(r.workCenterId)),
      people,
      operators: people.filter((p) => p.role === 'operator'),
      inspectors: people.filter((p) => p.role === 'quality'),
      inventoryLocations: inSite(state.inventoryLocations),
      inventoryPolicies: inSite(state.inventoryPolicies),
      calendarDays: inSite(state.calendarDays),
      productionPolicies: inSite(state.productionPolicies),
      // demand
      marketingOrders,
      marketingOrderItems: state.marketingOrderItems.filter((i) => orderIds.has(i.orderId)),
      demands: inSite(state.demands),
      replenishments: inSite(state.replenishments),
      fgStock: inSite(state.fgStock),
      // execution
      manufacturingOrders,
      workOrders: inSite(state.workOrders),
      wips: inSite(state.wips),
      materialLots: inSite(state.materialLots),
      floorStock: inSite(state.floorStock),
      materialRequirements: state.materialRequirements.filter((r) => moIds.has(r.moId)),
      materialTxns: inSite(state.materialTxns),
      finishedGoodsReceipts: inSite(state.finishedGoodsReceipts),
      serials: state.serials.filter((s) => moIds.has(s.moId)),
      // quality
      inspections: inSite(state.inspections),
      defectRecords: inSite(state.defectRecords),
      qualityHolds: inSite(state.qualityHolds),
      scrapRecords: inSite(state.scrapRecords),
      reworkOrders: inSite(state.reworkOrders),
      ncrs: inSite(state.ncrs),
      // history and integrations
      productionEvents: inSite(state.productionEvents),
      oeeSnapshots: state.oeeSnapshots.filter((s) => machineIds.has(s.machineId)),
      telemetry: state.telemetry.filter((t) => machineIds.has(t.machineId)),
      maintenanceRecords: state.maintenanceRecords.filter((r) => machineIds.has(r.machineId)),
      integrationLogs: state.integrationLogs,
      integrationConnections: state.integrationConnections,
      // master data shared by every site
      products: state.products,
      materials: state.materials,
      customers: state.customers,
      suppliers: state.suppliers,
      categories: state.categories,
      uoms: state.uoms,
      productRevisions: state.productRevisions,
      boms: state.boms,
      bors: state.bors,
      bops: state.bops,
      specifications: state.specifications,
      workInstructions: state.workInstructions,
      ecos: state.ecos,
      skills: state.skills,
      shifts: state.shifts,
      reasonCodes: state.reasonCodes,
      defectCodes: state.defectCodes,
      inspectionPlans: state.inspectionPlans,
      maps,
      personName: (id: string | null | undefined) =>
        id === 'system' ? 'System' : id ? (maps.person.get(id)?.name ?? 'Unknown') : 'Unassigned',
      productName: (id: string) => maps.product.get(id)?.name ?? 'Unknown product',
      productCode: (id: string) => maps.product.get(id)?.code ?? id,
      materialName: (id: string) => maps.material.get(id)?.name ?? 'Unknown material',
      uomCode: (id: string) => maps.uom.get(id)?.code ?? '',
      orgName: (id: string | null) => (id ? (maps.orgNode.get(id)?.name ?? 'Unknown') : 'Unassigned'),
      orgPath: (id: string | null) => orgPath(state.orgNodes, id),
      locationName: (id: string | null) => (id ? (maps.location.get(id)?.name ?? 'Unknown') : 'Unassigned'),
      reasonLabel: (id: string | null) =>
        id ? (maps.reasonCode.get(id)?.label ?? 'Unknown reason') : 'No reason',
    }
  }, [state, siteId, site, user, dispatch])
}

export type Scoped = ReturnType<typeof useScoped>

/** Re-renders on an interval so timers and "x ago" labels move. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
