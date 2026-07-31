// Authenticated encryption for credentials stored in PostgreSQL.
//
// AES-256-GCM — an AEAD, so a tampered or truncated ciphertext fails authentication instead of
// decrypting to garbage. Nothing here is bespoke: the construction is Node's own `crypto`, and
// the only project-specific parts are the key derivation and the versioned envelope format.
//
// Key material, in priority order:
//   1. a dedicated 32-byte key (e.g. PINTEREST_TOKEN_ENCRYPTION_KEY), base64 / base64url / hex;
//   2. PAYLOAD_SECRET, stretched with scrypt.
//
// (2) is the fallback because it is the mechanism the project already uses for the TikTok token
// (src/lib/tiktok/tokenStore.ts) and it means an existing deployment keeps working without a new
// env var. (1) is preferred for a *new* credential: rotating PAYLOAD_SECRET then does not
// silently invalidate stored tokens, and the key can be scoped to one integration.
//
// `domain` separates keys per use, so ciphertext written for one integration can never be
// decrypted — or swapped in — by another.
//
// This module is deliberately generic and Payload-free. src/lib/tiktok/tokenStore.ts keeps its
// own equivalent copy on purpose: the TikTok authentication path is out of scope for this
// change and is not touched. A later change can migrate it here.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32
/** Envelope version. Bumped only if the construction itself changes. */
const PREFIX = 'v1'

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenCryptoError'
  }
}

/** scrypt is deliberately slow, so a derived key is cached per (secret, domain) per process. */
const keyCache = new Map<string, Buffer>()

/**
 * Decode a dedicated key. Accepts base64, base64url or hex and requires exactly 32 bytes, so a
 * truncated paste is rejected loudly rather than silently weakening the cipher.
 */
function decodeRawKey(raw: string): Buffer | null {
  const value = raw.trim()
  if (!value) return null

  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, 'hex')

  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    const buf = Buffer.from(value, 'base64')
    if (buf.length === KEY_BYTES) return buf
  }
  return null
}

export interface KeySource {
  /** Raw value of the dedicated key env var, when set. */
  dedicatedKey?: string
  /** Fallback secret (PAYLOAD_SECRET). */
  fallbackSecret?: string
  /** Key separation label, e.g. 'pinterest-oauth-token'. */
  domain: string
}

/**
 * Validate a dedicated key without deriving anything. Returns a safe, secret-free message when
 * the configured value cannot be used, or null when it is fine (including when it is unset —
 * the fallback then applies).
 */
export function validateDedicatedKey(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') return null
  return decodeRawKey(raw)
    ? null
    : 'nøkkelen må være nøyaktig 32 byte, kodet som base64 eller hex (f.eks. `openssl rand -base64 32`)'
}

/**
 * Resolve the 32-byte key for a domain. Throws TokenCryptoError with a safe message when no
 * usable key material exists — never echoes any part of the key.
 */
export function resolveKey({ dedicatedKey, fallbackSecret, domain }: KeySource): Buffer {
  if (dedicatedKey !== undefined && dedicatedKey.trim() !== '') {
    const key = decodeRawKey(dedicatedKey)
    if (!key) {
      throw new TokenCryptoError(
        'Krypteringsnøkkelen er ugyldig: den må være nøyaktig 32 byte, kodet som base64 eller hex.',
      )
    }
    // Still domain-separated, so the same raw key used for two integrations yields two keys.
    const cacheKey = `raw:${domain}:${key.toString('base64')}`
    const cached = keyCache.get(cacheKey)
    if (cached) return cached
    const derived = scryptSync(key, `tokencrypto:${domain}`, KEY_BYTES)
    keyCache.set(cacheKey, derived)
    return derived
  }

  const secret = (fallbackSecret ?? '').trim()
  if (!secret) {
    throw new TokenCryptoError(
      'Ingen krypteringsnøkkel er tilgjengelig, så legitimasjonen kan ikke lagres sikkert.',
    )
  }
  const cacheKey = `secret:${domain}:${secret}`
  const cached = keyCache.get(cacheKey)
  if (cached) return cached
  const derived = scryptSync(secret, `tokencrypto:${domain}`, KEY_BYTES)
  keyCache.set(cacheKey, derived)
  return derived
}

/** Encrypt for storage: `v1:<iv>:<authTag>:<ciphertext>`, all base64url. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    PREFIX,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

/**
 * Decrypt a stored value. Returns null for anything that is not a well-formed, correctly
 * authenticated ciphertext — a tampered value, a value written under a different key, or a
 * plaintext legacy value. Callers treat null as "no credential" rather than crashing, so a
 * corrupted row degrades to "must reconnect" instead of breaking the page.
 */
export function decryptSecret(stored: string, key: Buffer): string | null {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) return null
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parts[1], 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return plaintext || null
  } catch {
    // Wrong key or failed GCM authentication.
    return null
  }
}
