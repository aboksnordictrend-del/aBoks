// Responsible-person PINs. Server-only (node:crypto).
//
// A PIN is stored only as a salted scrypt hash (Node's built-in memory-hard KDF — no new
// dependency). The encoded form carries its own parameters, so they can be raised later without
// invalidating existing PINs. Comparison is constant-time. Nothing here logs or returns a PIN.
//
// Brute force is handled separately and atomically in the database (./pinAttempts), because a
// 6-digit PIN is only safe behind a hard attempt limit.

import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { PIN_POLICY } from './constants'

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32, saltBytes: 16 } as const

function scrypt(pin: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(pin, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

/** Norwegian message, or null when the PIN has an acceptable form. */
export function validatePinFormat(pin: unknown): string | null {
  if (typeof pin !== 'string' || !/^\d+$/.test(pin)) return 'PIN-koden kan bare inneholde sifre.'
  if (pin.length < PIN_POLICY.minLength || pin.length > PIN_POLICY.maxLength) {
    return `PIN-koden må ha ${PIN_POLICY.minLength}–${PIN_POLICY.maxLength} sifre.`
  }
  if (/^(\d)\1+$/.test(pin)) return 'PIN-koden kan ikke bestå av bare ett siffer.'
  if ('01234567890'.includes(pin) || '09876543210'.includes(pin)) return 'PIN-koden kan ikke være en enkel tallrekke.'
  return null
}

/** A random PIN that also passes `validatePinFormat`. */
export function generatePin(length: number = PIN_POLICY.generatedLength): string {
  for (;;) {
    let pin = ''
    for (let i = 0; i < length; i++) pin += String(randomInt(0, 10))
    if (validatePinFormat(pin) === null) return pin
  }
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SCRYPT.saltBytes)
  const key = await scrypt(pin, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

/** False for a wrong PIN, a missing hash or any malformed stored value. Never throws. */
export async function verifyPin(pin: string, encoded: string | null | undefined): Promise<boolean> {
  if (typeof pin !== 'string' || pin === '' || pin.length > 64 || !encoded) return false
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
  if (![N, r, p].every((v) => Number.isInteger(v) && v > 0) || N > 1 << 20) return false
  try {
    const salt = Buffer.from(parts[4]!, 'base64url')
    const expected = Buffer.from(parts[5]!, 'base64url')
    if (salt.length < 8 || expected.length < 16) return false
    const actual = await scrypt(pin, salt, expected.length, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
