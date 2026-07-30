// Date-window maths for the Pinterest Ads sync. Same rules as Meta
// (src/lib/meta/syncWindow.ts) and Google Ads (src/lib/google/syncWindow.ts); everything
// reuses the shared, already-tested primitives in src/lib/marketing/dateMath.ts.

import { addDaysUtc, dateChunks, minDate, todayUtc, type DateRange } from '@/lib/marketing/dateMath'

export type { DateRange }

/**
 * Days of overlap kept on an incremental sync. Pinterest restates spend for a few days after
 * the fact (late attribution, invalid-traffic credits), so we always re-pull the trailing
 * window: with lastDate = today this yields a 14-day window (today − 13 … today), inclusive.
 * Identical to Meta's and Google's INCREMENTAL_OVERLAP_DAYS.
 */
export const INCREMENTAL_OVERLAP_DAYS = 13

/**
 * Largest span requested in a single Pinterest analytics query. Pinterest rejects a range
 * wider than 90 days outright, so unlike Meta/Google this is an API limit rather than only a
 * quota courtesy — a full import is always chunked.
 */
export const FULL_SYNC_CHUNK_DAYS = 90

/**
 * Today's calendar day for the ad account.
 *
 * Pinterest v5 exposes no reporting time zone on the ad account resource, so there is nothing
 * to resolve against and UTC is used — the honest choice, rather than guessing a zone. The
 * 14-day incremental overlap means a day boundary that lands slightly early or late is
 * re-pulled on the next sync anyway.
 */
export function todayForAccount(now: Date): string {
  return todayUtc(now)
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

/** Split a full-import window into sequential ≤FULL_SYNC_CHUNK_DAYS chunks. */
export function fullSyncChunks(
  since: string,
  until: string,
  chunkDays: number = FULL_SYNC_CHUNK_DAYS,
): DateRange[] {
  return dateChunks(since, until, chunkDays)
}
