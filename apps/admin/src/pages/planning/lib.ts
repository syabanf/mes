import {
  DAY,
  HOUR,
  MINUTE,
  addDays,
  fmtDateShort,
  fmtDateTime,
  materialReadiness,
  startOfDay,
  startOfWeek,
  toIso,
  toMs,
  wib,
} from '@mes/fixtures'
import type { IsoDate, Machine, WorkOrder } from '@mes/types'
import { PRIORITY_LABEL, PRIORITY_RANK } from '@mes/types'
import type { Scoped } from '../../state/scoped'

// ─── Windows ────────────────────────────────────────────────────

export type CapacityWindow = 'this' | 'next' | 'four'

export function capacityWindow(
  kind: CapacityWindow,
  now: number,
): { from: number; to: number; label: string } {
  const week = startOfWeek(now)
  if (kind === 'this')
    return {
      from: week,
      to: addDays(week, 7),
      label: `${fmtDateShort(week)} to ${fmtDateShort(addDays(week, 6))}`,
    }
  if (kind === 'next')
    return {
      from: addDays(week, 7),
      to: addDays(week, 14),
      label: `${fmtDateShort(addDays(week, 7))} to ${fmtDateShort(addDays(week, 13))}`,
    }
  return {
    from: week,
    to: addDays(week, 28),
    label: `${fmtDateShort(week)} to ${fmtDateShort(addDays(week, 27))}`,
  }
}

/** `?window=` on the capacity pages. Accepts the tab values and the short aliases week, next, 4w. */
export function parseCapacityWindow(value: string | null): CapacityWindow {
  if (value === 'next') return 'next'
  if (value === 'four' || value === '4w') return 'four'
  return 'this'
}

export const isOpenWo = (w: WorkOrder) => w.status !== 'completed' && w.status !== 'cancelled'
export const isActiveWo = (w: WorkOrder) => w.status === 'in_progress' || w.status === 'paused'
/** Not started yet, so the planner may still move it. */
export const isMovable = (w: WorkOrder) => isOpenWo(w) && !w.actualStart

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd

export function inWindow(w: WorkOrder, from: number, to: number) {
  return overlaps(toMs(w.plannedStart), toMs(w.plannedEnd), from, to)
}

export const durationMs = (w: WorkOrder) => Math.max(15 * MINUTE, toMs(w.plannedEnd) - toMs(w.plannedStart))

// ─── Scheduling ─────────────────────────────────────────────────

export interface Move {
  id: string
  plannedStart: IsoDate
  plannedEnd: IsoDate
}

type Slot = { wo: WorkOrder; start: number; end: number; fixed: boolean }

const byStartThenPriority = (a: Slot, b: Slot) =>
  a.start - b.start ||
  PRIORITY_RANK[a.wo.priority] - PRIORITY_RANK[b.wo.priority] ||
  a.wo.operationSeq - b.wo.operationSeq

/**
 * Forward scheduler. Running work stays where it is. On every machine, a work order that
 * overlaps an earlier one shifts to start when that one ends. Inside a manufacturing order an
 * operation never starts before the previous sequence finishes. Repeats until nothing moves.
 */
export function autoSchedule(workOrders: readonly WorkOrder[], now: number): Move[] {
  const slots = new Map<string, Slot>()
  for (const wo of workOrders) {
    if (!isOpenWo(wo)) continue
    const fixed = !isMovable(wo)
    const start = fixed ? toMs(wo.plannedStart) : Math.max(toMs(wo.plannedStart), now)
    slots.set(wo.id, { wo, start, end: start + durationMs(wo), fixed })
  }
  const shift = (slot: Slot, start: number) => {
    if (slot.fixed || start <= slot.start) return false
    slot.end = start + (slot.end - slot.start)
    slot.start = start
    return true
  }
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false
    const byMachine = new Map<string, Slot[]>()
    const byMo = new Map<string, Slot[]>()
    for (const slot of slots.values()) {
      if (slot.wo.machineId)
        byMachine.set(slot.wo.machineId, [...(byMachine.get(slot.wo.machineId) ?? []), slot])
      byMo.set(slot.wo.moId, [...(byMo.get(slot.wo.moId) ?? []), slot])
    }
    for (const list of byMachine.values()) {
      list.sort(byStartThenPriority)
      let cursor = -Infinity
      for (const slot of list) {
        if (slot.start < cursor) moved = shift(slot, cursor) || moved
        cursor = Math.max(cursor, slot.end)
      }
    }
    for (const list of byMo.values()) {
      list.sort((a, b) => a.wo.operationSeq - b.wo.operationSeq)
      for (let i = 1; i < list.length; i += 1) {
        const prev = list[i - 1]!
        const cur = list[i]!
        if (cur.start < prev.end) moved = shift(cur, prev.end) || moved
      }
    }
    if (!moved) break
  }
  return [...slots.values()]
    .filter((slot) => slot.start !== toMs(slot.wo.plannedStart) || slot.end !== toMs(slot.wo.plannedEnd))
    .map((slot) => ({ id: slot.wo.id, plannedStart: toIso(slot.start), plannedEnd: toIso(slot.end) }))
}

