import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { toOere } from '@/lib/money'
import type { PayoutCandidateAdjustment, PayoutCandidateSale } from './referral'

/**
 * Row locks for referral payouts — the part of the accounting that must hold under concurrency.
 *
 * ── Why row locks here, when the promo payout deliberately has none ──
 *
 * A promo payout records an AMOUNT against a balance; a second concurrent one is recoverable.
 * A referral payout records WHICH SALES it paid. Two concurrent payouts covering the same sale
 * would each believe they paid it, and Payload's read-then-write cannot see the other one. So
 * both sides take `SELECT … FOR UPDATE` on the request's own transaction:
 *
 *   • the payout endpoint locks the selected sales and the partner's outstanding adjustments
 *     before deciding anything. A second payout for an overlapping selection blocks, then
 *     re-reads the committed rows, finds them paid, and is refused;
 *   • a refund or cancellation locks its sale row before reading whether it was paid out, so a
 *     refund racing a payout always sees the committed payout and creates its clawback.
 *
 * Rows are locked in id order, so two requests can never deadlock on each other.
 *
 * Every statement runs on the drizzle session bound to `req.transactionID`. Without one there is
 * no lock to take, so these return `null` and the callers refuse (payout) or fall back to the
 * stored document (sale update) — never a silent unlocked write.
 *
 * Column names follow Payload's snake_case mapping of the field names (`@payloadcms/drizzle`).
 */

type Executor = { execute: (query: unknown) => Promise<unknown> }

/** The drizzle session bound to this request's transaction, or null when there is none. */
export function transactionExecutor(req: PayloadRequest): Executor | null {
  const adapter = req.payload.db as unknown as { sessions?: Record<string, { db?: Executor }> }
  const id = req.transactionID
  if (!id || typeof id === 'object') return null
  return adapter?.sessions?.[String(id)]?.db ?? null
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

const intOrNull = (value: unknown): number | null => {
  if (value == null) return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

/** `numeric` arrives as a string from a raw query. Kroner → øre, or null when unreadable. */
export const numericToOere = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? toOere(n) : null
}

/** Locks the given sales and returns them as they stand now. Null without a transaction. */
export async function lockSalesForPayout(
  req: PayloadRequest,
  saleIds: readonly number[],
): Promise<PayoutCandidateSale[] | null> {
  const db = transactionExecutor(req)
  if (!db) return null
  if (saleIds.length === 0) return []
  const ids = sql.join(saleIds.map((id) => sql`${id}`), sql`, `)
  const rows = rowsOf(
    await db.execute(sql`
      SELECT "id", "partner_id", "payment_status", "commission_status", "payout_id", "commission_amount"
      FROM "referral_sales"
      WHERE "id" IN (${ids})
      ORDER BY "id"
      FOR UPDATE
    `),
  )
  return rows.map((row) => ({
    id: Number(row.id),
    partnerId: intOrNull(row.partner_id),
    paymentStatus: row.payment_status,
    commissionStatus: row.commission_status,
    payoutId: intOrNull(row.payout_id),
    commissionAmountOere: numericToOere(row.commission_amount),
  }))
}

/** Locks and returns every adjustment of the partner not yet deducted. Null without a transaction. */
export async function lockOutstandingAdjustments(
  req: PayloadRequest,
  partnerId: number,
): Promise<PayoutCandidateAdjustment[] | null> {
  const db = transactionExecutor(req)
  if (!db) return null
  const rows = rowsOf(
    await db.execute(sql`
      SELECT "id", "amount"
      FROM "referral_commission_adjustments"
      WHERE "partner_id" = ${partnerId} AND "settled_by_payout_id" IS NULL
      ORDER BY "id"
      FOR UPDATE
    `),
  )
  return rows.map((row) => ({ id: Number(row.id), amountOere: numericToOere(row.amount) }))
}

/**
 * Locks one sale and returns its committed payout link, for a payment-status change. Null when
 * there is no transaction (the caller then uses the stored document).
 */
export async function lockSalePayoutLink(
  req: PayloadRequest,
  saleId: number | string,
): Promise<{ payoutId: number | null } | null> {
  const db = transactionExecutor(req)
  if (!db) return null
  const rows = rowsOf(
    await db.execute(sql`SELECT "payout_id" FROM "referral_sales" WHERE "id" = ${Number(saleId)} FOR UPDATE`),
  )
  return { payoutId: rows.length > 0 ? intOrNull(rows[0].payout_id) : null }
}
