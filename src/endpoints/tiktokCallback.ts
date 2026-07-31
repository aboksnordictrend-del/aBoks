// TikTok OAuth callback, registered on the Payload config as
// GET /api/admin/integrations/tiktok/callback. This is the URL that must be registered as the
// redirect URI on the TikTok developer app.
//
// It always answers with a 302 back to the TikTok card, carrying a short `reason` code that
// the page turns into Norwegian copy — never a raw TikTok response, never a token, never an
// auth code. The auth code arrives in the query string; after the exchange the browser is
// redirected to a clean URL, so the code does not linger in the address bar or in history.
//
// Security boundary — both checks must pass:
//  1. an authenticated Payload user with role 'admin'. Payload's auth cookie is SameSite=Lax
//     and this is a top-level GET navigation, so the cookie is sent on the way back from
//     TikTok;
//  2. a valid signed `state`. Only /connect (itself admin-only) can mint one, it is bound to
//     the admin's user id, and it expires after ten minutes — so a forged or replayed
//     callback is rejected before any credential is touched.
//
// The token is persisted even when the advertiser cannot be resolved yet (several authorized
// accounts, none configured). That is a legitimate half-finished setup: TIKTOK_ADVERTISER_ID
// then completes it without a second authorization round-trip.

import type { Endpoint, PayloadRequest } from 'payload'
import { MARKETING_ROUTES } from '@/lib/marketing/channels'
import {
  assertSupportedCurrency,
  getAdvertiserInfoIfPermitted,
  listAuthorizedAdvertisers,
  resolveCurrency,
  selectAdvertiser,
} from '@/lib/tiktok/accounts'
import { getTikTokDailySpend } from '@/lib/tiktok/reports'
import { todayForAdvertiser } from '@/lib/tiktok/syncWindow'
import { exchangeAuthCode } from '@/lib/tiktok/auth'
import { getTikTokAdsConfig, TikTokAdsConfigError, type TikTokAdsConfig } from '@/lib/tiktok/config'
import { TikTokAdsError } from '@/lib/tiktok/errors'
import { verifyOAuthState } from '@/lib/tiktok/oauthState'
import { saveConnection, type SaveConnectionInput } from '@/lib/tiktok/tokenStore'
import type { TikTokAdvertiserInfo, TikTokAdvertiserRef } from '@/lib/tiktok/types'

/**
 * Machine-readable outcome codes. The client owns the Norwegian wording, so the copy can
 * change without touching this handler and no TikTok text is ever echoed to the browser.
 */
export type TikTokCallbackReason =
  | 'ok'
  | 'unauthorized'
  | 'config'
  | 'denied'
  | 'state'
  | 'code'
  /** The token exchange itself failed (`POST /oauth2/access_token/`). */
  | 'exchange'
  /** The token was obtained, but listing advertisers failed (`GET /oauth2/advertiser/get/`). */
  | 'advertiser-list'
  // NOTE: there is deliberately no 'advertiser-info' reason. That call is best-effort — it
  // needs a scope a Reporting-only app does not have — so it can no longer fail a connection.
  /** Everything worked except the one-day report probe — Reporting access is unusable. */
  | 'reporting'
  /**
   * Connected, but no currency could be established: `advertiser/info` was refused and
   * TIKTOK_ADVERTISER_CURRENCY is unset. The import stays blocked rather than guessing.
   */
  | 'currency-unknown'
  | 'no-advertiser'
  | 'multiple-advertisers'
  | 'not-authorized'
  | 'currency'
  | 'failed'

/** Carries the reason code for whichever TikTok call failed, alongside the original error. */
class CallbackFailure extends Error {
  constructor(
    readonly reason: TikTokCallbackReason,
    readonly cause: unknown,
  ) {
    super(reason)
    this.name = 'CallbackFailure'
  }
}

/** Injectable collaborators, so the whole callback is testable without a network. */
export interface TikTokCallbackDeps {
  config?: TikTokAdsConfig
  exchange?: (config: TikTokAdsConfig, authCode: string) => Promise<{ accessToken: string }>
  listAdvertisers?: (
    config: TikTokAdsConfig,
    accessToken: string,
  ) => Promise<TikTokAdvertiserRef[]>
  /** Best-effort: resolving to null means TikTok refused the metadata, which is not fatal. */
  fetchAdvertiserInfo?: (
    config: TikTokAdsConfig,
    accessToken: string,
    advertiserId: string,
  ) => Promise<TikTokAdvertiserInfo | null>
  /** One-day report probe. Resolves when Reporting works, rejects when it does not. */
  probeReporting?: (
    config: TikTokAdsConfig,
    accessToken: string,
    advertiserId: string,
  ) => Promise<void>
  save?: (input: SaveConnectionInput) => Promise<void>
  /** Resolves the admin named by the signed state. Defaults to a `users` lookup. */
  loadUser?: (userId: string) => Promise<{ role?: string } | null>
  now?: () => Date
  secret?: string
}

