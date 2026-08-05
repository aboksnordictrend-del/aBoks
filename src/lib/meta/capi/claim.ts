// Single-send guarantee for the server-side Purchase event.
//
// ── Why a compare-and-set and not `if (!sentAt) send()` ──
//
// Kustom re-delivers the push webhook until it gets a 2xx, and two deliveries can overlap.
// Read-then-decide-then-write loses that race: both handlers read `null`, both decide to
// send, and Meta gets the conversion twice. `UPDATE … WHERE meta_purchase_sent_at IS NULL`
// cannot — the second statement blocks on the row lock, re-evaluates its WHERE against the
// committed row, and comes back with no rows. Exactly one handler is allowed to send.
//
// This is the same mechanism the order e-mails use (see @/lib/emailClaim); it is repeated
// here rather than shared because that helper is bound to a PayloadRequest and its whitelist
// of e-mail columns, and this runs from a route handler that has no `req`.
//
// ── Claim vs. sent ──
//
// `meta_purchase_sent_at` is the *claim*: it is stamped before the call so nothing else can
// start one, and it is cleared again if the call fails, which is what keeps a genuine failure
// retryable on Kustom's next delivery. `meta_purchase_event_id` is the *receipt*: it is
// written only after Meta has accepted the event, so it — not the timestamp — is the answer
// to "did this order's Purchase reach Meta".

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

type Executor = { execute: (query: unknown) => Promise<unknown> }

/** The three operations the send flow needs, so tests can substitute an in-memory store. */
export interface MetaPurchaseClaimStore {
  /** True when this caller won the right to send. */
  claim(orderId: number | string, claimedAt: string): Promise<boolean>
  /** Records the receipt after Meta accepted the event. */
  markSent(orderId: number | string, eventId: string, sentAt: string): Promise<void>
  /** Releases an unsuccessful claim so a later delivery can retry. */
  release(orderId: number | string): Promise<void>
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/**
 * The drizzle instance on the Postgres adapter. There is no request transaction to join here
 * — the webhook has already committed the order through the Local API — so a single
 * `UPDATE … WHERE` on the pool is atomic on its own.
 */
function getExecutor(payload: Payload): Executor | null {
  const adapter = payload.db as unknown as { drizzle?: Executor }
  return adapter.drizzle ?? null
}

/** Null when the adapter exposes no SQL executor (a non-Postgres or stubbed database). */
export function createMetaPurchaseClaimStore(payload: Payload): MetaPurchaseClaimStore | null {
  const db = getExecutor(payload)
  if (!db) return null

  return {
    async claim(orderId, claimedAt) {
      const claimed = await db.execute(
        sql`UPDATE "orders" SET "meta_purchase_sent_at" = ${claimedAt}::timestamptz
            WHERE "id" = ${orderId} AND "meta_purchase_sent_at" IS NULL
            RETURNING "id"`,
      )
      return rowsOf(claimed).length === 1
    },

    async markSent(orderId, eventId, sentAt) {
      await db.execute(
        sql`UPDATE "orders"
            SET "meta_purchase_event_id" = ${eventId},
                "meta_purchase_sent_at" = ${sentAt}::timestamptz
            WHERE "id" = ${orderId}`,
      )
    },

    async release(orderId) {
      // Guarded on the receipt: if some other delivery succeeded in the meantime, its
      // timestamp must survive this one's rollback.
      await db.execute(
        sql`UPDATE "orders" SET "meta_purchase_sent_at" = NULL
            WHERE "id" = ${orderId} AND "meta_purchase_event_id" IS NULL`,
      )
    },
  }
}
