// Secure persistence for the TikTok access token obtained through OAuth.
//
// Why this exists at all: Meta, Google Ads and Pinterest all read their credentials from env
// vars, and TIKTOK_ACCESS_TOKEN is honoured here for exactly that reason. But a real "Koble
// til TikTok" button *produces* a token at runtime, and a Vercel serverless function cannot
// write an env var. Something durable has to hold it, so the token is stored on the
// admin-only `tiktok-connection` global — reusing Payload's own storage rather than inventing
// a credential system, and adding one table rather than a new collection.
//
// Three layers keep it out of reach:
//  1. the global is admin-only (collection-level access), like every other economy object;
//  2. the token field declares `read: () => false`, so Payload strips it from *every* API
//     response and from the admin UI — the value can only be reached by server code that
//     explicitly opts in via `overrideAccess: true`, which is what this module does;
//  3. it is encrypted at rest with AES-256-GCM under a key derived from PAYLOAD_SECRET, so a
//     database dump alone does not yield a live advertising token.
//
// The plaintext token is returned only to the TikTok client, never logged, and never included
// in any status/sync response.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import type { Payload } from 'payload'
import type { TikTokConnectionInfo } from './types'

export const TIKTOK_CONNECTION_GLOBAL = 'tiktok-connection'

/**
 * Current connection format. A stored connection carrying a different version is ignored —
 * `resolveAccessToken` returns null and the card falls back to "Ikke tilkoblet", so the admin
 * must authorize again.
 *
 * Bump this whenever the authorization contract changes (a different scope set, a different
 * connect flow). Version 2 is the Reporting-only flow: `advertiser/info` is no longer part of
 * connecting, so a token minted under version 1 must not be carried over — a fresh
 * authorization is the only way to be certain the token matches the app's current scopes.
 */
export const TIKTOK_CONNECTION_VERSION = 2

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32
/** Fixed, non-secret salt: the secret material is PAYLOAD_SECRET, not this string. */
const KEY_SALT = 'tiktok-access-token-v1'
/** Marks a value as produced by this module, so a plaintext legacy value is recognisable. */
const PREFIX = 'v1'

export class TikTokTokenStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TikTokTokenStoreError'
  }
}

// scrypt is deliberately slow, so the derived key is cached per secret for the process.
const keyCache = new Map<string, Buffer>()

function deriveKey(secret: string): Buffer {
  const cached = keyCache.get(secret)
  if (cached) return cached
  const key = scryptSync(secret, KEY_SALT, KEY_BYTES)
  keyCache.set(secret, key)
  return key
}

function encryptionSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = (env.PAYLOAD_SECRET ?? '').trim()
  if (!secret) {
    throw new TikTokTokenStoreError(
      'PAYLOAD_SECRET mangler, så TikTok-tokenet kan ikke lagres sikkert.',
    )
  }
  return secret
}

