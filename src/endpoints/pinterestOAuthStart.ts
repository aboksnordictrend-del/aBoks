// Admin-only start of the Pinterest OAuth flow, registered on the Payload config so it is
// served at GET /api/pinterest/oauth/start.
//
// The handler mints a cryptographically random state, stores only its SHA-256 hash server-side
// with a ten-minute expiry, and answers with a 302 to Pinterest's authorization screen. Nothing
// else happens here — no token, no account lookup — so a repeated click is harmless (each click
// replaces the pending state, so only the most recent flow can complete).
//
// Security boundary: an authenticated Payload user with role 'admin'. Only this endpoint can
// create a pending state, which is what makes a forged callback unusable. The app secret is
// never part of the authorization URL — Pinterest's authorize step takes only client_id,
// redirect_uri, response_type, scope and state — so nothing sensitive travels via the browser.

import type { Endpoint, PayloadRequest } from 'payload'
import { MARKETING_ROUTES } from '@/lib/marketing/channels'
import {
  buildAuthorizationUrl,
  getPinterestOAuthConfig,
  PinterestOAuthConfigError,
} from '@/lib/pinterest/oauth/config'
import { createPendingState } from '@/lib/pinterest/oauth/state'
import { savePendingState } from '@/lib/pinterest/oauth/store'

/** Send the admin back to the Pinterest detail page with a machine-readable error code. */
function backWithError(reason: string): Response {
  const url = `${MARKETING_ROUTES.pinterest}?pinterest=error&reason=${encodeURIComponent(reason)}`
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store' },
  })
}

export async function handlePinterestOAuthStart(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if ((req.user as { role?: string }).role !== 'admin') {
    return Response.json({ success: false, error: 'Kun for administratorer.' }, { status: 403 })
  }

  let authorizeUrl: string
  try {
    const config = getPinterestOAuthConfig()
    const { state, pending } = createPendingState(String(req.user.id))
    // Persist the hash before redirecting: if this write fails the flow must not start, because
    // the callback would then have nothing to validate against.
    await savePendingState(req.payload, pending)
    authorizeUrl = buildAuthorizationUrl(config, state)
  } catch (err) {
    // A safe, secret-free message; the reason code drives the Norwegian copy on the page.
    req.payload.logger.error(
      `[pinterest-oauth] op=start blocked: ${
        err instanceof PinterestOAuthConfigError ? err.message : 'unknown configuration error'
      }`,
    )
    return backWithError(err instanceof PinterestOAuthConfigError ? 'config' : 'failed')
  }

  // The authorization URL carries no secret, but it is still never logged — only the outcome is.
  // `no-store` keeps the redirect (and its state) out of any shared cache.
  return new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl, 'Cache-Control': 'no-store' },
  })
}

export const pinterestOAuthStartEndpoint: Endpoint = {
  path: '/pinterest/oauth/start',
  method: 'get',
  handler: handlePinterestOAuthStart,
}
