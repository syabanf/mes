// Manufacturing inventory: material lots and their journey into work orders, WIP batches and finished goods.
import type {
  ConsumptionMode,
  FgStock,
  FinishedGoodsReceipt,
  FloorStock,
  LotStatus,
  MaterialLot,
  MaterialRequirement,
  MaterialTxn,
  MaterialTxnKind,
  Serial,
  Wip,
} from '../../packages/types/src/index.ts'
import { shiftAt } from '../../packages/fixtures/src/derive.ts'
import {
  DAY,
  HOUR,
  MINUTE,
  NOW,
  SITES,
  SITE_JKT,
  SITE_SBY,
  clampPast,
  dayAt,
  iso,
  locId,
  logEvent,
  pad,
  sortByAt,
} from './common.ts'
import {
  FG_ONHAND,
  allocatedStock,
  demands,
  marketingOrders,
  settleBlueprintReplenishment,
} from './demand.ts'
import { lineBufferFor, lotRules, materials, productId, productSpec, serialRules } from './master.ts'
import { operatorsFor, shifts, supervisorFor, warehouseFor } from './people.ts'
import { OPERATIONS, boms } from './plm.ts'
import { builtMos, moSeq, releasedMos, type BuiltMo } from './production.ts'
import { rng } from './rng.ts'

const requiredQty = (qtyPerUnit: number, qty: number, scrap: number) =>
  Math.ceil(qtyPerUnit * qty * (1 + scrap) * 1000) / 1000
const materialCode = (id: string) => materials.find((m) => m.id === id)!.code
const uomOf = (id: string) => materials.find((m) => m.id === id)!.uomId
const bomItemsOf = (b: BuiltMo) => boms.find((x) => x.id === b.mo.snapshot!.bomId)!.items
const fraction = (b: BuiltMo, seq: number) => {
  const wo = b.wos.find((w) => w.operationSeq === seq)!
  if (wo.status === 'completed') return 1
  return wo.actualStart ? (b.inputs[seq] ? b.processed[seq]! / b.inputs[seq]! : 0) : 0
}

// ─── Lots ───────────────────────────────────────────────────────

export const materialLots: MaterialLot[] = []
const lotDrafts: { lot: MaterialLot; at: number }[] = []
/** Gold or silver lot dedicated to a manufacturing order. */
export const metalLotOf = new Map<string, MaterialLot>()

function addLot(
  siteId: string,
  materialId: string,
  supplierId: string,
  qty: number,
  locationId: string,
  status: LotStatus,
  receivedAt: number,
): MaterialLot {
  const rule = lotRules.find((r) => r.itemId === materialId)
  const lot: MaterialLot = {
    id: '',
    code: '',
    siteId,
    materialId,
    supplierId,
    qty: Math.round(qty * 1000) / 1000,
    uomId: uomOf(materialId),
    locationId,
    status,
    receivedAt: iso(receivedAt),
    expiresAt: rule?.expiryDays ? iso(receivedAt + rule.expiryDays * DAY) : null,
  }
  lotDrafts.push({ lot, at: receivedAt })
  return lot
}

const metalSupplier = (materialId: string) =>
  materialId === 'mat-ag999' ? 'sup-argentum' : rng.chance(0.7) ? 'sup-emas' : 'sup-bullion'

for (const b of releasedMos) {
  const key = productSpec(b.mo.productId).key
  const bom = bomItemsOf(b)
  const metal = bom.find(
    (i) => i.consumeAtSeq === 10 && (i.materialId === 'mat-au9999' || i.materialId === 'mat-ag999'),
  )!
  const required = requiredQty(metal.qtyPerUnit, b.mo.qty, metal.scrapFactor)
  if (b.materialState === 'shortage') continue
  const consumed = Math.round(required * fraction(b, 10) * 1000) / 1000
  const original = b.materialState === 'partial' ? Math.round(required * 0.6) : required
  const remaining = Math.max(0, original - consumed)
  const status: LotStatus =
    b.materialState === 'partial' ? 'reserved' : remaining <= 0 ? 'consumed' : 'staged'
  const location =
    b.materialState === 'partial' ? locId(b.mo.siteId, 'wh01') : lineBufferFor(b.mo.siteId, key)
  const receivedAt = clampPast(
    Math.min(b.releasedAt!, b.plan.plannedStart) - rng.int(2, 6) * DAY - rng.int(0, 8) * HOUR,
  )
  metalLotOf.set(
    b.mo.id,
    addLot(
      b.mo.siteId,
      metal.materialId,
      metalSupplier(metal.materialId),
      remaining,
      location,
      status,
      receivedAt,
    ),
  )
}

