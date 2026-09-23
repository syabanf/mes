// Integration mappings, connections and logs, plus the OEE, telemetry and maintenance snapshots.
import type {
  IntegrationConnection,
  IntegrationLog,
  IntegrationMapping,
  IntegrationSystem,
  MachineState,
  MaintenanceRecord,
  OeeSnapshot,
  TelemetryPoint,
  WorkOrder,
} from '../../packages/types/src/index.ts'
import { dayKey } from '../../packages/fixtures/src/dates.ts'
import {
  ALARM_AT,
  DAY,
  DOWN_AT,
  HOUR,
  MINUTE,
  NOW,
  SITE_JKT,
  dayAt,
  iso,
  isSunday,
  logEvent,
  pad,
  sortByAt,
} from './common.ts'
import {
  MACHINE_SPECS,
  POL_02,
  PRESS_01,
  machineByCode,
  machineId,
  machines,
  type MachineSpec,
} from './machines.ts'
import { customers, materials, products, suppliers } from './master.ts'
import { people, shifts } from './people.ts'
import { atRiskMo, manufacturingOrders, pausedWo, workOrders } from './production.ts'
import { rng } from './rng.ts'

// ─── Mappings and connections ───────────────────────────────────

export const integrationMappings: IntegrationMapping[] = [
  ...MACHINE_SPECS.flatMap((m): IntegrationMapping[] => [
    {
      id: `im-oee-${m.n}`,
      system: 'oee',
      entityKind: 'machine',
      internalId: machineId(m.n),
      externalId: `OEE-M-${pad(m.n, 3)}`,
    },
    {
      id: `im-dm-${m.n}`,
      system: 'device_monitoring',
      entityKind: 'machine',
      internalId: machineId(m.n),
      externalId: `DM-${m.siteId === SITE_JKT ? 'JKT' : 'SBY'}-${m.code}`,
    },
    {
      id: `im-cmms-${m.n}`,
      system: 'cmms',
      entityKind: 'machine',
      internalId: machineId(m.n),
      externalId: `CMMS-AST-${1000 + m.n}`,
    },
  ]),
  ...products.map((p): IntegrationMapping => ({
    id: `im-erp-${p.id}`,
    system: 'erp',
    entityKind: 'product',
    internalId: p.id,
    externalId: `ERP-FG-${p.code.replace(/[^A-Z0-9]/g, '')}`,
  })),
  ...materials.map((m): IntegrationMapping => ({
    id: `im-erp-${m.id}`,
    system: 'erp',
    entityKind: 'material',
    internalId: m.id,
    externalId: `ERP-RM-${m.code.replace(/[^A-Z0-9]/g, '')}`,
  })),
  ...customers
    .filter((c) => c.externalId)
    .map((c): IntegrationMapping => ({
      id: `im-crm-${c.id}`,
      system: 'crm',
      entityKind: 'customer',
      internalId: c.id,
      externalId: c.externalId!,
    })),
  ...suppliers.map((s): IntegrationMapping => ({
    id: `im-erp-${s.id}`,
    system: 'erp',
    entityKind: 'supplier',
    internalId: s.id,
    externalId: s.externalId!,
  })),
  ...people
    .filter((p) => p.role === 'operator')
    .map((p): IntegrationMapping => ({
      id: `im-hris-${p.id}`,
      system: 'hris',
      entityKind: 'operator',
      internalId: p.id,
      externalId: `HRIS-${p.code}`,
    })),
]

