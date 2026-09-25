// Engineering data: one released revision per product with BOM, BOR, BOP, specs and work instructions.
import type {
  Bom,
  BomItem,
  Bop,
  Bor,
  BorItem,
  Characteristic,
  Eco,
  InspectionPlan,
  InstructionStep,
  Operation,
  ProductRevision,
  Specification,
  WorkInstruction,
} from '../../packages/types/src/index.ts'
import { DAY, SITE_JKT, dayAt, iso, logEvent } from './common.ts'
import { dieId, eligibleMachines, jigFor, moldId } from './machines.ts'
import { PRODUCT_SPECS, productId, reason, revisionId, type ProductSpec } from './master.ts'

type SizeClass = 'small' | 'medium' | 'large'
const sizeClass = (p: ProductSpec): SizeClass =>
  p.metal === 'ag' ? 'large' : p.w <= 5 ? 'small' : p.w <= 25 ? 'medium' : 'large'

interface OpSpec {
  seq: number
  code: string
  name: string
  wc: string
  skill: string
  operators: number
  setupMin: number
  cycleSec: Record<SizeClass, number>
  queueMin: number
  transferMin: number
  reworkToSeq: number | null
  qualityRequired: boolean
  hasInstruction: boolean
}

export const OPERATIONS: OpSpec[] = [
  {
    seq: 10,
    code: 'CAST',
    name: 'Casting',
    wc: 'CAST',
    skill: 'skl-cast',
    operators: 2,
    setupMin: 30,
    cycleSec: { small: 2, medium: 4, large: 6 },
    queueMin: 15,
    transferMin: 5,
    reworkToSeq: null,
    qualityRequired: false,
    hasInstruction: true,
  },
  {
    seq: 20,
    code: 'COOL',
    name: 'Cooling',
    wc: 'COOL',
    skill: 'skl-cast',
    operators: 1,
    setupMin: 10,
    cycleSec: { small: 1.5, medium: 2, large: 3 },
    queueMin: 10,
    transferMin: 5,
    reworkToSeq: null,
    qualityRequired: false,
    hasInstruction: false,
  },
  {
    seq: 30,
    code: 'PRESS',
    name: 'Pressing',
    wc: 'PRESS',
    skill: 'skl-press',
    operators: 1,
    setupMin: 20,
    cycleSec: { small: 1.2, medium: 2.5, large: 4 },
    queueMin: 15,
    transferMin: 5,
    reworkToSeq: 30,
    qualityRequired: false,
    hasInstruction: true,
  },
  {
    seq: 40,
    code: 'POL',
    name: 'Polishing',
    wc: 'POL',
    skill: 'skl-pol',
    operators: 1,
    setupMin: 15,
    cycleSec: { small: 3, medium: 6, large: 9 },
    queueMin: 20,
    transferMin: 10,
    reworkToSeq: 40,
    qualityRequired: false,
    hasInstruction: true,
  },
  {
    seq: 50,
    code: 'QC',
    name: 'Quality control',
    wc: 'QC',
    skill: 'skl-xrf',
    operators: 1,
    setupMin: 10,
    cycleSec: { small: 0.6, medium: 4, large: 6 },
    queueMin: 15,
    transferMin: 5,
    reworkToSeq: 40,
    qualityRequired: true,
    hasInstruction: true,
  },
  {
    seq: 60,
    code: 'PACK',
    name: 'Packaging',
    wc: 'PACK',
    skill: 'skl-pack',
    operators: 2,
    setupMin: 10,
    cycleSec: { small: 2, medium: 4, large: 5 },
    queueMin: 10,
    transferMin: 10,
    reworkToSeq: null,
    qualityRequired: false,
    hasInstruction: true,
  },
]

const REV_AGE_DAYS: Record<string, number> = {
  gb05: 95,
  gb001: 48,
  gb002: 110,
  gb005: 21,
  gb010: 60,
  gb025: 130,
  gb050: 80,
  gb100: 35,
  sb100: 70,
  sb250: 100,
}

