// Inspections, defects, holds, scrap, rework and NCRs derived from the work-order quantities.
import type {
  DefectRecord,
  Disposition,
  Inspection,
  Measurement,
  Ncr,
  QualityHold,
  ReworkOrder,
  ScrapRecord,
  Wip,
} from '../../packages/types/src/index.ts'
import { shiftAt } from '../../packages/fixtures/src/derive.ts'
import { DAY, HOUR, MINUTE, NOW, SITE_JKT, clampPast, dayAt, iso, locId, logEvent, pad } from './common.ts'
import { closedWithWips, heldWips, metalLotOf, returnedLot, wips } from './inventory.ts'
import { productSpec, reason } from './master.ts'
import { qualityFor, shifts, supervisorFor } from './people.ts'
import { inspectionPlans, plmFor } from './plm.ts'
import { moSeq, releasedMos, type BuiltMo } from './production.ts'
import { rng } from './rng.ts'

const wipAt = (b: BuiltMo, seq: number): Wip | undefined =>
  wips.find(
    (w) => w.moId === b.mo.id && w.operationSeq === seq && !w.id.endsWith('-a') && !w.id.endsWith('-b'),
  )

// ─── Inspections ────────────────────────────────────────────────

export const inspections: Inspection[] = []
export const defectRecords: DefectRecord[] = []
const inspectionDrafts: { row: Inspection; at: number }[] = []

const CHARS: Record<number, string[]> = { 10: ['c5', 'c3'], 40: ['c2', 'c3'], 50: ['c1', 'c3', 'c2'] }

function measure(
  b: BuiltMo,
  seq: number,
  fail: 'none' | 'weight' | 'purity' | 'visual',
  blank: boolean,
): Measurement[] {
  const spec = plmFor(productSpec(b.mo.productId).key).qualitySpec
  return CHARS[seq]!.map((suffix) => {
    const c = spec.characteristics.find((x) => x.id.endsWith(`-${suffix}`))!
    const base: Measurement = {
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
    }
    if (blank) return base
    if (c.type === 'numeric') {
      const tol = c.max !== null && c.target !== null ? c.max - c.target : 0.006
      const isPurity = suffix === 'c1'
      const failing = (isPurity && fail === 'purity') || (!isPurity && fail === 'weight')
      const value = isPurity
        ? failing
          ? c.min! - 0.005
          : c.target! + rng.float(0, 0.006)
        : failing
          ? c.target! - tol * 1.3
          : c.target! + rng.float(-tol * 0.4, tol * 0.4)
      return {
        ...base,
        value: Math.round(value * 1000) / 1000,
        result: failing ? 'fail' : 'pass',
        note: failing ? (isPurity ? 'Mean of 3 readings below limit' : 'Below lower tolerance') : '',
      }
    }
    const failing = fail === 'visual'
    return {
      ...base,
      result: failing ? 'fail' : 'pass',
      note: failing ? (seq === 10 ? 'Two cavities short-filled' : 'Fine scratches on the obverse') : '',
    }
  })
}

const DEFECT_BY_FAIL: Record<string, string> = {
  weight: 'def-02',
  purity: 'def-07',
  'visual-10': 'def-03',
  'visual-40': 'def-01',
  'visual-50': 'def-05',
}

