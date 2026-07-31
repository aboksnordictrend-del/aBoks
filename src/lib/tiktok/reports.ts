// Daily advertiser-level ad spend from the TikTok synchronous reporting endpoint.
//
// `getTikTokDailySpend` returns exactly one normalized row per calendar day for the
// advertiser — the analytics layer expects one total per channel per day, never one row per
// campaign, so the query is issued at advertiser level (`data_level=AUCTION_ADVERTISER`) and
// any multi-row day is summed here before it reaches the sync.
//
// Request shape (TikTok Marketing API v1.3, `GET /report/integrated/get/`):
//   advertiser_id   the account to report on
//   service_type    AUCTION            — auction (self-serve) ads, what this account buys
//   report_type     BASIC              — the plain performance report
//   data_level      AUCTION_ADVERTISER — already aggregated across every campaign, which is
//                                        exactly the one-row-per-day shape needed here (the
//                                        same reason the Google Ads reader queries FROM customer)
//   dimensions      ["advertiser_id","stat_time_day"]  — daily rows
//   metrics         ["spend"]          — the only figure this integration stores; impressions
//                                        and conversion value are not marketing *cost*
//   start_date/end_date, page/page_size
//
// Money: TikTok reports `spend` as a decimal string in the **advertiser's** currency (not in
// micros, unlike Pinterest). It is parsed once, summed per day as a number, and rounded to 2
// decimals exactly once at the end — no intermediate rounding, no lost øre.
//
// Pure enough to test: config, token and fetch are all injectable.

import { DATE_RE } from '@/lib/marketing/dateMath'
import { round2 } from '@/lib/analytics/money'
import { MAX_PAGE_SIZE, tiktokGetList, type TikTokRequestOptions } from './client'
import type { TikTokAdsConfig } from './config'
import { TikTokAdsError } from './errors'
import type { TikTokDailySpend, TikTokReportRow } from './types'

const REPORT_PATH = 'report/integrated/get/'

const SERVICE_TYPE = 'AUCTION'
const REPORT_TYPE = 'BASIC'
const DATA_LEVEL = 'AUCTION_ADVERTISER'
const DIMENSIONS = ['advertiser_id', 'stat_time_day'] as const
const METRICS = ['spend'] as const

/** Inclusive day range for a spend query, both bounds YYYY-MM-DD. */
export interface TikTokSpendRange {
  since: string
  until: string
}

export interface TikTokReportOptions extends TikTokRequestOptions {
  /** Page size for the report query. Capped at TikTok's maximum. */
  pageSize?: number
}

function requireDate(value: string, label: string): string {
  if (!DATE_RE.test(value)) {
    throw new TikTokAdsError(`Ugyldig dato for TikTok Ads-spørringen (${label}).`, {
      message: `invalid ${label}: ${value}`,
    })
  }
  return value
}

/**
 * `stat_time_day` arrives as `"2026-07-22 00:00:00"` (the advertiser's own reporting day, not
 * a UTC instant), so the calendar day is the first 10 characters — taken verbatim, never
 * parsed through a Date, so no timezone conversion can shift it by a day. Returns null for
 * anything that is not a valid day.
 */
export function parseStatDay(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const day = raw.slice(0, 10)
  return DATE_RE.test(day) ? day : null
}

/**
 * `spend` arrives as a decimal string. Anything non-finite or negative is treated as 0 — a
 * negative "spend" is not a cost and must never reduce another day's total.
 */
export function parseSpend(raw: string | number | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0
  if (typeof raw !== 'string' || raw.trim() === '') return 0
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Daily advertiser-level ad spend for an inclusive day range.
 *
 * The caller is responsible for keeping the range inside TikTok's 30-day reporting window
 * (see ./syncWindow) and for the currency guard (it has the advertiser info already);
 * `currency` is echoed onto every row so the stored metadata records what was imported.
 *
 * Rows are summed per day defensively, so the result is guaranteed to hold at most one entry
 * per calendar day even if TikTok ever splits a day across rows.
 */
export async function getTikTokDailySpend(
  config: TikTokAdsConfig,
  accessToken: string,
  advertiserId: string,
  { since, until }: TikTokSpendRange,
  currency: string,
  options: TikTokReportOptions = {},
): Promise<TikTokDailySpend[]> {
  requireDate(since, 'since')
  requireDate(until, 'until')
  if (since > until) return []

  const pageSize = Math.min(Math.max(1, options.pageSize ?? MAX_PAGE_SIZE), MAX_PAGE_SIZE)

  const rows = await tiktokGetList<TikTokReportRow>(
    config,
    accessToken,
    REPORT_PATH,
    {
      advertiser_id: advertiserId,
      service_type: SERVICE_TYPE,
      report_type: REPORT_TYPE,
      data_level: DATA_LEVEL,
      dimensions: JSON.stringify(DIMENSIONS),
      metrics: JSON.stringify(METRICS),
      start_date: since,
      end_date: until,
      page_size: String(pageSize),
    },
    {
      ...options,
      chunk: options.chunk ?? `${since}..${until}`,
      operation: options.operation ?? 'report',
    },
  )

  const spendByDate = new Map<string, number>()
  for (const row of rows) {
    const date = parseStatDay(row?.dimensions?.stat_time_day)
    if (!date) continue // unusable row — a report entry without a valid day is not a cost
    spendByDate.set(date, (spendByDate.get(date) ?? 0) + parseSpend(row?.metrics?.spend))
  }

  return [...spendByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, spend]) => ({
      date,
      // Rounded exactly once, after every row for the day has been summed.
      spend: round2(spend),
      currency: currency || 'NOK',
    }))
}
