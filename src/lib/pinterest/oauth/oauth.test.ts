import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import {
  buildAuthorizationUrl,
  basicAuthHeader,
  checkTokenEncryptionKey,
  getPinterestOAuthConfig,
  PINTEREST_LOCAL_REDIRECT_URI,
  PINTEREST_OAUTH_SCOPES,
  PINTEREST_PRODUCTION_REDIRECT_URI,
  PinterestOAuthConfigError,
  resolveRedirectUri,
  type PinterestOAuthConfig,
} from './config'
import {
  exchangeAuthorizationCode,
  PinterestOAuthError,
  refreshAccessToken,
  type OAuthFetch,
} from './exchange'
import { createPendingState, hashState, verifyPendingState } from './state'
import {
  accessTokenIsFresh,
  parseTokenResponse,
  PinterestTokenResponseError,
  refreshTokenIsExpired,
  REFRESH_THRESHOLD_MS,
  scopeCovers,
} from './tokens'
import {
  consumePendingState,
  encryptGrant,
  getConnectionInfo,
  getCredentials,
  markReauthorizationRequired,
  savePendingState,
  saveNewConnection,
  PinterestStoreError,
  type ConditionalWriter,
  type RotatedFields,
} from './store'
import {
  createTokenProvider,
  PinterestReauthorizationRequiredError,
  PinterestRefreshBusyError,
} from './accessToken'

// Values that must never appear in a response, a redirect URL or a log line. Distinctive
// strings so a leak is unambiguous rather than a coincidence.
const APP_SECRET = 'APP-SECRET-should-never-leak'
const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const REFRESH_TOKEN = 'REFRESH-TOKEN-should-never-leak'
const NEW_ACCESS_TOKEN = 'NEW-ACCESS-TOKEN-should-never-leak'
const NEW_REFRESH_TOKEN = 'NEW-REFRESH-TOKEN-should-never-leak'
const AUTH_CODE = 'AUTH-CODE-should-never-leak'
const SECRET = 'payload-secret-used-only-in-this-test-0123456789'

const ENV = { PAYLOAD_SECRET: SECRET }

const config: PinterestOAuthConfig = getPinterestOAuthConfig({
  PINTEREST_APP_ID: '1593431',
  PINTEREST_APP_SECRET: APP_SECRET,
  PINTEREST_REDIRECT_URI: PINTEREST_PRODUCTION_REDIRECT_URI,
  // Not production, so the PAYLOAD_SECRET fallback satisfies the encryption-key requirement.
  PAYLOAD_SECRET: SECRET,
})

const NOW = new Date('2026-08-01T12:00:00.000Z')

/** A well-formed Pinterest token response. */
function tokenBody(overrides: Record<string, unknown> = {}) {
  return {
    response_type: 'authorization_code',
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    token_type: 'bearer',
    expires_in: 2_592_000,
    refresh_token_expires_in: 31_536_000,
    scope: 'ads:read',
    ...overrides,
  }
}

/** Records every request so the body, headers and URL can be asserted. */
function recordingFetch(
  status: number,
  body: unknown,
): { fetchImpl: OAuthFetch; calls: Array<{ url: string; headers: Record<string, string>; body: string }> } {
  const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = []
  const fetchImpl: OAuthFetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }
  return { fetchImpl, calls }
}

/** In-memory stand-in for the `pinterest-connection` global. */
function makePayload(initial: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = { ...initial }
  const logs: string[] = []
  const writes: Array<{ collection: string; op: string }> = []
  const payload = {
    findGlobal: async () => ({ ...doc }),
    updateGlobal: async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(doc, data)
      return { ...doc }
    },
    findByID: async () => ({ role: 'admin' }),
    create: async ({ collection }: { collection: string }) => {
      writes.push({ collection, op: 'create' })
      return {}
    },
    update: async ({ collection }: { collection: string }) => {
      writes.push({ collection, op: 'update' })
      return {}
    },
    find: async () => ({ docs: [], totalDocs: 0 }),
    logger: {
      error: (m: string) => logs.push(m),
      warn: (m: string) => logs.push(m),
      info: () => {},
    },
  } as unknown as Payload
  return { payload, doc, logs, writes }
}

/**
 * ConditionalWriter over the in-memory doc, with the same semantics as the SQL:
 * the lock is exclusive until it expires, and the swap only lands on a version match.
 */
function makeWriter(doc: Record<string, unknown>, now: () => Date = () => NOW): ConditionalWriter {
  return {
    async claimRefreshLock(lockSeconds: number): Promise<boolean> {
      const held = doc.refreshLockExpiresAt as string | null | undefined
      if (held && Date.parse(held) > now().getTime()) return false
      doc.refreshLockExpiresAt = new Date(now().getTime() + lockSeconds * 1000).toISOString()
      return true
    },
    async releaseRefreshLock(): Promise<void> {
      doc.refreshLockExpiresAt = null
    },
    async swapTokens(expectedVersion: number, f: RotatedFields): Promise<boolean> {
      if ((doc.tokenVersion ?? 0) !== expectedVersion) return false
      Object.assign(doc, {
        accessTokenEncrypted: f.accessTokenEncrypted,
        refreshTokenEncrypted: f.refreshTokenEncrypted,
        accessTokenExpiresAt: f.accessTokenExpiresAt,
        refreshTokenExpiresAt: f.refreshTokenExpiresAt,
        scope: f.scope,
        tokenType: f.tokenType,
        lastRefreshedAt: f.lastRefreshedAt,
        connectionStatus: 'connected',
        lastOAuthError: null,
        refreshLockExpiresAt: null,
        tokenVersion: expectedVersion + 1,
      })
      return true
    },
  }
}