for (const b of releasedMos) {
  const { mo } = b
  const old = Date.parse(mo.createdAt) < NOW - 15 * DAY
  for (const seq of [10, 40, 50]) {
    if (old && seq === 40) continue
    const wo = b.wos.find((w) => w.operationSeq === seq)!
    if (!wo.actualStart) continue
    const plan = inspectionPlans.find((p) => p.productId === mo.productId && p.operationSeq === seq)!
    const startAt = Date.parse(wo.actualStart)
    const done = wo.status === 'completed'
    const fraction = b.inputs[seq] ? b.processed[seq]! / b.inputs[seq]! : 0
    const requestedAt = seq === 50 ? startAt : startAt + 15 * MINUTE
    const shiftId = shiftAt(shifts, requestedAt)?.id ?? null
    const inspector = qualityFor(mo.siteId, shiftId)
    let status: Inspection['status']
    if (done) status = 'passed'
    else if (seq === 50) status = 'in_progress'
    else status = fraction > 0.3 ? 'passed' : 'pending'
    const defects = wo.rejectQty + wo.reworkQty + (seq === 10 ? wo.scrapQty : 0)
    let fail: 'none' | 'weight' | 'purity' | 'visual' = 'none'
    if (status === 'passed' && defects > 0 && (wo.reworkQty > 0 || rng.chance(seq === 10 ? 0.3 : 0.4))) {
      status = 'failed'
      fail =
        seq === 10
          ? 'visual'
          : wo.reworkQty > 0
            ? 'visual'
            : seq === 50 && rng.chance(0.2)
              ? 'purity'
              : seq === 50
                ? 'weight'
                : 'visual'
    }
    const completed = status === 'passed' || status === 'failed'
    const completedAt = completed
      ? Math.min(
          requestedAt + rng.int(20, 60) * MINUTE,
          wo.actualEnd ? Date.parse(wo.actualEnd) : NOW - 5 * MINUTE,
        )
      : null
    const disposition: Disposition | null = !completed
      ? null
      : status === 'passed'
        ? 'accept'
        : wo.reworkQty > 0
          ? 'rework'
          : seq === 10
            ? 'scrap'
            : rng.pick(['scrap', 'use_as_is'])
    const id = `ins-${moSeq(b)}-${seq}`
    const wip = wipAt(b, seq)
    const defectIds: string[] = []
    if (status === 'failed') {
      const code = fail === 'visual' ? DEFECT_BY_FAIL[`visual-${seq}`]! : DEFECT_BY_FAIL[fail]!
      const rid = `dfr-${moSeq(b)}-${seq}`
      defectIds.push(rid)
      defectRecords.push({
        id: rid,
        siteId: mo.siteId,
        defectCodeId: code,
        inspectionId: id,
        moId: mo.id,
        woId: wo.id,
        wipId: wip?.id ?? null,
        qty: defects,
        note: fail === 'purity' ? 'Sample retained for re-assay' : '',
        at: iso(completedAt!),
        by: inspector,
      })
    }
    const row: Inspection = {
      id,
      code: '',
      siteId: mo.siteId,
      planId: plan.id,
      productId: mo.productId,
      moId: mo.id,
      woId: wo.id,
      wipId: wip?.id ?? null,
      lotId: seq === 10 ? (metalLotOf.get(mo.id)?.id ?? null) : null,
      operationSeq: seq,
      trigger: plan.trigger,
      status,
      sampleSize: plan.sampleSize,
      measurements: measure(b, seq, fail, !completed),
      inspectorId: status === 'pending' ? null : inspector,
      requestedAt: iso(requestedAt),
      completedAt: completedAt === null ? null : iso(completedAt),
      disposition,
      defectRecordIds: defectIds,
      photos: status === 'failed' ? [`ins-${moSeq(b)}-${seq}-1.jpg`] : [],
      note: status === 'failed' ? `${defects} pcs affected, ${disposition}` : '',
    }
    inspectionDrafts.push({ row, at: requestedAt })
    if (completed && !old)
      logEvent(
        mo.siteId,
        status === 'failed' ? 'quality.check.failed' : 'quality.check.passed',
        completedAt!,
        inspector,
        `${wo.code}: inspection ${status} · ${disposition}`,
        { moId: mo.id, woId: wo.id, wipId: row.wipId },
      )
  }
}

// Failed batch inspections behind the three active quality holds.
export const qualityHolds: QualityHold[] = []
const holdDrafts: { row: QualityHold; at: number }[] = []

