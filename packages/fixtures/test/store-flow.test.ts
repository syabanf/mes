import assert from 'node:assert/strict'
import test from 'node:test'
import { reduce, seedState, type AppAction, type AppState } from '../src/index'

const meta = { by: 'test-user', at: '2026-09-23T10:00:00+07:00' }
const send = (state: AppState, action: AppAction) => reduce(state, { action, meta })

test('delivery consumes exactly one site and rejects unavailable stock', () => {
  const state = seedState()
  const item = state.marketingOrderItems.find((i) => i.id === 'mkt-12-l1')!
  const jakarta = state.fgStock.find((f) => f.siteId === 'site-jkt' && f.productId === item.productId)!
  const surabaya = state.fgStock.find((f) => f.siteId === 'site-sby' && f.productId === item.productId)!
  const delivered = send(state, { type: 'marketingOrderItems/deliver', id: item.id, qty: 1 })
  assert.equal(delivered.fgStock.find((f) => f.id === jakarta.id)!.qty, jakarta.qty - 1)
  assert.equal(delivered.fgStock.find((f) => f.id === jakarta.id)!.allocatedQty, jakarta.allocatedQty - 1)
  assert.deepEqual(
    delivered.fgStock.find((f) => f.id === surabaya.id),
    surabaya,
  )
  const unavailable = {
    ...state,
    fgStock: state.fgStock.map((f) => (f.id === jakarta.id ? { ...f, qty: 0, allocatedQty: 0 } : f)),
  }
  assert.equal(send(unavailable, { type: 'marketingOrderItems/deliver', id: item.id, qty: 1 }), unavailable)
})

test('MO remains open while an operation is unfinished', () => {
  const state = seedState()
  const mo = state.manufacturingOrders.find((m) => m.code === 'MO-2026-00285')!
  const next = send(state, { type: 'manufacturingOrders/complete', id: mo.id })
  assert.equal(next, state)
})

test('quality operation needs an accepted latest inspection', () => {
  const state = seedState()
  const wo = state.workOrders.find((w) => w.code === 'MO-2026-00304-50')!
  assert.equal(send(state, { type: 'workOrders/complete', id: wo.id }), state)
  const inspection = state.inspections.find((i) => i.woId === wo.id)!
  const passed = {
    ...state,
    inspections: state.inspections.map((i) =>
      i.id === inspection.id
        ? { ...i, status: 'passed' as const, disposition: 'accept' as const, completedAt: meta.at }
        : i,
    ),
  }
  assert.equal(
    send(passed, { type: 'workOrders/complete', id: wo.id }).workOrders.find((w) => w.id === wo.id)?.status,
    'completed',
  )
})

test('output cannot exceed input WIP or operation target', () => {
  const state = seedState()
  const wo = state.workOrders.find((w) => w.code === 'MO-2026-00304-50')!
  const input = state.wips.find((w) => w.moId === wo.moId && w.operationSeq === wo.operationSeq)!
  const record = {
    id: wo.id,
    goodQty: input.qty + 1,
    rejectQty: 0,
    reworkQty: 0,
    scrapQty: 0,
    reasonCodeId: null,
    note: '',
  }
  assert.equal(send(state, { type: 'workOrders/recordOutput', record }), state)
  assert.equal(
    send(state, {
      type: 'workOrders/recordOutput',
      record: { ...record, goodQty: wo.targetQty - wo.outputQty + 1 },
    }),
    state,
  )
  const valid = send(state, { type: 'workOrders/recordOutput', record: { ...record, goodQty: 10 } })
  assert.equal(valid.wips.find((w) => w.id === input.id)?.qty, input.qty - 10)
})

test('output scrap consumes input WIP once', () => {
  const state = seedState()
  const wo = state.workOrders.find((w) => w.code === 'MO-2026-00304-50')!
  const input = state.wips.find((w) => w.moId === wo.moId && w.operationSeq === wo.operationSeq)!
  const reason = state.reasonCodes.find((r) => r.kind === 'scrap')!
  const next = send(state, {
    type: 'workOrders/recordOutput',
    record: {
      id: wo.id,
      goodQty: 7,
      rejectQty: 0,
      reworkQty: 0,
      scrapQty: 3,
      reasonCodeId: reason.id,
      note: '',
    },
  })
  assert.equal(next.wips.find((w) => w.id === input.id)?.qty, input.qty - 10)
  assert.equal(next.workOrders.find((w) => w.id === wo.id)?.scrapQty, wo.scrapQty + 3)
})

