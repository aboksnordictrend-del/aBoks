// Orchestrates the Google Ads → marketing-expenses upsert. Structurally identical to
// src/lib/meta/sync.ts: decoupled from HTTP (the endpoint validates auth/input and maps
// errors to status codes) and from the Google client (every fetcher is injected, so tests
// never hit the network).
//
// Duplicate protection is layered exactly as for Meta:
//   1. a deterministic `externalKey = google:{customerId}:{YYYY-MM-DD}` per day, which makes
//      (source, externalAccountId, externalDate) unique by construction;
//   2. the UNIQUE index on external_key (durable — survives a double-click / two instances);
//   3. a best-effort in-process lock per account (rejects an overlapping run early).
// Manual records are never updated or deleted, and a period that overlaps a manual Google
// Ads entry stops the import before any write, so analytics can never double-count.

import type { Payload } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import { round2 } from '@/lib/analytics/money'
import { DATE_RE } from '@/lib/marketing/dateMath'
import {
  getGoogleAdsAccountInfo,
  getGoogleAdsDailySpend,
  findEarliestSpendDate,
  assertSupportedCurrency,
  type GoogleSpendRange,
} from './ads'
import { getGoogleAdsConfig, maskCustomerId, type GoogleAdsConfig } from './config'
import {
  computeIncrementalWindow,
  fullSyncChunks,
  todayForAccount,
  FULL_SYNC_CHUNK_DAYS,
} from './syncWindow'
import type { GoogleAdsAccountInfo, GoogleDailySpend } from './types'

/** Stable provider id used for `source`, external keys and sync state. */
export const GOOGLE_ADS_SOURCE = 'google-ads'
export const GOOGLE_ADS_CHANNEL = 'google'
const EXTERNAL_KEY_PREFIX = 'google'

/**
 * VAT rate written on every imported Google Ads day — deliberately **0**, and deliberately
 * not a setting.
 *
 * `computeMarketingExVat` treats `amount` as gross and derives `amountExVat = amount / (1 +
 * vatRate/100)`, and the analytics layer spends `amountExVat`. Google bills Norwegian
 * businesses for advertising as a cross-border electronic service under reverse charge: the
 * invoice carries no Norwegian MVA, so `cost_micros` already *is* the net cost. Writing 25
 * here would silently divide every Google Ads cost by 1.25 and understate marketing spend by
 * 20 % in every KPI, ROAS and channel breakdown.
 *
 * With 0, `amountExVat === amount` and the imported figure is counted in full. Meta keeps its
 * own configurable `metaAdsVatRate` — that behaviour is untouched.
 */
export const GOOGLE_ADS_VAT_RATE = 0

export class GoogleSyncValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleSyncValidationError'
  }
}

export class GoogleSyncInProgressError extends Error {
  constructor(message = 'En synkronisering pågår allerede for denne kontoen.') {
    super(message)
    this.name = 'GoogleSyncInProgressError'
  }
}

/** A manual Google Ads expense that overlaps the requested period (blocks the import). */
export interface GoogleSyncConflict {
  id: string
  description?: string
  periodFrom?: string
  periodTo?: string
  amount?: number
}

/**
 * `incremental` re-pulls only the trailing overlap window (the normal "Oppdater"), while
 * `full` re-pulls the entire available history. The client only ever chooses a mode — the
 * dates are always resolved on the server.
 */
export type GoogleSyncMode = 'incremental' | 'full'

export interface GoogleSyncResult {
  provider: typeof GOOGLE_ADS_SOURCE
  /** The mode that actually ran (an escalated initial sync reports `full`). */
  mode: GoogleSyncMode
  /** True when an incremental request became a full import because no data existed yet. */
  initialSync: boolean
  /** Masked customer id — the raw id never leaves the server. */
  accountId: string
  /** The period actually synchronised. */
  period: { since: string | null; until: string | null }
  fetchedDays: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  totalSpend: number
  currency: string
  /** IANA time zone the days were reported in. */
  timeZone: string
  syncedAt: string
  conflicts: GoogleSyncConflict[]
  warnings: string[]
}

export interface GoogleSyncInput {
  /** Defaults to 'incremental'. */
  mode?: GoogleSyncMode
}

