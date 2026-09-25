import assert from 'node:assert/strict'
import test from 'node:test'
import { reduce, seedState, workCenterForSite, type AppAction, type AppState } from '../src/index'

const meta = { by: 'test-user', at: '2026-09-23T10:00:00+07:00' }
const send = (state: AppState, action: AppAction) => reduce(state, { action, meta })

test('releasing a Surabaya order resolves work centers at site-sby', () => {
  const state = seedState()
  const mo = state.manufacturingOrders.find(
    (m) => m.siteId === 'site-sby' && (m.status === 'planned' || m.status === 'draft'),
  )!
  const next = send(state, { type: 'manufacturingOrders/release', id: mo.id })
  const wos = next.workOrders.filter((w) => w.moId === mo.id)
  const bop = next.bops.find(
    (b) => b.id === next.manufacturingOrders.find((m) => m.id === mo.id)!.snapshot!.bopId,
  )!
  assert.equal(wos.length, bop.operations.length)
  for (const wo of wos) {
    const node = next.orgNodes.find((n) => n.id === wo.workCenterId)!
    assert.equal(node.siteId, 'site-sby')
    const op = bop.operations.find((o) => o.seq === wo.operationSeq)!
    assert.equal(node.code, op.workCenterCode)
  }
})

test('validation flags a routing code the site does not have', () => {
  const state = seedState()
  const mo = state.manufacturingOrders.find((m) => m.siteId === 'site-sby' && m.status === 'planned')!
  const missing: AppState = {
    ...state,
    orgNodes: state.orgNodes.filter(
      (n) => n.id !== workCenterForSite(state.orgNodes, 'site-sby', 'WC-CAST')!.id,
    ),
  }
  const next = send(missing, { type: 'manufacturingOrders/release', id: mo.id })
  const released = next.manufacturingOrders.find((m) => m.id === mo.id)!
  assert.equal(released.status, 'planned')
  assert.equal(released.validations.find((v) => v.check === 'work_center')?.ok, false)
})

test('a lot hold without an order releases cleanly', () => {
  const state = seedState()
  assert.equal(state.qualityHolds.find((h) => h.code === 'QH-00063')?.moId, null)
  const lot = state.materialLots.find((l) => l.status === 'available')!
  const held = send(state, {
    type: 'qualityHolds/upsert',
    item: {
      id: 'qh-test',
      code: 'QH-99999',
      siteId: lot.siteId,
      target: 'lot',
      targetId: lot.id,
      moId: null,
      reasonCodeId: state.reasonCodes.find((r) => r.kind === 'hold')!.id,
      note: 'Incoming inspection',
      status: 'active',
      heldBy: meta.by,
      heldAt: meta.at,
      releasedBy: null,
      releasedAt: null,
      disposition: null,
    },
  })
  const next = send(held, { type: 'qualityHolds/release', id: 'qh-test', disposition: 'return' })
  const hold = next.qualityHolds.find((h) => h.id === 'qh-test')!
  assert.equal(hold.status, 'released')
  assert.equal(hold.disposition, 'return')
  assert.equal(next.materialLots.find((l) => l.id === lot.id)?.status, 'returned')
  assert.equal(next.productionEvents.at(-1)?.moId, null)
})

test('delivering the last line stamps deliveredAt and closing stamps closedAt', () => {
  const state = seedState()
  let delivered: AppState | null = null
  let orderId = ''
  for (const order of state.marketingOrders.filter((o) => o.status === 'ready')) {
    let next = state
    let ok = true
    for (const item of state.marketingOrderItems.filter((i) => i.orderId === order.id)) {
      const after = send(next, {
        type: 'marketingOrderItems/deliver',
        id: item.id,
        qty: item.qty - item.deliveredQty,
      })
      if (after === next) ok = false
      next = after
    }
    if (ok) {
      delivered = next
      orderId = order.id
      break
    }
  }
  assert.ok(delivered, 'a ready order can be delivered in full')
  const order = delivered.marketingOrders.find((o) => o.id === orderId)!
  assert.equal(order.status, 'delivered')
  assert.equal(order.deliveredAt, meta.at)
  assert.equal(order.closedAt, null)
  const closed = send(delivered, { type: 'marketingOrders/setStatus', id: orderId, status: 'closed' })
  assert.equal(closed.marketingOrders.find((o) => o.id === orderId)?.closedAt, meta.at)
})

