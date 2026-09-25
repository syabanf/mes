import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  Inspection,
  Machine,
  ManufacturingOrder,
  MaterialLot,
  MaterialRequirement,
  Measurement,
  Wip,
  WorkOrder,
} from '@mes/types'
import {
  cascadeRemove,
  listedMachines,
  reduce,
  seedState,
  toIso,
  toMs,
  type AppAction,
  type AppState,
} from '../src/index'

const SITE = 'site-jkt'
const BY = 'per-supervisor'
const START = toMs('2026-10-01T08:00:00+07:00')

// Every dispatch is stamped one minute after the previous one, so "latest" lookups
// (inspections sort by requestedAt) stay deterministic.
let tick = 0
const send = (state: AppState, action: AppAction) =>
  reduce(state, { action, meta: { by: BY, at: toIso(START + tick++ * 60_000) } })

const moOf = (state: AppState, id: string) => state.manufacturingOrders.find((m) => m.id === id)!
const woOf = (state: AppState, id: string) => state.workOrders.find((w) => w.id === id)!
const wipOf = (state: AppState, id: string) => state.wips.find((w) => w.id === id)!
const woAt = (state: AppState, moId: string, seq: number) =>
  state.workOrders.find((w) => w.moId === moId && w.operationSeq === seq)!
const requirementsAt = (state: AppState, moId: string, seq: number) =>
  state.materialRequirements.filter((r) => r.moId === moId && r.operationSeq === seq)
const requirementOf = (state: AppState, id: string) => state.materialRequirements.find((r) => r.id === id)!
const activeWipAt = (state: AppState, moId: string, seq: number) =>
  state.wips.find((w) => w.moId === moId && w.operationSeq === seq && w.state !== 'completed')!

function lotFor(state: AppState, siteId: string, req: MaterialRequirement): MaterialLot {
  const lot = state.materialLots.find(
    (l) =>
      l.materialId === req.materialId &&
      l.siteId === siteId &&
      l.status === 'available' &&
      l.qty >= req.requiredQty,
  )
  assert.ok(lot, `no lot covers ${req.materialId} × ${req.requiredQty}`)
  return lot
}

function machineFor(state: AppState, wo: WorkOrder): Machine {
  const mo = moOf(state, wo.moId)
  const bor = state.bors.find((b) => b.id === mo.snapshot!.borId)!
  const item = bor.items.find((i) => i.operationSeq === wo.operationSeq)!
  const machine = listedMachines(state, wo.workCenterId, item.machineIds).find(
    (m) =>
      m.state !== 'down' &&
      m.maintenanceState === 'available' &&
      (m.eligibleProductIds.length === 0 || m.eligibleProductIds.includes(mo.productId)),
  )
  assert.ok(machine, `no eligible machine for operation ${wo.operationSeq}`)
  return machine
}

/** Reserve, stage and issue the full quantity of every requirement still short at one operation. */
function stageMaterials(state: AppState, mo: ManufacturingOrder, seq: number): AppState {
  const staging = state.inventoryLocations.find((l) => l.siteId === mo.siteId && l.kind === 'staging')!
  for (const req of requirementsAt(state, mo.id, seq).filter(
    (r) => r.status === 'shortage' || r.status === 'partial',
  )) {
    const lot = lotFor(state, mo.siteId, req)
    const move = { moId: mo.id, materialId: req.materialId, lotId: lot.id, qty: req.requiredQty }
    state = send(state, { type: 'materials/reserve', ...move })
    state = send(state, { type: 'materials/stage', ...move, toLocationId: staging.id })
    state = send(state, { type: 'materials/issue', ...move, woId: null })
  }
  return state
}

function consumeMaterials(state: AppState, wo: WorkOrder): AppState {
  for (const req of requirementsAt(state, wo.moId, wo.operationSeq).filter((r) => r.status !== 'consumed')) {
    const lot = state.materialLots.find((l) => l.materialId === req.materialId && l.status === 'staged')!
    state = send(state, {
      type: 'materials/consume',
      moId: wo.moId,
      woId: wo.id,
      materialId: req.materialId,
      lotId: lot.id,
      qty: req.requiredQty,
      mode: 'manual',
    })
  }
  return state
}

const measurement = (result: 'pass' | 'fail'): Measurement => ({
  characteristicId: 'chr-test',
  name: 'Net weight',
  type: 'numeric',
  value: result === 'pass' ? 25 : 24,
  result,
  note: '',
  target: 25,
  min: 24.9,
  max: 25.1,
  unit: 'g',
})

