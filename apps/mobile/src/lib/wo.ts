import { nowIso } from '@mes/fixtures'
import type { AppAction } from '@mes/fixtures'
import type { Measurement, Operation, Specification, WoStatus, WorkInstruction, WorkOrder } from '@mes/types'
import type { Tone } from '@mes/ui'
import type { MobileScope } from '../state/scope'

/** Leading tile and status dot tone per work order status. Running is the one accent on a list. */
export const WO_TONE: Record<WoStatus, Tone> = {
  waiting: 'default',
  ready: 'ink',
  assigned: 'ink',
  in_progress: 'accent',
  paused: 'warning',
  hold: 'danger',
  completed: 'success',
  cancelled: 'default',
}

export const isRunning = (wo: WorkOrder) => wo.status === 'in_progress'
export const isStartable = (wo: WorkOrder) => wo.status === 'ready' || wo.status === 'assigned'

function operationFor(s: MobileScope, wo: WorkOrder): Operation | undefined {
  const mo = s.maps.mo.get(wo.moId)
  const bop = mo?.snapshot ? s.maps.bop.get(mo.snapshot.bopId) : undefined
  return bop?.operations.find((o) => o.seq === wo.operationSeq)
}

/** The instruction the operator sees: the one on the WO, else the one the order snapshot carries for this operation. */
export function instructionFor(s: MobileScope, wo: WorkOrder): WorkInstruction | undefined {
  if (wo.workInstructionId) return s.maps.workInstruction.get(wo.workInstructionId)
  const op = operationFor(s, wo)
  if (op?.workInstructionId) return s.maps.workInstruction.get(op.workInstructionId)
  const mo = s.maps.mo.get(wo.moId)
  return mo?.snapshot?.workInstructionIds
    .map((id) => s.maps.workInstruction.get(id))
    .find((wi) => wi?.operationSeq === wo.operationSeq)
}

export const requirementsFor = (s: MobileScope, wo: WorkOrder) =>
  s.materialRequirements.filter((r) => r.moId === wo.moId && r.operationSeq === wo.operationSeq)

/** Why Start would be refused right now, in the operator's words. Mirrors the reducer guards. */
export function startBlocker(s: MobileScope, wo: WorkOrder): string | null {
  if (!isStartable(wo)) return null
  const mo = s.maps.mo.get(wo.moId)
  const bor = mo?.snapshot ? s.maps.bor.get(mo.snapshot.borId) : undefined
  const borItem = bor?.items.find((i) => i.operationSeq === wo.operationSeq)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  if ((borItem?.machineIds.length ?? 0) > 0 && !machine) return 'Waiting for dispatch to assign a machine.'
  if (machine) {
    if (machine.workCenterId !== wo.workCenterId)
      return `${machine.code} belongs to ${s.orgName(machine.workCenterId)}, not this work center.`
    if (borItem?.machineIds.length && !borItem.machineIds.includes(machine.id))
      return `${machine.code} is not listed for ${wo.operationName}.`
    if (machine.eligibleProductIds.length && mo && !machine.eligibleProductIds.includes(mo.productId))
      return `${machine.code} cannot run this product.`
    if (machine.state === 'down') return `${machine.code} is down.`
    if (machine.maintenanceState === 'in_maintenance' || machine.maintenanceState === 'unavailable')
      return `${machine.code} is in maintenance.`
  }
  const unfinished = (operationFor(s, wo)?.predecessorSeqs ?? []).filter((seq) =>
    s.workOrders.some((w) => w.moId === wo.moId && w.operationSeq === seq && w.status !== 'completed'),
  )
  if (unfinished.length) return `Wait for operation ${unfinished.join(', ')} to finish.`
  const short = requirementsFor(s, wo).filter((r) => r.status === 'shortage' || r.status === 'partial')
  if (short.length)
    return `${short.length} material requirement${short.length > 1 ? 's' : ''} still need supply.`
  return null
}

/** The inspection request an operator raises at the line, with every characteristic measured at this operation. */
export function inspectionRequest(s: MobileScope, wo: WorkOrder): AppAction | null {
  const mo = s.maps.mo.get(wo.moId)
  if (!mo) return null
  const plan = s.inspectionPlans.find(
    (p) => p.productId === mo.productId && p.operationSeq === wo.operationSeq,
  )
  const specIds = plan ? [plan.specId] : (mo.snapshot?.specIds ?? [])
  const specs = specIds
    .map((id) => s.maps.specification.get(id))
    .filter((sp): sp is Specification => !!sp && (!!plan || sp.kind === 'quality'))
  const measurements: Measurement[] = specs
    .flatMap((sp) => sp.characteristics)
    .filter((c) => c.operationSeq === wo.operationSeq)
    .map((c) => ({
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
    }))
  const wip = s.wips.find(
    (w) => w.moId === wo.moId && w.operationSeq === wo.operationSeq && w.state === 'processing',
  )
  return {
    type: 'inspections/request',
    inspection: {
      siteId: wo.siteId,
      planId: plan?.id ?? null,
      productId: mo.productId,
      moId: mo.id,
      woId: wo.id,
      wipId: wip?.id ?? null,
      lotId: null,
      operationSeq: wo.operationSeq,
      trigger: plan?.trigger ?? 'quantity',
      sampleSize: plan?.sampleSize ?? s.settings.defaultSampleSize,
      measurements,
      inspectorId: null,
      requestedAt: nowIso(),
      photos: [],
      note: `Requested at the line by ${s.user.name}`,
    },
  }
}

/** Pass or fail of a numeric reading against its limits; null while nothing was entered. */
export function numericResult(m: Pick<Measurement, 'value' | 'min' | 'max'>): 'pass' | 'fail' | null {
  if (m.value === null || Number.isNaN(m.value)) return null
  if (m.min !== null && m.value < m.min) return 'fail'
  if (m.max !== null && m.value > m.max) return 'fail'
  return 'pass'
}

/** A failed inspection whose disposition is anything but accept or use-as-is puts the WIP on quality hold. */
export const holdsWipOnRecord = (m: readonly Measurement[], disposition: string) =>
  m.some((x) => x.result === 'fail') && disposition !== 'accept' && disposition !== 'use_as_is'

export function limits(m: Pick<Measurement, 'target' | 'min' | 'max' | 'unit'>) {
  const parts = [
    m.target !== null ? `target ${m.target}` : null,
    m.min !== null ? `min ${m.min}` : null,
    m.max !== null ? `max ${m.max}` : null,
  ].filter(Boolean)
  return parts.length ? `${parts.join(' · ')} ${m.unit}`.trim() : 'no limits'
}
