import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Endpoint, PayloadRequest } from 'payload'
import { googleExpensesEndpoint } from './googleExpenses'
import { googleStatusEndpoint } from './googleStatus'
import { googleSyncEndpoint } from './googleSync'
import { MARKETING_API } from '@/lib/marketing/channels'
import { resetSyncState } from '@/lib/marketing/syncState'

const SECRETS = {
  GOOGLE_ADS_CLIENT_SECRET: 'CLIENT-SECRET-should-never-leak',
  GOOGLE_ADS_REFRESH_TOKEN: 'REFRESH-TOKEN-should-never-leak',
  GOOGLE_ADS_DEVELOPER_TOKEN: 'DEV-TOKEN-should-never-leak',
}

const ENV_KEYS = [
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
  'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
]

interface MockOpts {
  user?: unknown
  query?: Record<string, unknown>
  docs?: unknown[]
  body?: unknown
}

function makeReq({ user, query = {}, docs = [], body }: MockOpts): PayloadRequest {
  return {
    user,
    query,
    json: async () => body,
    payload: {
      find: async () => ({ docs, totalDocs: docs.length }),
      logger: { error() {}, warn() {}, info() {} },
    },
  } as unknown as PayloadRequest
}

async function call(endpoint: Endpoint, opts: MockOpts) {
  const res = await endpoint.handler!(makeReq(opts))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

let saved: Record<string, string | undefined>
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  resetSyncState()
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  resetSyncState()
})

function setConfiguredEnv(): void {
  process.env.GOOGLE_ADS_CLIENT_ID = 'client-id'
  process.env.GOOGLE_ADS_CLIENT_SECRET = SECRETS.GOOGLE_ADS_CLIENT_SECRET
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = SECRETS.GOOGLE_ADS_DEVELOPER_TOKEN
  process.env.GOOGLE_ADS_REFRESH_TOKEN = SECRETS.GOOGLE_ADS_REFRESH_TOKEN
  process.env.GOOGLE_ADS_CUSTOMER_ID = '123-456-7890'
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '987-654-3210'
}

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k]
}

const ENDPOINTS: Array<[string, Endpoint]> = [
  ['google/expenses', googleExpensesEndpoint],
  ['google/status', googleStatusEndpoint],
  ['google/sync', googleSyncEndpoint],
]

describe('google endpoints — admin-only access', () => {
  for (const [name, endpoint] of ENDPOINTS) {
    it(`${name}: 401 without a user`, async () => {
      const { status } = await call(endpoint, { user: null })
      assert.equal(status, 401)
    })
    it(`${name}: 403 for an authenticated editor`, async () => {
      const { status } = await call(endpoint, { user: { role: 'editor' } })
      assert.equal(status, 403)
    })
  }
})

describe('google endpoints — registered paths match the client constants', () => {
  it('sync, expenses and status resolve to the paths the UI calls', () => {
    assert.equal(`/api${googleSyncEndpoint.path}`, MARKETING_API.googleSync)
    assert.equal(`/api${googleExpensesEndpoint.path}`, MARKETING_API.googleExpenses)
    assert.equal(`/api${googleStatusEndpoint.path}`, MARKETING_API.googleStatus)
    assert.equal(MARKETING_API.googleSync, '/api/admin/integrations/google/sync')
  })
})

describe('google/sync — input validation (#9)', () => {
  it('rejects an invalid mode with 400 before touching Google', async () => {
    setConfiguredEnv()
    const { status, json } = await call(googleSyncEndpoint, {
      user: { role: 'admin' },
      body: { mode: 'partial' },
    })
    assert.equal(status, 400)
    assert.equal(json.success, false)
    assert.match(String(json.error), /Ugyldig synkroniseringsmodus/)
  })

  it('rejects an oversized body with 400', async () => {
    setConfiguredEnv()
    const { status } = await call(googleSyncEndpoint, {
      user: { role: 'admin' },
      body: { mode: 'full', padding: 'x'.repeat(3000) },
    })
    assert.equal(status, 400)
  })
})

