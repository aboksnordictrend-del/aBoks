import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Endpoint, PayloadRequest } from 'payload'
import { MARKETING_ROUTES } from '@/lib/marketing/channels'
import {
  getPinterestOAuthConfig,
  PINTEREST_PRODUCTION_REDIRECT_URI,
  type PinterestOAuthConfig,
} from '@/lib/pinterest/oauth/config'
import { PinterestOAuthError } from '@/lib/pinterest/oauth/exchange'
import { createPendingState } from '@/lib/pinterest/oauth/state'
import { getCredentials, savePendingState } from '@/lib/pinterest/oauth/store'
import type { PinterestTokenGrant } from '@/lib/pinterest/oauth/tokens'
import { PinterestReauthorizationRequiredError } from '@/lib/pinterest/oauth/accessToken'
import { runPinterestAdsSync } from '@/lib/pinterest/sync'
import { getPinterestAdsConfig } from '@/lib/pinterest/config'
import { getPinterestDailySpend } from '@/lib/pinterest/ads'
import type { FetchImpl } from '@/lib/pinterest/client'
import { pinterestOAuthStartEndpoint } from './pinterestOAuthStart'
import { handlePinterestCallback, pinterestOAuthCallbackEndpoint } from './pinterestOAuthCallback'
import { pinterestStatusEndpoint } from './pinterestStatus'

const APP_SECRET = 'APP-SECRET-should-never-leak'
const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const REFRESH_TOKEN = 'REFRESH-TOKEN-should-never-leak'
const AUTH_CODE = 'AUTH-CODE-should-never-leak'
const SECRET = 'payload-secret-used-only-in-this-test-0123456789'
const ADMIN = { id: 7, role: 'admin' }
const ENV = { PAYLOAD_SECRET: SECRET }

// The callback stores the grant through the real store, which derives its encryption key from
// PAYLOAD_SECRET. Node runs each test file in its own process, so setting it here is contained.
process.env.PAYLOAD_SECRET = SECRET

const config: PinterestOAuthConfig = getPinterestOAuthConfig({
  PINTEREST_APP_ID: '1593431',
  PINTEREST_APP_SECRET: APP_SECRET,
  PINTEREST_REDIRECT_URI: PINTEREST_PRODUCTION_REDIRECT_URI,
  // Not production, so the PAYLOAD_SECRET fallback satisfies the encryption-key requirement.
  PAYLOAD_SECRET: SECRET,
})

const GRANT: PinterestTokenGrant = {
  accessToken: ACCESS_TOKEN,
  refreshToken: REFRESH_TOKEN,
  tokenType: 'bearer',
  accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
  refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
  scope: 'ads:read',
}

interface MockOpts {
  user?: unknown
  query?: Record<string, unknown>
  global?: Record<string, unknown>
  docs?: unknown[]
}

function makeReq({ user, query = {}, global = {}, docs = [] }: MockOpts) {
  const doc: Record<string, unknown> = { ...global }
  const logs: string[] = []
  const expenseWrites: Array<{ collection: string; op: string }> = []
  const req = {
    user,
    query,
    payload: {
      findGlobal: async () => ({ ...doc }),
      updateGlobal: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(doc, data)
        return { ...doc }
      },
      findByID: async () => ({ role: 'admin' }),
      find: async () => ({ docs, totalDocs: docs.length }),
      create: async ({ collection }: { collection: string }) => {
        expenseWrites.push({ collection, op: 'create' })
        return {}
      },
      update: async ({ collection }: { collection: string }) => {
        expenseWrites.push({ collection, op: 'update' })
        return {}
      },
      delete: async ({ collection }: { collection: string }) => {
        expenseWrites.push({ collection, op: 'delete' })
        return {}
      },
      logger: {
        error: (m: string) => logs.push(m),
        warn: (m: string) => logs.push(m),
        info: () => {},
      },
    },
  } as unknown as PayloadRequest
  return { req, doc, logs, expenseWrites }
}

