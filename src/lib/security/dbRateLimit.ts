import { createHash, createHmac } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Rate limiting that holds across serverless instances — unlike @/lib/rateLimit, whose in-memory
 * store is per instance. Backed by the `miljo_rate_limits` table (migration 20261103_180000).
 *
 * Every hit is ONE atomic `INSERT … ON CONFLICT DO UPDATE`: a burst of parallel requests cannot all
 * read «0 so far». A fixed window per key starts with the first hit and restarts once it has
 * passed. Keys are stored as SHA-256 hashes, so the table holds no IP address or e-mail.
 *
 * Fails CLOSED: if the database cannot count, the caller is refused — these limits guard
 * registration and sign-in, where an unlimited fallback would be the attack.
 */

export interface RateLimitStore {
  /** Records one hit for `key` in a window of `windowSeconds`; returns the hits in the window. */
  hit(key: string, windowSeconds: number): Promise<number>
}

export interface RateRule {
  key: string
  limit: number
  windowSeconds: number
}

export const hashRateKey = (key: string): string => createHash('sha256').update(key, 'utf8').digest('hex')

type Executor = { execute: (query: unknown) => Promise<unknown> }

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

export function dbRateLimitStore(payload: Payload): RateLimitStore {
  return {
    async hit(key, windowSeconds) {
      const db = (payload.db as unknown as { drizzle?: Executor }).drizzle
      if (!db) throw new Error('No SQL executor for rate limiting')
      const k = hashRateKey(key)
      const result = await db.execute(sql`
        INSERT INTO "miljo_rate_limits" ("key", "window_start", "count") VALUES (${k}, now(), 1)
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "miljo_rate_limits"."window_start" < now() - make_interval(secs => ${windowSeconds})
                         THEN 1 ELSE "miljo_rate_limits"."count" + 1 END,
          "window_start" = CASE WHEN "miljo_rate_limits"."window_start" < now() - make_interval(secs => ${windowSeconds})
                         THEN now() ELSE "miljo_rate_limits"."window_start" END
        RETURNING "count"
      `)
      const count = Number(rowsOf(result)[0]?.count)
      if (!Number.isFinite(count)) throw new Error('Rate limit count unavailable')
      return count
    },
  }
}

// ── Batches ──
//
// The public Miljø forms check several rules per request (per address, per organisation, overall,
// a battery budget). A batch adds a COST to each counter — 1 for a request, the battery count for a
// budget — in ONE `INSERT … SELECT … ON CONFLICT DO UPDATE` statement: one round trip and one
// transaction however many rules there are. Rows are taken in hash order, so two parallel batches
// lock shared keys in the same order and cannot deadlock. `EXCLUDED.count` is the cost being added,
// so no extra column (and no migration) is needed.
//
// Batch keys are HMAC-SHA256 with the server secret rather than a bare hash: a key that contains an
// IPv4 address could otherwise be reversed by hashing all 2³² addresses.

export interface BatchRateLimitStore {
  /** Adds each entry's cost to its counter in one statement; returns the new counts in entry order. */
  hitMany(entries: { key: string; cost: number }[], windowSeconds: number): Promise<number[]>
}

export interface BudgetRule {
  key: string
  limit: number
  /** Added to the counter; defaults to 1. */
  cost?: number
}

/** Windows here and in every other caller are at most an hour; a day of margin is always safe. */
const PRUNE_AFTER = '1 day'
const PRUNE_PROBABILITY = 0.01

export const keyedRateKey = (secret: string, key: string): string => createHmac('sha256', secret).update(key, 'utf8').digest('hex')

