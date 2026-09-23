// Manufacturing orders with their work orders, timelines, quantities and event history.
import type {
  ManufacturingOrder,
  MoEvent,
  MoStatus,
  PlmSnapshot,
  Validation,
  WoEvent,
  WoEventKind,
  WoStatus,
  WorkOrder,
} from '../../packages/types/src/index.ts'
import { VALIDATION_CHECKS } from '../../packages/types/src/index.ts'
import { startOfDay } from '../../packages/fixtures/src/dates.ts'
import { shiftAt } from '../../packages/fixtures/src/derive.ts'
import {
  ALARM_AT,
  DAY,
  DOWN_AT,
  HOUR,
  MINUTE,
  NOW,
  SITE_JKT,
  SITE_SBY,
  clampPast,
  dayAt,
  iso,
  isoOrNull,
  logEvent,
  pad,
  skipSunday,
  wcId,
} from './common.ts'
import { moRequests, type MoRequest } from './demand.ts'
import { MACHINE_SPECS, POL_02, dieId, machineByCode, machineId, machineSpec, moldId } from './machines.ts'
import { lineFor, productId, productSpec, reason } from './master.ts'
import { operatorsFor, plannerFor, shifts, supervisorFor } from './people.ts'
import { OPERATIONS, plmFor } from './plm.ts'
import { rng } from './rng.ts'

export type MaterialState = 'ready' | 'partial' | 'shortage'

interface Script {
  op: number
  machine: string | null
  state: 'in_progress' | 'paused' | 'ready' | 'assigned'
  slow?: boolean
}

// Machines with product restrictions come first so they find a compatible order.
const JKT_SCRIPTS: Script[] = [
  { op: 10, machine: 'CAST-01', state: 'in_progress' },
  { op: 10, machine: 'CAST-02', state: 'in_progress' },
  { op: 30, machine: 'PRESS-01', state: 'in_progress' },
  { op: 40, machine: 'POL-02', state: 'paused' },
  { op: 60, machine: 'PACK-01', state: 'in_progress' },
  { op: 60, machine: 'PACK-02', state: 'in_progress', slow: true },
  { op: 50, machine: 'QC-01', state: 'in_progress' },
  { op: 50, machine: null, state: 'ready' },
  { op: 40, machine: 'POL-01', state: 'in_progress' },
  { op: 40, machine: 'POL-03', state: 'in_progress', slow: true },
  { op: 30, machine: 'PRESS-02', state: 'in_progress', slow: true },
  { op: 20, machine: 'COOL-01', state: 'in_progress' },
]
const SBY_SCRIPTS: Script[] = [
  { op: 40, machine: 'POL-01', state: 'in_progress' },
  { op: 30, machine: 'PRESS-01', state: 'in_progress' },
  { op: 10, machine: 'CAST-01', state: 'in_progress' },
]

/** Machines that sit idle at fixture time: never assigned to a running work order. */
const IDLE_NOW = new Set(['PRESS-03', 'POL-04', 'ENG-01', 'ENG-02'])

const WITH_WOS: MoStatus[] = ['released', 'in_progress', 'completed', 'closed', 'on_hold']

interface Plan {
  req: MoRequest
  script: Script | null
  status: MoStatus
  createdAt: number
  plannedStart: number
  durs: number[]
  factor: number
  gaps: number[]
  /** Index of the first operation that is not completed; -1 when every operation is done or none started. */
  activeIndex: number
  activeState: WoStatus | null
  actualStart0: number | null
  elapsed: number
  heldAt: number | null
}

const opDurations = (key: string, qty: number): number[] => {
  const { bop, bor } = plmFor(key)
  return bop.operations.map((op) => {
    const operators = bor.items.find((i) => i.operationSeq === op.seq)?.operatorCount ?? 1
    return Math.max(
      HOUR,
      (op.setupMin + op.queueMin + op.transferMin) * MINUTE + (op.cycleSec * qty * 1000) / operators,
    )
  })
}

const eligibleFor = (code: string, siteId: string, key: string) => {
  const spec = machineSpec(machineByCode(siteId, code))
  return spec.eligible.length === 0 || spec.eligible.includes(key)
}

