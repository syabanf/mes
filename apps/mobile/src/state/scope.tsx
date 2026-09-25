import { type AppAction, isSameDay, nowIso, nowMs, toMs } from '@mes/fixtures'
import type { Inspection, WorkOrder } from '@mes/types'
import { OPEN_WO_STATUSES, PRIORITY_RANK } from '@mes/types'
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/auth'
import { useStore } from './store'

const byId = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]))

/** Critical first, then the earliest planned start. */
const byUrgency = (a: WorkOrder, b: WorkOrder) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.plannedStart.localeCompare(b.plannedStart)

const requestedFirst = (a: Inspection, b: Inspection) =>
  toMs(b.completedAt ?? b.requestedAt) - toMs(a.completedAt ?? a.requestedAt)

/**
 * The signed-in operator's slice of the store: their site, the work at their work centers, the
 * material, inspections, instructions, machines and holds behind it, and a dispatch that stamps
 * the operator and the app clock on every action.
 */
function useScopeValue() {
  const { state, send } = useStore()
  const { user, site } = useAuth()
  if (!user || !site) throw new Error('MobileScopeProvider needs a signed-in operator')
  const userId = user.id
  const dispatch = useCallback(
    (action: AppAction) => send({ action, meta: { by: userId, at: nowIso() } }),
    [send, userId],
  )

  return useMemo(() => {
    const siteId = site.id
    const now = nowMs()
    const inSite = <T extends { siteId: string }>(list: readonly T[]) =>
      list.filter((x) => x.siteId === siteId)
    const workCenterIds = new Set(
      state.orgNodes.filter((n) => n.siteId === siteId && user.workCenterIds.includes(n.id)).map((n) => n.id),
    )
    const machines = state.machines.filter((m) => workCenterIds.has(m.workCenterId))
    const workOrders = inSite(state.workOrders)
    const isMine = (w: WorkOrder) => w.operatorIds.includes(userId)
    const atMyCenter = (w: WorkOrder) => workCenterIds.has(w.workCenterId)
    // What the operator may open: assigned to them, or open at one of their work centers.
    const operatorWorkOrders = workOrders
      .filter(
        (w) => OPEN_WO_STATUSES.includes(w.status) && w.status !== 'waiting' && (isMine(w) || atMyCenter(w)),
      )
      .sort(byUrgency)
    const myWorkOrders = operatorWorkOrders.filter(
      (w) => isMine(w) || (w.status === 'ready' && w.operatorIds.length === 0 && atMyCenter(w)),
    )
    const doneToday = workOrders
      .filter(
        (w) =>
          w.status === 'completed' &&
          w.actualEnd &&
          isSameDay(toMs(w.actualEnd), now) &&
          (isMine(w) || atMyCenter(w)),
      )
      .sort((a, b) => toMs(b.actualEnd ?? b.plannedEnd) - toMs(a.actualEnd ?? a.plannedEnd))
    const visibleWoIds = new Set([...operatorWorkOrders, ...doneToday].map((w) => w.id))
    const moIds = new Set(operatorWorkOrders.map((w) => w.moId))
    const inspections = inSite(state.inspections)
    const maps = {
      orgNode: byId(state.orgNodes),
      product: byId(state.products),
      material: byId(state.materials),
      uom: byId(state.uoms),
      bop: byId(state.bops),
      bor: byId(state.bors),
      specification: byId(state.specifications),
      workInstruction: byId(state.workInstructions),
      machine: byId(state.machines),
      person: byId(state.people),
      shift: byId(state.shifts),
      location: byId(state.inventoryLocations),
      reasonCode: byId(state.reasonCodes),
      defectCode: byId(state.defectCodes),
      mo: byId(state.manufacturingOrders),
      wo: byId(state.workOrders),
      lot: byId(state.materialLots),
      wip: byId(state.wips),
      inspection: byId(state.inspections),
      revision: byId(state.productRevisions),
    }
    return {
      user,
      site,
      state,
      dispatch,
      settings: state.settings,
      workCenters: state.orgNodes.filter((n) => workCenterIds.has(n.id)),
      machines,
      workOrders,
      /** Open work the operator may run, most urgent first. */
      operatorWorkOrders,
      /** Assigned to the operator, or unassigned and ready at their work centers. */
      myWorkOrders,
      doneToday,
      canOpen: (woId: string) => visibleWoIds.has(woId),
      wips: inSite(state.wips),
      materialRequirements: state.materialRequirements.filter((r) => moIds.has(r.moId)),
      materialLots: inSite(state.materialLots),
      inspections,
      /** Inspections raised on the operator's work orders, newest activity first. */
      operatorInspections: inspections.filter((i) => i.woId && visibleWoIds.has(i.woId)).sort(requestedFirst),
      qualityHolds: inSite(state.qualityHolds).filter((h) => h.status === 'active'),
      products: state.products,
      workInstructions: state.workInstructions,
      inspectionPlans: state.inspectionPlans,
      reasonCodes: state.reasonCodes,
      defectCodes: state.defectCodes,
      maps,
      personName: (id: string | null | undefined) =>
        id === 'system' ? 'System' : id ? (maps.person.get(id)?.name ?? 'Unknown') : 'Unassigned',
      productName: (id: string) => maps.product.get(id)?.name ?? 'Unknown product',
      materialName: (id: string) => maps.material.get(id)?.name ?? 'Unknown material',
      uomCode: (id: string) => maps.uom.get(id)?.code ?? '',
      orgName: (id: string | null) => (id ? (maps.orgNode.get(id)?.name ?? 'Unknown') : 'Unassigned'),
      locationName: (id: string | null) => (id ? (maps.location.get(id)?.name ?? 'Unknown') : 'Unassigned'),
      reasonLabel: (id: string | null) =>
        id ? (maps.reasonCode.get(id)?.label ?? 'Unknown reason') : 'No reason',
    }
  }, [state, site, user, userId, dispatch])
}

export type MobileScope = ReturnType<typeof useScopeValue>

const ScopeContext = createContext<MobileScope | null>(null)

/** Builds the scope once per store change and shares it, so list cards do not rebuild every lookup. */
export function MobileScopeProvider({ children }: { children: ReactNode }) {
  const value = useScopeValue()
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useMobileScope(): MobileScope {
  const ctx = useContext(ScopeContext)
  if (!ctx) throw new Error('useMobileScope must be used inside MobileScopeProvider')
  return ctx
}

/** Re-renders on an interval so timers and "x ago" labels move. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(nowMs)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
