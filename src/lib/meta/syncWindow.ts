// UTC-safe date maths for the Meta sync window. Deliberately free of local-timezone and
// mutating Date arithmetic: every helper takes/returns a YYYY-MM-DD string and works in
// UTC, so month/year rollovers, leap days and DST can never shift the window.
//
// The primitives now live in src/lib/marketing/dateMath.ts (shared with the Google Ads
// sync) and are re-exported here unchanged, so this module's public API is identical.

import { addDaysUtc, minDate, todayUtc } from '@/lib/marketing/dateMath'

export { addDaysUtc, minDate, todayUtc }

/**
 * Number of days of overlap kept on an incremental sync. Meta restates spend for a few
 * days after the fact, so we always re-pull the trailing window: with lastDate = today
 * this yields a 14-day window (today − 13 … today), inclusive.
 */
export const INCREMENTAL_OVERLAP_DAYS = 13

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