/** A stored connection whose access token expires at `accessExpiry`. */
async function connectedPayload(accessExpiry: string, refreshExpiry: string | null = '2027-08-01T12:00:00.000Z') {
  const { payload, doc, logs, writes } = makePayload()
  await saveNewConnection(
    payload,
    {
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenType: 'bearer',
      accessTokenExpiresAt: accessExpiry,
      refreshTokenExpiresAt: refreshExpiry,
      scope: 'ads:read',
    },
    NOW.toISOString(),
    ENV,
  )
  return { payload, doc, logs, writes }
}

// =============================================================================================
// Scopes, redirect URI and the authorization URL
// =============================================================================================

describe('pinterest oauth — scopes', () => {
  it('requests only ads:read, the scope the two API calls actually need', () => {
    // GET /v5/ad_accounts/{id} and /v5/ad_accounts/{id}/analytics both need ads:read; nothing
    // calls /v5/user_account, so user_accounts:read would be an unexercised permission.
    assert.deepEqual([...PINTEREST_OAUTH_SCOPES], ['ads:read'])
    assert.ok(!PINTEREST_OAUTH_SCOPES.includes('user_accounts:read' as never))
  })
})

describe('pinterest oauth — redirect URI', () => {
  it('uses the exact production URI when the origin is aboks.no', () => {
    assert.equal(
      resolveRedirectUri({ NEXT_PUBLIC_SERVER_URL: 'https://aboks.no' }),
      'https://aboks.no/api/pinterest/oauth/callback',
    )
  })

  it('uses the exact localhost URI in local development', () => {
    assert.equal(
      resolveRedirectUri({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' }),
      'http://localhost:3000/api/pinterest/oauth/callback',
    )
  })

  it('never invents a Vercel preview hostname Pinterest has not been told about', () => {
    assert.equal(
      resolveRedirectUri({
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: 'aboks-git-x.vercel.app',
      }),
      PINTEREST_PRODUCTION_REDIRECT_URI,
    )
  })

  it('lets an explicit override win, for a dev server on another port', () => {
    assert.equal(
      resolveRedirectUri({
        NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
        PINTEREST_REDIRECT_URI: 'http://localhost:3001/api/pinterest/oauth/callback',
      }),
      'http://localhost:3001/api/pinterest/oauth/callback',
    )
  })

  it('rejects a non-https override', () => {
    assert.throws(
      () =>
        getPinterestOAuthConfig({
          PINTEREST_APP_ID: '1',
          PINTEREST_APP_SECRET: 's',
          PINTEREST_REDIRECT_URI: 'http://evil.example.com/cb',
        }),
      PinterestOAuthConfigError,
    )
  })

  it('requires the app credentials and names what is missing without leaking a value', () => {
    try {
      getPinterestOAuthConfig({ PINTEREST_APP_SECRET: APP_SECRET })
      assert.fail('expected a config error')
    } catch (err) {
      assert.ok(err instanceof PinterestOAuthConfigError)
      assert.match(err.message, /PINTEREST_APP_ID/)
      assert.ok(!err.message.includes(APP_SECRET))
    }
  })

  it('rejects a malformed PINTEREST_TOKEN_ENCRYPTION_KEY', () => {
    assert.throws(
      () =>
        getPinterestOAuthConfig({
          PINTEREST_APP_ID: '1',
          PINTEREST_APP_SECRET: 's',
          PINTEREST_TOKEN_ENCRYPTION_KEY: 'too-short',
        }),
      PinterestOAuthConfigError,
    )
  })
})

// =============================================================================================
// Token-encryption key: mandatory in production
// =============================================================================================

describe('pinterest oauth — token encryption key', () => {
  const APP = { PINTEREST_APP_ID: '1', PINTEREST_APP_SECRET: APP_SECRET }
  const KEY = Buffer.alloc(32, 7).toString('base64')

  it('accepts the PAYLOAD_SECRET fallback outside production', () => {
    assert.equal(checkTokenEncryptionKey({ PAYLOAD_SECRET: SECRET }), null)
    assert.equal(checkTokenEncryptionKey({ NODE_ENV: 'development', PAYLOAD_SECRET: SECRET }), null)
    assert.equal(checkTokenEncryptionKey({ NODE_ENV: 'test', PAYLOAD_SECRET: SECRET }), null)
  })

  it('requires a dedicated key in production, PAYLOAD_SECRET notwithstanding', () => {
    const problem = checkTokenEncryptionKey({ NODE_ENV: 'production', PAYLOAD_SECRET: SECRET })
    assert.ok(problem)
    assert.match(problem, /PINTEREST_TOKEN_ENCRYPTION_KEY/)
    assert.match(problem, /produksjon/)
    // The message names variables, never values.
    assert.ok(!problem.includes(SECRET))
    assert.ok(!problem.includes(APP_SECRET))
  })

  it('is satisfied in production by a valid dedicated key', () => {
    assert.equal(checkTokenEncryptionKey({ NODE_ENV: 'production', PINTEREST_TOKEN_ENCRYPTION_KEY: KEY }), null)
    // base64url and hex are accepted too.
    assert.equal(
      checkTokenEncryptionKey({
        NODE_ENV: 'production',
        PINTEREST_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('hex'),
      }),
      null,
    )
  })

  it('rejects a key that is not exactly 32 bytes, in any environment', () => {
    for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'development' }]) {
      const problem = checkTokenEncryptionKey({
        ...env,
        PAYLOAD_SECRET: SECRET,
        PINTEREST_TOKEN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
      })
      assert.ok(problem)
      assert.match(problem, /32 byte/)
    }
  })

  it('blocks the OAuth config in production when the key is missing', () => {
    assert.throws(
      () => getPinterestOAuthConfig({ ...APP, NODE_ENV: 'production', PAYLOAD_SECRET: SECRET }),
      (err: unknown) => {
        assert.ok(err instanceof PinterestOAuthConfigError)
        assert.match(err.message, /PINTEREST_TOKEN_ENCRYPTION_KEY/)
        assert.ok(!err.message.includes(APP_SECRET))
        assert.ok(!err.message.includes(SECRET))
        return true
      },
    )
  })

  it('allows the OAuth config in production once the key is set', () => {
    const cfg = getPinterestOAuthConfig({
      ...APP,
      NODE_ENV: 'production',
      // The redirect URI follows the application origin, not NODE_ENV — a production build
      // pointed at localhost is a legitimate local `next build && next start`.
      NEXT_PUBLIC_SERVER_URL: 'https://aboks.no',
      PINTEREST_TOKEN_ENCRYPTION_KEY: KEY,
    })
    assert.equal(cfg.redirectUri, PINTEREST_PRODUCTION_REDIRECT_URI)
  })

  it('refuses to encrypt a grant in production without the key', async () => {
    const { payload } = makePayload()
    await assert.rejects(
      () =>
        saveNewConnection(
          payload,
          {
            accessToken: ACCESS_TOKEN,
            refreshToken: REFRESH_TOKEN,
            tokenType: 'bearer',
            accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
            refreshTokenExpiresAt: null,
            scope: 'ads:read',
          },
          NOW.toISOString(),
          { NODE_ENV: 'production', PAYLOAD_SECRET: SECRET },
        ),
      (err: unknown) => {
        assert.ok(err instanceof PinterestStoreError)
        assert.match(err.message, /PINTEREST_TOKEN_ENCRYPTION_KEY/)
        assert.ok(!err.message.includes(SECRET))
        return true
      },
    )
  })

  it('refuses to decrypt in production without the key, rather than silently falling back', async () => {
    // Stored locally under the PAYLOAD_SECRET fallback…
    const { payload } = await connectedPayload('2026-08-31T12:00:00.000Z')
    // …and then read by a production process that lost the variable. Failing loudly here is the
    // point: a silent fallback would write ciphertext under a key nobody can reproduce later.
    await assert.rejects(
      () => getCredentials(payload, { NODE_ENV: 'production', PAYLOAD_SECRET: SECRET }),
      PinterestStoreError,
    )
  })

  it('round-trips a grant encrypted under a dedicated key', async () => {
    const prodEnv = { NODE_ENV: 'production', PINTEREST_TOKEN_ENCRYPTION_KEY: KEY }
    const { payload, doc } = makePayload()
    await saveNewConnection(
      payload,
      {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        tokenType: 'bearer',
        accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
        refreshTokenExpiresAt: null,
        scope: 'ads:read',
      },
      NOW.toISOString(),
      prodEnv,
    )
    assert.ok(!JSON.stringify(doc).includes(ACCESS_TOKEN))
    const creds = await getCredentials(payload, prodEnv)
    assert.equal(creds.accessToken, ACCESS_TOKEN)
    assert.equal(creds.refreshToken, REFRESH_TOKEN)

    // A different dedicated key cannot read it.
    const other = await getCredentials(payload, {
      NODE_ENV: 'production',
      PINTEREST_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
    })
    assert.equal(other.accessToken, null)
  })
})

