// Server-only Pinterest OAuth 2.0 configuration.
//
// Separate from src/lib/pinterest/config.ts on purpose: that module describes *which ad account
// to read and how*, this one describes *how the app authenticates*. The ads config is needed on
// every sync; the OAuth config is only needed when connecting or refreshing. Keeping them apart
// means a missing app secret cannot make an already-connected integration look unconfigured.
//
// Nothing here is ever sent to the browser. `appSecret` is only ever used to build the HTTP
// Basic header for Pinterest's token endpoint, and is never logged, thrown or serialized.

import { resolveApplicationOrigin, type AppOriginEnv } from '@/lib/appOrigin'
import { validateDedicatedKey } from '@/lib/security/tokenCrypto'

/**
 * The **only** scope this integration requests, derived from the two calls it actually makes:
 *
 *   GET /v5/ad_accounts/{ad_account_id}            → ads:read
 *   GET /v5/ad_accounts/{ad_account_id}/analytics  → ads:read
 *
 * `user_accounts:read` is deliberately NOT requested: nothing calls /v5/user_account, and the
 * ad account id comes from PINTEREST_AD_ACCOUNT_ID rather than being discovered. Asking for it
 * would be a permission the integration never exercises.
 *
 * Widening this list is the one place to change — the authorization URL, the setup document and
 * the stored-scope check all read it from here.
 */
export const PINTEREST_OAUTH_SCOPES = ['ads:read'] as const

/** Space-separated scope string, the form Pinterest's authorize endpoint expects. */
export const PINTEREST_SCOPE_STRING = PINTEREST_OAUTH_SCOPES.join(' ')

/** Path both redirect URIs end in. The Payload endpoint is mounted here. */
export const PINTEREST_CALLBACK_PATH = '/api/pinterest/oauth/callback'

/**
 * The two redirect URIs registered on the Pinterest app. Pinterest matches `redirect_uri` byte
 * for byte on both the authorize request and the token exchange, and it must be one of the
 * values registered on the app — so these are fixed constants, never derived from the incoming
 * request (a request-derived redirect target is also how open-redirect bugs get in).
 */
export const PINTEREST_PRODUCTION_REDIRECT_URI = `https://aboks.no${PINTEREST_CALLBACK_PATH}`
export const PINTEREST_LOCAL_REDIRECT_URI = `http://localhost:3000${PINTEREST_CALLBACK_PATH}`

/**
 * Which of the two registered redirect URIs this process should use.
 *
 * Explicit `PINTEREST_REDIRECT_URI` always wins — that is the escape hatch for a dev server on
 * a port other than 3000 (this project's .env.local sets PORT=3001) or for a Vercel Preview,
 * neither of which can be guessed. Otherwise the application origin decides: a localhost /
 * 127.0.0.1 origin gets the local URI, everything else gets production.
 *
 * A Preview deployment deliberately falls through to the production URI rather than inventing
 * `…vercel.app/…`: an unregistered value is rejected by Pinterest, and a wrong-but-plausible
 * URI fails far more confusingly than a wrong-but-obvious one.
 */
export function resolveRedirectUri(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = (env.PINTEREST_REDIRECT_URI ?? '').trim()
  if (explicit) return explicit

  const origin = resolveApplicationOrigin({ env: env as AppOriginEnv })
  try {
    const host = new URL(origin).hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return PINTEREST_LOCAL_REDIRECT_URI
    }
  } catch {
    // Unparseable origin — production is the safe default.
  }
  return PINTEREST_PRODUCTION_REDIRECT_URI
}

export const PINTEREST_AUTHORIZE_URL = 'https://www.pinterest.com/oauth/'
export const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token'

/** Env var holding a dedicated 32-byte key for token encryption at rest. Optional. */
export const PINTEREST_KEY_ENV = 'PINTEREST_TOKEN_ENCRYPTION_KEY'

export class PinterestOAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinterestOAuthConfigError'
  }
}

export interface PinterestOAuthConfig {
  appId: string
  /** Never leaves the server; used only for the HTTP Basic header. */
  appSecret: string
  redirectUri: string
  scope: string
  authorizeUrl: string
  tokenUrl: string
}

/** Env vars without which the OAuth flow cannot start. */
export const PINTEREST_OAUTH_REQUIRED_ENV = ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'] as const

/**
 * Read + validate the OAuth configuration. Throws PinterestOAuthConfigError with a safe,
 * secret-free Norwegian message when something is missing or malformed.
 */
