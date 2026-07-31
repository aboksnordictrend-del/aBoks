// Secure, concurrency-safe persistence for the Pinterest OAuth grant.
//
// Three concerns live here, and they are the three that must not be got wrong:
//
//  1. **Secrecy.** Both tokens are encrypted with AES-256-GCM before they touch PostgreSQL, and
//     their fields declare `read: () => false`, so Payload strips them from every API response
//     and from the admin panel. Only this module ever decrypts, and it hands the plaintext
//     straight to the Pinterest client — never to a response, never to a log.
//
//  2. **Atomic rotation.** Continuous refresh means a successful refresh *invalidates* the old
//     refresh token. If two syncs refreshed concurrently, the loser would persist a token
//     Pinterest has already retired and the connection would silently die. Rotation is
//     therefore a single conditional UPDATE guarded by `token_version` (compare-and-swap):
//     either the whole grant lands and the version advances, or nothing is written and the
//     caller re-reads what the winner stored.
//
//  3. **Mutual exclusion.** The CAS above makes a lost race harmless, but it still costs a
//     wasted refresh — and each wasted refresh burns a rotation. A short, self-expiring row
//     lock (`refresh_lock_expires_at`) means only one process calls Pinterest at a time, while
//     the expiry guarantees a crashed process cannot wedge the integration permanently.
//
// The conditional writes are raw SQL because Payload's `updateGlobal` has no `where` clause and
// therefore cannot express a compare-and-swap. Everything non-critical still goes through
// Payload.

import type { Payload } from 'payload'
import {
  PINTEREST_CONNECTION_GLOBAL,
  type PINTEREST_CONNECTION_STATUSES,
} from '@/globals/PinterestConnection'
import { decryptSecret, encryptSecret, resolveKey } from '@/lib/security/tokenCrypto'
import { checkTokenEncryptionKey, PINTEREST_KEY_ENV } from './config'
import type { PinterestPendingState } from './state'
import type { PinterestTokenGrant } from './tokens'

export type PinterestConnectionStatus = (typeof PINTEREST_CONNECTION_STATUSES)[number]

/**
 * Current storage format. A stored connection carrying a different version is treated as absent
 * everywhere, so the admin must authorize again. Bump this when the authorization contract
 * changes (a different scope set, a different flow).
 */
export const PINTEREST_CONNECTION_VERSION = 1

/** Key-separation label, so this ciphertext can never be decrypted as another integration's. */
const CRYPTO_DOMAIN = 'pinterest-oauth-token'

/** How long a refresh may hold the lock before another process may take it over. */
export const REFRESH_LOCK_SECONDS = 120

/**
 * Physical table backing the global. Only the conditional writes below name it.
 *
 * Column names must match what Payload's Postgres adapter generates, which is
 * `toSnakeCase(field.name)` (@payloadcms/drizzle schema/traverseFields). That is why
 * `lastOAuthError` becomes **`last_o_auth_error`** — the consecutive capitals in "OAuth" each
 * start a word. It looks like a typo and is not one; renaming the column would silently detach
 * it from the field.
 */
const TABLE = 'pinterest_connection'

export class PinterestStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinterestStoreError'
  }
}

/** Raw shape stored on the global. The two `*Encrypted` values never leave this module. */
interface StoredConnection {
  accessTokenEncrypted?: string | null
  refreshTokenEncrypted?: string | null
  accessTokenExpiresAt?: string | null
  refreshTokenExpiresAt?: string | null
  scope?: string | null
  tokenType?: string | null
  connectedAt?: string | null
  lastRefreshedAt?: string | null
  connectionStatus?: string | null
  lastOAuthError?: string | null
  tokenVersion?: number | null
  refreshLockExpiresAt?: string | null
  connectionVersion?: number | null
  pendingStateHash?: string | null
  pendingStateExpiresAt?: string | null
  pendingStateUserId?: string | null
}

/** Everything about the connection that is safe to hand to server code and the status endpoint. */
export interface PinterestConnectionInfo {
  status: PinterestConnectionStatus
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  scope: string | null
  tokenType: string | null
  connectedAt: string | null
  lastRefreshedAt: string | null
  /** Short internal code such as `invalid_grant` — never Pinterest's raw response. */
  lastOAuthError: string | null
  tokenVersion: number
}

