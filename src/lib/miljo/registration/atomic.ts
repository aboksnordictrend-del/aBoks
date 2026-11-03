import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { MILJO_REGISTRATIONS_SLUG } from './constants'

/**
 * The two writes of an activation that must be decided by the DATABASE, not by a read-then-write
 * in the application — so that concurrent requests can never both succeed:
 *
 *   • claimPendingRegistration — `UPDATE … SET status = 'confirmed' WHERE id = ? AND status =
 *     'pending' AND token_expires_at > now()`. Inside the activation transaction the row stays
 *     locked until commit; a second confirmation of the same link waits, re-evaluates the WHERE
 *     and finds nothing to claim.
 *   • linkOrderIfFree — `UPDATE orders SET business_customer_id = ? WHERE id = ? AND
 *     (business_customer_id IS NULL OR business_customer_id = ?)`. One order can never end up with
 *     two companies, whatever runs at the same time.
 *
 * Both run on the request's own transaction connection (the same pattern as @/lib/emailClaim).
 * Without an SQL executor — only the in-memory test database — they fall back to the equivalent
 * read-then-write through the Local API, which is correct for a single caller only.
 */

type Executor = { execute: (query: unknown) => Promise<unknown> }

const isExecutor = (v: unknown): v is Executor => !!v && typeof (v as { execute?: unknown }).execute === 'function'

function executorOf(req: PayloadRequest): Executor | null {
  const adapter = req.payload.db as unknown as { drizzle?: unknown; sessions?: Record<string, { db?: unknown }> }
  const id = req.transactionID
  if (id && typeof id !== 'object') {
    const session = adapter.sessions?.[String(id)]
    if (isExecutor(session?.db)) return session.db
  }
  return isExecutor(adapter.drizzle) ? adapter.drizzle : null
}

/** In-process serialisation for the no-SQL fallback only (tests): one caller at a time per key. */
const fallbackLocks = new Map<string, Promise<unknown>>()
function serialised<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = fallbackLocks.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(run)
  fallbackLocks.set(key, next)
  return next
}

function rowCount(result: unknown): number {
  if (Array.isArray(result)) return result.length
  const rows = (result as { rows?: unknown[] } | null)?.rows
  return Array.isArray(rows) ? rows.length : 0
}

/** True when THIS call moved the registration from pending to confirmed. */
export async function claimPendingRegistration(req: PayloadRequest, id: number | string, now: Date): Promise<boolean> {
  const db = executorOf(req)
  if (db) {
    const result = await db.execute(sql`
      UPDATE "miljo_registrations"
         SET "status" = 'confirmed', "confirmed_at" = ${now.toISOString()}, "updated_at" = now()
       WHERE "id" = ${Number(id)} AND "status" = 'pending' AND "token_expires_at" > ${now.toISOString()}
      RETURNING "id"
    `)
    return rowCount(result) === 1
  }
  return serialised(`registration:${String(id)}`, async () => {
    const current = await req.payload.findByID({ collection: MILJO_REGISTRATIONS_SLUG, id, depth: 0, overrideAccess: true, disableErrors: true, req })
    const doc = current as { status?: unknown; tokenExpiresAt?: unknown } | null
    if (!doc || doc.status !== 'pending' || !(new Date(String(doc.tokenExpiresAt)).getTime() > now.getTime())) return false
    await req.payload.update({
      collection: MILJO_REGISTRATIONS_SLUG,
      id,
      data: { status: 'confirmed', confirmedAt: now.toISOString() } as never,
      overrideAccess: true,
      req,
    })
    return true
  })
}

/** True when the order now belongs to `businessCustomerId` (it was free, or already this company's). */
export async function linkOrderIfFree(req: PayloadRequest, orderId: number | string, businessCustomerId: number | string): Promise<boolean> {
  const db = executorOf(req)
  if (db) {
    const result = await db.execute(sql`
      UPDATE "orders"
         SET "business_customer_id" = ${Number(businessCustomerId)}, "updated_at" = now()
       WHERE "id" = ${Number(orderId)}
         AND ("business_customer_id" IS NULL OR "business_customer_id" = ${Number(businessCustomerId)})
      RETURNING "id"
    `)
    return rowCount(result) === 1
  }
  const order = (await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, disableErrors: true, req })) as {
    businessCustomer?: unknown
  } | null
  if (!order) return false
  const current = order.businessCustomer == null ? null : String(typeof order.businessCustomer === 'object' ? (order.businessCustomer as { id: unknown }).id : order.businessCustomer)
  if (current != null && current !== String(businessCustomerId)) return false
  await req.payload.db.updateOne({ collection: 'orders', id: orderId, data: { businessCustomer: Number(businessCustomerId) }, req } as never)
  return true
}
