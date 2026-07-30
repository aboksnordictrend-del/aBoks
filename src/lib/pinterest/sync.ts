// Orchestrates the Pinterest Ads → marketing-expenses upsert. Structurally identical to
// src/lib/google/sync.ts: decoupled from HTTP (the endpoint validates auth/input and maps
// errors to status codes) and from the Pinterest client (every fetcher is injected, so tests
// never hit the network).
//
// Duplicate protection is layered exactly as for Meta and Google Ads:
//   1. a deterministic `externalKey = pinterest:{adAccountId}:{YYYY-MM-DD}` per day, which
//      makes (source, externalAccountId, externalDate) unique by construction;
//   2. the UNIQUE index on external_key (durable — survives a double-click / two instances);
//   3. a best-effort in-process lock per account (rejects an overlapping run early).
// Manual records are never updated or deleted, and a period that overlaps a manual Pinterest
// Ads entry stops the import before any write, so analytics can never double-count.

import type { Payload } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import { round2 } from '@/lib/analytics/money'
import { DATE_RE, maxDate } from '@/lib/marketing/dateMath'
import {
  getPinterestAdAccountInfo,
  getPinterestDailySpend,
  assertSupportedCurrency,
  type PinterestSpendRange,
} from './ads'
import { getPinterestAdsConfig, maskAdAccountId, type PinterestAdsConfig } from './config'
import { computeIncrementalWindow, fullSyncChunks, todayForAccount, FULL_SYNC_CHUNK_DAYS } from './syncWindow'
import type { PinterestAdAccountInfo, PinterestDailySpend } from './types'

/** Stable provider id used for `source`, external keys and sync state. */
export const PINTEREST_ADS_SOURCE = 'pinterest-ads'
export const PINTEREST_ADS_CHANNEL = 'pinterest'
const EXTERNAL_KEY_PREFIX = 'pinterest'

/**
 * VAT rate written on every imported Pinterest Ads day — deliberately **0**, and deliberately
 * not a setting.
 *
 * `computeMarketingExVat` treats `amount` as gross and derives `amountExVat = amount / (1 +
 * vatRate/100)`, and the analytics layer spends `amountExVat`. Pinterest invoices Norwegian
 * businesses from its Irish entity as a cross-border electronic service under reverse charge:
 * the invoice carries no Norwegian MVA, so the reported spend already *is* the net cost.
 * Writing 25 here would silently divide every Pinterest Ads cost by 1.25 and understate
 * marketing spend by 20 % in every KPI, ROAS and channel breakdown.
 *
 * With 0, `amountExVat === amount` and the imported figure is counted in full — the same rule
 * Google Ads uses. Meta keeps its own configurable `metaAdsVatRate`; that is untouched.
 */
export const PINTEREST_ADS_VAT_RATE = 0

export class PinterestSyncValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinterestSyncValidationError'
  }
}

export class PinterestSyncInProgressError extends Error {
  constructor(message = 'En synkronisering pågår allerede for denne kontoen.') {
    super(message)
    this.name = 'PinterestSyncInProgressError'
  }
}