describe('pinterest oauth — authorization URL', () => {
  const url = new URL(buildAuthorizationUrl(config, 'STATE-VALUE'))

  it('points at Pinterest with the exact registered redirect URI', () => {
    assert.equal(url.origin + url.pathname, 'https://www.pinterest.com/oauth/')
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://aboks.no/api/pinterest/oauth/callback',
    )
  })

  it('requests only ads:read, as an authorization code', () => {
    assert.equal(url.searchParams.get('scope'), 'ads:read')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('client_id'), '1593431')
    assert.equal(url.searchParams.get('state'), 'STATE-VALUE')
  })

  it('never carries the app secret', () => {
    assert.ok(!url.toString().includes(APP_SECRET))
  })
})

// =============================================================================================
// State: creation, expiry, mismatch, one-time use
// =============================================================================================

describe('pinterest oauth — state', () => {
  it('creates an unguessable value and stores only its hash', () => {
    const { state, pending } = createPendingState('7', NOW.getTime())
    assert.ok(state.length >= 40)
    assert.notEqual(pending.hash, state)
    assert.equal(pending.hash, hashState(state))
    assert.equal(pending.userId, '7')
    // Ten-minute TTL.
    assert.equal(Date.parse(pending.expiresAt) - NOW.getTime(), 10 * 60_000)
  })

  it('produces a different value every time', () => {
    const a = createPendingState('7').state
    const b = createPendingState('7').state
    assert.notEqual(a, b)
  })

  it('accepts the matching value before it expires', () => {
    const { state, pending } = createPendingState('7', NOW.getTime())
    const result = verifyPendingState(state, pending, NOW.getTime() + 60_000)
    assert.deepEqual(result, { ok: true, userId: '7' })
  })

  it('rejects a missing state', () => {
    const { pending } = createPendingState('7', NOW.getTime())
    assert.deepEqual(verifyPendingState(undefined, pending, NOW.getTime()), {
      ok: false,
      reason: 'missing',
    })
    assert.deepEqual(verifyPendingState('   ', pending, NOW.getTime()), {
      ok: false,
      reason: 'missing',
    })
  })

  it('rejects a mismatched state', () => {
    const { pending } = createPendingState('7', NOW.getTime())
    const other = createPendingState('7', NOW.getTime()).state
    assert.deepEqual(verifyPendingState(other, pending, NOW.getTime()), {
      ok: false,
      reason: 'mismatch',
    })
  })

  it('rejects an expired state', () => {
    const { state, pending } = createPendingState('7', NOW.getTime())
    const after = NOW.getTime() + 10 * 60_000 + 1
    assert.deepEqual(verifyPendingState(state, pending, after), { ok: false, reason: 'expired' })
  })

  it('rejects any state once none is pending — which is what makes it one-time', () => {
    const { state } = createPendingState('7', NOW.getTime())
    assert.deepEqual(verifyPendingState(state, null, NOW.getTime()), {
      ok: false,
      reason: 'none-pending',
    })
  })

  it('consuming the stored state clears it, so a replay finds nothing', async () => {
    const { payload, doc } = makePayload()
    const { state, pending } = createPendingState('7', NOW.getTime())
    await savePendingState(payload, pending)
    assert.equal(doc.pendingStateHash, pending.hash)

    const first = await consumePendingState(payload)
    assert.deepEqual(first, pending)
    assert.equal(doc.pendingStateHash, null)

    // Second presentation of the same value: nothing left to match.
    const second = await consumePendingState(payload)
    assert.equal(second, null)
    assert.deepEqual(verifyPendingState(state, second, NOW.getTime()), {
      ok: false,
      reason: 'none-pending',
    })
  })

  it('never stores the state value itself', async () => {
    const { payload, doc } = makePayload()
    const { state, pending } = createPendingState('7', NOW.getTime())
    await savePendingState(payload, pending)
    assert.ok(!JSON.stringify(doc).includes(state))
  })
})