const bomId = (key: string, rev: string) => `bom-${key}-${rev.toLowerCase()}`
const borId = (key: string, rev: string) => `bor-${key}-${rev.toLowerCase()}`
const bopId = (key: string, rev: string) => `bop-${key}-${rev.toLowerCase()}`
const specId = (key: string, kind: 'prd' | 'qlt') => `spec-${key}-${kind}`
const wiId = (key: string, seq: number) => `wi-${key}-${seq}`

/** BOM/BOR/BOP revisions can drift apart from the product revision; GB-005 mirrors the blueprint. */
const DOC_REVS: Record<string, { bom: string; bor: string; bop: string }> = {
  gb005: { bom: 'R03', bor: 'R02', bop: 'R04' },
  gb001: { bom: 'R02', bor: 'R02', bop: 'R03' },
  gb100: { bom: 'R03', bor: 'R01', bop: 'R03' },
}
const docRevs = (p: ProductSpec) => DOC_REVS[p.key] ?? { bom: p.rev, bor: 'R02', bop: p.rev }

function bomItems(p: ProductSpec, id: string, castScrap: number): BomItem[] {
  const blister = p.size === 'S' ? 'mat-blister-s' : p.size === 'M' ? 'mat-blister-m' : 'mat-blister-l'
  const metal = p.metal === 'au' ? ['mat-au9999', p.w * 1.002, castScrap] : ['mat-ag999', p.w * 1.005, 0.005]
  const rows: [materialId: string, qty: number, uom: string, scrap: number, seq: number][] = [
    [metal[0] as string, metal[1] as number, 'uom-g', metal[2] as number, 10],
    ['mat-flux', Math.round(p.w * 10) / 1000, 'uom-g', 0.01, 10],
    ['mat-liner', 0.0025, 'uom-pcs', 0, 10],
    ['mat-polcmp', 0.1 + p.w * 0.02, 'uom-g', 0.02, 40],
    ['mat-solvent', 0.5, 'uom-ml', 0.05, 40],
    ...(p.serial ? [['mat-argon', 0.002, 'uom-l', 0, 40] as [string, number, string, number, number]] : []),
    [blister, 1, 'uom-pcs', 0.01, 60],
    ['mat-holo', 1, 'uom-pcs', 0.005, 60],
    ['mat-cert', 1, 'uom-pcs', 0.005, 60],
    ...(p.w >= 10 || p.metal === 'ag'
      ? [['mat-box', 1, 'uom-pcs', 0.002, 60] as [string, number, string, number, number]]
      : []),
    ['mat-carton', 0.02, 'uom-pcs', 0, 60],
  ]
  return rows.map(([materialId, qtyPerUnit, uomId, scrapFactor, consumeAtSeq], i) => ({
    id: `${id}-i${i + 1}`,
    materialId,
    qtyPerUnit: Math.round(qtyPerUnit * 10000) / 10000,
    uomId,
    scrapFactor,
    consumeAtSeq,
    substituteMaterialIds:
      materialId === 'mat-au9999' ? [] : materialId === blister && p.size === 'S' ? ['mat-blister-m'] : [],
    childBomId: null,
  }))
}

const buildBom = (
  p: ProductSpec,
  rev: string,
  state: Bom['state'],
  createdAt: number,
  castScrap = 0.003,
): Bom => {
  const id = bomId(p.key, rev)
  return {
    id,
    code: `BOM-${p.code.replace('-', '')}-${rev}`,
    productId: productId(p.key),
    rev,
    state,
    items: bomItems(p, id, castScrap),
    createdAt: iso(createdAt),
  }
}

function borItems(p: ProductSpec, id: string): BorItem[] {
  const cls = sizeClass(p)
  return OPERATIONS.map((op) => {
    const cycleSec = op.cycleSec[cls]
    return {
      id: `${id}-i${op.seq}`,
      operationSeq: op.seq,
      workCenterCode: `WC-${op.wc}`,
      machineIds: eligibleMachines(SITE_JKT, op.wc, p.key),
      toolIds: op.seq === 30 ? [dieId(SITE_JKT, p.key)] : [],
      moldIds: op.seq === 10 ? [moldId(SITE_JKT, p.key)] : [],
      fixtureIds: op.seq === 40 && jigFor(p.key) ? [jigFor(p.key)!] : [],
      utilityIds: op.seq === 10 ? ['res-utl-cw', 'res-utl-argon'] : op.seq === 30 ? ['res-utl-air'] : [],
      skillIds: op.seq === 60 ? [op.skill, 'skl-5s'] : [op.skill],
      operatorCount: op.operators,
      standardSetupMin: op.setupMin,
      standardCycleSec: cycleSec,
      laborMinPerUnit: Math.round(((cycleSec * op.operators) / 60) * 1000) / 1000,
    }
  })
}

