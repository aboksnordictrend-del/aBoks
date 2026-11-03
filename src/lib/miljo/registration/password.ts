// Passwords for Miljø accounts chosen during self-registration. Server-only (node:crypto).
//
// The password is chosen BEFORE the e-mail is confirmed, but the account must not exist until it
// is. So the registration keeps only a salted hash — in exactly the format Payload's local auth
// strategy stores and verifies (payload/dist/auth/strategies/local: PBKDF2-SHA256, 25 000
// iterations, 512-byte key, 32 random salt bytes, both hex). On activation the hash and salt are
// moved onto the new account unchanged; the plain password exists only in the one request that
// submitted it, and is never logged.
//
// MiljoBusiness tests sign in with a password stored this way, so a change in Payload's format
// fails the suite instead of locking users out.

import { pbkdf2, randomBytes } from 'node:crypto'

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export const PASSWORD_MESSAGES = {
  length: `Passordet må ha ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} tegn.`,
  composition: 'Passordet må inneholde minst én bokstav og ett tall.',
  mismatch: 'Passordene er ikke like.',
} as const

/** Norwegian message, or null for an acceptable password and matching confirmation. */
export function validateNewPassword(password: unknown, confirmation: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return PASSWORD_MESSAGES.length
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return PASSWORD_MESSAGES.composition
  if (password !== confirmation) return PASSWORD_MESSAGES.mismatch
  return null
}

export interface PayloadPasswordHash {
  salt: string
  hash: string
}

/** Payload-compatible salt + hash for `password`. */
export async function hashPasswordForPayload(password: string): Promise<PayloadPasswordHash> {
  const salt = randomBytes(32).toString('hex')
  const hash = await new Promise<string>((resolve, reject) =>
    pbkdf2(password, salt, 25000, 512, 'sha256', (err, key) => (err ? reject(err) : resolve(key.toString('hex')))),
  )
  return { salt, hash }
}
