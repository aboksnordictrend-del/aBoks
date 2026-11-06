import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { MILJO_REGISTRATIONS_SLUG } from './constants'

/**
 * The writes of the registration flow that must be decided by the DATABASE, not by a read-then-write
 * in the application — so that concurrent requests can never both succeed:
 *
 *   • claimEmailConfirmation — `UPDATE … SET status = 'awaiting_approval' WHERE id = ? AND status =
 *     'pending' AND token_expires_at > now()`. A second confirmation of the same link finds nothing.
 *   • claimDecision — `UPDATE … SET status = 'confirmed' | 'rejected' … WHERE id = ? AND status =
 *     'awaiting_approval'`. Inside the decision transaction the row stays locked until commit; a
 *     second approval waits, re-evaluates the WHERE and finds nothing to claim, so one registration
 *     can never activate twice, and an approval and a rejection can never both win.
 *   • linkOrderIfFree — `UPDATE orders SET business_customer_id = ? WHERE id = ? AND
 *     (business_customer_id IS NULL OR business_customer_id = ?)`. One order can never end up with
 *     two companies, whatever runs at the same time.
 *
 * All run on the request's own transaction connection (the same pattern as @/lib/emailClaim).
 * Without an SQL executor — only the in-memory test database — they fall back to the equivalent
 * read-then-write through the Local API, which is correct for a single caller only.
 */

type Executor = { execute: (query: unknown) => Promise<unknown> }

const isExecutor = (v: unknown): v is Executor => !!v && typeof (v as { execute?: unknown }).execute === 'function'

export function executorOf(req: PayloadRequest): Executor | null {
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
export function serialised<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = fallbackLocks.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(run)
  fallbackLocks.set(key, next)
  return next
}

export function rowCount(result: unknown): number {
  if (Array.isArray(result)) return result.length
  const rows = (result as { rows?: unknown[] } | null)?.rows
  return Array.isArray(rows) ? rows.length : 0
}

/** True when THIS call moved the registration from pending to awaiting approval. */
export async function claimEmailConfirmation(req: PayloadRequest, id: number | string, now: Date): Promise<boolean> {
  const db = executorOf(req)
  if (db) {
    const result = await db.execute(sql`
      UPDATE "miljo_registrations"
         SET "status" = 'awaiting_approval', "confirmed_at" = ${now.toISOString()}, "resend_key_hash" = NULL, "updated_at" = now()
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
      data: { status: 'awaiting_approval', confirmedAt: now.toISOString(), resendKeyHash: null } as never,
      overrideAccess: true,
      req,
    })
    return true
  })
}

export interface DecisionClaim {
  outcome: 'confirmed' | 'rejected'
  decidedAt: Date
  decidedById: number | string | null
  decidedByLabel: string
  verificationMethod: string | null
  decisionNote: string | null
}

/** True when THIS call decided the registration. Only a registration awaiting approval can be. */
export async function claimDecision(req: PayloadRequest, id: number | string, claim: DecisionClaim): Promise<boolean> {
  const db = executorOf(req)
  if (db) {
    const status = claim.outcome === 'confirmed' ? sql`'confirmed'` : sql`'rejected'`
    const decidedBy = claim.decidedById == null ? null : Number(claim.decidedById)
    const result = await db.execute(sql`
      UPDATE "miljo_registrations"
         SET "status" = ${status}, "decided_at" = ${claim.decidedAt.toISOString()}, "decided_by_id" = ${decidedBy},
             "decided_by_label" = ${claim.decidedByLabel}, "verification_method" = ${claim.verificationMethod},
             "decision_note" = ${claim.decisionNote}, "updated_at" = now()
       WHERE "id" = ${Number(id)} AND "status" = 'awaiting_approval'
      RETURNING "id"
    `)
    return rowCount(result) === 1
  }
  return serialised(`registration:${String(id)}`, async () => {
    const current = await req.payload.findByID({ collection: MILJO_REGISTRATIONS_SLUG, id, depth: 0, overrideAccess: true, disableErrors: true, req })
    if ((current as { status?: unknown } | null)?.status !== 'awaiting_approval') return false
    await req.payload.update({
      collection: MILJO_REGISTRATIONS_SLUG,
      id,
      data: {
        status: claim.outcome,
        decidedAt: claim.decidedAt.toISOString(),
        decidedBy: claim.decidedById,
        decidedByLabel: claim.decidedByLabel,
        verificationMethod: claim.verificationMethod,
        decisionNote: claim.decisionNote,
      } as never,
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
