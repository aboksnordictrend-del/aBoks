// Admin-only start of the TikTok OAuth flow, registered on the Payload config as
// GET /api/admin/integrations/tiktok/connect.
//
// The handler mints a signed CSRF state bound to the requesting administrator and answers
// with a 302 to TikTok's authorization screen. Nothing else happens here — no token, no
// advertiser lookup — so a repeated click is harmless.
//
// Security boundary: requires an authenticated Payload user with role 'admin'. Only this
// endpoint can mint a state that the callback will accept, which is what makes a forged
// callback unusable. The app secret is never part of the authorization URL (TikTok's
// authorize step takes only app_id, state and redirect_uri), so nothing sensitive travels
// through the browser.

import type { Endpoint, PayloadRequest } from 'payload'
import { buildAuthorizationUrl } from '@/lib/tiktok/auth'
import { getTikTokAdsConfig, TikTokAdsConfigError } from '@/lib/tiktok/config'
import { createOAuthState } from '@/lib/tiktok/oauthState'
import { MARKETING_ROUTES } from '@/lib/marketing/channels'

/** Send the admin back to the TikTok detail page with a machine-readable error state. */
function backWithError(reason: string): Response {
  const url = `${MARKETING_ROUTES.tiktok}?tiktok=error&reason=${encodeURIComponent(reason)}`
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } })
}

export const tiktokConnectEndpoint: Endpoint = {
  path: '/admin/integrations/tiktok/connect',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ success: false, error: 'Kun for administratorer.' }, { status: 403 })
    }

    let authorizeUrl: string
    try {
      const config = getTikTokAdsConfig()
      const secret = (process.env.PAYLOAD_SECRET ?? '').trim()
      if (!secret) {
        req.payload.logger.error('[tiktok-ads] connect blocked: PAYLOAD_SECRET is not set')
        return backWithError('config')
      }
      const state = createOAuthState(String(req.user.id), secret)
      authorizeUrl = buildAuthorizationUrl(config, state)
    } catch (err) {
      // A safe, secret-free message; the reason code drives the Norwegian copy on the page.
      req.payload.logger.error(
        `[tiktok-ads] connect blocked: ${err instanceof TikTokAdsConfigError ? err.message : 'unknown config error'}`,
      )
      return backWithError('config')
    }

    // The authorization URL itself carries no secret, but it is still never logged — only the
    // outcome is. `no-store` keeps the redirect (and its state) out of any shared cache.
    return new Response(null, {
      status: 302,
      headers: { Location: authorizeUrl, 'Cache-Control': 'no-store' },
    })
  },
}