/** Request, start and record one inspection on the WO's active WIP. Returns the new state and the inspection. */
function inspect(
  state: AppState,
  wo: WorkOrder,
  result: 'pass' | 'fail',
  disposition: 'accept' | 'hold',
): [AppState, Inspection] {
  const mo = moOf(state, wo.moId)
  const wip = activeWipAt(state, wo.moId, wo.operationSeq)
  state = send(state, {
    type: 'inspections/request',
    inspection: {
      siteId: wo.siteId,
      planId: null,
      productId: mo.productId,
      moId: mo.id,
      woId: wo.id,
      wipId: wip.id,
      lotId: null,
      operationSeq: wo.operationSeq,
      trigger: 'end',
      sampleSize: 1,
      measurements: [],
      inspectorId: null,
      requestedAt: toIso(START + tick * 60_000),
      photos: [],
      note: '',
    },
  })
  const requested = state.inspections.at(-1)!
  assert.equal(requested.status, 'pending')
  state = send(state, { type: 'inspections/start', id: requested.id })
  assert.equal(state.inspections.find((i) => i.id === requested.id)?.status, 'in_progress')
  state = send(state, {
    type: 'inspections/record',
    id: requested.id,
    measurements: [measurement(result)],
    disposition,
    note: '',
    defects: [],
  })
  return [state, state.inspections.find((i) => i.id === requested.id)!]
}

/** Stage materials, assign, start, consume, inspect when required, record all good, complete. */
function runOperation(state: AppState, moId: string, seq: number): AppState {
  const mo = moOf(state, moId)
  state = stageMaterials(state, mo, seq)
  let wo = woAt(state, moId, seq)
  assert.equal(wo.status, 'ready', `operation ${seq} should be ready`)
  state = send(state, {
    type: 'workOrders/assign',
    id: wo.id,
    assignment: { machineId: machineFor(state, wo).id },
  })
  state = send(state, { type: 'workOrders/start', id: wo.id })
  wo = woOf(state, wo.id)
  assert.equal(wo.status, 'in_progress', `operation ${seq} should start`)
  state = consumeMaterials(state, wo)
  state = send(state, {
    type: 'workOrders/recordOutput',
    record: {
      id: wo.id,
      goodQty: mo.qty,
      rejectQty: 0,
      reworkQty: 0,
      scrapQty: 0,
      reasonCodeId: null,
      note: '',
    },
  })
  assert.equal(woOf(state, wo.id).goodQty, mo.qty)
  if (wo.qualityRequired) {
    const [inspected, inspection] = inspect(state, wo, 'pass', 'accept')
    assert.equal(inspection.status, 'passed')
    state = inspected
  }
  state = send(state, { type: 'workOrders/complete', id: wo.id })
  assert.equal(woOf(state, wo.id).status, 'completed', `operation ${seq} should complete`)
  return state
}