for (const [i, h] of heldWips.entries()) {
  const { built: b, wip, heldAt } = h
  const wo = b.wos.find((w) => w.operationSeq === wip.operationSeq)!
  const inspector = qualityFor(SITE_JKT, shiftAt(shifts, heldAt)?.id ?? null)
  const id = `ins-${moSeq(b)}-hold`
  const rid = `dfr-${moSeq(b)}-hold`
  defectRecords.push({
    id: rid,
    siteId: b.mo.siteId,
    defectCodeId: i === 1 ? 'def-02' : 'def-05',
    inspectionId: id,
    moId: b.mo.id,
    woId: wo.id,
    wipId: wip.id,
    qty: wip.qty,
    note: 'Sample batch quarantined pending engineering review',
    at: iso(heldAt),
    by: inspector,
  })
  inspectionDrafts.push({
    row: {
      id,
      code: '',
      siteId: b.mo.siteId,
      planId: null,
      productId: b.mo.productId,
      moId: b.mo.id,
      woId: wo.id,
      wipId: wip.id,
      lotId: null,
      operationSeq: wip.operationSeq,
      trigger: 'batch',
      status: 'failed',
      sampleSize: 10,
      measurements: measure(b, 40, i === 1 ? 'weight' : 'visual', false),
      inspectorId: inspector,
      requestedAt: iso(heldAt - 40 * MINUTE),
      completedAt: iso(heldAt),
      disposition: 'hold',
      defectRecordIds: [rid],
      photos: [`${id}-1.jpg`],
      note: `${wip.qty} pcs on hold, awaiting engineering review`,
    },
    at: heldAt - 40 * MINUTE,
  })
  holdDrafts.push({
    row: {
      id: `qh-${moSeq(b)}-${wip.operationSeq}`,
      code: '',
      siteId: b.mo.siteId,
      target: 'wip',
      targetId: wip.id,
      moId: b.mo.id,
      reasonCodeId: reason('HLD-QC'),
      note: `${wip.code}: ${i === 1 ? 'underweight sample' : 'discoloration on sample'}`,
      status: 'active',
      heldBy: inspector,
      heldAt: iso(heldAt),
      releasedBy: null,
      releasedAt: null,
      disposition: null,
    },
    at: heldAt,
  })
  logEvent(
    SITE_JKT,
    'quality.check.failed',
    heldAt,
    inspector,
    `${wip.code}: batch inspection failed · hold`,
    { moId: b.mo.id, woId: wo.id, wipId: wip.id },
  )
  logEvent(SITE_JKT, 'wip.held', heldAt, inspector, `${wip.code} on quality hold`, {
    moId: b.mo.id,
    wipId: wip.id,
  })
}

inspectionDrafts.sort((a, b) => a.at - b.at)
inspectionDrafts.forEach(({ row }, i) => {
  row.code = `INS-${pad(700 + i)}`
  inspections.push(row)
})
export const LAST_INS_SEQ = 700 + inspectionDrafts.length - 1

// ─── Released holds ─────────────────────────────────────────────

const releasedHold = (
  id: string,
  target: QualityHold['target'],
  targetId: string,
  moId: string | null,
  heldAt: number,
  hours: number,
  disposition: Disposition,
  note: string,
) => {
  const releasedAt = clampPast(heldAt + hours * HOUR)
  const quality = qualityFor(SITE_JKT, shiftAt(shifts, heldAt)?.id ?? null)
  holdDrafts.push({
    row: {
      id,
      code: '',
      siteId: SITE_JKT,
      target,
      targetId,
      moId,
      reasonCodeId: reason(target === 'lot' ? 'HLD-DOC' : 'HLD-QC'),
      note,
      status: 'released',
      heldBy: quality,
      heldAt: iso(heldAt),
      releasedBy: qualityFor(SITE_JKT, shiftAt(shifts, releasedAt)?.id ?? null),
      releasedAt: iso(releasedAt),
      disposition,
    },
    at: heldAt,
  })
  logEvent(SITE_JKT, 'wip.held', heldAt, quality, `${note}`, {
    moId,
    wipId: target === 'wip' ? targetId : null,
  })
  logEvent(SITE_JKT, 'wip.released', releasedAt, quality, `Hold released · ${disposition}`, {
    moId,
    wipId: target === 'wip' ? targetId : null,
  })
}

