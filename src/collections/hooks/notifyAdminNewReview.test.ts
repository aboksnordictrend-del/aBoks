import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { CollectionAfterChangeHook } from 'payload'
import type { Review } from '@/payload-types'
import { notifyAdminNewReview } from './notifyAdminNewReview'
import { ADMIN_EMAIL } from '@/lib/orderEmails'

// Keep the structured error log out of the test output.
beforeEach(() => {
  mock.method(console, 'error', () => {})
})

type SentEmail = { to: string; subject: string; html: string; text: string }

const review = (overrides: Partial<Review> = {}): Review =>
  ({
    id: 7,
    rating: 5,
    status: 'pending',
    text: 'Endelig orden i batteriskuffen!',
    customerName: 'Kari N.',
    product: 3,
    productSnapshot: { title: 'aBoks Vegg', variantName: 'Sort', color: 'Sort' },
    photos: null,
    submittedAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    createdAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
  }) as unknown as Review

/** Runs the hook the way Payload does, with a payload stub that records what it was asked to send. */
async function run(
  args: { operation: 'create' | 'update'; doc?: Review },
  sendEmail: (msg: SentEmail) => Promise<unknown> = async () => ({ messageId: 'ok' }),
) {
  const sent: SentEmail[] = []
  const spy = async (msg: SentEmail) => {
    sent.push(msg)
    return sendEmail(msg)
  }

  const hook = notifyAdminNewReview as CollectionAfterChangeHook<Review>
  await hook({
    doc: args.doc ?? review(),
    previousDoc: review(),
    operation: args.operation,
    req: { payload: { sendEmail: spy } },
    collection: { slug: 'reviews' },
    context: {},
  } as unknown as Parameters<CollectionAfterChangeHook<Review>>[0])

  return sent
}

describe('notifyAdminNewReview', () => {
  it('notifies the store when a new review is created', async () => {
    const sent = await run({
      operation: 'create',
      doc: review({ rating: 4, photos: [11, 12] as unknown as Review['photos'] }),
    })

    assert.equal(sent.length, 1)
    const email = sent[0]

    assert.equal(email.to, ADMIN_EMAIL)
    assert.equal(email.subject, 'Ny anmeldelse på aBoks')

    // Everything the store needs to triage the review without opening the panel.
    for (const body of [email.html, email.text]) {
      assert.match(body, /Kari N\./)
      assert.match(body, /★★★★☆/)
      assert.match(body, /4 av 5/)
      assert.match(body, /Endelig orden i batteriskuffen!/)
      assert.match(body, /aBoks Vegg/)
      assert.match(body, /Ja \(2\)/)
      assert.match(body, /\/admin\/collections\/reviews\/7/)
    }
  })

  it('reports no photos when none were uploaded', async () => {
    const sent = await run({ operation: 'create', doc: review({ photos: null }) })
    assert.match(sent[0].text, /Bilder: Nei/)
  })

  it('sends nothing when an existing review is edited', async () => {
    const sent = await run({ operation: 'update', doc: review({ status: 'approved' }) })
    assert.deepEqual(sent, [])
  })

  it('never fails the review creation when the send fails, and logs no customer data', async () => {
    const logged: string[] = []
    mock.method(console, 'error', (line: string) => {
      logged.push(String(line))
    })

    await assert.doesNotReject(
      run({ operation: 'create' }, async () => {
        throw new Error('SMTP unavailable')
      }),
    )

    assert.equal(logged.length, 1)
    const entry = JSON.parse(logged[0])
    assert.deepEqual(entry, {
      scope: 'reviews-admin-email',
      event: 'send-failed',
      reviewId: 7,
      error: 'SMTP unavailable',
    })
    // No customer name, review text or product leaks into the log.
    assert.doesNotMatch(logged[0], /Kari|batteriskuffen/)
  })
})
