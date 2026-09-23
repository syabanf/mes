import { useMemo } from 'react'
import { useScoped } from '../state/scoped'
import type { BadgeKey } from './nav'

/** Counts behind the navigation badges. */
export function useNavCounts(): Record<BadgeKey, number> {
  const {
    marketingOrders,
    demands,
    replenishments,
    ecos,
    workOrders,
    qualityHolds,
    inspections,
    manufacturingOrders,
    materialRequirements,
  } = useScoped()
  return useMemo(
    () => ({
      draftOrders: marketingOrders.filter((o) => o.status === 'draft').length,
      openDemand: demands.filter((d) => d.status === 'open').length,
      proposedReplenishment: replenishments.filter((r) => r.status === 'proposed').length,
      ecoReview: ecos.filter((e) => e.status === 'review' || e.status === 'approved').length,
      readyToDispatch: workOrders.filter((w) => w.status === 'ready').length,
      activeHolds: qualityHolds.filter((h) => h.status === 'active').length,
      pendingInspections: inspections.filter((i) => i.status === 'pending' || i.status === 'in_progress')
        .length,
      atRisk: manufacturingOrders.filter((m) => m.atRisk && m.status !== 'closed' && m.status !== 'cancelled')
        .length,
      shortages: materialRequirements.filter((r) => r.status === 'shortage').length,
    }),
    [
      marketingOrders,
      demands,
      replenishments,
      ecos,
      workOrders,
      qualityHolds,
      inspections,
      manufacturingOrders,
      materialRequirements,
    ],
  )
}