/** Every not-started work order whose planned start already passed moves to start now. */
export function replanFromNow(workOrders: readonly WorkOrder[], now: number): Move[] {
  const start = Math.ceil(now / (15 * MINUTE)) * 15 * MINUTE
  return workOrders
    .filter((w) => isMovable(w) && toMs(w.plannedStart) < now)
    .map((w) => ({ id: w.id, plannedStart: toIso(start), plannedEnd: toIso(start + durationMs(w)) }))
}

/** Other open work orders on the same machine that overlap the window. */
export function conflictsFor(
  wo: WorkOrder,
  start: number,
  end: number,
  workOrders: readonly WorkOrder[],
): WorkOrder[] {
  if (!wo.machineId) return []
  return workOrders.filter(
    (o) =>
      o.id !== wo.id &&
      o.machineId === wo.machineId &&
      isOpenWo(o) &&
      overlaps(start, end, toMs(o.plannedStart), toMs(o.plannedEnd)),
  )
}

export function conflictCount(workOrders: readonly WorkOrder[]): number {
  return workOrders.filter(
    (w) => isOpenWo(w) && conflictsFor(w, toMs(w.plannedStart), toMs(w.plannedEnd), workOrders).length > 0,
  ).length
}

// ─── Constraints ────────────────────────────────────────────────

export interface ConstraintStatus {
  key: string
  label: string
  /** null when the constraint does not apply to this work order. */
  ok: boolean | null
  text: string
}

type ConstraintScope = Pick<
  Scoped,
  | 'maps'
  | 'workOrders'
  | 'materialRequirements'
  | 'maintenanceRecords'
  | 'productName'
  | 'personName'
  | 'orgName'
  | 'shifts'
>

