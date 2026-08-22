import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { stampOrderReviewInvitationSentAt } from './reviewInvitationDb'

/**
 * The receipt written onto the order after a review invitation has actually been e-mailed.
 *
 * These go through a fake drizzle executor rather than a database: what is worth pinning
 * down is which statement the helper builds and what it reports back, not that Postgres can
 * run an UPDATE. The SQL is read back off drizzle's tagged-template object — `queryChunks`
 * alternates literal `StringChunk`s (whose `value` is an array of strings) with the raw
 * interpolated parameters.
 */

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

function payloadWith(execute: (query: unknown) => Promise<unknown>) {
  const queries: unknown[] = []
  const payload = {
    db: {
      drizzle: {
        execute: async (query: unknown) => {
          queries.push(query)
          return execute(query)
        },
      },
    },
  } as unknown as Payload
  return { payload, queries }
}

const SENT_AT = '2026-08-22T09:30:00.000Z'

describe('stampOrderReviewInvitationSentAt', () => {
  it('updates the order row and reports success', async () => {
    const { payload, queries } = payloadWith(async () => [{ id: 42 }])

    const stamped = await stampOrderReviewInvitationSentAt(payload, 42, SENT_AT)

    assert.equal(stamped, true)
    assert.equal(queries.length, 1)

    const text = sqlText(queries[0])
    assert.match(text, /UPDATE "orders"/)
    assert.match(text, /"review_invitation_sent_at"/)
    assert.match(text, /WHERE "id" = /)
    assert.deepEqual(sqlParams(queries[0]), [SENT_AT, 42])
  })

  it('touches nothing but review_invitation_sent_at', async () => {
    const { payload, queries } = payloadWith(async () => [{ id: 42 }])
    await stampOrderReviewInvitationSentAt(payload, 42, SENT_AT)

    const setClause = sqlText(queries[0]).split('SET')[1].split('WHERE')[0]
    assert.equal(
      (setClause.match(/=/g) ?? []).length,
      1,
      'exactly one assignment — a receipt must not rewrite other order columns',
    )
  })

  it('overwrites unconditionally, so a resend wins', async () => {
    const { payload, queries } = payloadWith(async () => [{ id: 42 }])
    await stampOrderReviewInvitationSentAt(payload, 42, SENT_AT)

    assert.doesNotMatch(
      sqlText(queries[0]),
      /IS NULL/,
      'this is a receipt, not a claim: the last successful send must win',
    )
  })

  it('reports false when the order no longer exists', async () => {
    const { payload } = payloadWith(async () => [])
    assert.equal(await stampOrderReviewInvitationSentAt(payload, 999, SENT_AT), false)
  })

  it('reports false when the adapter exposes no SQL executor', async () => {
    const payload = { db: {} } as unknown as Payload
    assert.equal(await stampOrderReviewInvitationSentAt(payload, 42, SENT_AT), false)
  })

  it('accepts a { rows: [...] } result shape as well as a bare array', async () => {
    const { payload } = payloadWith(async () => ({ rows: [{ id: 42 }] }))
    assert.equal(await stampOrderReviewInvitationSentAt(payload, 42, SENT_AT), true)
  })
})