for (let i = 0; i < 10; i++)
  addLot(
    SITE_JKT,
    'mat-au9999',
    metalSupplier('mat-au9999'),
    rng.step(1000, 25000, 500),
    locId(SITE_JKT, 'wh01'),
    'available',
    dayAt(-rng.int(1, 40), rng.int(8, 15)),
  )
for (let i = 0; i < 4; i++)
  addLot(
    SITE_SBY,
    'mat-au9999',
    'sup-bullion',
    rng.step(1000, 10000, 500),
    locId(SITE_SBY, 'wh01'),
    'available',
    dayAt(-rng.int(1, 40), rng.int(8, 15)),
  )
for (let i = 0; i < 3; i++)
  addLot(
    SITE_JKT,
    'mat-ag999',
    'sup-argentum',
    rng.step(5000, 40000, 1000),
    locId(SITE_JKT, 'wh01'),
    'available',
    dayAt(-rng.int(1, 40), rng.int(8, 15)),
  )

const SHARED_QTY: Record<string, number> = {
  'mat-flux': 25000,
  'mat-liner': 40,
  'mat-polcmp': 60000,
  'mat-blister-s': 80000,
  'mat-blister-m': 12000,
  'mat-blister-l': 6000,
  'mat-holo': 90000,
  'mat-cert': 90000,
  'mat-box': 9000,
  'mat-argon': 400,
  'mat-solvent': 60000,
  'mat-carton': 3000,
}
/** Warehouse lot a material is drawn from at a site. */
const sharedLot = new Map<string, MaterialLot>()
for (const siteId of SITES) {
  for (const [materialId, qty] of Object.entries(SHARED_QTY)) {
    const f = siteId === SITE_JKT ? 1 : 0.3
    const lot = addLot(
      siteId,
      materialId,
      materials.find((m) => m.id === materialId)!.supplierId!,
      Math.round(qty * f * rng.float(0.5, 1)),
      locId(siteId, 'wh01'),
      'available',
      dayAt(-rng.int(3, 45), rng.int(8, 15)),
    )
    sharedLot.set(`${siteId}|${materialId}`, lot)
  }
}
addLot(
  SITE_JKT,
  'mat-blister-s',
  'sup-kemasan',
  45000,
  locId(SITE_JKT, 'wh01'),
  'available',
  dayAt(-2, 10, 20),
)
addLot(SITE_JKT, 'mat-holo', 'sup-secureprint', 60000, locId(SITE_JKT, 'wh01'), 'available', dayAt(-1, 14, 5))
/** Flux lot that failed incoming inspection and went back to the supplier. */
export const returnedLot = addLot(
  SITE_JKT,
  'mat-flux',
  'sup-kimia',
  5000,
  locId(SITE_JKT, 'ret01'),
  'returned',
  dayAt(-12, 9, 30),
)

lotDrafts.sort((a, b) => a.at - b.at)
lotDrafts.forEach(({ lot }, i) => {
  lot.id = `lot-${pad(100 + i)}`
  lot.code = `LOT-${pad(100 + i)}`
  materialLots.push(lot)
})
export const LAST_LOT_SEQ = 100 + lotDrafts.length - 1

// ─── Transactions ───────────────────────────────────────────────