export const integrationConnections: IntegrationConnection[] = [
  {
    id: 'conn-device_monitoring',
    system: 'device_monitoring',
    name: 'Device Monitoring (MQTT broker)',
    state: 'connected',
    endpoint: 'mqtts://dm.logammulia.local:8883',
    lastSyncAt: iso(NOW - 2 * MINUTE),
    throughput: 1450,
    enabled: true,
  },
  {
    id: 'conn-oee',
    system: 'oee',
    name: 'OEE service',
    state: 'connected',
    endpoint: 'https://oee.logammulia.local/api/v2',
    lastSyncAt: iso(NOW - 15 * MINUTE),
    throughput: 320,
    enabled: true,
  },
  {
    id: 'conn-cmms',
    system: 'cmms',
    name: 'CMMS',
    state: 'connected',
    endpoint: 'https://cmms.logammulia.local/api',
    lastSyncAt: iso(DOWN_AT + 15 * MINUTE),
    throughput: 24,
    enabled: true,
  },
  {
    id: 'conn-erp',
    system: 'erp',
    name: 'ERP (OData)',
    state: 'degraded',
    endpoint: 'https://erp.logammulia.co.id/odata/v4',
    lastSyncAt: iso(NOW - 3 * HOUR),
    throughput: 85,
    enabled: true,
  },
  {
    id: 'conn-wms',
    system: 'wms',
    name: 'WMS',
    state: 'not_configured',
    endpoint: '',
    lastSyncAt: null,
    throughput: 0,
    enabled: false,
  },
  {
    id: 'conn-hris',
    system: 'hris',
    name: 'HRIS roster',
    state: 'connected',
    endpoint: 'https://hris.logammulia.co.id/api/v1',
    lastSyncAt: iso(dayAt(0, 6)),
    throughput: 6,
    enabled: true,
  },
  {
    id: 'conn-crm',
    system: 'crm',
    name: 'CRM',
    state: 'disconnected',
    endpoint: 'https://crm.logammulia.co.id/api',
    lastSyncAt: iso(NOW - 2 * DAY),
    throughput: 0,
    enabled: true,
  },
]

// ─── Logs ───────────────────────────────────────────────────────

const jktMachines = MACHINE_SPECS.filter((m) => m.siteId === SITE_JKT)
const recentWos = workOrders.filter((w) => w.actualStart && Date.parse(w.actualStart) > NOW - DAY)
const recentMos = manufacturingOrders.filter((m) => Date.parse(m.createdAt) > NOW - 2 * DAY)

interface LogTemplate {
  system: IntegrationSystem
  direction: 'in' | 'out'
  event: string
  weight: number
  errorRate: number
  make: () => [ref: string, summary: string]
}

const TEMPLATES: LogTemplate[] = [
  {
    system: 'device_monitoring',
    direction: 'in',
    event: 'telemetry.batch',
    weight: 30,
    errorRate: 0.01,
    make: () => {
      const m = rng.pick(jktMachines)
      return [m.code, `${rng.int(20, 60)} points for ${m.code}`]
    },
  },
  {
    system: 'device_monitoring',
    direction: 'in',
    event: 'machine.state.changed',
    weight: 8,
    errorRate: 0,
    make: () => {
      const m = rng.pick(jktMachines)
      return [m.code, `${m.code} → ${rng.pick(['running', 'idle', 'setup'])}`]
    },
  },
  {
    system: 'oee',
    direction: 'out',
    event: 'workorder.started',
    weight: 8,
    errorRate: 0.02,
    make: () => {
      const w = rng.pick(recentWos)
      return [w.code, `${w.code} started on ${w.machineId ?? 'manual station'}`]
    },
  },
  {
    system: 'oee',
    direction: 'out',
    event: 'workorder.completed',
    weight: 6,
    errorRate: 0.02,
    make: () => {
      const w = rng.pick(recentWos)
      return [w.code, `${w.code} output ${w.outputQty} pcs`]
    },
  },
  {
    system: 'oee',
    direction: 'in',
    event: 'oee.shift.summary',
    weight: 4,
    errorRate: 0,
    make: () => {
      const m = rng.pick(jktMachines)
      return [m.code, `Shift OEE ${m.code}: ${rng.int(68, 91)}%`]
    },
  },
  {
    system: 'cmms',
    direction: 'in',
    event: 'asset.status.sync',
    weight: 5,
    errorRate: 0,
    make: () => {
      const m = rng.pick(jktMachines)
      return [`CMMS-AST-${1000 + m.n}`, `${m.code} availability synced`]
    },
  },
  {
    system: 'erp',
    direction: 'in',
    event: 'marketing_order.created',
    weight: 5,
    errorRate: 0.25,
    make: () => [`SO-${rng.int(48000, 48999)}`, 'Sales order pulled from ERP'],
  },
  {
    system: 'erp',
    direction: 'out',
    event: 'finished_goods.received',
    weight: 6,
    errorRate: 0.25,
    make: () => {
      const m = rng.pick(recentMos)
      return [m.code, `Goods receipt posted for ${m.code}`]
    },
  },
  {
    system: 'erp',
    direction: 'out',
    event: 'material.consumed',
    weight: 8,
    errorRate: 0.2,
    make: () => {
      const m = rng.pick(recentMos)
      return [m.code, `Backflush posted for ${m.code}`]
    },
  },
  {
    system: 'hris',
    direction: 'in',
    event: 'shift.roster.sync',
    weight: 2,
    errorRate: 0,
    make: () => [rng.pick(shifts).code, 'Roster synced'],
  },
  {
    system: 'crm',
    direction: 'out',
    event: 'customer.sync',
    weight: 3,
    errorRate: 1,
    make: () => {
      const c = rng.pick(customers)
      return [c.code, `Sync ${c.name}`]
    },
  },
]

