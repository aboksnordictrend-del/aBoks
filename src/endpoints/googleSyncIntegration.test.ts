import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { googleSyncEndpoint } from './googleSync'
import { googleStatusEndpoint } from './googleStatus'
import { clearAccessTokenCache } from '@/lib/google/auth'
import { resetSyncState } from '@/lib/marketing/syncState'

// End-to-end exercise of the sync endpoint with the Google Ads API mocked at the HTTP
// boundary: env config → OAuth token exchange → googleAds:search → upsert → JSON response.
// Nothing here talks to the network, so it is safe in CI.

const SECRETS = {
  clientSecret: 'CLIENT-SECRET-should-never-leak',
  refreshToken: 'REFRESH-TOKEN-should-never-leak',
  developerToken: 'DEV-TOKEN-should-never-leak',
  accessToken: 'ACCESS-TOKEN-should-never-leak',
}

const ENV_KEYS = [
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
  'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  'GOOGLE_ADS_HISTORY_START',
]

interface Doc {
  id: number
  [k: string]: unknown
}

/** Minimal Payload double: an in-memory marketing-expenses store keyed by externalKey. */
function mockPayload() {
  const store = new Map<number, Doc>()
  let seq = 0
  return {
    store,
    payload: {
      find: async ({ where }: { where: Record<string, unknown> }) => {
        const byKey = (where as { externalKey?: { equals?: string } }).externalKey?.equals
        if (byKey) {
          const docs = [...store.values()].filter((d) => d.externalKey === byKey)
          return { docs, totalDocs: docs.length }
        }
        const and = (where as { and?: Array<Record<string, { equals?: string }>> }).and
        const sourceEq = and?.find((c) => c?.source?.equals)?.source?.equals
        const accountEq = and?.find((c) => c?.externalAccountId?.equals)?.externalAccountId?.equals
        if (sourceEq && accountEq) {
          const docs = [...store.values()]
            .filter((d) => d.source === sourceEq && d.externalAccountId === accountEq)
            .sort((a, b) => String(b.externalDate).localeCompare(String(a.externalDate)))
          return { docs: docs.slice(0, 1), totalDocs: docs.length }
        }
        return { docs: [], totalDocs: 0 } // no manual conflicts
      },
      create: async ({ data }: { data: Doc }) => {
        seq += 1
        const doc = { ...data, id: seq }
        store.set(seq, doc)
        return doc
      },
      update: async ({ id, data }: { id: number; data: Partial<Doc> }) => {
        const doc = { ...(store.get(id) as Doc), ...data }
        store.set(id, doc)
        return doc
      },
      findGlobal: async () => ({}),
      logger: { error() {}, warn() {}, info() {} },
    },
  }
}

type FetchLike = typeof globalThis.fetch

/**
 * Fake Google: the OAuth token endpoint plus googleAds:search (account metadata, the
 * earliest-day probe, and daily spend), driven by the GAQL in the request body.
 */
function mockGoogle(spend: Array<[string, string]>, opts: { onSearch?: (q: string) => void } = {}) {
  const calls: string[] = []
  const urls: string[] = []
  const impl = (async (url: unknown, init: unknown) => {
    const href = String(url)
    urls.push(href)
    const request = (init ?? {}) as { body?: string; headers?: Record<string, string> }
    const json = (status: number, body: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })

    if (href.includes('oauth2.googleapis.com/token')) {
      calls.push('token')
      assert.ok(request.body?.includes('grant_type=refresh_token'))
      return json(200, { access_token: SECRETS.accessToken, expires_in: 3600 })
    }

    if (href.includes('googleAds:search')) {
      const query = String(JSON.parse(request.body ?? '{}').query ?? '')
      calls.push(query)
      opts.onSearch?.(query)
      // Auth headers must be present on every data request.
      assert.equal(request.headers?.['developer-token'], SECRETS.developerToken)
      assert.equal(request.headers?.Authorization, `Bearer ${SECRETS.accessToken}`)

      if (query.includes('FROM customer') && query.includes('customer.currency_code')) {
        return json(200, {
          results: [
            {
              customer: {
                id: '1234567890',
                currencyCode: 'NOK',
                timeZone: 'Europe/Oslo',
                descriptiveName: 'aBoks',
              },
            },
          ],
        })
      }

      const range = /BETWEEN '(\d{4}-\d{2}-\d{2})' AND '(\d{4}-\d{2}-\d{2})'/.exec(query)
      const inRange = spend.filter(([d]) => !range || (d >= range[1] && d <= range[2]))
      const results = inRange.map(([date, costMicros]) => ({
        segments: { date },
        metrics: { costMicros },
      }))
      if (query.includes('LIMIT 1')) return json(200, { results: results.slice(0, 1) })
      return json(200, { results })
    }

    throw new Error(`unexpected fetch to ${href}`)
  }) as unknown as FetchLike

  return { impl, calls, urls }
}

function makeReq(payload: unknown, body: unknown): PayloadRequest {
  return {
    user: { role: 'admin' },
    query: {},
    json: async () => body,
    payload,
  } as unknown as PayloadRequest
}

let savedEnv: Record<string, string | undefined>
let savedFetch: FetchLike

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  savedFetch = globalThis.fetch
  process.env.GOOGLE_ADS_CLIENT_ID = 'client-id.apps.googleusercontent.com'
  process.env.GOOGLE_ADS_CLIENT_SECRET = SECRETS.clientSecret
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = SECRETS.developerToken
  process.env.GOOGLE_ADS_REFRESH_TOKEN = SECRETS.refreshToken
  process.env.GOOGLE_ADS_CUSTOMER_ID = '123-456-7890'
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '987-654-3210'
  process.env.GOOGLE_ADS_HISTORY_START = '2026-01-01'
  clearAccessTokenCache()
  resetSyncState()
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  globalThis.fetch = savedFetch
  clearAccessTokenCache()
  resetSyncState()
})

