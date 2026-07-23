// Admin-only Google Ads sync endpoint, registered on the Payload config as
// POST /api/admin/integrations/google/sync. Mirrors src/endpoints/metaSync.ts.
//
// Security boundary: requires an authenticated Payload user with role 'admin' — the client
// role is never trusted. The customer id comes only from server env (never the request
// body), and the response only ever carries a masked id. The refresh token, client secret
// and developer token never appear in a response or a log line; Google failures are logged
// with a secret-free detail line and reported to the client as a mapped Norwegian message.

import type { Endpoint, PayloadRequest } from 'payload'
import { GoogleAdsError } from '@/lib/google/errors'
import { GoogleAdsConfigError } from '@/lib/google/config'
import {
  GOOGLE_ADS_SOURCE,
  GoogleSyncInProgressError,
  GoogleSyncValidationError,
  parseSyncMode,
  runGoogleAdsSync,
  type GoogleSyncInput,
} from '@/lib/google/sync'
import { recordSyncAttempt, recordSyncFailure, recordSyncSuccess } from '@/lib/marketing/syncState'

const MAX_BODY_BYTES = 2_000

/**
 * Read + size-limit the JSON body. Only `mode` is accepted — dates are always resolved
 * server-side, and the customer id comes exclusively from env. A missing/empty body is
 * valid and means an incremental sync.
 */
async function readBody(req: PayloadRequest): Promise<GoogleSyncInput> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    if (raw == null) return {}
    const asString = JSON.stringify(raw)
    if (asString.length > MAX_BODY_BYTES) {
      throw new GoogleSyncValidationError('Forespørselen er for stor.')
    }
    if (typeof raw !== 'object') return {}
    const body = raw as Record<string, unknown>
    return { mode: parseSyncMode(body.mode) }
  } catch (err) {
    if (err instanceof GoogleSyncValidationError) throw err
    // Malformed JSON → treat as a bad request.
    throw new GoogleSyncValidationError('Ugyldig forespørsel.')
  }
}

export const googleSyncEndpoint: Endpoint = {
  path: '/admin/integrations/google/sync',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ success: false, error: 'Kun for administratorer.' }, { status: 403 })
    }

    let input: GoogleSyncInput
    try {
      input = await readBody(req)
    } catch (err) {
      const message = err instanceof GoogleSyncValidationError ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ success: false, error: message }, { status: 400 })
    }

    const startedAt = new Date().toISOString()
    recordSyncAttempt(GOOGLE_ADS_SOURCE, startedAt)

    try {
      const result = await runGoogleAdsSync(req.payload, input)
      // Manual overlap ⇒ nothing was written; surface as a conflict (409).
      const blocked = result.conflicts.length > 0
      if (blocked) {
        recordSyncFailure(
          GOOGLE_ADS_SOURCE,
          result.syncedAt,
          'Manuelle Google Ads-kostnader overlapper perioden. Ingenting ble importert.',
        )
      } else {
        recordSyncSuccess(GOOGLE_ADS_SOURCE, {
          at: result.syncedAt,
          mode: result.mode,
          dateFrom: result.period.since,
          dateTo: result.period.until,
          created: result.created,
          updated: result.updated,
        })
      }
      return Response.json({ success: !blocked, ...result }, { status: blocked ? 409 : 200 })
    } catch (err) {
      const failedAt = new Date().toISOString()

      if (err instanceof GoogleSyncValidationError) {
        recordSyncFailure(GOOGLE_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 400 })
      }
      if (err instanceof GoogleSyncInProgressError) {
        recordSyncFailure(GOOGLE_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 409 })
      }
      if (err instanceof GoogleAdsError) {
        // Secret-free structured detail to the server log; safe message to the client.
        req.payload.logger.error(err.logLine())
        recordSyncFailure(GOOGLE_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 502 })
      }
      if (err instanceof GoogleAdsConfigError) {
        req.payload.logger.error(`[google-ads] config error: ${err.message}`)
        recordSyncFailure(GOOGLE_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 500 })
      }
      req.payload.logger.error(
        `[google-ads] sync failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      const message = 'Kunne ikke synkronisere Google Ads. Prøv igjen senere.'
      recordSyncFailure(GOOGLE_ADS_SOURCE, failedAt, message)
      return Response.json({ success: false, error: message }, { status: 500 })
    }
  },
}