/** Hand each running MO a script (which operation, which machine); leftovers stay released. */
function assignScripts(requests: MoRequest[]): Map<string, Script> {
  const out = new Map<string, Script>()
  for (const [siteId, scripts] of [
    [SITE_JKT, JKT_SCRIPTS],
    [SITE_SBY, SBY_SCRIPTS],
  ] as const) {
    const pool = requests
      .filter((r) => r.siteId === siteId && r.status === 'in_progress')
      .sort((a, b) => a.createdAt - b.createdAt)
    for (const script of scripts) {
      const candidates = pool.filter(
        (r) => !out.has(r.key) && (!script.machine || eligibleFor(script.machine, siteId, r.productKey)),
      )
      if (!candidates.length) continue
      const chosen =
        script.state === 'paused'
          ? candidates.reduce((best, r) =>
              opDurations(r.productKey, r.qty)[3]! > opDurations(best.productKey, best.qty)[3]! ? r : best,
            )
          : candidates[0]!
      out.set(chosen.key, script)
    }
    // A few more running orders wait between operations with their batch queued at the buffer.
    for (const r of pool.filter((x) => !out.has(x.key)).slice(0, 3))
      out.set(r.key, { op: rng.pick([20, 30, 40, 50]), machine: null, state: 'ready' })
  }
  return out
}

function plan(req: MoRequest, script: Script | null): Plan {
  const durs = opDurations(req.productKey, req.qty)
  const status: MoStatus = req.status === 'in_progress' && !script ? 'released' : req.status
  const factor = script?.slow ? rng.float(1.7, 2.2) : rng.float(0.9, 1.25)
  const gaps = durs.map(() => rng.int(5, 35) * MINUTE)
  let createdAt = req.createdAt
  let plannedStart = 0
  let actualStart0: number | null = null
  let activeIndex = -1
  let activeState: WoStatus | null = null
  let elapsed = 0
  let heldAt: number | null = null
  const dayOf = (ms: number) => Math.round((startOfDay(ms) - dayAt(0, 0)) / DAY)
  switch (status) {
    case 'draft':
      plannedStart = skipSunday(dayAt(rng.int(5, 10), 7))
      break
    case 'planned':
      plannedStart = skipSunday(dayAt(Math.max(dayOf(createdAt) + 1, rng.int(1, 6)), 7))
      break
    case 'cancelled':
      plannedStart = skipSunday(dayAt(dayOf(createdAt) + 2, 7))
      break
    case 'released':
      plannedStart = Math.max(createdAt + 3 * HOUR, skipSunday(dayAt(rng.int(0, 2), rng.pick([7, 15]))))
      break
    case 'in_progress':
    case 'on_hold': {
      activeIndex =
        status === 'on_hold' ? rng.int(1, 3) : durs.findIndex((_, i) => OPERATIONS[i]!.seq === script!.op)
      activeState = status === 'on_hold' ? 'hold' : script!.state
      const before = durs.slice(0, activeIndex).reduce((s, d, i) => s + d * factor + gaps[i]!, 0)
      const active = durs[activeIndex]! * factor
      if (activeState === 'in_progress') elapsed = active * rng.float(0.15, 0.85)
      else if (activeState === 'paused') elapsed = Math.max(active * rng.float(0.3, 0.6), 3.5 * HOUR)
      else if (activeState === 'hold') {
        const holdAgo = rng.int(4, 40) * HOUR
        elapsed = active * 0.4 + holdAgo
        heldAt = NOW - holdAgo
      } else elapsed = rng.int(20, 60) * MINUTE
      actualStart0 = NOW - before - elapsed
      plannedStart = actualStart0 - rng.int(10, 40) * MINUTE
      createdAt = Math.min(createdAt, plannedStart - 8 * HOUR)
      break
    }
    case 'completed':
    case 'closed': {
      plannedStart = skipSunday(startOfDay(createdAt) + rng.int(1, 2) * DAY + 7 * HOUR)
      actualStart0 = plannedStart + rng.int(-20, 40) * MINUTE
      const total = durs.reduce((s, d, i) => s + d * factor + gaps[i]!, 0)
      const margin = (status === 'completed' ? rng.int(3, 30) : rng.int(30, 200)) * HOUR
      const end = actualStart0 + total
      // Completed orders finished recently (they close within a day or two); closed ones only need to fit before now.
      if (status === 'completed' || end > NOW - margin) {
        const shift = end - (NOW - margin)
        plannedStart -= shift
        actualStart0 -= shift
        createdAt = Math.min(createdAt, plannedStart - 6 * HOUR)
      }
      break
    }
  }
  return {
    req,
    script,
    status,
    createdAt,
    plannedStart,
    durs,
    factor,
    gaps,
    activeIndex,
    activeState,
    actualStart0,
    elapsed,
    heldAt,
  }
}

