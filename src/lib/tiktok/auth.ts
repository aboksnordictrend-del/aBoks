// TikTok OAuth: building the authorization URL and exchanging the returned auth_code for an
// access token. Deliberately isolated from the report reader and the sync orchestration, so
// a change in TikTok's authorization model only touches this file.
//
// Token lifecycle (TikTok Marketing API, advertiser authorization):
//   An access token issued through the advertiser-authorization flow **does not expire**. It
//   stays valid until the advertiser revokes the app's access, or the token is revoked via
//   `/oauth2/revoke_token/`. There is therefore no refresh-token rotation to implement here.
//   (The 24-hour access token / one-year refresh token model documented elsewhere in TikTok's
//   developer material belongs to Login Kit *creator* tokens — a different product, and not
//   what a Marketing API reporting integration uses.) Revocation surfaces as a TikTok error
//   code that sets `needsReconnect`, and the admin reconnects from the TikTok card.
//
// Security rules enforced here:
//  - the app secret and the auth code only ever travel in the POST body to TikTok's token
//    endpoint; neither is ever logged, thrown, or written into a redirect URL;
//  - the returned access token is passed straight to the caller and never logged.

import { tiktokPostJson, type TikTokRequestOptions } from './client'
import type { TikTokAdsConfig } from './config'
import { TikTokAdsError } from './errors'
import type { TikTokTokenResponse } from './types'

/** `POST /oauth2/access_token/` — exchanges a one-time auth code for an access token. */
const TOKEN_PATH = 'oauth2/access_token/'

export interface TikTokTokenGrant {
  accessToken: string
  /** Advertiser ids the authorization covers, as digit strings. May be empty. */
  advertiserIds: string[]
}

/**
 * Build the URL the administrator is redirected to in order to authorize the app.
 *
 * `https://business-api.tiktok.com/portal/auth?app_id=…&state=…&redirect_uri=…`
 *
 * The scopes are **not** passed here: TikTok binds the permission set to the app itself (the
 * scopes ticked when the app was created and approved), and the authorization screen shows
 * that fixed list. Requesting scopes per-URL is not part of this flow.
 *
 * `redirect_uri` must match the value registered on the TikTok app byte for byte, which is
 * why it comes from config rather than from the incoming request.
 */
export function buildAuthorizationUrl(config: TikTokAdsConfig, state: string): string {
  const url = new URL(config.authorizeUrl)
  url.searchParams.set('app_id', config.appId)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', config.redirectUri)
  return url.toString()
}

/** Coerce TikTok's advertiser id list (numbers or strings) into digit strings. */
function parseAdvertiserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids: string[] = []
  for (const entry of raw) {
    const value =
      typeof entry === 'string'
        ? entry
        : typeof entry === 'number' && Number.isFinite(entry)
          ? String(entry)
          : ''
    const digits = value.replace(/\D/g, '')
    if (digits) ids.push(digits)
  }
  return ids
}

/**
 * Exchange a one-time authorization code for an access token.
 *
 * Throws a TikTokAdsError with a safe Norwegian message when TikTok rejects the code (already
 * used, expired after one hour, or minted for a different app) or answers with a body that
 * carries no token. A 200 without a token is treated as a failure rather than stored — an
 * empty token would otherwise be persisted and fail confusingly on the first sync.
 */
export async function exchangeAuthCode(
  config: TikTokAdsConfig,
  authCode: string,
  options: TikTokRequestOptions = {},
): Promise<TikTokTokenGrant> {
  if (!authCode.trim()) {
    throw new TikTokAdsError('TikTok returnerte ingen autorisasjonskode.', {
      message: 'empty auth_code',
      operation: 'token-exchange',
    })
  }

  const data = await tiktokPostJson<TikTokTokenResponse>(
    config,
    TOKEN_PATH,
    {
      app_id: config.appId,
      secret: config.appSecret,
      auth_code: authCode,
    },
    // A token exchange is not idempotent — the auth code is single-use, so a retry after a
    // *successful but slow* call would fail with "code already used". Retries are disabled.
    { ...options, maxRetries: 0, operation: 'token-exchange' },
  )

  const accessToken = typeof data?.access_token === 'string' ? data.access_token.trim() : ''
  if (!accessToken) {
    throw new TikTokAdsError(
      'TikTok returnerte ikke et tilgangstoken. Prøv å koble til på nytt.',
      { message: 'token response contained no access_token', operation: 'token-exchange' },
    )
  }

  return { accessToken, advertiserIds: parseAdvertiserIds(data?.advertiser_ids) }
}
