// Skills, shifts and the workforce, including the fixed demo accounts the login page references.
import type { LoginMethod, Person, Role, Shift, Skill, SkillLevel } from '../../packages/types/src/index.ts'
import { SITE_JKT, SITE_SBY, wcId } from './common.ts'
import { rng } from './rng.ts'

export const skills: Skill[] = [
  { id: 'skl-cast', code: 'CAST', name: 'Casting' },
  { id: 'skl-press', code: 'PRESS', name: 'Pressing' },
  { id: 'skl-pol', code: 'POL', name: 'Polishing' },
  { id: 'skl-eng', code: 'ENG', name: 'Laser engraving' },
  { id: 'skl-xrf', code: 'XRF', name: 'XRF analysis' },
  { id: 'skl-pack', code: 'PACK', name: 'Packing' },
  { id: 'skl-fork', code: 'FORK', name: 'Forklift' },
  { id: 'skl-5s', code: '5S', name: '5S housekeeping' },
]

export const shifts: Shift[] = [
  {
    id: 'sh-1',
    code: 'SH-1',
    name: 'Pagi',
    start: '07:00',
    end: '15:00',
    days: [1, 2, 3, 4, 5, 6],
    breakMin: 45,
  },
  {
    id: 'sh-2',
    code: 'SH-2',
    name: 'Siang',
    start: '15:00',
    end: '23:00',
    days: [1, 2, 3, 4, 5, 6],
    breakMin: 45,
  },
  {
    id: 'sh-3',
    code: 'SH-3',
    name: 'Malam',
    start: '23:00',
    end: '07:00',
    days: [1, 2, 3, 4, 5, 6],
    breakMin: 45,
  },
]

/** Shift running at fixture time (09:41). */
export const CURRENT_SHIFT = 'sh-1'

const PALETTE = [
  '#2563eb',
  '#db2777',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#dc2626',
  '#65a30d',
  '#9333ea',
  '#ea580c',
  '#0d9488',
  '#4f46e5',
]

/** Work-center code → skill that qualifies an operator for it. */
const WC_SKILL: Record<string, string> = {
  CAST: 'skl-cast',
  COOL: 'skl-cast',
  PRESS: 'skl-press',
  POL: 'skl-pol',
  ENG: 'skl-eng',
  QC: 'skl-xrf',
  PACK: 'skl-pack',
}

interface PersonSpec {
  id?: string
  name: string
  role: Role
  sites: string[]
  shift: string | null
  /** Work-center codes the person runs. */
  wcs: string[]
  leave?: boolean
}