const buildBor = (p: ProductSpec, rev: string, createdAt: number): Bor => {
  const id = borId(p.key, rev)
  return {
    id,
    code: `BOR-${p.code.replace('-', '')}-${rev}`,
    productId: productId(p.key),
    rev,
    state: 'released',
    items: borItems(p, id),
    createdAt: iso(createdAt),
  }
}

function operations(p: ProductSpec, id: string): Operation[] {
  const cls = sizeClass(p)
  return OPERATIONS.map((op, i) => ({
    id: `${id}-op${op.seq}`,
    seq: op.seq,
    code: op.code,
    name: op.name,
    workCenterCode: `WC-${op.wc}`,
    setupMin: op.setupMin,
    cycleSec: op.cycleSec[cls],
    queueMin: op.queueMin,
    transferMin: op.transferMin,
    predecessorSeqs: i === 0 ? [] : [OPERATIONS[i - 1]!.seq],
    parallel: false,
    reworkToSeq: op.reworkToSeq,
    qualityRequired: op.qualityRequired,
    workInstructionId: op.hasInstruction ? wiId(p.key, op.seq) : null,
  }))
}

const buildBop = (p: ProductSpec, rev: string, createdAt: number): Bop => {
  const id = bopId(p.key, rev)
  return {
    id,
    code: `BOP-${p.code.replace('-', '')}-${rev}`,
    productId: productId(p.key),
    rev,
    state: 'released',
    operations: operations(p, id),
    createdAt: iso(createdAt),
  }
}

function dims(p: ProductSpec): [length: number, width: number, thickness: number] {
  const table: Record<string, [number, number, number]> = {
    gb05: [8.1, 4.8, 0.65],
    gb001: [10.2, 6.1, 0.72],
    gb002: [14.0, 8.2, 0.9],
    gb005: [18.5, 10.8, 1.2],
    gb010: [24.0, 14.0, 1.5],
    gb025: [32.0, 18.6, 2.1],
    gb050: [41.0, 24.0, 2.6],
    gb100: [49.0, 28.5, 3.7],
    sb100: [52.0, 30.0, 6.1],
    sb250: [70.0, 40.0, 8.5],
  }
  return table[p.key]!
}

function buildSpecs(p: ProductSpec, createdAt: number): Specification[] {
  const tol = Math.max(0.01, Math.round(p.w * 0.002 * 1000) / 1000)
  const [L, W, T] = dims(p)
  const num = (
    id: string,
    name: string,
    target: number,
    tolerance: number,
    unit: string,
    method: string,
    operationSeq: number,
  ): Characteristic => ({
    id,
    name,
    type: 'numeric',
    target,
    min: Math.round((target - tolerance) * 1000) / 1000,
    max: Math.round((target + tolerance) * 1000) / 1000,
    unit,
    method,
    operationSeq,
  })
  const prd = specId(p.key, 'prd')
  const qlt = specId(p.key, 'qlt')
  const purity = p.metal === 'au' ? [99.99, 99.98] : [99.9, 99.85]
  return [
    {
      id: prd,
      code: `SPEC-${p.code.replace('-', '')}-PRD`,
      productId: productId(p.key),
      rev: 'R01',
      kind: 'product',
      state: 'released',
      characteristics: [
        num(`${prd}-c1`, 'Net weight', p.w, tol, 'g', 'Analytical balance 0.001 g', 30),
        num(`${prd}-c2`, 'Length', L, 0.1, 'mm', 'Calliper', 30),
        num(`${prd}-c3`, 'Width', W, 0.1, 'mm', 'Calliper', 30),
        num(`${prd}-c4`, 'Thickness', T, 0.05, 'mm', 'Micrometer', 30),
      ],
      createdAt: iso(createdAt),
    },
    {
      id: qlt,
      code: `SPEC-${p.code.replace('-', '')}-QLT`,
      productId: productId(p.key),
      rev: 'R02',
      kind: 'quality',
      state: 'released',
      characteristics: [
        {
          id: `${qlt}-c1`,
          name: 'Purity',
          type: 'numeric',
          target: purity[0]!,
          min: purity[1]!,
          max: null,
          unit: '%',
          method: 'XRF analyser XA-01, 3 readings',
          operationSeq: 50,
        },
        {
          id: `${qlt}-c2`,
          name: 'Surface finish',
          type: 'visual',
          target: null,
          min: null,
          max: null,
          unit: '',
          method: 'Visual under 10x loupe, D65 light',
          operationSeq: 40,
        },
        num(`${qlt}-c3`, 'Net weight', p.w, tol, 'g', 'Analytical balance 0.001 g', 30),
        {
          id: `${qlt}-c4`,
          name: 'Hologram seal present',
          type: 'pass_fail',
          target: null,
          min: null,
          max: null,
          unit: '',
          method: 'Visual check per blister',
          operationSeq: 60,
        },
        {
          id: `${qlt}-c5`,
          name: 'Mold fill',
          type: 'visual',
          target: null,
          min: null,
          max: null,
          unit: '',
          method: 'First-shot visual, all cavities filled',
          operationSeq: 10,
        },
      ],
      createdAt: iso(createdAt),
    },
  ]
}