/** A manual Pinterest Ads expense that overlaps the requested period (blocks the import). */
export interface PinterestSyncConflict {
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
export type PinterestSyncMode = 'incremental' | 'full'

export interface PinterestSyncResult {
  provider: typeof PINTEREST_ADS_SOURCE
  /** The mode that actually ran (an escalated initial sync reports `full`). */
  mode: PinterestSyncMode
  /** True when an incremental request became a full import because no data existed yet. */
  initialSync: boolean
  /** Masked ad account id — the raw id never leaves the server. */
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
  syncedAt: string
  conflicts: PinterestSyncConflict[]
  warnings: string[]
}

export interface PinterestSyncInput {
  /** Defaults to 'incremental'. */
  mode?: PinterestSyncMode
}

export interface PinterestSyncDeps {
  /** Injected Pinterest Ads config (defaults to env-derived config). */
  config?: PinterestAdsConfig
  /** Injected account metadata fetcher (defaults to the real client). */
  fetchAccountInfo?: () => Promise<PinterestAdAccountInfo>
  /** Injected daily-spend fetcher; called once per chunk. */
  fetchDailySpend?: (
    range: PinterestSpendRange,
    currency: string,
  ) => Promise<PinterestDailySpend[]>
  /** Injected clock for deterministic tests. */
  now?: () => Date
  /** Injected last imported day for this account (tests); defaults to a DB lookup. */
  lastExternalDate?: string | null
  /** Override the full-import chunk size (tests). */
  chunkDays?: number
}

/** Deterministic per-day key. The ad account id is a plain account number — never a secret. */
export function buildExternalKey(adAccountId: string, date: string): string {
  return `${EXTERNAL_KEY_PREFIX}:${adAccountId}:${date}`
}

/** Parse the requested sync mode from an untrusted body value. Defaults to 'incremental'. */
export function parseSyncMode(raw: unknown): PinterestSyncMode {
  if (raw === undefined || raw === null || raw === '') return 'incremental'
  if (raw === 'incremental' || raw === 'full') return raw
  throw new PinterestSyncValidationError('Ugyldig synkroniseringsmodus.')
}

/**
 * Validate a display-filter date window (both empty = everything, exactly one = error).
 * Same contract as the Meta and Google Ads page filters.
 */
export function validateSyncDates(input: { since?: string; until?: string }): {
  since?: string
  until?: string
} {
  const since = input.since?.trim() || undefined
  const until = input.until?.trim() || undefined

  if (!since && !until) return {}
  if (!since || !until) {
    throw new PinterestSyncValidationError('Fyll inn begge datoene, eller la begge stå tomme.')
  }
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) {
    throw new PinterestSyncValidationError('Datoer må være på formatet ÅÅÅÅ-MM-DD.')
  }
  if (since > until) {
    throw new PinterestSyncValidationError('«Periode fra» kan ikke være etter «Periode til».')
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
  channel: typeof PINTEREST_ADS_CHANNEL
  source: typeof PINTEREST_ADS_SOURCE
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
  day: PinterestDailySpend,
  adAccountId: string,
  nowIso: string,
  config: PinterestAdsConfig,
): ExpenseWriteFields {
  return {
    channel: PINTEREST_ADS_CHANNEL,
    source: PINTEREST_ADS_SOURCE,
    amount: round2(day.spend),
    // Reverse charge: the imported amount is already net, so it is counted in full.
    vatRate: PINTEREST_ADS_VAT_RATE,
    // The day is stored as a plain calendar date at midnight UTC — the string is used
    // verbatim, so no timezone conversion can shift it to the previous/next day.
    date: dayStartIso(day.date),
    periodFrom: dayStartIso(day.date),
    periodTo: dayStartIso(day.date),
    description: `Pinterest Ads – ${day.date}`,
    externalReference: `Pinterest Ads API / ${adAccountId}`,
    externalKey: buildExternalKey(adAccountId, day.date),
    externalAccountId: adAccountId,
    externalDate: day.date,
    lastSyncedAt: nowIso,
    syncMetadata: {
      spendMicros: day.spendMicros,
      spend: round2(day.spend),
      currency: day.currency,
      adAccountId,
      apiVersion: config.apiVersion,
      fetchedAt: nowIso,
      // Never store tokens or secrets here.
    },
  }
}

type ManualPinterestRow = Pick<
  MarketingExpense,
  'id' | 'description' | 'periodFrom' | 'periodTo' | 'amount' | 'date' | 'source'
>

/** Manual Pinterest Ads rows whose date/period overlaps [startIso, endIso]. One query. */
async function findManualPinterestConflicts(
  payload: Payload,
  startIso: string,
  endIso: string,
): Promise<PinterestSyncConflict[]> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { channel: { equals: PINTEREST_ADS_CHANNEL } },
        { or: [{ source: { not_equals: PINTEREST_ADS_SOURCE } }, { source: { exists: false } }] },
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

  return (result.docs as ManualPinterestRow[]).map((d) => ({
    id: String(d.id),
    description: d.description ?? undefined,
    periodFrom: d.periodFrom ?? undefined,
    periodTo: d.periodTo ?? undefined,
    amount: typeof d.amount === 'number' ? d.amount : undefined,
  }))
}

/**
 * Latest imported day (externalDate) for this ad account, or null when nothing has been
 * imported yet. Scoped to source = 'pinterest-ads' AND this ad account id, so Meta/Google rows
 * (or a different Pinterest account) can never influence the window. `externalDate` is stored
 * as YYYY-MM-DD, so a descending sort is chronological.
 */
export async function findLastExternalDate(
  payload: Payload,
  adAccountId: string,
): Promise<string | null> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { source: { equals: PINTEREST_ADS_SOURCE } },
        { externalAccountId: { equals: adAccountId } },
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
 * Fetch Pinterest Ads daily spend and upsert one marketing-expenses record per day.
 *
 * The window is always resolved server-side from the mode:
 *  - `full`                      → the ad account's creation day … today;
 *  - `incremental`, no data yet  → escalates to a full import (initialSync = true);
 *  - `incremental`, data exists  → lastExternalDate − 13 days … today, so Pinterest's
 *                                  retroactive spend corrections are picked up.
 *
 * A full window is fetched in ≤90-day chunks, in chronological order — Pinterest rejects a
 * wider range outright, so this is a hard requirement rather than only a quota courtesy.
 *
 * Days with zero spend are skipped rather than stored: a day on which nothing was spent is
 * not a cost, and an empty row would only pad the imported-days count. The one exception is a
 * day that *was* imported with spend and has since been corrected down to 0 — that row is
 * updated, so a stale cost can never survive a sync.
 *
 * When a manual Pinterest Ads expense overlaps the target window, no records are written and
 * the conflicts are returned so the caller can stop with a clear message.
 */