// =============================================================================================
// Token response parsing and expiry maths
// =============================================================================================

describe('pinterest oauth — token response', () => {
  it('converts relative lifetimes into absolute instants', () => {
    const grant = parseTokenResponse(tokenBody(), NOW)
    assert.equal(grant.accessToken, ACCESS_TOKEN)
    assert.equal(grant.refreshToken, REFRESH_TOKEN)
    assert.equal(grant.tokenType, 'bearer')
    assert.equal(grant.scope, 'ads:read')
    assert.equal(grant.accessTokenExpiresAt, '2026-08-31T12:00:00.000Z') // +30 days
    assert.equal(grant.refreshTokenExpiresAt, '2027-08-01T12:00:00.000Z') // +365 days
  })

  it('rejects a body that is not an object', () => {
    for (const body of [null, undefined, 'ok', 42, []]) {
      assert.throws(() => parseTokenResponse(body, NOW), PinterestTokenResponseError)
    }
  })

  it('rejects a 200 with no access token rather than storing half a grant', () => {
    assert.throws(
      () => parseTokenResponse(tokenBody({ access_token: undefined }), NOW),
      (err: unknown) => err instanceof PinterestTokenResponseError && err.code === 'no-access-token',
    )
    assert.throws(
      () => parseTokenResponse(tokenBody({ access_token: '   ' }), NOW),
      PinterestTokenResponseError,
    )
  })

  it('rejects a rotating grant with no refresh token', () => {
    assert.throws(
      () => parseTokenResponse(tokenBody({ refresh_token: undefined }), NOW),
      (err: unknown) =>
        err instanceof PinterestTokenResponseError && err.code === 'no-refresh-token',
    )
  })

  it('falls back to a short access lifetime when expires_in is absent or nonsense', () => {
    for (const value of [undefined, 0, -5, 'abc']) {
      const grant = parseTokenResponse(tokenBody({ expires_in: value }), NOW)
      assert.equal(grant.accessTokenExpiresAt, '2026-08-01T13:00:00.000Z') // +1 hour
    }
  })

  it('accepts a numeric string lifetime', () => {
    const grant = parseTokenResponse(tokenBody({ expires_in: '3600' }), NOW)
    assert.equal(grant.accessTokenExpiresAt, '2026-08-01T13:00:00.000Z')
  })

  it('leaves the refresh expiry null when Pinterest does not state one', () => {
    const grant = parseTokenResponse(tokenBody({ refresh_token_expires_in: undefined }), NOW)
    assert.equal(grant.refreshTokenExpiresAt, null)
  })
})

