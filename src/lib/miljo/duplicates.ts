// Near-duplicate detection for public registrations. Pure apart from its in-memory state.
//
// Retries and double taps are already absorbed by the unique submission key. This catches the
// other case: the same counts sent again from the same network within a couple of minutes — most
// often someone pressing «Registrer flere» and submitting the same numbers. The user is asked
// once; confirming stores the registration with the `possible-duplicate` flag.
//
// The fingerprint holds an HMAC-free SHA-256 of the client IP and is kept in memory only, per
// server instance — best-effort by design, never persisted, never logged.

import { createHash } from 'node:crypto'
import { REGISTRATION_LIMITS } from './constants'
import type { RegistrationLine } from './validation'

export function registrationFingerprint(code: string, clientKey: string, lines: RegistrationLine[]): string {
  const counts = lines.map((l) => `${l.category}:${l.quantity}`).join(',')
  return createHash('sha256').update(`${code}|${clientKey}|${counts}`).digest('base64url')
}

export interface DuplicateTracker {
  seenRecently(fingerprint: string, now: number): boolean
  record(fingerprint: string, now: number): void
}

export function memoryDuplicateTracker(windowMs: number = REGISTRATION_LIMITS.duplicateWindowMs): DuplicateTracker {
  const seen = new Map<string, number>()
  return {
    seenRecently(fingerprint, now) {
      const at = seen.get(fingerprint)
      return at !== undefined && now - at < windowMs
    },
    record(fingerprint, now) {
      seen.set(fingerprint, now)
      if (seen.size > 2000) for (const [k, at] of seen) if (now - at >= windowMs) seen.delete(k)
    },
  }
}

/** Shared tracker for the lifetime of the server instance. */
export const defaultDuplicateTracker: DuplicateTracker = memoryDuplicateTracker()
