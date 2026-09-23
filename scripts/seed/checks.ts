// Invariant checks run before the JSON is written; any violation throws.
import type { AppState } from '../../packages/fixtures/src/store.ts'
import { FIXTURE_NOW } from '../../packages/fixtures/src/clock.ts'
import { toMs } from '../../packages/fixtures/src/dates.ts'

type Rows = readonly { id: string }[]

export function runChecks(state: AppState): void {
  const problems: string[] = []
  const fail = (msg: string) => problems.push(msg)

  const collections = Object.entries(state).filter(([, v]) => Array.isArray(v)) as [string, Rows][]
  const ids = new Map<string, Set<string>>()
  for (const [name, rows] of collections) {
    const seen = new Set<string>()
    for (const row of rows) {
      if (!row.id) fail(`${name}: row without id`)
      if (seen.has(row.id)) fail(`${name}: duplicate id ${row.id}`)
      seen.add(row.id)
    }
    ids.set(name, seen)
  }
  const has = (collection: string, id: string) => ids.get(collection)?.has(id) ?? false
  const ref = (name: string, rows: readonly object[], field: string, target: string) => {
    for (const raw of rows) {
      const row = raw as Record<string, unknown>
      const value = row[field]
      const list = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
      for (const id of list)
        if (typeof id !== 'string' || !has(target, id))
          fail(`${name}.${field} → ${target}: ${String(id)} missing (row ${String(row.id)})`)
    }
  }
  const s = state as unknown as Record<string, object[]>

  // ─── Foreign keys ─────────────────────────────────────────────
  ref('orgNodes', s.orgNodes!, 'siteId', 'sites')
  ref('orgNodes', s.orgNodes!, 'parentId', 'orgNodes')
  ref('suppliers', s.suppliers!, 'materialIds', 'materials')
  ref('uomConversions', s.uomConversions!, 'fromUomId', 'uoms')
  ref('uomConversions', s.uomConversions!, 'toUomId', 'uoms')
  ref('products', s.products!, 'categoryId', 'categories')
  ref('products', s.products!, 'uomId', 'uoms')
  ref('products', s.products!, 'currentRevisionId', 'productRevisions')
  ref('materials', s.materials!, 'categoryId', 'categories')
  ref('materials', s.materials!, 'uomId', 'uoms')
  ref('materials', s.materials!, 'supplierId', 'suppliers')
  ref('productRevisions', s.productRevisions!, 'productId', 'products')
  ref('productRevisions', s.productRevisions!, 'bomId', 'boms')
  ref('productRevisions', s.productRevisions!, 'borId', 'bors')
  ref('productRevisions', s.productRevisions!, 'bopId', 'bops')
  ref('productRevisions', s.productRevisions!, 'specIds', 'specifications')
  ref('productRevisions', s.productRevisions!, 'workInstructionIds', 'workInstructions')
  ref('productRevisions', s.productRevisions!, 'releasedBy', 'people')
  for (const bom of state.boms) {
    ref(`boms(${bom.id}).items`, bom.items, 'materialId', 'materials')
    ref(`boms(${bom.id}).items`, bom.items, 'uomId', 'uoms')
    ref(`boms(${bom.id}).items`, bom.items, 'substituteMaterialIds', 'materials')
  }
  for (const bor of state.bors) {
    ref(`bors(${bor.id}).items`, bor.items, 'workCenterId', 'orgNodes')
    ref(`bors(${bor.id}).items`, bor.items, 'machineIds', 'machines')
    ref(`bors(${bor.id}).items`, bor.items, 'toolIds', 'resources')
    ref(`bors(${bor.id}).items`, bor.items, 'moldIds', 'resources')
    ref(`bors(${bor.id}).items`, bor.items, 'fixtureIds', 'resources')
    ref(`bors(${bor.id}).items`, bor.items, 'utilityIds', 'resources')
    ref(`bors(${bor.id}).items`, bor.items, 'skillIds', 'skills')
  }
  for (const bop of state.bops) {
    ref(`bops(${bop.id}).operations`, bop.operations, 'workCenterId', 'orgNodes')
    ref(`bops(${bop.id}).operations`, bop.operations, 'workInstructionId', 'workInstructions')
  }
  ref('specifications', s.specifications!, 'productId', 'products')
  ref('workInstructions', s.workInstructions!, 'productId', 'products')
  ref('ecos', s.ecos!, 'productId', 'products')
  ref('ecos', s.ecos!, 'fromRevisionId', 'productRevisions')
  ref('ecos', s.ecos!, 'toRevisionId', 'productRevisions')
  ref('ecos', s.ecos!, 'reasonCodeId', 'reasonCodes')
  ref('ecos', s.ecos!, 'requestedBy', 'people')
  ref('machines', s.machines!, 'workCenterId', 'orgNodes')
  ref('machines', s.machines!, 'lineId', 'orgNodes')
  ref('machines', s.machines!, 'eligibleProductIds', 'products')
  ref('resources', s.resources!, 'workCenterId', 'orgNodes')
  ref('people', s.people!, 'siteIds', 'sites')
  ref('people', s.people!, 'shiftId', 'shifts')
  ref('people', s.people!, 'workCenterIds', 'orgNodes')
  for (const p of state.people)
    for (const skill of Object.keys(p.skills))
      if (!has('skills', skill)) fail(`people.skills → skills: ${skill} missing (row ${p.id})`)
  ref('calendarDays', s.calendarDays!, 'siteId', 'sites')
  ref('productionPolicies', s.productionPolicies!, 'siteId', 'sites')
  ref('inventoryLocations', s.inventoryLocations!, 'siteId', 'sites')
  ref('inventoryLocations', s.inventoryLocations!, 'orgNodeId', 'orgNodes')
  ref('inventoryPolicies', s.inventoryPolicies!, 'siteId', 'sites')
  ref('inventoryPolicies', s.inventoryPolicies!, 'productId', 'products')
  for (const r of state.lotRules)
    if (!has(r.itemKind === 'product' ? 'products' : 'materials', r.itemId))
      fail(`lotRules.itemId: ${r.itemId} missing`)
  ref('serialRules', s.serialRules!, 'productId', 'products')
  ref('marketingOrders', s.marketingOrders!, 'siteId', 'sites')
  ref('marketingOrders', s.marketingOrders!, 'customerId', 'customers')
  ref('marketingOrders', s.marketingOrders!, 'createdBy', 'people')
  ref('marketingOrderItems', s.marketingOrderItems!, 'orderId', 'marketingOrders')
  ref('marketingOrderItems', s.marketingOrderItems!, 'productId', 'products')
  ref('marketingOrderItems', s.marketingOrderItems!, 'uomId', 'uoms')
  ref('demands', s.demands!, 'siteId', 'sites')
  ref('demands', s.demands!, 'productId', 'products')
  ref('demands', s.demands!, 'orderItemId', 'marketingOrderItems')
  ref('demands', s.demands!, 'moIds', 'manufacturingOrders')
  ref('replenishments', s.replenishments!, 'siteId', 'sites')
  ref('replenishments', s.replenishments!, 'productId', 'products')
  ref('replenishments', s.replenishments!, 'demandId', 'demands')
  ref('replenishments', s.replenishments!, 'moId', 'manufacturingOrders')
  ref('manufacturingOrders', s.manufacturingOrders!, 'siteId', 'sites')
  ref('manufacturingOrders', s.manufacturingOrders!, 'productId', 'products')
  ref('manufacturingOrders', s.manufacturingOrders!, 'uomId', 'uoms')
  ref('manufacturingOrders', s.manufacturingOrders!, 'demandIds', 'demands')
  ref('manufacturingOrders', s.manufacturingOrders!, 'replenishmentId', 'replenishments')
  ref('manufacturingOrders', s.manufacturingOrders!, 'lineId', 'orgNodes')
  ref('manufacturingOrders', s.manufacturingOrders!, 'holdReasonId', 'reasonCodes')
  ref('manufacturingOrders', s.manufacturingOrders!, 'createdBy', 'people')
  for (const mo of state.manufacturingOrders) {
    if (mo.snapshot) {
      ref(`mo(${mo.code}).snapshot`, [{ id: mo.id, ...mo.snapshot }], 'productRevisionId', 'productRevisions')
      ref(`mo(${mo.code}).snapshot`, [{ id: mo.id, ...mo.snapshot }], 'bomId', 'boms')
      ref(`mo(${mo.code}).snapshot`, [{ id: mo.id, ...mo.snapshot }], 'borId', 'bors')
      ref(`mo(${mo.code}).snapshot`, [{ id: mo.id, ...mo.snapshot }], 'bopId', 'bops')
      ref(`mo(${mo.code}).snapshot`, [{ id: mo.id, ...mo.snapshot }], 'specIds', 'specifications')
      ref(
        `mo(${mo.code}).snapshot`,
        [{ id: mo.id, ...mo.snapshot }],
        'workInstructionIds',
        'workInstructions',
      )
    }
    ref(`mo(${mo.code}).events`, mo.events, 'by', 'people')
  }
  ref('workOrders', s.workOrders!, 'siteId', 'sites')
  ref('workOrders', s.workOrders!, 'moId', 'manufacturingOrders')
  ref('workOrders', s.workOrders!, 'workCenterId', 'orgNodes')
  ref('workOrders', s.workOrders!, 'machineId', 'machines')
  ref('workOrders', s.workOrders!, 'operatorIds', 'people')
  ref('workOrders', s.workOrders!, 'shiftId', 'shifts')
  ref('workOrders', s.workOrders!, 'toolIds', 'resources')
  ref('workOrders', s.workOrders!, 'moldIds', 'resources')
  ref('workOrders', s.workOrders!, 'holdReasonId', 'reasonCodes')
  ref('workOrders', s.workOrders!, 'workInstructionId', 'workInstructions')
  for (const wo of state.workOrders) ref(`wo(${wo.code}).events`, wo.events, 'by', 'people')
  ref('materialLots', s.materialLots!, 'siteId', 'sites')
  ref('materialLots', s.materialLots!, 'materialId', 'materials')
  ref('materialLots', s.materialLots!, 'supplierId', 'suppliers')
  ref('materialLots', s.materialLots!, 'uomId', 'uoms')
  ref('materialLots', s.materialLots!, 'locationId', 'inventoryLocations')
  ref('floorStock', s.floorStock!, 'siteId', 'sites')
  ref('floorStock', s.floorStock!, 'materialId', 'materials')
  ref('floorStock', s.floorStock!, 'lotId', 'materialLots')
  ref('floorStock', s.floorStock!, 'locationId', 'inventoryLocations')
  ref('floorStock', s.floorStock!, 'moId', 'manufacturingOrders')
  ref('materialRequirements', s.materialRequirements!, 'moId', 'manufacturingOrders')
  ref('materialRequirements', s.materialRequirements!, 'materialId', 'materials')
  ref('materialRequirements', s.materialRequirements!, 'uomId', 'uoms')
  ref('materialTxns', s.materialTxns!, 'siteId', 'sites')
  ref('materialTxns', s.materialTxns!, 'materialId', 'materials')
  ref('materialTxns', s.materialTxns!, 'lotId', 'materialLots')
  ref('materialTxns', s.materialTxns!, 'uomId', 'uoms')
  ref('materialTxns', s.materialTxns!, 'fromLocationId', 'inventoryLocations')
  ref('materialTxns', s.materialTxns!, 'toLocationId', 'inventoryLocations')
  ref('materialTxns', s.materialTxns!, 'moId', 'manufacturingOrders')
  ref('materialTxns', s.materialTxns!, 'woId', 'workOrders')
  ref('materialTxns', s.materialTxns!, 'by', 'people')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'siteId', 'sites')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'moId', 'manufacturingOrders')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'productId', 'products')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'uomId', 'uoms')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'locationId', 'inventoryLocations')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'serialIds', 'serials')
  ref('finishedGoodsReceipts', s.finishedGoodsReceipts!, 'by', 'people')
  ref('fgStock', s.fgStock!, 'siteId', 'sites')
  ref('fgStock', s.fgStock!, 'productId', 'products')
  ref('fgStock', s.fgStock!, 'locationId', 'inventoryLocations')
  ref('serials', s.serials!, 'productId', 'products')
  ref('serials', s.serials!, 'moId', 'manufacturingOrders')
  ref('serials', s.serials!, 'wipId', 'wips')
  ref('serials', s.serials!, 'receiptId', 'finishedGoodsReceipts')
  ref('serials', s.serials!, 'customerId', 'customers')
  ref('wips', s.wips!, 'siteId', 'sites')
  ref('wips', s.wips!, 'moId', 'manufacturingOrders')
  ref('wips', s.wips!, 'woId', 'workOrders')
  ref('wips', s.wips!, 'productId', 'products')
  ref('wips', s.wips!, 'locationId', 'inventoryLocations')
  ref('wips', s.wips!, 'parentIds', 'wips')
  ref('wips', s.wips!, 'lotIds', 'materialLots')
  ref('wips', s.wips!, 'machineId', 'machines')
  ref('inspectionPlans', s.inspectionPlans!, 'productId', 'products')
  ref('inspectionPlans', s.inspectionPlans!, 'specId', 'specifications')
  ref('inspections', s.inspections!, 'siteId', 'sites')
  ref('inspections', s.inspections!, 'planId', 'inspectionPlans')
  ref('inspections', s.inspections!, 'productId', 'products')
  ref('inspections', s.inspections!, 'moId', 'manufacturingOrders')
  ref('inspections', s.inspections!, 'woId', 'workOrders')
  ref('inspections', s.inspections!, 'wipId', 'wips')
  ref('inspections', s.inspections!, 'lotId', 'materialLots')
  ref('inspections', s.inspections!, 'inspectorId', 'people')
  ref('inspections', s.inspections!, 'defectRecordIds', 'defectRecords')
  const characteristicIds = new Set(state.specifications.flatMap((sp) => sp.characteristics.map((c) => c.id)))
  for (const i of state.inspections)
    for (const m of i.measurements)
      if (!characteristicIds.has(m.characteristicId))
        fail(`inspections.measurements.characteristicId: ${m.characteristicId} missing (row ${i.id})`)
  ref('defectRecords', s.defectRecords!, 'siteId', 'sites')
  ref('defectRecords', s.defectRecords!, 'defectCodeId', 'defectCodes')
  ref('defectRecords', s.defectRecords!, 'inspectionId', 'inspections')
  ref('defectRecords', s.defectRecords!, 'moId', 'manufacturingOrders')
  ref('defectRecords', s.defectRecords!, 'woId', 'workOrders')
  ref('defectRecords', s.defectRecords!, 'wipId', 'wips')
  ref('defectRecords', s.defectRecords!, 'by', 'people')
  ref('qualityHolds', s.qualityHolds!, 'siteId', 'sites')
  ref('qualityHolds', s.qualityHolds!, 'moId', 'manufacturingOrders')
  ref('qualityHolds', s.qualityHolds!, 'reasonCodeId', 'reasonCodes')
  ref('qualityHolds', s.qualityHolds!, 'heldBy', 'people')
  ref('qualityHolds', s.qualityHolds!, 'releasedBy', 'people')
  for (const h of state.qualityHolds) {
    const target =
      h.target === 'wip'
        ? 'wips'
        : h.target === 'lot'
          ? 'materialLots'
          : h.target === 'mo'
            ? 'manufacturingOrders'
            : 'workOrders'
    if (!has(target, h.targetId))
      fail(`qualityHolds.targetId → ${target}: ${h.targetId} missing (row ${h.id})`)
  }
  ref('scrapRecords', s.scrapRecords!, 'siteId', 'sites')
  ref('scrapRecords', s.scrapRecords!, 'moId', 'manufacturingOrders')
  ref('scrapRecords', s.scrapRecords!, 'woId', 'workOrders')
  ref('scrapRecords', s.scrapRecords!, 'wipId', 'wips')
  ref('scrapRecords', s.scrapRecords!, 'reasonCodeId', 'reasonCodes')
  ref('scrapRecords', s.scrapRecords!, 'operatorId', 'people')
  ref('reworkOrders', s.reworkOrders!, 'siteId', 'sites')
  ref('reworkOrders', s.reworkOrders!, 'moId', 'manufacturingOrders')
  ref('reworkOrders', s.reworkOrders!, 'sourceWoId', 'workOrders')
  ref('reworkOrders', s.reworkOrders!, 'sourceWipId', 'wips')
  ref('reworkOrders', s.reworkOrders!, 'reworkWipId', 'wips')
  ref('reworkOrders', s.reworkOrders!, 'inspectionId', 'inspections')
  ref('reworkOrders', s.reworkOrders!, 'reasonCodeId', 'reasonCodes')
  ref('ncrs', s.ncrs!, 'siteId', 'sites')
  ref('ncrs', s.ncrs!, 'defectCodeId', 'defectCodes')
  ref('ncrs', s.ncrs!, 'moId', 'manufacturingOrders')
  ref('ncrs', s.ncrs!, 'woId', 'workOrders')
  ref('ncrs', s.ncrs!, 'lotId', 'materialLots')
  ref('ncrs', s.ncrs!, 'wipId', 'wips')
  ref('ncrs', s.ncrs!, 'raisedBy', 'people')
  ref('productionEvents', s.productionEvents!, 'siteId', 'sites')
  ref('productionEvents', s.productionEvents!, 'moId', 'manufacturingOrders')
  ref('productionEvents', s.productionEvents!, 'woId', 'workOrders')
  ref('productionEvents', s.productionEvents!, 'wipId', 'wips')
  ref('productionEvents', s.productionEvents!, 'lotId', 'materialLots')
  ref('productionEvents', s.productionEvents!, 'machineId', 'machines')
  ref('oeeSnapshots', s.oeeSnapshots!, 'machineId', 'machines')
  ref('oeeSnapshots', s.oeeSnapshots!, 'shiftId', 'shifts')
  ref('oeeSnapshots', s.oeeSnapshots!, 'moId', 'manufacturingOrders')
  ref('oeeSnapshots', s.oeeSnapshots!, 'woId', 'workOrders')
  ref('oeeSnapshots', s.oeeSnapshots!, 'productId', 'products')
  ref('oeeSnapshots', s.oeeSnapshots!, 'operatorId', 'people')
  ref('telemetry', s.telemetry!, 'machineId', 'machines')
  ref('telemetry', s.telemetry!, 'moId', 'manufacturingOrders')
  ref('telemetry', s.telemetry!, 'woId', 'workOrders')
  ref('maintenanceRecords', s.maintenanceRecords!, 'machineId', 'machines')
  ref('maintenanceRecords', s.maintenanceRecords!, 'impactedWoIds', 'workOrders')
  for (const m of state.integrationMappings) {
    const target =
      m.entityKind === 'machine'
        ? 'machines'
        : m.entityKind === 'product'
          ? 'products'
          : m.entityKind === 'material'
            ? 'materials'
            : m.entityKind === 'customer'
              ? 'customers'
              : m.entityKind === 'supplier'
                ? 'suppliers'
                : m.entityKind === 'operator'
                  ? 'people'
                  : 'inventoryLocations'
    if (!has(target, m.internalId))
      fail(`integrationMappings.internalId → ${target}: ${m.internalId} missing (row ${m.id})`)
  }

  // ─── Domain invariants ────────────────────────────────────────
  const machineById = new Map(state.machines.map((m) => [m.id, m]))
  const peopleById = new Map(state.people.map((p) => [p.id, p]))
  const moById = new Map(state.manufacturingOrders.map((m) => [m.id, m]))
  const bopById = new Map(state.bops.map((b) => [b.id, b]))
  const orgById = new Map(state.orgNodes.map((n) => [n.id, n]))
  for (const wo of state.workOrders) {
    const mo = moById.get(wo.moId)!
    if (wo.code !== `${mo.code}-${wo.operationSeq}`)
      fail(`wo ${wo.id}: code ${wo.code} does not match ${mo.code}-${wo.operationSeq}`)
    if (wo.machineId) {
      const machine = machineById.get(wo.machineId)!
      if (machine.workCenterId !== wo.workCenterId)
        fail(
          `wo ${wo.code}: machine ${machine.code} belongs to ${machine.workCenterId}, not ${wo.workCenterId}`,
        )
    }
    for (const op of wo.operatorIds) {
      const p = peopleById.get(op)!
      if (p.role !== 'operator' || !p.siteIds.includes(wo.siteId))
        fail(`wo ${wo.code}: ${p.id} is not an operator at ${wo.siteId}`)
    }
    if (orgById.get(wo.workCenterId)!.siteId !== wo.siteId) fail(`wo ${wo.code}: work center on another site`)
  }
  for (const mo of state.manufacturingOrders) {
    const wos = state.workOrders
      .filter((w) => w.moId === mo.id)
      .sort((a, b) => a.operationSeq - b.operationSeq)
    const releasedPlus = ['released', 'in_progress', 'completed', 'closed', 'on_hold'].includes(mo.status)
    if (releasedPlus) {
      if (!mo.snapshot) fail(`mo ${mo.code}: released without snapshot`)
      const bop = bopById.get(mo.snapshot?.bopId ?? '')
      const expected = bop?.operations.map((o) => o.seq).sort((a, b) => a - b) ?? []
      const actual = wos.map((w) => w.operationSeq)
      if (expected.join(',') !== actual.join(','))
        fail(
          `mo ${mo.code}: work orders ${actual.join(',')} do not match BOP operations ${expected.join(',')}`,
        )
      if (mo.validations.length === 0) fail(`mo ${mo.code}: no validations`)
    } else {
      if (wos.length) fail(`mo ${mo.code}: ${mo.status} order has work orders`)
      if (mo.snapshot) fail(`mo ${mo.code}: ${mo.status} order has a snapshot`)
    }
    const last = wos.at(-1)
    const expectedGood = last?.status === 'completed' ? last.goodQty : 0
    if (mo.goodQty !== expectedGood)
      fail(`mo ${mo.code}: goodQty ${mo.goodQty} ≠ last operation good ${expectedGood}`)
    const sumOf = (k: 'rejectQty' | 'reworkQty' | 'scrapQty') => wos.reduce((s, w) => s + w[k], 0)
    if (
      mo.rejectQty !== sumOf('rejectQty') ||
      mo.reworkQty !== sumOf('reworkQty') ||
      mo.scrapQty !== sumOf('scrapQty')
    )
      fail(`mo ${mo.code}: reject/rework/scrap totals differ from work orders`)
    if (toMs(mo.plannedEnd) <= toMs(mo.plannedStart)) fail(`mo ${mo.code}: planned window empty`)
    if (
      mo.status === 'in_progress' &&
      !wos.some((w) => ['in_progress', 'paused', 'ready', 'assigned'].includes(w.status))
    )
      fail(`mo ${mo.code}: in progress without an active work order`)
  }
  for (const [name, rows] of collections) {
    const idPattern: Record<string, RegExp> = {
      manufacturingOrders: /^mo-\d{5}$/,
      workOrders: /^wo-\d{5}-\d{2}$/,
      wips: /^wip-/,
      materialLots: /^lot-\d{5}$/,
      people: /^per-/,
      machines: /^MACHINE-\d{5}$/,
    }
    const pattern = idPattern[name]
    if (pattern)
      for (const row of rows)
        if (!pattern.test(row.id)) fail(`${name}: id ${row.id} does not match ${pattern}`)
  }

  // ─── Timestamps ───────────────────────────────────────────────
  const now = toMs(FIXTURE_NOW)
  const future = new Set(['plannedStart', 'plannedEnd', 'requiredDate', 'expiresAt', 'effectiveUntil'])
  const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/
  const walk = (value: unknown, path: string, allowFuture: boolean) => {
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        if (!isoRe.test(value)) fail(`${path}: timestamp ${value} is not ISO with +07:00`)
        else if (!allowFuture && toMs(value) > now) fail(`${path}: ${value} is after FIXTURE_NOW`)
      }
      return
    }
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, allowFuture))
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, allowFuture || future.has(k))
  }
  for (const [name, rows] of collections) walk(rows, name, false)

  // ─── Numbering ────────────────────────────────────────────────
  const maxSeq = (codes: string[], prefix: string) =>
    Math.max(0, ...codes.filter((c) => c.startsWith(prefix)).map((c) => Number(c.slice(prefix.length))))
  const codesFor: Record<string, string[]> = {
    mo: state.manufacturingOrders.map((m) => m.code),
    demand: state.demands.map((d) => d.code),
    replenishment: state.replenishments.map((r) => r.code),
    lot: state.materialLots.map((l) => l.code),
    fgReceipt: state.finishedGoodsReceipts.map((r) => r.code),
    hold: state.qualityHolds.map((h) => h.code),
    inspection: state.inspections.map((i) => i.code),
    rework: state.reworkOrders.map((r) => r.code),
    maintenance: state.maintenanceRecords.map((m) => m.code),
    marketingOrder: state.marketingOrders.map((o) => o.code),
    eco: state.ecos.map((e) => e.code),
    ncr: state.ncrs.map((n) => n.code),
  }
  for (const n of state.numbering) {
    const codes = codesFor[n.entity]
    if (!codes) continue
    const max = maxSeq(codes, n.prefix)
    if (n.next <= max) fail(`numbering ${n.entity}: next ${n.next} not greater than seeded max ${max}`)
  }

  if (problems.length)
    throw new Error(
      `${problems.length} invariant violation(s):\n${problems.slice(0, 40).join('\n')}${problems.length > 40 ? `\n… ${problems.length - 40} more` : ''}`,
    )
}