export const materialTxns: MaterialTxn[] = []
const txn = (
  siteId: string,
  kind: MaterialTxnKind,
  materialId: string,
  lot: MaterialLot | null,
  qty: number,
  from: string | null,
  to: string | null,
  moId: string | null,
  woId: string | null,
  seq: number | null,
  mode: ConsumptionMode,
  at: number,
  by: string,
  note: string,
) =>
  materialTxns.push({
    id: '',
    siteId,
    kind,
    materialId,
    lotId: lot?.id ?? null,
    qty: Math.round(qty * 1000) / 1000,
    uomId: uomOf(materialId),
    fromLocationId: from,
    toLocationId: to,
    moId,
    woId,
    operationSeq: seq,
    mode,
    at: iso(clampPast(at)),
    by,
    note,
  })

for (const lot of materialLots)
  txn(
    lot.siteId,
    'receipt',
    lot.materialId,
    lot,
    lot.status === 'consumed' ? metalOriginal(lot) : lot.qty,
    null,
    locId(lot.siteId, 'wh01'),
    null,
    null,
    null,
    'manual',
    Date.parse(lot.receivedAt),
    warehouseFor(lot.siteId),
    `Received from ${lot.supplierId}`,
  )

function metalOriginal(lot: MaterialLot): number {
  for (const [moId, l] of metalLotOf)
    if (l === lot) {
      const b = builtMos.find((x) => x.mo.id === moId)!
      const metal = bomItemsOf(b).find(
        (i) => i.consumeAtSeq === 10 && (i.materialId === 'mat-au9999' || i.materialId === 'mat-ag999'),
      )!
      return requiredQty(metal.qtyPerUnit, b.mo.qty, metal.scrapFactor)
    }
  return lot.qty
}

// ─── Requirements, floor stock and consumption ──────────────────

export const materialRequirements: MaterialRequirement[] = []
export const floorStock: FloorStock[] = []