const logs: IntegrationLog[] = []
for (let i = 0; i < 116; i++) {
  const t = rng.weighted(TEMPLATES.map((x) => [x, x.weight] as const))
  const [ref, summary] = t.make()
  const error = rng.chance(t.errorRate)
  const at = NOW - rng.float(0, 24) * HOUR
  logs.push({
    id: '',
    system: t.system,
    direction: t.direction,
    at: iso(at),
    event: t.event,
    ref,
    summary: error
      ? `${summary} · ${t.system === 'crm' ? 'connection refused' : t.system === 'erp' ? 'ERP gateway timeout (504)' : 'schema mismatch'}`
      : summary,
    status: error ? 'error' : rng.chance(0.05) ? 'pending' : 'ok',
    durationMs: error ? rng.int(5000, 30000) : rng.int(40, 900),
  })
}
logs.push(
  {
    id: '',
    system: 'device_monitoring',
    direction: 'in',
    at: iso(ALARM_AT),
    event: 'machine.alarm.triggered',
    ref: 'POL-02',
    summary: 'Spindle vibration high: 9.4 mm/s (limit 7.0)',
    status: 'ok',
    durationMs: 32,
  },
  {
    id: '',
    system: 'device_monitoring',
    direction: 'in',
    at: iso(DOWN_AT),
    event: 'machine.downtime.started',
    ref: 'POL-02',
    summary: 'POL-02 state → down',
    status: 'ok',
    durationMs: 28,
  },
  {
    id: '',
    system: 'cmms',
    direction: 'out',
    at: iso(DOWN_AT + 15 * MINUTE),
    event: 'maintenance.requested',
    ref: 'CM-00089',
    summary: 'POL-02: Spindle vibration high',
    status: 'ok',
    durationMs: 180,
  },
  {
    id: '',
    system: 'oee',
    direction: 'out',
    at: iso(DOWN_AT + MINUTE),
    event: 'workorder.paused',
    ref: pausedWo.code,
    summary: `${pausedWo.code} paused: machine`,
    status: 'ok',
    durationMs: 95,
  },
)
export const integrationLogs: IntegrationLog[] = sortByAt(logs).map((l, i) => ({
  ...l,
  id: `ilg-${pad(i + 1)}`,
}))

// ─── OEE snapshots ──────────────────────────────────────────────

const woOn = (machine: string, from: number, to: number): WorkOrder | undefined =>
  workOrders.find(
    (w) =>
      w.machineId === machine &&
      w.actualStart &&
      Date.parse(w.actualStart) < to &&
      (w.actualEnd ? Date.parse(w.actualEnd) : NOW) > from,
  )