/** The connection plus its decrypted tokens. Never returned outside the OAuth/sync internals. */
export interface PinterestCredentials extends PinterestConnectionInfo {
  accessToken: string | null
  refreshToken: string | null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function statusOf(value: unknown): PinterestConnectionStatus {
  return value === 'connected' || value === 'reauthorization_required' ? value : 'disconnected'
}

/**
 * The AES key for this integration.
 *
 * The production requirement is enforced here as well as in `getPinterestOAuthConfig`, and that
 * duplication is deliberate: this is the last point before a token is written or read, so a
 * deployment that lost the variable after connecting fails loudly instead of quietly falling back
 * to a PAYLOAD_SECRET-derived key and writing ciphertext nobody can decrypt later.
 *
 * The thrown message names the variable only — never any key material.
 */
function cryptoKey(env: Record<string, string | undefined> = process.env): Buffer {
  const problem = checkTokenEncryptionKey(env)
  if (problem) throw new PinterestStoreError(problem)
  return resolveKey({
    dedicatedKey: env[PINTEREST_KEY_ENV],
    fallbackSecret: env.PAYLOAD_SECRET,
    domain: CRYPTO_DOMAIN,
  })
}

/** Read the raw global with access control overridden (both token fields are `read: false`). */
async function readGlobal(payload: Payload): Promise<StoredConnection> {
  const doc = await payload.findGlobal({
    slug: PINTEREST_CONNECTION_GLOBAL,
    depth: 0,
    overrideAccess: true,
  })
  return (doc ?? {}) as StoredConnection
}

/** True when the stored connection was written by the current flow. */
function isCurrentVersion(stored: StoredConnection): boolean {
  // A never-written global has no version and no tokens; treat it as current-but-empty so a
  // first connection is not mistaken for a stale one.
  if (stored.connectionVersion == null && !str(stored.accessTokenEncrypted)) return true
  return stored.connectionVersion === PINTEREST_CONNECTION_VERSION
}

function toInfo(stored: StoredConnection): PinterestConnectionInfo {
  return {
    status: statusOf(stored.connectionStatus),
    accessTokenExpiresAt: str(stored.accessTokenExpiresAt),
    refreshTokenExpiresAt: str(stored.refreshTokenExpiresAt),
    scope: str(stored.scope),
    tokenType: str(stored.tokenType),
    connectedAt: str(stored.connectedAt),
    lastRefreshedAt: str(stored.lastRefreshedAt),
    lastOAuthError: str(stored.lastOAuthError),
    tokenVersion: num(stored.tokenVersion),
  }
}

/**
 * Non-secret connection state, safe for the admin UI. Returns a `disconnected` record rather
 * than null when nothing is stored, so callers never have to null-check the state machine.
 */
export async function getConnectionInfo(payload: Payload): Promise<PinterestConnectionInfo> {
  const stored = await readGlobal(payload)
  if (!isCurrentVersion(stored)) {
    return {
      status: 'disconnected',
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      tokenType: null,
      connectedAt: null,
      lastRefreshedAt: null,
      lastOAuthError: null,
      tokenVersion: num(stored.tokenVersion),
    }
  }
  return toInfo(stored)
}

/**
 * Connection state *plus* decrypted tokens. Strictly internal — the return value must never be
 * serialized into a response.
 *
 * A ciphertext that fails authentication (wrong key, tampered row) decrypts to null, which the
 * caller reads as "no credential" and turns into a re-authorization prompt, rather than
 * throwing and breaking the page.
 */
export async function getCredentials(
  payload: Payload,
  env: Record<string, string | undefined> = process.env,
): Promise<PinterestCredentials> {
  const stored = await readGlobal(payload)
  if (!isCurrentVersion(stored)) {
    // A grant stored by an older flow is never reused: it was minted against a different
    // authorization contract, so a fresh "Koble til" is the only way forward.
    return {
      status: 'disconnected',
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      tokenType: null,
      connectedAt: null,
      lastRefreshedAt: null,
      lastOAuthError: null,
      tokenVersion: num(stored.tokenVersion),
      accessToken: null,
      refreshToken: null,
    }
  }

  const info = toInfo(stored)
  const key = cryptoKey(env)
  const access = str(stored.accessTokenEncrypted)
  const refresh = str(stored.refreshTokenEncrypted)
  return {
    ...info,
    accessToken: access ? decryptSecret(access, key) : null,
    refreshToken: refresh ? decryptSecret(refresh, key) : null,
  }
}

// ---------------------------------------------------------------------------------------------
// Pending OAuth state
// ---------------------------------------------------------------------------------------------

/**
 * Store the hashed state for a flow that is starting. Overwrites any previous pending state:
 * only one authorization can be in flight, and the newest click is the one the admin means.
 */
export async function savePendingState(
  payload: Payload,
  pending: PinterestPendingState,
): Promise<void> {
  await payload.updateGlobal({
    slug: PINTEREST_CONNECTION_GLOBAL,
    data: {
      pendingStateHash: pending.hash,
      pendingStateExpiresAt: pending.expiresAt,
      pendingStateUserId: pending.userId,
    },
    overrideAccess: true,
  })
}

/**
 * Read the pending state and clear it in the same step — this is what makes the state one-time.
 *
 * The clear happens *before* the value is verified, deliberately: a second callback carrying the
 * same state then finds nothing to match, whether or not the first one succeeded. The cost of
 * that ordering is that a failed callback requires a fresh "Koble til", which is the correct
 * trade for an anti-replay control.
 */
export async function consumePendingState(
  payload: Payload,
): Promise<PinterestPendingState | null> {
  const stored = await readGlobal(payload)
  const hash = str(stored.pendingStateHash)
  const expiresAt = str(stored.pendingStateExpiresAt)
  const userId = str(stored.pendingStateUserId)

  if (hash || expiresAt || userId) {
    await payload.updateGlobal({
      slug: PINTEREST_CONNECTION_GLOBAL,
      data: {
        pendingStateHash: null,
        pendingStateExpiresAt: null,
        pendingStateUserId: null,
      },
      overrideAccess: true,
    })
  }

  if (!hash || !expiresAt || !userId) return null
  return { hash, expiresAt, userId }
}

// ---------------------------------------------------------------------------------------------
// Writing a grant
// ---------------------------------------------------------------------------------------------

/**
 * Persist a brand-new authorization (the code-exchange path).
 *
 * Not conditional: a fresh authorization is the admin's explicit, deliberate act and must
 * replace whatever was there — including a connection that had gone stale. `tokenVersion` is
 * advanced so any refresh already in flight against the old grant loses its compare-and-swap
 * and cannot overwrite this.
 */
export async function saveNewConnection(
  payload: Payload,
  grant: PinterestTokenGrant,
  connectedAt: string,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const key = cryptoKey(env)
  const stored = await readGlobal(payload)
  await payload.updateGlobal({
    slug: PINTEREST_CONNECTION_GLOBAL,
    data: {
      accessTokenEncrypted: encryptSecret(grant.accessToken, key),
      refreshTokenEncrypted: encryptSecret(grant.refreshToken, key),
      accessTokenExpiresAt: grant.accessTokenExpiresAt,
      refreshTokenExpiresAt: grant.refreshTokenExpiresAt,
      scope: grant.scope,
      tokenType: grant.tokenType,
      connectedAt,
      lastRefreshedAt: connectedAt,
      connectionStatus: 'connected' satisfies PinterestConnectionStatus,
      lastOAuthError: null,
      tokenVersion: num(stored.tokenVersion) + 1,
      refreshLockExpiresAt: null,
      connectionVersion: PINTEREST_CONNECTION_VERSION,
      pendingStateHash: null,
      pendingStateExpiresAt: null,
      pendingStateUserId: null,
    },
    overrideAccess: true,
  })
}

/**
 * Mark the connection as needing a fresh authorization, preserving everything else.
 *
 * The stored tokens are cleared: a refresh token Pinterest has rejected is worthless, and
 * keeping ciphertext that can never be used again is a liability rather than an asset. **No
 * marketing-expense record is touched** — imported spend is business data and outlives any
 * authorization.
 */
export async function markReauthorizationRequired(
  payload: Payload,
  errorCode: string,
): Promise<void> {
  await payload.updateGlobal({
    slug: PINTEREST_CONNECTION_GLOBAL,
    data: {
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      connectionStatus: 'reauthorization_required' satisfies PinterestConnectionStatus,
      // A short internal code only — never Pinterest's raw response, never a token.
      lastOAuthError: errorCode.slice(0, 64),
      refreshLockExpiresAt: null,
    },
    overrideAccess: true,
  })
}

// ---------------------------------------------------------------------------------------------
// Conditional writes (raw SQL — Payload's updateGlobal has no `where`)
// ---------------------------------------------------------------------------------------------

/** Minimal SQL surface these two operations need. Injectable, so tests need no database. */
export interface ConditionalWriter {
  /**
   * Take the refresh lock when it is free or expired. Returns true when this process now owns
   * it. A single UPDATE, so two callers can never both win.
   */
  claimRefreshLock(lockSeconds: number): Promise<boolean>
  /** Release the lock without touching anything else (used when a refresh fails). */
  releaseRefreshLock(): Promise<void>
  /**
   * Compare-and-swap the whole rotated grant. Returns true when `expectedVersion` still matched
   * and the write landed; false when another process rotated first — in which case the caller
   * must re-read rather than retry.
   */
  swapTokens(expectedVersion: number, fields: RotatedFields): Promise<boolean>
}

/** The columns a rotation replaces, already encrypted. */
export interface RotatedFields {
  accessTokenEncrypted: string
  refreshTokenEncrypted: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string | null
  scope: string
  tokenType: string
  lastRefreshedAt: string
}

type SqlRow = Record<string, unknown>

/**
 * Drizzle's `execute` returns a node-postgres QueryResult in most versions and a bare array in
 * some. Normalizing here keeps the two operations above readable.
 */
function rowsOf(result: unknown): SqlRow[] {
  if (Array.isArray(result)) return result as SqlRow[]
  const rows = (result as { rows?: unknown })?.rows
  return Array.isArray(rows) ? (rows as SqlRow[]) : []
}

/**
 * The real writer, backed by the Postgres adapter's drizzle instance.
 *
 * `@payloadcms/db-postgres` is imported lazily so unit tests — which inject their own writer —
 * never load the database driver.
 */
export function createConditionalWriter(payload: Payload): ConditionalWriter {
  const exec = async (build: (sql: typeof import('@payloadcms/db-postgres').sql) => unknown) => {
    const { sql } = await import('@payloadcms/db-postgres')
    const drizzle = (payload.db as unknown as { drizzle?: { execute: (q: unknown) => Promise<unknown> } })
      .drizzle
    if (!drizzle) {
      throw new PinterestStoreError('Databaseadapteren støtter ikke betingede skrivinger.')
    }
    return rowsOf(await drizzle.execute(build(sql)))
  }

  return {
    async claimRefreshLock(lockSeconds: number): Promise<boolean> {
      const rows = await exec(
        (sql) => sql`
          UPDATE ${sql.identifier(TABLE)}
          SET "refresh_lock_expires_at" = now() + make_interval(secs => ${lockSeconds}::double precision),
              "updated_at" = now()
          WHERE "refresh_lock_expires_at" IS NULL OR "refresh_lock_expires_at" < now()
          RETURNING "id"
        `,
      )
      return rows.length > 0
    },

    async releaseRefreshLock(): Promise<void> {
      await exec(
        (sql) => sql`
          UPDATE ${sql.identifier(TABLE)}
          SET "refresh_lock_expires_at" = NULL, "updated_at" = now()
        `,
      )
    },

    async swapTokens(expectedVersion: number, f: RotatedFields): Promise<boolean> {
      const rows = await exec(
        (sql) => sql`
          UPDATE ${sql.identifier(TABLE)}
          SET "access_token_encrypted" = ${f.accessTokenEncrypted},
              "refresh_token_encrypted" = ${f.refreshTokenEncrypted},
              "access_token_expires_at" = ${f.accessTokenExpiresAt}::timestamptz,
              "refresh_token_expires_at" = ${f.refreshTokenExpiresAt}::timestamptz,
              "scope" = ${f.scope},
              "token_type" = ${f.tokenType},
              "last_refreshed_at" = ${f.lastRefreshedAt}::timestamptz,
              "connection_status" = 'connected',
              "last_o_auth_error" = NULL,
              "refresh_lock_expires_at" = NULL,
              "token_version" = COALESCE("token_version", 0) + 1,
              "updated_at" = now()
          -- COALESCE, not a bare comparison: a row written before token_version existed (or by
          -- a path that left it null) must still be swappable, and NULL = 0 is NULL, not false.
          WHERE COALESCE("token_version", 0) = ${expectedVersion}
          RETURNING "token_version"
        `,
      )
      return rows.length > 0
    },
  }
}

/** Encrypt a fresh grant into the column shape `swapTokens` writes. */
export function encryptGrant(
  grant: PinterestTokenGrant,
  refreshedAt: string,
  env: Record<string, string | undefined> = process.env,
): RotatedFields {
  const key = cryptoKey(env)
  return {
    accessTokenEncrypted: encryptSecret(grant.accessToken, key),
    refreshTokenEncrypted: encryptSecret(grant.refreshToken, key),
    accessTokenExpiresAt: grant.accessTokenExpiresAt,
    refreshTokenExpiresAt: grant.refreshTokenExpiresAt,
    scope: grant.scope,
    tokenType: grant.tokenType,
    lastRefreshedAt: refreshedAt,
  }
}