export interface GoogleSyncDeps {
  /** Injected Google Ads config (defaults to env-derived config). */
  config?: GoogleAdsConfig
  /** Injected account metadata fetcher (defaults to the real client). */
  fetchAccountInfo?: () => Promise<GoogleAdsAccountInfo>
  /** Injected daily-spend fetcher; called once per chunk. */
  fetchDailySpend?: (range: GoogleSpendRange, currency: string) => Promise<GoogleDailySpend[]>
  /** Injected earliest-day probe used to start a full import. */
  fetchEarliestDate?: (range: GoogleSpendRange) => Promise<string | null>
  /** Injected clock for deterministic tests. */
  now?: () => Date
  /** Injected last imported day for this account (tests); defaults to a DB lookup. */
  lastExternalDate?: string | null
  /** Override the full-import chunk size (tests). */
  chunkDays?: number
}

/** Deterministic per-day key. The customer id is a plain account number — never a secret. */
export function buildExternalKey(customerId: string, date: string): string {
  return `${EXTERNAL_KEY_PREFIX}:${customerId}:${date}`
}

/** Parse the requested sync mode from an untrusted body value. Defaults to 'incremental'. */
export function parseSyncMode(raw: unknown): GoogleSyncMode {
  if (raw === undefined || raw === null || raw === '') return 'incremental'
  if (raw === 'incremental' || raw === 'full') return raw
  throw new GoogleSyncValidationError('Ugyldig synkroniseringsmodus.')
}

/**
 * Validate a display-filter date window (both empty = everything, exactly one = error).
 * Same contract as the Meta page filter.
 */
export function validateSyncDates(input: { since?: string; until?: string }): {
  since?: string
  until?: string
} {
  const since = input.since?.trim() || undefined
  const until = input.until?.trim() || undefined

  if (!since && !until) return {}
  if (!since || !until) {
    throw new GoogleSyncValidationError('Fyll inn begge datoene, eller la begge stå tomme.')
  }
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) {
    throw new GoogleSyncValidationError('Datoer må være på formatet ÅÅÅÅ-MM-DD.')
  }
  if (since > until) {
    throw new GoogleSyncValidationError('«Periode fra» kan ikke være etter «Periode til».')
  }
  return { since, until }
}

// In-process lock. Best-effort only: it does not span serverless instances, so the UNIQUE
// index remains the durable guarantee against duplicates.
const activeSyncs = new Set<string>()

/** Midnight-UTC ISO for a YYYY-MM-DD day (how imported day records store their dates). */
function dayStartIso(date: string): string {
  return `${date}T00:00:00.000Z`
}
function dayEndIso(date: string): string {
  return `${date}T23:59:59.999Z`
}

interface ExpenseWriteFields {
  channel: typeof GOOGLE_ADS_CHANNEL
  source: typeof GOOGLE_ADS_SOURCE
  amount: number
  vatRate: number
  date: string
  periodFrom: string
  periodTo: string
  description: string
  externalReference: string
  externalKey: string
  externalAccountId: string
  externalDate: string
  lastSyncedAt: string
  syncMetadata: Record<string, unknown>
}

function buildDayFields(
  day: GoogleDailySpend,
  customerId: string,
  nowIso: string,
  config: GoogleAdsConfig,
  timeZone: string,
): ExpenseWriteFields {
  return {
    channel: GOOGLE_ADS_CHANNEL,
    source: GOOGLE_ADS_SOURCE,
    amount: round2(day.spend),
    // Reverse charge: the imported amount is already net, so it is counted in full.
    vatRate: GOOGLE_ADS_VAT_RATE,
    // The day is stored as a plain calendar date at midnight UTC — the string is used
    // verbatim, so no timezone conversion can shift it to the previous/next day.
    date: dayStartIso(day.date),
    periodFrom: dayStartIso(day.date),
    periodTo: dayStartIso(day.date),
    description: `Google Ads – ${day.date}`,
    externalReference: `Google Ads API / ${customerId}`,
    externalKey: buildExternalKey(customerId, day.date),
    externalAccountId: customerId,
    externalDate: day.date,
    lastSyncedAt: nowIso,
    syncMetadata: {
      costMicros: day.costMicros,
      spend: round2(day.spend),
      currency: day.currency,
      timeZone,
      apiVersion: config.apiVersion,
      fetchedAt: nowIso,
      // Never store tokens or secrets here.
    },
  }
}

type ManualGoogleRow = Pick<
  MarketingExpense,
  'id' | 'description' | 'periodFrom' | 'periodTo' | 'amount' | 'date' | 'source'
>

