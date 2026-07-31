// Pinterest OAuth callback, registered on the Payload config so it is served at
// GET /api/pinterest/oauth/callback. This exact URL must be registered as a redirect URI on the
// Pinterest app (production and localhost variants both — see docs/PINTEREST-OAUTH-SETUP.md).
//
// It always answers with a 302 back to the Pinterest card, carrying a short `reason` code that
// the page turns into Norwegian copy — never Pinterest's raw response, never a token, never the
// authorization code. The code arrives in the query string; after the exchange the browser is
// sent to a clean URL, so it does not linger in the address bar or in history.
//
// Security boundary — every one of these must pass before a credential is touched:
//  1. a pending state exists, is unexpired, and hashes to the returned value;
//  2. the state is consumed (cleared) as it is read, so a replay finds nothing to match;
//  3. the administrator named by the state is re-read from the database and must *still* be an
//     admin;
//  4. when a session survives the redirect, it must be an admin and the same user.
//
// `req.user` is deliberately NOT required. Payload refuses to authenticate its cookie on a
// cross-site request (extractJWT's cookie strategy returns null when `Sec-Fetch-Site` is
// `cross-site` and `config.csrf` is non-empty), and a provider redirect always arrives that way
// — so requiring a session would make the flow impossible to complete. The same reasoning, and
// the same mitigation, as src/endpoints/tiktokCallback.ts.

import type { Endpoint, PayloadRequest } from 'payload'
import { MARKETING_ROUTES } from '@/lib/marketing/channels'
import {
  getPinterestOAuthConfig,
  PINTEREST_OAUTH_SCOPES,
  PinterestOAuthConfigError,
  type PinterestOAuthConfig,
} from '@/lib/pinterest/oauth/config'
import {
  exchangeAuthorizationCode,
  PinterestOAuthError,
} from '@/lib/pinterest/oauth/exchange'
import { verifyPendingState } from '@/lib/pinterest/oauth/state'
import { consumePendingState, saveNewConnection } from '@/lib/pinterest/oauth/store'
import { scopeCovers, type PinterestTokenGrant } from '@/lib/pinterest/oauth/tokens'

/**
 * Machine-readable outcome codes. The client owns the Norwegian wording, so the copy can change
 * without touching this handler and no Pinterest text is ever echoed to the browser.
 */
export type PinterestCallbackReason =
  | 'ok'
  | 'config'
  /** The admin declined on Pinterest's consent screen, or Pinterest returned an error param. */
  | 'denied'
  /** Missing, expired, mismatched or already-used state. */
  | 'state'
  /** The state is valid but no longer names a current administrator. */
  | 'unauthorized'
  /** No authorization code in the callback. */
  | 'code'
  /** `POST /v5/oauth/token` rejected the exchange. */
  | 'exchange'
  /** The exchange succeeded but the granted scope does not cover ads:read. */
  | 'scope'
  /** Storing the grant failed (encryption key missing, database error). */
  | 'storage'
  | 'failed'

export interface PinterestCallbackDeps {
  config?: PinterestOAuthConfig
  exchange?: (config: PinterestOAuthConfig, code: string) => Promise<PinterestTokenGrant>
  /** Resolves the admin named by the state. Defaults to a `users` lookup. */
  loadUser?: (userId: string) => Promise<{ role?: string } | null>
  save?: (grant: PinterestTokenGrant, connectedAt: string) => Promise<void>
  now?: () => Date
}

