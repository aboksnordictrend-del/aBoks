// Public data shapes for the TikTok Ads client. Kept free of any Payload types so the client
// can be unit-tested in isolation. Mirrors src/lib/pinterest/types.ts.

/** One day of ad spend, aggregated from TikTok report rows for that calendar day. */
export interface TikTokDailySpend {
  /** Calendar day in YYYY-MM-DD, as reported by TikTok (from the stat_time_day dimension). */
  date: string
  /** Spend in major currency units (kroner), rounded to 2 decimals exactly once. */
  spend: number
  /** ISO 4217 currency code of the advertiser account (must be NOK). */
  currency: string
}

/** One advertiser the current authorization can reach. Safe to display to an administrator. */
export interface TikTokAdvertiserRef {
  /** Advertiser id as digits (masked before it reaches the browser). */
  id: string
  /** Advertiser name, when TikTok reports one. */
  name: string | null
}

/** Advertiser metadata needed before any spend query. */
export interface TikTokAdvertiserInfo extends TikTokAdvertiserRef {
  /** ISO 4217 currency of the advertiser account, e.g. 'NOK'. */
  currency: string
  /**
   * IANA reporting time zone of the advertiser, e.g. 'Europe/Oslo'. TikTok labels report days
   * in this zone, so "today" for an incremental sync must be resolved here rather than in UTC
   * or in the Vercel server's zone.
   */
  timezone: string | null
  /**
   * Day the advertiser account was created (YYYY-MM-DD), or null when TikTok omits it. Used
   * as the start of a full import so we never request years of empty history.
   */
  createdDate: string | null
}

/** One raw entry from `GET /oauth2/advertiser/get/`. */
export interface TikTokAdvertiserListItem {
  advertiser_id?: string | number
  /** v1.3 field name. */
  advertiser_name?: string
  /** v1.2 field name, still returned by some responses — read defensively. */
  name?: string
}

/** One raw entry from `GET /advertiser/info/`. */
export interface TikTokAdvertiserInfoItem extends TikTokAdvertiserListItem {
  currency?: string
  timezone?: string
  display_timezone?: string
  /** Unix timestamp (seconds) or an ISO-ish string, depending on the response. */
  create_time?: string | number
}

/**
 * One raw report row from `GET /report/integrated/get/`. TikTok nests the requested
 * dimensions and metrics in two objects rather than flattening them.
 */
export interface TikTokReportRow {
  dimensions?: {
    /** `YYYY-MM-DD 00:00:00` for a daily report — sliced to the first 10 chars. */
    stat_time_day?: string
    advertiser_id?: string | number
  }
  metrics?: {
    /** Spend in the advertiser's currency, as a decimal string (e.g. "123.45"). */
    spend?: string | number
  }
}

/** TikTok's pagination block, present on list-shaped `data` payloads. */
export interface TikTokPageInfo {
  page?: number
  page_size?: number
  total_number?: number
  total_page?: number
}

/** Successful token exchange payload (`data` of `POST /oauth2/access_token/`). */
export interface TikTokTokenResponse {
  access_token?: string
  /** Scope ids granted by the authorizing user. Numeric ids, not names. */
  scope?: unknown
  /** Advertisers covered by this authorization. */
  advertiser_ids?: unknown
}

/**
 * Where a resolved currency came from. Recorded so the admin can see whether the value is
 * TikTok's own answer or an operator declaration — the two carry very different confidence.
 */
export type TikTokCurrencySource = 'advertiser-info' | 'config' | 'stored' | 'unknown'

/** A resolved currency plus its provenance. `code` is '' when nothing could be resolved. */
export interface TikTokResolvedCurrency {
  code: string
  source: TikTokCurrencySource
}

/** The stored, non-secret half of a TikTok connection — safe to return to the admin UI. */
export interface TikTokConnectionInfo {
  /**
   * Raw advertiser id (masked by callers before it leaves the server), or null when the
   * authorization succeeded but no single advertiser could be resolved yet.
   */
  advertiserId: string | null
  advertiserName: string | null
  currency: string | null
  timezone: string | null
  /** ISO timestamp of the last successful authorization. */
  connectedAt: string | null
  /**
   * False when `GET /advertiser/info/` was refused at connect time — the app is authorized
   * for Reporting but not Ad Account Management. Optional metadata (currency, time zone,
   * creation date) is then unavailable from TikTok; it does not stop the spend import.
   */
  metadataAvailable: boolean
  /**
   * True when the one-day report probe succeeded at connect time, proving the Reporting
   * scope actually works for this advertiser. Null when no probe has run.
   */
  reportingOk: boolean | null
}