for (const b of releasedMos) {
  const { mo } = b
  const key = productSpec(mo.productId).key
  const old = Date.parse(mo.createdAt) < NOW - 10 * DAY
  const warehouse = warehouseFor(mo.siteId)
  const buffer = lineBufferFor(mo.siteId, key)
  const floor = locId(mo.siteId, 'fl01')
  bomItemsOf(b).forEach((item, n) => {
    const required = requiredQty(item.qtyPerUnit, mo.qty, item.scrapFactor)
    const wo = b.wos.find((w) => w.operationSeq === item.consumeAtSeq)!
    const isMetal =
      item.consumeAtSeq === 10 && (item.materialId === 'mat-au9999' || item.materialId === 'mat-ag999')
    const lot = isMetal
      ? (metalLotOf.get(mo.id) ?? null)
      : (sharedLot.get(`${mo.siteId}|${item.materialId}`) ?? null)
    const f = fraction(b, item.consumeAtSeq)
    const consumed = wo.status === 'completed' ? required : Math.round(required * f * 1000) / 1000
    let reserved = 0
    let staged = 0
    let issued = 0
    if (wo.status !== 'completed') {
      if (wo.actualStart) issued = Math.round((required - consumed) * 1000) / 1000
      else if (isMetal) staged = required
      else reserved = required
    }
    if (b.materialState === 'partial' && isMetal) {
      staged = 0
      reserved = Math.round(required * 0.6)
    }
    if (b.materialState === 'shortage' && (isMetal || item.materialId === 'mat-holo')) {
      staged = 0
      reserved = 0
    }
    if (b.plan.script?.machine === 'QC-01' && item.materialId.startsWith('mat-blister'))
      reserved = Math.round(required * 0.6)
    const covered = reserved + staged + issued + consumed
    const status: MaterialRequirement['status'] =
      consumed >= required ? 'consumed' : covered >= required ? 'ready' : covered > 0 ? 'partial' : 'shortage'
    materialRequirements.push({
      id: `mrq-${moSeq(b)}-${n + 1}`,
      moId: mo.id,
      materialId: item.materialId,
      operationSeq: item.consumeAtSeq,
      requiredQty: required,
      uomId: item.uomId,
      reservedQty: reserved,
      stagedQty: staged,
      issuedQty: issued,
      consumedQty: consumed,
      returnedQty: 0,
      status,
    })

    const releasedAt = b.releasedAt!
    const startAt = wo.actualStart ? Date.parse(wo.actualStart) : null
    const endAt = wo.actualEnd ? Date.parse(wo.actualEnd) : null
    const shiftId = shiftAt(shifts, startAt ?? releasedAt)?.id ?? null
    const operator =
      wo.operatorIds[0] ??
      operatorsFor(mo.siteId, OPERATIONS.find((o) => o.seq === item.consumeAtSeq)!.wc, shiftId)[0]?.id ??
      supervisorFor(mo.siteId, shiftId)
    if (isMetal && lot && status !== 'shortage') {
      const reservedAt = clampPast(releasedAt + 5 * MINUTE)
      txn(
        mo.siteId,
        'reserve',
        item.materialId,
        lot,
        b.materialState === 'partial' ? reserved : required,
        locId(mo.siteId, 'wh01'),
        locId(mo.siteId, 'wh01'),
        mo.id,
        null,
        10,
        'manual',
        reservedAt,
        warehouse,
        '',
      )
      if (!old)
        logEvent(
          mo.siteId,
          'material.reserved',
          reservedAt,
          warehouse,
          `${mo.code}: ${b.materialState === 'partial' ? reserved : required} ${materialCode(item.materialId)} reserved (lot ${lot.code})`,
          { moId: mo.id, lotId: lot.id },
        )
      if (b.materialState !== 'partial') {
        const stagedAt = clampPast(releasedAt + rng.int(30, 90) * MINUTE)
        txn(
          mo.siteId,
          'stage',
          item.materialId,
          lot,
          required,
          locId(mo.siteId, 'wh01'),
          buffer,
          mo.id,
          null,
          10,
          'manual',
          stagedAt,
          warehouse,
          '',
        )
        if (!old)
          logEvent(
            mo.siteId,
            'material.staged',
            stagedAt,
            warehouse,
            `${mo.code}: ${required} ${materialCode(item.materialId)} staged at line buffer (lot ${lot.code})`,
            { moId: mo.id, lotId: lot.id },
          )
      }
      if (startAt !== null) {
        txn(
          mo.siteId,
          'issue',
          item.materialId,
          lot,
          required,
          buffer,
          floor,
          mo.id,
          wo.id,
          10,
          'scan',
          startAt - 10 * MINUTE,
          supervisorFor(mo.siteId, shiftId),
          '',
        )
        if (!old)
          logEvent(
            mo.siteId,
            'material.issued',
            startAt - 10 * MINUTE,
            supervisorFor(mo.siteId, shiftId),
            `${mo.code}: ${required} ${materialCode(item.materialId)} issued to ${wo.code}`,
            { moId: mo.id, woId: wo.id, lotId: lot.id },
          )
      }
      if (consumed > 0) {
        const at = endAt ?? NOW - rng.int(5, 60) * MINUTE
        txn(
          mo.siteId,
          'consume',
          item.materialId,
          lot,
          consumed,
          floor,
          null,
          mo.id,
          wo.id,
          10,
          'scan',
          at,
          operator,
          '',
        )
        logEvent(
          mo.siteId,
          'material.consumed',
          at,
          operator,
          `${mo.code}: ${consumed} ${materialCode(item.materialId)} consumed at ${wo.code} (lot ${lot.code})`,
          { moId: mo.id, woId: wo.id, lotId: lot.id },
        )
      }
    } else if (lot) {
      if (reserved > 0 && mo.status === 'released')
        txn(
          mo.siteId,
          'reserve',
          item.materialId,
          lot,
          reserved,
          locId(mo.siteId, 'wh01'),
          locId(mo.siteId, 'wh01'),
          mo.id,
          null,
          item.consumeAtSeq,
          'manual',
          releasedAt + 6 * MINUTE,
          warehouse,
          '',
        )
      if (consumed > 0 && !old)
        txn(
          mo.siteId,
          'consume',
          item.materialId,
          lot,
          consumed,
          floor,
          null,
          mo.id,
          wo.id,
          item.consumeAtSeq,
          'automatic',
          endAt ?? NOW - rng.int(5, 60) * MINUTE,
          operator,
          'Backflush',
        )
    }
    if (
      (mo.status === 'released' || mo.status === 'in_progress' || mo.status === 'on_hold') &&
      lot &&
      (isMetal || item.materialId === 'mat-holo' || item.materialId.startsWith('mat-blister')) &&
      reserved + staged + issued > 0
    ) {
      floorStock.push({
        id: `fst-${moSeq(b)}-${n + 1}`,
        siteId: mo.siteId,
        materialId: item.materialId,
        lotId: lot.id,
        locationId: isMetal ? lot.locationId : locId(mo.siteId, 'wh01'),
        qty: Math.round((reserved + staged + issued) * 1000) / 1000,
        reservedQty: Math.round((reserved + staged + issued) * 1000) / 1000,
        moId: mo.id,
      })
    }
  })
}

