import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { sendReviewInvitation } from './sendReviewInvitation'

/**
 * «Send anmeldelsesinvitasjon», against a stubbed Payload — same harness shape as
 * `resendShippingEmail.test.ts`.
 *
 * The subject here is the order's `reviewInvitationSentAt` column: it must record the
 * moment an invitation e-mail was *actually* sent, and nothing else. Every refusal path and
 * every failure path in this endpoint must leave it alone, or the column stops meaning what
 * the admin list claims it means.
 *
 * The stamp is a direct SQL UPDATE (see @/lib/reviewInvitationDb), so the harness fakes the
 * drizzle executor and reads statements back off drizzle's tagged-template object:
 * `queryChunks` alternates literal `StringChunk`s (whose `value` is an array of strings)
 * with the raw interpolated parameters.
 */

beforeEach(() => {
  mock.method(console, 'log', () => {})
  mock.method(console, 'error', () => {})
  mock.method(console, 'warn', () => {})
})

const ADMIN = { id: 1, email: 'post@aboks.no' }

type Invitation = {
  id: number
  status: 'active' | 'used' | 'expired' | 'revoked'
  sentAt?: string | null
}

const deliveredOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 42,
    orderNumber: 'AB-1001',
    status: 'delivered',
    customer: 7,
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
    reviewInvitationSentAt: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  }) as unknown as Order

type Chunk = { value?: unknown }

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks
    .map((c) => {
      const value = (c as Chunk)?.value
      return Array.isArray(value) ? value.join('') : '?'
    })
    .join('')
}

function sqlParams(query: unknown): unknown[] {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks.filter((c) => !Array.isArray((c as Chunk)?.value))
}

type EmailMessage = { to: string; subject: string; html: string; text: string }

type HarnessOptions = {
  /** Invitations already on file for this order, newest first. */
  existing?: Invitation[]
  resend?: boolean
  /** Make payload.sendEmail() throw, as a rejected SMTP send would. */
  emailFails?: boolean
  /** Make the stamping UPDATE throw, as a lost connection would. */
  stampFails?: boolean
  /** Drop the drizzle executor, as a non-Postgres or stubbed adapter has none. */
  noExecutor?: boolean
}

function harness(order: Order | null, options: HarnessOptions = {}) {
  const { existing = [], resend = false } = options

  const emails: EmailMessage[] = []
  const invitationUpdates: { id: number | string; data: Record<string, unknown> }[] = []
  const created: Record<string, unknown>[] = []
  /** Every review_invitation_sent_at write, as { orderId, sentAt }. */
  const stamps: { orderId: unknown; sentAt: unknown }[] = []
  const row = order ? { ...order } : null

  const execute = async (query: unknown) => {
    const text = sqlText(query)

    if (/UPDATE "orders"/.test(text)) {
      if (options.stampFails) throw new Error('connection terminated')
      assert.match(text, /"review_invitation_sent_at"/, 'the only orders column this may write')
      const [sentAt, orderId] = sqlParams(query)
      stamps.push({ orderId, sentAt })
      return [{ id: orderId }]
    }

    // revokeActiveInvitationsForOrder — the rows it would revoke.
    return existing.filter((d) => d.status === 'active').map((d) => ({ id: d.id }))
  }

  const payload = {
    db: options.noExecutor ? {} : { drizzle: { execute } },
    findByID: async () => {
      if (!row) throw new Error('not found')
      return row
    },
    find: async () => ({ docs: existing, totalDocs: existing.length }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: 900 }
    },
    update: async ({ id, data }: { id: number | string; data: Record<string, unknown> }) => {
      invitationUpdates.push({ id, data })
      return { id }
    },
    sendEmail: async (message: EmailMessage) => {
      if (options.emailFails) throw new Error('SMTP 550')
      emails.push(message)
      return { messageId: '<invite@zoho>' }
    },
  }

  const req = {
    user: ADMIN,
    payload,
    context: {},
    routeParams: { id: '42' },
    searchParams: new URLSearchParams(resend ? { resend: 'true' } : {}),
  } as unknown as PayloadRequest

  return { req, emails, created, invitationUpdates, stamps, row }
}

