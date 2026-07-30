// High-level Pinterest Ads reads, built on the v5 analytics endpoint.
//
// `getPinterestDailySpend` returns exactly one normalized row per calendar day for the ad
// account — the analytics layer expects one total per channel per day, never one row per
// campaign, so any multi-row day is summed here before it reaches the sync.
//
// Money: Pinterest reports spend in **micros** (millionths of the ad account's currency; the
// SPEND_IN_MICRO_DOLLAR column name is legacy and USD-centric, the values are not). We sum
// the raw integer micros for a day and divide by 1_000_000 exactly once, at the end — no
// integer division, no intermediate rounding, no lost øre.
//
// Campaign identifiers: the account-level analytics response carries none — `granularity=DAY`
// on `/ad_accounts/{id}/analytics` is already aggregated across every campaign, which is
// exactly the one-row-per-day shape the analytics layer needs (the same reason the Google Ads
// reader queries `FROM customer`). The ad account id is therefore the identifier stored with
// each imported day, mirroring Meta and Google Ads.
//
// Pure enough to test: config and fetch are both injectable, mirroring src/lib/google/ads.ts.

import { DATE_RE } from '@/lib/marketing/dateMath'
import { pinterestGetList, pinterestGetObject, type PinterestRequestOptions } from './client'
import { getPinterestAdsConfig, type PinterestAdsConfig } from './config'
import { PinterestAdsError } from './errors'
import type {
  PinterestAdAccountInfo,
  PinterestAdAccountResponse,
  PinterestAnalyticsRow,
  PinterestDailySpend,
} from './types'

const REQUIRED_CURRENCY = 'NOK'
const MICROS_PER_UNIT = 1_000_000

/**
 * The only metric we request. Pinterest requires at least one column, and spend is the only
 * figure this integration stores — impressions/clicks are not marketing *cost*.
 */
const SPEND_COLUMN = 'SPEND_IN_MICRO_DOLLAR'

export interface PinterestAdsReadOptions extends PinterestRequestOptions {
  /** Override the env-derived config (used in tests). */
  config?: PinterestAdsConfig
}

/** Inclusive day range for a spend query, both bounds YYYY-MM-DD. */
export interface PinterestSpendRange {
  since: string
  until: string
}

function requireDate(value: string, label: string): string {
  if (!DATE_RE.test(value)) {
    throw new PinterestAdsError(`Ugyldig dato for Pinterest Ads-spørringen (${label}).`, {
      message: `invalid ${label}: ${value}`,
    })
  }
  return value
}

/** SPEND_IN_MICRO_DOLLAR arrives as an integer — sometimes as a JSON string. */
function parseMicros(raw: string | number | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0
  if (typeof raw !== 'string' || raw.trim() === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Round to 2 decimals without the classic float drift (same rule as lib/analytics/money). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** micros → major currency units. Never integer division; rounded once, at the end. */
export function microsToAmount(spendMicros: number): number {
  if (!Number.isFinite(spendMicros)) return 0
  return round2(spendMicros / MICROS_PER_UNIT)
}

/**
 * Guard: we never convert currencies. A non-NOK ad account stops the import with a clear
 * message instead of silently being treated as NOK.
 */
export function assertSupportedCurrency(currencyCode: string): void {
  if (currencyCode && currencyCode !== REQUIRED_CURRENCY) {
    throw new PinterestAdsError(
      `Pinterest-annonsekontoen rapporterer i ${currencyCode}, ikke ${REQUIRED_CURRENCY}. Import er stoppet — beløp konverteres ikke automatisk.`,
      { message: `unexpected account currency: ${currencyCode}` },
    )
  }
}

/**
 * `created_time` → YYYY-MM-DD. Pinterest documents a Unix timestamp; different endpoint
 * generations have used seconds and milliseconds, and an ISO string is accepted defensively.
 * Anything unparseable yields null, which simply means "fall back to the configured floor".
 */
export function parseCreatedDate(raw: string | number | undefined): string | null {
  if (raw == null) return null

  if (typeof raw === 'string' && DATE_RE.test(raw.slice(0, 10)) && raw.includes('-')) {
    return raw.slice(0, 10)
  }

  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // Values below ~1e11 cannot be milliseconds (that would be 1973), so they are seconds.
  const ms = n < 1e11 ? n * 1000 : n
  const day = new Date(ms).toISOString().slice(0, 10)
  return DATE_RE.test(day) ? day : null
}

/**
 * Ad-account metadata: currency (for the import guard) and the account's creation date,
 * which bounds a full import so we never request years of history that cannot exist.
 *
 * Pinterest v5 exposes no reporting time zone on the ad account, so days are taken exactly as
 * Pinterest labels them and "today" is resolved in UTC — see ./syncWindow.
 */
export async function getPinterestAdAccountInfo(
  options: PinterestAdsReadOptions = {},
): Promise<PinterestAdAccountInfo> {
  const config = options.config ?? getPinterestAdsConfig()
  const account = await pinterestGetObject<PinterestAdAccountResponse>(
    config,
    `ad_accounts/${config.adAccountId}`,
    {},
    options,
  )

  if (!account || typeof account !== 'object') {
    throw new PinterestAdsError(
      'Fant ikke Pinterest-annonsekontoen. Kontroller PINTEREST_AD_ACCOUNT_ID.',
      { message: 'empty ad account response' },
    )
  }

  return {
    id: account.id != null ? String(account.id) : config.adAccountId,
    name: typeof account.name === 'string' && account.name.trim() !== '' ? account.name : null,
    currency: typeof account.currency === 'string' ? account.currency : '',
    country: typeof account.country === 'string' ? account.country : null,
    createdDate: parseCreatedDate(account.created_time),
  }
}

/**
 * Daily account-level ad spend for an inclusive day range.
 *
 * `granularity=DAY` on the ad-account analytics endpoint already aggregates across campaigns,
 * but rows are still summed per `DATE` defensively, so the result is guaranteed to hold at
 * most one entry per calendar day even if Pinterest ever splits a day across rows.
 *
 * The caller is responsible for the currency guard (it has the account info already);
 * `currency` is echoed onto every row so the stored metadata records what was imported.
 */
export async function getPinterestDailySpend(
  { since, until }: PinterestSpendRange,
  currency: string,
  options: PinterestAdsReadOptions = {},
): Promise<PinterestDailySpend[]> {
  const config = options.config ?? getPinterestAdsConfig()
  requireDate(since, 'since')
  requireDate(until, 'until')
  if (since > until) return []

  const rows = await pinterestGetList<PinterestAnalyticsRow>(
    config,
    `ad_accounts/${config.adAccountId}/analytics`,
    {
      start_date: since,
      end_date: until,
      columns: SPEND_COLUMN,
      granularity: 'DAY',
    },
    options,
  )

  // Sum raw micros per day first; convert to kroner only after every row is accounted for.
  const microsByDate = new Map<string, number>()
  for (const row of rows) {
    const date = row?.DATE
    if (typeof date !== 'string' || !DATE_RE.test(date)) continue // unusable row
    microsByDate.set(date, (microsByDate.get(date) ?? 0) + parseMicros(row.SPEND_IN_MICRO_DOLLAR))
  }

  return [...microsByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, spendMicros]) => ({
      date,
      spendMicros,
      spend: microsToAmount(spendMicros),
      currency: currency || REQUIRED_CURRENCY,
    }))
}