test('MTO and MTS lines travel from marketing order to closed manufacturing order', () => {
  let state = seedState()
  const mtoProduct = state.products.find(
    (p) => p.active && p.serialControlled && state.serialRules.some((r) => r.productId === p.id),
  )!
  const mtsProduct = state.products.find(
    (p) =>
      p.active &&
      !p.serialControlled &&
      state.fgStock.some((f) => f.siteId === SITE && f.productId === p.id && f.qty - f.allocatedQty >= 5),
  )!
  const customer = state.customers[0]!
  const day = toIso(START)
  const order = {
    id: 'mkt-journey',
    code: 'MKT-JOURNEY',
    siteId: SITE,
    customerId: customer.id,
    orderDate: day,
    requiredDate: day,
    priority: 'normal' as const,
    reference: 'PO-JOURNEY',
    status: 'draft' as const,
    note: '',
    deliveredAt: null,
    closedAt: null,
    createdBy: BY,
    createdAt: day,
  }
  const line = (id: string, n: number, productId: string, qty: number, strategy: 'mto' | 'mts') => ({
    id,
    orderId: order.id,
    line: n,
    productId,
    qty,
    uomId: 'uom-pcs',
    requiredDate: day,
    strategy,
    status: 'open' as const,
    allocatedQty: 0,
    producedQty: 0,
    deliveredQty: 0,
  })
  state = send(state, { type: 'marketingOrders/upsert', item: order })
  state = send(state, {
    type: 'marketingOrderItems/upsert',
    item: line('mkt-journey-l1', 1, mtoProduct.id, 4, 'mto'),
  })
  state = send(state, {
    type: 'marketingOrderItems/upsert',
    item: line('mkt-journey-l2', 2, mtsProduct.id, 5, 'mts'),
  })

  // Confirm raises one demand per line.
  state = send(state, { type: 'marketingOrders/confirm', id: order.id })
  assert.equal(state.marketingOrders.find((o) => o.id === order.id)?.status, 'confirmed')
  const mtoDemand = state.demands.find((d) => d.orderItemId === 'mkt-journey-l1')!
  const mtsDemand = state.demands.find((d) => d.orderItemId === 'mkt-journey-l2')!
  assert.equal(mtoDemand.qty, 4)
  assert.equal(mtsDemand.qty, 5)
  assert.equal(mtsDemand.status, 'open')

  // The MTS line is covered from stock.
  const stockBefore = state.fgStock.find(
    (f) => f.siteId === SITE && f.productId === mtsProduct.id && f.qty - f.allocatedQty >= 5,
  )!
  state = send(state, { type: 'demands/allocate', id: mtsDemand.id, qty: 5 })
  assert.equal(state.demands.find((d) => d.id === mtsDemand.id)?.allocatedQty, 5)
  assert.equal(state.demands.find((d) => d.id === mtsDemand.id)?.status, 'resolved')
  assert.equal(state.fgStock.find((f) => f.id === stockBefore.id)?.allocatedQty, stockBefore.allocatedQty + 5)
  assert.equal(state.marketingOrderItems.find((i) => i.id === 'mkt-journey-l2')?.status, 'ready')

  // The MTO line goes to production.
  state = send(state, {
    type: 'manufacturingOrders/create',
    draft: {
      id: 'mo-journey',
      siteId: SITE,
      productId: mtoProduct.id,
      qty: 4,
      source: 'mto',
      demandIds: [mtoDemand.id],
      replenishmentId: null,
      priority: 'normal',
      lineId: null,
      plannedStart: toIso(START + 24 * 3_600_000),
      plannedEnd: toIso(START + 48 * 3_600_000),
    },
  })
  assert.equal(moOf(state, 'mo-journey').status, 'draft')
  assert.equal(state.demands.find((d) => d.id === mtoDemand.id)?.status, 'resolved')
  assert.equal(state.demands.find((d) => d.id === mtoDemand.id)?.requirementQty, 4)
  assert.equal(state.marketingOrderItems.find((i) => i.id === 'mkt-journey-l1')?.status, 'in_production')

  state = send(state, { type: 'manufacturingOrders/plan', id: 'mo-journey' })
  assert.equal(moOf(state, 'mo-journey').status, 'planned')
  assert.ok(moOf(state, 'mo-journey').validations.length > 0)

  state = send(state, { type: 'manufacturingOrders/release', id: 'mo-journey' })
  const released = moOf(state, 'mo-journey')
  assert.equal(released.status, 'released')
  assert.ok(released.snapshot)
  const bom = state.boms.find((b) => b.id === released.snapshot!.bomId)!
  const wos = state.workOrders
    .filter((w) => w.moId === 'mo-journey')
    .sort((a, b) => a.operationSeq - b.operationSeq)
  assert.deepEqual(
    wos.map((w) => [w.operationSeq, w.status]),
    [
      [10, 'ready'],
      [20, 'waiting'],
      [30, 'waiting'],
      [40, 'waiting'],
      [50, 'waiting'],
      [60, 'waiting'],
    ],
  )
  const requirements = state.materialRequirements.filter((r) => r.moId === 'mo-journey')
  assert.equal(requirements.length, bom.items.length)
  assert.ok(requirements.every((r) => r.status === 'shortage'))
  const wips = state.wips.filter((w) => w.moId === 'mo-journey')
  assert.equal(wips.length, 1)
  assert.equal(wips[0]!.state, 'queued')
  assert.equal(wips[0]!.qty, 4)
  const firstWip = wips[0]!

  // Operation 10: materials first (start refuses a shortage), then assign and start.
  const op10 = woAt(state, 'mo-journey', 10)
  const req = requirementsAt(state, 'mo-journey', 10)[0]!
  const lot = lotFor(state, SITE, req)
  const staging = state.inventoryLocations.find((l) => l.siteId === SITE && l.kind === 'staging')!
  const move = { moId: 'mo-journey', materialId: req.materialId, lotId: lot.id, qty: req.requiredQty }
  state = send(state, { type: 'materials/reserve', ...move })
  assert.equal(requirementOf(state, req.id).reservedQty, req.requiredQty)
  assert.equal(requirementOf(state, req.id).status, 'ready')
  state = send(state, { type: 'materials/stage', ...move, toLocationId: staging.id })
  assert.equal(requirementOf(state, req.id).reservedQty, 0)
  assert.equal(requirementOf(state, req.id).stagedQty, req.requiredQty)
  assert.equal(state.materialLots.find((l) => l.id === lot.id)?.locationId, staging.id)
  state = send(state, { type: 'materials/issue', ...move, woId: null })
  assert.equal(requirementOf(state, req.id).stagedQty, 0)
  assert.equal(requirementOf(state, req.id).issuedQty, req.requiredQty)
  assert.equal(requirementOf(state, req.id).status, 'ready')
  state = stageMaterials(state, moOf(state, 'mo-journey'), 10)

  const machine = machineFor(state, op10)
  state = send(state, { type: 'workOrders/assign', id: op10.id, assignment: { machineId: machine.id } })
  assert.equal(woOf(state, op10.id).status, 'assigned')
  state = send(state, { type: 'workOrders/start', id: op10.id })
  assert.equal(woOf(state, op10.id).status, 'in_progress')
  assert.equal(moOf(state, 'mo-journey').status, 'in_progress')
  assert.equal(state.machines.find((m) => m.id === machine.id)?.state, 'running')
  assert.equal(wipOf(state, firstWip.id).state, 'processing')
  assert.equal(wipOf(state, firstWip.id).woId, op10.id)

  state = send(state, { type: 'materials/consume', ...move, woId: op10.id, mode: 'manual' })
  assert.equal(requirementOf(state, req.id).issuedQty, 0)
  assert.equal(requirementOf(state, req.id).consumedQty, req.requiredQty)
  assert.equal(requirementOf(state, req.id).status, 'consumed')
  assert.equal(state.materialLots.find((l) => l.id === lot.id)?.qty, lot.qty - req.requiredQty)
  assert.ok(wipOf(state, firstWip.id).lotIds.includes(lot.id))
  state = consumeMaterials(state, woOf(state, op10.id))

  state = send(state, {
    type: 'workOrders/recordOutput',
    record: {
      id: op10.id,
      goodQty: 4,
      rejectQty: 0,
      reworkQty: 0,
      scrapQty: 0,
      reasonCodeId: null,
      note: '',
    },
  })
  assert.equal(woOf(state, op10.id).goodQty, 4)
  assert.equal(woOf(state, op10.id).outputQty, 4)
  assert.equal(wipOf(state, firstWip.id).qty, 0)
  const op20Wip = activeWipAt(state, 'mo-journey', 20)
  assert.equal(op20Wip.state, 'queued')
  assert.equal(op20Wip.qty, 4)
  assert.deepEqual(op20Wip.parentIds, [firstWip.id])

  state = send(state, { type: 'workOrders/complete', id: op10.id })
  assert.equal(woOf(state, op10.id).status, 'completed')
  assert.equal(woAt(state, 'mo-journey', 20).status, 'ready')
  assert.equal(wipOf(state, firstWip.id).state, 'completed')
  assert.equal(state.machines.find((m) => m.id === machine.id)?.state, 'idle')
  assert.equal(moOf(state, 'mo-journey').goodQty, 0)

  for (const seq of [20, 30, 40, 50, 60]) {
    state = runOperation(state, 'mo-journey', seq)
    if (seq < 60) assert.equal(woAt(state, 'mo-journey', seq + 10).status, 'ready')
  }
  assert.equal(moOf(state, 'mo-journey').goodQty, 4)
  assert.equal(moOf(state, 'mo-journey').status, 'completed')
  assert.ok(
    state.materialRequirements.filter((r) => r.moId === 'mo-journey').every((r) => r.status === 'consumed'),
  )
  // The last completion already closed out the order, so an explicit complete is a no-op.
  assert.equal(send(state, { type: 'manufacturingOrders/complete', id: 'mo-journey' }), state)

  // Warehouse receipt: stock, receipt, serials, and the customer line turns ready.
  const fgLocation = state.inventoryLocations.find((l) => l.siteId === SITE && l.kind === 'finished_goods')!
  const fgBefore = state.fgStock.find((f) => f.productId === mtoProduct.id && f.locationId === fgLocation.id)
  const serialsBefore = state.serials.length
  state = send(state, {
    type: 'finishedGoods/receive',
    moId: 'mo-journey',
    qty: 4,
    locationId: fgLocation.id,
  })
  const fgAfter = state.fgStock.find((f) => f.productId === mtoProduct.id && f.locationId === fgLocation.id)!
  assert.equal(fgAfter.qty, (fgBefore?.qty ?? 0) + 4)
  const receipt = state.finishedGoodsReceipts.find((r) => r.moId === 'mo-journey')!
  assert.equal(receipt.qty, 4)
  assert.equal(receipt.serialIds.length, 4)
  assert.equal(state.serials.length, serialsBefore + 4)
  assert.ok(receipt.serialIds.every((id) => state.serials.find((s) => s.id === id)?.receiptId === receipt.id))
  assert.equal(state.marketingOrderItems.find((i) => i.id === 'mkt-journey-l1')?.status, 'ready')
  assert.equal(state.marketingOrderItems.find((i) => i.id === 'mkt-journey-l1')?.producedQty, 4)

  // Delivery of both lines empties the order and the stock it used.
  state = send(state, { type: 'marketingOrderItems/deliver', id: 'mkt-journey-l1', qty: 4 })
  assert.equal(state.marketingOrderItems.find((i) => i.id === 'mkt-journey-l1')?.status, 'delivered')
  assert.equal(state.fgStock.find((f) => f.id === fgAfter.id)?.qty, fgAfter.qty - 4)
  assert.equal(state.marketingOrders.find((o) => o.id === order.id)?.status, 'partially_delivered')
  assert.equal(state.demands.find((d) => d.id === mtoDemand.id)?.status, 'fulfilled')
  state = send(state, { type: 'marketingOrderItems/deliver', id: 'mkt-journey-l2', qty: 5 })
  assert.equal(state.marketingOrderItems.find((i) => i.id === 'mkt-journey-l2')?.deliveredQty, 5)
  assert.equal(state.fgStock.find((f) => f.id === stockBefore.id)?.qty, stockBefore.qty - 5)
  assert.equal(state.fgStock.find((f) => f.id === stockBefore.id)?.allocatedQty, stockBefore.allocatedQty)
  const delivered = state.marketingOrders.find((o) => o.id === order.id)!
  assert.equal(delivered.status, 'delivered')
  assert.ok(delivered.deliveredAt)

  state = send(state, { type: 'manufacturingOrders/close', id: 'mo-journey' })
  assert.equal(moOf(state, 'mo-journey').status, 'closed')
  assert.equal(state.demands.find((d) => d.id === mtoDemand.id)?.status, 'fulfilled')
})

