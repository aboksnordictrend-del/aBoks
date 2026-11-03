import { createHash } from 'node:crypto'
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
