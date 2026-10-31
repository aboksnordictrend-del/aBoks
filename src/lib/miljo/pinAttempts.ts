import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { PIN_POLICY } from './constants'

/**
 * Brute-force protection for delivery PINs. Server-only.
 *
 * Every verification first RESERVES an attempt with one atomic UPDATE on the organisation row,
 * and only then compares the PIN. The counter lives in the database, not in memory, so it holds
 * across serverless instances, and because the reservation is a single statement, a burst of
 * parallel requests cannot all read «0 attempts» and slip through. A successful PIN resets the
 * counter; otherwise it resets when its window (counted from the first attempt) expires.
 *
 * With 5 attempts per 15 minutes, a 6-digit PIN needs on average more than two years of
 * uninterrupted guessing. The flip side — someone with the QR link can keep an organisation's
 * delivery form blocked — is accepted: it costs nothing but a short wait, and the administrator
 * can clear the counter.
 */

export interface PinAttemptStore {
  /** Records one attempt; `allowed` is false once the window's budget is spent. */
  reserve(organizationId: number, now: Date): Promise<{ allowed: boolean }>
  /** Clears the counter (after a correct PIN, or by an administrator). */
  reset(organizationId: number): Promise<void>
}

export function attemptAllowed(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= PIN_POLICY.maxAttempts
}

/** When verification opens again, or null when it is open. For the admin display. */
export function pinLockedUntil(
  count: number | null | undefined,
  windowStart: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!windowStart || (count ?? 0) < PIN_POLICY.maxAttempts) return null
  const until = new Date(new Date(windowStart).getTime() + PIN_POLICY.windowMs)
  return until.getTime() > now.getTime() ? until : null
}

type Executor = { execute: (query: unknown) => Promise<unknown> }

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

export function dbPinAttemptStore(payload: Payload): PinAttemptStore {
  const db = (payload.db as unknown as { drizzle?: Executor }).drizzle
  if (!db) throw new Error('No SQL executor available for PIN attempts')
  const windowSeconds = Math.round(PIN_POLICY.windowMs / 1000)

  return {
    async reserve(organizationId, now) {
      const at = now.toISOString()
      const result = await db.execute(
        sql`UPDATE "environmental_organizations"
            SET "pin_attempt_count" = CASE
                  WHEN "pin_attempt_window_start" IS NULL
                    OR "pin_attempt_window_start" <= ${at}::timestamptz - make_interval(secs => ${windowSeconds})
                  THEN 1 ELSE COALESCE("pin_attempt_count", 0) + 1 END,
                "pin_attempt_window_start" = CASE
                  WHEN "pin_attempt_window_start" IS NULL
                    OR "pin_attempt_window_start" <= ${at}::timestamptz - make_interval(secs => ${windowSeconds})
                  THEN ${at}::timestamptz ELSE "pin_attempt_window_start" END
            WHERE "id" = ${organizationId}
            RETURNING "pin_attempt_count" AS "count"`,
      )
      const count = Number(rowsOf(result)[0]?.count ?? NaN)
      return { allowed: attemptAllowed(count) }
    },
    async reset(organizationId) {
      await db.execute(
        sql`UPDATE "environmental_organizations"
            SET "pin_attempt_count" = 0, "pin_attempt_window_start" = NULL
            WHERE "id" = ${organizationId}`,
      )
    },
  }
}