describe('google/sync — missing configuration (#10, #11)', () => {
  it('returns a controlled Norwegian error, never a stack trace or a secret', async () => {
    clearEnv()
    const { status, json } = await call(googleSyncEndpoint, {
      user: { role: 'admin' },
      body: { mode: 'incremental' },
    })
    assert.equal(status, 500)
    assert.equal(json.success, false)
    const error = String(json.error)
    assert.match(error, /Google Ads-konfigurasjonen mangler eller er ugyldig/)
    assert.ok(!/\s+at\s/.test(error), 'no stack frames in the message')
    const serialized = JSON.stringify(json)
    for (const secret of Object.values(SECRETS)) assert.ok(!serialized.includes(secret))
  })
})

describe('google/status', () => {
  it('reports "not configured" with the missing keys and no secrets (#10, #11)', async () => {
    clearEnv()
    const { status, json } = await call(googleStatusEndpoint, { user: { role: 'admin' } })
    assert.equal(status, 200)
    assert.equal(json.configured, false)
    assert.ok(Array.isArray(json.missingEnv))
    assert.ok((json.missingEnv as string[]).includes('GOOGLE_ADS_REFRESH_TOKEN'))
    assert.match(String(json.configError), /Google Ads-konfigurasjonen mangler eller er ugyldig/)
    const serialized = JSON.stringify(json)
    for (const secret of Object.values(SECRETS)) assert.ok(!serialized.includes(secret))
  })

  it('reports a configured account with masked ids only (#11)', async () => {
    setConfiguredEnv()
    const { status, json } = await call(googleStatusEndpoint, {
      user: { role: 'admin' },
      docs: [
        {
          id: 1,
          date: '2026-07-22T00:00:00.000Z',
          amount: 100,
          amountExVat: 80,
          source: 'google-ads',
          lastSyncedAt: '2026-07-22T10:00:00.000Z',
          syncMetadata: { currency: 'NOK', timeZone: 'Europe/Oslo', apiVersion: 'v24' },
        },
      ],
    })
    assert.equal(status, 200)
    assert.equal(json.configured, true)
    assert.equal(json.accountId, '•••-•••-7890')
    assert.equal(json.managerId, '•••-•••-3210')
    assert.equal(json.currency, 'NOK')
    assert.equal(json.timeZone, 'Europe/Oslo')
    assert.equal(json.hasData, true)
    const serialized = JSON.stringify(json)
    assert.ok(!serialized.includes('1234567890'), 'the full customer id never leaves the server')
    for (const secret of Object.values(SECRETS)) assert.ok(!serialized.includes(secret))
  })

  it('exposes the last-attempt state shape the panel renders', async () => {
    setConfiguredEnv()
    const { json } = await call(googleStatusEndpoint, { user: { role: 'admin' } })
    const sync = json.sync as Record<string, unknown>
    for (const key of [
      'lastAttemptAt',
      'lastSuccessAt',
      'lastError',
      'lastMode',
      'lastDateFrom',
      'lastDateTo',
      'createdCount',
      'updatedCount',
    ]) {
      assert.ok(key in sync, `sync.${key} is present`)
    }
  })
})

describe('google/expenses — validation', () => {
  it('rejects a single date with 400', async () => {
    const { status } = await call(googleExpensesEndpoint, {
      user: { role: 'admin' },
      query: { since: '2026-07-20' },
    })
    assert.equal(status, 400)
  })

  it('accepts an admin request with no dates (200)', async () => {
    const { status, json } = await call(googleExpensesEndpoint, { user: { role: 'admin' } })
    assert.equal(status, 200)
    assert.deepEqual(json.period, { since: null, until: null })
  })

  it('summarises imported rows', async () => {
    const { json } = await call(googleExpensesEndpoint, {
      user: { role: 'admin' },
      docs: [
        { id: 1, date: '2026-07-20T00:00:00.000Z', amount: 100, amountExVat: 80, source: 'google-ads' },
        { id: 2, date: '2026-07-21T00:00:00.000Z', amount: 200, amountExVat: 160, source: 'google-ads' },
      ],
    })
    const summary = json.summary as { totalInclVat: number; days: number }
    assert.equal(summary.totalInclVat, 300)
    assert.equal(summary.days, 2)
    assert.equal(json.hasData, true)
  })
})
