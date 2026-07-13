import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@/payload-types'
import { claimOrderEmails, sendOrderEmails } from './sendOrderEmails'
import { emailsToClaim } from '@/lib/orderEmails'

process.env.EMAIL_SEND_TIMEOUT_MS = '150'

// Keep the structured logs out of the test output.
beforeEach(() => {
  mock.method(console, 'log', () => {})
  mock.method(console, 'error', () => {})
  mock.method(console, 'warn', () => {})
})

type SendEmailFn = (msg: { to: string; subject: string }) => Promise<unknown>

const COLUMN_TO_FIELD: Record<string, keyof Order> = {
  confirmation_email_sent_at: 'confirmationEmailSentAt',
  admin_email_sent_at: 'adminEmailSentAt',
  shipped_email_sent_at: 'shippedEmailSentAt',
}

const baseOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 42,
    orderNumber: 'AB-1001',
    status: 'confirmed',
    customerInfo: { email: 'kunde@example.com', firstName: 'Kari', lastName: 'Nordmann' },
    items: [{ variantName: 'Sort', quantity: 1, unitPrice: 499, lineTotal: 499 }],
    subtotal: 499,
    shipping: 0,
    total: 499,
    confirmationEmailSentAt: '2026-07-01T10:00:00.000Z',
    adminEmailSentAt: '2026-07-01T10:00:00.000Z',
    shippedEmailSentAt: null,
    shippedEmailMessageId: null,
    shippedEmailError: null,
    updatedAt: '2026-07-01T10:00:00.000Z',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }) as unknown as Order

/** Flattens a drizzle SQL object down to its literal text (params omitted). */
function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? []
  return chunks
    .map((chunk) => {
      const value = (chunk as { value?: unknown }).value
      if (Array.isArray(value)) return value.join('')
      if ((chunk as { queryChunks?: unknown[] }).queryChunks) return sqlText(chunk)
      return ''
    })
    .join('')
}

/**
 * Simulates a Payload PATCH faithfully enough to catch the bugs that mattered:
 *  • beforeChange writes into the same `data` that becomes the single UPDATE;
 *  • afterChange runs while the transaction is still open;
 *  • a nested payload.update re-enters the hooks (so a broken guard recurses);
 *  • payload merges the passed `context` onto the *same* req, replacing req.context
 *    with a new object (createLocalReq's real behaviour);
 *  • the DB honours the compare-and-set: `SET col = ts WHERE col IS NULL` succeeds
 *    for exactly one of two overlapping saves, which is how Postgres serialises them
 *    on the row lock.
 */
function harness(sendEmail: SendEmailFn, initial: Partial<Order> = {}) {
  const row = baseOrder(initial) // the committed row — the DB's copy
  const sent: { to: string; subject: string }[] = []
  const updates: { data: Record<string, unknown>; joinedTransaction: boolean }[] = []
  let depth = 0

  const drizzle = {
    execute: async (query: unknown) => {
      const text = sqlText(query)
      const column = Object.keys(COLUMN_TO_FIELD).find((c) => text.includes(`"${c}"`))
      assert.ok(column, `unrecognised SQL: ${text}`)
      const field = COLUMN_TO_FIELD[column]

      if (text.startsWith('UPDATE')) {
        if (row[field] != null) return { rows: [] } // lost the CAS
        ;(row as unknown as Record<string, unknown>)[field] = new Date().toISOString()
        return { rows: [{ claimed_at: row[field] }] }
      }
      return { rows: [{ claimed_at: row[field] ?? null }] }
    },
  }

  const payload = {
    db: { drizzle },
    sendEmail: async (msg: { to: string; subject: string }) => {
      sent.push(msg)
      return sendEmail(msg)
    },
    update: async (args: {
      data: Record<string, unknown>
      req?: { context?: Record<string, unknown> }
      context?: Record<string, unknown>
    }) => {
      depth += 1
      if (depth > 3) throw new Error('RECURSION: the hooks re-entered themselves')

      updates.push({ data: args.data, joinedTransaction: Boolean(args.req) })

      // createLocalReq: req.context = { ...req.context, ...context } on the same req.
      const req = args.req as { context: Record<string, unknown>; payload: unknown }
      req.context = { ...req.context, ...args.context }

      const previousDoc = { ...row }
      const data = { ...args.data }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await claimOrderEmails({ data, originalDoc: previousDoc, operation: 'update', req } as any)
      Object.assign(row, data)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sendOrderEmails({ doc: row, previousDoc, operation: 'update', req } as any)

      depth -= 1
      return row
    },
  }

  /** One admin Save: read, claim, one atomic UPDATE, then the in-transaction afterChange. */
  const save = async (patch: Partial<Order>) => {
    const req = { context: {}, payload }
    const originalDoc = { ...row } // Payload's read — may be stale under concurrency
    const data: Record<string, unknown> = { ...patch }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimOrderEmails({ data, originalDoc, operation: 'update', req } as any)
    const previousDoc = { ...row }
    Object.assign(row, data) // the single UPDATE: status + claim together
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendOrderEmails({ doc: row, previousDoc, operation: 'update', req } as any)
  }

  return { row, sent, updates, save }
}

const okSend: SendEmailFn = async () => ({ messageId: '<msg-1@zoho>' })
const neverResolves: SendEmailFn = () => new Promise(() => {})

