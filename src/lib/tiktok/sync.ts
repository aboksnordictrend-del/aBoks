// Orchestrates the TikTok Ads → marketing-expenses upsert. Structurally identical to
// src/lib/pinterest/sync.ts: decoupled from HTTP (the endpoint validates auth/input and maps
// errors to status codes) and from the TikTok client (every fetcher is injected, so tests
// never hit the network).
//
// Duplicate protection is layered exactly as for Meta, Google Ads and Pinterest Ads:
//   1. a deterministic `externalKey = tiktok:{advertiserId}:{YYYY-MM-DD}` per day, which
//      makes (source, externalAccountId, externalDate) unique by construction;
//   2. the UNIQUE index on external_key (durable — survives a double-click / two instances);
//   3. a best-effort in-process lock per advertiser (rejects an overlapping run early).
// Manual records are never updated or deleted, and a period that overlaps a manual TikTok Ads
// entry stops the import before any write, so analytics can never double-count.

import type { Payload } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import { round2 } from '@/lib/analytics/money'
import { DATE_RE, maxDate } from '@/lib/marketing/dateMath'
import {
  assertSupportedCurrency,
  getAdvertiserInfoIfPermitted,
  resolveCurrency,
} from './accounts'
import { getTikTokAdsConfig, maskAdvertiserId, type TikTokAdsConfig } from './config'
import { notConnectedError } from './errors'
import { getTikTokDailySpend, type TikTokSpendRange } from './reports'
import {
  computeIncrementalWindow,
  fullSyncChunks,
  todayForAdvertiser,
  FULL_SYNC_CHUNK_DAYS,
} from './syncWindow'
import { getStoredConnection, resolveAccessToken, resolveAdvertiserId } from './tokenStore'
import type {
  TikTokAdvertiserInfo,
  TikTokConnectionInfo,
  TikTokCurrencySource,
  TikTokDailySpend,
} from './types'

/** Stable provider id used for `source`, external keys and sync state. */
export const TIKTOK_ADS_SOURCE = 'tiktok-ads'
export const TIKTOK_ADS_CHANNEL = 'tiktok'
const EXTERNAL_KEY_PREFIX = 'tiktok'

/**
 * VAT rate written on every imported TikTok Ads day — deliberately **0**, and deliberately
 * not a setting.
 *
 * `computeMarketingExVat` treats `amount` as gross and derives `amountExVat = amount / (1 +
 * vatRate/100)`, and the analytics layer spends `amountExVat`. TikTok invoices Norwegian
 * businesses from its Irish entity as a cross-border electronic service under reverse charge:
 * the invoice carries no Norwegian MVA, so the reported spend already *is* the net cost.
 * Writing 25 here would silently divide every TikTok Ads cost by 1.25 and understate
 * marketing spend by 20 % in every KPI, ROAS and channel breakdown.
 *
 * With 0, `amountExVat === amount` and the imported figure is counted in full — the same rule
 * Google Ads and Pinterest Ads use. Meta keeps its own configurable `metaAdsVatRate`; that is
 * untouched.
 */
export const TIKTOK_ADS_VAT_RATE = 0

export class TikTokSyncValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TikTokSyncValidationError'
  }
}

export class TikTokSyncInProgressError extends Error {
  constructor(message = 'En synkronisering pågår allerede for denne kontoen.') {
    super(message)
    this.name = 'TikTokSyncInProgressError'
  }
}

/**
 * The advertiser's reporting currency could not be established.
 *
 * Raised rather than defaulting to NOK. TikTok exposes a currency only on
 * `GET /advertiser/info/`, which needs the Ad Account Management scope; with a Reporting-only
 * app the value has to be declared through TIKTOK_ADVERTISER_CURRENCY. Guessing would silently
 * mis-state every marketing KPI, so the import stops until the operator states it.
 */
export class TikTokCurrencyUnknownError extends Error {
  constructor(
    message = 'Valutaen til TikTok-annonsekontoen er ukjent. TikTok oppgir den bare via /advertiser/info/, som krever tillatelsen «Ad Account Management». Kontroller valutaen i TikTok Ads Manager og sett TIKTOK_ADVERTISER_CURRENCY (f.eks. NOK).',
  ) {
    super(message)
    this.name = 'TikTokCurrencyUnknownError'
  }
}

