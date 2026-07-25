import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Server-only SQL for the atomic invitation lifecycle (spec §9.12, §16). Split out of
 * @/lib/reviews so that pure module can be imported from client components without pulling
 * the Postgres adapter into the browser bundle.
 *
 * These use single-statement compare-and-set UPDATEs on the connection pool, which are
 * atomic on their own — exactly what prevents a double-submit from consuming a token twice.
 */

type Executor = { execute: (query: unknown) => Promise<unknown> }

function poolExecutor(payload: Payload): Executor | null {
  const adapter = payload.db as unknown as { drizzle?: Executor }
  return adapter.drizzle ?? null
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/**
 * Compare-and-set that marks an active invitation as used. Exactly one concurrent caller
 * can win: the UPDATE ... WHERE used_at IS NULL AND status='active' returns a row only for
 * the first, so a double-submit cannot consume the token twice or create two reviews.
 *
 * Returns true when THIS call won the claim.
 */
export async function claimInvitationUsed(
  payload: Payload,
  invitationId: number | string,
  usedAt: string,
): Promise<boolean> {
  const db = poolExecutor(payload)
  if (!db) throw new Error('No SQL executor available to claim invitation')

  const claimed = await db.execute(
    sql`UPDATE "review_invitations"
        SET "used_at" = ${usedAt}::timestamptz, "status" = 'used'
        WHERE "id" = ${invitationId} AND "used_at" IS NULL AND "status" = 'active'
        RETURNING "id"`,
  )
  return rowsOf(claimed).length === 1
}

/** Releases a claim (used_at → null, status → active) if a later step failed. Best-effort. */
export async function releaseInvitationClaim(
  payload: Payload,
  invitationId: number | string,
): Promise<void> {
  const db = poolExecutor(payload)
  if (!db) return
  try {
    await db.execute(
      sql`UPDATE "review_invitations"
          SET "used_at" = NULL, "status" = 'active'
          WHERE "id" = ${invitationId} AND "status" = 'used' AND "review_id" IS NULL`,
    )
  } catch {
    /* best-effort rollback of the claim */
  }
}

/**
 * Revokes any currently-active invitation for an order (used by the controlled resend, so
 * the previous link stops working). Returns the number of rows revoked.
 */
export async function revokeActiveInvitationsForOrder(
  payload: Payload,
  orderId: number | string,
): Promise<number> {
  const db = poolExecutor(payload)
  if (!db) return 0
  const revoked = await db.execute(
    sql`UPDATE "review_invitations"
        SET "status" = 'revoked'
        WHERE "order_id" = ${orderId} AND "status" = 'active'
        RETURNING "id"`,
  )
  return rowsOf(revoked).length
}