describe('emailsToClaim', () => {
  it('claims the shipped email on the transition into shipped', () => {
    assert.deepEqual(
      emailsToClaim({ operation: 'update', previousStatus: 'confirmed', nextStatus: 'shipped' }),
      ['shipped'],
    )
  })

  it('claims nothing when the order is already shipped', () => {
    assert.deepEqual(
      emailsToClaim({ operation: 'update', previousStatus: 'shipped', nextStatus: 'shipped' }),
      [],
    )
  })

  it('claims nothing when the shipped email was already sent', () => {
    assert.deepEqual(
      emailsToClaim({
        operation: 'update',
        previousStatus: 'confirmed',
        nextStatus: 'shipped',
        shippedEmailSentAt: '2026-07-01T10:00:00.000Z',
      }),
      [],
    )
  })

  it('still claims confirmation + admin emails on create (Kustom webhook path)', () => {
    assert.deepEqual(emailsToClaim({ operation: 'create', nextStatus: 'confirmed' }), [
      'confirmation',
      'admin',
    ])
  })
})

describe('status change to shipped', () => {
  it('sends exactly one shipping email and stamps the claim atomically', async () => {
    const h = harness(okSend)
    await h.save({ status: 'shipped' })

    assert.equal(h.sent.length, 1)
    assert.equal(h.sent[0].to, 'kunde@example.com')
    assert.ok(h.row.shippedEmailSentAt, 'the claim lands in the same UPDATE as the status')
    assert.equal(h.row.shippedEmailError, null)
    assert.equal(h.row.shippedEmailMessageId, '<msg-1@zoho>')
  })

  it('does not resend when an already-shipped order is saved again', async () => {
    const h = harness(okSend)
    await h.save({ status: 'shipped' })
    await h.save({ notes: 'Pakket i eske' })
    await h.save({ status: 'shipped' })

    assert.equal(h.sent.length, 1, 'ordinary saves never resend')
  })

  it('sends only one email when Save is clicked twice concurrently', async () => {
    const h = harness(okSend)
    await Promise.all([h.save({ status: 'shipped' }), h.save({ status: 'shipped' })])

    assert.equal(h.sent.length, 1, 'the compare-and-set lets exactly one save win')
    assert.ok(h.row.shippedEmailSentAt, 'the loser must not clobber the winner’s claim')
  })

  it('never sends again when the same hook runs a second time on the same order', async () => {
    const h = harness(okSend)
    await h.save({ status: 'shipped' })
    await h.save({ status: 'shipped' })

    assert.equal(h.sent.length, 1)
  })
})

describe('Zoho failure modes', () => {
  it('a slow-but-successful send still completes and marks the order', async () => {
    const slow: SendEmailFn = () =>
      new Promise((resolve) => setTimeout(() => resolve({ messageId: '<slow@zoho>' }), 60))

    const h = harness(slow)
    await h.save({ status: 'shipped' })

    assert.equal(h.sent.length, 1)
    assert.ok(h.row.shippedEmailSentAt)
  })

  it('a hanging Zoho times out, the status still saves, and nothing is marked sent', async () => {
    const h = harness(neverResolves)
    const startedAt = Date.now()
    await h.save({ status: 'shipped' })
    const elapsed = Date.now() - startedAt

    assert.ok(elapsed < 1_000, `the save must not hang (took ${elapsed}ms)`)
    assert.equal(h.row.status, 'shipped', 'the status change still saves')
    assert.equal(h.row.shippedEmailSentAt, null, 'a failed send is never marked as sent')
    assert.match(String(h.row.shippedEmailError), /timed out/i)
  })

  it('a Zoho error is recorded and does not fail the save', async () => {
    const failing: SendEmailFn = async () => {
      throw new Error('535 Authentication Failed')
    }

    const h = harness(failing)
    await h.save({ status: 'shipped' })

    assert.equal(h.row.status, 'shipped')
    assert.equal(h.row.shippedEmailSentAt, null)
    assert.match(String(h.row.shippedEmailError), /Authentication Failed/)
  })

  it('does not auto-retry a failed send on the next ordinary save', async () => {
    let attempts = 0
    const failing: SendEmailFn = async () => {
      attempts += 1
      throw new Error('ETIMEDOUT')
    }

    const h = harness(failing)
    await h.save({ status: 'shipped' })
    await h.save({ notes: 'ny lapp' })
    await h.save({ status: 'shipped' })

    assert.equal(attempts, 1, 'retrying is the explicit resend action’s job, not Save’s')
    assert.equal(h.row.shippedEmailSentAt, null, 'the order stays retryable')
  })

  it('a missing customer email fails the send without failing the save', async () => {
    const h = harness(okSend, { customerInfo: {} })
    await h.save({ status: 'shipped' })

    assert.equal(h.sent.length, 0)
    assert.equal(h.row.status, 'shipped')
    assert.equal(h.row.shippedEmailSentAt, null)
    assert.match(String(h.row.shippedEmailError), /Missing customer email/)
  })
})

describe('transaction safety', () => {
  it('every write-back joins the caller transaction (never opens a second one)', async () => {
    const h = harness(neverResolves)
    await h.save({ status: 'shipped' })

    assert.ok(h.updates.length > 0)
    for (const update of h.updates) {
      assert.equal(
        update.joinedTransaction,
        true,
        'payload.update must receive req — a second transaction deadlocks on the row lock',
      )
    }
  })

  it('the write-back does not re-enter the hooks or send another email', async () => {
    const h = harness(async () => {
      throw new Error('boom') // forces the failure write-back path
    })

    await h.save({ status: 'shipped' }) // throws RECURSION if the guard is broken
    assert.equal(h.sent.length, 1, 'the write-back must not trigger another email')
  })
})

describe('retry after a 504', () => {
  it('a PATCH retried after a rolled-back timeout does not double-send', async () => {
    // First attempt is killed mid-send: the transaction rolls back, so neither the
    // status nor the claim is persisted. Then the admin hits Save again.
    const h = harness(okSend)
    await h.save({ status: 'shipped' })
    assert.equal(h.sent.length, 1)

    await h.save({ status: 'shipped' })
    assert.equal(h.sent.length, 1, 'the committed claim survives the retry')
  })
})