const SHIFT_START: Record<string, number> = { 'sh-1': 7, 'sh-2': 15, 'sh-3': 23 }

export const oeeSnapshots: OeeSnapshot[] = []
for (const m of jktMachines) {
  const id = machineId(m.n)
  for (let d = -13; d <= 0; d++) {
    const day = dayAt(d, 0)
    if (isSunday(day)) continue
    for (const shift of shifts) {
      const start = day + SHIFT_START[shift.id]! * HOUR
      if (start >= NOW) continue
      const end = Math.min(start + 8 * HOUR, NOW)
      const wo = woOn(id, start, end)
      if (!wo && !rng.chance(0.3)) continue
      const worse = id === POL_02
      const availability = wo ? rng.float(worse ? 0.62 : 0.85, worse ? 0.8 : 0.98) : rng.float(0.2, 0.5)
      const performance = wo ? rng.float(worse ? 0.7 : 0.8, 0.97) : rng.float(0.6, 0.85)
      const quality = rng.float(worse ? 0.95 : 0.97, 0.999)
      const oee = availability * performance * quality
      const mo = wo ? manufacturingOrders.find((x) => x.id === wo.moId)! : null
      const cycle = wo
        ? Math.max(
            0.6,
            (Date.parse(wo.plannedEnd) - Date.parse(wo.plannedStart)) / 1000 / Math.max(1, wo.targetQty),
          )
        : 3
      const targetQty = Math.round(((end - start) / 1000 / cycle) * 0.9)
      const downtimeMin = Math.round((1 - availability) * 435)
      oeeSnapshots.push({
        id: `oee-${m.n}-${dayKey(day)}-${shift.id}`,
        machineId: id,
        date: dayKey(day),
        shiftId: shift.id,
        moId: mo?.id ?? null,
        woId: wo?.id ?? null,
        productId: mo?.productId ?? null,
        operatorId: wo?.operatorIds[0] ?? null,
        availability: rng.round(availability, 3),
        performance: rng.round(performance, 3),
        quality: rng.round(quality, 3),
        oee: rng.round(oee, 3),
        downtimeMin,
        lossMin: Math.round((1 - performance) * (435 - downtimeMin)),
        targetQty,
        actualQty: Math.round(targetQty * oee),
      })
    }
  }
}

// ─── Telemetry ──────────────────────────────────────────────────

interface Profile {
  temp: number
  rpm: number | null
  amp: number
  bar: number | null
  vib: number
  rate: number
}
const PROFILE: Record<string, Profile> = {
  CAST: { temp: 1082, rpm: null, amp: 118, bar: null, vib: 1.2, rate: 12 },
  COOL: { temp: 24, rpm: 32, amp: 8, bar: null, vib: 0.6, rate: 18 },
  PRESS: { temp: 41, rpm: 46, amp: 58, bar: 182, vib: 2.1, rate: 22 },
  POL: { temp: 36, rpm: 1400, amp: 12, bar: null, vib: 2.6, rate: 9 },
  ENG: { temp: 30, rpm: null, amp: 6, bar: null, vib: 0.4, rate: 0 },
  QC: { temp: 24, rpm: null, amp: 2, bar: null, vib: 0.1, rate: 30 },
  PACK: { temp: 28, rpm: 20, amp: 5, bar: 6.5, vib: 0.8, rate: 14 },
}

const setupNow = new Set(
  workOrders.filter((w) => w.status === 'assigned' && w.machineId).map((w) => w.machineId!),
)