// Returns and scraps that round out the ledger.
const closedJkt = releasedMos.filter((b) => b.mo.status === 'closed' && b.mo.siteId === SITE_JKT).slice(-4)
for (const [i, b] of closedJkt.entries()) {
  const at = Date.parse(b.mo.actualEnd!) + rng.int(1, 5) * HOUR
  if (i < 2) {
    const materialId = i === 0 ? 'mat-flux' : 'mat-polcmp'
    const lot = sharedLot.get(`${SITE_JKT}|${materialId}`)!
    txn(
      SITE_JKT,
      'return',
      materialId,
      lot,
      i === 0 ? 120 : 250,
      locId(SITE_JKT, 'fl01'),
      locId(SITE_JKT, 'wh01'),
      b.mo.id,
      null,
      i === 0 ? 10 : 40,
      'manual',
      at,
      warehouseFor(SITE_JKT),
      'Excess issue',
    )
    logEvent(
      SITE_JKT,
      'material.returned',
      at,
      warehouseFor(SITE_JKT),
      `${b.mo.code}: ${i === 0 ? 120 : 250} ${materialCode(materialId)} returned to WH-01 (Excess issue)`,
      { moId: b.mo.id, lotId: lot.id },
    )
  } else if (i === 2) {
    txn(
      SITE_JKT,
      'scrap',
      'mat-solvent',
      sharedLot.get(`${SITE_JKT}|mat-solvent`)!,
      800,
      locId(SITE_JKT, 'fl01'),
      null,
      b.mo.id,
      b.wos[3]!.id,
      40,
      'manual',
      at,
      b.wos[3]!.operatorIds[0] ?? 'per-operator',
      'Spilled during changeover',
    )
  } else {
    txn(
      SITE_JKT,
      'scrap',
      'mat-au9999',
      metalLotOf.get(b.mo.id) ?? null,
      12.4,
      locId(SITE_JKT, 'fl01'),
      null,
      b.mo.id,
      b.wos[0]!.id,
      10,
      'manual',
      at,
      b.wos[0]!.operatorIds[0] ?? 'per-operator',
      'Dross sent to refining',
    )
  }
}
const transferAt = dayAt(-1, 16, 20)
txn(
  SITE_JKT,
  'transfer',
  'mat-blister-m',
  sharedLot.get(`${SITE_JKT}|mat-blister-m`)!,
  2000,
  locId(SITE_JKT, 'wh01'),
  locId(SITE_JKT, 'trf01'),
  null,
  null,
  null,
  'manual',
  transferAt,
  warehouseFor(SITE_JKT),
  'Transfer to Surabaya',
)

sortByAt(materialTxns).forEach((t, i) => {
  t.id = `mtx-${pad(i + 1)}`
})

// ─── WIP ────────────────────────────────────────────────────────

export const wips: Wip[] = []
export interface HeldWip {
  wip: Wip
  built: BuiltMo
  heldAt: number
}
export const heldWips: HeldWip[] = []
/** Closed orders that keep their completed WIP rows, so released holds can point at them. */
export const closedWithWips: BuiltMo[] = []

