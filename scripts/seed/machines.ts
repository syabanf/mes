// Machines with their canonical integration ids, and the tooling and utility resources.
import type { Machine, Resource, ResourceKind } from '../../packages/types/src/index.ts'
import { NOW, SITE_JKT, SITE_SBY, iso, lineId, pad, wcId } from './common.ts'
import { PRODUCT_SPECS, SBY_PRODUCT_KEYS, productId } from './master.ts'
import { rng } from './rng.ts'

export interface MachineSpec {
  n: number
  siteId: string
  code: string
  name: string
  wc: string
  line: string
  model: string
  /** Product keys the machine may run; empty means any. */
  eligible: string[]
}

const SMALL = PRODUCT_SPECS.filter((p) => p.metal === 'au' && p.w <= 5).map((p) => p.key)
const LARGE = PRODUCT_SPECS.filter((p) => p.metal === 'ag' || p.w > 5).map((p) => p.key)

export const MACHINE_SPECS: MachineSpec[] = [
  {
    n: 1,
    siteId: SITE_JKT,
    code: 'CAST-01',
    name: 'Induction casting furnace IC-01',
    wc: 'CAST',
    line: 'line-a',
    model: 'Indutherm VC 3000',
    eligible: SMALL,
  },
  {
    n: 2,
    siteId: SITE_JKT,
    code: 'CAST-02',
    name: 'Induction casting furnace IC-02',
    wc: 'CAST',
    line: 'line-b',
    model: 'Indutherm VC 6000',
    eligible: LARGE,
  },
  {
    n: 3,
    siteId: SITE_JKT,
    code: 'COOL-01',
    name: 'Cooling tunnel CT-01',
    wc: 'COOL',
    line: 'line-a',
    model: 'Aichelin CT-8',
    eligible: [],
  },
  {
    n: 4,
    siteId: SITE_JKT,
    code: 'PRESS-01',
    name: 'Hydraulic minting press HP-01',
    wc: 'PRESS',
    line: 'line-fin',
    model: 'Schuler MRV 150',
    eligible: SMALL,
  },
  {
    n: 5,
    siteId: SITE_JKT,
    code: 'PRESS-02',
    name: 'Hydraulic minting press HP-02',
    wc: 'PRESS',
    line: 'line-fin',
    model: 'Schuler MRV 300',
    eligible: [],
  },
  {
    n: 6,
    siteId: SITE_JKT,
    code: 'PRESS-03',
    name: 'Hydraulic minting press HP-03',
    wc: 'PRESS',
    line: 'line-fin',
    model: 'Gräbener GMP 360',
    eligible: LARGE,
  },
  {
    n: 7,
    siteId: SITE_JKT,
    code: 'POL-01',
    name: 'Polishing machine PL-01',
    wc: 'POL',
    line: 'line-fin',
    model: 'Otec CF 1x18',
    eligible: [],
  },
  {
    n: 8,
    siteId: SITE_JKT,
    code: 'POL-02',
    name: 'Polishing machine PL-02',
    wc: 'POL',
    line: 'line-fin',
    model: 'Otec CF 1x18',
    eligible: [],
  },
  {
    n: 9,
    siteId: SITE_JKT,
    code: 'POL-03',
    name: 'Polishing machine PL-03',
    wc: 'POL',
    line: 'line-fin',
    model: 'Otec CF 2x32',
    eligible: [],
  },
  {
    n: 10,
    siteId: SITE_JKT,
    code: 'POL-04',
    name: 'Polishing machine PL-04',
    wc: 'POL',
    line: 'line-fin',
    model: 'Otec CF 2x32',
    eligible: [],
  },
  {
    n: 11,
    siteId: SITE_JKT,
    code: 'ENG-01',
    name: 'Laser engraver LE-01',
    wc: 'ENG',
    line: 'line-fin',
    model: 'Trumpf TruMark 5020',
    eligible: [],
  },
  {
    n: 12,
    siteId: SITE_JKT,
    code: 'ENG-02',
    name: 'Laser engraver LE-02',
    wc: 'ENG',
    line: 'line-fin',
    model: 'Trumpf TruMark 5020',
    eligible: [],
  },
  {
    n: 13,
    siteId: SITE_JKT,
    code: 'QC-01',
    name: 'XRF analyser XA-01',
    wc: 'QC',
    line: 'line-qc',
    model: 'Fischerscope X-RAY XAN 250',
    eligible: [],
  },
  {
    n: 14,
    siteId: SITE_JKT,
    code: 'PACK-01',
    name: 'Blister packing line BP-01',
    wc: 'PACK',
    line: 'line-pack',
    model: 'Uhlmann B 1240',
    eligible: [],
  },
  {
    n: 15,
    siteId: SITE_JKT,
    code: 'PACK-02',
    name: 'Blister packing line BP-02',
    wc: 'PACK',
    line: 'line-pack',
    model: 'Uhlmann B 1240',
    eligible: [],
  },
  {
    n: 16,
    siteId: SITE_SBY,
    code: 'CAST-01',
    name: 'Induction casting furnace IC-01',
    wc: 'CAST',
    line: 'line-a',
    model: 'Indutherm VC 3000',
    eligible: [],
  },
  {
    n: 17,
    siteId: SITE_SBY,
    code: 'PRESS-01',
    name: 'Hydraulic minting press HP-01',
    wc: 'PRESS',
    line: 'line-fin',
    model: 'Schuler MRV 150',
    eligible: [],
  },
  {
    n: 18,
    siteId: SITE_SBY,
    code: 'POL-01',
    name: 'Polishing machine PL-01',
    wc: 'POL',
    line: 'line-fin',
    model: 'Otec CF 1x18',
    eligible: [],
  },
  {
    n: 19,
    siteId: SITE_SBY,
    code: 'PACK-01',
    name: 'Blister packing line BP-01',
    wc: 'PACK',
    line: 'line-pack',
    model: 'Uhlmann B 1240',
    eligible: [],
  },
]