async function call(endpoint: Endpoint, opts: MockOpts) {
  const { req, doc, logs } = makeReq(opts)
  const res = await endpoint.handler!(req)
  const isJson = (res.headers.get('content-type') ?? '').includes('json')
  return {
    status: res.status,
    location: res.headers.get('Location'),
    cacheControl: res.headers.get('Cache-Control'),
    json: isJson ? ((await res.json()) as Record<string, unknown>) : {},
    doc,
    logs,
  }
}

/** Query string of a redirect Location, for asserting the reason code. */
function reasonOf(location: string | null): string | null {
  if (!location) return null
  const qs = location.slice(location.indexOf('?'))
  return new URLSearchParams(qs).get('reason')
}

// =============================================================================================
// Admin guard
// =============================================================================================

describe('pinterest oauth endpoints — admin-only access', () => {
  it('start: 401 without a user', async () => {
    assert.equal((await call(pinterestOAuthStartEndpoint, { user: null })).status, 401)
  })

  it('start: 403 for an authenticated editor', async () => {
    assert.equal(
      (await call(pinterestOAuthStartEndpoint, { user: { id: 1, role: 'editor' } })).status,
      403,
    )
  })

  it('start: neither rejection creates a pending state', async () => {
    const denied = await call(pinterestOAuthStartEndpoint, { user: { id: 1, role: 'editor' } })
    assert.equal(denied.doc.pendingStateHash, undefined)
  })

  it('status: 401/403 exactly as before', async () => {
    assert.equal((await call(pinterestStatusEndpoint, { user: null })).status, 401)
    assert.equal(
      (await call(pinterestStatusEndpoint, { user: { id: 1, role: 'editor' } })).status,
      403,
    )
  })
})

// =============================================================================================
// Routes
// =============================================================================================

describe('pinterest oauth endpoints — routes', () => {
  it('are mounted at the exact paths the Pinterest app is configured with', () => {
    // Payload serves custom endpoints under /api, so these become
    // /api/pinterest/oauth/start and /api/pinterest/oauth/callback.
    assert.equal(pinterestOAuthStartEndpoint.path, '/pinterest/oauth/start')
    assert.equal(pinterestOAuthStartEndpoint.method, 'get')
    assert.equal(pinterestOAuthCallbackEndpoint.path, '/pinterest/oauth/callback')
    assert.equal(pinterestOAuthCallbackEndpoint.method, 'get')
  })
})

// =============================================================================================
// Start
// =============================================================================================

