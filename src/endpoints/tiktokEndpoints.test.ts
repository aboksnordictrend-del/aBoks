import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Endpoint, PayloadRequest } from 'payload'
import { MARKETING_ROUTES } from '@/lib/marketing/channels'
import { createOAuthState } from '@/lib/tiktok/oauthState'
import { getTikTokAdsConfig, type TikTokAdsConfig } from '@/lib/tiktok/config'
import { TikTokAdsError } from '@/lib/tiktok/errors'
import type { SaveConnectionInput } from '@/lib/tiktok/tokenStore'
import type { TikTokAdvertiserInfo, TikTokAdvertiserRef } from '@/lib/tiktok/types'
import { tiktokConnectEndpoint } from './tiktokConnect'
import { handleTikTokCallback, type TikTokCallbackDeps } from './tiktokCallback'
import { tiktokStatusEndpoint } from './tiktokStatus'
import { tiktokExpensesEndpoint } from './tiktokExpenses'
import { tiktokSyncEndpoint } from './tiktokSync'
import { tiktokAdvertisersEndpoint } from './tiktokAdvertisers'

const SECRET = 'payload-secret-used-only-in-this-test-0123456789'
const APP_SECRET = 'APP-SECRET-should-never-leak'
const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const AUTH_CODE = 'AUTH-CODE-should-never-leak'
const ADVERTISER = '7012345678901234567'
const OTHER_ADVERTISER = '7099999999999999999'
const ADMIN = { id: 7, role: 'admin' }

const ENV_KEYS = [
  'TIKTOK_APP_ID',
  'TIKTOK_APP_SECRET',
  'TIKTOK_REDIRECT_URI',
  'TIKTOK_ADVERTISER_ID',
  'TIKTOK_ACCESS_TOKEN',
  'PAYLOAD_SECRET',
] as const

const config: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: APP_SECRET,
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
  TIKTOK_ADVERTISER_ID: ADVERTISER,
})

interface MockOpts {
  user?: unknown
  query?: Record<string, unknown>
  docs?: unknown[]
  global?: Record<string, unknown>
  body?: unknown
}

function makeReq({ user, query = {}, docs = [], global = {}, body }: MockOpts): PayloadRequest {
  return {
    user,
    query,
    json: body === undefined ? undefined : async () => body,
    payload: {
      find: async () => ({ docs, totalDocs: docs.length }),
      findGlobal: async () => global,
      updateGlobal: async () => global,
      logger: { error() {}, warn() {}, info() {} },
    },
  } as unknown as PayloadRequest
}

async function call(endpoint: Endpoint, opts: MockOpts) {
  const res = await endpoint.handler!(makeReq(opts))
  const isJson = (res.headers.get('content-type') ?? '').includes('json')
  return {
    status: res.status,
    location: res.headers.get('Location'),
    cacheControl: res.headers.get('Cache-Control'),
    json: isJson ? ((await res.json()) as Record<string, unknown>) : {},
  }
}

// Every TikTok endpoint enforces the same admin guard as Meta/Google/Pinterest.
const GUARDED: Array<[string, Endpoint]> = [
  ['tiktok/connect', tiktokConnectEndpoint],
  ['tiktok/status', tiktokStatusEndpoint],
  ['tiktok/expenses', tiktokExpensesEndpoint],
  ['tiktok/sync', tiktokSyncEndpoint],
  ['tiktok/advertisers', tiktokAdvertisersEndpoint],
]

describe('tiktok endpoints — admin-only access', () => {
  for (const [name, endpoint] of GUARDED) {
    it(`${name}: 401 without a user`, async () => {
      assert.equal((await call(endpoint, { user: null })).status, 401)
    })
    it(`${name}: 403 for an authenticated editor`, async () => {
      assert.equal((await call(endpoint, { user: { id: 1, role: 'editor' } })).status, 403)
    })
  }
})