const call = async (h: ReturnType<typeof harness>) => {
  const res = await sendReviewInvitation.handler(h.req)
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

/* ------------------------- the stamp on a successful send ------------------------- */

describe('reviewInvitationSentAt — successful send', () => {
  it('stamps the order once the email has gone out', async () => {
    const h = harness(deliveredOrder())
    const { status, body } = await call(h)

    assert.equal(status, 200)
    assert.equal(h.emails.length, 1)
    assert.equal(h.stamps.length, 1)
    assert.equal(h.stamps[0].orderId, 42)
    assert.equal(h.stamps[0].sentAt, body.sentAt)
  })

  it('stamps a real, parseable timestamp', async () => {
    const before = Date.now()
    const h = harness(deliveredOrder())
    await call(h)

    const stamped = Date.parse(String(h.stamps[0].sentAt))
    assert.ok(Number.isFinite(stamped), 'an ISO timestamp')
    assert.ok(stamped >= before && stamped <= Date.now(), 'the moment of the send')
  })

  it('records the same instant on the order and on the invitation', async () => {
    const h = harness(deliveredOrder())
    await call(h)

    assert.equal(h.created[0].sentAt, h.stamps[0].sentAt)
  })
})

/* ------------------------------- resend overwrites ------------------------------- */

describe('reviewInvitationSentAt — resend', () => {
  it('stamps again, so the column holds the last successful send', async () => {
    const h = harness(
      deliveredOrder({ reviewInvitationSentAt: '2026-08-20T08:00:00.000Z' } as Partial<Order>),
      { existing: [{ id: 1, status: 'active', sentAt: '2026-08-20T08:00:00.000Z' }], resend: true },
    )
    const { status } = await call(h)

    assert.equal(status, 200)
    assert.equal(h.stamps.length, 1)
    assert.ok(
      Date.parse(String(h.stamps[0].sentAt)) > Date.parse('2026-08-20T08:00:00.000Z'),
      'the newer send replaces the older timestamp',
    )
  })

  it('still revokes the previous link — the resend flow is unchanged', async () => {
    const h = harness(deliveredOrder(), {
      existing: [{ id: 1, status: 'active', sentAt: '2026-08-20T08:00:00.000Z' }],
      resend: true,
    })
    await call(h)

    assert.equal(h.created.length, 1)
    assert.equal(h.created[0].status, 'active')
    assert.equal(h.created[0].resendCount, 1)
  })
})

/* --------------------------- failures must not stamp --------------------------- */

describe('reviewInvitationSentAt — nothing is stamped without a send', () => {
  it('does not stamp when the email fails', async () => {
    const h = harness(deliveredOrder(), { emailFails: true })
    const { status } = await call(h)

    assert.equal(status, 502)
    assert.equal(h.stamps.length, 0, 'a failed send must leave the previous value standing')
  })

  it('revokes the dangling invitation on a failed send, as before', async () => {
    const h = harness(deliveredOrder(), { emailFails: true })
    await call(h)

    assert.equal(h.invitationUpdates.length, 1)
    assert.equal(h.invitationUpdates[0].id, 900)
    assert.equal(h.invitationUpdates[0].data.status, 'revoked')
  })

  it('does not stamp an order that is not delivered', async () => {
    const h = harness(deliveredOrder({ status: 'confirmed' }))
    const { status } = await call(h)

    assert.equal(status, 409)
    assert.equal(h.emails.length, 0)
    assert.equal(h.stamps.length, 0)
  })

  it('does not stamp a cancelled order', async () => {
    const h = harness(deliveredOrder({ status: 'cancelled' }))
    const { status } = await call(h)

    assert.equal(status, 409)
    assert.equal(h.stamps.length, 0)
  })

  it('does not stamp when an invitation already exists and this is not a resend', async () => {
    const h = harness(deliveredOrder(), {
      existing: [{ id: 1, status: 'active', sentAt: '2026-08-20T08:00:00.000Z' }],
    })
    const { status } = await call(h)

    assert.equal(status, 409)
    assert.equal(h.emails.length, 0)
    assert.equal(h.stamps.length, 0)
  })

  it('does not stamp for an unauthenticated request', async () => {
    const h = harness(deliveredOrder())
    ;(h.req as { user: unknown }).user = null

    const { status } = await call(h)
    assert.equal(status, 401)
    assert.equal(h.stamps.length, 0)
  })

  it('does not stamp an order that cannot be found', async () => {
    const h = harness(null)
    const { status } = await call(h)

    assert.equal(status, 404)
    assert.equal(h.stamps.length, 0)
  })
})

/* ------------------- a failed stamp must not undo a sent email ------------------- */

describe('reviewInvitationSentAt — stamping is best-effort', () => {
  it('still reports success when the stamp write throws', async () => {
    const h = harness(deliveredOrder(), { stampFails: true })
    const { status, body } = await call(h)

    assert.equal(status, 200)
    assert.equal(body.ok, true)
    assert.equal(h.emails.length, 1, 'the customer has the link either way')
  })

  it('does not revoke the invitation when only the stamp failed', async () => {
    const h = harness(deliveredOrder(), { stampFails: true })
    await call(h)

    assert.equal(h.invitationUpdates.length, 0)
  })

  it('still sends when the adapter exposes no SQL executor', async () => {
    const h = harness(deliveredOrder(), { noExecutor: true })
    const { status } = await call(h)

    assert.equal(status, 200)
    assert.equal(h.emails.length, 1)
  })
})

/* ------------------------ the send itself is unchanged ------------------------ */

describe('send review invitation — existing behaviour', () => {
  it('emails the customer a one-time link and stores only its hash', async () => {
    const h = harness(deliveredOrder())
    await call(h)

    assert.equal(h.emails[0].to, 'kunde@example.com')

    const tokenHash = String(h.created[0].tokenHash)
    assert.match(tokenHash, /^[0-9a-f]{64}$/, 'a SHA-256 hash, not the raw token')
    assert.ok(!h.emails[0].html.includes(tokenHash), 'the hash never reaches the email')
    assert.match(h.emails[0].html, /\/anmeldelse\//, 'the review link')
  })

  it('refuses an order with no customer email', async () => {
    const h = harness(deliveredOrder({ customerInfo: { email: null } } as Partial<Order>))
    const { status } = await call(h)

    assert.equal(status, 409)
    assert.equal(h.stamps.length, 0)
  })
})
