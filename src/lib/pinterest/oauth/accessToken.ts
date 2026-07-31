// Resolving a usable Pinterest access token, refreshing it when needed.
//
// This is the module every Pinterest API call goes through. Its contract:
//
//   getAccessToken()  → a token that is either valid for more than 24 hours, or has just been
//                       refreshed. Never returns an expired one.
//   forceRefresh()    → refresh regardless of the remaining lifetime. Called at most once per
//                       request, after a 401, and never in a loop.
//
// Continuous refresh makes the ordering here load-bearing: a successful refresh **retires** the
// refresh token that was sent. So the sequence is always
//
//   claim lock → call Pinterest → compare-and-swap the whole grant → release lock
//
// and never "call Pinterest, then decide". If the compare-and-swap loses, the new grant is
// dropped and the winner's grant is re-read — dropping a grant is recoverable, whereas
// overwriting a newer refresh token with an older one is not.
//
// A process that cannot take the lock does not queue behind it indefinitely: it waits briefly
// for the holder to publish a rotated grant, then gives up with a retryable message.

import type { Payload } from 'payload'
import { getPinterestOAuthConfig, PINTEREST_OAUTH_SCOPES, type PinterestOAuthConfig } from './config'
import { PinterestOAuthError, refreshAccessToken, type OAuthRequestOptions } from './exchange'
import {
  createConditionalWriter,
  encryptGrant,
  getCredentials,
  markReauthorizationRequired,
  REFRESH_LOCK_SECONDS,
  type ConditionalWriter,
  type PinterestCredentials,
} from './store'
import { accessTokenIsFresh, refreshTokenIsExpired, scopeCovers } from './tokens'

/**
 * Raised when no refresh can succeed and only a fresh "Koble til" will help. Carries safe
 * Norwegian copy; the connection has already been marked `reauthorization_required` by the time
 * this is thrown, and no marketing-expense record is affected.
 */
export class PinterestReauthorizationRequiredError extends Error {
  constructor(
    message = 'Pinterest-tilkoblingen må fornyes. Åpne Pinterest Ads og velg «Koble til på nytt».',
    /** Short internal code for the server log, e.g. `invalid_grant`. Never a token. */
    readonly code = 'reauthorization_required',
  ) {
    super(message)
    this.name = 'PinterestReauthorizationRequiredError'
  }
}

/** Raised when another process holds the refresh lock and did not finish in time. */
export class PinterestRefreshBusyError extends Error {
  constructor(
    message = 'En annen synkronisering fornyer Pinterest-tilgangen akkurat nå. Prøv igjen om litt.',
  ) {
    super(message)
    this.name = 'PinterestRefreshBusyError'
  }
}

/** What the Pinterest HTTP client needs in order to authenticate and recover from a 401. */
export interface PinterestTokenProvider {
  getAccessToken(): Promise<string>
  /** Returns the new token, or null when this provider cannot refresh (legacy env token). */
  forceRefresh(): Promise<string | null>
}

export interface TokenProviderDeps {
  config?: PinterestOAuthConfig
  writer?: ConditionalWriter
  /** Injected refresh call, so tests never reach the network. */
  refresh?: (
    config: PinterestOAuthConfig,
    refreshToken: string,
    options?: OAuthRequestOptions,
  ) => ReturnType<typeof refreshAccessToken>
  now?: () => Date
  env?: Record<string, string | undefined>
  /** Injected sleep so the lock wait is instant in tests. */
  sleep?: (ms: number) => Promise<void>
  /** Log sink. Only ever receives secret-free lines. */
  logger?: { error?: (msg: string) => void; warn?: (msg: string) => void }
}

/** How long to wait for the lock holder to publish a rotated grant before giving up. */
const LOCK_WAIT_ATTEMPTS = 6
const LOCK_WAIT_MS = 400

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * The legacy env token.
 *
 * **Migration-only fallback.** It is used exclusively when no OAuth grant is stored, so a
 * deployment that has not yet pressed "Koble til" keeps working. The moment the OAuth callback
 * stores a grant, this value is never read again — and it can then be deleted from Vercel. It
 * cannot be refreshed, so `forceRefresh()` returns null on this path rather than pretending.
 */
function legacyEnvToken(env: Record<string, string | undefined>): string | null {
  const token = (env.PINTEREST_ACCESS_TOKEN ?? '').trim()
  return token || null
}

/**
 * Build the token provider for a Payload instance.
 *
 * Cheap to construct and safe to build per sync: nothing is read until `getAccessToken()` is
 * called, and the provider holds no token in a field between calls.
 */