describe('tiktok/connect', () => {
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'
    process.env.PAYLOAD_SECRET = SECRET
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('redirects an admin to TikTok with app_id, state and redirect_uri', async () => {
    const res = await call(tiktokConnectEndpoint, { user: ADMIN })
    assert.equal(res.status, 302)
    const url = new URL(res.location!)
    assert.equal(url.origin + url.pathname, 'https://business-api.tiktok.com/portal/auth')
    assert.equal(url.searchParams.get('app_id'), '7668564716072534017')
    assert.ok(url.searchParams.get('state'))
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://aboks.no/api/admin/integrations/tiktok/callback',
    )
  })

  it('never puts the app secret in the redirect, and never caches it', async () => {
    const res = await call(tiktokConnectEndpoint, { user: ADMIN })
    assert.ok(!res.location!.includes(APP_SECRET))
    assert.equal(res.cacheControl, 'no-store')
  })

  it('mints a state the callback will accept for this admin', async () => {
    const res = await call(tiktokConnectEndpoint, { user: ADMIN })
    const state = new URL(res.location!).searchParams.get('state')!
    const callbackRes = await handleTikTokCallback(
      makeReq({ user: ADMIN, query: { state, auth_code: AUTH_CODE } }),
      okDeps(),
    )
    assert.equal(callbackRes.headers.get('Location'), `${MARKETING_ROUTES.tiktok}?tiktok=connected`)
  })

  it('sends the admin back with a config error instead of a broken redirect', async () => {
    delete process.env.TIKTOK_APP_SECRET
    const res = await call(tiktokConnectEndpoint, { user: ADMIN })
    assert.equal(res.status, 302)
    assert.match(res.location!, /reason=config/)
  })
})

// --- Callback --------------------------------------------------------------------------

const advertiser: TikTokAdvertiserRef = { id: ADVERTISER, name: 'aBoks' }
const info: TikTokAdvertiserInfo = {
  id: ADVERTISER,
  name: 'aBoks',
  currency: 'NOK',
  timezone: 'Europe/Oslo',
  createdDate: '2026-04-01',
}

/** Happy-path deps plus a record of what was saved. */
function okDeps(over: Partial<TikTokCallbackDeps> = {}) {
  const saves: SaveConnectionInput[] = []
  const deps: TikTokCallbackDeps = {
    config,
    secret: SECRET,
    // The state names ADMIN.id; by default that user is still an admin in the database.
    loadUser: async (userId) => (userId === String(ADMIN.id) ? { role: 'admin' } : null),
    exchange: async () => ({ accessToken: ACCESS_TOKEN }),
    listAdvertisers: async () => [advertiser],
    fetchAdvertiserInfo: async () => info,
    // The one-day report probe succeeds by default.
    probeReporting: async () => {},
    save: async (input) => {
      saves.push(input)
    },
    ...over,
  }
  return Object.assign(deps, { saves })
}

/** Config with no advertiser id pinned, so OAuth decides the selection. */
const noIdConfig: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: APP_SECRET,
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
})

/** Config where the operator has declared the currency, as a Reporting-only app must. */
const declaredCurrencyConfig: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: APP_SECRET,
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
  TIKTOK_ADVERTISER_ID: ADVERTISER,
  TIKTOK_ADVERTISER_CURRENCY: 'NOK',
})

const validState = () => createOAuthState(String(ADMIN.id), SECRET)

async function callback(query: Record<string, unknown>, deps: TikTokCallbackDeps, user = ADMIN) {
  const res = await handleTikTokCallback(makeReq({ user, query }), deps)
  const location = res.headers.get('Location') ?? ''
  return { status: res.status, location, params: new URL(location, 'https://x').searchParams }
}