/** Manual Google Ads rows whose date/period overlaps [startIso, endIso]. One query. */
async function findManualGoogleConflicts(
  payload: Payload,
  startIso: string,
  endIso: string,
): Promise<GoogleSyncConflict[]> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { channel: { equals: GOOGLE_ADS_CHANNEL } },
        { or: [{ source: { not_equals: GOOGLE_ADS_SOURCE } }, { source: { exists: false } }] },
        {
          or: [
            { and: [{ date: { greater_than_equal: startIso } }, { date: { less_than_equal: endIso } }] },
            {
              and: [
                { periodFrom: { less_than_equal: endIso } },
                { periodTo: { greater_than_equal: startIso } },
              ],
            },
          ],
        },
      ],
    },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  })

  return (result.docs as ManualGoogleRow[]).map((d) => ({
    id: String(d.id),
    description: d.description ?? undefined,
    periodFrom: d.periodFrom ?? undefined,
    periodTo: d.periodTo ?? undefined,
    amount: typeof d.amount === 'number' ? d.amount : undefined,
  }))
}

/**
 * Latest imported day (externalDate) for this ad account, or null when nothing has been
 * imported yet. Scoped to source = 'google-ads' AND this customer id, so Meta rows (or a
 * different Google account) can never influence the window. `externalDate` is stored as
 * YYYY-MM-DD, so a descending sort is chronological.
 */
export async function findLastExternalDate(
  payload: Payload,
  customerId: string,
): Promise<string | null> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { source: { equals: GOOGLE_ADS_SOURCE } },
        { externalAccountId: { equals: customerId } },
      ],
    },
    depth: 0,
    limit: 1,
    sort: '-externalDate',
    overrideAccess: true,
  })
  const doc = result.docs[0] as MarketingExpense | undefined
  const date = doc?.externalDate
  return typeof date === 'string' && DATE_RE.test(date) ? date : null
}

/**
 * Fetch Google Ads daily spend and upsert one marketing-expenses record per day.
 *
 * The window is always resolved server-side from the mode:
 *  - `full`                      → the account's first day with data … today;
 *  - `incremental`, no data yet  → escalates to a full import (initialSync = true);
 *  - `incremental`, data exists  → lastExternalDate − 13 days … today, so Google's
 *                                  retroactive spend corrections are picked up.
 *
 * "Today" is the calendar day in the *ad account's* time zone, because that is the day
 * Google reports `segments.date` in. A full window is fetched in ≤90-day chunks, in
 * chronological order, to stay inside API quotas.
 *
 * When a manual Google Ads expense overlaps the target window, no records are written and
 * the conflicts are returned so the caller can stop with a clear message.
 */
