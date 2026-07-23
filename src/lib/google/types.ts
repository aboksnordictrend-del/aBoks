// Public data shapes for the Google Ads client. Kept free of any Payload types so the
// client can be unit-tested in isolation. Mirrors src/lib/meta/types.ts.

/** One day of ad spend, aggregated from Google Ads rows for that calendar day. */
export interface GoogleDailySpend {
  /** Calendar day in YYYY-MM-DD, in the ad account's time zone (segments.date). */
  date: string
  /** Raw sum of metrics.cost_micros for the day — integer micros, never rounded. */
  costMicros: number
  /** costMicros / 1_000_000, rounded to 2 decimals only at this final step. */
  spend: number
  /** ISO 4217 currency code of the ad account (must be NOK). */
  currency: string
}

/** Ad-account metadata needed before any spend query. */
export interface GoogleAdsAccountInfo {
  /** Customer id as digits (never displayed unmasked). */
  id: string
  currencyCode: string
  /** IANA time zone the account reports segments.date in, e.g. 'Europe/Oslo'. */
  timeZone: string
  descriptiveName: string | null
}

/** One raw row from a googleAds:search response (only the fields we request). */
export interface GoogleAdsSearchRow {
  segments?: { date?: string }
  metrics?: { costMicros?: string | number }
  customer?: {
    id?: string | number
    currencyCode?: string
    timeZone?: string
    descriptiveName?: string
  }
}