describe('pinterest oauth — expiry decisions', () => {
  it('uses a token with more than 24 hours left', () => {
    const in25h = new Date(NOW.getTime() + 25 * 3600_000).toISOString()
    assert.equal(accessTokenIsFresh(in25h, NOW), true)
  })

  it('refreshes a token with less than 24 hours left', () => {
    const in23h = new Date(NOW.getTime() + 23 * 3600_000).toISOString()
    assert.equal(accessTokenIsFresh(in23h, NOW), false)
  })

  it('treats exactly 24 hours as due for refresh', () => {
    const at24h = new Date(NOW.getTime() + REFRESH_THRESHOLD_MS).toISOString()
    assert.equal(accessTokenIsFresh(at24h, NOW), false)
  })

  it('treats an unknown or unparseable expiry as due for refresh', () => {
    assert.equal(accessTokenIsFresh(null, NOW), false)
    assert.equal(accessTokenIsFresh('not-a-date', NOW), false)
  })

  it('detects an expired refresh token, but does not invent one', () => {
    assert.equal(refreshTokenIsExpired('2026-07-31T12:00:00.000Z', NOW), true)
    assert.equal(refreshTokenIsExpired('2027-07-31T12:00:00.000Z', NOW), false)
    assert.equal(refreshTokenIsExpired(null, NOW), false)
  })

  it('accepts a granted scope set that covers ads:read in any order', () => {
    assert.equal(scopeCovers('ads:read', ['ads:read']), true)
    assert.equal(scopeCovers('user_accounts:read ads:read', ['ads:read']), true)
    assert.equal(scopeCovers('boards:read', ['ads:read']), false)
    // An omitted scope field is not evidence of a narrower grant.
    assert.equal(scopeCovers('', ['ads:read']), true)
  })
})

// =============================================================================================
// The token endpoint: HTTP Basic, form encoding, error mapping
// =============================================================================================

describe('pinterest oauth — code exchange', () => {
  it('POSTs form-encoded to the v5 token endpoint with HTTP Basic auth', async () => {
    const { fetchImpl, calls } = recordingFetch(200, tokenBody())
    await exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl, now: () => NOW })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.pinterest.com/v5/oauth/token')
    assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded')

    const expected = Buffer.from(`1593431:${APP_SECRET}`, 'utf8').toString('base64')
    assert.equal(calls[0].headers.Authorization, `Basic ${expected}`)
    assert.equal(basicAuthHeader(config), `Basic ${expected}`)
  })

  it('sends exactly grant_type, code and the registered redirect_uri', async () => {
    const { fetchImpl, calls } = recordingFetch(200, tokenBody())
    await exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl, now: () => NOW })

    const body = new URLSearchParams(calls[0].body)
    assert.equal(body.get('grant_type'), 'authorization_code')
    assert.equal(body.get('code'), AUTH_CODE)
    assert.equal(body.get('redirect_uri'), 'https://aboks.no/api/pinterest/oauth/callback')
    // This app was created after 2025-09-25, so rotation is automatic and the opt-in flag for
    // older apps must not be sent.
    assert.equal(body.get('continuous_refresh'), null)
    assert.deepEqual([...body.keys()].sort(), ['code', 'grant_type', 'redirect_uri'])
  })

  it('never puts the secret or the code in the URL', async () => {
    const { fetchImpl, calls } = recordingFetch(200, tokenBody())
    await exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl, now: () => NOW })
    assert.ok(!calls[0].url.includes(APP_SECRET))
    assert.ok(!calls[0].url.includes(AUTH_CODE))
  })

  it('maps invalid_grant to a safe message and flags re-authorization', async () => {
    const { fetchImpl } = recordingFetch(400, {
      error: 'invalid_grant',
      error_description: 'Authorization code is invalid',
    })
    await assert.rejects(
      () => exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof PinterestOAuthError)
        assert.equal(err.code, 'invalid_grant')
        assert.equal(err.needsReauthorization, true)
        assert.match(err.message, /Koble til på nytt|brukt opp/)
        assert.ok(!err.message.includes(AUTH_CODE))
        assert.ok(!err.logLine('code-exchange').includes(APP_SECRET))
        return true
      },
    )
  })

  it('maps invalid_client without suggesting a re-authorization would help', async () => {
    const { fetchImpl } = recordingFetch(401, { error: 'invalid_client' })
    await assert.rejects(
      () => exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof PinterestOAuthError)
        assert.match(err.message, /PINTEREST_APP_ID/)
        return true
      },
    )
  })

  it('rejects a 200 whose body is malformed', async () => {
    const { fetchImpl } = recordingFetch(200, { access_token: '' })
    await assert.rejects(
      () => exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl, now: () => NOW }),
      PinterestTokenResponseError,
    )
  })

  it('rejects a 200 that is not JSON at all', async () => {
    const fetchImpl: OAuthFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json')
      },
      text: async () => '<html/>',
    })
    await assert.rejects(
      () => exchangeAuthorizationCode(config, AUTH_CODE, { fetchImpl }),
      (err: unknown) => err instanceof PinterestOAuthError && err.code === 'invalid_json',
    )
  })
})