function steps(p: ProductSpec, seq: number, id: string): InstructionStep[] {
  const s = (
    kind: InstructionStep['kind'],
    title: string,
    body: string,
    items: string[] = [],
    attachment: string | null = null,
  ): Omit<InstructionStep, 'id'> => ({ kind, title, body, items, attachment })
  const key = p.code.toLowerCase().replace('-', '')
  const table: Record<number, Omit<InstructionStep, 'id'>[]> = {
    10: [
      s(
        'safety',
        'PPE and furnace zone',
        'Face shield, heat gloves and apron are mandatory inside the yellow line. Confirm the argon purge valve is open before charging.',
      ),
      s(
        'setup',
        'Mold and furnace setup',
        `Fit graphite mold MLD-${p.code}, preheat to 180 °C. Set melt temperature to ${p.metal === 'au' ? '1080' : '1000'} °C.`,
      ),
      s('checklist', 'Pre-pour checks', 'Tick every line before the first pour.', [
        'Crucible liner inspected, no cracks',
        'Flux dosed per BOM',
        'Mold cavities clean and dry',
        'Scale tared, weigh sheet ready',
      ]),
      s(
        'text',
        'Pouring',
        `Pour in one continuous motion per cavity. Log every shot on the weigh sheet. Reject shots below ${p.w} g net before cooling.`,
      ),
      s('image', 'Reference pour', 'Correct meniscus after the pour.', [], `cast-${key}-pour.png`),
    ],
    30: [
      s(
        'setup',
        'Die change',
        `Mount press die DIE-${p.code}, torque to 45 Nm. Run three blank strokes and check alignment with the gauge.`,
      ),
      s('checklist', 'First-piece approval', 'Supervisor signs before series production.', [
        'Weight within tolerance',
        'Relief sharp, no double strike',
        'Edge free of burr',
      ]),
      s(
        'text',
        'Series pressing',
        'Feed blanks one at a time; never reach into the die area while the ram is enabled.',
      ),
    ],
    40: [
      s(
        'text',
        'Compound and cycle',
        `Dose polishing compound per BOM and run the ${sizeClass(p) === 'small' ? '12' : '20'} minute cycle. Rinse with cleaning solvent and dry with lint-free cloth.`,
      ),
      s('checklist', 'Surface check', 'Inspect under the loupe before releasing the batch.', [
        'No scratches on the obverse',
        'No compound residue in the relief',
        'No discoloration',
      ]),
      s('image', 'Acceptable finish', 'Mirror finish reference sample.', [], `polish-${key}-reference.png`),
    ],
    50: [
      s(
        'text',
        'XRF procedure',
        `Calibrate XA-01 with the ${p.metal === 'au' ? 'Au 99.99' : 'Ag 99.9'} reference standard. Take three readings per sample and record the mean.`,
      ),
      s('checklist', 'Sample handling', 'Handle samples with tweezers only.', [
        'Sample size per inspection plan',
        'Weight recorded to 0.001 g',
        'Result entered before disposition',
      ]),
      s('pdf', 'Analyser manual', 'XRF analyser operating procedure.', [], 'sop-qc-xrf-v3.pdf'),
    ],
    60: [
      s('checklist', 'Blister assembly', 'Per piece, in this order.', [
        'Certificate card serial matches bar',
        'Bar seated in blister',
        'Hologram seal applied over the seam',
        p.w >= 10 || p.metal === 'ag' ? 'Retail box closed and labelled' : 'Blister stacked 50 per carton',
      ]),
      s(
        'text',
        'Carton labelling',
        'Print the carton label from the MO screen and scan it before moving the carton to FG-01.',
      ),
      s('image', 'Seal position', 'Hologram seal position reference.', [], `pack-${key}-seal.png`),
    ],
  }
  return (table[seq] ?? []).map((step, i) => ({ id: `${id}-s${i + 1}`, ...step }))
}

