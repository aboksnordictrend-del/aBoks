// Public data shapes for the Meta ads client. Kept free of any Payload types so the
// client can be unit-tested in isolation.

/** One day of ad spend, normalized from a Meta insights row. */
export interface MetaDailySpend {
  /** Calendar day in YYYY-MM-DD (from the insights row's date_start). */
  date: string
  /** Spend for that day, as a decimal number in the account currency. */
  spend: number
  /** ISO 4217 currency code reported by the account (must be NOK). */
  currency: string
}

/** Raw insights row as returned by the Graph API (only the fields we request). */
export interface MetaInsightsRow {
  spend?: string
  date_start?: string
  date_stop?: string
  account_currency?: string
}

/** A `{"since":"…","until":"…"}` window; both bounds inclusive, YYYY-MM-DD. */
export interface MetaTimeRange {
  since: string
  until: string
}