test('quality gate: a required operation completes only after a passed inspection', () => {
  let state = seedState()
  const wo = state.workOrders.find(
    (w) =>
      w.qualityRequired &&
      w.status === 'in_progress' &&
      state.wips.some(
        (x) =>
          x.moId === w.moId && x.operationSeq === w.operationSeq && x.state === 'processing' && x.qty > 0,
      ),
  )!
  assert.ok(wo, 'seed has an in-progress quality operation')
  const wip = activeWipAt(state, wo.moId, wo.operationSeq)

  // No passed inspection yet: the reducer refuses to complete.
  assert.equal(send(state, { type: 'workOrders/complete', id: wo.id }), state)

  const holdsBefore = state.qualityHolds.length
  const [held, failing] = inspect(state, wo, 'fail', 'hold')
  state = held
  assert.equal(failing.status, 'failed')
  assert.equal(failing.disposition, 'hold')
  assert.equal(wipOf(state, wip.id).state, 'quality_hold')
  const hold = state.qualityHolds.find((h) => h.targetId === wip.id && h.status === 'active')!
  assert.equal(state.qualityHolds.length, holdsBefore + 1)
  assert.equal(hold.moId, wo.moId)
  assert.equal(send(state, { type: 'workOrders/complete', id: wo.id }), state)

  state = send(state, { type: 'qualityHolds/release', id: hold.id, disposition: 'accept' })
  assert.equal(state.qualityHolds.find((h) => h.id === hold.id)?.status, 'released')
  assert.equal(state.qualityHolds.find((h) => h.id === hold.id)?.disposition, 'accept')
  assert.equal(wipOf(state, wip.id).state, 'queued')
  // The latest inspection still failed, so the gate stays shut.
  assert.equal(send(state, { type: 'workOrders/complete', id: wo.id }), state)

  const [passed, passing] = inspect(state, wo, 'pass', 'accept')
  state = passed
  assert.equal(passing.status, 'passed')
  state = send(state, { type: 'workOrders/complete', id: wo.id })
  assert.equal(woOf(state, wo.id).status, 'completed')
  assert.ok(woOf(state, wo.id).actualEnd)
})