const machineBuffer = (siteId: string, wc: string) =>
  wc === 'PRESS' ? locId(siteId, 'mb-press') : wc === 'POL' ? locId(siteId, 'mb-pol') : null

for (const b of releasedMos) {
  const { mo } = b
  const key = productSpec(mo.productId).key
  const buffer = lineBufferFor(mo.siteId, key)
  const lotIds = metalLotOf.has(mo.id) && b.wos[0]!.actualStart ? [metalLotOf.get(mo.id)!.id] : []
  const batch = `${mo.code}-B1`
  const codeFor = (seq: number) => (seq === 10 ? batch : `${mo.code}-B${seq}`)
  if (mo.status === 'released') {
    wips.push({
      id: `wip-${moSeq(b)}-10`,
      code: batch,
      siteId: mo.siteId,
      moId: mo.id,
      woId: null,
      productId: mo.productId,
      operationSeq: 10,
      qty: mo.qty,
      state: 'queued',
      locationId: buffer,
      batch,
      parentIds: [],
      lotIds: [],
      machineId: null,
      createdAt: iso(b.releasedAt!),
      updatedAt: iso(b.releasedAt!),
    })
    logEvent(
      mo.siteId,
      'wip.created',
      b.releasedAt!,
      'per-pm',
      `${batch} queued at line buffer with ${mo.qty} pcs`,
      { moId: mo.id, wipId: `wip-${moSeq(b)}-10` },
    )
    continue
  }
  if (mo.status !== 'in_progress' && mo.status !== 'on_hold') continue
  const k = b.plan.activeIndex
  const active = b.wos[k]!
  const seq = active.operationSeq
  const wc = OPERATIONS[k]!.wc
  const prevEnd = k > 0 ? Date.parse(b.wos[k - 1]!.actualEnd!) : b.releasedAt!
  let parentId: string | null = null
  if (active.actualStart) {
    const remaining = b.inputs[seq]! - b.processed[seq]!
    const id = `wip-${moSeq(b)}-${seq}`
    parentId = id
    wips.push({
      id,
      code: codeFor(seq),
      siteId: mo.siteId,
      moId: mo.id,
      woId: active.id,
      productId: mo.productId,
      operationSeq: seq,
      qty: Math.max(remaining, 0),
      state: mo.status === 'on_hold' ? 'hold' : 'processing',
      locationId: machineBuffer(mo.siteId, wc) ?? buffer,
      batch,
      parentIds: [],
      lotIds,
      machineId: active.machineId,
      createdAt: iso(prevEnd),
      updatedAt: iso(mo.status === 'on_hold' ? b.plan.heldAt! : Date.parse(active.actualStart)),
    })
    if (active.goodQty > 0 && k + 1 < b.wos.length) {
      const next = b.wos[k + 1]!
      const nid = `wip-${moSeq(b)}-${next.operationSeq}`
      const at = active.events.find((e) => e.kind === 'output')?.at ?? iso(NOW - 30 * MINUTE)
      wips.push({
        id: nid,
        code: codeFor(next.operationSeq),
        siteId: mo.siteId,
        moId: mo.id,
        woId: null,
        productId: mo.productId,
        operationSeq: next.operationSeq,
        qty: active.goodQty,
        state: 'queued',
        locationId: buffer,
        batch,
        parentIds: [id],
        lotIds,
        machineId: null,
        createdAt: at,
        updatedAt: at,
      })
      logEvent(
        mo.siteId,
        'wip.created',
        Date.parse(at),
        active.operatorIds[0] ?? 'per-operator',
        `${codeFor(next.operationSeq)} queued for operation ${next.operationSeq} with ${active.goodQty} pcs`,
        { moId: mo.id, wipId: nid },
      )
      parentId = nid
    }
  } else {
    const id = `wip-${moSeq(b)}-${seq}`
    parentId = id
    wips.push({
      id,
      code: codeFor(seq),
      siteId: mo.siteId,
      moId: mo.id,
      woId: null,
      productId: mo.productId,
      operationSeq: seq,
      qty: b.inputs[seq]!,
      state: 'queued',
      locationId: buffer,
      batch,
      parentIds: [],
      lotIds,
      machineId: null,
      createdAt: iso(prevEnd),
      updatedAt: iso(prevEnd),
    })
  }
  // Three running Jakarta orders had a sample split off and put on quality hold.
  const parent = wips.find((w) => w.id === parentId)!
  if (mo.siteId === SITE_JKT && parent.state === 'queued' && parent.qty >= 200 && heldWips.length < 3) {
    const h = Math.max(10, Math.round((parent.qty * 0.1) / 10) * 10)
    const heldAt = NOW - rng.int(2, 9) * HOUR
    const a: Wip = {
      ...parent,
      id: `${parent.id}-a`,
      code: `${parent.code}-A`,
      qty: parent.qty - h,
      parentIds: [parent.id],
      createdAt: iso(heldAt - 10 * MINUTE),
      updatedAt: iso(heldAt - 10 * MINUTE),
    }
    const held: Wip = {
      ...parent,
      id: `${parent.id}-b`,
      code: `${parent.code}-B`,
      qty: h,
      state: 'quality_hold',
      locationId: locId(mo.siteId, 'qch01'),
      parentIds: [parent.id],
      createdAt: iso(heldAt - 10 * MINUTE),
      updatedAt: iso(heldAt),
    }
    parent.qty = 0
    parent.state = 'completed'
    parent.updatedAt = iso(heldAt - 10 * MINUTE)
    wips.push(a, held)
    logEvent(
      mo.siteId,
      'wip.created',
      heldAt - 10 * MINUTE,
      'per-quality',
      `${parent.code} split into 2 batches`,
      { moId: mo.id, wipId: parent.id },
    )
    heldWips.push({ wip: held, built: b, heldAt })
  }
}