describe('pinterest oauth — refresh grant', () => {
  it('sends grant_type=refresh_token with the current refresh token, and no redirect_uri', async () => {
    const { fetchImpl, calls } = recordingFetch(
      200,
      tokenBody({ access_token: NEW_ACCESS_TOKEN, refresh_token: NEW_REFRESH_TOKEN }),
    )
    const grant = await refreshAccessToken(config, REFRESH_TOKEN, { fetchImpl, now: () => NOW })

    const body = new URLSearchParams(calls[0].body)
    assert.equal(body.get('grant_type'), 'refresh_token')
    assert.equal(body.get('refresh_token'), REFRESH_TOKEN)
    assert.equal(body.get('continuous_refresh'), null)
    assert.deepEqual([...body.keys()].sort(), ['grant_type', 'refresh_token'])

    // Continuous refresh: a NEW refresh token comes back and replaces the old one.
    assert.equal(grant.accessToken, NEW_ACCESS_TOKEN)
    assert.equal(grant.refreshToken, NEW_REFRESH_TOKEN)
  })

  it('uses HTTP Basic, so the secret never reaches the body or the URL', async () => {
    const { fetchImpl, calls } = recordingFetch(200, tokenBody())
    await refreshAccessToken(config, REFRESH_TOKEN, { fetchImpl, now: () => NOW })
    assert.ok(calls[0].headers.Authorization.startsWith('Basic '))
    assert.ok(!calls[0].body.includes(APP_SECRET))
    assert.ok(!calls[0].url.includes(APP_SECRET))
  })
})

// =============================================================================================
// Storage: encryption at rest, no plaintext, no leakage
// =============================================================================================

describe('pinterest oauth — token storage', () => {
  it('stores ciphertext, never the plaintext tokens', async () => {
    const { doc } = await connectedPayload('2026-08-31T12:00:00.000Z')
    const raw = JSON.stringify(doc)
    assert.ok(!raw.includes(ACCESS_TOKEN))
    assert.ok(!raw.includes(REFRESH_TOKEN))
    assert.match(String(doc.accessTokenEncrypted), /^v1:/)
    assert.match(String(doc.refreshTokenEncrypted), /^v1:/)
  })

  it('round-trips the tokens for server code only', async () => {
    const { payload } = await connectedPayload('2026-08-31T12:00:00.000Z')
    const creds = await getCredentials(payload, ENV)
    assert.equal(creds.accessToken, ACCESS_TOKEN)
    assert.equal(creds.refreshToken, REFRESH_TOKEN)
    assert.equal(creds.status, 'connected')
    assert.equal(creds.scope, 'ads:read')
  })

  it('keeps every token out of the connection info the admin UI receives', async () => {
    const { payload } = await connectedPayload('2026-08-31T12:00:00.000Z')
    const info = await getConnectionInfo(payload)
    const serialized = JSON.stringify(info)
    assert.ok(!serialized.includes(ACCESS_TOKEN))
    assert.ok(!serialized.includes(REFRESH_TOKEN))
    assert.ok(!('accessToken' in info))
    assert.ok(!('refreshToken' in info))
  })

  it('degrades to "no credential" when the ciphertext cannot be authenticated', async () => {
    const { payload, doc } = await connectedPayload('2026-08-31T12:00:00.000Z')
    doc.accessTokenEncrypted = 'v1:AAAA:BBBB:CCCC'
    const creds = await getCredentials(payload, ENV)
    assert.equal(creds.accessToken, null)
  })

  it('ignores a grant written under a different key rather than crashing', async () => {
    const { payload } = await connectedPayload('2026-08-31T12:00:00.000Z')
    const creds = await getCredentials(payload, { PAYLOAD_SECRET: 'a-completely-different-secret' })
    assert.equal(creds.accessToken, null)
    assert.equal(creds.refreshToken, null)
  })

  it('clears the tokens and records only a short code when re-authorization is required', async () => {
    const { payload, doc } = await connectedPayload('2026-08-31T12:00:00.000Z')
    await markReauthorizationRequired(payload, 'invalid_grant')
    assert.equal(doc.connectionStatus, 'reauthorization_required')
    assert.equal(doc.accessTokenEncrypted, null)
    assert.equal(doc.refreshTokenEncrypted, null)
    assert.equal(doc.lastOAuthError, 'invalid_grant')
  })

  it('truncates the recorded error code so no payload can be smuggled into it', async () => {
    const { payload, doc } = await connectedPayload('2026-08-31T12:00:00.000Z')
    await markReauthorizationRequired(payload, 'x'.repeat(500))
    assert.equal(String(doc.lastOAuthError).length, 64)
  })

  it('advances the token version on a new authorization', async () => {
    const { payload, doc } = await connectedPayload('2026-08-31T12:00:00.000Z')
    const before = doc.tokenVersion as number
    await saveNewConnection(
      payload,
      {
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
        tokenType: 'bearer',
        accessTokenExpiresAt: '2026-09-30T12:00:00.000Z',
        refreshTokenExpiresAt: null,
        scope: 'ads:read',
      },
      NOW.toISOString(),
      ENV,
    )
    assert.equal(doc.tokenVersion, before + 1)
  })
})

// =============================================================================================
// The token provider: automatic refresh, rotation, concurrency, forced refresh
// =============================================================================================

