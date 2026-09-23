import type { AppState, TraceNode, TraceNodeKind } from '@mes/fixtures'
import type { EventType, ProductionEvent } from '@mes/types'

/** Count of every node kind in a trace tree, the root included. */
export function countKinds(root: TraceNode | null): Record<TraceNodeKind, number> {
  const counts = {
    product: 0,
    receipt: 0,
    serial: 0,
    batch: 0,
    wip: 0,
    operation: 0,
    machine: 0,
    operator: 0,
    lot: 0,
    supplier: 0,
    customer: 0,
    mo: 0,
    inspection: 0,
  }
  const seen = new Set<string>()
  const walk = (node: TraceNode) => {
    // The same machine or operator can sit under several operations; count each once.
    const key = `${node.kind}:${node.id}`
    if (!seen.has(key)) {
      seen.add(key)
      counts[node.kind] += 1
    }
    node.children.forEach(walk)
  }
  if (root) walk(root)
  return counts
}

export type EventFamily = 'demand' | 'mo' | 'wo' | 'material' | 'wip' | 'quality' | 'machine'
export const EVENT_FAMILIES: EventFamily[] = ['demand', 'mo', 'wo', 'material', 'wip', 'quality', 'machine']
export const EVENT_FAMILY_LABEL: Record<EventFamily, string> = {
  demand: 'Marketing and demand',
  mo: 'Manufacturing order',
  wo: 'Work order',
  material: 'Material',
  wip: 'WIP',
  quality: 'Quality',
  machine: 'Machine and maintenance',
}

export function eventFamily(type: EventType): EventFamily | null {
  const head = type.split('.')[0]
  switch (head) {
    case 'marketing_order':
    case 'demand':
    case 'replenishment':
      return 'demand'
    case 'manufacturing_order':
      return 'mo'
    case 'workorder':
      return 'wo'
    case 'material':
    case 'finished_goods':
      return 'material'
    case 'wip':
      return 'wip'
    case 'quality':
    case 'product':
      return 'quality'
    case 'machine':
    case 'maintenance':
      return 'machine'
    default:
      return null
  }
}

/** Everything the plant recorded about one order: the electronic manufacturing record. */
export function manufacturingRecord(state: AppState, moId: string) {
  const mo = state.manufacturingOrders.find((m) => m.id === moId)
  if (!mo) return null
  const person = (id: string | null) => (id ? (state.people.find((p) => p.id === id)?.name ?? id) : null)
  const workOrders = state.workOrders
    .filter((w) => w.moId === moId)
    .sort((a, b) => a.operationSeq - b.operationSeq)
    .map((w) => ({
      code: w.code,
      operationSeq: w.operationSeq,
      operation: w.operationName,
      status: w.status,
      machine: state.machines.find((m) => m.id === w.machineId)?.code ?? null,
      operators: w.operatorIds.map((id) => person(id)),
      plannedStart: w.plannedStart,
      plannedEnd: w.plannedEnd,
      actualStart: w.actualStart,
      actualEnd: w.actualEnd,
      goodQty: w.goodQty,
      rejectQty: w.rejectQty,
      reworkQty: w.reworkQty,
      scrapQty: w.scrapQty,
    }))
  const inspections = state.inspections
    .filter((i) => i.moId === moId)
    .map((i) => ({
      code: i.code,
      operationSeq: i.operationSeq,
      trigger: i.trigger,
      status: i.status,
      disposition: i.disposition,
      inspector: person(i.inspectorId),
      completedAt: i.completedAt,
      measurements: i.measurements.map((m) => ({
        name: m.name,
        value: m.value,
        result: m.result,
        min: m.min,
        max: m.max,
        unit: m.unit,
      })),
    }))
  const consumption = state.materialTxns
    .filter((t) => t.moId === moId && t.kind === 'consume')
    .map((t) => ({
      material: state.materials.find((m) => m.id === t.materialId)?.code ?? t.materialId,
      lot: state.materialLots.find((l) => l.id === t.lotId)?.code ?? t.lotId,
      qty: t.qty,
      operationSeq: t.operationSeq,
      at: t.at,
      by: person(t.by),
    }))
  const holds = state.qualityHolds
    .filter((h) => h.moId === moId)
    .map((h) => ({
      code: h.code,
      target: h.target,
      status: h.status,
      heldAt: h.heldAt,
      releasedAt: h.releasedAt,
      disposition: h.disposition,
    }))
  const scrap = state.scrapRecords
    .filter((r) => r.moId === moId)
    .map((r) => ({
      operationSeq: r.operationSeq,
      qty: r.qty,
      reason: state.reasonCodes.find((c) => c.id === r.reasonCodeId)?.label ?? r.reasonCodeId,
      at: r.at,
    }))
  const rework = state.reworkOrders
    .filter((r) => r.moId === moId)
    .map((r) => ({
      code: r.code,
      qty: r.qty,
      status: r.status,
      goodQty: r.goodQty,
      scrapQty: r.scrapQty,
      routeSeqs: r.routeSeqs,
    }))
  const events = state.productionEvents.filter((e) => e.moId === moId)
  return {
    order: {
      code: mo.code,
      product: state.products.find((p) => p.id === mo.productId)?.code ?? mo.productId,
      qty: mo.qty,
      status: mo.status,
      revision: mo.snapshot?.rev ?? null,
      actualStart: mo.actualStart,
      actualEnd: mo.actualEnd,
      goodQty: mo.goodQty,
      rejectQty: mo.rejectQty,
      reworkQty: mo.reworkQty,
      scrapQty: mo.scrapQty,
    },
    workOrders,
    inspections,
    consumption,
    holds,
    scrap,
    rework,
    receipts: state.finishedGoodsReceipts
      .filter((r) => r.moId === moId)
      .map((r) => ({ code: r.code, qty: r.qty, lotCode: r.lotCode, serials: r.serialIds.length, at: r.at })),
    events: events.map((e) => ({ at: e.at, type: e.type, text: e.text, by: person(e.by) })),
  }
}

/** Hands the browser a JSON file to save. */
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export const eventText = (e: ProductionEvent) => `${e.type} ${e.text}`.toLowerCase()