export async function runPinterestAdsSync(
  payload: Payload,
  input: PinterestSyncInput = {},
  deps: PinterestSyncDeps = {},
): Promise<PinterestSyncResult> {
  const requestedMode: PinterestSyncMode = input.mode ?? 'incremental'
  const config = deps.config ?? getPinterestAdsConfig()
  const adAccountId = config.adAccountId
  const nowFn = deps.now ?? (() => new Date())
  const now = nowFn()
  const nowIso = now.toISOString()

  const fetchAccountInfo = deps.fetchAccountInfo ?? (() => getPinterestAdAccountInfo({ config }))
  const fetchDailySpend =
    deps.fetchDailySpend ??
    ((range: PinterestSpendRange, currency: string) =>
      getPinterestDailySpend(range, currency, { config }))

  const warnings: string[] = []

  if (activeSyncs.has(adAccountId)) throw new PinterestSyncInProgressError()
  activeSyncs.add(adAccountId)
  try {
    // --- Account metadata first: it decides the currency guard and the full-import start. ---
    const account = await fetchAccountInfo()
    assertSupportedCurrency(account.currency)
    const currency = account.currency || 'NOK'
    const today = todayForAccount(now)

    // --- Resolve the sync window (never supplied by the client) ---
    const lastExternalDate =
      deps.lastExternalDate !== undefined
        ? deps.lastExternalDate
        : await findLastExternalDate(payload, adAccountId)

    let mode: PinterestSyncMode = requestedMode
    let initialSync = false
    if (requestedMode === 'incremental' && !lastExternalDate) {
      // Nothing imported for this account yet — pull everything once.
      mode = 'full'
      initialSync = true
    }

    let window: PinterestSpendRange | null
    if (mode === 'full') {
      // Pinterest has no "when does this account's history start?" query, so the ad account's
      // own creation day is the natural start — never earlier than the documented,
      // configurable floor (PINTEREST_HISTORY_START), never later than today.
      const start = account.createdDate
        ? maxDate(account.createdDate, config.historyStart)
        : config.historyStart
      window = start <= today ? { since: start, until: today } : null
      if (!window) {
        warnings.push('Pinterest-annonsekontoen er nyere enn dagens dato — ingenting å importere.')
      }
    } else {
      window = computeIncrementalWindow(lastExternalDate as string, today)
    }

    // --- Fetch, chunked so a long history never becomes one over-wide request ---
    const days: PinterestDailySpend[] = []
    if (window) {
      const chunks = fullSyncChunks(
        window.since,
        window.until,
        deps.chunkDays ?? FULL_SYNC_CHUNK_DAYS,
      )
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
    const maskedAccount = maskAdAccountId(adAccountId)

    const baseResult = (
      conflicts: PinterestSyncConflict[],
      counts: { created: number; updated: number; unchanged: number; skipped: number },
    ): PinterestSyncResult => ({
      provider: PINTEREST_ADS_SOURCE,
      mode,
      initialSync,
      accountId: maskedAccount,
      period: { since: actualSince, until: actualUntil },
      fetchedDays,
      ...counts,
      totalSpend,
      currency,
      syncedAt: nowIso,
      conflicts,
      warnings,
    })

    const zero = { created: 0, updated: 0, unchanged: 0, skipped: 0 }

    // --- Conflict gate: never write when a manual Pinterest Ads entry overlaps the window. --
    if (fetchedDays > 0 && actualSince && actualUntil) {
      const conflicts = await findManualPinterestConflicts(
        payload,
        dayStartIso(actualSince),
        dayEndIso(actualUntil),
      )
      if (conflicts.length > 0) {
        warnings.push(
          'Fant manuelle Pinterest Ads-kostnader som overlapper perioden. Synkronisering er stoppet for å unngå dobbelttelling.',
        )
        return baseResult(conflicts, zero)
      }
    }

    let created = 0
    let updated = 0
    let unchanged = 0
    let skipped = 0

    for (const day of days) {
      const fields = buildDayFields(day, adAccountId, nowIso, config)
      const existing = await payload.find({
        collection: 'marketing-expenses',
        where: { externalKey: { equals: fields.externalKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })

      const current = existing.docs[0] as MarketingExpense | undefined

      // Zero spend is not a cost. A day never imported before is skipped outright; a day that
      // already has a record falls through to `reconcile`, which writes the correction to 0.
      if (fields.amount === 0 && !current) {
        skipped += 1
        continue
      }

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

      if (current.source !== PINTEREST_ADS_SOURCE) {
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
    activeSyncs.delete(adAccountId)
  }
}

/** Update a pinterest-ads row only when the amount or VAT rate actually changed. */
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
