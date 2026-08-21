import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { resendShippingEmail } from './resendShippingEmail'
import { SHIPMENT_REQUIRED_MESSAGE } from '@/lib/orders/shipment'

/**
 * The manual «Send sporingsmail på nytt» path, against a stubbed Payload — same shape as
 * `registerPartnerPayout.test.ts`.
 *
 * Two things matter here. It must still send (it is the only way to retry a failed or a
 * corrected tracking e-mail), and it must send the *same* e-mail the automatic hook sends —
 * carrier, consignment number and «Spor pakken» button included.
 */

process.env.EMAIL_SEND_TIMEOUT_MS = '150'

beforeEach(() => {
  mock.method(console, 'log', () => {})
  mock.method(console, 'error', () => {})
  mock.method(console, 'warn', () => {})
})

const ADMIN = { id: 1, email: 'post@aboks.no' }

const shippedOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 42,
    orderNumber: 'AB-1001',
    status: 'shipped',
    customerInfo: { email: 'kunde@example.com', firstName: 'Inge', lastName: 'Martin' },
    items: [
      {
        displayName: 'aBoks Vegg – Sort',
        variantName: 'Sort',
        quantity: 1,
        unitPrice: 499,
        lineTotal: 499,
      },
    ],
    subtotal: 499,
    shipping: 0,
    total: 499,
    shippingCarrier: 'postnord',
    trackingNumber: '707123456789',
    shippedEmailSentAt: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  }) as unknown as Order

type EmailMessage = { to: string; subject: string; html: string; text: string }

function harness(order: Order | null, { force = false }: { force?: boolean } = {}) {
  const emails: EmailMessage[] = []
  const updates: Record<string, unknown>[] = []
  const row = order ? { ...order } : null

  const payload = {
    // No drizzle executor: `claimEmailsAtomically` reports non-atomic and the endpoint falls
    // back to the plain claim, which is the documented behaviour under a pooled connection.
    db: {},
    findByID: async () => {
      if (!row) throw new Error('not found')
      return row
    },
    update: async ({ data }: { data: Record<string, unknown> }) => {
      updates.push(data)
      Object.assign(row!, data)
      return row
    },
    sendEmail: async (message: EmailMessage) => {
      emails.push(message)
      return { messageId: '<resend@zoho>' }
    },
  }

  const req = {
    user: ADMIN,
    payload,
    context: {},
    routeParams: { id: '42' },
    searchParams: new URLSearchParams(force ? { force: 'true' } : {}),
  } as unknown as PayloadRequest

  return { req, emails, updates, row }
}

const call = async (h: ReturnType<typeof harness>) => {
  const res = await resendShippingEmail.handler(h.req)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

/* ------------------------------ it still sends ------------------------------ */

describe('Send sporingsmail på nytt', () => {
  it('sends the tracking email', async () => {
    const h = harness(shippedOrder())
    const { status, body } = await call(h)

    assert.equal(status, 200)
    assert.equal(body.ok, true)
    assert.equal(h.emails.length, 1)
    assert.equal(h.emails[0].to, 'kunde@example.com')
  })

  it('sends the same email the automatic hook sends', async () => {
    const h = harness(shippedOrder())
    await call(h)

    const email = h.emails[0]
    assert.equal(email.subject, 'Bestillingen din er sendt – Ordre #AB-1001')
    assert.ok(email.html.includes('PostNord'), 'the carrier name')
    assert.ok(email.html.includes('707123456789'), 'the tracking number')
    assert.ok(email.html.includes('https://www.postnord.no/'), 'the tracking URL')
    assert.ok(email.html.includes('Spor pakken'), 'the CTA')
  })

  it('uses the carrier stored on the order, not a default', async () => {
    const h = harness(shippedOrder({ shippingCarrier: 'helthjem', trackingNumber: 'HJ-1' }))
    await call(h)

    assert.ok(h.emails[0].html.includes('Helthjem'))
    assert.ok(h.emails[0].html.includes('https://helthjem.no/sporing'))
    assert.ok(!h.emails[0].html.includes('postnord.no'))
  })

  it('resends a second copy when forced', async () => {
    const h = harness(shippedOrder({ shippedEmailSentAt: '2026-08-20T11:00:00.000Z' }), {
      force: true,
    })
    const { status } = await call(h)

    assert.equal(status, 200)
    assert.equal(h.emails.length, 1)
  })

  it('refuses an unforced resend once the email has been sent', async () => {
    const h = harness(shippedOrder({ shippedEmailSentAt: '2026-08-20T11:00:00.000Z' }))
    const { status } = await call(h)

    assert.equal(status, 409)
    assert.equal(h.emails.length, 0)
  })
})

/* ------------------------- the same shipment requirement ------------------------- */

describe('resend — shipment requirement', () => {
  it('refuses when no carrier is selected', async () => {
    const h = harness(shippedOrder({ shippingCarrier: null }))
    const { status, body } = await call(h)

    assert.equal(status, 409)
    assert.equal(body.error, SHIPMENT_REQUIRED_MESSAGE)
    assert.deepEqual(body.missing, ['shippingCarrier'])
    assert.equal(h.emails.length, 0)
  })

  it('refuses when the tracking number is empty', async () => {
    const h = harness(shippedOrder({ trackingNumber: '  ' }))
    const { status, body } = await call(h)

    assert.equal(status, 409)
    assert.deepEqual(body.missing, ['trackingNumber'])
    assert.equal(h.emails.length, 0)
  })

  it('refuses an order that predates the Forsendelse fields, and says why', async () => {
    const h = harness(shippedOrder({ shippingCarrier: null, trackingNumber: null }))
    const { status, body } = await call(h)

    assert.equal(status, 409)
    assert.deepEqual(body.missing, ['shippingCarrier', 'trackingNumber'])
  })

  it('refuses even when forced — a resend with nothing to track helps nobody', async () => {
    const h = harness(shippedOrder({ shippingCarrier: null, trackingNumber: null }), {
      force: true,
    })
    const { status } = await call(h)

    assert.equal(status, 409)
    assert.equal(h.emails.length, 0)
  })

  it('leaves the send claim untouched when it refuses', async () => {
    const h = harness(shippedOrder({ shippingCarrier: null }))
    await call(h)

    assert.equal(h.updates.length, 0, 'a refusal must not stamp shippedEmailSentAt')
  })

  it('still refuses an order that is not shipped, before looking at the shipment', async () => {
    const h = harness(shippedOrder({ status: 'confirmed', shippingCarrier: null }))
    const { status, body } = await call(h)

    assert.equal(status, 409)
    assert.match(String(body.error), /ikke merket som sendt/)
  })
})

/* --------------------------------- access --------------------------------- */

describe('resend — access', () => {
  it('rejects an unauthenticated request', async () => {
    const h = harness(shippedOrder())
    ;(h.req as { user: unknown }).user = null

    const { status } = await call(h)
    assert.equal(status, 401)
    assert.equal(h.emails.length, 0)
  })
})