// Completed WIP trail for three recent closed orders.
for (const b of releasedMos.filter((x) => x.mo.status === 'closed' && x.mo.siteId === SITE_JKT).slice(-3)) {
  const { mo } = b
  const key = productSpec(mo.productId).key
  const batch = `${mo.code}-B1`
  const lot = metalLotOf.get(mo.id)
  closedWithWips.push(b)
  b.wos.forEach((wo, i) => {
    const seq = wo.operationSeq
    wips.push({
      id: `wip-${moSeq(b)}-${seq}`,
      code: seq === 10 ? batch : `${mo.code}-B${seq}`,
      siteId: mo.siteId,
      moId: mo.id,
      woId: wo.id,
      productId: mo.productId,
      operationSeq: seq,
      qty: 0,
      state: 'completed',
      locationId: machineBuffer(mo.siteId, OPERATIONS[i]!.wc) ?? lineBufferFor(mo.siteId, key),
      batch,
      parentIds: i === 0 ? [] : [`wip-${moSeq(b)}-${b.wos[i - 1]!.operationSeq}`],
      lotIds: lot ? [lot.id] : [],
      machineId: wo.machineId,
      createdAt:
        i === 0
          ? iso(b.releasedAt!)
          : (wo.events.find((e) => e.kind === 'created' && e.text.startsWith('Ready'))?.at ??
            wo.actualStart!),
      updatedAt: wo.actualEnd!,
    })
  })
}

// ─── Finished goods ─────────────────────────────────────────────

export const finishedGoodsReceipts: FinishedGoodsReceipt[] = []
export const serials: Serial[] = []
const serialCursor: Record<string, number> = { gb025: 1200, gb050: 640, gb100: 310, sb250: 90 }
const customerOf = (orderId: string): string | null =>
  marketingOrders.find((o) => o.id === orderId)?.customerId ?? null

