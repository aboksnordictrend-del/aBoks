// Orchestrates the Meta → marketing-expenses upsert. Deliberately decoupled from HTTP
// (the endpoint validates auth/input and maps errors to status codes) and from the Meta
// client (the daily-spend fetcher is injected, so tests never hit the network).
//
// Duplicate protection is layered:
//   1. a deterministic `externalKey = meta:{accountId}:{YYYY-MM-DD}` per day;
//   2. a UNIQUE index on external_key (durable — survives a double-click / two instances);
//   3. a best-effort in-process lock per account (rejects an overlapping run early).
// Manual records are never updated or deleted, and a period that overlaps a manual Meta
// entry stops the import before any write, so analytics can never double-count.

import type { Payload } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import { round2 } from '@/lib/analytics/money'
import { getMetaConfig, type MetaConfig } from './config'
import { getMetaDailySpend } from './ads'
import { computeIncrementalWindow } from './syncWindow'
import type { MetaDailySpend } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class SyncValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncValidationError'
  }
}

export class SyncInProgressError extends Error {
  constructor(message = 'En synkronisering pågår allerede for denne kontoen.') {
    super(message)
    this.name = 'SyncInProgressError'
  }
}

/** A manual Meta expense that overlaps the requested period (blocks the import). */
export interface SyncConflict {
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
export type MetaSyncMode = 'incremental' | 'full'

/** Window passed to the Meta client. Both empty ⇒ the whole available history. */
export interface MetaSpendQuery {
  since?: string
  until?: string
}

export interface MetaSyncResult {
  /** The mode that actually ran (an escalated initial sync reports `full`). */
  mode: MetaSyncMode
  /** True when an incremental request became a full import because no data existed yet. */
  initialSync: boolean
  /** The period actually synchronised (derived from the window or the fetched days). */
  period: { since: string | null; until: string | null }
  fetchedDays: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  totalSpend: number
  currency: string
  conflicts: SyncConflict[]
  warnings: string[]
}

export interface MetaSyncInput {
  /** Defaults to 'incremental'. */
  mode?: MetaSyncMode
}

export interface MetaSyncDeps {
  /** Injected daily-spend fetcher (defaults to the real Meta client). */
  fetchDailySpend?: (args: MetaSpendQuery) => Promise<MetaDailySpend[]>
  /** Injected Meta config (defaults to env-derived config). */
  config?: MetaConfig
  /** Injected VAT rate (defaults to economy-settings.metaAdsVatRate, else 25). */
  metaVatRate?: number
  /** Injected clock for deterministic tests. */
  now?: () => Date
  /** Injected last imported day for this account (tests); defaults to a DB lookup. */
  lastExternalDate?: string | null
}

/** Deterministic per-day key. Account id is the `act_…` id — never a token. */
export function buildExternalKey(accountId: string, date: string): string {
  return `meta:${accountId}:${date}`
}

/**
 * Validate a date window. No longer used by the sync itself (which resolves its own
 * window from the mode) — it validates the Meta page's *display* filter, where both empty
 * means "show everything", exactly one is an error, and both must be YYYY-MM-DD with
 * since ≤ until.
 */
export function validateSyncDates(input: MetaSpendQuery): { since?: string; until?: string } {
  const since = input.since?.trim() || undefined
  const until = input.until?.trim() || undefined

  if (!since && !until) return {}
  if (!since || !until) {
    throw new SyncValidationError('Fyll inn begge datoene, eller la begge stå tomme.')
  }
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) {
    throw new SyncValidationError('Datoer må være på formatet ÅÅÅÅ-MM-DD.')
  }
  if (since > until) {
    throw new SyncValidationError('«Periode fra» kan ikke være etter «Periode til».')
  }
  return { since, until }
}

/** Parse the requested sync mode from an untrusted body value. Defaults to 'incremental'. */
export function parseSyncMode(raw: unknown): MetaSyncMode {
  if (raw === undefined || raw === null || raw === '') return 'incremental'
  if (raw === 'incremental' || raw === 'full') return raw
  throw new SyncValidationError('Ugyldig synkroniseringsmodus.')
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
  channel: 'meta'
  source: 'meta-api'
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
  day: MetaDailySpend,
  accountId: string,
  vatRate: number,
  nowIso: string,
  graphApiVersion: string,
): ExpenseWriteFields {
  return {
    channel: 'meta',
    source: 'meta-api',
    amount: round2(day.spend),
    vatRate,
    date: dayStartIso(day.date),
    periodFrom: dayStartIso(day.date),
    periodTo: dayStartIso(day.date),
    description: `Meta Ads – ${day.date}`,
    externalReference: `Meta API / ${accountId}`,
    externalKey: buildExternalKey(accountId, day.date),
    externalAccountId: accountId,
    externalDate: day.date,
    lastSyncedAt: nowIso,
    syncMetadata: {
      spend: round2(day.spend),
      currency: day.currency,
      fetchedAt: nowIso,
      graphApiVersion,
      // Never store tokens or secrets here.
    },
  }
}

type ManualMetaRow = Pick<
  MarketingExpense,
  'id' | 'description' | 'periodFrom' | 'periodTo' | 'amount' | 'date' | 'source'
>