test('removing a work center cascades to machines, people, resources and lines', () => {
  const state = seedState()
  const wc = workCenterForSite(state.orgNodes, 'site-sby', 'WC-CAST')!
  const machineIds = state.machines.filter((m) => m.workCenterId === wc.id).map((m) => m.id)
  assert.ok(machineIds.length > 0)
  const next = send(state, { type: 'orgNodes/remove', id: wc.id })
  assert.ok(!next.orgNodes.some((n) => n.id === wc.id))
  assert.ok(!next.machines.some((m) => machineIds.includes(m.id)))
  assert.ok(next.resources.every((r) => r.workCenterId !== wc.id))
  assert.ok(next.people.every((p) => !p.workCenterIds.includes(wc.id)))
  assert.ok(next.telemetry.every((t) => !machineIds.includes(t.machineId)))
  assert.ok(
    next.workOrders.every(
      (w) => w.status === 'completed' || !w.machineId || !machineIds.includes(w.machineId),
    ),
  )
  const line = state.orgNodes.find((n) => n.siteId === 'site-sby' && n.kind === 'line')!
  const lineGone = send(state, { type: 'orgNodes/remove', id: line.id })
  assert.ok(lineGone.manufacturingOrders.every((m) => m.lineId !== line.id))
  assert.ok(lineGone.orgNodes.every((n) => n.parentId !== line.id))
})

test('removing a product takes its engineering data and policies along', () => {
  const state = seedState()
  const product = state.products.find((p) => state.inventoryPolicies.some((x) => x.productId === p.id))!
  const next = send(state, { type: 'products/remove', id: product.id })
  assert.ok(!next.products.some((p) => p.id === product.id))
  for (const key of [
    'productRevisions',
    'boms',
    'bors',
    'bops',
    'specifications',
    'workInstructions',
    'inspectionPlans',
    'inventoryPolicies',
    'serialRules',
    'fgStock',
  ] as const)
    assert.ok(
      next[key].every((row) => row.productId !== product.id),
      `${key} still references the product`,
    )
  assert.ok(next.lotRules.every((r) => !(r.itemKind === 'product' && r.itemId === product.id)))
})

test('removing a machine clears assignments and integration rows', () => {
  const state = seedState()
  const machine = state.machines.find((m) =>
    state.workOrders.some((w) => w.machineId === m.id && w.status !== 'completed'),
  )!
  const completed = state.workOrders.filter((w) => w.machineId === machine.id && w.status === 'completed')
  const next = send(state, { type: 'machines/remove', id: machine.id })
  assert.ok(!next.machines.some((m) => m.id === machine.id))
  assert.ok(next.workOrders.every((w) => w.status === 'completed' || w.machineId !== machine.id))
  assert.equal(
    next.workOrders.filter((w) => w.machineId === machine.id && w.status === 'completed').length,
    completed.length,
  )
  assert.ok(next.telemetry.every((t) => t.machineId !== machine.id))
  assert.ok(next.oeeSnapshots.every((o) => o.machineId !== machine.id))
  assert.ok(next.maintenanceRecords.every((r) => r.machineId !== machine.id))
  assert.ok(
    next.integrationMappings.every((m) => !(m.entityKind === 'machine' && m.internalId === machine.id)),
  )
  assert.ok(next.bors.every((b) => b.items.every((i) => !i.machineIds.includes(machine.id))))
})

test('removing a marketing order drops its lines and demands and frees stock', () => {
  const state = seedState()
  const order = state.marketingOrders.find((o) => o.id === 'mkt-15')!
  const items = state.marketingOrderItems.filter((i) => i.orderId === order.id)
  const demands = state.demands.filter((d) => items.some((i) => i.id === d.orderItemId))
  const reserved = state
    .fgReservations!.filter((r) => demands.some((d) => d.id === r.demandId))
    .reduce((sum, r) => sum + r.qty, 0)
  assert.ok(reserved > 0)
  const before = state.fgStock.reduce((sum, f) => sum + f.allocatedQty, 0)
  const next = send(state, { type: 'marketingOrders/remove', id: order.id })
  assert.ok(!next.marketingOrders.some((o) => o.id === order.id))
  assert.ok(!next.marketingOrderItems.some((i) => i.orderId === order.id))
  assert.ok(!next.demands.some((d) => demands.some((own) => own.id === d.id)))
  assert.ok(
    next.manufacturingOrders.every((m) => !m.demandIds.some((id) => demands.some((d) => d.id === id))),
  )
  assert.equal(before - next.fgStock.reduce((sum, f) => sum + f.allocatedQty, 0), reserved)
  assert.ok(next.fgReservations!.every((r) => !demands.some((d) => d.id === r.demandId)))
})
