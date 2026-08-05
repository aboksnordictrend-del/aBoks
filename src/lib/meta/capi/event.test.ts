import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'crypto'
import {
  buildPurchaseEventPayload,
  buildUserData,
  DEFAULT_EVENT_SOURCE_URL,
  purchaseEventId,
} from './event'

const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

const KUSTOM_ID = '7f3c1a90-0000-4c3a-9f11-8d2b6a4e1c22'
const EVENT_TIME_MS = 1_785_000_000_000

const baseInput = {
  kustomOrderId: KUSTOM_ID,
  orderNumber: 'AB-000123',
  value: 748,
  contents: [{ id: '12', quantity: 2, itemPrice: 349 }],
  eventTimeMs: EVENT_TIME_MS,
}

describe('purchaseEventId', () => {
  it('is derived from the Kustom order id and is stable', () => {
    assert.equal(purchaseEventId(KUSTOM_ID), `purchase_${KUSTOM_ID}`)
    assert.equal(purchaseEventId(KUSTOM_ID), purchaseEventId(KUSTOM_ID))
  })

  it('never depends on the order number, which the browser may not have yet', () => {
    const withNumber = buildPurchaseEventPayload({ ...baseInput, orderNumber: 'AB-000123' })
    const withoutNumber = buildPurchaseEventPayload({ ...baseInput, orderNumber: null })
    assert.equal(withNumber.data[0].event_id, withoutNumber.data[0].event_id)
    assert.equal(withNumber.data[0].event_id, `purchase_${KUSTOM_ID}`)
  })
})

describe('buildPurchaseEventPayload — envelope', () => {
  it('produces exactly one Purchase event with the required top-level fields', () => {
    const payload = buildPurchaseEventPayload(baseInput)
    assert.equal(payload.data.length, 1)

    const event = payload.data[0]
    assert.equal(event.event_name, 'Purchase')
    assert.equal(event.action_source, 'website')
    assert.equal(event.event_source_url, DEFAULT_EVENT_SOURCE_URL)
    // Seconds, not milliseconds — Meta rejects the latter as a timestamp far in the future.
    assert.equal(event.event_time, Math.floor(EVENT_TIME_MS / 1000))
  })

  it('reports the paid amount in NOK, with the order number as order_id', () => {
    const { custom_data } = buildPurchaseEventPayload(baseInput).data[0]
    assert.equal(custom_data.value, 748)
    assert.equal(custom_data.currency, 'NOK')
    assert.equal(custom_data.order_id, 'AB-000123')
    assert.equal(custom_data.content_type, 'product')
    assert.deepEqual(custom_data.contents, [{ id: '12', quantity: 2, item_price: 349 }])
  })

  it('falls back to the Kustom id when the order number is not known yet', () => {
    const payload = buildPurchaseEventPayload({ ...baseInput, orderNumber: null })
    assert.equal(payload.data[0].custom_data.order_id, KUSTOM_ID)
  })

  it('accepts a per-deployment event_source_url', () => {
    const payload = buildPurchaseEventPayload({
      ...baseInput,
      eventSourceUrl: 'https://preview.example.com/kasse/bekreftelse',
    })
    assert.equal(payload.data[0].event_source_url, 'https://preview.example.com/kasse/bekreftelse')
  })
})

describe('buildPurchaseEventPayload — user_data', () => {
  it('hashes email and phone with SHA-256 of the normalized value', () => {
    const { user_data } = buildPurchaseEventPayload({
      ...baseInput,
      email: '  Ola@Example.NO ',
      phone: '+47 123 45 678',
    }).data[0]

    assert.equal(user_data.em, sha('ola@example.no'))
    assert.equal(user_data.ph, sha('4712345678'))
  })

  it('never sends the plaintext identifiers anywhere in the payload', () => {
    const payload = buildPurchaseEventPayload({
      ...baseInput,
      email: 'ola@example.no',
      phone: '+47 123 45 678',
    })
    const serialized = JSON.stringify(payload)
    assert.ok(!serialized.includes('ola@example.no'))
    assert.ok(!serialized.includes('4712345678'))
  })

  it('carries the browser signals through unhashed, as Meta expects', () => {
    const { user_data } = buildPurchaseEventPayload({
      ...baseInput,
      attribution: {
        fbp: 'fb.1.1700000000000.1234567890',
        fbc: 'fb.1.1700000000000.AbCd_123',
        clientIpAddress: '84.208.10.5',
        clientUserAgent: 'Mozilla/5.0 (iPhone)',
      },
    }).data[0]

    assert.equal(user_data.fbp, 'fb.1.1700000000000.1234567890')
    assert.equal(user_data.fbc, 'fb.1.1700000000000.AbCd_123')
    assert.equal(user_data.client_ip_address, '84.208.10.5')
    assert.equal(user_data.client_user_agent, 'Mozilla/5.0 (iPhone)')
  })

  it('omits every absent field rather than sending null, undefined or an empty string', () => {
    const userData = buildUserData({
      email: '',
      phone: null,
      attribution: { fbp: '', fbc: undefined, clientIpAddress: '84.208.10.5' },
    })

    assert.deepEqual(Object.keys(userData), ['client_ip_address'])
    for (const value of Object.values(userData)) {
      assert.ok(value !== undefined && value !== null && value !== '')
    }
  })

  it('sends an empty user_data rather than empty keys when nothing at all is known', () => {
    const { user_data } = buildPurchaseEventPayload(baseInput).data[0]
    assert.deepEqual(user_data, {})
  })

  it('omits an unusable email/phone instead of hashing junk', () => {
    const { user_data } = buildPurchaseEventPayload({
      ...baseInput,
      email: 'not-an-email',
      phone: '123',
    }).data[0]

    assert.ok(!('em' in user_data))
    assert.ok(!('ph' in user_data))
  })
})

describe('buildPurchaseEventPayload — test_event_code', () => {
  it('is added at the top level when a code is supplied', () => {
    const payload = buildPurchaseEventPayload({ ...baseInput, testEventCode: 'TEST12345' })
    assert.equal(payload.test_event_code, 'TEST12345')
    // Top level, not inside the event.
    assert.ok(!('test_event_code' in payload.data[0]))
  })

  it('is absent entirely when no code is supplied', () => {
    const payload = buildPurchaseEventPayload(baseInput)
    assert.ok(!('test_event_code' in payload))
    assert.equal(JSON.stringify(payload).includes('test_event_code'), false)
  })

  it('is absent for an empty-string code, so production traffic is never diverted', () => {
    const payload = buildPurchaseEventPayload({ ...baseInput, testEventCode: '' })
    assert.ok(!('test_event_code' in payload))
  })
})