export async function runGoogleAdsSync(
  payload: Payload,
  input: GoogleSyncInput = {},
  deps: GoogleSyncDeps = {},
): Promise<GoogleSyncResult> {
  const requestedMode: GoogleSyncMode = input.mode ?? 'incremental'
  const config = deps.config ?? getGoogleAdsConfig()
  const customerId = config.customerId
  const nowFn = deps.now ?? (() => new Date())
  const now = nowFn()
  const nowIso = now.toISOString()

  const fetchAccountInfo =
    deps.fetchAccountInfo ?? (() => getGoogleAdsAccountInfo({ config }))
  const fetchDailySpend =
    deps.fetchDailySpend ??
    ((range: GoogleSpendRange, currency: string) => getGoogleAdsDailySpend(range, currency, { config }))
  const fetchEarliestDate =
    deps.fetchEarliestDate ?? ((range: GoogleSpendRange) => findEarliestSpendDate(range, { config }))

  const warnings: string[] = []

  if (activeSyncs.has(customerId)) throw new GoogleSyncInProgressError()
  activeSyncs.add(customerId)
  try {
    // --- Account metadata first: it decides the currency guard and what "today" means. ---
    const account = await fetchAccountInfo()
    assertSupportedCurrency(account.currencyCode)
    const currency = account.currencyCode || 'NOK'
    const timeZone = account.timeZone || 'UTC'
    const today = todayForAccount(now, account.timeZone)

    // --- Resolve the sync window (never supplied by the client) ---
    const lastExternalDate =
      deps.lastExternalDate !== undefined
        ? deps.lastExternalDate
        : await findLastExternalDate(payload, customerId)

    let mode: GoogleSyncMode = requestedMode
    let initialSync = false
    if (requestedMode === 'incremental' && !lastExternalDate) {
      // Nothing imported for this account yet — pull everything once.
      mode = 'full'
      initialSync = true
    }

    let window: GoogleSpendRange | null
    if (mode === 'full') {
      // Ask Google where the history actually starts instead of assuming a depth. The probe
      // floor (GOOGLE_ADS_HISTORY_START) is documented and configurable, never silent.
      const earliest = await fetchEarliestDate({ since: config.historyStart, until: today })
      window = earliest ? { since: earliest, until: today } : null
      if (!earliest) {
        warnings.push('Google Ads har ingen registrerte kostnader for denne kontoen ennå.')
      }
    } else {
      window = computeIncrementalWindow(lastExternalDate as string, today)
    }

    // --- Fetch, chunked so a long history never becomes one unbounded request ---
    const days: GoogleDailySpend[] = []
    if (window) {
      const chunks = fullSyncChunks(window.since, window.until, deps.chunkDays ?? FULL_SYNC_CHUNK_DAYS)
      for (const chunk of chunks) {
        days.push(...(await fetchDailySpend(chunk, currency)))
      }
    }

    const totalSpend = round2(
      days.reduce((sum, d) => sum + (Number.isFinite(d.spend) ? d.spend : 0), 0),
    )
    const fetchedDays = days.length
    const actualSince = window?.since ?? null
    const actualUntil = window?.until ?? null
    const maskedAccount = maskCustomerId(customerId)

    const baseResult = (
      conflicts: GoogleSyncConflict[],
      counts: { created: number; updated: number; unchanged: number; skipped: number },
    ): GoogleSyncResult => ({
      provider: GOOGLE_ADS_SOURCE,
      mode,
      initialSync,
      accountId: maskedAccount,
      period: { since: actualSince, until: actualUntil },
      fetchedDays,
      ...counts,
      totalSpend,
      currency,
      timeZone,
      syncedAt: nowIso,
      conflicts,
      warnings,
    })

    const zero = { created: 0, updated: 0, unchanged: 0, skipped: 0 }

    // --- Conflict gate: never write when a manual Google Ads entry overlaps the window. ---
    if (fetchedDays > 0 && actualSince && actualUntil) {
      const conflicts = await findManualGoogleConflicts(
        payload,
        dayStartIso(actualSince),
        dayEndIso(actualUntil),
      )
      if (conflicts.length > 0) {
        warnings.push(
          'Fant manuelle Google Ads-kostnader som overlapper perioden. Synkronisering er stoppet for å unngå dobbelttelling.',
        )
        return baseResult(conflicts, zero)
      }
    }

    let created = 0
    let updated = 0
    let unchanged = 0
    let skipped = 0

    for (const day of days) {
      const fields = buildDayFields(day, customerId, nowIso, config, timeZone)
      const existing = await payload.find({
        collection: 'marketing-expenses',
        where: { externalKey: { equals: fields.externalKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })

      const current = existing.docs[0] as MarketingExpense | undefined

      if (!current) {
        try {
          await payload.create({
            collection: 'marketing-expenses',
            data: fields,
            overrideAccess: true,
          })
          created += 1
        } catch (err) {
          // A concurrent run may have inserted the same day between our find and create
          // (UNIQUE index). Re-read and reconcile as update/unchanged instead of failing.
          const raced = await payload.find({
            collection: 'marketing-expenses',
            where: { externalKey: { equals: fields.externalKey } },
            depth: 0,
            limit: 1,
            overrideAccess: true,
          })
          const now = raced.docs[0] as MarketingExpense | undefined
          if (!now) throw err
          const outcome = await reconcile(payload, now, fields)
          if (outcome === 'updated') updated += 1
          else unchanged += 1
        }
        continue
      }

      if (current.source !== GOOGLE_ADS_SOURCE) {
        // A manual row somehow carries this externalKey — never overwrite it.
        skipped += 1
        warnings.push(
          `Hoppet over ${day.date}: en manuell rad har samme nøkkel og røres ikke automatisk.`,
        )
        continue
      }

      const outcome = await reconcile(payload, current, fields)
      if (outcome === 'updated') updated += 1
      else unchanged += 1
    }

    return baseResult([], { created, updated, unchanged, skipped })
  } finally {
    activeSyncs.delete(customerId)
  }
}

/** Update a google-ads row only when the amount or VAT rate actually changed. */
async function reconcile(
  payload: Payload,
  current: MarketingExpense,
  fields: ExpenseWriteFields,
): Promise<'updated' | 'unchanged'> {
  const sameAmount = round2(typeof current.amount === 'number' ? current.amount : 0) === fields.amount
  const sameVat = round2(typeof current.vatRate === 'number' ? current.vatRate : 0) === round2(fields.vatRate)
  if (sameAmount && sameVat) return 'unchanged'

  await payload.update({
    collection: 'marketing-expenses',
    id: current.id,
    data: {
      amount: fields.amount,
      vatRate: fields.vatRate,
      lastSyncedAt: fields.lastSyncedAt,
      syncMetadata: fields.syncMetadata,
    },
    overrideAccess: true,
  })
  return 'updated'
}
