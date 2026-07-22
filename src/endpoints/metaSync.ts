// Admin-only Meta Ads sync endpoint, registered on the Payload config as
// POST /api/admin/integrations/meta/sync.
//
// Security boundary: requires an authenticated Payload user with role 'admin' — the
// client role is never trusted. The ad account id comes only from server env (never the
// request body). The access token never appears in a response or a log line; Meta failures
// are logged with a token-free detail line and reported to the client as a generic message.

import type { Endpoint, PayloadRequest } from 'payload'
import { MetaError } from '@/lib/meta/errors'
import { MetaConfigError } from '@/lib/meta/config'
import {
  parseSyncMode,
  runMetaSync,
  SyncInProgressError,
  SyncValidationError,
  type MetaSyncInput,
} from '@/lib/meta/sync'

const MAX_BODY_BYTES = 2_000

/**
 * Read + size-limit the JSON body. Only `mode` is accepted — dates are always resolved
 * server-side, and the ad account id comes exclusively from env. A missing/empty body is
 * valid and means an incremental sync.
 */
async function readBody(req: PayloadRequest): Promise<MetaSyncInput> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    if (raw == null) return {}
    const asString = JSON.stringify(raw)
    if (asString.length > MAX_BODY_BYTES) {
      throw new SyncValidationError('Forespørselen er for stor.')
    }
    if (typeof raw !== 'object') return {}
    const body = raw as Record<string, unknown>
    return { mode: parseSyncMode(body.mode) }
  } catch (err) {
    if (err instanceof SyncValidationError) throw err
    // Malformed JSON → treat as a bad request.
    throw new SyncValidationError('Ugyldig forespørsel.')
  }
}

export const metaSyncEndpoint: Endpoint = {
  path: '/admin/integrations/meta/sync',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ success: false, error: 'Kun for administratorer.' }, { status: 403 })
    }

    let input: MetaSyncInput
    try {
      input = await readBody(req)
    } catch (err) {
      const message = err instanceof SyncValidationError ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ success: false, error: message }, { status: 400 })
    }

    try {
      const result = await runMetaSync(req.payload, input)
      // Manual overlap ⇒ nothing was written; surface as a conflict (409).
      const status = result.conflicts.length > 0 ? 409 : 200
      return Response.json({ success: result.conflicts.length === 0, ...result }, { status })
    } catch (err) {
      if (err instanceof SyncValidationError) {
        return Response.json({ success: false, error: err.message }, { status: 400 })
      }
      if (err instanceof SyncInProgressError) {
        return Response.json({ success: false, error: err.message }, { status: 409 })
      }
      if (err instanceof MetaError) {
        // Token-free structured detail to the server log; safe message to the client.
        req.payload.logger.error(err.logLine())
        return Response.json({ success: false, error: err.message }, { status: 502 })
      }
      if (err instanceof MetaConfigError) {
        req.payload.logger.error(`[meta] config error: ${err.message}`)
        return Response.json({ success: false, error: err.message }, { status: 500 })
      }
      req.payload.logger.error(
        `[meta] sync failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json(
        { success: false, error: 'Synkronisering feilet. Prøv igjen senere.' },
        { status: 500 },
      )
    }
  },
}
