// Shared client-side sync call for ad-channel integrations (Meta Ads, Google Ads, …).
//
// One place performs the POST and classifies the response, so the detail-page sync button
// (AdsSyncButton) and the quick "Oppdater" action on a channel card can never drift apart.
// No React here — just the fetch and the result shape. The server always resolves the
// window from the mode, so the client only ever sends `{ mode }`.

export type AdsSyncMode = 'incremental' | 'full'

/** A manual expense that overlaps the sync window (returned on a 409). */
export interface AdsSyncConflict {
  id: string
  description?: string
  periodFrom?: string
  periodTo?: string
  amount?: number
}

/** The JSON body every provider's sync endpoint returns (see runMetaSync / runGoogleAdsSync). */
export interface AdsSyncResult {
  success: boolean
  mode: AdsSyncMode
  initialSync: boolean
  period: { since: string | null; until: string | null }
  fetchedDays: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  totalSpend: number
  currency: string
  conflicts?: AdsSyncConflict[]
  warnings?: string[]
  error?: string
}

/** The minimal outcome a caller needs to show a "+created / ↻updated" summary. */
export interface AdsSyncOutcome {
  created: number
  updated: number
}

/**
 * Classified result of a sync call:
 *  - `success`  — the sync ran and wrote/updated records;
 *  - `conflict` — a manual expense overlapped the window; nothing was written (HTTP 409);
 *  - `error`    — validation / auth / provider / network failure, with a user-safe message.
 */
export type AdsSyncCall =
  | { kind: 'success'; result: AdsSyncResult }
  | { kind: 'conflict'; result: AdsSyncResult }
  | { kind: 'error'; message: string }

/**
 * POST an incremental or full sync to a provider endpoint and classify the response.
 * Never throws — a network failure is returned as `{ kind: 'error' }` so every caller can
 * render the same three states.
 */
export async function callAdsSync(endpoint: string, mode: AdsSyncMode): Promise<AdsSyncCall> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    const body = (await res.json().catch(() => ({}))) as AdsSyncResult

    if (res.status === 409 && body.conflicts && body.conflicts.length > 0) {
      return { kind: 'conflict', result: body }
    }
    if (!res.ok || body.success === false) {
      return { kind: 'error', message: body.error ?? `Synkronisering feilet (${res.status}).` }
    }
    return { kind: 'success', result: body }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : 'Nettverksfeil.' }
  }
}