describe('pinterest oauth start', () => {
  const withEnv = async <T>(env: Record<string, string>, run: () => Promise<T>): Promise<T> => {
    const saved: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k]
      process.env[k] = v
    }
    try {
      return await run()
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  }

  it('redirects an admin to Pinterest with the exact redirect URI and only ads:read', async () => {
    const result = await withEnv(
      {
        PINTEREST_APP_ID: '1593431',
        PINTEREST_APP_SECRET: APP_SECRET,
        PINTEREST_REDIRECT_URI: PINTEREST_PRODUCTION_REDIRECT_URI,
        PAYLOAD_SECRET: SECRET,
      },
      () => call(pinterestOAuthStartEndpoint, { user: ADMIN }),
    )

    assert.equal(result.status, 302)
    assert.equal(result.cacheControl, 'no-store')
    const url = new URL(result.location!)
    assert.equal(url.origin + url.pathname, 'https://www.pinterest.com/oauth/')
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://aboks.no/api/pinterest/oauth/callback',
    )
    assert.equal(url.searchParams.get('scope'), 'ads:read')
    assert.equal(url.searchParams.get('response_type'), 'code')
  })

  it('stores a hash of the state, never the state itself, bound to the admin', async () => {
    const result = await withEnv(
      {
        PINTEREST_APP_ID: '1593431',
        PINTEREST_APP_SECRET: APP_SECRET,
        PINTEREST_REDIRECT_URI: PINTEREST_PRODUCTION_REDIRECT_URI,
        PAYLOAD_SECRET: SECRET,
      },
      () => call(pinterestOAuthStartEndpoint, { user: ADMIN }),
    )

    const state = new URL(result.location!).searchParams.get('state')!
    assert.ok(state.length >= 40)
    assert.ok(!JSON.stringify(result.doc).includes(state))
    assert.equal(result.doc.pendingStateUserId, '7')
    assert.ok(Date.parse(String(result.doc.pendingStateExpiresAt)) > Date.now())
  })

  it('never puts the app secret in the redirect or the log', async () => {
    const result = await withEnv(
      {
        PINTEREST_APP_ID: '1593431',
        PINTEREST_APP_SECRET: APP_SECRET,
        PINTEREST_REDIRECT_URI: PINTEREST_PRODUCTION_REDIRECT_URI,
        PAYLOAD_SECRET: SECRET,
      },
      () => call(pinterestOAuthStartEndpoint, { user: ADMIN }),
    )
    assert.ok(!result.location!.includes(APP_SECRET))
    assert.ok(!result.logs.join('\n').includes(APP_SECRET))
  })

  it('sends the admin back with reason=config when the app credentials are missing', async () => {
    const result = await withEnv({ PINTEREST_APP_ID: '', PINTEREST_APP_SECRET: '' }, () =>
      call(pinterestOAuthStartEndpoint, { user: ADMIN }),
    )
    assert.equal(result.status, 302)
    assert.ok(result.location!.startsWith(MARKETING_ROUTES.pinterest))
    assert.equal(reasonOf(result.location), 'config')
  })
})

// =============================================================================================
// Callback
// =============================================================================================