describe('tiktok/callback — authority without a session', () => {
  /**
   * Payload will not authenticate a cookie on a cross-site request (extractJWT's `cookie`
   * strategy returns null for `Sec-Fetch-Site: cross-site` when `config.csrf` is non-empty),
   * so `req.user` is structurally null on every provider redirect. The signed state is what
   * carries the authority — these tests pin that contract down.
   */
  it('completes the flow with no session at all, on the strength of the signed state', async () => {
    const deps = okDeps()
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps, null as never)

    assert.equal(res.params.get('tiktok'), 'connected')
    assert.equal(deps.saves.length, 1)
  })

  it('still refuses when the state names a user who is no longer an administrator', async () => {
    const deps = okDeps({ loadUser: async () => ({ role: 'editor' }) })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps, null as never)

    assert.equal(res.params.get('reason'), 'unauthorized')
    assert.equal(deps.saves.length, 0, 'no token is stored')
  })

  it('still refuses when the state names a user who no longer exists', async () => {
    const deps = okDeps({ loadUser: async () => null })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps, null as never)

    assert.equal(res.params.get('reason'), 'unauthorized')
    assert.equal(deps.saves.length, 0)
  })

  it('fails closed when the user lookup itself errors', async () => {
    const deps = okDeps({
      loadUser: async () => {
        throw new Error('database unavailable')
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps, null as never)

    assert.equal(res.params.get('reason'), 'unauthorized')
    assert.equal(deps.saves.length, 0)
  })

  it('never exchanges the code before the authority check has passed', async () => {
    const deps = okDeps({
      loadUser: async () => ({ role: 'editor' }),
      exchange: async () => {
        throw new Error('must never be called')
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps, null as never)
    assert.equal(res.params.get('reason'), 'unauthorized')
  })
})

describe('tiktok/callback — a surviving session is held to the same bar', () => {
  it('rejects a session that is not an administrator, even with a valid state', async () => {
    const res = await callback(
      { state: validState(), auth_code: AUTH_CODE },
      okDeps(),
      { id: 1, role: 'editor' } as never,
    )
    assert.equal(res.params.get('reason'), 'unauthorized')
  })

  it('rejects a session belonging to someone other than the state\'s admin', async () => {
    const res = await callback(
      { state: validState(), auth_code: AUTH_CODE },
      okDeps(),
      { id: 999, role: 'admin' } as never,
    )
    assert.equal(res.params.get('reason'), 'state')
  })

  it('accepts a matching admin session', async () => {
    const deps = okDeps()
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('tiktok'), 'connected')
  })
})

describe('tiktok/callback — security', () => {
  it('rejects a missing state before doing anything else', async () => {
    const deps = okDeps({
      exchange: async () => {
        throw new Error('must never be called')
      },
    })
    const res = await callback({ auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'state')
  })

  it('rejects a forged / tampered state', async () => {
    const res = await callback({ state: 'forged.signature', auth_code: AUTH_CODE }, okDeps())
    assert.equal(res.params.get('reason'), 'state')
  })

  it('rejects a state minted for a different administrator', async () => {
    const otherAdminsState = createOAuthState('999', SECRET)
    // 999 is a genuine admin, so only the session/state mismatch can be what rejects this.
    const deps = okDeps({ loadUser: async () => ({ role: 'admin' }) })
    const res = await callback({ state: otherAdminsState, auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'state')
  })

  it('rejects a missing authorization code', async () => {
    const res = await callback({ state: validState() }, okDeps())
    assert.equal(res.params.get('reason'), 'code')
  })

  it('reports a declined consent screen distinctly from a missing code', async () => {
    const res = await callback({ state: validState(), error: 'access_denied' }, okDeps())
    assert.equal(res.params.get('reason'), 'denied')
  })

  it('never echoes the auth code or a token into the redirect', async () => {
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, okDeps())
    assert.ok(!res.location.includes(AUTH_CODE))
    assert.ok(!res.location.includes(ACCESS_TOKEN))
    assert.ok(!res.location.includes(APP_SECRET))
  })
})

describe('tiktok/callback — advertiser selection', () => {
  it('stores the connection and reports success for a single, matching advertiser', async () => {
    const deps = okDeps()
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)

    assert.equal(res.status, 302)
    assert.equal(res.params.get('tiktok'), 'connected')
    assert.equal(deps.saves.length, 1)
    assert.equal(deps.saves[0].accessToken, ACCESS_TOKEN)
    assert.equal(deps.saves[0].advertiserId, ADVERTISER)
    assert.equal(deps.saves[0].currency, 'NOK')
    assert.equal(deps.saves[0].timezone, 'Europe/Oslo')
  })

  it('auto-selects the only advertiser when none is configured', async () => {
    const deps = okDeps({ config: noIdConfig })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('tiktok'), 'connected')
    assert.equal(deps.saves[0].advertiserId, ADVERTISER)
  })

  it('keeps the token but selects nothing when several advertisers are available', async () => {
    const deps = okDeps({
      config: noIdConfig,
      listAdvertisers: async () => [advertiser, { id: OTHER_ADVERTISER, name: 'Annen' }],
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)

    assert.equal(res.params.get('reason'), 'multiple-advertisers')
    assert.equal(res.params.get('count'), '2')
    // Only the count travels in the URL — never the ids or the names.
    assert.ok(!res.location.includes(ADVERTISER))
    assert.ok(!res.location.includes('aBoks'))
    assert.equal(deps.saves[0].advertiserId, null)
    assert.equal(deps.saves[0].accessToken, ACCESS_TOKEN)
  })

  it('reports "no advertiser" when the authorization covers none and none is configured', async () => {
    const deps = okDeps({ config: noIdConfig, listAdvertisers: async () => [] })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'no-advertiser')
  })

  it('prefers "not authorized" over "no advertiser" when an id is configured', async () => {
    const deps = okDeps({ listAdvertisers: async () => [] })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'not-authorized')
  })

  it('never falls back when the configured advertiser is not authorized', async () => {
    const deps = okDeps({ listAdvertisers: async () => [{ id: OTHER_ADVERTISER, name: 'Annen' }] })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'not-authorized')
    assert.equal(deps.saves[0].advertiserId, null)
  })

  it('refuses to store a non-NOK currency', async () => {
    const deps = okDeps({ fetchAdvertiserInfo: async () => ({ ...info, currency: 'USD' }) })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)

    assert.equal(res.params.get('reason'), 'currency')
    assert.equal(res.params.get('currency'), 'USD')
    // The connection is real, so it is stored — but the currency is not, so nothing
    // downstream can read USD back and treat it as importable.
    assert.equal(deps.saves[0].currency, null)
  })
})