describe('POST google/sync — full stack against a mocked Google Ads API', () => {
  it('imports days, converts micros and returns a masked, secret-free result', async () => {
    const m = mockPayload()
    const google = mockGoogle([
      ['2026-07-20', '1000000'],
      ['2026-07-21', '2500000'],
      ['2026-07-22', '1234560000'],
    ])
    globalThis.fetch = google.impl

    const res = await googleSyncEndpoint.handler!(makeReq(m.payload, { mode: 'full' }))
    const body = (await res.json()) as Record<string, unknown>

    assert.equal(res.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.provider, 'google-ads')
    assert.equal(body.mode, 'full')
    assert.equal(body.currency, 'NOK')
    assert.equal(body.timeZone, 'Europe/Oslo')
    assert.equal(body.fetchedDays, 3)
    assert.equal(body.created, 3)
    assert.equal(body.totalSpend, 1234.56 + 1 + 2.5)
    assert.equal(body.accountId, '•••-•••-7890')

    // Every data request went to the default Google Ads API version (v24) on the
    // customer-scoped search endpoint.
    const searchUrls = google.urls.filter((u) => u.includes('googleAds:search'))
    assert.ok(searchUrls.length > 0)
    for (const u of searchUrls) {
      assert.equal(u, 'https://googleads.googleapis.com/v24/customers/1234567890/googleAds:search')
    }

    // Stored rows: one per day, amount in kroner, VAT applied by the collection hook path.
    assert.equal(m.store.size, 3)
    const day = [...m.store.values()].find((d) => d.externalDate === '2026-07-22')!
    assert.equal(day.amount, 1234.56)
    // Reverse charge: no 25 % is stripped off on the way in.
    assert.equal(day.vatRate, 0)
    assert.equal(day.channel, 'google')
    assert.equal(day.source, 'google-ads')
    assert.equal(day.externalKey, 'google:1234567890:2026-07-22')

    const serialized = JSON.stringify(body) + JSON.stringify([...m.store.values()])
    for (const secret of Object.values(SECRETS)) assert.ok(!serialized.includes(secret))
  })

  it('is idempotent: a second run creates nothing and updates a restated day', async () => {
    const m = mockPayload()
    globalThis.fetch = mockGoogle([['2026-07-22', '1000000']]).impl
    await googleSyncEndpoint.handler!(makeReq(m.payload, { mode: 'full' }))
    assert.equal(m.store.size, 1)

    // Google restates the same day with a higher figure.
    globalThis.fetch = mockGoogle([['2026-07-22', '1750000']]).impl
    const res = await googleSyncEndpoint.handler!(makeReq(m.payload, { mode: 'incremental' }))
    const body = (await res.json()) as Record<string, unknown>

    assert.equal(body.created, 0)
    assert.equal(body.updated, 1)
    assert.equal(m.store.size, 1, 'no duplicate row for the same day')
    assert.equal([...m.store.values()][0].amount, 1.75)
  })

  it('escalates a first incremental run to a full import', async () => {
    const m = mockPayload()
    const google = mockGoogle([
      ['2026-02-01', '5000000'],
      ['2026-07-22', '1000000'],
    ])
    globalThis.fetch = google.impl

    const res = await googleSyncEndpoint.handler!(makeReq(m.payload, { mode: 'incremental' }))
    const body = (await res.json()) as Record<string, unknown>

    assert.equal(body.initialSync, true)
    assert.equal(body.mode, 'full')
    assert.deepEqual(body.period, { since: '2026-02-01', until: (body.period as { until: string }).until })
    // The earliest-day probe ran before the spend queries.
    assert.ok(google.calls.some((q) => q.includes('LIMIT 1')))
  })

  it('maps a Google API failure to 502 with an actionable message', async () => {
    const m = mockPayload()
    globalThis.fetch = (async (url: unknown) => {
      if (String(url).includes('token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: SECRETS.accessToken, expires_in: 3600 }),
          text: async () => '',
        }
      }
      return {
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            status: 'PERMISSION_DENIED',
            details: [
              { requestId: 'r1', errors: [{ errorCode: { authorizationError: 'DEVELOPER_TOKEN_NOT_APPROVED' } }] },
            ],
          },
        }),
        text: async () => '',
      }
    }) as unknown as FetchLike

    const res = await googleSyncEndpoint.handler!(makeReq(m.payload, { mode: 'incremental' }))
    const body = (await res.json()) as Record<string, unknown>
    assert.equal(res.status, 502)
    assert.equal(body.success, false)
    assert.match(String(body.error), /Basic Access/)
    assert.equal(m.store.size, 0)

    // The failure is visible on the panel via the status endpoint.
    const statusRes = await googleStatusEndpoint.handler!(makeReq(m.payload, undefined))
    const status = (await statusRes.json()) as { sync: { lastError: string | null } }
    assert.match(String(status.sync.lastError), /Basic Access/)
  })

  it('maps a revoked refresh token to 502 without echoing the token', async () => {
    const m = mockPayload()
    globalThis.fetch = (async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }),
      text: async () => '',
    })) as unknown as FetchLike

    const res = await googleSyncEndpoint.handler!(makeReq(m.payload, { mode: 'incremental' }))
    const body = (await res.json()) as Record<string, unknown>
    assert.equal(res.status, 502)
    assert.match(String(body.error), /GOOGLE_ADS_REFRESH_TOKEN/)
    assert.ok(!JSON.stringify(body).includes(SECRETS.refreshToken))
  })
})