test('scrap and rework output feed rework orders and order totals', () => {
  let state = seedState()
  const wo = state.workOrders.find(
    (w) =>
      w.status === 'in_progress' &&
      !w.qualityRequired &&
      w.targetQty - w.outputQty >= 3 &&
      state.wips.some(
        (x) =>
          x.moId === w.moId && x.operationSeq === w.operationSeq && x.state === 'processing' && x.qty >= 3,
      ),
  )!
  assert.ok(wo, 'seed has an in-progress operation with input to spare')
  const input = activeWipAt(state, wo.moId, wo.operationSeq)
  const mo = moOf(state, wo.moId)
  const reworkReason = state.reasonCodes.find((r) => r.kind === 'rework')!
  const scrapReason = state.reasonCodes.find((r) => r.kind === 'scrap')!
  const reworksBefore = state.reworkOrders.length
  const scrapsBefore = state.scrapRecords.length

  state = send(state, {
    type: 'workOrders/recordOutput',
    record: {
      id: wo.id,
      goodQty: 0,
      rejectQty: 0,
      reworkQty: 2,
      scrapQty: 0,
      reasonCodeId: reworkReason.id,
      note: '',
    },
  })
  assert.equal(state.reworkOrders.length, reworksBefore + 1)
  const rework = state.reworkOrders.at(-1)!
  assert.equal(rework.sourceWoId, wo.id)
  assert.equal(rework.qty, 2)
  assert.equal(rework.status, 'open')
  assert.ok(rework.routeSeqs.length > 0)
  const reworkWip = wipOf(state, rework.reworkWipId!)
  assert.equal(reworkWip.state, 'rework')
  assert.equal(reworkWip.qty, 2)
  assert.deepEqual(reworkWip.parentIds, [input.id])
  assert.equal(wipOf(state, input.id).qty, input.qty - 2)
  assert.equal(woOf(state, wo.id).reworkQty, wo.reworkQty + 2)
  assert.equal(woOf(state, wo.id).outputQty, wo.outputQty + 2)
  assert.equal(moOf(state, mo.id).reworkQty, mo.reworkQty + 2)

  state = send(state, {
    type: 'workOrders/recordOutput',
    record: {
      id: wo.id,
      goodQty: 0,
      rejectQty: 0,
      reworkQty: 0,
      scrapQty: 1,
      reasonCodeId: scrapReason.id,
      note: '',
    },
  })
  assert.equal(state.scrapRecords.length, scrapsBefore + 1)
  const scrap = state.scrapRecords.at(-1)!
  assert.equal(scrap.woId, wo.id)
  assert.equal(scrap.qty, 1)
  assert.equal(scrap.reasonCodeId, scrapReason.id)
  assert.equal(wipOf(state, input.id).qty, input.qty - 3)
  assert.equal(woOf(state, wo.id).scrapQty, wo.scrapQty + 1)
  assert.equal(woOf(state, wo.id).outputQty, wo.outputQty + 3)
  assert.equal(moOf(state, mo.id).scrapQty, mo.scrapQty + 1)

  state = send(state, { type: 'rework/setStatus', id: rework.id, status: 'inspection' })
  assert.equal(state.reworkOrders.find((r) => r.id === rework.id)?.status, 'inspection')

  state = send(state, { type: 'rework/close', id: rework.id, goodQty: 1, scrapQty: 1 })
  const closed = state.reworkOrders.find((r) => r.id === rework.id)!
  assert.equal(closed.status, 'closed')
  assert.equal(closed.goodQty, 1)
  assert.equal(closed.scrapQty, 1)
  assert.ok(closed.closedAt)
  assert.equal(wipOf(state, reworkWip.id).qty, 1)
  assert.equal(wipOf(state, reworkWip.id).state, 'completed')
  assert.equal(moOf(state, mo.id).goodQty, mo.goodQty + 1)
  assert.equal(moOf(state, mo.id).scrapQty, mo.scrapQty + 2)
})