closedWithWips.forEach((b, i) => {
  const wo = b.wos[3]!
  const heldAt = Date.parse(wo.actualStart!) + HOUR
  releasedHold(
    `qh-${moSeq(b)}-40`,
    'wip',
    `wip-${moSeq(b)}-40`,
    b.mo.id,
    heldAt,
    rng.int(1, 4),
    (['accept', 'use_as_is', 'rework'] as Disposition[])[i]!,
    `${b.mo.code}-B40: surface check pending after compound change`,
  )
})
releasedHold(
  'qh-lot-flux',
  'lot',
  returnedLot.id,
  null,
  Date.parse(returnedLot.receivedAt) + 5 * DAY,
  6,
  'return',
  `${returnedLot.code}: incoming inspection, flux moisture above limit`,
)
const heldMo = releasedMos.find(
  (b) => b.mo.status === 'in_progress' && b.mo.siteId === SITE_JKT && !b.mo.atRisk && b.plan.activeIndex >= 2,
)!
releasedHold(
  `qh-${moSeq(heldMo)}-mo`,
  'mo',
  heldMo.mo.id,
  heldMo.mo.id,
  Date.parse(heldMo.wos[0]!.actualStart!) + 2 * HOUR,
  5,
  'accept',
  `${heldMo.mo.code}: certificate card artwork confirmation`,
)
const woHoldMo = releasedMos.find((b) => b.mo.status === 'completed' && b.mo.siteId === SITE_JKT)!
releasedHold(
  `qh-${moSeq(woHoldMo)}-wo`,
  'wo',
  woHoldMo.wos[2]!.id,
  woHoldMo.mo.id,
  Date.parse(woHoldMo.wos[2]!.actualStart!) + 30 * MINUTE,
  1.5,
  'accept',
  `${woHoldMo.wos[2]!.code}: die alignment re-check after first piece`,
)

holdDrafts.sort((a, b) => a.at - b.at)
holdDrafts.forEach(({ row }, i) => {
  row.code = `QH-${pad(60 + i)}`
  qualityHolds.push(row)
})
export const LAST_QH_SEQ = 60 + holdDrafts.length - 1

// ─── Scrap and rework ───────────────────────────────────────────

export const scrapRecords: ScrapRecord[] = []
const SCRAP_REASON: Record<number, string[]> = {
  10: ['SCR-SPL', 'SCR-POR'],
  30: ['SCR-CRK'],
  60: ['SCR-PKG'],
}
for (const b of releasedMos) {
  for (const wo of b.wos) {
    if (wo.scrapQty <= 0) continue
    const at = wo.events.find((e) => e.kind === 'scrap')?.at ?? wo.actualEnd ?? iso(NOW - 30 * MINUTE)
    const code = rng.pick(SCRAP_REASON[wo.operationSeq] ?? ['SCR-CRK'])
    scrapRecords.push({
      id: `scr-${moSeq(b)}-${wo.operationSeq}`,
      siteId: b.mo.siteId,
      moId: b.mo.id,
      woId: wo.id,
      wipId: wipAt(b, wo.operationSeq)?.id ?? null,
      operationSeq: wo.operationSeq,
      qty: wo.scrapQty,
      reasonCodeId: reason(code),
      operatorId: wo.operatorIds[0] ?? supervisorFor(b.mo.siteId, wo.shiftId),
      disposition: 'scrap',
      at,
      note:
        code === 'SCR-SPL'
          ? 'Short pour on the last shot, metal returned to melt'
          : code === 'SCR-PKG'
            ? 'Blister seal torn on the sealing head'
            : '',
    })
    logEvent(
      b.mo.siteId,
      'product.scrapped',
      Date.parse(at),
      wo.operatorIds[0] ?? 'per-operator',
      `${wo.code}: ${wo.scrapQty} scrapped`,
      { moId: b.mo.id, woId: wo.id },
    )
  }
}

