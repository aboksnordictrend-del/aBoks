import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import type { ClaimableEmail } from './orderEmails'

/** Whitelisted column per email kind — never interpolate anything else as an identifier. */
const COLUMN: Record<ClaimableEmail, string> = {
  confirmation: 'confirmation_email_sent_at',
  admin: 'admin_email_sent_at',
  shipped: 'shipped_email_sent_at',
  receipt: 'receipt_email_sent_at',
}

type Executor = { execute: (query: unknown) => Promise<unknown> }

/**
 * The drizzle instance bound to *this request's* transaction, so the claim runs on
 * the same connection as the surrounding write. That is what makes it deadlock-free:
 * a transaction cannot block on a lock it holds itself. Falls back to the pool when
 * the request has no transaction (e.g. the manual resend endpoint), where a single
 * UPDATE ... WHERE is atomic on its own.
 */
function getExecutor(req: PayloadRequest): Executor | null {
  const adapter = req.payload.db as unknown as {
    drizzle?: Executor
    sessions?: Record<string, { db?: Executor }>
  }

  const transactionID = req.transactionID
  if (transactionID && typeof transactionID !== 'object') {
    const session = adapter.sessions?.[String(transactionID)]
    if (session?.db) return session.db
  }

  return adapter.drizzle ?? null
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

export type ClaimResult = {
  /** Kinds this request won the right to send. */
  granted: ClaimableEmail[]
  /**
   * Authoritative sentinel value per kind, as it now stands in the row. Callers must
   * write these back into the document data: Payload's update writes the *whole* row
   * from its own (possibly stale) read, so without this a losing request would clobber
   * the winner's claim back to null and let a later save resend the email.
   */
  values: Partial<Record<ClaimableEmail, string | null>>
  /** False when no SQL executor was available and the caller must fall back. */
  atomic: boolean
}

/**
 * Atomically claims each email kind with a compare-and-set:
 *
 *   UPDATE orders SET <col> = now WHERE id = $1 AND <col> IS NULL RETURNING <col>
 *
 * A concurrent save (a double-clicked Save, a retried webhook) blocks on the row lock
 * inside this statement, then re-evaluates the WHERE against the committed row — so
 * exactly one request gets a row back, and only that one sends. Payload's own
 * read-modify-write cannot do this: it SELECTs, decides in JS, then UPDATEs, and both
 * requests would read `null` while the winner is still busy talking to Zoho.
 */
export async function claimEmailsAtomically(
  req: PayloadRequest,
  orderId: number | string,
  kinds: ClaimableEmail[],
  claimedAt: string,
): Promise<ClaimResult> {
  const db = getExecutor(req)
  if (!db) return { granted: [], values: {}, atomic: false }

  const granted: ClaimableEmail[] = []
  const values: Partial<Record<ClaimableEmail, string | null>> = {}

  for (const kind of kinds) {
    const column = sql.raw(`"${COLUMN[kind]}"`)

    const claimed = await db.execute(
      sql`UPDATE "orders" SET ${column} = ${claimedAt}::timestamptz
          WHERE "id" = ${orderId} AND ${column} IS NULL
          RETURNING ${column} AS "claimed_at"`,
    )

    if (rowsOf(claimed).length === 1) {
      granted.push(kind)
      values[kind] = claimedAt
      continue
    }

    // Lost the race (or already sent). Read back the winner's value so we write it
    // straight back instead of nulling it out.
    const current = await db.execute(
      sql`SELECT ${column} AS "claimed_at" FROM "orders" WHERE "id" = ${orderId}`,
    )
    const existing = rowsOf(current)[0]?.claimed_at
    values[kind] =
      existing instanceof Date
        ? existing.toISOString()
        : existing != null
          ? String(existing)
          : null
  }

  return { granted, values, atomic: true }
}