/**
 * Read the user the signed state names, bypassing access control.
 *
 * `overrideAccess: true` is required and safe: the request has no session (Payload will not
 * authenticate a cookie cross-site), so a normal read would be evaluated as an anonymous user
 * and always fail. The id is not attacker-supplied — it comes out of a value this server
 * signed — and only the `role` is used, to decide whether the flow may continue. Nothing about
 * the user is returned to the browser.
 */
async function findUserById(
  req: PayloadRequest,
  userId: string,
): Promise<{ role?: string } | null> {
  try {
    const user = await req.payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    return (user as { role?: string } | null) ?? null
  } catch {
    // Payload throws NotFound for a deleted user — treat that as "no authority".
    return null
  }
}

function str(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

/** 302 back to the TikTok card. `no-store` keeps the outcome out of any shared cache. */
function redirect(reason: TikTokCallbackReason, extra?: Record<string, string>): Response {
  const params = new URLSearchParams({ tiktok: reason === 'ok' ? 'connected' : 'error' })
  if (reason !== 'ok') params.set('reason', reason)
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v)
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${MARKETING_ROUTES.tiktok}?${params.toString()}`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * The callback body, separated from the Endpoint wrapper so tests can drive every branch with
 * injected collaborators. Returns the redirect Response.
 */
export async function handleTikTokCallback(
  req: PayloadRequest,
  deps: TikTokCallbackDeps = {},
): Promise<Response> {
  const log = req.payload?.logger

  // --- 1. Configuration ---------------------------------------------------------------
  let config: TikTokAdsConfig
  try {
    config = deps.config ?? getTikTokAdsConfig()
  } catch (err) {
    log?.error(
      `[tiktok-ads] callback blocked: ${err instanceof TikTokAdsConfigError ? err.message : 'unknown config error'}`,
    )
    return redirect('config')
  }

  const secret = deps.secret ?? (process.env.PAYLOAD_SECRET ?? '').trim()
  if (!secret) {
    log?.error('[tiktok-ads] callback blocked: PAYLOAD_SECRET is not set')
    return redirect('config')
  }

  const query = (req.query ?? {}) as Record<string, unknown>

  // --- 2. Signed state: the primary authentication for this request --------------------
  // Verified before the auth code is even read, so a forged callback never reaches TikTok.
  const state = verifyOAuthState(str(query, 'state'), secret)
  if (!state.ok) {
    log?.error(`[tiktok-ads] callback rejected: invalid state (${state.reason})`)
    return redirect('state')
  }

  // --- 3. Authority ---------------------------------------------------------------------
  // `req.user` is deliberately NOT required here, and this is not a relaxation — it is the
  // only workable check.
  //
  // Payload refuses to authenticate a cookie on a cross-site request: extractJWT's `cookie`
  // strategy returns null when there is no `Origin` header, `config.csrf` is non-empty and
  // `Sec-Fetch-Site` is `cross-site` (auth/extractJWT.js). A provider redirect always lands
  // that way — the header is computed over the whole redirect chain, so even a click that
  // started inside the admin arrives as `cross-site` once it has passed through TikTok. The
  // session cookie *is* on the request (Payload defaults to SameSite=Lax); Payload simply
  // declines to honour it. So req.user is structurally null on every OAuth callback, and
  // requiring it made the flow impossible to complete.
  //
  // The signed state carries the same guarantee, and carries it cryptographically: only
  // /connect can mint one, /connect requires an authenticated admin, the value is
  // HMAC-SHA256-signed with a key derived from PAYLOAD_SECRET, it names the admin, and it
  // expires after ten minutes. Two further checks keep this at least as strict as the old
  // cookie test:
  //   a) the admin named by the state is re-read from the database and must *still* be an
  //      admin — a demoted or deleted account cannot finish a flow it started;
  //   b) when a session IS present (same-site navigation, or a future Payload change), it
  //      must be an admin and must be the same user the state names.
  const loadUser = deps.loadUser ?? ((id: string) => findUserById(req, id))
  let stateUserRole: string | null = null
  try {
    stateUserRole = (await loadUser(state.payload.userId))?.role ?? null
  } catch (err) {
    log?.error(
      `[tiktok-ads] callback: could not resolve the administrator named by the state: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    )
    return redirect('unauthorized')
  }
  if (stateUserRole !== 'admin') {
    log?.error('[tiktok-ads] callback rejected: state does not name a current administrator')
    return redirect('unauthorized')
  }

  if (req.user) {
    // A session did survive the redirect — hold it to the same bar as before.
    if ((req.user as { role?: string }).role !== 'admin') {
      log?.error('[tiktok-ads] callback rejected: session user is not an administrator')
      return redirect('unauthorized')
    }
    if (String(req.user.id) !== state.payload.userId) {
      log?.error('[tiktok-ads] callback rejected: state was minted for a different user')
      return redirect('state')
    }
  }

  // --- 4. Authorization code ----------------------------------------------------------
  // TikTok sends `auth_code`; `code` is accepted as a defensive alias.
  const authCode = (str(query, 'auth_code') ?? str(query, 'code') ?? '').trim()
  if (!authCode) {
    // No code and a valid state means the admin declined on TikTok's consent screen.
    log?.error('[tiktok-ads] callback: authorization did not return an auth code')
    return redirect(str(query, 'error') ? 'denied' : 'code')
  }

  const now = (deps.now ?? (() => new Date()))()
  const connectedAt = now.toISOString()
  const save = deps.save ?? ((input: SaveConnectionInput) => saveConnection(req.payload, input))

  /**
   * Run one TikTok call and attribute a failure to *that* call.
   *
   * This matters more than it looks: connecting makes three separate TikTok requests, and
   * collapsing them into one `reason=exchange` made a failure impossible to attribute — the
   * token exchange and the advertiser lookups were indistinguishable from the outside. Each
   * now carries its own reason code and its own `op=` tag in the server log.
   */
  const attempt = async <T>(
    reason: TikTokCallbackReason,
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await run()
    } catch (err) {
      if (err instanceof TikTokAdsError) {
        // Ensure the log line names the call even when the error came from a layer that did
        // not set one (an injected dep in a test, a future refactor).
        if (!err.detail.operation) err.detail.operation = operation
        throw new CallbackFailure(reason, err)
      }
      throw new CallbackFailure(reason, err)
    }
  }

  try {
    // --- 5. Exchange the code for a token --------------------------------------------
    const exchange =
      deps.exchange ?? ((c: TikTokAdsConfig, code: string) => exchangeAuthCode(c, code))
    const { accessToken } = await attempt('exchange', 'token-exchange', () =>
      exchange(config, authCode),
    )

    // --- 6. Which advertiser should this import read? ---------------------------------
    const listAdvertisers =
      deps.listAdvertisers ??
      ((c: TikTokAdsConfig, token: string) => listAuthorizedAdvertisers(c, token))
    const advertisers = await attempt('advertiser-list', 'advertiser-list', () =>
      listAdvertisers(config, accessToken),
    )
    const selection = selectAdvertiser(advertisers, config.advertiserId)

    // Keep the token for every non-fatal outcome: the authorization itself succeeded, and
    // discarding it would force a pointless second round-trip once the advertiser is set.
    const saveTokenOnly = async (): Promise<void> => {
      await save({
        accessToken,
        advertiserId: null,
        advertiserName: null,
        currency: null,
        timezone: null,
        connectedAt,
        metadataAvailable: false,
        reportingOk: null,
      })
    }

    if (selection.kind === 'none') {
      log?.error('[tiktok-ads] callback: authorization granted access to no advertiser')
      await saveTokenOnly()
      return redirect('no-advertiser')
    }

    if (selection.kind === 'ambiguous') {
      // Only the *count* goes in the URL; the names and ids are fetched separately by the
      // admin-only advertisers endpoint, so no account metadata lands in the address bar.
      log?.error(
        `[tiktok-ads] callback: ${selection.advertisers.length} advertisers authorized, none configured`,
      )
      await saveTokenOnly()
      return redirect('multiple-advertisers', { count: String(selection.advertisers.length) })
    }

    if (selection.kind === 'not-authorized') {
      log?.error(
        `[tiktok-ads] callback: configured advertiser is not among the ${selection.advertisers.length} authorized accounts`,
      )
      await saveTokenOnly()
      return redirect('not-authorized')
    }

    const advertiserId = selection.advertiser.id

    // --- 7. Optional advertiser metadata ---------------------------------------------
    // `advertiser/info` needs the Ad Account Management scope; a Reporting-only app is
    // refused. That is expected and never fatal — nothing in the spend import depends on it,
    // so the refusal is logged (op=advertiser-info) and the flow continues with nulls.
    const fetchInfo =
      deps.fetchAdvertiserInfo ??
      ((c: TikTokAdsConfig, token: string, id: string) =>
        getAdvertiserInfoIfPermitted(c, token, id, {
          onUnavailable: (e) => log?.warn?.(e.logLine()),
        }))
    const info = await fetchInfo(config, accessToken, advertiserId)
    const metadataAvailable = info !== null
    if (!metadataAvailable) {
      log?.warn?.(
        '[tiktok-ads] op=advertiser-info metadata unavailable (Reporting-only scope) — continuing without it',
      )
    }

    // --- 8. Reporting probe: the authoritative test that this token can read spend ------
    // One day, so the quota cost is negligible. This is what lets the card distinguish
    // "authorized but reporting refused" from a healthy connection.
    const probe =
      deps.probeReporting ??
      (async (c: TikTokAdsConfig, token: string, id: string) => {
        const today = todayForAdvertiser(now, info?.timezone ?? null)
        await getTikTokDailySpend(c, token, id, { since: today, until: today }, 'NOK', {
          pageSize: 1,
          operation: 'report-probe',
        })
      })

    let reportingOk = true
    try {
      await probe(config, accessToken, advertiserId)
    } catch (err) {
      reportingOk = false
      if (err instanceof TikTokAdsError) {
        if (!err.detail.operation) err.detail.operation = 'report-probe'
        log?.error(err.logLine())
      } else {
        log?.error(
          `[tiktok-ads] op=report-probe failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        )
      }
    }

    // --- 9. Currency: resolved strictly, never guessed --------------------------------
    const resolved = resolveCurrency({
      fromAdvertiserInfo: info?.currency,
      fromConfig: config.advertiserCurrency,
    })

    // The connection itself is real — the token works and the advertiser is selected — so it
    // is stored for every outcome below. What differs is the reason code the page shows.
    const persist = (currency: string | null): Promise<void> =>
      save({
        accessToken,
        advertiserId,
        advertiserName: info?.name ?? selection.advertiser.name,
        currency,
        timezone: info?.timezone ?? null,
        connectedAt,
        metadataAvailable,
        reportingOk,
      })

    if (!resolved.code) {
      // Unknown currency blocks importing, but not connecting: re-authorizing would not help,
      // whereas setting TIKTOK_ADVERTISER_CURRENCY would.
      log?.error(
        '[tiktok-ads] callback: advertiser currency is unknown (advertiser/info unavailable and TIKTOK_ADVERTISER_CURRENCY unset)',
      )
      await persist(null)
      return redirect('currency-unknown')
    }

    try {
      assertSupportedCurrency(resolved.code)
    } catch {
      // A known, non-NOK currency. Store the connection but not the currency, so no later
      // step can read it back and treat it as importable. The page rebuilds the Norwegian
      // message from the reason code, so TikTok's own text is never echoed to the browser.
      log?.error(`[tiktok-ads] callback: advertiser currency ${resolved.code} is not NOK`)
      await persist(null)
      return redirect('currency', { currency: resolved.code })
    }

    await persist(resolved.code)

    if (!reportingOk) {
      return redirect('reporting')
    }
    return redirect('ok', metadataAvailable ? undefined : { metadata: 'unavailable' })
  } catch (err) {
    // Unwrap the per-call marker so the reason names the request that actually failed.
    const reason = err instanceof CallbackFailure ? err.reason : 'failed'
    const cause = err instanceof CallbackFailure ? err.cause : err

    if (cause instanceof TikTokAdsError) {
      // Secret-free structured detail — op, http status, TikTok's code, request_id and (when
      // the body was not JSON) a truncated excerpt. This line is what a support ticket needs.
      log?.error(cause.logLine())
      return redirect(reason)
    }
    log?.error(
      `[tiktok-ads] callback failed at ${reason}: ${
        cause instanceof Error ? cause.message : 'unknown error'
      }`,
    )
    return redirect(reason === 'failed' ? 'failed' : reason)
  }
}

export const tiktokCallbackEndpoint: Endpoint = {
  path: '/admin/integrations/tiktok/callback',
  method: 'get',
  handler: (req: PayloadRequest): Promise<Response> => handleTikTokCallback(req),
}
