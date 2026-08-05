import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MetaError } from '../errors'
import type { MetaCapiConfig } from './config'
import type { MetaPurchaseClaimStore } from './claim'
import type { MetaPurchasePayload } from './event'
import { contentsFromKustomOrder, sendPurchaseOnce, type SendPurchaseOnceInput } from './purchase'
import type { KustomOrder } from '@/lib/kustom'

const config: MetaCapiConfig = {
  pixelId: '1234567890',
  accessToken: 'capi-token',
  graphApiVersion: 'v24.0',
  eventsUrl: 'https://graph.facebook.com/v24.0/1234567890/events',
}

/**
 * An in-memory stand-in with the same semantics as the SQL statements in ./claim:
 * `claim` succeeds only while the timestamp is NULL, and `release` refuses to clear it once
 * a receipt exists.
 */
function fakeStore() {
  const row = { sentAt: null as string | null, eventId: null as string | null }
  const store: MetaPurchaseClaimStore & { row: typeof row } = {
    row,
    async claim(_orderId, claimedAt) {
      if (row.sentAt !== null) return false
      row.sentAt = claimedAt
      return true
    },
    async markSent(_orderId, eventId, sentAt) {
      row.eventId = eventId
      row.sentAt = sentAt
    },
    async release() {
      if (row.eventId === null) row.sentAt = null
    },
  }
  return store
}

const input: SendPurchaseOnceInput = {
  orderId: 42,
  kustomOrderId: 'kustom-1',
  orderNumber: 'AB-000123',
  value: 748,
  email: 'ola@example.no',
  phone: '+47 123 45 678',
  attribution: {
    fbp: 'fb.1.1700000000000.1234567890',
    clientIpAddress: '84.208.10.5',
    clientUserAgent: 'Mozilla/5.0 (iPhone)',
  },
  contents: [{ id: '12', quantity: 2, itemPrice: 349 }],
  eventTimeMs: 1_785_000_000_000,
}

let logs: Record<string, unknown>[]
const log = (fields: Record<string, unknown>) => {
  logs.push(fields)
}
beforeEach(() => {
  logs = []
})

describe('sendPurchaseOnce — happy path', () => {
  it('sends once and records the receipt', async () => {
    const store = fakeStore()
    const sent: MetaPurchasePayload[] = []

    const result = await sendPurchaseOnce(
      {
        config,
        store,
        log,
        send: async (_cfg, body) => {
          sent.push(body)
          return { eventsReceived: 1 }
        },
      },
      input,
    )

    assert.equal(result.status, 'sent')
    assert.equal(result.eventId, 'purchase_kustom-1')
    assert.equal(sent.length, 1)
    assert.equal(sent[0].data[0].event_id, 'purchase_kustom-1')
    assert.equal(store.row.eventId, 'purchase_kustom-1')
    assert.ok(store.row.sentAt)
  })

  it('passes the configured test event code through to the payload', async () => {
    const sent: MetaPurchasePayload[] = []
    await sendPurchaseOnce(
      {
        config: { ...config, testEventCode: 'TEST12345' },
        store: fakeStore(),
        log,
        send: async (_cfg, body) => {
          sent.push(body)
          return { eventsReceived: 1 }
        },
      },
      input,
    )
    assert.equal(sent[0].test_event_code, 'TEST12345')
  })

  it('logs no personal data, no payload and no token', async () => {
    await sendPurchaseOnce(
      { config, store: fakeStore(), log, send: async () => ({ eventsReceived: 1 }) },
      input,
    )

    const serialized = JSON.stringify(logs)
    for (const secret of ['ola@example.no', '4712345678', '84.208.10.5', 'Mozilla', 'capi-token']) {
      assert.ok(!serialized.includes(secret), `log leaked ${secret}`)
    }
    assert.ok(serialized.includes('purchase_kustom-1'))
  })
})