describe('pinterest token provider — automatic refresh', () => {
  it('uses a stored token that is valid for more than 24 hours, making no network call', async () => {
    const { payload, doc } = await connectedPayload('2026-09-01T12:00:00.000Z')
    let called = 0
    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer: makeWriter(doc),
      refresh: async () => {
        called += 1
        throw new Error('must not refresh')
      },
    })
    assert.equal(await provider.getAccessToken(), ACCESS_TOKEN)
    assert.equal(called, 0)
  })

  it('refreshes when less than 24 hours remain, and rotates the refresh token', async () => {
    // 23 hours left — inside the threshold.
    const { payload, doc } = await connectedPayload('2026-08-02T11:00:00.000Z')
    const versionBefore = doc.tokenVersion as number
    let sentRefreshToken = ''

    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer: makeWriter(doc),
      refresh: async (_c, token) => {
        sentRefreshToken = token
        return {
          accessToken: NEW_ACCESS_TOKEN,
          refreshToken: NEW_REFRESH_TOKEN,
          tokenType: 'bearer',
          accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
          refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
          scope: 'ads:read',
        }
      },
    })

    assert.equal(await provider.getAccessToken(), NEW_ACCESS_TOKEN)
    assert.equal(sentRefreshToken, REFRESH_TOKEN)

    // Both new values are persisted atomically, and the old refresh token is gone.
    const after = await getCredentials(payload, ENV)
    assert.equal(after.accessToken, NEW_ACCESS_TOKEN)
    assert.equal(after.refreshToken, NEW_REFRESH_TOKEN)
    assert.notEqual(after.refreshToken, REFRESH_TOKEN)
    assert.equal(after.accessTokenExpiresAt, '2026-08-31T12:00:00.000Z')
    assert.equal(doc.tokenVersion, versionBefore + 1)
    // The lock is released for the next run.
    assert.equal(doc.refreshLockExpiresAt, null)
    // Still ciphertext on disk.
    assert.ok(!JSON.stringify(doc).includes(NEW_REFRESH_TOKEN))
  })

  it('never reuses the previous refresh token after a successful rotation', async () => {
    const { payload, doc } = await connectedPayload('2026-08-02T11:00:00.000Z')
    const sent: string[] = []
    let n = 0
    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      // Each refresh returns a token that is again nearly expired, forcing a second rotation.
      now: () => NOW,
      writer: makeWriter(doc),
      refresh: async (_c, token) => {
        sent.push(token)
        n += 1
        return {
          accessToken: `access-${n}`,
          refreshToken: `refresh-${n}`,
          tokenType: 'bearer',
          accessTokenExpiresAt: '2026-08-02T11:00:00.000Z',
          refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
          scope: 'ads:read',
        }
      },
    })

    await provider.getAccessToken()
    await provider.getAccessToken()
    assert.deepEqual(sent, [REFRESH_TOKEN, 'refresh-1'])
  })
})

describe('pinterest token provider — concurrent refresh protection', () => {
  it('only one of two concurrent syncs calls Pinterest; the other adopts its result', async () => {
    const { payload, doc } = await connectedPayload('2026-08-02T11:00:00.000Z')
    const writer = makeWriter(doc)
    let refreshCalls = 0

    // Both providers share one doc and one writer — the same thing two serverless invocations
    // would share through the database row.
    const make = () =>
      createTokenProvider(payload, {
        config,
        env: ENV,
        now: () => NOW,
        writer,
        // A real (short) wait: the loser must actually poll for the winner's published grant,
        // which is the behaviour under test. A no-op sleep would exhaust all six attempts
        // before the winner's request had a chance to complete.
        sleep: () => new Promise((r) => setTimeout(r, 15)),
        refresh: async () => {
          refreshCalls += 1
          // Simulate latency, so the second caller is definitely inside the lock window.
          await new Promise((r) => setTimeout(r, 20))
          return {
            accessToken: NEW_ACCESS_TOKEN,
            refreshToken: NEW_REFRESH_TOKEN,
            tokenType: 'bearer',
            accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
            refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
            scope: 'ads:read',
          }
        },
      })

    const [a, b] = await Promise.all([make().getAccessToken(), make().getAccessToken()])

    // Exactly one rotation happened — the old refresh token was presented to Pinterest once.
    assert.equal(refreshCalls, 1)
    assert.equal(a, NEW_ACCESS_TOKEN)
    assert.equal(b, NEW_ACCESS_TOKEN)
    assert.equal(doc.tokenVersion, 2)
  })

  it('gives up with a retryable message when the lock holder never publishes', async () => {
    const { payload, doc } = await connectedPayload('2026-08-02T11:00:00.000Z')
    // A lock held by someone else that does not resolve.
    doc.refreshLockExpiresAt = new Date(NOW.getTime() + 60_000).toISOString()

    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer: makeWriter(doc),
      sleep: async () => {},
      refresh: async () => {
        throw new Error('must not be reached')
      },
    })

    await assert.rejects(() => provider.getAccessToken(), PinterestRefreshBusyError)
  })

  it('discards its own grant rather than overwriting a newer one when the swap is lost', async () => {
    const { payload, doc } = await connectedPayload('2026-08-02T11:00:00.000Z')
    const base = makeWriter(doc)
    const writer: ConditionalWriter = {
      claimRefreshLock: base.claimRefreshLock,
      releaseRefreshLock: base.releaseRefreshLock,
      // Simulate another process having rotated in the meantime: the version no longer matches.
      swapTokens: async () => false,
    }

    // What the "winner" left behind.
    await saveNewConnection(
      payload,
      {
        accessToken: 'winner-access',
        refreshToken: 'winner-refresh',
        tokenType: 'bearer',
        accessTokenExpiresAt: '2026-09-30T12:00:00.000Z',
        refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
        scope: 'ads:read',
      },
      NOW.toISOString(),
      ENV,
    )

    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer,
      sleep: async () => {},
      refresh: async () => ({
        accessToken: 'loser-access',
        refreshToken: 'loser-refresh',
        tokenType: 'bearer',
        accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
        refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
        scope: 'ads:read',
      }),
    })

    assert.equal(await provider.forceRefresh(), 'winner-access')
    const after = await getCredentials(payload, ENV)
    assert.equal(after.refreshToken, 'winner-refresh')
  })
})