/**
 * Read the user the state names, bypassing access control.
 *
 * `overrideAccess: true` is required and safe: the request has no session (Payload will not
 * authenticate a cookie cross-site), so a normal read would evaluate as anonymous and always
 * fail. The id is not attacker-supplied — it comes from a server-side record keyed by a hash of
 * a value this server generated — and only `role` is used. Nothing about the user is returned
 * to the browser.
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

/** 302 back to the Pinterest card. `no-store` keeps the outcome out of any shared cache. */
function redirect(reason: PinterestCallbackReason): Response {
  const params = new URLSearchParams({ pinterest: reason === 'ok' ? 'connected' : 'error' })
  if (reason !== 'ok') params.set('reason', reason)
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${MARKETING_ROUTES.pinterest}?${params.toString()}`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * The callback body, separated from the Endpoint wrapper so tests can drive every branch with
 * injected collaborators. Always returns the redirect Response — it never throws.
 */
export async function handlePinterestCallback(
  req: PayloadRequest,
  deps: PinterestCallbackDeps = {},
): Promise<Response> {
  const log = req.payload?.logger
  const query = (req.query ?? {}) as Record<string, unknown>

  // --- 1. Consume the pending state -----------------------------------------------------
  // Read *and cleared* in one step, before anything is validated. That ordering is what makes
  // the state single-use: a second callback carrying the same value finds no pending record,
  // whether or not the first one succeeded.
  let pending
  try {
    pending = await consumePendingState(req.payload)
  } catch (err) {
    log?.error(
      `[pinterest-oauth] op=callback could not read the pending state: ${
        err instanceof Error ? err.name : 'unknown error'
      }`,
    )
    return redirect('failed')
  }

  // --- 2. Did Pinterest itself report a failure? ----------------------------------------
  // Checked after the state is consumed so a declined consent still burns the pending state.
  // Pinterest's own `error_description` is logged but never shown or forwarded.
  const oauthError = str(query, 'error')
  if (oauthError) {
    log?.error(`[pinterest-oauth] op=callback provider returned error=${oauthError.slice(0, 64)}`)
    return redirect('denied')
  }

  // --- 3. State ---------------------------------------------------------------------------
  const state = verifyPendingState(str(query, 'state'), pending)
  if (!state.ok) {
    log?.error(`[pinterest-oauth] op=callback rejected: invalid state (${state.reason})`)
    return redirect('state')
  }

  // --- 4. Authority -----------------------------------------------------------------------
  const loadUser = deps.loadUser ?? ((id: string) => findUserById(req, id))
  let stateUserRole: string | null = null
  try {
    stateUserRole = (await loadUser(state.userId))?.role ?? null
  } catch (err) {
    log?.error(
      `[pinterest-oauth] op=callback could not resolve the administrator named by the state: ${
        err instanceof Error ? err.name : 'unknown error'
      }`,
    )
    return redirect('unauthorized')
  }
  if (stateUserRole !== 'admin') {
    log?.error('[pinterest-oauth] op=callback rejected: state does not name a current administrator')
    return redirect('unauthorized')
  }

  if (req.user) {
    // A session did survive the redirect — hold it to the same bar.
    if ((req.user as { role?: string }).role !== 'admin') {
      log?.error('[pinterest-oauth] op=callback rejected: session user is not an administrator')
      return redirect('unauthorized')
    }
    if (String(req.user.id) !== state.userId) {
      log?.error('[pinterest-oauth] op=callback rejected: state was created for a different user')
      return redirect('state')
    }
  }

  // --- 5. Configuration -------------------------------------------------------------------
  let config: PinterestOAuthConfig
  try {
    config = deps.config ?? getPinterestOAuthConfig()
  } catch (err) {
    log?.error(
      `[pinterest-oauth] op=callback blocked: ${
        err instanceof PinterestOAuthConfigError ? err.message : 'unknown configuration error'
      }`,
    )
    return redirect('config')
  }

  // --- 6. Authorization code ---------------------------------------------------------------
  const code = (str(query, 'code') ?? '').trim()
  if (!code) {
    log?.error('[pinterest-oauth] op=callback: authorization returned no code')
    return redirect('code')
  }

  // --- 7. Exchange --------------------------------------------------------------------------
  let grant: PinterestTokenGrant
  try {
    const exchange = deps.exchange ?? exchangeAuthorizationCode
    grant = await exchange(config, code)
  } catch (err) {
    if (err instanceof PinterestOAuthError) {
      // Secret-free structured detail to the server log; nothing of it reaches the browser.
      log?.error(err.logLine('code-exchange'))
    } else {
      log?.error(
        `[pinterest-oauth] op=code-exchange failed: ${
          err instanceof Error ? err.name : 'unknown error'
        }`,
      )
    }
    return redirect('exchange')
  }

  // --- 8. Does the grant actually cover what the import needs? -------------------------------
  if (!scopeCovers(grant.scope, PINTEREST_OAUTH_SCOPES)) {
    // Nothing is stored: a grant without ads:read cannot read spend, and storing it would show
    // a green "Tilkoblet" card that fails on the first sync.
    log?.error('[pinterest-oauth] op=callback rejected: granted scope does not cover ads:read')
    return redirect('scope')
  }

  // --- 9. Persist ----------------------------------------------------------------------------
  try {
    const connectedAt = (deps.now ?? (() => new Date()))().toISOString()
    const save =
      deps.save ??
      ((g: PinterestTokenGrant, at: string) => saveNewConnection(req.payload, g, at))
    await save(grant, connectedAt)
  } catch (err) {
    // The most likely cause is a missing or malformed encryption key. The token is discarded
    // rather than stored in the clear.
    log?.error(
      `[pinterest-oauth] op=callback could not store the grant: ${
        err instanceof Error ? err.name : 'unknown error'
      }`,
    )
    return redirect('storage')
  }

  return redirect('ok')
}

export const pinterestOAuthCallbackEndpoint: Endpoint = {
  path: '/pinterest/oauth/callback',
  method: 'get',
  handler: (req: PayloadRequest): Promise<Response> => handlePinterestCallback(req),
}