const buildInstructions = (p: ProductSpec, createdAt: number): WorkInstruction[] =>
  OPERATIONS.filter((op) => op.hasInstruction).map((op) => {
    const id = wiId(p.key, op.seq)
    return {
      id,
      code: `WI-${p.code.replace('-', '')}-${op.seq}`,
      productId: productId(p.key),
      operationSeq: op.seq,
      rev: 'R01',
      state: 'released',
      title: `${op.name} ${p.name}`,
      steps: steps(p, op.seq, id),
      createdAt: iso(createdAt),
    }
  })

// ─── Assemble ───────────────────────────────────────────────────

export const productRevisions: ProductRevision[] = []
export const boms: Bom[] = []
export const bors: Bor[] = []
export const bops: Bop[] = []
export const specifications: Specification[] = []
export const workInstructions: WorkInstruction[] = []

const revision = (
  p: ProductSpec,
  rev: string,
  state: ProductRevision['state'],
  docs: { bom: string; bor: string; bop: string },
  effectiveFrom: number | null,
  effectiveUntil: number | null,
  createdAt: number,
  changeReason: string,
): ProductRevision => ({
  id: revisionId(p.key, rev),
  productId: productId(p.key),
  rev,
  state,
  bomId: bomId(p.key, docs.bom),
  borId: borId(p.key, docs.bor),
  bopId: bopId(p.key, docs.bop),
  specIds: [specId(p.key, 'prd'), specId(p.key, 'qlt')],
  workInstructionIds: OPERATIONS.filter((op) => op.hasInstruction).map((op) => wiId(p.key, op.seq)),
  effectiveFrom: effectiveFrom === null ? null : iso(effectiveFrom),
  effectiveUntil: effectiveUntil === null ? null : iso(effectiveUntil),
  releasedAt: state === 'released' || state === 'obsolete' ? iso(effectiveFrom!) : null,
  releasedBy: state === 'released' || state === 'obsolete' ? 'per-engineer' : null,
  changeReason,
  createdAt: iso(createdAt),
})

for (const p of PRODUCT_SPECS) {
  const docs = docRevs(p)
  const effective = dayAt(-REV_AGE_DAYS[p.key]!, 8)
  const created = effective - 7 * DAY
  productRevisions.push(
    revision(
      p,
      p.rev,
      'released',
      docs,
      effective,
      null,
      created,
      p.rev === 'R02'
        ? 'Packaging update and cycle time review'
        : 'Scrap factor and polishing compound dose updated',
    ),
  )
  boms.push(buildBom(p, docs.bom, 'released', created))
  bors.push(buildBor(p, docs.bor, created))
  bops.push(buildBop(p, docs.bop, created))
  specifications.push(...buildSpecs(p, created))
  workInstructions.push(...buildInstructions(p, created))
}