describe('pinterest oauth callback', () => {
  /** A request whose stored pending state matches `state`. */
  async function pending(userId = '7') {
    const created = createPendingState(userId)
    const { req, doc, logs, expenseWrites } = makeReq({ query: {} })
    await savePendingState(req.payload, created.pending)
    return { created, req, doc, logs, expenseWrites }
  }

  function withQuery(req: PayloadRequest, query: Record<string, unknown>): PayloadRequest {
    return { ...req, query } as PayloadRequest
  }

  it('completes the happy path and stores the grant encrypted', async () => {
    const { created, req, doc } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      { config, exchange: async () => GRANT },
    )

    assert.equal(res.status, 302)
    assert.equal(res.headers.get('Cache-Control'), 'no-store')
    const location = res.headers.get('Location')!
    assert.ok(location.startsWith(MARKETING_ROUTES.pinterest))
    assert.equal(new URLSearchParams(location.slice(location.indexOf('?'))).get('pinterest'), 'connected')

    assert.equal(doc.connectionStatus, 'connected')
    assert.ok(!JSON.stringify(doc).includes(ACCESS_TOKEN))
    assert.ok(!JSON.stringify(doc).includes(REFRESH_TOKEN))
    const creds = await getCredentials(req.payload, ENV)
    assert.equal(creds.accessToken, ACCESS_TOKEN)
    assert.equal(creds.refreshToken, REFRESH_TOKEN)
  })

  it('passes the code to the exchange and never echoes it back to the browser', async () => {
    const { created, req } = await pending()
    let seen = ''
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      {
        config,
        exchange: async (_c, code) => {
          seen = code
          return GRANT
        },
      },
    )
    assert.equal(seen, AUTH_CODE)
    assert.ok(!res.headers.get('Location')!.includes(AUTH_CODE))
  })

  it('rejects a missing state', async () => {
    const { req } = await pending()
    const res = await handlePinterestCallback(withQuery(req, { code: AUTH_CODE }), {
      config,
      exchange: async () => GRANT,
    })
    assert.equal(reasonOf(res.headers.get('Location')), 'state')
  })

  it('rejects a mismatched state', async () => {
    const { req } = await pending()
    const other = createPendingState('7').state
    const res = await handlePinterestCallback(withQuery(req, { state: other, code: AUTH_CODE }), {
      config,
      exchange: async () => GRANT,
    })
    assert.equal(reasonOf(res.headers.get('Location')), 'state')
  })

  it('rejects an expired state', async () => {
    const created = createPendingState('7', Date.now() - 11 * 60_000)
    const { req } = makeReq({})
    await savePendingState(req.payload, created.pending)
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      { config, exchange: async () => GRANT },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'state')
  })

  it('rejects a replayed state — the second callback is refused', async () => {
    const { created, req } = await pending()
    const query = { state: created.state, code: AUTH_CODE }

    const first = await handlePinterestCallback(withQuery(req, query), {
      config,
      exchange: async () => GRANT,
    })
    assert.equal(reasonOf(first.headers.get('Location')), null) // connected

    let exchanged = 0
    const second = await handlePinterestCallback(withQuery(req, query), {
      config,
      exchange: async () => {
        exchanged += 1
        return GRANT
      },
    })
    assert.equal(reasonOf(second.headers.get('Location')), 'state')
    // The exchange must not even be attempted on a replay.
    assert.equal(exchanged, 0)
  })

  it('handles a Pinterest OAuth error response without exchanging anything', async () => {
    const { created, req } = await pending()
    let exchanged = 0
    const res = await handlePinterestCallback(
      withQuery(req, {
        state: created.state,
        error: 'access_denied',
        error_description: 'User denied the request',
      }),
      {
        config,
        exchange: async () => {
          exchanged += 1
          return GRANT
        },
      },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'denied')
    assert.equal(exchanged, 0)
  })

  it('burns the pending state even when the admin declines', async () => {
    const { created, req, doc } = await pending()
    await handlePinterestCallback(
      withQuery(req, { state: created.state, error: 'access_denied' }),
      { config, exchange: async () => GRANT },
    )
    assert.equal(doc.pendingStateHash, null)
  })

  it('rejects a valid state that no longer names an administrator', async () => {
    const { created, req } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      { config, exchange: async () => GRANT, loadUser: async () => ({ role: 'editor' }) },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'unauthorized')
  })

  it('rejects a deleted administrator', async () => {
    const { created, req } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      { config, exchange: async () => GRANT, loadUser: async () => null },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'unauthorized')
  })

  it('rejects a surviving session that belongs to a different user', async () => {
    const { created, req } = await pending('7')
    const res = await handlePinterestCallback(
      {
        ...req,
        user: { id: 99, role: 'admin' },
        query: { state: created.state, code: AUTH_CODE },
      } as unknown as PayloadRequest,
      { config, exchange: async () => GRANT },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'state')
  })

  it('reports a missing authorization code', async () => {
    const { created, req } = await pending()
    const res = await handlePinterestCallback(withQuery(req, { state: created.state }), {
      config,
      exchange: async () => GRANT,
    })
    assert.equal(reasonOf(res.headers.get('Location')), 'code')
  })

  it('reports a failed exchange without leaking Pinterest’s response', async () => {
    const { created, req, doc, logs } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      {
        config,
        exchange: async () => {
          throw new PinterestOAuthError('avvist', 'invalid_grant', 400, 'Code already redeemed')
        },
      },
    )
    const location = res.headers.get('Location')!
    assert.equal(reasonOf(location), 'exchange')
    assert.ok(!location.includes('Code already redeemed'))
    assert.ok(!location.includes(AUTH_CODE))
    assert.ok(!logs.join('\n').includes(APP_SECRET))
    // Nothing was stored.
    assert.equal(doc.connectionStatus, undefined)
  })

  it('reports a malformed token response without storing anything', async () => {
    const { created, req, doc } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      {
        config,
        exchange: async () => {
          throw new Error('token response contained no access_token')
        },
      },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'exchange')
    assert.equal(doc.accessTokenEncrypted, undefined)
  })

  it('refuses a grant whose scope does not cover ads:read', async () => {
    const { created, req, doc } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      { config, exchange: async () => ({ ...GRANT, scope: 'boards:read' }) },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'scope')
    // A green card that fails on the first sync is worse than an honest refusal.
    assert.equal(doc.connectionStatus, undefined)
  })

  it('reports a storage failure rather than falling back to plaintext', async () => {
    const { created, req } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      {
        config,
        exchange: async () => GRANT,
        save: async () => {
          throw new Error('no encryption key')
        },
      },
    )
    assert.equal(reasonOf(res.headers.get('Location')), 'storage')
  })

  it('never returns a token in the response body or headers', async () => {
    const { created, req } = await pending()
    const res = await handlePinterestCallback(
      withQuery(req, { state: created.state, code: AUTH_CODE }),
      { config, exchange: async () => GRANT },
    )
    const body = await res.text()
    assert.equal(body, '')
    const headers = JSON.stringify([...res.headers.entries()])
    assert.ok(!headers.includes(ACCESS_TOKEN))
    assert.ok(!headers.includes(REFRESH_TOKEN))
  })
})

