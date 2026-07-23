// Provider-neutral calendar-date maths shared by the Meta and Google Ads syncs.
//
// Every helper takes and returns a plain YYYY-MM-DD string. Nothing here ever parses a
// calendar day through the local timezone, so a day can never shift forwards or backwards
// by one. Month/year rollovers and leap days go through Date.UTC, which normalizes them.
//
// Extracted from src/lib/meta/syncWindow.ts (which now re-exports these) so the Google Ads
// sync reuses the exact same, already-tested arithmetic instead of a second copy.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** True when the value is a syntactically valid YYYY-MM-DD string. */
export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

/** Today's calendar day in UTC as YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Today's calendar day in an IANA time zone, as YYYY-MM-DD.
 *
 * Google Ads reports `segments.date` in the *ad account's* time zone, so "today" for an
 * incremental sync has to be resolved there — using the UTC day would drop (or invent) a
 * day for accounts west/east of UTC around midnight. Falls back to the UTC day when the
 * time zone is missing or not recognised by the runtime, which is always a valid day.
 */
export function todayInTimeZone(now: Date, timeZone?: string | null): string {
  if (!timeZone) return todayUtc(now)
  try {
    // 'en-CA' formats as YYYY-MM-DD; parts are read explicitly so the result never depends
    // on locale ordering.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
    const day = `${get('year')}-${get('month')}-${get('day')}`
    return DATE_RE.test(day) ? day : todayUtc(now)
  } catch {
    // An invalid IANA name throws a RangeError — degrade to UTC rather than failing a sync.
    return todayUtc(now)
  }
}

/** Add (or subtract, with a negative delta) whole days to a YYYY-MM-DD date, in UTC. */
export function addDaysUtc(date: string, delta: number): string {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`)
  const [y, m, d] = date.split('-').map(Number)
  // Date.UTC normalizes overflow/underflow across months and years, including leap days.
  const ms = Date.UTC(y, m - 1, d) + delta * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** The earlier of two YYYY-MM-DD dates (lexicographic compare is chronological here). */
export function minDate(a: string, b: string): string {
  return a <= b ? a : b
}

/** The later of two YYYY-MM-DD dates. */
export function maxDate(a: string, b: string): string {
  return a >= b ? a : b
}

/** Inclusive number of days between two YYYY-MM-DD dates (same day ⇒ 1). */
export function daysBetween(since: string, until: string): number {
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) throw new Error('Invalid date range')
  const [ys, ms, ds] = since.split('-').map(Number)
  const [yu, mu, du] = until.split('-').map(Number)
  return Math.floor((Date.UTC(yu, mu - 1, du) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1
}

/** An inclusive [since, until] calendar-day range. */
export interface DateRange {
  since: string
  until: string
}

/**
 * Split an inclusive range into consecutive chunks of at most `maxDays` days, in
 * chronological order. Used to keep a full historical import inside sane per-request
 * response sizes and API quotas instead of issuing one unbounded query.
 *
 * Returns [] when the range is inverted; a single chunk when it already fits.
 */
export function dateChunks(since: string, until: string, maxDays: number): DateRange[] {
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) throw new Error('Invalid date range')
  if (!Number.isFinite(maxDays) || maxDays < 1) throw new Error('maxDays must be >= 1')
  if (since > until) return []

  const chunks: DateRange[] = []
  let cursor = since
  // Bounded by construction (cursor advances by >= 1 day each iteration).
  while (cursor <= until) {
    const end = minDate(addDaysUtc(cursor, maxDays - 1), until)
    chunks.push({ since: cursor, until: end })
    cursor = addDaysUtc(end, 1)
  }
  return chunks
}
