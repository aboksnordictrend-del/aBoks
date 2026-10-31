// Reporting periods for Miljøregistrering, in Oslo calendar days. Pure.
//
// Built on the sales dashboard's DST-aware Oslo conversion (src/lib/analytics/period.ts), which
// is reused unchanged. This module adds what environmental reporting needs on top: «I fjor»,
// yearly buckets, inclusive day keys for date-only delivery records, and a span limit.

import { bucketFor, enumerateBuckets, osloDateKey, resolvePeriod } from '../analytics/period'

export const MILJO_PRESETS = ['thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'custom'] as const
export type MiljoPreset = (typeof MILJO_PRESETS)[number]
export const MILJO_PRESET_LABELS: Record<MiljoPreset, string> = {
  thisMonth: 'Denne måneden',
  lastMonth: 'Forrige måned',
  thisYear: 'I år',
  lastYear: 'I fjor',
  custom: 'Egendefinert',
}

export type MiljoGrouping = 'day' | 'month' | 'year'
export const MILJO_GROUPING_LABELS: Record<MiljoGrouping, string> = { day: 'Dag', month: 'Måned', year: 'År' }

/** Longest custom range. Bounds the work a single (public) request can cause. */
export const MAX_PERIOD_DAYS = 10 * 366
/** Day buckets beyond this many days are switched to months. */
const MAX_DAY_BUCKETS = 400

export interface MiljoPeriod {
  preset: MiljoPreset
  /** Inclusive start, UTC ISO (Oslo midnight). */
  from: string
  /** Exclusive end, UTC ISO. */
  to: string
  /** First and last included Oslo day, YYYY-MM-DD — for date-only fields such as delivery dates. */
  fromKey: string
  toKey: string
  grouping: MiljoGrouping
}

export class PeriodError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000) + 1
}

function autoGrouping(days: number): MiljoGrouping {
  if (days <= 62) return 'day'
  if (days <= 1100) return 'month'
  return 'year'
}

function isRealDate(key: string): boolean {
  return DATE_RE.test(key) && shiftDay(key, 0) === key
}

export function isMiljoPreset(value: unknown): value is MiljoPreset {
  return typeof value === 'string' && (MILJO_PRESETS as readonly string[]).includes(value)
}

/**
 * Resolves a preset or a custom from/to (inclusive Oslo days) into a period. Throws PeriodError
 * with a Norwegian message for invalid input. «I år» and «Denne måneden» end today.
 */
export function resolveMiljoPeriod(
  input: { preset?: unknown; from?: unknown; to?: unknown; grouping?: unknown },
  now: Date = new Date(),
): MiljoPeriod {
  const preset: MiljoPreset = isMiljoPreset(input.preset) ? input.preset : 'thisYear'
  const today = osloDateKey(now)
  const y = Number(today.slice(0, 4))

  let fromKey: string
  let toKey: string
  switch (preset) {
    case 'thisMonth':
      fromKey = `${today.slice(0, 7)}-01`
      toKey = today
      break
    case 'lastMonth': {
      const firstOfThis = `${today.slice(0, 7)}-01`
      toKey = shiftDay(firstOfThis, -1)
      fromKey = `${toKey.slice(0, 7)}-01`
      break
    }
    case 'thisYear':
      fromKey = `${y}-01-01`
      toKey = today
      break
    case 'lastYear':
      fromKey = `${y - 1}-01-01`
      toKey = `${y - 1}-12-31`
      break
    case 'custom': {
      const from = typeof input.from === 'string' ? input.from : ''
      const to = typeof input.to === 'string' ? input.to : ''
      if (!isRealDate(from) || !isRealDate(to)) throw new PeriodError('Velg gyldige datoer (ÅÅÅÅ-MM-DD).')
      if (from > to) throw new PeriodError('Startdato kan ikke være etter sluttdato.')
      fromKey = from
      toKey = to
      break
    }
  }
  const days = daysBetween(fromKey, toKey)
  if (days > MAX_PERIOD_DAYS) throw new PeriodError('Perioden kan være maks 10 år.')

  const resolved = resolvePeriod('custom', { customFrom: fromKey, customTo: toKey })
  let grouping: MiljoGrouping =
    input.grouping === 'day' || input.grouping === 'month' || input.grouping === 'year'
      ? input.grouping
      : autoGrouping(days)
  if (grouping === 'day' && days > MAX_DAY_BUCKETS) grouping = 'month'

  return { preset, from: resolved.from, to: resolved.to, fromKey, toKey, grouping }
}

export interface Bucket {
  key: string
  label: string
}

/** Gap-filled, ordered buckets covering the period. */
export function periodBuckets(period: MiljoPeriod): Bucket[] {
  if (period.grouping !== 'year') return enumerateBuckets(period, period.grouping)
  const out: Bucket[] = []
  for (let y = Number(period.fromKey.slice(0, 4)); y <= Number(period.toKey.slice(0, 4)); y++) {
    out.push({ key: String(y), label: String(y) })
  }
  return out
}

/** Bucket key of an instant (registrations). */
export function bucketKeyForInstant(iso: string, grouping: MiljoGrouping): string {
  if (grouping === 'year') return osloDateKey(new Date(iso)).slice(0, 4)
  return bucketFor(new Date(iso), grouping).key
}

/** Bucket key of a date-only Oslo day (deliveries). */
export function bucketKeyForDay(dayKey: string, grouping: MiljoGrouping): string {
  if (grouping === 'year') return dayKey.slice(0, 4)
  if (grouping === 'month') return dayKey.slice(0, 7)
  return dayKey
}

/** 2026-03-07 → 07.03.2026. */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-')
  return d && m && y ? `${d}.${m}.${y}` : key
}

export function periodLabel(period: Pick<MiljoPeriod, 'fromKey' | 'toKey'>): string {
  return `${formatDayKey(period.fromKey)}–${formatDayKey(period.toKey)}`
}