// =============================================================================================
// Status endpoint
// =============================================================================================

describe('pinterest status — connection state', () => {
  it('reports the connection without exposing any token', async () => {
    const { req, doc } = makeReq({ user: ADMIN })
    Object.assign(doc, {
      connectionStatus: 'connected',
      connectionVersion: 1,
      accessTokenEncrypted: 'v1:aaa:bbb:ccc',
      refreshTokenEncrypted: 'v1:ddd:eee:fff',
      scope: 'ads:read',
      connectedAt: '2026-08-01T12:00:00.000Z',
    })

    const res = await pinterestStatusEndpoint.handler!(req)
    const body = (await res.json()) as Record<string, unknown>
    const raw = JSON.stringify(body)

    assert.equal(res.status, 200)
    assert.equal(body.authorized, true)
    assert.equal((body.connection as Record<string, unknown>).status, 'connected')
    assert.equal((body.connection as Record<string, unknown>).scope, 'ads:read')
    assert.equal(body.requestedScope, 'ads:read')
    // Not even the ciphertext leaves the server.
    assert.ok(!raw.includes('v1:aaa'))
    assert.ok(!raw.includes('accessTokenEncrypted'))
    assert.ok(!raw.includes('refreshTokenEncrypted'))
  })

  it('reports reauthorization_required so the card can offer «Koble til på nytt»', async () => {
    const { req, doc } = makeReq({ user: ADMIN })
    Object.assign(doc, {
      connectionStatus: 'reauthorization_required',
      connectionVersion: 1,
      lastOAuthError: 'invalid_grant',
    })
    const body = (await (await pinterestStatusEndpoint.handler!(req)).json()) as Record<
      string,
      unknown
    >
    assert.equal(body.authorized, false)
    assert.equal((body.connection as Record<string, unknown>).status, 'reauthorization_required')
    assert.equal((body.connection as Record<string, unknown>).lastOAuthError, 'invalid_grant')
  })
})

// =============================================================================================
// One-time retry after a 401 from the Pinterest API
// =============================================================================================