test('machine and maintenance events use the machine site', () => {
  const state = seedState()
  const machine = state.machines.find(
    (m) => state.orgNodes.find((n) => n.id === m.workCenterId)?.siteId === 'site-sby',
  )!
  const down = send(state, { type: 'machines/setState', id: machine.id, state: 'down', alarm: 'test' })
  assert.equal(down.productionEvents.at(-1)?.siteId, 'site-sby')
  const requested = send(down, {
    type: 'maintenance/request',
    machineId: machine.id,
    title: 'Repair',
    alarm: 'test',
  })
  assert.equal(requested.productionEvents.at(-1)?.siteId, 'site-sby')
  const completed = send(requested, {
    type: 'maintenance/complete',
    id: requested.maintenanceRecords.at(-1)!.id,
  })
  assert.equal(completed.productionEvents.at(-1)?.siteId, 'site-sby')
})

test('cancelling an order releases its reservations and demand together', () => {
  const state = seedState()
  const order = state.marketingOrders.find((o) => o.id === 'mkt-15')!
  const items = state.marketingOrderItems.filter((i) => i.orderId === order.id)
  const demands = state.demands.filter((d) => items.some((i) => i.id === d.orderItemId))
  const before = state.fgStock
    .filter((f) => f.siteId === order.siteId && items.some((i) => i.productId === f.productId))
    .reduce((sum, f) => sum + f.allocatedQty, 0)
  const next = send(state, { type: 'marketingOrders/setStatus', id: order.id, status: 'cancelled' })
  assert.equal(next.marketingOrders.find((o) => o.id === order.id)?.status, 'cancelled')
  assert.ok(
    next.demands.filter((d) => demands.some((own) => own.id === d.id)).every((d) => d.status === 'cancelled'),
  )
  const after = next.fgStock
    .filter((f) => f.siteId === order.siteId && items.some((i) => i.productId === f.productId))
    .reduce((sum, f) => sum + f.allocatedQty, 0)
  assert.equal(
    before - after,
    demands.reduce((sum, d) => sum + d.allocatedQty, 0),
  )
})

test('cancelling one demand keeps another demand reservation on the same stock row', () => {
  const state = seedState()
  const stock = state.fgStock.find((f) => f.id === 'fgs-jkt-gb001')!
  const own = state.fgReservations!.filter((r) => r.demandId === 'mkt-12-d1')
  const other = state.fgReservations!.filter((r) => r.demandId === 'mkt-12-d3')
  assert.ok(own.length && other.length)
  const next = send(state, { type: 'demands/cancel', id: 'mkt-12-d1' })
  assert.equal(
    next.fgStock.find((f) => f.id === stock.id)?.allocatedQty,
    stock.allocatedQty - own.reduce((sum, r) => sum + r.qty, 0),
  )
  assert.deepEqual(
    next.fgReservations!.filter((r) => r.demandId === 'mkt-12-d3'),
    other,
  )
})

test('MO close waits for warehouse receipt and does not fulfill customer demand', () => {
  const state = seedState()
  const mo = state.manufacturingOrders.find((m) => m.code === 'MO-2026-00289')!
  const noReceipt = {
    ...state,
    finishedGoodsReceipts: state.finishedGoodsReceipts.filter((r) => r.moId !== mo.id),
  }
  assert.equal(send(noReceipt, { type: 'manufacturingOrders/close', id: mo.id }), noReceipt)
  const demand = state.demands.find((d) => mo.demandIds.includes(d.id))!
  const closed = send(state, { type: 'manufacturingOrders/close', id: mo.id })
  assert.equal(closed.manufacturingOrders.find((m) => m.id === mo.id)?.status, 'closed')
  assert.equal(closed.demands.find((d) => d.id === demand.id)?.status, demand.status)
})