// ─── Quantities ─────────────────────────────────────────────────

interface OpQty {
  processed: number
  good: number
  reject: number
  rework: number
  scrap: number
}

function opQty(seq: number, input: number, fraction: number): OpQty {
  const processed = Math.round(input * fraction)
  let reject = 0
  let rework = 0
  let scrap = 0
  const share = (rate: number) => Math.round(processed * rate)
  if (seq === 10 && rng.chance(0.6)) scrap = share(rng.float(0.001, 0.005))
  if (seq === 30) {
    if (rng.chance(0.4)) reject = share(rng.float(0.001, 0.003))
    if (rng.chance(0.1)) scrap = share(0.001)
  }
  if (seq === 40) {
    if (rng.chance(0.3)) rework = share(rng.float(0.002, 0.008))
    if (rng.chance(0.2)) reject = share(0.002)
  }
  if (seq === 50) {
    if (rng.chance(0.35)) reject = share(rng.float(0.001, 0.003))
    if (rng.chance(0.06)) rework = share(0.003)
  }
  if (seq === 60 && rng.chance(0.15)) scrap = share(0.001)
  return { processed, good: Math.max(0, processed - reject - rework - scrap), reject, rework, scrap }
}

// ─── Materialize ────────────────────────────────────────────────

export interface BuiltMo {
  mo: ManufacturingOrder
  wos: WorkOrder[]
  plan: Plan
  /** Input quantity per operation sequence. */
  inputs: Record<number, number>
  /** Processed quantity per operation sequence. */
  processed: Record<number, number>
  releasedAt: number | null
  materialState: MaterialState
}

const validations = (material: MaterialState, machineNote: string, machineOk: boolean): Validation[] => {
  const notes: Record<Validation['check'], [boolean, string]> = {
    product_release: [true, 'Revision released'],
    bom: [true, 'BOM released'],
    bor: [true, 'BOR released'],
    bop: [true, `BOP released · ${OPERATIONS.length} operations`],
    material: [
      material === 'ready',
      material === 'ready'
        ? 'All materials covered'
        : material === 'partial'
          ? '1 material short'
          : '2 materials short',
    ],
    machine: [machineOk, machineNote],
    work_center: [true, `${OPERATIONS.length} work centers`],
    skills: [true, '6 skills covered'],
    quality: [true, '2 specifications'],
    work_instruction: [true, '5 instructions'],
    schedule: [true, 'Planned window valid'],
  }
  return VALIDATION_CHECKS.map((check) => ({ check, ok: notes[check][0], note: notes[check][1] }))
}

/** Released orders cycle through ready / partial / shortage per site so Material Readiness shows all three. */
const materialCursor: Record<string, number> = {}
const MATERIAL_PATTERN: MaterialState[] = ['ready', 'partial', 'shortage', 'ready', 'ready']
const nextMaterialState = (siteId: string): MaterialState => {
  const i = materialCursor[siteId] ?? 0
  materialCursor[siteId] = i + 1
  return MATERIAL_PATTERN[i % MATERIAL_PATTERN.length]!
}

/** A machine of the work center that may run the product; POL-02 never appears on work past its alarm. */
function pickMachine(
  siteId: string,
  wc: string,
  key: string,
  activeNow: boolean,
  endMs: number | null,
): string | null {
  const candidates = MACHINE_SPECS.filter((m) => {
    if (m.siteId !== siteId || m.wc !== wc) return false
    if (m.eligible.length && !m.eligible.includes(key)) return false
    if (activeNow && IDLE_NOW.has(m.code)) return false
    if (machineId(m.n) === POL_02 && (activeNow || (endMs !== null && endMs > ALARM_AT))) return false
    return true
  })
  return candidates.length ? machineId(rng.pick(candidates).n) : null
}