describe('pinterest client — 401 handling', () => {
  const adsConfig = getPinterestAdsConfig({ PINTEREST_AD_ACCOUNT_ID: '549755885175' })

  /** Fails with 401 for the first `failures` calls, then succeeds. */
  function fetchThat(failures: number) {
    const tokens: string[] = []
    let calls = 0
    const fetchImpl: FetchImpl = async (_url, init) => {
      calls += 1
      tokens.push((init?.headers?.Authorization ?? '').replace('Bearer ', ''))
      if (calls <= failures) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ code: 2, message: 'Authentication failed' }),
          text: async () => '',
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => [{ DATE: '2026-07-20', SPEND_IN_MICRO_DOLLAR: 1_500_000 }],
        text: async () => '',
      }
    }
    return { fetchImpl, tokens, calls: () => calls }
  }

  it('refreshes once and retries once, then succeeds', async () => {
    const { fetchImpl, tokens, calls } = fetchThat(1)
    let refreshes = 0
    const days = await getPinterestDailySpend({ since: '2026-07-20', until: '2026-07-20' }, 'NOK', {
      config: adsConfig,
      fetchImpl,
      sleep: async () => {},
      tokenProvider: {
        getAccessToken: async () => 'stale-token',
        forceRefresh: async () => {
          refreshes += 1
          return 'fresh-token'
        },
      },
    })

    assert.equal(refreshes, 1)
    assert.equal(calls(), 2)
    // The replay carried the renewed token, not the stale one.
    assert.deepEqual(tokens, ['stale-token', 'fresh-token'])
    assert.deepEqual(days, [
      { date: '2026-07-20', spendMicros: 1_500_000, spend: 1.5, currency: 'NOK' },
    ])
  })

  it('does not loop: a second 401 is thrown after exactly one forced refresh', async () => {
    const { fetchImpl, calls } = fetchThat(Number.POSITIVE_INFINITY)
    let refreshes = 0
    await assert.rejects(() =>
      getPinterestDailySpend({ since: '2026-07-20', until: '2026-07-20' }, 'NOK', {
        config: adsConfig,
        fetchImpl,
        sleep: async () => {},
        tokenProvider: {
          getAccessToken: async () => 'stale-token',
          forceRefresh: async () => {
            refreshes += 1
            return 'fresh-token'
          },
        },
      }),
    )
    assert.equal(refreshes, 1)
    assert.equal(calls(), 2)
  })

  it('does not retry when there is nothing to refresh (legacy env token)', async () => {
    const { fetchImpl, calls } = fetchThat(Number.POSITIVE_INFINITY)
    await assert.rejects(() =>
      getPinterestDailySpend({ since: '2026-07-20', until: '2026-07-20' }, 'NOK', {
        config: adsConfig,
        fetchImpl,
        sleep: async () => {},
        tokenProvider: {
          getAccessToken: async () => 'legacy-token',
          forceRefresh: async () => null,
        },
      }),
    )
    assert.equal(calls(), 1)
  })
})

// =============================================================================================
// Existing marketing-expense records are preserved
// =============================================================================================

describe('pinterest sync — imported expenses survive an authorization failure', () => {
  const adsConfig = getPinterestAdsConfig({ PINTEREST_AD_ACCOUNT_ID: '549755885175' })

  it('writes nothing when the connection needs re-authorization', async () => {
    const existing = [
      {
        id: 1,
        source: 'pinterest-ads',
        externalDate: '2026-07-30',
        amount: 250,
        date: '2026-07-30T00:00:00.000Z',
      },
    ]
    const { req, expenseWrites } = makeReq({ user: ADMIN, docs: existing })

    await assert.rejects(
      () =>
        runPinterestAdsSync(
          req.payload,
          { mode: 'incremental' },
          {
            config: adsConfig,
            lastExternalDate: '2026-07-30',
            fetchAccountInfo: async () => {
              throw new PinterestReauthorizationRequiredError()
            },
          },
        ),
      PinterestReauthorizationRequiredError,
    )

    // Not one create, update or delete against marketing-expenses.
    assert.deepEqual(expenseWrites, [])
  })

  it('marking a connection for re-authorization touches no expense record', async () => {
    const { req, doc, expenseWrites } = makeReq({ user: ADMIN })
    Object.assign(doc, { connectionStatus: 'connected', connectionVersion: 1 })
    const { markReauthorizationRequired } = await import('@/lib/pinterest/oauth/store')
    await markReauthorizationRequired(req.payload, 'invalid_grant')
    assert.equal(doc.connectionStatus, 'reauthorization_required')
    assert.deepEqual(expenseWrites, [])
  })
})