/** The integration is configured but no advertiser has been chosen yet. */
export class TikTokAdvertiserNotSelectedError extends Error {
  constructor(
    message = 'Ingen TikTok-annonsekonto er valgt. Koble til TikTok, eller sett TIKTOK_ADVERTISER_ID.',
  ) {
    super(message)
    this.name = 'TikTokAdvertiserNotSelectedError'
  }
}

/** A manual TikTok Ads expense that overlaps the requested period (blocks the import). */
export interface TikTokSyncConflict {
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
export type TikTokSyncMode = 'incremental' | 'full'

export interface TikTokSyncResult {
  provider: typeof TIKTOK_ADS_SOURCE
  /** The mode that actually ran (an escalated initial sync reports `full`). */
  mode: TikTokSyncMode
  /** The mode the caller asked for, before any escalation. */
  requestedMode: TikTokSyncMode
  /** True when an incremental request became a full import because no data existed yet. */
  initialSync: boolean
  /** Masked advertiser id — the raw id never leaves the server. */
  accountId: string
  /** Advertiser name, when TikTok reports one. Safe to display. */
  accountName: string | null
  /** The period actually synchronised. */
  period: { since: string | null; until: string | null }
  fetchedDays: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  totalSpend: number
  currency: string
  /** Where `currency` came from — TikTok itself, env config, or the stored connection. */
  currencySource: TikTokCurrencySource
  /**
   * False when `advertiser/info` was unavailable, so time zone and creation date fell back to
   * their defaults. The spend figures are unaffected.
   */
  metadataAvailable: boolean
  syncedAt: string
  conflicts: TikTokSyncConflict[]
  warnings: string[]
}

export interface TikTokSyncInput {
  /** Defaults to 'incremental'. */
  mode?: TikTokSyncMode
}

export interface TikTokSyncDeps {
  /** Injected TikTok Ads config (defaults to env-derived config). */
  config?: TikTokAdsConfig
  /** Injected access token (defaults to env / the stored connection). */
  accessToken?: string
  /** Injected advertiser id (defaults to env / the stored connection). */
  advertiserId?: string
  /**
   * Injected advertiser metadata fetcher (defaults to the real, best-effort client).
   * Resolving to null means "metadata unavailable" — never an error.
   */
  fetchAdvertiserInfo?: () => Promise<TikTokAdvertiserInfo | null>
  /** Injected stored connection (tests); defaults to a lookup on the global. */
  storedConnection?: TikTokConnectionInfo | null
  /** Injected daily-spend fetcher; called once per chunk. */
  fetchDailySpend?: (range: TikTokSpendRange, currency: string) => Promise<TikTokDailySpend[]>
  /** Injected clock for deterministic tests. */
  now?: () => Date
  /** Injected last imported day for this advertiser (tests); defaults to a DB lookup. */
  lastExternalDate?: string | null
  /** Override the full-import chunk size (tests). */
  chunkDays?: number
}

/** Deterministic per-day key. The advertiser id is a plain account number — never a secret. */
export function buildExternalKey(advertiserId: string, date: string): string {
  return `${EXTERNAL_KEY_PREFIX}:${advertiserId}:${date}`
}

/** Parse the requested sync mode from an untrusted body value. Defaults to 'incremental'. */
export function parseSyncMode(raw: unknown): TikTokSyncMode {
  if (raw === undefined || raw === null || raw === '') return 'incremental'
  if (raw === 'incremental' || raw === 'full') return raw
  throw new TikTokSyncValidationError('Ugyldig synkroniseringsmodus.')
}

/**
 * Validate a display-filter date window (both empty = everything, exactly one = error).
 * Same contract as the Meta, Google Ads and Pinterest Ads page filters.
 */
export function validateSyncDates(input: { since?: string; until?: string }): {
  since?: string
  until?: string
} {
  const since = input.since?.trim() || undefined
  const until = input.until?.trim() || undefined

  if (!since && !until) return {}
  if (!since || !until) {
    throw new TikTokSyncValidationError('Fyll inn begge datoene, eller la begge stå tomme.')
  }
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) {
    throw new TikTokSyncValidationError('Datoer må være på formatet ÅÅÅÅ-MM-DD.')
  }
  if (since > until) {
    throw new TikTokSyncValidationError('«Periode fra» kan ikke være etter «Periode til».')
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
  channel: typeof TIKTOK_ADS_CHANNEL
  source: typeof TIKTOK_ADS_SOURCE
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
  day: TikTokDailySpend,
  advertiserId: string,
  nowIso: string,
  config: TikTokAdsConfig,
  timezone: string | null,
): ExpenseWriteFields {
  return {
    channel: TIKTOK_ADS_CHANNEL,
    source: TIKTOK_ADS_SOURCE,
    amount: round2(day.spend),
    // Reverse charge: the imported amount is already net, so it is counted in full.
    vatRate: TIKTOK_ADS_VAT_RATE,
    // The day is stored as a plain calendar date at midnight UTC — the string comes straight
    // from TikTok's stat_time_day and is used verbatim, so no timezone conversion can shift
    // it to the previous/next day.
    date: dayStartIso(day.date),
    periodFrom: dayStartIso(day.date),
    periodTo: dayStartIso(day.date),
    description: `TikTok Ads – ${day.date}`,
    externalReference: `TikTok Ads API / ${advertiserId}`,
    externalKey: buildExternalKey(advertiserId, day.date),
    externalAccountId: advertiserId,
    externalDate: day.date,
    lastSyncedAt: nowIso,
    syncMetadata: {
      spend: round2(day.spend),
      currency: day.currency,
      advertiserId,
      // The advertiser's reporting zone, recorded so a later reader can tell which calendar
      // the stored day belongs to. Never a secret.
      timezone,
      apiVersion: config.apiVersion,
      fetchedAt: nowIso,
      // Never store tokens or secrets here.
    },
  }
}

type ManualTikTokRow = Pick<
  MarketingExpense,
  'id' | 'description' | 'periodFrom' | 'periodTo' | 'amount' | 'date' | 'source'
>

/** Manual TikTok Ads rows whose date/period overlaps [startIso, endIso]. One query. */
async function findManualTikTokConflicts(
  payload: Payload,
  startIso: string,
  endIso: string,
): Promise<TikTokSyncConflict[]> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { channel: { equals: TIKTOK_ADS_CHANNEL } },
        { or: [{ source: { not_equals: TIKTOK_ADS_SOURCE } }, { source: { exists: false } }] },
        {
          or: [
            {
              and: [
                { date: { greater_than_equal: startIso } },
                { date: { less_than_equal: endIso } },
              ],
            },
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

  return (result.docs as ManualTikTokRow[]).map((d) => ({
    id: String(d.id),
    description: d.description ?? undefined,
    periodFrom: d.periodFrom ?? undefined,
    periodTo: d.periodTo ?? undefined,
    amount: typeof d.amount === 'number' ? d.amount : undefined,
  }))
}

/**
 * Latest imported day (externalDate) for this advertiser, or null when nothing has been
 * imported yet. Scoped to source = 'tiktok-ads' AND this advertiser id, so Meta/Google/
 * Pinterest rows (or a different TikTok advertiser) can never influence the window.
 * `externalDate` is stored as YYYY-MM-DD, so a descending sort is chronological.
 */
export async function findLastExternalDate(
  payload: Payload,
  advertiserId: string,
): Promise<string | null> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { source: { equals: TIKTOK_ADS_SOURCE } },
        { externalAccountId: { equals: advertiserId } },
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
 * Fetch TikTok Ads daily spend and upsert one marketing-expenses record per day.
 *
 * The window is always resolved server-side from the mode:
 *  - `full`                      → the advertiser's creation day … today;
 *  - `incremental`, no data yet  → escalates to a full import (initialSync = true);
 *  - `incremental`, data exists  → lastExternalDate − 13 days … today, so TikTok's ~11-hour
 *                                  reporting latency and retroactive corrections are picked up.
 *
 * A window is fetched in ≤30-day chunks, in chronological order — TikTok rejects a wider
 * range on a `stat_time_day` report outright, so this is a hard requirement rather than only
 * a quota courtesy. A failure in any chunk propagates: the run never reports success after a
 * partial retrieval.
 *
 * Days with zero spend are skipped rather than stored: a day on which nothing was spent is
 * not a cost, and an empty row would only pad the imported-days count. The one exception is a
 * day that *was* imported with spend and has since been corrected down to 0 — that row is
 * updated, so a stale cost can never survive a sync.
 *
 * When a manual TikTok Ads expense overlaps the target window, no records are written and the
 * conflicts are returned so the caller can stop with a clear message.
 */
export async function runTikTokAdsSync(
  payload: Payload,
  input: TikTokSyncInput = {},
  deps: TikTokSyncDeps = {},
): Promise<TikTokSyncResult> {
  const requestedMode: TikTokSyncMode = input.mode ?? 'incremental'
  const config = deps.config ?? getTikTokAdsConfig()
  const nowFn = deps.now ?? (() => new Date())
  const now = nowFn()
  const nowIso = now.toISOString()

  // Credentials: env first (TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID), then the stored
  // OAuth connection. Neither value is ever logged or returned.
  const accessToken =
    deps.accessToken ?? (await resolveAccessToken(payload, config.accessToken)) ?? ''
  if (!accessToken) throw notConnectedError()

  const advertiserId =
    deps.advertiserId ?? (await resolveAdvertiserId(payload, config.advertiserId))
  if (!advertiserId) throw new TikTokAdvertiserNotSelectedError()

  const fetchAdvertiserInfo =
    deps.fetchAdvertiserInfo ??
    (() =>
      getAdvertiserInfoIfPermitted(config, accessToken, advertiserId, {
        // Refused metadata is a logged fact, not a failure — the spend import does not need it.
        onUnavailable: (err) => payload.logger?.warn?.(err.logLine()),
      }))
  const fetchDailySpend =
    deps.fetchDailySpend ??
    ((range: TikTokSpendRange, currency: string) =>
      getTikTokDailySpend(config, accessToken, advertiserId, range, currency))

  const warnings: string[] = []

  if (activeSyncs.has(advertiserId)) throw new TikTokSyncInProgressError()
  activeSyncs.add(advertiserId)
  try {
    // --- Advertiser metadata: best-effort. `advertiser/info` needs the Ad Account Management
    // --- scope, which a Reporting-only app does not have, so a null result is expected and
    // --- must not stop the import. Everything it would have supplied has a safe fallback:
    // ---   currency  → TIKTOK_ADVERTISER_CURRENCY / the stored connection (never guessed);
    // ---   name      → the name captured from oauth2/advertiser/get at connect time;
    // ---   timezone  → UTC (the 14-day overlap re-pulls any day-boundary drift);
    // ---   created   → the configured history floor.
    const account = await fetchAdvertiserInfo()
    const metadataAvailable = account !== null

    const stored =
      deps.storedConnection !== undefined
        ? deps.storedConnection
        : await getStoredConnection(payload)

    const resolved = resolveCurrency({
      fromAdvertiserInfo: account?.currency,
      fromConfig: config.advertiserCurrency,
      fromStored: stored?.currency,
    })
    // Unknown is a hard stop: a guessed currency would silently mis-state every KPI.
    if (!resolved.code) throw new TikTokCurrencyUnknownError()
    assertSupportedCurrency(resolved.code)
    const currency = resolved.code

    const accountName = account?.name ?? stored?.advertiserName ?? null
    const timezone = account?.timezone ?? stored?.timezone ?? null
    const today = todayForAdvertiser(now, timezone)

    if (!metadataAvailable) {
      warnings.push(
        'TikTok ga ikke tilgang til kontodetaljer (/advertiser/info/ krever «Ad Account Management»). Valuta er hentet fra oppsettet, og tidssone/opprettelsesdato bruker standardverdier. Kostnadene er ikke påvirket.',
      )
    }

    // --- Resolve the sync window (never supplied by the client) ---
    const lastExternalDate =
      deps.lastExternalDate !== undefined
        ? deps.lastExternalDate
        : await findLastExternalDate(payload, advertiserId)

    let mode: TikTokSyncMode = requestedMode
    let initialSync = false
    if (requestedMode === 'incremental' && !lastExternalDate) {
      // Nothing imported for this advertiser yet — pull everything once.
      mode = 'full'
      initialSync = true
    }

    let window: TikTokSpendRange | null
    if (mode === 'full') {
      // TikTok has no "when does this account's history start?" query, so the advertiser's
      // own creation day is the natural start — never earlier than the documented,
      // configurable floor (TIKTOK_HISTORY_START), never later than today.
      const start = account?.createdDate
        ? maxDate(account.createdDate, config.historyStart)
        : config.historyStart
      window = start <= today ? { since: start, until: today } : null
      if (!window) {
        warnings.push('TikTok-annonsekontoen er nyere enn dagens dato — ingenting å importere.')
      }
    } else {
      window = computeIncrementalWindow(lastExternalDate as string, today)
    }

    // --- Fetch, chunked so a long history never becomes one over-wide request ---
    const days: TikTokDailySpend[] = []
    if (window) {
      const chunks = fullSyncChunks(
        window.since,
        window.until,
        deps.chunkDays ?? FULL_SYNC_CHUNK_DAYS,
      )
      for (const chunk of chunks) {
        // No try/catch: a failed chunk must abort the whole run rather than silently yield a
        // partial import that would then be reported as a success.
        days.push(...(await fetchDailySpend(chunk, currency)))
      }
    }

    const totalSpend = round2(
      days.reduce((sum, d) => sum + (Number.isFinite(d.spend) ? d.spend : 0), 0),
    )
    const fetchedDays = days.length
    const actualSince = window?.since ?? null
    const actualUntil = window?.until ?? null
    const maskedAccount = maskAdvertiserId(advertiserId)

    const baseResult = (
      conflicts: TikTokSyncConflict[],
      counts: { created: number; updated: number; unchanged: number; skipped: number },
    ): TikTokSyncResult => ({
      provider: TIKTOK_ADS_SOURCE,
      mode,
      requestedMode,
      initialSync,
      accountId: maskedAccount,
      accountName,
      period: { since: actualSince, until: actualUntil },
      fetchedDays,
      ...counts,
      totalSpend,
      currency,
      currencySource: resolved.source,
      metadataAvailable,
      syncedAt: nowIso,
      conflicts,
      warnings,
    })

    const zero = { created: 0, updated: 0, unchanged: 0, skipped: 0 }

    // --- Conflict gate: never write when a manual TikTok Ads entry overlaps the window. ---
    if (fetchedDays > 0 && actualSince && actualUntil) {
      const conflicts = await findManualTikTokConflicts(
        payload,
        dayStartIso(actualSince),
        dayEndIso(actualUntil),
      )
      if (conflicts.length > 0) {
        warnings.push(
          'Fant manuelle TikTok Ads-kostnader som overlapper perioden. Synkronisering er stoppet for å unngå dobbelttelling.',
        )
        return baseResult(conflicts, zero)
      }
    }

    let created = 0
    let updated = 0
    let unchanged = 0
    let skipped = 0

    for (const day of days) {
      const fields = buildDayFields(day, advertiserId, nowIso, config, timezone)
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

      if (current.source !== TIKTOK_ADS_SOURCE) {
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
    activeSyncs.delete(advertiserId)
  }
}

/** Update a tiktok-ads row only when the amount or VAT rate actually changed. */
async function reconcile(
  payload: Payload,
  current: MarketingExpense,
  fields: ExpenseWriteFields,
): Promise<'updated' | 'unchanged'> {
  const sameAmount =
    round2(typeof current.amount === 'number' ? current.amount : 0) === fields.amount
  const sameVat =
    round2(typeof current.vatRate === 'number' ? current.vatRate : 0) === round2(fields.vatRate)
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
