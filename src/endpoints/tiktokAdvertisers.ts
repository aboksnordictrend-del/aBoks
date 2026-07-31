// Admin-only advertiser discovery, registered as GET
// /api/admin/integrations/tiktok/advertisers.
//
// Exists for exactly one situation: the authorization succeeded but grants access to several
// advertisers and none is configured, so the admin has to pick one. Rather than putting
// account metadata in a redirect URL (and therefore in the browser's address bar and
// history), the callback only reports the *count* and this endpoint returns the list behind
// the same admin guard as every other integration route.
//
// Returns advertiser names and ids — the task's "safe account metadata". No token, no secret,
// and never a raw TikTok response.

import type { Endpoint, PayloadRequest } from 'payload'
import { listAuthorizedAdvertisers } from '@/lib/tiktok/accounts'
import { getTikTokAdsConfig, TikTokAdsConfigError } from '@/lib/tiktok/config'
import { TikTokAdsError } from '@/lib/tiktok/errors'
import { resolveAccessToken } from '@/lib/tiktok/tokenStore'

export const tiktokAdvertisersEndpoint: Endpoint = {
  path: '/admin/integrations/tiktok/advertisers',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
    }

    try {
      const config = getTikTokAdsConfig()
      const accessToken = await resolveAccessToken(req.payload, config.accessToken)
      if (!accessToken) {
        return Response.json(
          { error: 'TikTok Ads er ikke koblet til ennå. Bruk «Koble til».' },
          { status: 409 },
        )
      }

      const advertisers = await listAuthorizedAdvertisers(config, accessToken)
      return Response.json(
        {
          // Full ids: this is an admin-only response and the id is what the operator must
          // copy into TIKTOK_ADVERTISER_ID. It is account metadata, never a credential.
          advertisers: advertisers.map((a) => ({ id: a.id, name: a.name })),
          configuredId: config.advertiserId || null,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (err) {
      if (err instanceof TikTokAdsConfigError) {
        req.payload.logger.error(`[tiktok-ads] config error: ${err.message}`)
        return Response.json({ error: err.message }, { status: 500 })
      }
      if (err instanceof TikTokAdsError) {
        req.payload.logger.error(err.logLine())
        return Response.json({ error: err.message }, { status: 502 })
      }
      req.payload.logger.error(
        `[tiktok-ads] advertiser lookup failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente TikTok-annonsekontoer.' }, { status: 500 })
    }
  },
}