function build(p: Plan, seq: number): BuiltMo {
  const { req, status } = p
  const key = req.productKey
  const product = productSpec(productId(key))
  const plm = plmFor(key)
  const moId = `mo-${pad(seq)}`
  const code = `MO-2026-${pad(seq)}`
  const withWos = WITH_WOS.includes(status)
  const materialState: MaterialState =
    status === 'released'
      ? nextMaterialState(req.siteId)
      : status === 'in_progress' && p.script?.machine === 'QC-01'
        ? 'partial'
        : 'ready'
  const plannedAt = clampPast(p.createdAt + rng.int(1, 3) * HOUR)
  const releasedAt = withWos
    ? clampPast(
        Math.max(
          plannedAt + 10 * MINUTE,
          Math.min(p.plannedStart, p.actualStart0 ?? p.plannedStart) - rng.int(1, 8) * HOUR,
        ),
      )
    : null
  const releaser = 'per-pm'
  const planner = plannerFor(req.siteId)

  // Planned windows run back to back from the planned start, as the reducer lays them out.
  const planned: { start: number; end: number }[] = []
  let cursor = p.plannedStart
  for (const d of p.durs) {
    planned.push({ start: cursor, end: cursor + d })
    cursor += d
  }

  // Actual windows.
  const actual: { start: number | null; end: number | null }[] = p.durs.map(() => ({
    start: null,
    end: null,
  }))
  const allDone = status === 'completed' || status === 'closed'
  const started = p.activeState === 'in_progress' || p.activeState === 'paused' || p.activeState === 'hold'
  if (p.actualStart0 !== null) {
    let c = p.actualStart0
    p.durs.forEach((d, i) => {
      if (allDone || i < p.activeIndex) {
        actual[i] = { start: c, end: c + d * p.factor }
        c = c + d * p.factor + p.gaps[i]!
      } else if (i === p.activeIndex && started) {
        actual[i] = { start: c, end: null }
      }
    })
  }

  const moEvents: MoEvent[] = []
  const moEvent = (at: number, by: string, type: MoEvent['type'], text: string) =>
    moEvents.push({ id: `${moId}-e${moEvents.length + 1}`, at: iso(at), by, type, text })
  moEvent(p.createdAt, req.createdBy, 'manufacturing_order.created', `Created from ${req.source}`)
  const old = p.createdAt < NOW - 10 * DAY
  logEvent(
    req.siteId,
    'manufacturing_order.created',
    p.createdAt,
    req.createdBy,
    `${code} created for ${product.name} × ${req.qty}`,
    { moId },
  )
  if (status !== 'draft') {
    moEvent(plannedAt, planner, 'manufacturing_order.planned', 'Planned and validated')
    if (!old)
      logEvent(
        req.siteId,
        'manufacturing_order.planned',
        plannedAt,
        planner,
        `${code}: planned and validated`,
        { moId },
      )
  }
  if (status === 'cancelled') {
    const at = clampPast(plannedAt + rng.int(4, 30) * HOUR)
    moEvent(at, planner, 'manufacturing_order.held', 'Cancelled')
    logEvent(
      req.siteId,
      'manufacturing_order.held',
      at,
      planner,
      `${code}: cancelled, customer withdrew the order`,
      { moId },
    )
  }
  if (releasedAt !== null) {
    moEvent(
      releasedAt,
      releaser,
      'manufacturing_order.released',
      `Released with engineering snapshot ${plm.revision.rev}`,
    )
    logEvent(
      req.siteId,
      'manufacturing_order.released',
      releasedAt,
      releaser,
      `${code} released with snapshot ${plm.revision.rev}; ${p.durs.length} work orders generated`,
      { moId },
    )
  }

  const wos: WorkOrder[] = []
  const inputs: Record<number, number> = {}
  const processed: Record<number, number> = {}
  let input = req.qty
  let lastGood = 0
  let totals = { reject: 0, rework: 0, scrap: 0 }
  if (withWos) {
    plm.bop.operations.forEach((op, i) => {
      const opSpec = OPERATIONS[i]!
      const woId = `${moId.replace('mo-', 'wo-')}-${op.seq}`
      const woCode = `${code}-${op.seq}`
      const wcIdHere = wcId(req.siteId, opSpec.wc)
      const isDone = allDone || i < p.activeIndex
      const isActive = i === p.activeIndex
      let woStatus: WoStatus = 'waiting'
      if (isDone) woStatus = 'completed'
      else if (isActive) woStatus = p.activeState ?? 'ready'
      else if (status === 'released' && i === 0) woStatus = rng.chance(0.5) ? 'assigned' : 'ready'
      else if (status === 'in_progress' && i === p.activeIndex + 1 && rng.chance(0.4)) woStatus = 'assigned'
      const act = actual[i]!
      const hasStarted = act.start !== null
      const fraction = isDone
        ? 1
        : isActive && hasStarted
          ? Math.min(0.95, p.elapsed / (p.durs[i]! * p.factor)) * (p.activeState === 'hold' ? 0.6 : 1)
          : 0
      const qty = hasStarted
        ? opQty(op.seq, input, fraction)
        : { processed: 0, good: 0, reject: 0, rework: 0, scrap: 0 }
      inputs[op.seq] = input
      processed[op.seq] = qty.processed
      const needsMachine = hasStarted || woStatus === 'assigned'
      const machineId = needsMachine
        ? isActive && p.script?.machine
          ? machineByCode(req.siteId, p.script.machine)
          : pickMachine(req.siteId, opSpec.wc, key, isActive || woStatus === 'assigned', act.end)
        : null
      const refAt = act.start ?? planned[i]!.start
      const shiftId = needsMachine ? (shiftAt(shifts, refAt)?.id ?? null) : null
      const operators = needsMachine
        ? operatorsFor(req.siteId, opSpec.wc, shiftId)
            .slice(0, opSpec.operators)
            .map((o) => o.id)
        : []
      const supervisor = supervisorFor(req.siteId, shiftId)
      const operator = operators[0] ?? supervisor
      const events: WoEvent[] = []
      const woEvent = (kind: WoEventKind, at: number, by: string, text: string, q: number | null = null) =>
        events.push({ id: `${woId}-e${events.length + 1}`, at: iso(at), by, kind, text, qty: q })
      woEvent('created', releasedAt!, releaser, `Generated from ${plm.bop.code} operation ${op.seq}`)
      if (i > 0 && (isDone || isActive) && actual[i - 1]!.end !== null)
        woEvent('created', actual[i - 1]!.end!, operator, 'Ready: predecessor completed')
      if (needsMachine) {
        const assignedAt = clampPast(
          hasStarted
            ? act.start! - rng.int(10, 60) * MINUTE
            : Math.max(releasedAt! + 5 * MINUTE, refAt - rng.int(1, 12) * HOUR),
        )
        const machineCode = machineId ? machineSpec(machineId).code : null
        const text = [
          machineCode ? `machine ${machineCode}` : null,
          operators.length ? `${operators.length} operator${operators.length > 1 ? 's' : ''}` : null,
          shiftId ? `shift ${shiftId.toUpperCase()}` : null,
        ]
          .filter(Boolean)
          .join(', ')
        woEvent(
          'assigned',
          Math.max(releasedAt!, assignedAt),
          supervisor,
          `Assigned to ${text || 'resources'}`,
        )
      }
      if (hasStarted) {
        woEvent('started', act.start!, operator, 'Started')
        if (!old)
          logEvent(
            req.siteId,
            'workorder.started',
            act.start!,
            operator,
            `${woCode}: started on ${machineId ? machineSpec(machineId).code : opSpec.name}`,
            { moId, woId, machineId },
          )
        if (i === 0) {
          moEvent(act.start!, supervisor, 'manufacturing_order.started', `Started at ${op.name}`)
          if (!old)
            logEvent(
              req.siteId,
              'manufacturing_order.started',
              act.start!,
              supervisor,
              `${code}: started at ${op.name}`,
              { moId },
            )
        }
      }
      if (qty.processed > 0 && (isDone || fraction > 0.3)) {
        const at = isDone
          ? act.end! - 3 * MINUTE
          : p.activeState === 'paused'
            ? DOWN_AT - rng.int(5, 30) * MINUTE
            : clampPast(NOW - rng.int(10, 90) * MINUTE)
        const parts = [
          `${qty.good} good`,
          qty.reject ? `${qty.reject} reject` : null,
          qty.rework ? `${qty.rework} rework` : null,
          qty.scrap ? `${qty.scrap} scrap` : null,
        ]
          .filter(Boolean)
          .join(', ')
        woEvent('output', at, operator, `Output: ${parts}`, qty.processed)
        if (qty.reject)
          woEvent(
            'reject',
            at,
            operator,
            `${qty.reject} rejected: ${op.seq === 50 ? 'purity or weight out of spec' : 'surface or dimension'}`,
            qty.reject,
          )
        if (qty.scrap)
          woEvent(
            'scrap',
            at,
            operator,
            `${qty.scrap} scrapped: ${op.seq === 10 ? 'Short pour / spill' : op.seq === 60 ? 'Blister damage' : 'Crack'}`,
            qty.scrap,
          )
        if (qty.rework) woEvent('rework', at, operator, `${qty.rework} sent to rework`, qty.rework)
      }
      if (p.activeState === 'paused' && isActive) {
        woEvent('paused', DOWN_AT, operator, 'Paused: machine · POL-02 spindle vibration alarm')
        logEvent(
          req.siteId,
          'workorder.paused',
          DOWN_AT,
          operator,
          `${woCode}: paused, machine POL-02 down`,
          { moId, woId, machineId },
        )
      }
      if (p.activeState === 'hold' && isActive)
        woEvent('held', p.heldAt!, supervisor, 'Held with the manufacturing order')
      if (isDone) {
        woEvent('completed', act.end!, operator, `Completed with ${qty.good} good`, qty.good)
        if (!old)
          logEvent(
            req.siteId,
            'workorder.completed',
            act.end!,
            operator,
            `${woCode}: completed with ${qty.good} good`,
            { moId, woId, machineId },
          )
      }
      wos.push({
        id: woId,
        code: woCode,
        siteId: req.siteId,
        moId,
        operationSeq: op.seq,
        operationCode: op.code,
        operationName: op.name,
        workCenterId: wcIdHere,
        machineId,
        operatorIds: operators,
        shiftId,
        toolIds: needsMachine && op.seq === 30 ? [dieId(req.siteId, key)] : [],
        moldIds: needsMachine && op.seq === 10 ? [moldId(req.siteId, key)] : [],
        status: woStatus,
        priority: req.priority,
        plannedStart: iso(planned[i]!.start),
        plannedEnd: iso(planned[i]!.end),
        actualStart: isoOrNull(act.start),
        actualEnd: isoOrNull(act.end),
        targetQty: req.qty,
        outputQty: qty.processed,
        goodQty: qty.good,
        rejectQty: qty.reject,
        reworkQty: qty.rework,
        scrapQty: qty.scrap,
        pauseReason: p.activeState === 'paused' && isActive ? 'machine' : null,
        holdReasonId: p.activeState === 'hold' && isActive ? reason('HLD-CUS') : null,
        qualityRequired: op.qualityRequired,
        workInstructionId: op.workInstructionId,
        events: events.sort((a, b) => a.at.localeCompare(b.at)),
      })
      totals = {
        reject: totals.reject + qty.reject,
        rework: totals.rework + qty.rework,
        scrap: totals.scrap + qty.scrap,
      }
      if (isDone) {
        input = qty.good
        if (i === p.durs.length - 1) lastGood = qty.good
      }
    })
  }

  const actualEnd = allDone ? actual[actual.length - 1]!.end! : null
  const supervisorNow = supervisorFor(req.siteId, shiftAt(shifts, NOW)?.id ?? null)
  if (status === 'on_hold') {
    moEvent(
      p.heldAt!,
      supervisorNow,
      'manufacturing_order.held',
      'On hold: Customer request · awaiting revised hologram artwork',
    )
    logEvent(
      req.siteId,
      'manufacturing_order.held',
      p.heldAt!,
      supervisorNow,
      `${code}: on hold, customer request`,
      { moId },
    )
  }
  const atRisk = p.activeState === 'paused'
  if (atRisk) {
    moEvent(DOWN_AT, supervisorNow, 'manufacturing_order.held', 'At risk: POL-02 down')
    logEvent(
      req.siteId,
      'manufacturing_order.held',
      DOWN_AT,
      supervisorNow,
      `${code}: at risk, POL-02 down at Polishing`,
      { moId },
    )
  }
  if (actualEnd !== null) {
    moEvent(
      actualEnd,
      supervisorFor(req.siteId, shiftAt(shifts, actualEnd)?.id ?? null),
      'manufacturing_order.completed',
      'All operations completed',
    )
    if (!old)
      logEvent(
        req.siteId,
        'manufacturing_order.completed',
        actualEnd,
        releaser,
        `${code}: all operations completed, ${lastGood} good`,
        { moId },
      )
    if (status === 'closed') {
      const closedAt = clampPast(actualEnd + rng.int(2, 30) * HOUR)
      moEvent(closedAt, releaser, 'manufacturing_order.completed', 'Closed')
      if (!old)
        logEvent(req.siteId, 'manufacturing_order.completed', closedAt, releaser, `${code}: closed`, { moId })
    }
  }

  const snapshot: PlmSnapshot | null = withWos
    ? {
        productRevisionId: plm.revision.id,
        rev: plm.revision.rev,
        bomId: plm.bom.id,
        borId: plm.bor.id,
        bopId: plm.bop.id,
        specIds: plm.revision.specIds,
        workInstructionIds: plm.revision.workInstructionIds,
        takenAt: iso(releasedAt!),
      }
    : null
  // Validations are a snapshot from planning time; only orders planned after the POL-02 breakdown see it.
  const machineOk = !(req.siteId === SITE_JKT && plannedAt > DOWN_AT)
  const mo: ManufacturingOrder = {
    id: moId,
    code,
    siteId: req.siteId,
    productId: productId(key),
    qty: req.qty,
    uomId: 'uom-pcs',
    source: req.source,
    demandIds: req.demandIds,
    replenishmentId: req.replenishmentId,
    priority: req.priority,
    status,
    lineId: lineFor(req.siteId, key),
    plannedStart: iso(p.plannedStart),
    plannedEnd: iso(planned[planned.length - 1]!.end),
    actualStart: isoOrNull(p.actualStart0),
    actualEnd: isoOrNull(actualEnd),
    snapshot,
    validations:
      status === 'draft'
        ? []
        : validations(
            materialState,
            req.siteId === SITE_JKT
              ? machineOk
                ? '14 of 14 machines available'
                : '13 of 14 machines available'
              : '4 of 4 machines available',
            machineOk,
          ),
    goodQty: lastGood,
    rejectQty: totals.reject,
    reworkQty: totals.rework,
    scrapQty: totals.scrap,
    holdReasonId: status === 'on_hold' ? reason('HLD-CUS') : null,
    atRisk,
    atRiskReason: atRisk ? 'POL-02 down at Polishing' : '',
    events: moEvents.sort((a, b) => a.at.localeCompare(b.at)),
    createdBy: req.createdBy,
    createdAt: iso(p.createdAt),
  }
  return { mo, wos, plan: p, inputs, processed, releasedAt, materialState }
}