const JKT: PersonSpec[] = [
  { id: 'per-admin', name: 'Ratna Dewi', role: 'admin', sites: [SITE_JKT, SITE_SBY], shift: null, wcs: [] },
  {
    id: 'per-pm',
    name: 'Bambang Wijaya',
    role: 'production_manager',
    sites: [SITE_JKT, SITE_SBY],
    shift: null,
    wcs: [],
  },
  {
    id: 'per-planner',
    name: 'Sari Kusuma',
    role: 'planner',
    sites: [SITE_JKT, SITE_SBY],
    shift: null,
    wcs: [],
  },
  {
    id: 'per-supervisor',
    name: 'Dimas Pratama',
    role: 'supervisor',
    sites: [SITE_JKT],
    shift: 'sh-1',
    wcs: ['CAST', 'COOL', 'PRESS', 'POL', 'ENG', 'PACK'],
  },
  {
    id: 'per-teguh',
    name: 'Teguh Santoso',
    role: 'supervisor',
    sites: [SITE_JKT],
    shift: 'sh-2',
    wcs: ['CAST', 'COOL', 'PRESS', 'POL', 'ENG', 'PACK'],
  },
  {
    id: 'per-wahyu',
    name: 'Wahyu Saputra',
    role: 'supervisor',
    sites: [SITE_JKT],
    shift: 'sh-3',
    wcs: ['CAST', 'COOL', 'PRESS', 'POL', 'PACK'],
  },
  {
    id: 'per-operator',
    name: 'Yusuf Hidayat',
    role: 'operator',
    sites: [SITE_JKT],
    shift: 'sh-1',
    wcs: ['CAST', 'COOL'],
  },
  { name: 'Agus Setiawan', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['CAST'] },
  { name: 'Budi Santoso', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['PRESS'] },
  { name: 'Cahyo Nugroho', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['POL'] },
  { name: 'Dedi Kurniawan', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['POL', 'ENG'] },
  { name: 'Eko Prasetyo', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['PACK'] },
  { name: 'Fitri Handayani', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['QC', 'PACK'] },
  { name: 'Slamet Riyadi', role: 'operator', sites: [SITE_JKT], shift: 'sh-1', wcs: ['PRESS', 'CAST'] },
  { name: 'Gilang Ramadhan', role: 'operator', sites: [SITE_JKT], shift: 'sh-2', wcs: ['CAST'] },
  { name: 'Hadi Wibowo', role: 'operator', sites: [SITE_JKT], shift: 'sh-2', wcs: ['COOL', 'PRESS'] },
  { name: 'Indra Lesmana', role: 'operator', sites: [SITE_JKT], shift: 'sh-2', wcs: ['PRESS'] },
  { name: 'Joko Susilo', role: 'operator', sites: [SITE_JKT], shift: 'sh-2', wcs: ['POL'] },
  { name: 'Kartika Sari', role: 'operator', sites: [SITE_JKT], shift: 'sh-2', wcs: ['PACK', 'QC'] },
  { name: 'Lukman Hakim', role: 'operator', sites: [SITE_JKT], shift: 'sh-2', wcs: ['ENG', 'POL'] },
  {
    name: 'Made Wirawan',
    role: 'operator',
    sites: [SITE_JKT],
    shift: 'sh-3',
    wcs: ['CAST', 'COOL'],
    leave: true,
  },
  { name: 'Nanda Putra', role: 'operator', sites: [SITE_JKT], shift: 'sh-3', wcs: ['PRESS', 'COOL'] },
  { name: 'Oki Firmansyah', role: 'operator', sites: [SITE_JKT], shift: 'sh-3', wcs: ['POL'] },
  { name: 'Putri Ayu', role: 'operator', sites: [SITE_JKT], shift: 'sh-3', wcs: ['PACK', 'QC'] },
  {
    name: 'Rahmat Hidayat',
    role: 'operator',
    sites: [SITE_JKT],
    shift: 'sh-3',
    wcs: ['ENG', 'PACK', 'CAST'],
  },
  {
    id: 'per-quality',
    name: 'Rina Anggraini',
    role: 'quality',
    sites: [SITE_JKT],
    shift: 'sh-1',
    wcs: ['QC'],
  },
  { name: 'Ayu Lestari', role: 'quality', sites: [SITE_JKT], shift: 'sh-2', wcs: ['QC'] },
  { name: 'Novi Rahayu', role: 'quality', sites: [SITE_JKT], shift: 'sh-3', wcs: ['QC'] },
  { id: 'per-engineer', name: 'Hendra Gunawan', role: 'engineer', sites: [SITE_JKT], shift: null, wcs: [] },
  { name: 'Arif Budiman', role: 'engineer', sites: [SITE_JKT], shift: null, wcs: [], leave: true },
  { id: 'per-marketing', name: 'Fajar Nugroho', role: 'marketing', sites: [SITE_JKT], shift: null, wcs: [] },
  { name: 'Dewi Sartika', role: 'marketing', sites: [SITE_JKT], shift: null, wcs: [] },
  {
    id: 'per-warehouse',
    name: 'Irfan Maulana',
    role: 'warehouse',
    sites: [SITE_JKT],
    shift: 'sh-1',
    wcs: [],
  },
  { name: 'Rizky Pratama', role: 'warehouse', sites: [SITE_JKT], shift: 'sh-2', wcs: [] },
]