const receiptDrafts: { receipt: FinishedGoodsReceipt; at: number }[] = []
for (const b of releasedMos.filter((x) => x.mo.status === 'completed' || x.mo.status === 'closed')) {
  const { mo } = b
  const spec = productSpec(mo.productId)
  const at = clampPast(Date.parse(mo.actualEnd!) + rng.int(30, 120) * MINUTE)
  const id = `fgr-${moSeq(b)}`
  const serialIds: string[] = []
  if (spec.serial) {
    const rule = serialRules.find((r) => r.productId === mo.productId)!
    const start = serialCursor[spec.key]!
    const delivered =
      mo.demandIds.length > 0 &&
      mo.demandIds.every((d) => demands.find((x) => x.id === d)!.status === 'fulfilled')
    const item = demands.find((d) => mo.demandIds.includes(d.id))?.orderItemId ?? null
    const customerId = delivered && item ? (item.split('-l')[0] ?? null) : null
    for (let i = 0; i < Math.min(40, mo.goodQty); i++) {
      const sid = `ser-${moSeq(b)}-${i + 1}`
      serialIds.push(sid)
      serials.push({
        id: sid,
        serialNo: rule.pattern.replace('{seq}', String(start + i).padStart(6, '0')),
        productId: mo.productId,
        moId: mo.id,
        wipId: null,
        receiptId: id,
        customerId: customerId ? customerOf(customerId) : null,
        status: delivered ? 'delivered' : 'finished',
      })
    }
    serialCursor[spec.key] = start + mo.goodQty
  }
  const receipt: FinishedGoodsReceipt = {
    id,
    code: '',
    siteId: mo.siteId,
    moId: mo.id,
    productId: mo.productId,
    qty: mo.goodQty,
    uomId: 'uom-pcs',
    lotCode: `${mo.code}-FG`,
    locationId: locId(mo.siteId, 'fg01'),
    serialIds,
    at: iso(at),
    by: warehouseFor(mo.siteId),
  }
  receiptDrafts.push({ receipt, at })
  logEvent(
    mo.siteId,
    'finished_goods.received',
    at,
    warehouseFor(mo.siteId),
    `${mo.code}: ${mo.goodQty} received into FG-01`,
    { moId: mo.id },
  )
}
receiptDrafts.sort((a, b) => a.at - b.at)
receiptDrafts.forEach(({ receipt }, i) => {
  receipt.code = `FGR-${pad(500 + i)}`
  finishedGoodsReceipts.push(receipt)
})
export const LAST_FGR_SEQ = 500 + receiptDrafts.length - 1
for (const rule of serialRules) {
  const key = productSpec(rule.productId).key
  rule.nextSeq = serialCursor[key] ?? 1
}

export const fgStock: FgStock[] = []
for (const siteId of SITES) {
  const rows = new Map<string, { qty: number; allocated: number }>()
  for (const [key, qty] of Object.entries(FG_ONHAND[siteId] ?? {}))
    rows.set(key, { qty, allocated: allocatedStock(siteId, key) })
  for (const b of releasedMos.filter(
    (x) =>
      x.mo.siteId === siteId &&
      (x.mo.status === 'completed' || x.mo.status === 'closed') &&
      x.mo.source !== 'mts',
  )) {
    const done =
      b.mo.demandIds.length > 0 &&
      b.mo.demandIds.every((d) => demands.find((x) => x.id === d)!.status === 'fulfilled')
    if (done) continue
    const key = productSpec(b.mo.productId).key
    const row = rows.get(key) ?? { qty: 0, allocated: 0 }
    rows.set(key, { qty: row.qty + b.mo.goodQty, allocated: row.allocated + b.mo.goodQty })
  }
  for (const [key, row] of rows)
    fgStock.push({
      id: `fgs-${siteId.replace('site-', '')}-${key}`,
      siteId,
      productId: productId(key),
      locationId: locId(siteId, 'fg01'),
      qty: row.qty,
      allocatedQty: Math.min(row.qty, row.allocated),
    })
}
const gb001Vault = fgStock.find((f) => f.siteId === SITE_JKT && f.productId === productId('gb001'))!
settleBlueprintReplenishment(gb001Vault.qty, gb001Vault.allocatedQty)