export const reworkOrders: ReworkOrder[] = []
const reworkDrafts: { row: ReworkOrder; at: number }[] = []
for (const b of releasedMos) {
  for (const wo of b.wos) {
    if (wo.reworkQty <= 0) continue
    const op = plmFor(productSpec(b.mo.productId).key).bop.operations.find((o) => o.seq === wo.operationSeq)!
    const routeSeqs =
      op.reworkToSeq === null
        ? [wo.operationSeq]
        : [op.reworkToSeq, wo.operationSeq].filter((s, i, a) => a.indexOf(s) === i)
    const createdAt = Date.parse(
      wo.events.find((e) => e.kind === 'rework')?.at ?? wo.actualEnd ?? iso(NOW - 30 * MINUTE),
    )
    const status: ReworkOrder['status'] =
      b.mo.status === 'closed'
        ? 'closed'
        : b.mo.status === 'completed'
          ? 'inspection'
          : b.wos.indexOf(wo) === b.plan.activeIndex
            ? 'open'
            : 'in_progress'
    const id = `rwk-${moSeq(b)}-${wo.operationSeq}`
    const source = wipAt(b, wo.operationSeq)
    let reworkWipId: string | null = null
    if (status !== 'closed') {
      reworkWipId = `wip-rwk-${moSeq(b)}-${wo.operationSeq}`
      wips.push({
        id: reworkWipId,
        code: '',
        siteId: b.mo.siteId,
        moId: b.mo.id,
        woId: wo.id,
        productId: b.mo.productId,
        operationSeq: routeSeqs[0]!,
        qty: wo.reworkQty,
        state: 'rework',
        locationId: locId(b.mo.siteId, 'rwk01'),
        batch: `${b.mo.code}-B1`,
        parentIds: source ? [source.id] : [],
        lotIds: metalLotOf.has(b.mo.id) ? [metalLotOf.get(b.mo.id)!.id] : [],
        machineId: null,
        createdAt: iso(createdAt),
        updatedAt: iso(createdAt),
      })
    }
    const scrap = status === 'closed' ? rng.int(0, Math.min(2, wo.reworkQty)) : 0
    reworkDrafts.push({
      row: {
        id,
        code: '',
        siteId: b.mo.siteId,
        moId: b.mo.id,
        sourceWoId: wo.id,
        sourceWipId: source?.id ?? null,
        reworkWipId,
        qty: wo.reworkQty,
        routeSeqs,
        status,
        inspectionId:
          status === 'closed'
            ? (inspections.find((i) => i.moId === b.mo.id && i.operationSeq === 50)?.id ?? null)
            : null,
        goodQty: status === 'closed' ? wo.reworkQty - scrap : 0,
        scrapQty: scrap,
        reasonCodeId: reason(wo.operationSeq === 30 ? 'RWK-PRS' : 'RWK-POL'),
        createdAt: iso(createdAt),
        closedAt: status === 'closed' ? iso(clampPast(createdAt + rng.int(3, 10) * HOUR)) : null,
      },
      at: createdAt,
    })
    logEvent(
      b.mo.siteId,
      'product.reworked',
      createdAt,
      wo.operatorIds[0] ?? 'per-operator',
      `${wo.code}: ${wo.reworkQty} sent to rework`,
      { moId: b.mo.id, woId: wo.id, wipId: reworkWipId },
    )
  }
}
reworkDrafts.sort((a, b) => a.at - b.at)
reworkDrafts.forEach(({ row }, i) => {
  row.code = `RWK-${pad(30 + i)}`
  if (row.reworkWipId) wips.find((w) => w.id === row.reworkWipId)!.code = `${row.code}-W`
  reworkOrders.push(row)
})
export const LAST_RWK_SEQ = 30 + reworkDrafts.length - 1

// ─── NCRs ───────────────────────────────────────────────────────

const closedOf = (key: string) =>
  releasedMos.find((b) => b.mo.status === 'closed' && productSpec(b.mo.productId).key === key) ??
  releasedMos.find((b) => b.mo.status === 'closed')!