const SBY: PersonSpec[] = [
  { name: 'Ahmad Fauzi', role: 'planner', sites: [SITE_SBY], shift: null, wcs: [] },
  {
    name: 'Anton Suryadi',
    role: 'supervisor',
    sites: [SITE_SBY],
    shift: 'sh-1',
    wcs: ['CAST', 'COOL', 'PRESS', 'POL', 'PACK'],
  },
  { name: 'Bagus Pramono', role: 'operator', sites: [SITE_SBY], shift: 'sh-1', wcs: ['CAST', 'COOL'] },
  { name: 'Dwi Cahyono', role: 'operator', sites: [SITE_SBY], shift: 'sh-1', wcs: ['PRESS'] },
  { name: 'Hari Setiyo', role: 'operator', sites: [SITE_SBY], shift: 'sh-1', wcs: ['POL'] },
  { name: 'Iwan Kurnia', role: 'operator', sites: [SITE_SBY], shift: 'sh-2', wcs: ['PACK', 'PRESS'] },
  { name: 'Lilis Suryani', role: 'operator', sites: [SITE_SBY], shift: 'sh-2', wcs: ['QC', 'POL', 'PACK'] },
  { name: 'Mulyadi', role: 'operator', sites: [SITE_SBY], shift: 'sh-2', wcs: ['COOL', 'CAST'] },
  { name: 'Siti Nurhaliza', role: 'quality', sites: [SITE_SBY], shift: 'sh-1', wcs: ['QC'] },
  { name: 'Taufik Ismail', role: 'warehouse', sites: [SITE_SBY], shift: 'sh-1', wcs: [] },
]

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()
    .split(/\s+/)
const LOGIN: LoginMethod[] = ['rfid', 'rfid', 'nfc', 'qr', 'pin']

function skillsFor(spec: PersonSpec): Record<string, SkillLevel> {
  const out: Record<string, SkillLevel> = {}
  const senior = spec.role === 'supervisor' || spec.role === 'quality'
  for (const wc of spec.wcs) {
    const skill = WC_SKILL[wc]!
    out[skill] = senior ? (rng.pick([3, 4]) as SkillLevel) : (rng.pick([2, 2, 3]) as SkillLevel)
  }
  if (spec.role === 'warehouse') out['skl-fork'] = 3
  if (spec.role === 'supervisor') out['skl-5s'] = 4
  else if (spec.role === 'operator' && rng.chance(0.7)) out['skl-5s'] = 2
  if (spec.role === 'engineer') {
    out['skl-cast'] = 4
    out['skl-press'] = 3
  }
  return out
}

let seq = 0
function person(spec: PersonSpec): Person {
  seq += 1
  const parts = slug(spec.name)
  const id = spec.id ?? `per-${parts.join('-')}`
  const dayStaff = spec.shift === null
  return {
    id,
    code: `EMP-${String(seq).padStart(4, '0')}`,
    name: spec.name,
    role: spec.role,
    email: `${parts.join('.')}@logammulia.co.id`,
    siteIds: spec.sites,
    shiftId: spec.shift,
    skills: skillsFor(spec),
    workCenterIds: spec.wcs.flatMap((wc) =>
      spec.sites.filter((s) => !(s === SITE_SBY && wc === 'ENG')).map((s) => wcId(s, wc)),
    ),
    loginMethod: spec.role === 'operator' ? LOGIN[seq % LOGIN.length]! : dayStaff ? 'pin' : 'rfid',
    badge: `BDG-${String(1000 + seq * 7).padStart(5, '0')}`,
    availability: spec.leave ? 'leave' : dayStaff || spec.shift === CURRENT_SHIFT ? 'on_shift' : 'off_shift',
    color: PALETTE[seq % PALETTE.length]!,
  }
}

export const people: Person[] = [...JKT, ...SBY].map(person)

const operators = people.filter((p) => p.role === 'operator')
const supervisors = people.filter((p) => p.role === 'supervisor')

/** Operators qualified for a work center at a site, those on the given shift first. */
export function operatorsFor(siteId: string, wc: string, shiftId: string | null): Person[] {
  const id = wcId(siteId, wc)
  const pool = operators.filter((p) => p.siteIds.includes(siteId) && p.workCenterIds.includes(id))
  return [...pool.filter((p) => p.shiftId === shiftId), ...pool.filter((p) => p.shiftId !== shiftId)]
}

export function supervisorFor(siteId: string, shiftId: string | null): string {
  const own = supervisors.filter((p) => p.siteIds.includes(siteId))
  return (own.find((p) => p.shiftId === shiftId) ?? own[0]!).id
}

export function qualityFor(siteId: string, shiftId: string | null): string {
  const own = people.filter((p) => p.role === 'quality' && p.siteIds.includes(siteId))
  return (own.find((p) => p.shiftId === shiftId) ?? own[0]!).id
}

export const warehouseFor = (siteId: string): string =>
  people.find((p) => p.role === 'warehouse' && p.siteIds.includes(siteId))!.id
export const plannerFor = (siteId: string): string =>
  siteId === SITE_JKT ? 'per-planner' : 'per-ahmad-fauzi'