/** One line per blueprint constraint, evaluated for a work order. */
export function constraintStatuses(s: ConstraintScope, wo: WorkOrder, now: number): ConstraintStatus[] {
  const mo = s.maps.mo.get(wo.moId)
  const machine = wo.machineId ? s.maps.machine.get(wo.machineId) : undefined
  const start = toMs(wo.plannedStart)
  const end = toMs(wo.plannedEnd)
  const siblings = s.workOrders.filter((w) => w.moId === wo.moId && w.status !== 'cancelled')
  const bor = mo?.snapshot ? s.maps.bor.get(mo.snapshot.borId) : undefined
  const borItem = bor?.items.find((i) => i.operationSeq === wo.operationSeq)
  const bop = mo?.snapshot ? s.maps.bop.get(mo.snapshot.bopId) : undefined
  const operation = bop?.operations.find((o) => o.seq === wo.operationSeq)
  const operators = wo.operatorIds.map((id) => s.maps.person.get(id)).filter((p) => !!p)
  const readiness = mo ? materialReadiness(mo.id, s.materialRequirements) : 'ready'
  const maintenance = machine
    ? s.maintenanceRecords.find((r) => r.machineId === machine.id && r.status !== 'completed')
    : undefined
  const predecessors = siblings.filter((w) => w.operationSeq < wo.operationSeq)
  const latePredecessor = predecessors.find((p) => p.status !== 'completed' && toMs(p.plannedEnd) > start)
  const previousOnMachine = machine
    ? s.workOrders
        .filter(
          (w) =>
            w.id !== wo.id &&
            w.machineId === machine.id &&
            w.status !== 'cancelled' &&
            toMs(w.plannedEnd) <= start,
        )
        .sort((a, b) => toMs(b.plannedEnd) - toMs(a.plannedEnd))[0]
    : undefined
  const previousMo = previousOnMachine ? s.maps.mo.get(previousOnMachine.moId) : undefined
  const changeover = previousMo && mo && previousMo.productId !== mo.productId
  const setupMin = operation?.setupMin ?? borItem?.standardSetupMin ?? 0
  const gapMin = previousOnMachine ? (start - toMs(previousOnMachine.plannedEnd)) / MINUTE : Infinity
  const shift = wo.shiftId ? s.maps.shift.get(wo.shiftId) : undefined
  const weekday = wib(start).weekday
  const tools = wo.toolIds.map((id) => s.maps.resource.get(id)).filter((r) => !!r)
  const molds = wo.moldIds.map((id) => s.maps.resource.get(id)).filter((r) => !!r)
  const requiredSkills = borItem?.skillIds ?? []
  const uncovered = requiredSkills.filter((skillId) => !operators.some((p) => (p.skills[skillId] ?? 0) >= 2))
  const worn = [...tools, ...molds].filter((r) => r.lifeLimit && r.usageCount / r.lifeLimit > 0.8)

  return [
    {
      key: 'due',
      label: 'Due date',
      ok: mo ? end <= toMs(mo.plannedEnd) : null,
      text: mo
        ? end <= toMs(mo.plannedEnd)
          ? `Order due ${fmtDateTime(mo.plannedEnd)}, operation ends before it`
          : `Operation ends after the order due date ${fmtDateTime(mo.plannedEnd)}`
        : 'No order',
    },
    {
      key: 'priority',
      label: 'Priority',
      ok: true,
      text: `${PRIORITY_LABEL[wo.priority]}${mo && mo.priority !== wo.priority ? ` (order ${PRIORITY_LABEL[mo.priority]})` : ''}`,
    },
    {
      key: 'material',
      label: 'Material',
      ok: readiness === 'ready',
      text:
        readiness === 'ready'
          ? 'All requirements covered'
          : readiness === 'partial'
            ? 'Material partial'
            : 'Material shortage',
    },
    {
      key: 'machine',
      label: 'Machine',
      ok: machine
        ? machine.state !== 'down' &&
          machine.state !== 'offline' &&
          (machine.eligibleProductIds.length === 0 ||
            !mo ||
            machine.eligibleProductIds.includes(mo.productId))
        : false,
      text: machine
        ? mo && machine.eligibleProductIds.length > 0 && !machine.eligibleProductIds.includes(mo.productId)
          ? `${machine.code} is not eligible for ${s.productName(mo.productId)}`
          : `${machine.code} ${machine.state}${machine.telemetry.alarm ? ` · ${machine.telemetry.alarm}` : ''}`
        : 'No machine assigned',
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      ok: machine
        ? machine.maintenanceState === 'available' ||
          (machine.maintenanceState === 'planned' &&
            !(
              maintenance &&
              overlaps(start, end, toMs(maintenance.plannedStart), toMs(maintenance.plannedEnd))
            ))
        : null,
      text: !machine
        ? 'Applies once a machine is assigned'
        : machine.maintenanceState === 'in_maintenance'
          ? `Machine in maintenance until ${maintenance ? fmtDateTime(maintenance.plannedEnd) : 'CMMS completes the work'}`
          : machine.maintenanceState === 'unavailable'
            ? 'Machine unavailable per CMMS'
            : maintenance
              ? `Planned ${fmtDateTime(maintenance.plannedStart)} to ${fmtDateTime(maintenance.plannedEnd)}`
              : 'Available',
    },
    {
      key: 'operator',
      label: 'Operator',
      ok: operators.length > 0 && operators.every((p) => p.availability !== 'leave'),
      text:
        operators.length === 0
          ? 'No operator assigned'
          : operators.some((p) => p.availability === 'leave')
            ? `${operators
                .filter((p) => p.availability === 'leave')
                .map((p) => p.name)
                .join(', ')} on leave`
            : `${operators.map((p) => p.name).join(', ')} available`,
    },
    {
      key: 'skills',
      label: 'Skills',
      ok: requiredSkills.length === 0 ? null : uncovered.length === 0,
      text:
        requiredSkills.length === 0
          ? 'No skill requirement in the BOR'
          : uncovered.length === 0
            ? `${requiredSkills.length} required skills covered`
            : `${uncovered.map((id) => s.maps.skill.get(id)?.name ?? id).join(', ')} not covered by the assigned operators`,
    },
    {
      key: 'tools',
      label: 'Tools',
      ok:
        (borItem?.toolIds.length ?? 0) === 0 && tools.length === 0
          ? null
          : tools.length > 0 && tools.every((t) => t.status !== 'maintenance' && t.status !== 'retired'),
      text:
        tools.length === 0
          ? borItem?.toolIds.length
            ? `BOR needs ${borItem.toolIds.length} tools, none assigned`
            : 'No tool required'
          : tools.map((t) => `${t.code} ${t.status}`).join(', '),
    },
    {
      key: 'mold',
      label: 'Mold',
      ok:
        (borItem?.moldIds.length ?? 0) === 0 && molds.length === 0
          ? null
          : molds.length > 0 && molds.every((m) => m.status !== 'maintenance' && m.status !== 'retired'),
      text:
        molds.length === 0
          ? borItem?.moldIds.length
            ? `BOR needs ${borItem.moldIds.length} molds, none assigned`
            : 'No mold required'
          : molds
              .map(
                (m) =>
                  `${m.code} ${m.status}${m.lifeLimit ? ` · ${Math.round((m.usageCount / m.lifeLimit) * 100)}% of life` : ''}`,
              )
              .join(', ') + (worn.length ? ' · refurbish soon' : ''),
    },
    {
      key: 'shift',
      label: 'Shift',
      ok: shift ? shift.days.includes(weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6) : false,
      text: shift
        ? shift.days.includes(weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6)
          ? `${shift.name} ${shift.start} to ${shift.end}`
          : `${shift.name} does not run on the planned day`
        : 'No shift assigned',
    },
    {
      key: 'setup',
      label: 'Setup / changeover',
      ok: !previousOnMachine ? null : !changeover || gapMin >= setupMin,
      text: !previousOnMachine
        ? 'First job on the machine in this plan'
        : changeover
          ? `Changeover from ${s.productName(previousMo!.productId)} after ${previousOnMachine.code}; ${setupMin} min setup, ${Math.round(Math.min(gapMin, 9999))} min gap`
          : `Same product as ${previousOnMachine.code}, no changeover`,
    },
    {
      key: 'bop',
      label: 'BOP dependency',
      ok: predecessors.length === 0 ? null : !latePredecessor,
      text:
        predecessors.length === 0
          ? 'First operation of the order'
          : latePredecessor
            ? `Waits for operation ${latePredecessor.operationSeq} (${latePredecessor.code}) planned to end ${fmtDateTime(latePredecessor.plannedEnd)}`
            : `Operations ${predecessors.map((p) => p.operationSeq).join(', ')} finish before this one starts`,
    },
  ].map((c) =>
    c.key === 'due' && mo && now > toMs(mo.plannedEnd) && isOpenWo(wo)
      ? { ...c, ok: false, text: `Order due date ${fmtDateTime(mo.plannedEnd)} already passed` }
      : c,
  )
}

