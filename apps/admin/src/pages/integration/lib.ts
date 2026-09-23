import { DAY, dayKey, toMs } from '@mes/fixtures'
import type { EventType, IntegrationSystem, OeeSnapshot, TelemetryPoint, WorkOrder } from '@mes/types'
import type { Scoped } from '../../state/scoped'

// ─── Telemetry ──────────────────────────────────────────────────

export type SignalKey = 'temperatureC' | 'speedRpm' | 'currentA' | 'pressureBar' | 'vibrationMmS'

export const SIGNALS: { key: SignalKey; label: string; unit: string; digits: number }[] = [
  { key: 'temperatureC', label: 'Temperature', unit: '°C', digits: 0 },
  { key: 'speedRpm', label: 'Speed', unit: 'RPM', digits: 0 },
  { key: 'currentA', label: 'Current', unit: 'A', digits: 1 },
  { key: 'pressureBar', label: 'Pressure', unit: 'bar', digits: 1 },
  { key: 'vibrationMmS', label: 'Vibration', unit: 'mm/s', digits: 2 },
]

export const byTime = (a: { at: string }, b: { at: string }) => toMs(a.at) - toMs(b.at)

export interface WoSegment {
  woId: string | null
  from: number
  to: number
  count: number
}

/** Consecutive telemetry points that share a work order, so history maps onto production runs. */
export function woSegments(points: readonly TelemetryPoint[]): WoSegment[] {
  const out: WoSegment[] = []
  for (const p of [...points].sort(byTime)) {
    const last = out.at(-1)
    const at = toMs(p.at)
    if (last && last.woId === p.woId) {
      last.to = at
      last.count += 1
    } else out.push({ woId: p.woId, from: at, to: at, count: 1 })
  }
  return out
}

/** Work order currently occupying a machine, if any. */
export const currentWo = (workOrders: readonly WorkOrder[], machineId: string) =>
  workOrders.find((w) => w.machineId === machineId && (w.status === 'in_progress' || w.status === 'paused'))

// ─── OEE ────────────────────────────────────────────────────────

export type OeeWindow = 'today' | '7' | '14'

export function oeeWindow(kind: OeeWindow, now: number): { fromKey: string; toKey: string; days: string[] } {
  const n = kind === 'today' ? 1 : Number(kind)
  const days = Array.from({ length: n }, (_, i) => dayKey(now - (n - 1 - i) * DAY))
  return { fromKey: days[0]!, toKey: days[n - 1]!, days }
}

export type OeeGroup = 'mo' | 'product' | 'wo' | 'operation' | 'shift' | 'machine' | 'operator'

export const OEE_GROUPS: { value: OeeGroup; label: string }[] = [
  { value: 'mo', label: 'MO' },
  { value: 'product', label: 'Product' },
  { value: 'wo', label: 'WO' },
  { value: 'operation', label: 'Operation' },
  { value: 'shift', label: 'Shift' },
  { value: 'machine', label: 'Machine' },
  { value: 'operator', label: 'Operator' },
]

type NameScope = Pick<Scoped, 'maps' | 'productName' | 'personName'>

/** Key and display label of a snapshot under one analysis dimension. */
export function oeeGroupKey(
  s: NameScope,
  snap: OeeSnapshot,
  group: OeeGroup,
): { key: string; label: string } {
  switch (group) {
    case 'mo':
      return {
        key: snap.moId ?? 'none',
        label: snap.moId ? (s.maps.mo.get(snap.moId)?.code ?? snap.moId) : 'No order',
      }
    case 'product':
      return {
        key: snap.productId ?? 'none',
        label: snap.productId ? s.productName(snap.productId) : 'No product',
      }
    case 'wo':
      return {
        key: snap.woId ?? 'none',
        label: snap.woId ? (s.maps.wo.get(snap.woId)?.code ?? snap.woId) : 'No work order',
      }
    case 'operation': {
      const wo = snap.woId ? s.maps.wo.get(snap.woId) : undefined
      return {
        key: wo ? String(wo.operationSeq) : 'none',
        label: wo ? `${wo.operationSeq} · ${wo.operationName}` : 'No operation',
      }
    }
    case 'shift':
      return { key: snap.shiftId, label: s.maps.shift.get(snap.shiftId)?.name ?? snap.shiftId }
    case 'machine':
      return { key: snap.machineId, label: s.maps.machine.get(snap.machineId)?.code ?? snap.machineId }
    case 'operator':
      return {
        key: snap.operatorId ?? 'none',
        label: snap.operatorId ? s.personName(snap.operatorId) : 'No operator',
      }
  }
}

