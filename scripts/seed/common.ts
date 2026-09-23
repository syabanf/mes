// Shared clock, id helpers and the production-event collector every seed module writes to.
import type { EventType, ProductionEvent } from '../../packages/types/src/index.ts'
import { FIXTURE_NOW } from '../../packages/fixtures/src/clock.ts'
import { DAY, HOUR, MINUTE, startOfDay, toIso, toMs, wib } from '../../packages/fixtures/src/dates.ts'

export { DAY, HOUR, MINUTE }

export const NOW = toMs(FIXTURE_NOW)
export const TODAY = startOfDay(NOW)
/** POL-02 raised its vibration alarm at 07:38 and went down two minutes later. */
export const ALARM_AT = TODAY + 7 * HOUR + 38 * MINUTE
export const DOWN_AT = ALARM_AT + 2 * MINUTE

export const SITE_JKT = 'site-jkt'
export const SITE_SBY = 'site-sby'
export const SITES = [SITE_JKT, SITE_SBY]

export const pad = (n: number, len = 5) => String(n).padStart(len, '0')
export const iso = toIso
export const isoOrNull = (ms: number | null) => (ms === null ? null : toIso(ms))

/** Instant at hh:mm on a day offset from today (negative = past). */
export const dayAt = (offset: number, hours: number, minutes = 0) =>
  TODAY + offset * DAY + hours * HOUR + minutes * MINUTE
export const isSunday = (ms: number) => wib(ms).weekday === 0
export const skipSunday = (ms: number) => (isSunday(ms) ? ms + DAY : ms)
export const clampPast = (ms: number, margin = 5 * MINUTE) => Math.min(ms, NOW - margin)

export const siteKey = (siteId: string) => siteId.replace('site-', '')
export const wcId = (siteId: string, code: string) => `org-${siteKey(siteId)}-wc-${code.toLowerCase()}`
export const lineId = (siteId: string, suffix: string) => `org-${siteKey(siteId)}-${suffix}`
export const locId = (siteId: string, suffix: string) => `loc-${siteKey(siteId)}-${suffix}`

export const sortByAt = <T extends { at: string }>(rows: T[]) => rows.sort((a, b) => a.at.localeCompare(b.at))

// ─── Production events ──────────────────────────────────────────

type EventRefs = Partial<Pick<ProductionEvent, 'moId' | 'woId' | 'wipId' | 'lotId' | 'machineId'>>

const collected: ProductionEvent[] = []

export function logEvent(
  siteId: string,
  type: EventType,
  at: number,
  by: string,
  text: string,
  refs: EventRefs = {},
): void {
  collected.push({
    id: '',
    siteId,
    type,
    at: iso(at),
    by,
    moId: refs.moId ?? null,
    woId: refs.woId ?? null,
    wipId: refs.wipId ?? null,
    lotId: refs.lotId ?? null,
    machineId: refs.machineId ?? null,
    text,
  })
}

/** Every event logged so far, chronological, with final ids. */
export function drainEvents(): ProductionEvent[] {
  return sortByAt(collected.slice()).map((e, i) => ({ ...e, id: `evt-${pad(i + 1)}` }))
}