const purityFail = inspections.find((i) => i.status === 'failed' && i.operationSeq === 50)
const anyInProgress = releasedMos.find(
  (b) => b.mo.status === 'in_progress' && b.mo.siteId === SITE_JKT && !b.mo.atRisk,
)!
const underweight =
  releasedMos.find((b) => b.mo.status === 'completed' && b.mo.siteId === SITE_JKT) ?? closedOf('gb001')

const ncr = (
  n: number,
  title: string,
  defectCodeId: string,
  severity: Ncr['severity'],
  source: Ncr['source'],
  refs: Partial<Pick<Ncr, 'moId' | 'woId' | 'lotId' | 'wipId'>>,
  ageDays: number,
  status: Ncr['status'],
  disposition: Disposition | null,
  containment: string,
  raisedBy: string,
): Ncr => ({
  id: `ncr-${pad(n)}`,
  code: `NCR-${pad(n)}`,
  siteId: SITE_JKT,
  title,
  defectCodeId,
  severity,
  source,
  moId: refs.moId ?? null,
  woId: refs.woId ?? null,
  lotId: refs.lotId ?? null,
  wipId: refs.wipId ?? null,
  containment,
  disposition,
  status,
  raisedBy,
  raisedAt: iso(dayAt(-ageDays, rng.int(8, 16), rng.int(0, 59))),
  closedAt: status === 'closed' ? iso(dayAt(-ageDays + rng.int(2, 6), 15)) : null,
})

export const ncrs: Ncr[] = [
  ncr(
    40,
    'Hologram seal missing on packed blisters',
    'def-10',
    'major',
    'audit',
    { moId: closedOf('gb001').mo.id, woId: closedOf('gb001').wos[5]!.id },
    22,
    'closed',
    'rework',
    '120 blisters re-opened and resealed; sealing head sensor added to the PM plan.',
    'per-quality',
  ),
  ncr(
    41,
    'Underweight 1g bars from CAST-01',
    'def-02',
    'major',
    'inspection',
    { moId: underweight.mo.id, woId: underweight.wos[0]!.id },
    16,
    'disposition',
    'scrap',
    '38 pcs segregated at QCH-01; mold cavity 17 measured and blocked.',
    'per-quality',
  ),
  ncr(
    42,
    'Surface scratches on delivered 50g bars',
    'def-01',
    'major',
    'customer',
    { moId: closedOf('gb050').mo.id },
    8,
    'disposition',
    'rework',
    'Customer returned 60 pcs; replacement run raised as a rework demand.',
    'per-marketing',
  ),
  ncr(
    43,
    'Incoming flux lot moisture above limit',
    'def-03',
    'minor',
    'supplier',
    { lotId: returnedLot.id },
    7,
    'closed',
    'return',
    `${returnedLot.code} returned to PT Kimia Cor Indonesia; supplier CoA now required per lot.`,
    'per-warehouse',
  ),
  ncr(
    44,
    purityFail
      ? 'XRF purity reading below 99.98 at final inspection'
      : 'XRF purity reading below limit at final inspection',
    'def-07',
    'critical',
    'inspection',
    purityFail
      ? { moId: purityFail.moId, woId: purityFail.woId, wipId: purityFail.wipId }
      : { moId: closedOf('gb005').mo.id },
    4,
    'containment',
    null,
    'Batch quarantined; samples sent for fire assay confirmation.',
    'per-quality',
  ),
  ncr(
    45,
    'Edge burr on 2g bars after die change',
    'def-08',
    'minor',
    'operator',
    { moId: anyInProgress.mo.id, woId: anyInProgress.wos[2]!.id },
    2,
    'open',
    null,
    'Die DIE-GB-002 pulled for inspection; press running on spare die.',
    'per-operator',
  ),
  ncr(
    46,
    'Engraving misaligned on 25g bars',
    'def-04',
    'minor',
    'customer',
    { moId: closedOf('gb025').mo.id },
    1,
    'open',
    null,
    'Photos requested from customer; engraving jig JIG-M to be checked.',
    'per-marketing',
  ),
]
