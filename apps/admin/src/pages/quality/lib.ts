import { type AppState, DAY, currentRevision, isSameDay, toMs } from '@mes/fixtures'
import type {
  Characteristic,
  Inspection,
  InspectionPlan,
  InspectionStatus,
  InspectionTrigger,
  Measurement,
  Ncr,
  QualityHold,
  Severity,
} from '@mes/types'
import { paths } from '../../components/links'

export const INSPECTION_STATUSES: InspectionStatus[] = ['pending', 'in_progress', 'passed', 'failed']
export const INSPECTION_TRIGGERS: InspectionTrigger[] = [
  'start',
  'batch',
  'quantity',
  'time',
  'changeover',
  'end',
]
export const SEVERITIES: Severity[] = ['minor', 'major', 'critical']

export const isOpenInspection = (i: Inspection) => i.status === 'pending' || i.status === 'in_progress'

/** A failed inspection whose disposition is anything but accept or use-as-is puts the WIP on quality hold. */
export const holdsWipOnRecord = (m: Measurement[], disposition: string) =>
  m.some((x) => x.result === 'fail') && disposition !== 'accept' && disposition !== 'use_as_is'

export const measurementFromCharacteristic = (c: Characteristic): Measurement => ({
  characteristicId: c.id,
  name: c.name,
  type: c.type,
  value: null,
  result: null,
  note: '',
  target: c.target,
  min: c.min,
  max: c.max,
  unit: c.unit,
})

/** Pass or fail of a numeric reading against its limits; null while nothing was entered. */
export function numericResult(m: Pick<Measurement, 'value' | 'min' | 'max'>): 'pass' | 'fail' | null {
  if (m.value === null || Number.isNaN(m.value)) return null
  if (m.min !== null && m.value < m.min) return 'fail'
  if (m.max !== null && m.value > m.max) return 'fail'
  return 'pass'
}

/** The plan an inspection request picks up for a product at an operation. */
export function planFor(
  plans: readonly InspectionPlan[],
  productId: string,
  operationSeq: number,
  trigger?: InspectionTrigger,
): InspectionPlan | undefined {
  const own = plans.filter((p) => p.productId === productId && p.operationSeq === operationSeq)
  return (trigger && own.find((p) => p.trigger === trigger)) ?? own[0]
}

/** Characteristics measured at an operation, from the plan's spec or from the snapshot's specs. */
export function characteristicsFor(
  state: AppState,
  args: { plan: InspectionPlan | undefined; specIds: readonly string[]; operationSeq: number },
): Characteristic[] {
  if (args.plan) {
    const spec = state.specifications.find((s) => s.id === args.plan!.specId)
    const atOp = spec?.characteristics.filter((c) => c.operationSeq === args.operationSeq) ?? []
    return atOp.length ? atOp : (spec?.characteristics ?? [])
  }
  return args.specIds.flatMap(
    (id) =>
      state.specifications
        .find((s) => s.id === id)
        ?.characteristics.filter((c) => c.operationSeq === args.operationSeq) ?? [],
  )
}

/** Quality specs of the product's current released revision, the "targets from PLM". */
export function releasedSpecs(state: AppState, productId: string) {
  const revision = currentRevision(state, productId)
  const specs =
    revision?.specIds.map((id) => state.specifications.find((s) => s.id === id)).filter((s) => !!s) ?? []
  const quality = specs.filter((s) => s.kind === 'quality')
  return { revision, specs: quality.length ? quality : specs }
}

export const passedToday = (list: readonly Inspection[], now: number) =>
  list.filter((i) => i.status === 'passed' && i.completedAt && isSameDay(toMs(i.completedAt), now)).length
export const failedToday = (list: readonly Inspection[], now: number) =>
  list.filter((i) => i.status === 'failed' && i.completedAt && isSameDay(toMs(i.completedAt), now)).length

/** First-pass yield over the last `days`: passed / (passed + failed). Null when nothing was completed. */
export function firstPassYield(list: readonly Inspection[], now: number, days = 7): number | null {
  const since = now - days * DAY
  const done = list.filter(
    (i) => i.completedAt && toMs(i.completedAt) >= since && (i.status === 'passed' || i.status === 'failed'),
  )
  if (!done.length) return null
  return done.filter((i) => i.status === 'passed').length / done.length
}

/** The code of whatever a hold points at, so a row reads "WIP · WIP-0042". */
export function holdTargetCode(
  state: Pick<AppState, 'wips' | 'materialLots' | 'manufacturingOrders' | 'workOrders'>,
  hold: QualityHold,
): string {
  switch (hold.target) {
    case 'wip':
      return state.wips.find((w) => w.id === hold.targetId)?.code ?? hold.targetId
    case 'lot':
      return state.materialLots.find((l) => l.id === hold.targetId)?.code ?? hold.targetId
    case 'mo':
      return state.manufacturingOrders.find((m) => m.id === hold.targetId)?.code ?? hold.targetId
    case 'wo':
      return state.workOrders.find((w) => w.id === hold.targetId)?.code ?? hold.targetId
  }
}

/** Route of the WIP, lot, order or operation a hold points at. */
export function holdTargetPath(hold: QualityHold): string {
  switch (hold.target) {
    case 'wip':
      return paths.wip(hold.targetId)
    case 'lot':
      return paths.lotDetail(hold.targetId)
    case 'mo':
      return paths.mo(hold.targetId)
    case 'wo':
      return paths.wo(hold.targetId)
  }
}

export const holdHours = (hold: QualityHold, now: number) =>
  ((hold.releasedAt ? toMs(hold.releasedAt) : now) - toMs(hold.heldAt)) / 3_600_000

/** Case-insensitive match of a query against any of the given fields. */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f && f.toLowerCase().includes(q))
}

export const NCR_SOURCES: { value: Ncr['source']; label: string }[] = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'operator', label: 'Operator' },
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'audit', label: 'Audit' },
]