function stateAt(m: MachineSpec, at: number): [MachineState, WorkOrder | undefined] {
  const id = machineId(m.n)
  if (id === POL_02 && at >= DOWN_AT) return ['down', pausedWo]
  const wo = workOrders.find(
    (w) =>
      w.machineId === id &&
      w.actualStart &&
      Date.parse(w.actualStart) <= at &&
      (w.actualEnd ? Date.parse(w.actualEnd) : Infinity) > at &&
      w.status !== 'hold',
  )
  if (wo) return ['running', wo]
  if (setupNow.has(id) && at > NOW - HOUR) return ['setup', undefined]
  return ['idle', undefined]
}

export const telemetry: TelemetryPoint[] = []
for (const m of jktMachines) {
  const id = machineId(m.n)
  const prof = PROFILE[m.wc]!
  let counter = rng.int(20000, 400000)
  for (let i = 0; i <= 24; i++) {
    const at = NOW - (24 - i) * 30 * MINUTE
    const [state, wo] = stateAt(m, at)
    const running = state === 'running'
    let vib = running ? prof.vib * rng.float(0.85, 1.15) : prof.vib * 0.2
    let alarm: string | null = null
    if (id === POL_02) {
      const hoursToAlarm = (ALARM_AT - at) / HOUR
      if (hoursToAlarm <= 4 && hoursToAlarm > 0) vib = 2.6 + (4 - hoursToAlarm) * 1.6 + rng.float(-0.2, 0.2)
      if (at >= ALARM_AT - 5 * MINUTE) {
        vib = state === 'down' ? 0 : 9.4
        alarm = 'Spindle vibration high'
      }
    }
    if (running) counter += Math.round(prof.rate * 30 * rng.float(0.8, 1.05))
    telemetry.push({
      id: `tp-${m.n}-${pad(i, 2)}`,
      machineId: id,
      at: iso(at),
      temperatureC: rng.round(
        running
          ? prof.temp * rng.float(0.98, 1.02)
          : state === 'down'
            ? prof.temp * 0.7
            : Math.min(prof.temp, 27) + rng.float(-1, 1),
        1,
      ),
      speedRpm: prof.rpm === null ? null : running ? Math.round(prof.rpm * rng.float(0.95, 1.03)) : 0,
      currentA: rng.round(running ? prof.amp * rng.float(0.9, 1.1) : prof.amp * 0.08, 1),
      pressureBar:
        prof.bar === null ? null : rng.round(running ? prof.bar * rng.float(0.97, 1.03) : prof.bar * 0.3, 1),
      vibrationMmS: rng.round(vib, 2),
      counter,
      state,
      alarm,
      moId: wo?.moId ?? null,
      woId: wo?.id ?? null,
    })
  }
}

// Patch the machine rows with their live state and last telemetry point.
for (const machine of machines) {
  const last = telemetry.filter((t) => t.machineId === machine.id).at(-1)
  if (last) {
    machine.state = last.state
    machine.telemetry = {
      at: last.at,
      temperatureC: last.temperatureC,
      speedRpm: last.speedRpm,
      currentA: last.currentA,
      pressureBar: last.pressureBar,
      vibrationMmS: last.vibrationMmS,
      counter: last.counter,
      alarm: last.alarm,
    }
  } else {
    const spec = MACHINE_SPECS.find((s) => machineId(s.n) === machine.id)!
    const [state] = stateAt(spec, NOW)
    const prof = PROFILE[spec.wc]!
    machine.state = state
    machine.telemetry = {
      at: iso(NOW - 4 * MINUTE),
      temperatureC: state === 'running' ? prof.temp : 26,
      speedRpm: prof.rpm === null ? null : state === 'running' ? prof.rpm : 0,
      currentA: state === 'running' ? prof.amp : 0.5,
      pressureBar: prof.bar,
      vibrationMmS: state === 'running' ? prof.vib : 0.1,
      counter: rng.int(5000, 90000),
      alarm: null,
    }
  }
  machine.maintenanceState =
    machine.id === POL_02 ? 'in_maintenance' : machine.id === PRESS_01 ? 'planned' : 'available'
}

// ─── Maintenance ────────────────────────────────────────────────