// Older revisions that the ECO history obsoleted.
const gb001 = PRODUCT_SPECS.find((p) => p.key === 'gb001')!
const gb005 = PRODUCT_SPECS.find((p) => p.key === 'gb005')!
const gb001Effective = dayAt(-REV_AGE_DAYS.gb001!, 8)
const gb005Effective = dayAt(-REV_AGE_DAYS.gb005!, 8)
productRevisions.push(
  revision(
    gb001,
    'R01',
    'obsolete',
    { bom: 'R01', bor: 'R02', bop: 'R03' },
    gb001Effective - 200 * DAY,
    gb001Effective,
    gb001Effective - 210 * DAY,
    'Initial release',
  ),
)
boms.push(buildBom(gb001, 'R01', 'obsolete', gb001Effective - 210 * DAY, 0.005))
productRevisions.push(
  revision(
    gb005,
    'R02',
    'obsolete',
    { bom: 'R02', bor: 'R02', bop: 'R04' },
    gb005Effective - 150 * DAY,
    gb005Effective,
    gb005Effective - 160 * DAY,
    'Cycle time review',
  ),
)
boms.push(buildBom(gb005, 'R02', 'obsolete', gb005Effective - 160 * DAY, 0.005))
// Draft next revision for GB-005, tied to the ECO in review.
productRevisions.push(
  revision(
    gb005,
    'R04',
    'draft',
    { bom: 'R04', bor: 'R02', bop: 'R04' },
    null,
    null,
    dayAt(-6, 10),
    'Reduce scrap factor on casting',
  ),
)
boms.push(buildBom(gb005, 'R04', 'draft', dayAt(-6, 10), 0.002))

export const ecos: Eco[] = [
  {
    id: 'eco-00031',
    code: 'ECO-00031',
    title: 'Switch blister card supplier',
    productId: productId('gb001'),
    fromRevisionId: revisionId('gb001', 'R01'),
    toRevisionId: revisionId('gb001', 'R02'),
    reasonCodeId: reason('CHG-SUP'),
    description:
      'Blister card BLS-S sourced from PT Kemasan Aman Sejahtera; artwork updated with the new hologram window.',
    status: 'released',
    affects: ['bom', 'work_instruction'],
    requestedBy: 'per-engineer',
    requestedAt: iso(gb001Effective - 20 * DAY),
    effectiveFrom: iso(gb001Effective),
    approvals: [
      {
        by: 'per-pm',
        at: iso(gb001Effective - 12 * DAY),
        decision: 'approved',
        note: 'Cost neutral, approved.',
      },
      {
        by: 'per-quality',
        at: iso(gb001Effective - 11 * DAY),
        decision: 'approved',
        note: 'Seal test passed.',
      },
    ],
    releasedAt: iso(gb001Effective),
  },
  {
    id: 'eco-00032',
    code: 'ECO-00032',
    title: 'Polishing compound dose for 5g bar',
    productId: productId('gb005'),
    fromRevisionId: revisionId('gb005', 'R02'),
    toRevisionId: revisionId('gb005', 'R03'),
    reasonCodeId: reason('CHG-QLT'),
    description:
      'Dose raised from 0.15 g to 0.2 g per piece after discoloration complaints; BOP cycle time reviewed.',
    status: 'released',
    affects: ['bom', 'bop'],
    requestedBy: 'per-engineer',
    requestedAt: iso(gb005Effective - 15 * DAY),
    effectiveFrom: iso(gb005Effective),
    approvals: [
      {
        by: 'per-pm',
        at: iso(gb005Effective - 6 * DAY),
        decision: 'approved',
        note: 'Approved after trial batch.',
      },
    ],
    releasedAt: iso(gb005Effective),
  },
  {
    id: 'eco-00033',
    code: 'ECO-00033',
    title: 'Reduce scrap factor on casting',
    productId: productId('gb005'),
    fromRevisionId: revisionId('gb005', 'R03'),
    toRevisionId: revisionId('gb005', 'R04'),
    reasonCodeId: reason('CHG-COST'),
    description:
      'Casting yield on IC-01 has held above 99.8% for six weeks; scrap factor on AU-9999 drops from 0.3% to 0.2%.',
    status: 'review',
    affects: ['bom'],
    requestedBy: 'per-engineer',
    requestedAt: iso(dayAt(-6, 10)),
    effectiveFrom: null,
    approvals: [],
    releasedAt: null,
  },
  {
    id: 'eco-00034',
    code: 'ECO-00034',
    title: 'Add QR code on certificate card',
    productId: productId('gb025'),
    fromRevisionId: revisionId('gb025', 'R02'),
    toRevisionId: null,
    reasonCodeId: reason('CHG-REG'),
    description: 'Certificate card to carry a QR code linking to the serial verification page.',
    status: 'draft',
    affects: ['bom', 'work_instruction', 'spec'],
    requestedBy: 'per-engineer',
    requestedAt: iso(dayAt(-2, 14)),
    effectiveFrom: null,
    approvals: [],
    releasedAt: null,
  },
  {
    id: 'eco-00035',
    code: 'ECO-00035',
    title: 'Replace retail box with wooden case',
    productId: productId('gb100'),
    fromRevisionId: revisionId('gb100', 'R03'),
    toRevisionId: null,
    reasonCodeId: reason('CHG-COST'),
    description: 'Marketing proposal for a wooden presentation case on the 100g bar.',
    status: 'rejected',
    affects: ['bom'],
    requestedBy: 'per-marketing',
    requestedAt: iso(dayAt(-18, 9)),
    effectiveFrom: null,
    approvals: [
      {
        by: 'per-pm',
        at: iso(dayAt(-14, 16)),
        decision: 'rejected',
        note: 'Unit cost up 38%; revisit with a supplier quote.',
      },
    ],
    releasedAt: null,
  },
  {
    id: 'eco-00036',
    code: 'ECO-00036',
    title: 'Increase polishing compound dose on silver',
    productId: productId('sb100'),
    fromRevisionId: revisionId('sb100', 'R02'),
    toRevisionId: null,
    reasonCodeId: reason('CHG-QLT'),
    description: 'Silver 100g shows haze after polishing; compound dose up 20%, cycle unchanged.',
    status: 'approved',
    affects: ['bom'],
    requestedBy: 'per-engineer',
    requestedAt: iso(dayAt(-9, 11)),
    effectiveFrom: null,
    approvals: [
      {
        by: 'per-pm',
        at: iso(dayAt(-4, 15)),
        decision: 'approved',
        note: 'Approved, release with the next silver run.',
      },
    ],
    releasedAt: null,
  },
]