describe('tiktok/callback — Reporting-only app (advertiser/info forbidden)', () => {
  /**
   * `GET /advertiser/info/` needs the Ad Account Management scope. An app authorized for
   * Reporting alone is refused with code 40001. Nothing in the spend import needs that call,
   * so the refusal must not read as an OAuth failure.
   */
  it('connects successfully when advertiser/info is forbidden and the currency is declared', async () => {
    const deps = okDeps({ config: declaredCurrencyConfig, fetchAdvertiserInfo: async () => null })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)

    assert.equal(res.params.get('tiktok'), 'connected')
    assert.equal(res.params.get('reason'), null, 'a refused advertiser/info is not an error')
    assert.equal(deps.saves.length, 1)
    assert.equal(deps.saves[0].advertiserId, ADVERTISER)
    assert.equal(deps.saves[0].currency, 'NOK', 'from TIKTOK_ADVERTISER_CURRENCY')
    assert.equal(deps.saves[0].metadataAvailable, false)
    assert.equal(deps.saves[0].reportingOk, true)
  })

  it('flags the missing metadata on the redirect, without calling it a failure', async () => {
    const deps = okDeps({ config: declaredCurrencyConfig, fetchAdvertiserInfo: async () => null })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('metadata'), 'unavailable')
  })

  it('falls back to the advertiser name from oauth2/advertiser/get', async () => {
    const deps = okDeps({ config: declaredCurrencyConfig, fetchAdvertiserInfo: async () => null })
    await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(deps.saves[0].advertiserName, 'aBoks')
    assert.equal(deps.saves[0].timezone, null, 'unknown time zone is stored as null, not guessed')
  })

  it('never assumes NOK: connects but blocks importing when no currency can be established', async () => {
    // advertiser/info refused AND TIKTOK_ADVERTISER_CURRENCY unset.
    const deps = okDeps({ fetchAdvertiserInfo: async () => null })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)

    assert.equal(res.params.get('reason'), 'currency-unknown')
    // The connection is stored — re-authorizing would not help, setting the currency would.
    assert.equal(deps.saves.length, 1)
    assert.equal(deps.saves[0].advertiserId, ADVERTISER)
    assert.equal(deps.saves[0].currency, null, 'no currency is invented')
  })

  it('prefers TikTok\'s own currency over the declared one when metadata is available', async () => {
    const deps = okDeps({
      config: declaredCurrencyConfig,
      fetchAdvertiserInfo: async () => ({ ...info, currency: 'USD' }),
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    // The declared NOK must not override TikTok's authoritative USD — that would be exactly
    // the silent mis-statement the guard exists to prevent.
    assert.equal(res.params.get('reason'), 'currency')
    assert.equal(res.params.get('currency'), 'USD')
  })
})