test('replenishment proposes below the reorder point, then approves into an MTS order', () => {
  const seed = seedState()
  const policy = seed.inventoryPolicies.find(
    (p) =>
      p.siteId === SITE &&
      !seed.replenishments.some(
        (r) => r.productId === p.productId && ['proposed', 'approved', 'in_production'].includes(r.status),
      ),
  )!
  assert.ok(policy, 'seed has a Jakarta policy without an open proposal')
  // Drop the product's Jakarta stock to 400 free pieces so it sits under the reorder point.
  let first = true
  let state: AppState = {
    ...seed,
    fgStock: seed.fgStock.map((f) => {
      if (f.siteId !== SITE || f.productId !== policy.productId) return f
      const row = { ...f, qty: first ? 400 : 0, allocatedQty: 0 }
      first = false
      return row
    }),
  }
  const openDemand = state.demands
    .filter((d) => d.productId === policy.productId && d.status === 'open')
    .reduce((sum, d) => sum + d.qty - d.allocatedQty - d.requirementQty, 0)
  const inbound = state.manufacturingOrders
    .filter(
      (m) => m.productId === policy.productId && ['planned', 'released', 'in_progress'].includes(m.status),
    )
    .reduce((sum, m) => sum + m.qty - m.goodQty, 0)
  const projected = 400 - openDemand + inbound
  assert.ok(projected < policy.reorderPoint)
  const shortfall = Math.max(policy.replenishQty, policy.maxStock - projected)
  const requiredQty = Math.ceil(shortfall / policy.productionMultiple) * policy.productionMultiple

  const before = state.replenishments.length
  state = send(state, { type: 'replenishments/run', siteId: SITE })
  const created = state.replenishments.slice(before)
  const proposal = created.find((r) => r.productId === policy.productId)!
  assert.ok(proposal)
  assert.equal(proposal.status, 'proposed')
  assert.equal(proposal.onHand, 400)
  assert.equal(proposal.projected, projected)
  assert.equal(proposal.reorderPoint, policy.reorderPoint)
  assert.equal(proposal.requiredQty, requiredQty)

  // Every other Jakarta policy is either already covered or sits above its reorder point.
  for (const other of state.inventoryPolicies.filter((p) => p.siteId === SITE && p.id !== policy.id)) {
    const covered = seed.replenishments.some(
      (r) => r.productId === other.productId && ['proposed', 'approved', 'in_production'].includes(r.status),
    )
    const onHand = state.fgStock
      .filter((f) => f.siteId === SITE && f.productId === other.productId)
      .reduce((sum, f) => sum + f.qty - f.allocatedQty, 0)
    const demand = state.demands
      .filter((d) => d.productId === other.productId && d.status === 'open')
      .reduce((sum, d) => sum + d.qty - d.allocatedQty - d.requirementQty, 0)
    const making = state.manufacturingOrders
      .filter(
        (m) => m.productId === other.productId && ['planned', 'released', 'in_progress'].includes(m.status),
      )
      .reduce((sum, m) => sum + m.qty - m.goodQty, 0)
    const expected = !covered && onHand - demand + making < other.reorderPoint
    assert.equal(
      created.some((r) => r.productId === other.productId),
      expected,
      other.productId,
    )
  }

  const moCount = state.manufacturingOrders.length
  state = send(state, {
    type: 'replenishments/approve',
    id: proposal.id,
    plannedStart: toIso(START + 24 * 3_600_000),
    plannedEnd: toIso(START + 72 * 3_600_000),
    lineId: null,
  })
  assert.equal(state.manufacturingOrders.length, moCount + 1)
  const mo = state.manufacturingOrders.at(-1)!
  assert.equal(mo.source, 'mts')
  assert.equal(mo.productId, policy.productId)
  assert.equal(mo.qty, requiredQty)
  assert.equal(mo.replenishmentId, proposal.id)
  assert.equal(mo.status, 'draft')
  const approved = state.replenishments.find((r) => r.id === proposal.id)!
  assert.equal(approved.status, 'approved')
  assert.equal(approved.moId, mo.id)

  const pending = state.replenishments.find((r) => r.status === 'proposed')!
  state = send(state, { type: 'replenishments/dismiss', id: pending.id })
  assert.equal(state.replenishments.find((r) => r.id === pending.id)?.status, 'dismissed')
})