// ─── Gantt ──────────────────────────────────────────────────────

export type ScheduleSpan = 3 | 7 | 14

export function scheduleWindow(span: ScheduleSpan, now: number) {
  const from = startOfDay(now)
  return { from, to: addDays(from, span), days: Array.from({ length: span }, (_, i) => addDays(from, i)) }
}

/** Machines that belong to a line, or every machine of the site. */
export function machinesOnLine(machines: readonly Machine[], lineId: string | null) {
  return machines.filter((m) => m.active && (!lineId || m.lineId === lineId))
}

// ─── Resource load ──────────────────────────────────────────────

/** Planned hours of open work orders inside a window, clipped to it. */
export function plannedHours(workOrders: readonly WorkOrder[], from: number, to: number): number {
  return workOrders.reduce((sum, w) => {
    if (!isOpenWo(w)) return sum
    const start = Math.max(from, toMs(w.plannedStart))
    const end = Math.min(to, toMs(w.plannedEnd))
    return sum + Math.max(0, end - start) / HOUR
  }, 0)
}

/** Planned hours of open work orders per calendar day inside a window, clipped to each day. */
export function requiredHoursPerDay(
  workOrders: readonly WorkOrder[],
  from: number,
  to: number,
): { day: number; hours: number }[] {
  const days: { day: number; hours: number }[] = []
  for (let day = startOfDay(from); day < to; day = addDays(day, 1))
    days.push({ day, hours: plannedHours(workOrders, Math.max(day, from), Math.min(addDays(day, 1), to)) })
  return days
}

export function shiftHoursPerDay(shifts: readonly { start: string; end: string; breakMin: number }[]) {
  const minutesOf = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  return shifts.reduce((sum, sh) => {
    const start = minutesOf(sh.start)
    const end = minutesOf(sh.end)
    return sum + ((end > start ? end - start : 24 * 60 - start + end) - sh.breakMin) / 60
  }, 0)
}

export const NEXT_7_DAYS = 7 * DAY