/** The context payload MES sends OEE for a running work order (blueprint phase 14). */
export function mesToOeePayload(s: Pick<Scoped, 'maps' | 'productName'>, wo: WorkOrder) {
  const mo = s.maps.mo.get(wo.moId)
  const bor = mo?.snapshot ? s.maps.bor.get(mo.snapshot.borId) : undefined
  const item = bor?.items.find((i) => i.operationSeq === wo.operationSeq)
  return {
    mo: mo?.code ?? wo.moId,
    wo: wo.code,
    product: mo ? s.productName(mo.productId) : null,
    productRevision: mo?.snapshot?.rev ?? null,
    operation: `${wo.operationSeq} · ${wo.operationName}`,
    machine: wo.machineId,
    shift: wo.shiftId ? (s.maps.shift.get(wo.shiftId)?.code ?? wo.shiftId) : null,
    operator: wo.operatorIds.map((id) => s.maps.person.get(id)?.code ?? id),
    standardCycleSec: item?.standardCycleSec ?? null,
    targetQty: wo.targetQty,
  }
}

// ─── External systems ───────────────────────────────────────────

export const SYSTEM_ORDER: IntegrationSystem[] = [
  'device_monitoring',
  'oee',
  'cmms',
  'erp',
  'wms',
  'hris',
  'crm',
]

/** Blueprint section 15. */
export const OWNERSHIP: { domain: string; owner: string }[] = [
  { domain: 'Organization', owner: 'Manufacturing Platform' },
  { domain: 'Product', owner: 'PLM' },
  { domain: 'Material', owner: 'PLM / Manufacturing Master' },
  { domain: 'BOM', owner: 'PLM' },
  { domain: 'BOR', owner: 'PLM' },
  { domain: 'BOP', owner: 'PLM' },
  { domain: 'Specification', owner: 'PLM' },
  { domain: 'Work Instruction', owner: 'PLM' },
  { domain: 'Machine', owner: 'Shared Manufacturing Master' },
  { domain: 'Work Center', owner: 'Shared Manufacturing Master' },
  { domain: 'Tool / Mold', owner: 'Shared Manufacturing Master' },
  { domain: 'Operator', owner: 'Manufacturing Platform / HR Sync' },
  { domain: 'Skill', owner: 'Manufacturing Platform' },
  { domain: 'Shift', owner: 'Manufacturing Platform' },
  { domain: 'Location', owner: 'Manufacturing Platform' },
  { domain: 'Customer', owner: 'Commercial Master' },
  { domain: 'Supplier', owner: 'Supply Master' },
  { domain: 'Inventory Policy', owner: 'Planning' },
  { domain: 'Quality Master', owner: 'Quality' },
  { domain: 'Marketing Order', owner: 'Marketing & Demand' },
  { domain: 'Demand', owner: 'Demand Management' },
  { domain: 'MO / WO', owner: 'MES' },
  { domain: 'WIP', owner: 'MES' },
  { domain: 'Production Output', owner: 'MES' },
  { domain: 'OEE', owner: 'OEE System' },
  { domain: 'Machine Telemetry', owner: 'Device Monitoring' },
  { domain: 'Maintenance', owner: 'CMMS' },
]

/** Same names as the EventType union in @mes/types, in blueprint order. */
export const EVENT_TYPES: EventType[] = [
  'marketing_order.created',
  'marketing_order.confirmed',
  'demand.created',
  'demand.allocated',
  'replenishment.created',
  'manufacturing_order.created',
  'manufacturing_order.planned',
  'manufacturing_order.released',
  'manufacturing_order.started',
  'manufacturing_order.held',
  'manufacturing_order.completed',
  'workorder.created',
  'workorder.assigned',
  'workorder.started',
  'workorder.paused',
  'workorder.resumed',
  'workorder.completed',
  'material.required',
  'material.reserved',
  'material.staged',
  'material.issued',
  'material.consumed',
  'material.returned',
  'wip.created',
  'wip.moved',
  'wip.held',
  'wip.released',
  'quality.check.requested',
  'quality.check.passed',
  'quality.check.failed',
  'product.rejected',
  'product.reworked',
  'product.scrapped',
  'machine.alarm.triggered',
  'machine.downtime.started',
  'machine.downtime.ended',
  'maintenance.requested',
  'maintenance.completed',
  'finished_goods.received',
  'eco.released',
]
