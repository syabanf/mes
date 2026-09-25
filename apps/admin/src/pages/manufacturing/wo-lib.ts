import { type WoAssignment, listedMachines, materialReadiness, toMs } from '@mes/fixtures'
import type { BorItem, Inspection, MachineState, Operation, WorkInstruction, WorkOrder } from '@mes/types'
import { MAINTENANCE_STATE_LABEL, OPEN_WO_STATUSES, PRIORITY_RANK, RESOURCE_STATUS_LABEL } from '@mes/types'
import type { Scoped } from '../../state/scoped'

export interface ResourceCheck {
  key: string
  label: string
  ok: boolean
  /** A failed blocking check stops the assignment from being saved. */
  blocking: boolean
  note: string
}

export const QUALITY_BLOCK_MESSAGE =
  'No quality-sensitive operation can be completed without required quality result'

/** Statuses that appear on the dispatch board. */
export const BOARD_STATUSES: WorkOrder['status'][] = ['ready', 'assigned', 'in_progress', 'paused', 'hold']

export const MACHINE_TONE: Record<MachineState, 'success' | 'default' | 'info' | 'danger' | 'warning'> = {
  running: 'success',
  idle: 'default',
  setup: 'info',
  down: 'danger',
  maintenance: 'warning',
  offline: 'default',
}

/** The BOR line for this operation, read from the order's frozen snapshot. */
export function borItemFor(s: Scoped, wo: WorkOrder): BorItem | undefined {
  const mo = s.maps.mo.get(wo.moId)
  const bor = mo?.snapshot ? s.maps.bor.get(mo.snapshot.borId) : undefined
  return bor?.items.find((i) => i.operationSeq === wo.operationSeq)
}

export function operationFor(s: Scoped, wo: WorkOrder): Operation | undefined {
  const mo = s.maps.mo.get(wo.moId)
  const bop = mo?.snapshot ? s.maps.bop.get(mo.snapshot.bopId) : undefined
  return bop?.operations.find((o) => o.seq === wo.operationSeq)
}

/** The work instruction the operator sees: the one on the WO, else the one the snapshot carries for this operation. */
export function instructionFor(s: Scoped, wo: WorkOrder): WorkInstruction | undefined {
  if (wo.workInstructionId) return s.maps.workInstruction.get(wo.workInstructionId)
  const op = operationFor(s, wo)
  if (op?.workInstructionId) return s.maps.workInstruction.get(op.workInstructionId)
  const mo = s.maps.mo.get(wo.moId)
  return mo?.snapshot?.workInstructionIds
    .map((id) => s.maps.workInstruction.get(id))
    .find((wi) => wi?.operationSeq === wo.operationSeq)
}

export const isMachineUnavailable = (m: { maintenanceState: string; state: MachineState }) =>
  m.maintenanceState === 'in_maintenance' || m.maintenanceState === 'unavailable' || m.state === 'down'

/** Blueprint phase 7: the six checks a dispatcher sees before an assignment is accepted. */
export function validateAssignment(s: Scoped, wo: WorkOrder, a: WoAssignment = {}): ResourceCheck[] {
  const mo = s.maps.mo.get(wo.moId)
  const bor = borItemFor(s, wo)
  const machineId = a.machineId === undefined ? wo.machineId : a.machineId
  const operatorIds = a.operatorIds ?? wo.operatorIds
  const shiftId = a.shiftId === undefined ? wo.shiftId : a.shiftId
  const resourceIds = [...(a.toolIds ?? wo.toolIds), ...(a.moldIds ?? wo.moldIds)]
  const machine = machineId ? s.maps.machine.get(machineId) : undefined

  const listed = bor ? listedMachines(s.state, wo.workCenterId, bor.machineIds) : []
  const eligible =
    !!machine &&
    machine.workCenterId === wo.workCenterId &&
    (!bor?.machineIds.length || listed.some((m) => m.id === machine.id)) &&
    (machine.eligibleProductIds.length === 0 || !mo || machine.eligibleProductIds.includes(mo.productId))
  const available = !!machine && !isMachineUnavailable(machine)

  const resources = resourceIds.map((id) => s.maps.resource.get(id)).filter((r) => !!r)
  const requiredResources = (bor?.toolIds.length ?? 0) + (bor?.moldIds.length ?? 0)
  const unusable = resources.filter((r) => r.status !== 'available' && r.status !== 'in_use')

  const skillIds = bor?.skillIds ?? []
  const operators = operatorIds.map((id) => s.maps.person.get(id)).filter((p) => !!p)
  const unqualified = operators.filter(
    (p) => !p.workCenterIds.includes(wo.workCenterId) || skillIds.some((sk) => (p.skills[sk] ?? 0) < 2),
  )

  const readiness = mo ? materialReadiness(mo.id, s.materialRequirements) : 'shortage'

  return [
    {
      key: 'machine_eligible',
      label: 'Machine eligible',
      ok: eligible,
      blocking: !!machine && !eligible,
      note: !machine
        ? 'No machine assigned'
        : eligible
          ? `${machine.code} is listed for ${wo.operationName} on this product`
          : machine.workCenterId !== wo.workCenterId
            ? `${machine.code} belongs to ${s.orgName(machine.workCenterId)}, not ${s.orgName(wo.workCenterId)}`
            : `${machine.code} is not in the BOR for ${wo.operationName}`,
    },
    {
      key: 'machine_available',
      label: 'Machine available',
      ok: available,
      blocking: !!machine && !available,
      note: !machine
        ? 'No machine assigned'
        : available
          ? MAINTENANCE_STATE_LABEL[machine.maintenanceState]
          : machine.state === 'down'
            ? `${machine.code} is down`
            : `${machine.code}: ${MAINTENANCE_STATE_LABEL[machine.maintenanceState]}`,
    },
    {
      key: 'tool',
      label: 'Tool available',
      ok: unusable.length === 0 && (resources.length > 0 || requiredResources === 0),
      blocking: unusable.length > 0,
      note: unusable.length
        ? unusable.map((r) => `${r.code} ${RESOURCE_STATUS_LABEL[r.status].toLowerCase()}`).join(', ')
        : resources.length
          ? `${resources.length} tools and molds ready`
          : requiredResources
            ? `BOR lists ${requiredResources} tools or molds; none assigned`
            : 'No tooling required',
    },
    {
      key: 'operator',
      label: 'Operator qualified',
      ok: operators.length > 0 && unqualified.length === 0,
      blocking: unqualified.length > 0,
      note: unqualified.length
        ? `${unqualified.map((p) => p.name).join(', ')} missing a required skill level or work center`
        : operators.length
          ? `${operators.length} qualified for ${skillIds.length ? skillIds.map((id) => s.maps.skill.get(id)?.name ?? id).join(', ') : 'this work center'}`
          : 'No operator assigned',
    },
    {
      key: 'shift',
      label: 'Shift assigned',
      ok: !!shiftId,
      blocking: false,
      note: shiftId ? (s.maps.shift.get(shiftId)?.name ?? 'Shift') : 'No shift assigned',
    },
    {
      key: 'material',
      label: 'Material ready',
      ok: readiness === 'ready',
      blocking: false,
      note:
        readiness === 'ready'
          ? 'All requirements covered'
          : readiness === 'partial'
            ? 'Part of the requirement is short'
            : 'Shortage on the order',
    },
  ]
}