describe('tiktok/callback — reporting probe', () => {
  it('validates report access at connect time and reports its failure distinctly', async () => {
    const deps = okDeps({
      config: declaredCurrencyConfig,
      probeReporting: async () => {
        throw new TikTokAdsError('Ingen tilgang.', { code: 40001, requestId: 'req-p' })
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)

    assert.equal(res.params.get('reason'), 'reporting')
    // The connection is still stored, with the probe result recorded.
    assert.equal(deps.saves.length, 1)
    assert.equal(deps.saves[0].reportingOk, false)
  })

  it('records a successful probe on the connection', async () => {
    const deps = okDeps({ config: declaredCurrencyConfig })
    await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(deps.saves[0].reportingOk, true)
  })

  it('reports an unknown currency ahead of a reporting failure', async () => {
    const deps = okDeps({
      fetchAdvertiserInfo: async () => null,
      probeReporting: async () => {
        throw new TikTokAdsError('Ingen tilgang.', { code: 40001 })
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'currency-unknown')
  })
})

describe('tiktok/callback — failures are attributed to the call that failed', () => {
  /**
   * Connecting makes three TikTok calls. Collapsing them into one `reason=exchange` made a
   * failure impossible to attribute from the outside — "the token exchange failed" could
   * equally have meant the advertiser lookup failed. Each call now has its own reason code.
   */
  it('reports a token-exchange failure as `exchange`, storing nothing', async () => {
    const deps = okDeps({
      exchange: async () => {
        throw new TikTokAdsError('Koble til TikTok på nytt.', {
          code: 40105,
          message: `token ${ACCESS_TOKEN}`,
          requestId: 'req-x',
          operation: 'token-exchange',
        })
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'exchange')
    assert.equal(deps.saves.length, 0)
    assert.ok(!res.location.includes(ACCESS_TOKEN))
  })

  it('reports an advertiser-list failure distinctly from the exchange', async () => {
    const deps = okDeps({
      listAdvertisers: async () => {
        throw new TikTokAdsError('Ingen tilgang.', { code: 40001, requestId: 'req-y' })
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'advertiser-list')
    assert.notEqual(res.params.get('reason'), 'exchange')
  })


  it('tags an untagged provider error with the call it came from', async () => {
    const thrown = new TikTokAdsError('Ingen tilgang.', { code: 40001 })
    const deps = okDeps({
      listAdvertisers: async () => {
        throw thrown
      },
    })
    await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(thrown.detail.operation, 'advertiser-list')
    assert.match(thrown.logLine(), /op=advertiser-list/)
  })

  it('reports a non-provider error at a known call with that call\'s reason', async () => {
    const deps = okDeps({
      listAdvertisers: async () => {
        throw new Error('socket hang up')
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'advertiser-list')
    assert.ok(!res.location.includes('socket hang up'))
  })

  it('maps a failure outside any TikTok call to the generic reason code', async () => {
    // The database write is not one of the attributed TikTok calls, so it falls back to
    // `failed` — and the underlying message never reaches the browser.
    const deps = okDeps({
      save: async () => {
        throw new Error('boom')
      },
    })
    const res = await callback({ state: validState(), auth_code: AUTH_CODE }, deps)
    assert.equal(res.params.get('reason'), 'failed')
    assert.ok(!res.location.includes('boom'))
  })
})

// --- Status / expenses / sync -----------------------------------------------------------

describe('tiktok/status', () => {
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
    for (const k of ENV_KEYS) delete process.env[k]
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('reports "not configured" and names the missing variables', async () => {
    const { status, json } = await call(tiktokStatusEndpoint, { user: ADMIN })
    assert.equal(status, 200)
    assert.equal(json.configured, false)
    assert.deepEqual(json.missingEnv, [
      'TIKTOK_APP_ID',
      'TIKTOK_APP_SECRET',
      'TIKTOK_REDIRECT_URI',
    ])
    assert.equal(json.authorized, false)
  })

  it('reports configured-but-not-authorized once env is in place', async () => {
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'
    const { json } = await call(tiktokStatusEndpoint, { user: ADMIN })
    assert.equal(json.configured, true)
    assert.equal(json.authorized, false)
    assert.equal(json.accountId, '—')
  })

  it('masks the advertiser id and never returns a secret', async () => {
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'
    process.env.TIKTOK_ADVERTISER_ID = ADVERTISER
    process.env.TIKTOK_ACCESS_TOKEN = ACCESS_TOKEN

    const { json } = await call(tiktokStatusEndpoint, { user: ADMIN })
    assert.equal(json.authorized, true)
    assert.equal(json.needsAdvertiser, false)
    assert.equal(json.accountId, '•••4567')

    const serialized = JSON.stringify(json)
    assert.ok(!serialized.includes(ACCESS_TOKEN))
    assert.ok(!serialized.includes(APP_SECRET))
    assert.ok(!serialized.includes(ADVERTISER))
  })

  it('flags a token with no advertiser as needing one', async () => {
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'
    process.env.TIKTOK_ACCESS_TOKEN = ACCESS_TOKEN

    const { json } = await call(tiktokStatusEndpoint, { user: ADMIN })
    assert.equal(json.authorized, true)
    assert.equal(json.needsAdvertiser, true)
  })
})

describe('tiktok/expenses — validation', () => {
  it('rejects a single date with 400', async () => {
    const { status } = await call(tiktokExpensesEndpoint, {
      user: ADMIN,
      query: { since: '2026-07-20' },
    })
    assert.equal(status, 400)
  })

  it('rejects an inverted range with 400', async () => {
    const { status } = await call(tiktokExpensesEndpoint, {
      user: ADMIN,
      query: { since: '2026-07-22', until: '2026-07-20' },
    })
    assert.equal(status, 400)
  })

  it('accepts an admin request with no dates (200)', async () => {
    const { status, json } = await call(tiktokExpensesEndpoint, { user: ADMIN })
    assert.equal(status, 200)
    assert.deepEqual(json.period, { since: null, until: null })
  })
})

describe('tiktok/sync', () => {
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
    for (const k of ENV_KEYS) delete process.env[k]
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('rejects an invalid mode with 400 before touching any credential', async () => {
    const { status, json } = await call(tiktokSyncEndpoint, {
      user: ADMIN,
      body: { mode: 'partial' },
    })
    assert.equal(status, 400)
    assert.equal(json.success, false)
  })

  it('returns a 500 config error when the integration is not configured', async () => {
    const { status, json } = await call(tiktokSyncEndpoint, { user: ADMIN, body: { mode: 'incremental' } })
    assert.equal(status, 500)
    assert.equal(json.success, false)
    assert.match(String(json.error), /TIKTOK_APP_ID/)
  })

  it('returns a 409 setup error when configured but not connected', async () => {
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'

    const { status, json } = await call(tiktokSyncEndpoint, {
      user: ADMIN,
      body: { mode: 'incremental' },
    })
    // notConnectedError is a TikTokAdsError → 502 with an actionable message.
    assert.ok(status === 502 || status === 409, `unexpected status ${status}`)
    assert.equal(json.success, false)
    assert.match(String(json.error), /ikke koblet til|Koble til/i)
  })

  it('never leaks a secret in an error response', async () => {
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'

    const { json } = await call(tiktokSyncEndpoint, { user: ADMIN, body: { mode: 'full' } })
    assert.ok(!JSON.stringify(json).includes(APP_SECRET))
  })
})

describe('tiktok/advertisers', () => {
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
    process.env.TIKTOK_APP_ID = '7668564716072534017'
    process.env.TIKTOK_APP_SECRET = APP_SECRET
    process.env.TIKTOK_REDIRECT_URI = 'https://aboks.no/api/admin/integrations/tiktok/callback'
    delete process.env.TIKTOK_ACCESS_TOKEN
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('returns 409 when nothing has been connected yet', async () => {
    const { status, json } = await call(tiktokAdvertisersEndpoint, { user: ADMIN })
    assert.equal(status, 409)
    assert.match(String(json.error), /ikke koblet til/i)
  })
})