export function createTokenProvider(
  payload: Payload,
  deps: TokenProviderDeps = {},
): PinterestTokenProvider {
  const env = deps.env ?? process.env
  const nowFn = deps.now ?? (() => new Date())
  const sleep = deps.sleep ?? defaultSleep
  const log = deps.logger ?? payload?.logger
  let writer: ConditionalWriter | null = deps.writer ?? null

  const getWriter = (): ConditionalWriter => {
    if (!writer) writer = createConditionalWriter(payload)
    return writer
  }

  const config = (): PinterestOAuthConfig => deps.config ?? getPinterestOAuthConfig(env)

  const doRefresh = deps.refresh ?? refreshAccessToken

  /**
   * Refresh once, under the lock. Returns the new access token, or the token another process
   * rotated to while this one waited.
   */
  async function refreshUnderLock(current: PinterestCredentials): Promise<string> {
    const refreshToken = current.refreshToken
    if (!refreshToken) {
      await markReauthorizationRequired(payload, 'no_refresh_token')
      throw new PinterestReauthorizationRequiredError(undefined, 'no_refresh_token')
    }

    const now = nowFn()
    if (refreshTokenIsExpired(current.refreshTokenExpiresAt, now)) {
      // Pinterest would reject it anyway; failing here saves a pointless request and gives the
      // admin the accurate reason.
      await markReauthorizationRequired(payload, 'refresh_token_expired')
      log?.error?.('[pinterest-oauth] op=refresh refusing to use an expired refresh token')
      throw new PinterestReauthorizationRequiredError(
        'Pinterest-tilkoblingen er utløpt. Åpne Pinterest Ads og velg «Koble til på nytt».',
        'refresh_token_expired',
      )
    }

    const lock = getWriter()
    if (!(await lock.claimRefreshLock(REFRESH_LOCK_SECONDS))) {
      // Someone else is refreshing. Wait for them to publish, rather than racing them.
      for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt += 1) {
        await sleep(LOCK_WAIT_MS)
        const latest = await getCredentials(payload, env)
        if (latest.tokenVersion > current.tokenVersion && latest.accessToken) {
          return latest.accessToken
        }
        if (latest.status === 'reauthorization_required') {
          throw new PinterestReauthorizationRequiredError(undefined, 'concurrent_refresh_failed')
        }
      }
      throw new PinterestRefreshBusyError()
    }

    let grant
    try {
      grant = await doRefresh(config(), refreshToken)
    } catch (err) {
      await lock.releaseRefreshLock().catch(() => {})
      if (err instanceof PinterestOAuthError) {
        log?.error?.(err.logLine('refresh'))
        if (err.needsReauthorization) {
          // Pinterest rejected the credential itself. Imported expense records are untouched.
          await markReauthorizationRequired(payload, err.code)
          throw new PinterestReauthorizationRequiredError(err.message, err.code)
        }
      } else {
        log?.error?.(
          `[pinterest-oauth] op=refresh failed: ${err instanceof Error ? err.name : 'unknown error'}`,
        )
      }
      throw err
    }

    if (!scopeCovers(grant.scope, PINTEREST_OAUTH_SCOPES)) {
      // The grant is still stored — it is what Pinterest issued — but the admin is told that
      // the permission set no longer covers what the import needs.
      log?.warn?.('[pinterest-oauth] op=refresh granted scope no longer covers ads:read')
    }

    const refreshedAt = nowFn().toISOString()
    const swapped = await lock.swapTokens(
      current.tokenVersion,
      encryptGrant(grant, refreshedAt, env),
    )

    if (swapped) return grant.accessToken

    // Lost the compare-and-swap: another process (a concurrent refresh whose lock had expired,
    // or a fresh authorization) wrote first. Its grant is the newer one, so this one is
    // discarded and the stored token is used instead. Never the other way round.
    log?.warn?.('[pinterest-oauth] op=refresh lost the token compare-and-swap; using stored grant')
    await lock.releaseRefreshLock().catch(() => {})
    const latest = await getCredentials(payload, env)
    if (latest.accessToken) return latest.accessToken
    throw new PinterestReauthorizationRequiredError(undefined, 'lost_swap_without_token')
  }

  return {
    async getAccessToken(): Promise<string> {
      const creds = await getCredentials(payload, env)

      if (creds.status === 'reauthorization_required') {
        // The legacy env token is not a workaround for a revoked OAuth grant: the admin has
        // connected, so the connection — not an env var — is the source of truth.
        throw new PinterestReauthorizationRequiredError(undefined, creds.lastOAuthError ?? 'revoked')
      }

      if (!creds.refreshToken && !creds.accessToken) {
        const legacy = legacyEnvToken(env)
        if (legacy) return legacy
        throw new PinterestReauthorizationRequiredError(
          'Pinterest Ads er ikke koblet til. Åpne Pinterest Ads og velg «Koble til».',
          'not_connected',
        )
      }

      if (creds.accessToken && accessTokenIsFresh(creds.accessTokenExpiresAt, nowFn())) {
        return creds.accessToken
      }

      return refreshUnderLock(creds)
    },

    async forceRefresh(): Promise<string | null> {
      const creds = await getCredentials(payload, env)
      // No stored grant means this request authenticated with the legacy env token, which
      // cannot be refreshed. Returning null tells the client not to retry.
      if (!creds.refreshToken) return null
      return refreshUnderLock(creds)
    },
  }
}