test('machine failure pauses the running operation until maintenance completes', () => {
  let state = seedState()
  const wo = state.workOrders.find(
    (w) =>
      w.status === 'in_progress' &&
      w.machineId !== null &&
      state.machines.find((m) => m.id === w.machineId)?.maintenanceState === 'available' &&
      !moOf(state, w.moId).atRisk,
  )!
  assert.ok(wo, 'seed has a running operation on an available machine')
  const machineId = wo.machineId!

  state = send(state, { type: 'machines/setState', id: machineId, state: 'down', alarm: 'Spindle overload' })
  assert.equal(state.machines.find((m) => m.id === machineId)?.state, 'down')
  assert.equal(state.machines.find((m) => m.id === machineId)?.telemetry.alarm, 'Spindle overload')
  assert.equal(woOf(state, wo.id).status, 'paused')
  assert.equal(woOf(state, wo.id).pauseReason, 'machine')
  assert.equal(moOf(state, wo.moId).atRisk, true)

  const before = state.maintenanceRecords.length
  state = send(state, {
    type: 'maintenance/request',
    machineId,
    title: 'Spindle repair',
    alarm: 'Spindle overload',
  })
  assert.equal(state.maintenanceRecords.length, before + 1)
  const record = state.maintenanceRecords.at(-1)!
  assert.equal(record.machineId, machineId)
  assert.equal(record.status, 'requested')
  assert.ok(record.impactedWoIds.includes(wo.id))
  assert.equal(state.machines.find((m) => m.id === machineId)?.maintenanceState, 'in_maintenance')

  state = send(state, { type: 'maintenance/complete', id: record.id })
  const done = state.maintenanceRecords.find((r) => r.id === record.id)!
  assert.equal(done.status, 'completed')
  assert.ok(done.completedAt)
  assert.equal(woOf(state, wo.id).status, 'in_progress')
  assert.equal(woOf(state, wo.id).pauseReason, null)
  assert.equal(moOf(state, wo.moId).atRisk, false)
  assert.equal(moOf(state, wo.moId).atRiskReason, '')
  const machine = state.machines.find((m) => m.id === machineId)!
  assert.equal(machine.state, 'idle')
  assert.equal(machine.maintenanceState, 'available')
  assert.equal(machine.telemetry.alarm, null)
})

