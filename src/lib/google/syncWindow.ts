// Date-window maths for the Google Ads sync. Same rules as Meta
// (src/lib/meta/syncWindow.ts) with one API-specific difference: "today" is resolved in the
// **ad account's** time zone, because Google Ads reports segments.date there. Everything
// else reuses the shared, already-tested primitives in src/lib/marketing/dateMath.ts.

import { addDaysUtc, dateChunks, minDate, todayInTimeZone, type DateRange } from '@/lib/marketing/dateMath'

export type { DateRange }

/**
 * Days of overlap kept on an incremental sync. Google restates spend for a few days after
 * the fact (late conversions, invalid-click credits), so we always re-pull the trailing
 * window: with lastDate = today this yields a 14-day window (today − 13 … today), inclusive.
 * Identical to Meta's INCREMENTAL_OVERLAP_DAYS.
 */
export const INCREMENTAL_OVERLAP_DAYS = 13

/**
 * Largest span requested in a single Google Ads query during a full import. Keeps each
 * response small and stays well inside API quotas instead of issuing one unbounded query.
 */
export const FULL_SYNC_CHUNK_DAYS = 90

/** Today's calendar day in the ad account's time zone (falls back to UTC). */
export function todayForAccount(now: Date, timeZone?: string | null): string {
  return todayInTimeZone(now, timeZone)
}

/**
 * Window for an incremental sync:
 *
 *   since = lastExternalDate − INCREMENTAL_OVERLAP_DAYS
 *   until = today (ad account time zone)
 *
 * The start is anchored on the **last imported day**, not on today — a database that has not
 * been synced since January re-checks from January, and only an up-to-date database gets the
 * minimum 14-day window. Two safety clamps, neither of which shortens a stale window:
 *
 *  - `minDate(lastExternalDate, today)`: a lastExternalDate in the *future* (clock skew, a
 *    hand-edited row) must not push the start past today;
 *  - `minDate(since, today)`: `since` can never exceed `until`.
 */
export function computeIncrementalWindow(lastExternalDate: string, today: string): DateRange {
  const anchor = minDate(lastExternalDate, today)
  const since = addDaysUtc(anchor, -INCREMENTAL_OVERLAP_DAYS)
  return { since: minDate(since, today), until: today }
}

/** Split a full-import window into sequential ≤FULL_SYNC_CHUNK_DAYS chunks. */
export function fullSyncChunks(
  since: string,
  until: string,
  chunkDays: number = FULL_SYNC_CHUNK_DAYS,
): DateRange[] {
  return dateChunks(since, until, chunkDays)
}
