import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Endpoint, PayloadRequest } from 'payload'
import { marketingChannelsEndpoint } from './marketingChannels'
import { metaExpensesEndpoint } from './metaExpenses'

interface MockOpts {
  user?: unknown
  query?: Record<string, unknown>
  docs?: unknown[]
}

function makeReq({ user, query = {}, docs = [] }: MockOpts): PayloadRequest {
  return {
    user,
    query,
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

const ENDPOINTS: Array<[string, Endpoint]> = [
  ['marketing/channels', marketingChannelsEndpoint],
  ['meta/expenses', metaExpensesEndpoint],
]

describe('marketing endpoints — admin-only access (#10)', () => {
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

describe('marketing/channels — admin happy path', () => {
  const KEYS = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID']
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('returns a Meta card, "Ikke konfigurert" when env is missing (#1, #3)', async () => {
    for (const k of KEYS) delete process.env[k]
    const { status, json } = await call(marketingChannelsEndpoint, { user: { role: 'admin' } })
    assert.equal(status, 200)
    const channels = json.channels as Array<{ id: string; status: string; href: string | null }>
    const meta = channels.find((c) => c.id === 'meta')!
    assert.ok(meta)
    assert.equal(meta.status, 'Ikke konfigurert')
    assert.equal(meta.href, '/admin/collections/marketing-expenses/meta')
  })

  it('returns "Tilkoblet" when env is present (#4)', async () => {
    process.env.META_ACCESS_TOKEN = 'tok'
    process.env.META_AD_ACCOUNT_ID = 'act_123'
    const { json } = await call(marketingChannelsEndpoint, {
      user: { role: 'admin' },
      docs: [
        { id: 1, date: '2026-07-20T00:00:00.000Z', amount: 100, amountExVat: 80, source: 'meta-api', lastSyncedAt: '2026-07-22T10:00:00.000Z' },
        { id: 2, date: '2026-07-21T00:00:00.000Z', amount: 200, amountExVat: 160, source: 'meta-api', lastSyncedAt: '2026-07-22T10:00:00.000Z' },
      ],
    })
    const channels = json.channels as Array<{ id: string; status: string; summary: { totalSpend: number; days: number } }>
    const meta = channels.find((c) => c.id === 'meta')!
    assert.equal(meta.status, 'Tilkoblet')
    assert.equal(meta.summary.totalSpend, 300)
    assert.equal(meta.summary.days, 2)
  })
})

describe('meta/expenses — validation', () => {
  it('rejects a single date with 400', async () => {
    const { status } = await call(metaExpensesEndpoint, {
      user: { role: 'admin' },
      query: { since: '2026-07-20' },
    })
    assert.equal(status, 400)
  })

  it('accepts an admin request with no dates (200)', async () => {
    const { status, json } = await call(metaExpensesEndpoint, { user: { role: 'admin' } })
    assert.equal(status, 200)
    assert.deepEqual(json.period, { since: null, until: null })
  })
})
