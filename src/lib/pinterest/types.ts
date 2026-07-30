// Public data shapes for the Pinterest Ads client. Kept free of any Payload types so the
// client can be unit-tested in isolation. Mirrors src/lib/google/types.ts.

/** One day of ad spend, aggregated from Pinterest analytics rows for that calendar day. */
export interface PinterestDailySpend {
  /** Calendar day in YYYY-MM-DD, as reported by Pinterest (the DATE column). */
  date: string
  /** Raw sum of SPEND_IN_MICRO_DOLLAR for the day — integer micros, never rounded. */
  spendMicros: number
  /** spendMicros / 1_000_000, rounded to 2 decimals only at this final step. */
  spend: number
  /** ISO 4217 currency code of the ad account (must be NOK). */
  currency: string
}

/** Ad-account metadata needed before any spend query. */
export interface PinterestAdAccountInfo {
  /** Ad account id as digits (never displayed unmasked). */
  id: string
  /** Ad account name, when Pinterest reports one. Safe to display. */
  name: string | null
  currency: string
  /** Two-letter country code of the ad account, e.g. 'NO'. */
  country: string | null
  /**
   * Day the ad account was created (YYYY-MM-DD), or null when Pinterest omits it. Used as
   * the start of a full import so we never request years of empty history.
   */
  createdDate: string | null
}

/** One raw ad-account object from `GET /v5/ad_accounts/{ad_account_id}`. */
export interface PinterestAdAccountResponse {
  id?: string | number
  name?: string
  country?: string
  currency?: string
  /** Unix timestamp (seconds or milliseconds, depending on the endpoint generation). */
  created_time?: string | number
}

/**
 * One raw analytics row. Pinterest returns the requested `columns` as SCREAMING_SNAKE_CASE
 * keys, plus `DATE` when granularity=DAY.
 */
export interface PinterestAnalyticsRow {
  DATE?: string
  /**
   * Spend in millionths of the **ad account's** currency. The column name is legacy and
   * USD-centric; the values follow the account currency, which the sync pins to NOK.
   */
  SPEND_IN_MICRO_DOLLAR?: string | number
}