export const assignmentBlockers = (checks: ResourceCheck[]) => checks.filter((c) => c.blocking && !c.ok)

/** The operator's pre-start checklist. A missing instruction is called out, but manual briefing is allowed. */
export function startChecks(s: Scoped, wo: WorkOrder): ResourceCheck[] {
  const bor = borItemFor(s, wo)
  const operation = operationFor(s, wo)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  const machineRequired = (bor?.machineIds.length ?? 0) > 0
  const machineCheck = validateAssignment(s, wo).slice(0, 2)
  const predecessors = operation?.predecessorSeqs ?? []
  const unfinished = predecessors.filter((seq) =>
    s.workOrders.some(
      (candidate) =>
        candidate.moId === wo.moId && candidate.operationSeq === seq && candidate.status !== 'completed',
    ),
  )
  const requirements = s.materialRequirements.filter(
    (r) => r.moId === wo.moId && r.operationSeq === wo.operationSeq,
  )
  const short = requirements.filter((r) => r.status === 'shortage' || r.status === 'partial')
  const instruction = instructionFor(s, wo)
  return [
    {
      key: 'machine',
      label: 'Machine',
      ok: machineRequired
        ? !!machine && machineCheck.every((check) => check.ok)
        : !machine || machineCheck.every((check) => check.ok),
      blocking: machineRequired || !!machine,
      note: !machine
        ? machineRequired
          ? 'Dispatcher must assign an eligible machine.'
          : 'Manual operation; no machine required.'
        : (machineCheck.find((check) => !check.ok)?.note ?? `${machine.code} is ready.`),
    },
    {
      key: 'predecessor',
      label: 'Previous operation',
      ok: unfinished.length === 0,
      blocking: true,
      note: unfinished.length
        ? `Wait for operation ${unfinished.join(', ')} to finish.`
        : 'Required previous operations are complete.',
    },
    {
      key: 'material',
      label: 'Material',
      ok: short.length === 0,
      blocking: true,
      note: short.length
        ? `${short.length} material requirement${short.length > 1 ? 's' : ''} need supply.`
        : requirements.length
          ? 'Requirements are covered.'
          : 'No material required at this operation.',
    },
    {
      key: 'instruction',
      label: 'Instruction',
      ok: !!instruction,
      blocking: false,
      note: instruction
        ? `${instruction.code} is attached.`
        : 'No instruction attached. Follow the supervisor briefing.',
    },
    {
      key: 'quality',
      label: 'Quality',
      ok: !wo.qualityRequired || s.inspections.some((i) => i.woId === wo.id && i.status === 'passed'),
      blocking: false,
      note: wo.qualityRequired
        ? 'A passed inspection is needed before completion, not before start.'
        : 'No inspection gate for this operation.',
    },
  ]
}

export const isWoLate = (wo: WorkOrder, now: number) =>
  OPEN_WO_STATUSES.includes(wo.status) && now > toMs(wo.plannedEnd)

/** Critical first, then the earliest planned start. */
export const sortForDispatch = (wos: readonly WorkOrder[]) =>
  [...wos].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.plannedStart.localeCompare(b.plannedStart),
  )

export const hasPassedInspection = (inspections: readonly Inspection[], woId: string) =>
  inspections.some((i) => i.woId === woId && i.status === 'passed')

/** Work orders an operator may open at the station: assigned to them, or ready at one of their work centers. */
export function stationWorkOrders(s: Scoped, operatorId: string): WorkOrder[] {
  const person = s.maps.person.get(operatorId)
  const centers = new Set(person?.workCenterIds ?? [])
  return sortForDispatch(
    s.workOrders.filter(
      (w) =>
        OPEN_WO_STATUSES.includes(w.status) &&
        w.status !== 'waiting' &&
        (w.operatorIds.includes(operatorId) ||
          (w.status === 'ready' && w.operatorIds.length === 0 && centers.has(w.workCenterId))),
    ),
  )
}
