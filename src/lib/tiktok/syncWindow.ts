// Date-window maths for the TikTok Ads sync. Same rules as Meta (src/lib/meta/syncWindow.ts),
// Google Ads and Pinterest Ads; everything reuses the shared, already-tested primitives in
// src/lib/marketing/dateMath.ts.

import {
  addDaysUtc,
  dateChunks,
  minDate,
  todayInTimeZone,
  type DateRange,
} from '@/lib/marketing/dateMath'

export type { DateRange }

/**
 * Days of overlap kept on an incremental sync. TikTok's reporting API has roughly 11 hours of
 * data latency and restates spend for a few days after the fact (late attribution, invalid
 * traffic credits), so we always re-pull the trailing window: with lastDate = today this
 * yields a 14-day window (today − 13 … today), inclusive. Identical to Meta's, Google's and
 * Pinterest's INCREMENTAL_OVERLAP_DAYS.
 */
export const INCREMENTAL_OVERLAP_DAYS = 13

/**
 * Largest span requested in a single TikTok report query. A report using the `stat_time_day`
 * dimension is limited to a 30-day range, so — as with Pinterest — this is an API limit
 * rather than only a quota courtesy, and a full import is always chunked.
 */
export const FULL_SYNC_CHUNK_DAYS = 30

/**
 * Today's calendar day for the advertiser.
 *
 * TikTok labels report days in the *advertiser's* reporting time zone, so "today" is resolved
 * there — using the UTC day would drop (or invent) a day around midnight for an account east
 * or west of UTC. Falls back to the UTC day when TikTok reports no time zone or the runtime
 * does not recognise it, which is always a valid day. The Vercel server's own zone is never
 * consulted.
 */
export function todayForAdvertiser(now: Date, timezone?: string | null): string {
  return todayInTimeZone(now, timezone)
}

/**
 * Window for an incremental sync:
 *
 *   since = lastExternalDate − INCREMENTAL_OVERLAP_DAYS
 *   until = today
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

/** Split an import window into sequential ≤FULL_SYNC_CHUNK_DAYS chunks. */
export function fullSyncChunks(
  since: string,
  until: string,
  chunkDays: number = FULL_SYNC_CHUNK_DAYS,
): DateRange[] {
  return dateChunks(since, until, chunkDays)
}