// ─── Assemble ───────────────────────────────────────────────────

const scripts = assignScripts(moRequests)
const plans = moRequests
  .map((req) => plan(req, scripts.get(req.key) ?? null))
  .sort((a, b) => a.createdAt - b.createdAt || a.req.key.localeCompare(b.req.key))
export const LAST_MO_SEQ = 330
const FIRST_MO_SEQ = LAST_MO_SEQ - (plans.length - 1)

export const builtMos: BuiltMo[] = plans.map((p, i) => build(p, FIRST_MO_SEQ + i))
export const manufacturingOrders: ManufacturingOrder[] = builtMos.map((b) => b.mo)
export const workOrders: WorkOrder[] = builtMos.flatMap((b) => b.wos)

/** Orders that carry work orders, material requirements and WIP. */
export const releasedMos: BuiltMo[] = builtMos.filter((b) => WITH_WOS.includes(b.mo.status))
/** Five-digit sequence shared by an order's related ids (wo-, wip-, mrq-, ...). */
export const moSeq = (b: BuiltMo) => b.mo.id.replace('mo-', '')

export const pausedWo = workOrders.find((w) => w.status === 'paused')!
export const atRiskMo = manufacturingOrders.find((m) => m.id === pausedWo.moId)!

logEvent(
  SITE_JKT,
  'machine.alarm.triggered',
  ALARM_AT,
  'system',
  'POL-02: Spindle vibration high (9.4 mm/s, limit 7.0)',
  { machineId: POL_02, woId: pausedWo.id, moId: pausedWo.moId },
)
logEvent(SITE_JKT, 'machine.downtime.started', DOWN_AT, 'system', 'POL-02 down: Spindle vibration high', {
  machineId: POL_02,
})
