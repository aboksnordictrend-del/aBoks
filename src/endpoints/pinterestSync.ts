// Admin-only Pinterest Ads sync endpoint, registered on the Payload config as
// POST /api/admin/integrations/pinterest/sync. Mirrors src/endpoints/googleSync.ts.
//
// Security boundary: requires an authenticated Payload user with role 'admin' — the client
// role is never trusted. The ad account id comes only from server env (never the request
// body), and the response only ever carries a masked id. The access token and app secret
// never appear in a response or a log line; Pinterest failures are logged with a secret-free
// detail line and reported to the client as a mapped Norwegian message.

import type { Endpoint, PayloadRequest } from 'payload'
import { PinterestAdsError } from '@/lib/pinterest/errors'
import { PinterestAdsConfigError } from '@/lib/pinterest/config'
import {
  PinterestReauthorizationRequiredError,
  PinterestRefreshBusyError,
} from '@/lib/pinterest/oauth/accessToken'
import { PinterestOAuthConfigError } from '@/lib/pinterest/oauth/config'
import { PinterestOAuthError } from '@/lib/pinterest/oauth/exchange'
import { PinterestStoreError } from '@/lib/pinterest/oauth/store'
import {
  PINTEREST_ADS_SOURCE,
  PinterestSyncInProgressError,
  PinterestSyncValidationError,
  parseSyncMode,
  runPinterestAdsSync,
  type PinterestSyncInput,
} from '@/lib/pinterest/sync'
import { recordSyncAttempt, recordSyncFailure, recordSyncSuccess } from '@/lib/marketing/syncState'

const MAX_BODY_BYTES = 2_000

/**
 * Read + size-limit the JSON body. Only `mode` is accepted — dates are always resolved
 * server-side, and the ad account id comes exclusively from env. A missing/empty body is
 * valid and means an incremental sync.
 */
async function readBody(req: PayloadRequest): Promise<PinterestSyncInput> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    if (raw == null) return {}
    const asString = JSON.stringify(raw)
    if (asString.length > MAX_BODY_BYTES) {
      throw new PinterestSyncValidationError('Forespørselen er for stor.')
    }
    if (typeof raw !== 'object') return {}
    const body = raw as Record<string, unknown>
    return { mode: parseSyncMode(body.mode) }
  } catch (err) {
    if (err instanceof PinterestSyncValidationError) throw err
    // Malformed JSON → treat as a bad request.
    throw new PinterestSyncValidationError('Ugyldig forespørsel.')
  }
}

export const pinterestSyncEndpoint: Endpoint = {
  path: '/admin/integrations/pinterest/sync',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ success: false, error: 'Kun for administratorer.' }, { status: 403 })
    }

    let input: PinterestSyncInput
    try {
      input = await readBody(req)
    } catch (err) {
      const message =
        err instanceof PinterestSyncValidationError ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ success: false, error: message }, { status: 400 })
    }

    const startedAt = new Date().toISOString()
    recordSyncAttempt(PINTEREST_ADS_SOURCE, startedAt)

    try {
      const result = await runPinterestAdsSync(req.payload, input)
      // Manual overlap ⇒ nothing was written; surface as a conflict (409).
      const blocked = result.conflicts.length > 0
      if (blocked) {
        recordSyncFailure(
          PINTEREST_ADS_SOURCE,
          result.syncedAt,
          'Manuelle Pinterest Ads-kostnader overlapper perioden. Ingenting ble importert.',
        )
      } else {
        recordSyncSuccess(PINTEREST_ADS_SOURCE, {
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

      if (err instanceof PinterestSyncValidationError) {
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 400 })
      }
      if (err instanceof PinterestSyncInProgressError || err instanceof PinterestRefreshBusyError) {
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 409 })
      }
      if (err instanceof PinterestReauthorizationRequiredError) {
        // The connection has already been marked `reauthorization_required`; every previously
        // imported marketing-expense record is untouched. Only the short internal code reaches
        // the log — never Pinterest's response and never a token.
        req.payload.logger.error(`[pinterest-oauth] sync blocked: code=${err.code}`)
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json(
          { success: false, error: err.message, needsReauthorization: true },
          { status: 409 },
        )
      }
      if (err instanceof PinterestOAuthError) {
        // A refresh that failed for a non-credential reason (network, 5xx, timeout).
        req.payload.logger.error(err.logLine('sync-refresh'))
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 502 })
      }
      if (err instanceof PinterestOAuthConfigError || err instanceof PinterestStoreError) {
        // Both messages name environment variables only — never a key or a token — so they are
        // safe to show the administrator, and far more actionable than a generic 500.
        req.payload.logger.error(`[pinterest-oauth] config error: ${err.message}`)
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 500 })
      }
      if (err instanceof PinterestAdsError) {
        // Secret-free structured detail to the server log; safe message to the client.
        req.payload.logger.error(err.logLine())
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 502 })
      }
      if (err instanceof PinterestAdsConfigError) {
        req.payload.logger.error(`[pinterest-ads] config error: ${err.message}`)
        recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, err.message)
        return Response.json({ success: false, error: err.message }, { status: 500 })
      }
      req.payload.logger.error(
        `[pinterest-ads] sync failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      const message = 'Kunne ikke synkronisere Pinterest Ads. Prøv igjen senere.'
      recordSyncFailure(PINTEREST_ADS_SOURCE, failedAt, message)
      return Response.json({ success: false, error: message }, { status: 500 })
    }
  },
}
