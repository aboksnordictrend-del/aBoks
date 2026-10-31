// Reversible, encrypted copy of a delivery PIN — so an ABOKS AS administrator can look up and
// copy the active PIN («Vis PIN»). Server-only (node:crypto via @/lib/security/tokenCrypto).
//
// The scrypt hash in ./pin stays the ONLY thing used to verify a PIN; nothing on the public path
// ever decrypts. This copy exists purely for the admin «Vis PIN» endpoint:
//
//   • AES-256-GCM (authenticated) through the project's tokenCrypto envelope;
//   • key from MILJO_PIN_ENCRYPTION_KEY only — a dedicated 32-byte key kept in the deployment's
//     environment, never in the database or in git. There is deliberately NO PAYLOAD_SECRET
//     fallback: without the key, PINs still work but cannot be shown;
//   • the organisation id is sealed inside the ciphertext, so a value copied onto another
//     organisation's row is rejected;
//   • `openPin` returns null for anything that is not exactly what we wrote.
//
// A database leak alone therefore reveals no PIN; it also takes the server key.

import { decryptSecret, encryptSecret, resolveKey, validateDedicatedKey } from '../security/tokenCrypto'

export const PIN_KEY_ENV = 'MILJO_PIN_ENCRYPTION_KEY'
const DOMAIN = 'miljo-delivery-pin'

export interface PinVaultStatus {
  configured: boolean
  /** Secret-free explanation when not configured. */
  problem: string | null
}

export function pinVaultStatus(env: Record<string, string | undefined> = process.env): PinVaultStatus {
  const raw = env[PIN_KEY_ENV]
  if (raw === undefined || raw.trim() === '') return { configured: false, problem: `${PIN_KEY_ENV} er ikke satt.` }
  const invalid = validateDedicatedKey(raw)
  return invalid ? { configured: false, problem: `${PIN_KEY_ENV}: ${invalid}` } : { configured: true, problem: null }
}

/** The derived key, or null when no valid dedicated key is configured. Never throws. */
export function pinVaultKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  if (!pinVaultStatus(env).configured) return null
  try {
    return resolveKey({ dedicatedKey: env[PIN_KEY_ENV], domain: DOMAIN })
  } catch {
    return null
  }
}

const envelope = (organizationId: number, pin: string) => `miljo-pin:${organizationId}:${pin}`

export function sealPin(pin: string, organizationId: number, key: Buffer): string {
  return encryptSecret(envelope(organizationId, pin), key)
}

/** The PIN, or null for a tampered/foreign/wrong-key/malformed value. */
export function openPin(stored: string | null | undefined, organizationId: number, key: Buffer): string | null {
  if (!stored) return null
  const plain = decryptSecret(stored, key)
  if (!plain) return null
  const prefix = `miljo-pin:${organizationId}:`
  if (!plain.startsWith(prefix)) return null
  const pin = plain.slice(prefix.length)
  return /^\d{6,10}$/.test(pin) ? pin : null
}
