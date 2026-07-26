import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { generateOrderNumber } from './format'

/**
 * Single source of order numbers — for the checkout, the Kustom webhook and manual
 * orders created in the admin panel alike.
 *
 * Numbers come from a dedicated Postgres sequence (`orders_order_number_seq`, created in
 * migration 20260726_090000 and seeded just above the highest number that already
 * existed). `nextval` is atomic and never hands the same value to two callers, which is
 * exactly what "find the highest number and add one" cannot guarantee: two concurrent
 * checkouts would read the same maximum and both try to insert the same number, and one
 * of them would die on the unique index. The sequence also never re-issues a value, so
 * existing orders can never be shadowed by a new one.
 *
 * Gaps are possible (a rolled-back transaction consumes its number) and harmless — the
 * numbers were random before this, so nothing downstream treats them as gapless.
 */

/** The sequence that hands out order numbers. */
export const ORDER_NUMBER_SEQUENCE = 'orders_order_number_seq'

/** 'AB-' + zero-padded 6 digits — the series every existing order already uses. */
export function formatOrderNumber(counter: number): string {
  return `AB-${String(counter).padStart(6, '0')}`
}

type Executor = { execute: (query: unknown) => Promise<unknown> }

/**
 * The pool-level drizzle instance — deliberately NOT the request's transaction. A
 * sequence read is not something that should be rolled back with the surrounding write,
 * and more importantly: if the sequence is missing, the failing statement would abort the
 * caller's transaction and take the whole order creation down with it.
 */
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

/** One atomic `nextval`. Returns null when the adapter exposes no SQL executor. */
async function nextFromSequence(payload: Payload): Promise<string | null> {
  const db = poolExecutor(payload)
  if (!db) return null

  // Bound parameter + ::regclass — the sequence name is never string-interpolated.
  const result = await db.execute(
    sql`SELECT nextval(${ORDER_NUMBER_SEQUENCE}::regclass) AS "counter"`,
  )

  // bigint comes back as a string from node-postgres.
  const counter = Number(rowsOf(result)[0]?.counter)
  if (!Number.isInteger(counter) || counter <= 0) return null

  return formatOrderNumber(counter)
}

/**
 * Fallback for a database where the sequence migration has not run yet: the original
 * random number, but checked against existing orders instead of being used blind.
 * Only reachable on an un-migrated database; the unique index stays the final backstop.
 */
async function nextUnusedRandom(payload: Payload): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateOrderNumber()
    const existing = await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: candidate } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length === 0) return candidate
  }
  return generateOrderNumber()
}

/** Allocate the next unique order number. Never throws — order creation must not depend on it. */
export async function allocateOrderNumber(payload: Payload): Promise<string> {
  try {
    const fromSequence = await nextFromSequence(payload)
    if (fromSequence) return fromSequence
    payload.logger.warn('[orderNumber] no SQL executor for the sequence — falling back to a random number')
  } catch (err) {
    payload.logger.error(
      `[orderNumber] ${ORDER_NUMBER_SEQUENCE} unavailable (${err instanceof Error ? err.message : 'unknown'}) — falling back to a random number`,
    )
  }

  return nextUnusedRandom(payload)
}
