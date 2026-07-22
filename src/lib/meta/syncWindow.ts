// UTC-safe date maths for the Meta sync window. Deliberately free of local-timezone and
// mutating Date arithmetic: every helper takes/returns a YYYY-MM-DD string and works in
// UTC, so month/year rollovers, leap days and DST can never shift the window.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Number of days of overlap kept on an incremental sync. Meta restates spend for a few
 * days after the fact, so we always re-pull the trailing window: with lastDate = today
 * this yields a 14-day window (today − 13 … today), inclusive.
 */
export const INCREMENTAL_OVERLAP_DAYS = 13

/** Today's calendar day in UTC as YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
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

export interface SyncWindow {
  since: string
  until: string
}

/**
 * Window for an incremental sync: ends today (UTC) and starts `INCREMENTAL_OVERLAP_DAYS`
 * days before the last imported day — but never later than that, so a stale database still
 * gets its trailing window re-checked. `since` can never exceed `until`.
 */
export function computeIncrementalWindow(lastExternalDate: string, now: Date = new Date()): SyncWindow {
  const until = todayUtc(now)
  // A future lastExternalDate must not push the window past today.
  const anchor = minDate(lastExternalDate, until)
  const since = addDaysUtc(anchor, -INCREMENTAL_OVERLAP_DAYS)
  return { since: minDate(since, until), until }
}
