// High-level Google Ads reads, built on GAQL (Google Ads Query Language).
//
// `getGoogleAdsDailySpend` returns exactly one normalized row per calendar day for the
// account — the analytics layer expects one total per channel per day, never one row per
// campaign, so any multi-row day is summed here before it reaches the sync.
//
// Money: Google reports spend in **micros** (millionths of the account currency). We sum the
// raw integer micros for a day and divide by 1_000_000 exactly once, at the end — no integer
// division, no intermediate rounding, no lost øre.
//
// Pure enough to test: config and fetch are both injectable, mirroring src/lib/meta/ads.ts.

import { DATE_RE } from '@/lib/marketing/dateMath'
import { googleAdsSearch, type GoogleAdsRequestOptions } from './client'
import { getGoogleAdsConfig, type GoogleAdsConfig } from './config'
import { GoogleAdsError } from './errors'
import type { GoogleAdsAccountInfo, GoogleAdsSearchRow, GoogleDailySpend } from './types'

const REQUIRED_CURRENCY = 'NOK'
const MICROS_PER_UNIT = 1_000_000

export interface GoogleAdsReadOptions extends GoogleAdsRequestOptions {
  /** Override the env-derived config (used in tests). */
  config?: GoogleAdsConfig
}

/** Inclusive day range for a spend query, both bounds YYYY-MM-DD. */
export interface GoogleSpendRange {
  since: string
  until: string
}

function requireDate(value: string, label: string): string {
  if (!DATE_RE.test(value)) {
    throw new GoogleAdsError(`Ugyldig dato for Google Ads-spørringen (${label}).`, {
      message: `invalid ${label}: ${value}`,
    })
  }
  return value
}

/** metrics.cost_micros arrives as an int64 — a JSON string or a number. */
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
export function microsToAmount(costMicros: number): number {
  if (!Number.isFinite(costMicros)) return 0
  return round2(costMicros / MICROS_PER_UNIT)
}

/**
 * Guard: we never convert currencies. A non-NOK ad account stops the import with a clear
 * message instead of silently being treated as NOK.
 */
export function assertSupportedCurrency(currencyCode: string): void {
  if (currencyCode && currencyCode !== REQUIRED_CURRENCY) {
    throw new GoogleAdsError(
      `Google Ads-kontoen rapporterer i ${currencyCode}, ikke ${REQUIRED_CURRENCY}. Import er stoppet — beløp konverteres ikke automatisk.`,
      { message: `unexpected account currency: ${currencyCode}` },
    )
  }
}

/**
 * Ad-account metadata: currency and the time zone `segments.date` is reported in. Fetched
 * before any spend query, because "today" for an incremental sync is a day in *that* zone.
 */
export async function getGoogleAdsAccountInfo(
  options: GoogleAdsReadOptions = {},
): Promise<GoogleAdsAccountInfo> {
  const config = options.config ?? getGoogleAdsConfig()
  const rows = await googleAdsSearch<GoogleAdsSearchRow>(
    config,
    'SELECT customer.id, customer.currency_code, customer.time_zone, customer.descriptive_name FROM customer LIMIT 1',
    options,
  )

  const customer = rows[0]?.customer
  if (!customer) {
    throw new GoogleAdsError(
      'Fant ikke Google Ads-kontoen. Kontroller GOOGLE_ADS_CUSTOMER_ID og GOOGLE_ADS_LOGIN_CUSTOMER_ID.',
      { message: 'empty customer response' },
    )
  }

  return {
    id: customer.id != null ? String(customer.id) : config.customerId,
    currencyCode: typeof customer.currencyCode === 'string' ? customer.currencyCode : '',
    timeZone: typeof customer.timeZone === 'string' ? customer.timeZone : '',
    descriptiveName:
      typeof customer.descriptiveName === 'string' ? customer.descriptiveName : null,
  }
}

/**
 * The account's first day with reported spend inside [from, until], or null when the account
 * has no data at all in that span. One cheap `LIMIT 1` query — this is how a full import
 * finds its real start date instead of assuming a history depth.
 */
export async function findEarliestSpendDate(
  { since, until }: GoogleSpendRange,
  options: GoogleAdsReadOptions = {},
): Promise<string | null> {
  const config = options.config ?? getGoogleAdsConfig()
  requireDate(since, 'since')
  requireDate(until, 'until')
  if (since > until) return null

  const rows = await googleAdsSearch<GoogleAdsSearchRow>(
    config,
    `SELECT segments.date, metrics.cost_micros FROM customer ` +
      `WHERE segments.date BETWEEN '${since}' AND '${until}' ` +
      `ORDER BY segments.date ASC LIMIT 1`,
    options,
  )

  const date = rows[0]?.segments?.date
  return typeof date === 'string' && DATE_RE.test(date) ? date : null
}

/**
 * Daily account-level ad spend for an inclusive day range.
 *
 * `FROM customer` already aggregates across campaigns, but rows are still summed per
 * `segments.date` defensively, so the result is guaranteed to hold at most one entry per
 * calendar day even if Google ever splits a day across rows.
 *
 * The caller is responsible for the currency guard (it has the account info already);
 * `currency` is echoed onto every row so the stored metadata records what was imported.
 */
export async function getGoogleAdsDailySpend(
  { since, until }: GoogleSpendRange,
  currency: string,
  options: GoogleAdsReadOptions = {},
): Promise<GoogleDailySpend[]> {
  const config = options.config ?? getGoogleAdsConfig()
  requireDate(since, 'since')
  requireDate(until, 'until')
  if (since > until) return []

  const rows = await googleAdsSearch<GoogleAdsSearchRow>(
    config,
    `SELECT segments.date, metrics.cost_micros FROM customer ` +
      `WHERE segments.date BETWEEN '${since}' AND '${until}' ` +
      `ORDER BY segments.date`,
    options,
  )

  // Sum raw micros per day first; convert to kroner only after every row is accounted for.
  const microsByDate = new Map<string, number>()
  for (const row of rows) {
    const date = row.segments?.date
    if (typeof date !== 'string' || !DATE_RE.test(date)) continue // unusable row
    microsByDate.set(date, (microsByDate.get(date) ?? 0) + parseMicros(row.metrics?.costMicros))
  }

  return [...microsByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, costMicros]) => ({
      date,
      costMicros,
      spend: microsToAmount(costMicros),
      currency: currency || REQUIRED_CURRENCY,
    }))
}