test('upsert and remove cascade through demands, WIP, holds, inspections and work orders', () => {
  const seed = seedState()
  let state = seed
  const template = <T extends { id: string }>(list: T[], pick: (row: T) => boolean = () => true): T => {
    const row = list.find(pick)
    assert.ok(row)
    return row
  }

  // Demands: a free-standing demand comes and goes; one tied to an order stays.
  const demand = {
    ...template(seed.demands),
    id: 'dmd-crud',
    code: 'DMD-CRUD',
    orderItemId: null,
    moIds: [],
    allocatedQty: 0,
  }
  state = send(state, { type: 'demands/upsert', item: demand })
  assert.ok(state.demands.some((d) => d.id === 'dmd-crud'))
  state = send(state, { type: 'demands/remove', id: 'dmd-crud' })
  assert.ok(!state.demands.some((d) => d.id === 'dmd-crud'))
  const linked = template(seed.demands, (d) => d.orderItemId !== null)
  assert.equal(send(state, { type: 'demands/remove', id: linked.id }), state)

  // WIP: removing a parent clears child links and rework references.
  const wipBase = template(seed.wips)
  const parent: Wip = { ...wipBase, id: 'wip-crud-a', code: 'WIP-CRUD-A', parentIds: [] }
  const child: Wip = { ...wipBase, id: 'wip-crud-b', code: 'WIP-CRUD-B', parentIds: ['wip-crud-a'] }
  const rework = {
    ...template(seed.reworkOrders),
    id: 'rwk-crud',
    sourceWipId: 'wip-crud-a',
    reworkWipId: 'wip-crud-b',
  }
  state = send(state, { type: 'wips/upsert', item: parent })
  state = send(state, { type: 'wips/upsert', item: child })
  state = send(state, { type: 'reworkOrders/upsert', item: rework })
  assert.equal(state.wips.filter((w) => w.id.startsWith('wip-crud')).length, 2)
  state = send(state, { type: 'wips/remove', id: 'wip-crud-a' })
  assert.ok(!state.wips.some((w) => w.id === 'wip-crud-a'))
  assert.deepEqual(wipOf(state, 'wip-crud-b').parentIds, [])
  assert.equal(state.reworkOrders.find((r) => r.id === 'rwk-crud')?.sourceWipId, null)
  assert.equal(state.reworkOrders.find((r) => r.id === 'rwk-crud')?.reworkWipId, 'wip-crud-b')

  // Quality holds.
  const hold = { ...template(seed.qualityHolds), id: 'qh-crud', code: 'QH-CRUD' }
  state = send(state, { type: 'qualityHolds/upsert', item: hold })
  assert.ok(state.qualityHolds.some((h) => h.id === 'qh-crud'))
  state = send(state, { type: 'qualityHolds/remove', id: 'qh-crud' })
  assert.ok(!state.qualityHolds.some((h) => h.id === 'qh-crud'))

  // Inspections: pending ones can go; recorded ones and ones with defects are kept by the reducer.
  const pending: Inspection = {
    ...template(seed.inspections),
    id: 'ins-crud',
    code: 'INS-CRUD',
    status: 'pending',
    defectRecordIds: [],
  }
  state = send(state, { type: 'inspections/upsert', item: pending })
  assert.ok(state.inspections.some((i) => i.id === 'ins-crud'))
  state = send(state, { type: 'inspections/remove', id: 'ins-crud' })
  assert.ok(!state.inspections.some((i) => i.id === 'ins-crud'))
  const recorded = template(seed.inspections, (i) => i.status === 'passed' || i.status === 'failed')
  assert.equal(send(state, { type: 'inspections/upsert', item: { ...recorded, note: 'edited' } }), state)
  assert.equal(send(state, { type: 'inspections/remove', id: recorded.id }), state)
  const withDefects = template(seed.inspections, (i) =>
    seed.defectRecords.some((d) => d.inspectionId === i.id),
  )
  assert.equal(send(state, { type: 'inspections/remove', id: withDefects.id }), state)
  const cascaded = cascadeRemove(state, 'inspections', withDefects.id)
  assert.ok(!cascaded.inspections.some((i) => i.id === withDefects.id))
  assert.ok(cascaded.defectRecords.some((d) => d.inspectionId === null))
  assert.ok(!cascaded.defectRecords.some((d) => d.inspectionId === withDefects.id))

  // Work orders: their WIP goes with them, inspections keep the record but lose the link.
  const woBase = template(seed.workOrders)
  const wo: WorkOrder = { ...woBase, id: 'wo-crud', code: 'WO-CRUD', operationSeq: 99 }
  const woWip: Wip = {
    ...wipBase,
    id: 'wip-crud-c',
    code: 'WIP-CRUD-C',
    woId: 'wo-crud',
    moId: wo.moId,
    parentIds: [],
  }
  const woInspection: Inspection = {
    ...template(seed.inspections),
    id: 'ins-crud-wo',
    code: 'INS-CRUD-WO',
    status: 'pending',
    woId: 'wo-crud',
    defectRecordIds: [],
  }
  state = send(state, { type: 'workOrders/upsert', item: wo })
  state = send(state, { type: 'wips/upsert', item: woWip })
  state = send(state, { type: 'inspections/upsert', item: woInspection })
  assert.ok(state.workOrders.some((w) => w.id === 'wo-crud'))
  state = send(state, { type: 'workOrders/remove', id: 'wo-crud' })
  assert.ok(!state.workOrders.some((w) => w.id === 'wo-crud'))
  assert.ok(!state.wips.some((w) => w.id === 'wip-crud-c'))
  assert.equal(state.inspections.find((i) => i.id === 'ins-crud-wo')?.woId, null)
})