export function dbBatchRateLimitStore(payload: Payload, random: () => number = Math.random): BatchRateLimitStore {
  const secret = (payload as unknown as { secret?: string }).secret
  return {
    async hitMany(entries, windowSeconds) {
      const db = (payload.db as unknown as { drizzle?: Executor }).drizzle
      if (!db) throw new Error('No SQL executor for rate limiting')
      if (entries.length === 0) return []
      if (!secret) throw new Error('No secret for rate-limit keys')
      const hashed = entries.map((e) => ({ k: keyedRateKey(secret, e.key), cost: Math.max(0, Math.trunc(e.cost)) }))
      const rows = sql.join(
        [...hashed].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).map((e) => sql`(${e.k}::varchar, ${e.cost}::integer)`),
        sql`, `,
      )
      const result = await db.execute(sql`
        INSERT INTO "miljo_rate_limits" AS t ("key", "window_start", "count")
        SELECT v.k, now(), v.cost FROM (VALUES ${rows}) AS v(k, cost) ORDER BY v.k
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN t."window_start" < now() - make_interval(secs => ${windowSeconds})
                         THEN EXCLUDED."count" ELSE t."count" + EXCLUDED."count" END,
          "window_start" = CASE WHEN t."window_start" < now() - make_interval(secs => ${windowSeconds})
                         THEN now() ELSE t."window_start" END
        RETURNING "key", "count"
      `)
      const byKey = new Map(rowsOf(result).map((r) => [String(r.key), Number(r.count)]))
      const counts = hashed.map((e) => byKey.get(e.k))
      if (counts.some((c) => c === undefined || !Number.isFinite(c))) throw new Error('Rate limit count unavailable')

      // Expired windows are dead weight; about one batch in a hundred clears them. Best effort.
      if (random() < PRUNE_PROBABILITY) {
        await db
          .execute(sql`DELETE FROM "miljo_rate_limits" WHERE "window_start" < now() - ${PRUNE_AFTER}::interval`)
          .catch(() => undefined)
      }
      return counts as number[]
    },
  }
}

export type BudgetOutcome = 'ok' | 'limited' | 'unavailable'

/**
 * Counts rules tier by tier — one statement per tier — and reports whether all are within their
 * limit. A later tier is counted only when every earlier tier passed, so the requester's own rules
 * go first and shared ones (an organisation, everyone) after: a client that is already over its
 * own limit can hammer on without pushing the shared counters towards a lockout for others.
 * A failing store is `unavailable`, never `ok`: the caller refuses, as with `withinLimits`.
 */
export async function withinBudget(store: BatchRateLimitStore, windowSeconds: number, tiers: BudgetRule[][]): Promise<BudgetOutcome> {
  try {
    for (const rules of tiers) {
      if (rules.length === 0) continue
      const counts = await store.hitMany(
        rules.map((r) => ({ key: r.key, cost: r.cost ?? 1 })),
        windowSeconds,
      )
      if (!counts.every((count, i) => count <= rules[i]!.limit)) return 'limited'
    }
    return 'ok'
  } catch {
    return 'unavailable'
  }
}

/** For tests (and only tests): batch semantics in memory. */
export function memoryBatchRateLimitStore(now: () => number = Date.now): BatchRateLimitStore & { reset(): void; count(key: string): number } {
  const buckets = new Map<string, { start: number; count: number }>()
  return {
    async hitMany(entries, windowSeconds) {
      const t = now()
      return entries.map(({ key, cost }) => {
        const b = buckets.get(key)
        if (!b || b.start < t - windowSeconds * 1000) {
          buckets.set(key, { start: t, count: cost })
          return cost
        }
        b.count += cost
        return b.count
      })
    },
    reset() {
      buckets.clear()
    },
    count(key) {
      return buckets.get(key)?.count ?? 0
    },
  }
}

/** For tests (and only tests): the same semantics in memory. */
export function memoryRateLimitStore(now: () => number = Date.now): RateLimitStore & { reset(): void } {
  const buckets = new Map<string, { start: number; count: number }>()
  return {
    async hit(key, windowSeconds) {
      const t = now()
      const b = buckets.get(key)
      if (!b || b.start < t - windowSeconds * 1000) {
        buckets.set(key, { start: t, count: 1 })
        return 1
      }
      b.count += 1
      return b.count
    },
    reset() {
      buckets.clear()
    },
  }
}

/** True when every rule is within its limit. Each rule is counted even if an earlier one failed. */
export async function withinLimits(store: RateLimitStore, rules: RateRule[]): Promise<boolean> {
  try {
    const counts = await Promise.all(rules.map((r) => store.hit(r.key, r.windowSeconds)))
    return counts.every((count, i) => count <= rules[i]!.limit)
  } catch {
    return false
  }
}
