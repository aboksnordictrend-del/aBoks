// Admin-only TikTok Ads sync endpoint, registered on the Payload config as
// POST /api/admin/integrations/tiktok/sync. Mirrors src/endpoints/pinterestSync.ts.
//
// Security boundary: requires an authenticated Payload user with role 'admin' — the client
// role is never trusted. The advertiser id comes only from server env or the stored
// connection (never the request body), and the response only ever carries a masked id. The
// access token and app secret never appear in a response or a log line; TikTok failures are
// logged with a secret-free detail line (code, request_id, date chunk) and reported to the
// client as a mapped Norwegian message.

import type { Endpoint, PayloadRequest } from 'payload'
import { TikTokAdsError } from '@/lib/tiktok/errors'
import { TikTokAdsConfigError } from '@/lib/tiktok/config'
import {
  TIKTOK_ADS_SOURCE,
  TikTokAdvertiserNotSelectedError,
  TikTokCurrencyUnknownError,
  TikTokSyncInProgressError,
  TikTokSyncValidationError,
  parseSyncMode,
  runTikTokAdsSync,
  type TikTokSyncInput,
} from '@/lib/tiktok/sync'
import { recordSyncAttempt, recordSyncFailure, recordSyncSuccess } from '@/lib/marketing/syncState'

const MAX_BODY_BYTES = 2_000

/**
 * Read + size-limit the JSON body. Only `mode` is accepted — dates are always resolved
 * server-side, and the advertiser id comes exclusively from env / the stored connection. A
 * missing/empty body is valid and means an incremental sync.
 */
async function readBody(req: PayloadRequest): Promise<TikTokSyncInput> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    if (raw == null) return {}
    const asString = JSON.stringify(raw)
    if (asString.length > MAX_BODY_BYTES) {
      throw new TikTokSyncValidationError('Forespørselen er for stor.')
    }
    if (typeof raw !== 'object') return {}
    const body = raw as Record<string, unknown>
    return { mode: parseSyncMode(body.mode) }
  } catch (err) {
    if (err instanceof TikTokSyncValidationError) throw err
    // Malformed JSON → treat as a bad request.
    throw new TikTokSyncValidationError('Ugyldig forespørsel.')
  }
}

export const tiktokSyncEndpoint: Endpoint = {
  path: '/admin/integrations/tiktok/sync',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ success: false, error: 'Kun for administratorer.' }, { status: 403 })
    }

    let input: TikTokSyncInput
    try {
      input = await readBody(req)
    } catch (err) {
      const message =
        err instanceof TikTokSyncValidationError ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ success: false, error: message }, { status: 400 })
    }

    const startedAt = new Date().toISOString()
    recordSyncAttempt(TIKTOK_ADS_SOURCE, startedAt)

    try {
      const result = await runTikTokAdsSync(req.payload, input)
      // Manual overlap ⇒ nothing was written; surface as a conflict (409).
      const blocked = result.conflicts.length > 0
      if (blocked) {
        recordSyncFailure(
          TIKTOK_ADS_SOURCE,
          result.syncedAt,
          'Manuelle TikTok Ads-kostnader overlapper perioden. Ingenting ble importert.',
        )
      } else {
        recordSyncSuccess(TIKTOK_ADS_SOURCE, {
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

      if (err instanceof TikTokSyncValidationError) {
        recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 400 })
      }
      if (err instanceof TikTokSyncInProgressError) {
        recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 409 })
      }
      if (err instanceof TikTokCurrencyUnknownError) {
        // A setup problem, not a provider failure: retrying cannot help, only setting
        // TIKTOK_ADVERTISER_CURRENCY can. 409 so the UI points at the setup, not a retry.
        recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 409 })
      }
      if (err instanceof TikTokAdvertiserNotSelectedError) {
        // A setup problem, not a provider failure: 409 so the UI can point at "Koble til"
        // / TIKTOK_ADVERTISER_ID rather than suggesting a retry.
        recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 409 })
      }
      if (err instanceof TikTokAdsError) {
        // Secret-free structured detail to the server log; safe message to the client.
        req.payload.logger.error(err.logLine())
        recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, err.message)
        // `needsReconnect` tells the client to offer "Koble til på nytt" instead of a retry.
        return Response.json(
          { success: false, error: err.message, needsReconnect: err.needsReconnect },
          { status: 502 },
        )
      }
      if (err instanceof TikTokAdsConfigError) {
        req.payload.logger.error(`[tiktok-ads] config error: ${err.message}`)
        recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 500 })
      }
      req.payload.logger.error(
        `[tiktok-ads] sync failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      const message = 'Kunne ikke synkronisere TikTok Ads. Prøv igjen senere.'
      recordSyncFailure(TIKTOK_ADS_SOURCE, failedAt, message)
      return Response.json({ success: false, error: message }, { status: 500 })
    }
  },
}
