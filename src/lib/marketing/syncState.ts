// Last-run status for a marketing sync, kept in process memory.
//
// Deliberately NOT a new table: the durable facts (total spend, imported days, stored
// history range, lastSyncedAt) already live on the marketing-expenses records themselves,
// exactly as the Meta integration derives them. What records cannot express is the outcome
// of the *most recent attempt* — in particular a failure, which by definition wrote nothing.
// That is what this module holds, so the Google Ads panel can show "Sist forsøkt" and the
// last error without changing the schema.
//
// Consequences, accepted on purpose:
//  - the state resets on a cold start / new serverless instance;
//  - it is per-instance, not shared across instances.
// Neither matters for an operator-facing status line, and both keep the storage model
// untouched. Nothing here may ever contain a secret.

export interface SyncStateSnapshot {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  lastMode: 'incremental' | 'full' | null
  lastDateFrom: string | null
  lastDateTo: string | null
  createdCount: number | null
  updatedCount: number | null
}

const EMPTY: SyncStateSnapshot = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastMode: null,
  lastDateFrom: null,
  lastDateTo: null,
  createdCount: null,
  updatedCount: null,
}

const states = new Map<string, SyncStateSnapshot>()

function current(provider: string): SyncStateSnapshot {
  return states.get(provider) ?? EMPTY
}

/** Snapshot for a provider ('google-ads', …). Always a fresh object. */
export function getSyncState(provider: string): SyncStateSnapshot {
  return { ...current(provider) }
}

/** Record that a sync started. Clears the previous error so the UI never shows a stale one. */
export function recordSyncAttempt(provider: string, at: string): void {
  states.set(provider, { ...current(provider), lastAttemptAt: at, lastError: null })
}

/** Record a successful run, including the window and the write counts. */
export function recordSyncSuccess(
  provider: string,
  result: {
    at: string
    mode: 'incremental' | 'full'
    dateFrom: string | null
    dateTo: string | null
    created: number
    updated: number
  },
): void {
  states.set(provider, {
    ...current(provider),
    lastSuccessAt: result.at,
    lastError: null,
    lastMode: result.mode,
    lastDateFrom: result.dateFrom,
    lastDateTo: result.dateTo,
    createdCount: result.created,
    updatedCount: result.updated,
  })
}

/**
 * Record a failed run. `message` must be the user-safe message (the same text the client
 * gets) — never a raw stack trace and never anything derived from a secret.
 */
export function recordSyncFailure(provider: string, at: string, message: string): void {
  states.set(provider, { ...current(provider), lastAttemptAt: at, lastError: message })
}

/** Test-only: forget everything. */
export function resetSyncState(): void {
  states.clear()
}