export function getPinterestOAuthConfig(
  env: Record<string, string | undefined> = process.env,
): PinterestOAuthConfig {
  const appId = (env.PINTEREST_APP_ID ?? '').trim()
  const appSecret = (env.PINTEREST_APP_SECRET ?? '').trim()
  const redirectUri = resolveRedirectUri(env)

  const missing = PINTEREST_OAUTH_REQUIRED_ENV.filter((k) => !(env[k] ?? '').trim())
  if (missing.length > 0) {
    throw new PinterestOAuthConfigError(
      `Pinterest-appens legitimasjon mangler: ${missing.join(', ')} er ikke satt.`,
    )
  }

  // A non-HTTPS or malformed redirect URI would be rejected by Pinterest anyway; failing here
  // gives an actionable message instead of an opaque provider error.
  let parsed: URL
  try {
    parsed = new URL(redirectUri)
  } catch {
    throw new PinterestOAuthConfigError('PINTEREST_REDIRECT_URI er ikke en gyldig URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new PinterestOAuthConfigError('PINTEREST_REDIRECT_URI må bruke https.')
  }

  // Refuse to start a flow that could not store its result. In production a dedicated key is
  // mandatory; locally the PAYLOAD_SECRET fallback applies. The message names the variable, never
  // any value.
  const keyProblem = checkTokenEncryptionKey(env)
  if (keyProblem) throw new PinterestOAuthConfigError(keyProblem)

  return {
    appId,
    appSecret,
    redirectUri,
    scope: PINTEREST_SCOPE_STRING,
    authorizeUrl: PINTEREST_AUTHORIZE_URL,
    tokenUrl: PINTEREST_TOKEN_URL,
  }
}

/**
 * Build the URL the administrator is redirected to in order to authorize the app.
 *
 * Only non-secret values travel here: app id, the fixed redirect URI, the scope list and the
 * opaque state. The app secret is never part of an authorization URL.
 */
export function buildAuthorizationUrl(config: PinterestOAuthConfig, state: string): string {
  const url = new URL(config.authorizeUrl)
  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scope)
  url.searchParams.set('state', state)
  return url.toString()
}

/**
 * `Authorization: Basic base64(client_id:client_secret)` for the token endpoint. Returned as a
 * value to be placed in a header — never logged, never returned to a client.
 */
export function basicAuthHeader(config: PinterestOAuthConfig): string {
  return `Basic ${Buffer.from(`${config.appId}:${config.appSecret}`, 'utf8').toString('base64')}`
}

/**
 * True when this process is a production deployment.
 *
 * `NODE_ENV` is the signal rather than `VERCEL_ENV`, so the rule also holds for a self-hosted or
 * locally-built production start — and so a Preview deployment, which serves real traffic and
 * stores real tokens, is held to the same bar as Production.
 */
export function isProductionRuntime(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.NODE_ENV ?? '').trim() === 'production'
}

/**
 * Validate the token-encryption key configuration. Returns a safe message when the setup cannot
 * be used, or null when it is fine.
 *
 * **In production a dedicated `PINTEREST_TOKEN_ENCRYPTION_KEY` is mandatory.** The PAYLOAD_SECRET
 * fallback exists for local development and tests only: deriving a long-lived credential key from
 * the session secret means rotating PAYLOAD_SECRET silently destroys every stored Pinterest token,
 * and it widens the blast radius of that one secret. Neither is acceptable for real traffic, and
 * an implicit fallback is exactly the kind of thing nobody notices until the rotation.
 *
 * Called by `getPinterestOAuthConfig`, by the store before it encrypts or decrypts, and by
 * payload.config's `onInit` — so a bad key is visible in the boot log rather than only on the
 * first refresh.
 *
 * No secret value ever appears in the returned message; only variable names do.
 */
export function checkTokenEncryptionKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env[PINTEREST_KEY_ENV]

  const problem = validateDedicatedKey(raw)
  if (problem) return `${PINTEREST_KEY_ENV} er ugyldig: ${problem}.`

  if ((raw ?? '').trim()) return null

  if (isProductionRuntime(env)) {
    return `${PINTEREST_KEY_ENV} må være satt i produksjon. Generer en nøkkel med \`openssl rand -base64 32\` og legg den inn som miljøvariabel. PAYLOAD_SECRET brukes kun lokalt.`
  }

  if (!(env.PAYLOAD_SECRET ?? '').trim()) {
    return `Verken ${PINTEREST_KEY_ENV} eller PAYLOAD_SECRET er satt — Pinterest-tokens kan ikke krypteres.`
  }
  return null
}
