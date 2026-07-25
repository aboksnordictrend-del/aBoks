/**
 * Minimal rate-limit abstraction for the public review endpoints (token check, review
 * submit, photo upload).
 *
 * IMPORTANT (production): the default store is in-memory. On Vercel every serverless
 * invocation may run in a fresh isolate, so an in-memory counter is per-instance and is
 * NOT a reliable limiter on its own. It is a best-effort speed bump only.
 *
 * To make this a real production limiter, connect a shared store (Upstash Redis or Vercel
 * KV) by implementing `RateLimitStore` and passing it to `rateLimit`. The intended wiring:
 *
 *   const store = new UpstashRateLimitStore(process.env.UPSTASH_REDIS_REST_URL!, …)
 *   await rateLimit({ key, limit, windowMs, store })
 *
 * The submission flow is already protected by the secret one-time token; this limiter is
 * defence in depth against automated hammering of the check/upload endpoints.
 */

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Milliseconds until the window resets. */
  resetMs: number
}

export interface RateLimitStore {
  /** Increments the counter for `key`, returning the new count and the window reset time. */
  hit(key: string, windowMs: number): Promise<{ count: number; resetMs: number }>
}

/** Per-instance in-memory store. Best-effort only — see the file header. */
class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>()

  async hit(key: string, windowMs: number): Promise<{ count: number; resetMs: number }> {
    const now = Date.now()
    const existing = this.buckets.get(key)
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs
      this.buckets.set(key, { count: 1, resetAt })
      this.sweep(now)
      return { count: 1, resetMs: windowMs }
    }
    existing.count += 1
    return { count: existing.count, resetMs: existing.resetAt - now }
  }

  /** Drops expired buckets so the map cannot grow unbounded on a long-lived instance. */
  private sweep(now: number): void {
    if (this.buckets.size < 512) return
    for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k)
  }
}

/** Shared default store for the lifetime of the isolate. */
export const defaultRateLimitStore: RateLimitStore = new MemoryRateLimitStore()

export interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
  store?: RateLimitStore
}

/** Records one hit and reports whether the caller is within the limit. Never throws. */
export async function rateLimit({
  key,
  limit,
  windowMs,
  store = defaultRateLimitStore,
}: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const { count, resetMs } = await store.hit(key, windowMs)
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetMs }
  } catch {
    // A failing limiter must never block a legitimate submission.
    return { ok: true, remaining: limit, resetMs: windowMs }
  }
}

/** Best-effort client IP from the standard proxy headers Vercel sets. */
export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