describe('pinterest token provider — rejected and expired refresh tokens', () => {
  it('marks the connection for re-authorization when Pinterest rejects the refresh token', async () => {
    const { payload, doc, logs } = await connectedPayload('2026-08-02T11:00:00.000Z')

    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer: makeWriter(doc),
      logger: { error: (m) => logs.push(m), warn: (m) => logs.push(m) },
      refresh: async () => {
        throw new PinterestOAuthError('avvist', 'invalid_grant', 400, 'Refresh token revoked')
      },
    })

    await assert.rejects(() => provider.getAccessToken(), PinterestReauthorizationRequiredError)
    assert.equal(doc.connectionStatus, 'reauthorization_required')
    assert.equal(doc.lastOAuthError, 'invalid_grant')
    // The lock must not be left held after a failure.
    assert.equal(doc.refreshLockExpiresAt, null)
    // No token in any log line.
    assert.ok(!logs.join('\n').includes(REFRESH_TOKEN))
    assert.ok(!logs.join('\n').includes(APP_SECRET))
  })

  it('refuses to present a refresh token that has already expired', async () => {
    const { payload, doc } = await connectedPayload(
      '2026-08-02T11:00:00.000Z',
      '2026-07-01T12:00:00.000Z', // expired a month ago
    )
    let called = 0
    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer: makeWriter(doc),
      refresh: async () => {
        called += 1
        throw new Error('must not be called')
      },
    })

    await assert.rejects(
      () => provider.getAccessToken(),
      (err: unknown) =>
        err instanceof PinterestReauthorizationRequiredError && err.code === 'refresh_token_expired',
    )
    assert.equal(called, 0)
    assert.equal(doc.connectionStatus, 'reauthorization_required')
  })

  it('does not fall back to the legacy env token once the grant has been revoked', async () => {
    const { payload, doc } = await connectedPayload('2026-08-02T11:00:00.000Z')
    await markReauthorizationRequired(payload, 'invalid_grant')

    const provider = createTokenProvider(payload, {
      config,
      env: { ...ENV, PINTEREST_ACCESS_TOKEN: 'legacy-env-token' },
      now: () => NOW,
      writer: makeWriter(doc),
    })
    await assert.rejects(() => provider.getAccessToken(), PinterestReauthorizationRequiredError)
  })

  it('uses the legacy env token only while nothing has been connected', async () => {
    const { payload, doc } = makePayload()
    const provider = createTokenProvider(payload, {
      config,
      env: { ...ENV, PINTEREST_ACCESS_TOKEN: 'legacy-env-token' },
      now: () => NOW,
      writer: makeWriter(doc),
    })
    assert.equal(await provider.getAccessToken(), 'legacy-env-token')
    // …and it cannot be refreshed, so a 401 must not trigger a retry loop.
    assert.equal(await provider.forceRefresh(), null)
  })

  it('reports "not connected" when there is neither a grant nor an env token', async () => {
    const { payload, doc } = makePayload()
    const provider = createTokenProvider(payload, {
      config,
      env: ENV,
      now: () => NOW,
      writer: makeWriter(doc),
    })
    await assert.rejects(
      () => provider.getAccessToken(),
      (err: unknown) =>
        err instanceof PinterestReauthorizationRequiredError && err.code === 'not_connected',
    )
  })
})

describe('pinterest oauth — encryptGrant', () => {
  it('produces ciphertext for both tokens and preserves the non-secret fields', () => {
    const fields = encryptGrant(
      {
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        tokenType: 'bearer',
        accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
        refreshTokenExpiresAt: null,
        scope: 'ads:read',
      },
      NOW.toISOString(),
      ENV,
    )
    assert.ok(!fields.accessTokenEncrypted.includes(ACCESS_TOKEN))
    assert.ok(!fields.refreshTokenEncrypted.includes(REFRESH_TOKEN))
    assert.equal(fields.scope, 'ads:read')
    assert.equal(fields.refreshTokenExpiresAt, null)
    assert.equal(fields.lastRefreshedAt, NOW.toISOString())
  })

  it('never produces the same ciphertext twice for the same token', () => {
    const grant = {
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      tokenType: 'bearer',
      accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
      refreshTokenExpiresAt: null,
      scope: 'ads:read',
    }
    const a = encryptGrant(grant, NOW.toISOString(), ENV)
    const b = encryptGrant(grant, NOW.toISOString(), ENV)
    // A fresh random IV per encryption — otherwise identical tokens would be linkable.
    assert.notEqual(a.accessTokenEncrypted, b.accessTokenEncrypted)
  })
})