/** Manual Meta rows whose date/period overlaps [startIso, endIso]. One query. */
async function findManualMetaConflicts(
  payload: Payload,
  startIso: string,
  endIso: string,
): Promise<SyncConflict[]> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { channel: { equals: 'meta' } },
        { or: [{ source: { not_equals: 'meta-api' } }, { source: { exists: false } }] },
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

  return (result.docs as ManualMetaRow[]).map((d) => ({
    id: String(d.id),
    description: d.description ?? undefined,
    periodFrom: d.periodFrom ?? undefined,
    periodTo: d.periodTo ?? undefined,
    amount: typeof d.amount === 'number' ? d.amount : undefined,
  }))
}

/**
 * Latest imported day (externalDate) for this ad account, or null when nothing has been
 * imported yet. `externalDate` is stored as YYYY-MM-DD, so a descending sort is
 * chronological. Drives the incremental window and the initial-sync decision.
 */
async function findLastExternalDate(payload: Payload, accountId: string): Promise<string | null> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [
        { source: { equals: 'meta-api' } },
        { externalAccountId: { equals: accountId } },
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
 * Fetch Meta daily spend and upsert one marketing-expenses record per day.
 *
 * The window is always resolved server-side from the mode:
 *  - `full`                      → the whole available history (no time_range);
 *  - `incremental`, no data yet  → escalates to a full import (initialSync = true);
 *  - `incremental`, data exists  → lastExternalDate − 13 days … today (UTC), so Meta's
 *                                  retroactive spend corrections are picked up.
 *
 * When a manual Meta expense overlaps the target window, no records are written and the
 * conflicts are returned so the caller can stop with a clear message.
 */
export async function runMetaSync(
  payload: Payload,
  input: MetaSyncInput = {},
  deps: MetaSyncDeps = {},
): Promise<MetaSyncResult> {
  const requestedMode: MetaSyncMode = input.mode ?? 'incremental'
  const config = deps.config ?? getMetaConfig()
  const accountId = config.adAccountId
  const nowFn = deps.now ?? (() => new Date())
  const now = nowFn()
  const nowIso = now.toISOString()

  const fetchDailySpend =
    deps.fetchDailySpend ?? ((args: MetaSpendQuery) => getMetaDailySpend(args, { config }))

  const metaVatRate =
    typeof deps.metaVatRate === 'number' ? deps.metaVatRate : await loadMetaVatRate(payload)

  const warnings: string[] = []

  if (activeSyncs.has(accountId)) throw new SyncInProgressError()
  activeSyncs.add(accountId)
  try {
    // --- Resolve the sync window (never supplied by the client) ---
    const lastExternalDate =
      deps.lastExternalDate !== undefined
        ? deps.lastExternalDate
        : await findLastExternalDate(payload, accountId)

    let mode: MetaSyncMode = requestedMode
    let initialSync = false
    let query: MetaSpendQuery = {}
    if (requestedMode === 'incremental') {
      if (lastExternalDate) {
        query = computeIncrementalWindow(lastExternalDate, now)
      } else {
        // Nothing imported for this account yet — pull everything once.
        mode = 'full'
        initialSync = true
      }
    }

    const days = await fetchDailySpend(query)
    const currency = days.find((d) => d.currency)?.currency ?? 'NOK'
    const totalSpend = round2(days.reduce((sum, d) => sum + (Number.isFinite(d.spend) ? d.spend : 0), 0))
    const fetchedDays = days.length

    // The period actually covered: the resolved window, or the span of the fetched days
    // for a full sync (where Meta decides the range).
    const actualSince =
      query.since ?? (days.length ? days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date) : null)
    const actualUntil =
      query.until ?? (days.length ? days.reduce((max, d) => (d.date > max ? d.date : max), days[0].date) : null)

    const emptyResult = (conflicts: SyncConflict[]): MetaSyncResult => ({
      mode,
      initialSync,
      period: { since: actualSince, until: actualUntil },
      fetchedDays,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      totalSpend,
      currency,
      conflicts,
      warnings,
    })

    // --- Conflict gate: never write when a manual Meta entry overlaps the window. ---
    // Incremental checks only its 14-day window; full checks the whole fetched period.
    if (fetchedDays > 0 && actualSince && actualUntil) {
      const conflicts = await findManualMetaConflicts(
        payload,
        dayStartIso(actualSince),
        dayEndIso(actualUntil),
      )
      if (conflicts.length > 0) {
        warnings.push(
          'Fant manuelle Meta Ads-kostnader som overlapper perioden. Synkronisering er stoppet for å unngå dobbelttelling.',
        )
        return emptyResult(conflicts)
      }
    }

    let created = 0
    let updated = 0
    let unchanged = 0
    let skipped = 0

    for (const day of days) {
      const fields = buildDayFields(day, accountId, metaVatRate, nowIso, config.graphApiVersion)
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

      if (current.source !== 'meta-api') {
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

    return {
      mode,
      initialSync,
      period: { since: actualSince, until: actualUntil },
      fetchedDays,
      created,
      updated,
      unchanged,
      skipped,
      totalSpend,
      currency,
      conflicts: [],
      warnings,
    }
  } finally {
    activeSyncs.delete(accountId)
  }
}

/** Update a meta-api row only when the amount or VAT rate actually changed. */
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

/** Read the Meta VAT rate from economy-settings; default 25 (matches manual default). */
async function loadMetaVatRate(payload: Payload): Promise<number> {
  try {
    const settings = await payload.findGlobal({ slug: 'economy-settings' })
    const rate = (settings as { metaAdsVatRate?: number | null }).metaAdsVatRate
    return typeof rate === 'number' ? rate : 25
  } catch {
    return 25
  }
}
