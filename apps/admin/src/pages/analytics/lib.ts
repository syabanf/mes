import type { Dimension, Evidence, MetricUnit, RecommendationKind } from '@mes/fixtures'
import { fmtDuration, fmtNumber, fmtPercent } from '@mes/fixtures'
import type { IsoDate } from '@mes/types'
import { paths } from '../../components/links'

/** Where a piece of intelligence evidence opens. */
export function evidencePath(e: Evidence): string {
  switch (e.kind) {
    case 'mo':
      return paths.mo(e.id)
    case 'wo':
      return paths.wo(e.id)
    case 'machine':
      return paths.machine(e.id)
    case 'requirement':
      return paths.requirement(e.id)
    case 'inspection':
      return paths.inspection(e.id)
    case 'workCenter':
      return paths.capacity(e.id)
    case 'person':
      return '/master-data/people'
    case 'maintenance':
      return '/integration/cmms'
  }
}

/** The entity page behind a metric row; null when the group has no page of its own. */
export function dimensionPath(dim: Dimension, key: string): string | null {
  if (key === 'none') return null
  switch (dim) {
    case 'plant':
    case 'area':
    case 'line':
      return '/master-data/organization'
    case 'workCenter':
      return paths.capacity(key)
    case 'product':
      return paths.product(key)
    case 'mo':
      return paths.mo(key)
    case 'wo':
      return paths.wo(key)
    case 'operation':
      return null
    case 'machine':
      return paths.machine(key)
    case 'shift':
      return '/master-data/planning'
    case 'operator':
      return '/master-data/people'
  }
}

export function fmtMetric(unit: MetricUnit, value: number): string {
  switch (unit) {
    case 'percent':
      return fmtPercent(value, 1)
    case 'perHour':
      return `${fmtNumber(value)}/h`
    case 'seconds':
      return `${fmtNumber(value, 1)} s`
    case 'hours':
      return `${fmtNumber(value, 1)} h`
    case 'minutes':
      return fmtDuration(value)
    case 'count':
      return fmtNumber(value)
  }
}

/** A recommendation the user applied or dismissed, kept per viewer. */
export interface Decision {
  id: string
  kind: RecommendationKind
  title: string
  decision: 'applied' | 'dismissed'
  by: string
  at: IsoDate
  reason: string
}

export const DECISIONS_KEY = 'mes.admin.optimization.decisions'