describe('sendPurchaseOnce — no repeat send', () => {
  it('does not send again once the receipt is on the order', async () => {
    const store = fakeStore()
    let calls = 0
    const deps = {
      config,
      store,
      log,
      send: async () => {
        calls += 1
        return { eventsReceived: 1 }
      },
    }

    assert.equal((await sendPurchaseOnce(deps, input)).status, 'sent')
    const second = await sendPurchaseOnce(deps, input)

    assert.equal(second.status, 'already_sent')
    assert.equal(calls, 1)
  })

  it('short-circuits when the caller already has the receipt in hand', async () => {
    let calls = 0
    const result = await sendPurchaseOnce(
      {
        config,
        store: fakeStore(),
        log,
        send: async () => {
          calls += 1
          return { eventsReceived: 1 }
        },
      },
      { ...input, alreadySentEventId: 'purchase_kustom-1' },
    )

    assert.equal(result.status, 'already_sent')
    assert.equal(calls, 0)
  })

  it('sends exactly once when two webhook deliveries overlap', async () => {
    const store = fakeStore()
    let calls = 0
    const deps = {
      config,
      store,
      log,
      // Resolves on a later tick, so both callers are inside the flow at the same time —
      // which is precisely what a read-then-decide-then-write guard would get wrong.
      send: async () => {
        calls += 1
        await new Promise((resolve) => setTimeout(resolve, 5))
        return { eventsReceived: 1 }
      },
    }

    const [a, b] = await Promise.all([sendPurchaseOnce(deps, input), sendPurchaseOnce(deps, input)])

    assert.equal(calls, 1)
    assert.deepEqual([a.status, b.status].sort(), ['already_sent', 'sent'])
  })
})

describe('sendPurchaseOnce — failures never block the order', () => {
  it('releases the claim on a Meta error, so the next delivery retries', async () => {
    const store = fakeStore()
    let calls = 0
    const deps = {
      config,
      store,
      log,
      send: async () => {
        calls += 1
        if (calls === 1) throw new MetaError('Meta feilet', { code: 190, message: 'bad token' }, 400)
        return { eventsReceived: 1 }
      },
    }

    const first = await sendPurchaseOnce(deps, input)
    assert.equal(first.status, 'failed')
    assert.equal(store.row.sentAt, null, 'claim must be released')
    assert.equal(store.row.eventId, null, 'no receipt for a failed send')

    const second = await sendPurchaseOnce(deps, input)
    assert.equal(second.status, 'sent')
    assert.equal(store.row.eventId, 'purchase_kustom-1')
  })

  it('logs only safe diagnostics for a Meta error', async () => {
    await sendPurchaseOnce(
      {
        config,
        store: fakeStore(),
        log,
        send: async () => {
          throw new MetaError('Meta feilet', { code: 190, errorSubcode: 460, message: 'bad token' }, 401)
        },
      },
      input,
    )

    const failure = logs.find((entry) => entry.event === 'send-failed')
    assert.ok(failure)
    assert.equal(failure.httpStatus, 401)
    assert.equal(failure.metaCode, 190)
    assert.equal(failure.metaMessage, 'bad token')
    assert.ok(!JSON.stringify(failure).includes('ola@example.no'))
  })

  it('never throws, whatever the transport does', async () => {
    const result = await sendPurchaseOnce(
      {
        config,
        store: fakeStore(),
        log,
        send: async () => {
          throw new TypeError('fetch is not a function')
        },
      },
      input,
    )
    assert.equal(result.status, 'failed')
  })

  it('skips silently when the integration is not configured', async () => {
    let calls = 0
    const result = await sendPurchaseOnce(
      {
        config: null,
        store: fakeStore(),
        log,
        send: async () => {
          calls += 1
          return { eventsReceived: 1 }
        },
      },
      input,
    )
    assert.equal(result.status, 'not_configured')
    assert.equal(calls, 0)
  })

  it('refuses to send without a claim store rather than risk a duplicate', async () => {
    let calls = 0
    const result = await sendPurchaseOnce(
      {
        config,
        store: null,
        log,
        send: async () => {
          calls += 1
          return { eventsReceived: 1 }
        },
      },
      input,
    )
    assert.equal(result.status, 'no_claim_store')
    assert.equal(calls, 0)
  })
})

describe('contentsFromKustomOrder', () => {
  it('keeps only physical lines and converts øre to kroner', () => {
    const kustomOrder = {
      order_lines: [
        { type: 'physical', reference: '12', quantity: 2, unit_price: 34900 },
        { type: 'shipping_fee', reference: 'shipping', quantity: 1, unit_price: 9900 },
      ],
    } as unknown as KustomOrder

    assert.deepEqual(contentsFromKustomOrder(kustomOrder), [
      { id: '12', quantity: 2, itemPrice: 349 },
    ])
  })

  it('handles an order with no lines at all', () => {
    assert.deepEqual(contentsFromKustomOrder({} as KustomOrder), [])
  })
})