export const machineId = (n: number) => `MACHINE-${pad(n)}`
export const machineByCode = (siteId: string, code: string): string =>
  machineId(MACHINE_SPECS.find((m) => m.siteId === siteId && m.code === code)!.n)
export const POL_02 = machineByCode(SITE_JKT, 'POL-02')
export const PRESS_01 = machineByCode(SITE_JKT, 'PRESS-01')
export const machineSpec = (id: string): MachineSpec => MACHINE_SPECS.find((m) => machineId(m.n) === id)!

/** Machines at a site and work center that may run a product. */
export const eligibleMachines = (siteId: string, wc: string, key: string): string[] =>
  MACHINE_SPECS.filter(
    (m) => m.siteId === siteId && m.wc === wc && (m.eligible.length === 0 || m.eligible.includes(key)),
  ).map((m) => machineId(m.n))

/** Base rows; state, maintenanceState and telemetry are patched once work orders and telemetry exist. */
export const machines: Machine[] = MACHINE_SPECS.map((m) => ({
  id: machineId(m.n),
  code: m.code,
  name: m.name,
  workCenterId: wcId(m.siteId, m.wc),
  lineId: lineId(m.siteId, m.line),
  model: m.model,
  state: 'idle',
  maintenanceState: 'available',
  eligibleProductIds: m.eligible.map(productId),
  telemetry: {
    at: iso(NOW),
    temperatureC: null,
    speedRpm: null,
    currentA: null,
    pressureBar: null,
    vibrationMmS: null,
    counter: 0,
    alarm: null,
  },
  active: true,
}))

// ─── Resources ──────────────────────────────────────────────────

const CAVITIES: Record<string, number> = {
  gb05: 40,
  gb001: 40,
  gb002: 30,
  gb005: 24,
  gb010: 20,
  gb025: 16,
  gb050: 12,
  gb100: 10,
  sb100: 12,
  sb250: 10,
}

export const moldId = (siteId: string, key: string) =>
  siteId === SITE_JKT ? `res-mold-${key}` : `res-mold-sby-${key}`
export const dieId = (siteId: string, key: string) =>
  siteId === SITE_JKT ? `res-die-${key}` : `res-die-sby-${key}`
export const jigFor = (key: string): string | null => {
  const spec = PRODUCT_SPECS.find((p) => p.key === key)!
  return spec.serial ? (spec.w >= 100 ? 'res-jig-l' : 'res-jig-m') : null
}

const res = (
  id: string,
  code: string,
  name: string,
  kind: ResourceKind,
  workCenterId: string | null,
  cavities: number | null,
  lifeLimit: number | null,
): Resource => ({
  id,
  code,
  name,
  kind,
  workCenterId,
  status: 'available',
  cavities,
  usageCount: lifeLimit ? rng.int(Math.round(lifeLimit * 0.05), Math.round(lifeLimit * 0.8)) : 0,
  lifeLimit,
})

/** Base rows; status flips to in_use where a running work order references the resource. */
export const resources: Resource[] = [
  ...PRODUCT_SPECS.map((p) =>
    res(
      moldId(SITE_JKT, p.key),
      `MLD-${p.code}`,
      `Graphite mold ${p.name} (${CAVITIES[p.key]} cav)`,
      'mold',
      wcId(SITE_JKT, 'CAST'),
      CAVITIES[p.key]!,
      2000,
    ),
  ),
  ...PRODUCT_SPECS.map((p) =>
    res(
      dieId(SITE_JKT, p.key),
      `DIE-${p.code}`,
      `Press die ${p.name}`,
      'tool',
      wcId(SITE_JKT, 'PRESS'),
      null,
      500000,
    ),
  ),
  ...SBY_PRODUCT_KEYS.map((key) => {
    const p = PRODUCT_SPECS.find((s) => s.key === key)!
    return res(
      moldId(SITE_SBY, key),
      `MLD-${p.code}-S`,
      `Graphite mold ${p.name} (${CAVITIES[key]} cav)`,
      'mold',
      wcId(SITE_SBY, 'CAST'),
      CAVITIES[key]!,
      2000,
    )
  }),
  ...SBY_PRODUCT_KEYS.map((key) => {
    const p = PRODUCT_SPECS.find((s) => s.key === key)!
    return res(
      dieId(SITE_SBY, key),
      `DIE-${p.code}-S`,
      `Press die ${p.name}`,
      'tool',
      wcId(SITE_SBY, 'PRESS'),
      null,
      500000,
    )
  }),
  res('res-jig-m', 'JIG-M', 'Engraving jig 25-50g', 'fixture', wcId(SITE_JKT, 'ENG'), null, null),
  res('res-jig-l', 'JIG-L', 'Engraving jig 100g+', 'fixture', wcId(SITE_JKT, 'ENG'), null, null),
  res('res-jig-s', 'JIG-S', 'Engraving jig small bars', 'fixture', wcId(SITE_JKT, 'ENG'), null, null),
  res('res-utl-air', 'UTL-AIR', 'Compressed air 7 bar', 'utility', null, null, null),
  res('res-utl-cw', 'UTL-CW', 'Cooling water loop', 'utility', null, null, null),
  res('res-utl-argon', 'UTL-ARG', 'Argon supply', 'utility', null, null, null),
]