/** Encrypt a token for storage: `v1:<iv>:<authTag>:<ciphertext>`, all base64url. */
export function encryptToken(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

/**
 * Decrypt a stored token. Returns null for anything that is not a well-formed, correctly
 * authenticated ciphertext — a tampered or truncated value is treated as "no token" rather
 * than throwing, so a corrupted row degrades to "not connected" instead of breaking the page.
 */
export function decryptToken(stored: string, secret: string): string | null {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) return null
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      deriveKey(secret),
      Buffer.from(parts[1], 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(parts[3], 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return plaintext || null
  } catch {
    // Wrong key (PAYLOAD_SECRET rotated) or tampered ciphertext — GCM authentication failed.
    return null
  }
}

/** The shape stored on the global. `accessTokenEncrypted` never leaves the server. */
interface StoredConnection {
  accessTokenEncrypted?: string | null
  advertiserId?: string | null
  advertiserName?: string | null
  currency?: string | null
  timezone?: string | null
  connectedAt?: string | null
  connectionVersion?: number | null
  metadataAvailable?: boolean | null
  reportingOk?: boolean | null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * True when the stored connection was written by the current flow. An older one is treated as
 * absent everywhere, which is what forces a fresh authorization after a contract change.
 */
function isCurrentVersion(stored: StoredConnection): boolean {
  return stored.connectionVersion === TIKTOK_CONNECTION_VERSION
}

/** Read the raw global with access control overridden (the token field is `read: false`). */
async function readGlobal(payload: Payload): Promise<StoredConnection> {
  const doc = await payload.findGlobal({
    slug: TIKTOK_CONNECTION_GLOBAL,
    depth: 0,
    overrideAccess: true,
  })
  return (doc ?? {}) as StoredConnection
}

/**
 * Non-secret half of the stored connection, safe to return to the admin UI (after masking the
 * advertiser id). Returns null when nothing has been connected yet.
 *
 * A token with no advertiser id is a valid intermediate state: the authorization succeeded
 * but several advertisers were available, so TIKTOK_ADVERTISER_ID still has to pick one. That
 * state is reported, not hidden — otherwise the card would claim the connection failed and
 * invite a pointless re-authorization.
 */
export async function getStoredConnection(
  payload: Payload,
): Promise<TikTokConnectionInfo | null> {
  const stored = await readGlobal(payload)
  // A connection from an older flow is not reported at all — the admin must reconnect.
  if (!isCurrentVersion(stored)) return null
  const advertiserId = str(stored.advertiserId)
  if (!advertiserId && !str(stored.accessTokenEncrypted)) return null
  return {
    advertiserId,
    advertiserName: str(stored.advertiserName),
    currency: str(stored.currency),
    timezone: str(stored.timezone),
    connectedAt: str(stored.connectedAt),
    metadataAvailable: stored.metadataAvailable === true,
    reportingOk: typeof stored.reportingOk === 'boolean' ? stored.reportingOk : null,
  }
}

/** True when a usable stored token exists from the current flow (does not decrypt it). */
export async function hasStoredToken(payload: Payload): Promise<boolean> {
  const stored = await readGlobal(payload)
  return isCurrentVersion(stored) && Boolean(str(stored.accessTokenEncrypted))
}

/**
 * The access token to authenticate TikTok calls with, or null when the integration has not
 * been connected.
 *
 * `TIKTOK_ACCESS_TOKEN` wins when set: it is the same env-first model Meta and Pinterest use,
 * and it lets an operator pin a token without touching the database. Otherwise the stored,
 * OAuth-obtained token is decrypted.
 */
export async function resolveAccessToken(
  payload: Payload,
  envToken: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  if (envToken.trim()) return envToken.trim()
  const stored = await readGlobal(payload)
  // A token stored by an older flow is never reused: it was minted against a different
  // authorization contract, so a fresh "Koble til" is required.
  if (!isCurrentVersion(stored)) return null
  const encrypted = str(stored.accessTokenEncrypted)
  if (!encrypted) return null
  return decryptToken(encrypted, encryptionSecret(env))
}

export interface SaveConnectionInput {
  accessToken: string
  /**
   * Null when the authorization succeeded but the advertiser is still undecided (several
   * were available and none is configured). The token is kept so the advertiser can be
   * chosen without re-authorizing.
   */
  advertiserId: string | null
  advertiserName: string | null
  currency: string | null
  timezone: string | null
  connectedAt: string
  /** False when `advertiser/info` was refused — optional metadata is unavailable. */
  metadataAvailable: boolean
  /** Result of the connect-time report probe; null when it did not run. */
  reportingOk: boolean | null
}

/** Persist a completed authorization. The token is encrypted before it touches the database. */
export async function saveConnection(
  payload: Payload,
  input: SaveConnectionInput,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  await payload.updateGlobal({
    slug: TIKTOK_CONNECTION_GLOBAL,
    data: {
      accessTokenEncrypted: encryptToken(input.accessToken, encryptionSecret(env)),
      advertiserId: input.advertiserId,
      advertiserName: input.advertiserName,
      currency: input.currency,
      timezone: input.timezone,
      connectedAt: input.connectedAt,
      connectionVersion: TIKTOK_CONNECTION_VERSION,
      metadataAvailable: input.metadataAvailable,
      reportingOk: input.reportingOk,
    },
    overrideAccess: true,
  })
}

/**
 * The advertiser this integration should read, or '' when undecided.
 * Env wins over the stored selection, so an operator can repoint the import without
 * reconnecting.
 */
export async function resolveAdvertiserId(
  payload: Payload,
  envAdvertiserId: string,
): Promise<string> {
  if (envAdvertiserId) return envAdvertiserId
  const stored = await readGlobal(payload)
  if (!isCurrentVersion(stored)) return ''
  return str(stored.advertiserId) ?? ''
}
