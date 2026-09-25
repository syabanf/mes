import { countOpenRecommendations, nowMs } from '@mes/fixtures'
import { useMemo } from 'react'
import { readStorage } from '../lib/storage'
import { useScoped } from '../state/scoped'
import type { BadgeKey } from './nav'

/** Counts behind the navigation badges. */
export function useNavCounts(): Record<BadgeKey, number> {
  const s = useScoped()
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
  } = s
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
      recommendations: countOpenRecommendations(
        s,
        nowMs(),
        readStorage<{ id: string }[]>('mes.admin.optimization.decisions', []).map((d) => d.id),
      ),
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
      s,
    ],
  )
}