for (const eco of ecos)
  if (eco.releasedAt)
    logEvent(
      SITE_JKT,
      'eco.released',
      Date.parse(eco.releasedAt),
      'per-engineer',
      `${eco.code} released for ${PRODUCT_SPECS.find((p) => productId(p.key) === eco.productId)!.code}; running orders keep their snapshot`,
    )

export const inspectionPlans: InspectionPlan[] = PRODUCT_SPECS.flatMap((p) => [
  {
    id: `ip-${p.key}-10`,
    code: `IP-${p.code.replace('-', '')}-10`,
    productId: productId(p.key),
    operationSeq: 10,
    trigger: 'start' as const,
    specId: specId(p.key, 'qlt'),
    sampleSize: 5,
    every: 1,
  },
  {
    id: `ip-${p.key}-40`,
    code: `IP-${p.code.replace('-', '')}-40`,
    productId: productId(p.key),
    operationSeq: 40,
    trigger: 'batch' as const,
    specId: specId(p.key, 'qlt'),
    sampleSize: p.serial ? 20 : 10,
    every: 1,
  },
  {
    id: `ip-${p.key}-50`,
    code: `IP-${p.code.replace('-', '')}-50`,
    productId: productId(p.key),
    operationSeq: 50,
    trigger: 'end' as const,
    specId: specId(p.key, 'qlt'),
    sampleSize: p.serial ? 20 : 5,
    every: 1,
  },
])

// ─── Lookups for downstream modules ─────────────────────────────

export interface Plm {
  revision: ProductRevision
  bom: Bom
  bor: Bor
  bop: Bop
  qualitySpec: Specification
}

export function plmFor(key: string): Plm {
  const revision = productRevisions.find((r) => r.productId === productId(key) && r.state === 'released')!
  return {
    revision,
    bom: boms.find((b) => b.id === revision.bomId)!,
    bor: bors.find((b) => b.id === revision.borId)!,
    bop: bops.find((b) => b.id === revision.bopId)!,
    qualitySpec: specifications.find((s) => s.id === specId(key, 'qlt'))!,
  }
}