const rec = (
  n: number,
  code: string,
  kind: MaintenanceRecord['kind'],
  status: MaintenanceRecord['status'],
  title: string,
  start: number,
  hours: number,
  completedAt: number | null,
  impacted: string[] = [],
  alarm: string | null = null,
): MaintenanceRecord => ({
  id: `mnt-${pad(n)}`,
  code: `CM-${pad(n)}`,
  machineId: machineByCode(SITE_JKT, code),
  kind,
  status,
  title,
  plannedStart: iso(start),
  plannedEnd: iso(start + hours * HOUR),
  completedAt: completedAt === null ? null : iso(completedAt),
  impactedWoIds: impacted,
  sourceAlarm: alarm,
})

export const maintenanceRecords: MaintenanceRecord[] = [
  rec(
    81,
    'CAST-01',
    'planned',
    'completed',
    'Crucible liner replacement',
    dayAt(-20, 7),
    4,
    dayAt(-20, 10, 40),
  ),
  rec(82, 'PRESS-02', 'planned', 'completed', 'Hydraulic oil change', dayAt(-17, 7), 3, dayAt(-17, 9, 50)),
  rec(
    83,
    'PRESS-02',
    'corrective',
    'completed',
    'Ram seal leak',
    dayAt(-10, 13, 20),
    5,
    dayAt(-10, 18, 5),
    [],
    'Hydraulic pressure low',
  ),
  rec(
    84,
    'POL-01',
    'planned',
    'completed',
    'Spindle bearing lubrication',
    dayAt(-14, 7),
    2,
    dayAt(-14, 8, 45),
  ),
  rec(85, 'PACK-01', 'planned', 'completed', 'Sealing head calibration', dayAt(-9, 15), 2, dayAt(-9, 16, 30)),
  rec(86, 'QC-01', 'planned', 'completed', 'XRF detector calibration', dayAt(-6, 7), 3, dayAt(-6, 9, 55)),
  rec(87, 'ENG-01', 'planned', 'completed', 'Laser source alignment', dayAt(-4, 7), 4, dayAt(-4, 11, 20)),
  rec(88, 'CAST-02', 'planned', 'completed', 'Induction coil inspection', dayAt(-3, 7), 3, dayAt(-3, 9, 30)),
  rec(
    89,
    'POL-02',
    'corrective',
    'in_progress',
    'Spindle vibration high: bearing replacement',
    DOWN_AT + 15 * MINUTE,
    7,
    null,
    [pausedWo.id],
    'Spindle vibration high',
  ),
  rec(90, 'PRESS-01', 'planned', 'scheduled', 'Quarterly hydraulic service', dayAt(1, 7), 4, null),
  rec(91, 'CAST-02', 'request', 'requested', 'Crucible liner wear check', dayAt(0, 9, 10), 4, null),
]
export const LAST_CM_SEQ = 91

for (const r of maintenanceRecords) {
  const code = MACHINE_SPECS.find((m) => machineId(m.n) === r.machineId)!.code
  if (r.status === 'completed') {
    logEvent(
      SITE_JKT,
      'maintenance.completed',
      Date.parse(r.completedAt!),
      'per-engineer',
      `${r.code} completed; ${code} available`,
      { machineId: r.machineId },
    )
    if (r.kind === 'corrective')
      logEvent(
        SITE_JKT,
        'machine.downtime.ended',
        Date.parse(r.completedAt!),
        'system',
        `${code} back in service after ${r.title.toLowerCase()}`,
        { machineId: r.machineId },
      )
  } else if (r.status !== 'scheduled') {
    logEvent(
      SITE_JKT,
      'maintenance.requested',
      Date.parse(r.plannedStart),
      'per-supervisor',
      `${r.code} raised for ${code}: ${r.title}`,
      {
        machineId: r.machineId,
        woId: r.impactedWoIds[0] ?? null,
        moId: r.impactedWoIds.length ? atRiskMo.id : null,
      },
    )
  }
}
