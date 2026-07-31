import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PgDialect } from 'drizzle-orm/pg-core'
import toSnakeCase from 'to-snake-case'
import type { Payload } from 'payload'
import { PinterestConnection } from '@/globals/PinterestConnection'
import { createConditionalWriter, type RotatedFields } from './store'

// The refresh lock and the token compare-and-swap are the two writes Payload cannot express
// (`updateGlobal` has no `where` clause), so they are hand-written SQL. That buys atomicity at
// the cost of a hard dependency on Payload's own column naming — and Payload derives column
// names with `toSnakeCase(field.name)` (@payloadcms/drizzle, schema/traverseFields), which turns
// `lastOAuthError` into `last_o_auth_error` and would turn a renamed field into a silent no-op.
//
// These tests render the real SQL and check it against the global's field list, so a rename or a
// typo fails here instead of in production, where a swap that matches zero rows looks exactly
// like a lost race.

const dialect = new PgDialect()

/** Capture the SQL the writer would send, without a database. */
function captureSql(): { writer: ReturnType<typeof createConditionalWriter>; queries: string[] } {
  const queries: string[] = []
  const payload = {
    db: {
      drizzle: {
        execute: async (q: unknown) => {
          queries.push(dialect.sqlToQuery(q as Parameters<PgDialect['sqlToQuery']>[0]).sql)
          return { rows: [{ id: 1 }] }
        },
      },
    },
  } as unknown as Payload
  return { writer: createConditionalWriter(payload), queries }
}

const ROTATED: RotatedFields = {
  accessTokenEncrypted: 'v1:a:b:c',
  refreshTokenEncrypted: 'v1:d:e:f',
  accessTokenExpiresAt: '2026-08-31T12:00:00.000Z',
  refreshTokenExpiresAt: '2027-08-01T12:00:00.000Z',
  scope: 'ads:read',
  tokenType: 'bearer',
  lastRefreshedAt: '2026-08-01T12:00:00.000Z',
}

/** Column name Payload's Postgres adapter generates for a field on the global. */
function columnFor(fieldName: string): string {
  const exists = PinterestConnection.fields.some(
    (f) => 'name' in f && (f as { name: string }).name === fieldName,
  )
  assert.ok(exists, `field ${fieldName} is missing from the pinterest-connection global`)
  return toSnakeCase(fieldName)
}

describe('pinterest connection — conditional SQL matches Payload’s column names', () => {
  it('locks on the column Payload generates for refreshLockExpiresAt', async () => {
    const { writer, queries } = captureSql()
    await writer.claimRefreshLock(120)
    assert.equal(queries.length, 1)
    assert.ok(queries[0].includes(`"${columnFor('refreshLockExpiresAt')}"`))
    assert.ok(queries[0].includes('"pinterest_connection"'))
  })

  it('swaps every token column under a token_version guard', async () => {
    const { writer, queries } = captureSql()
    await writer.swapTokens(3, ROTATED)
    const q = queries[0]

    for (const field of [
      'accessTokenEncrypted',
      'refreshTokenEncrypted',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
      'scope',
      'tokenType',
      'lastRefreshedAt',
      'connectionStatus',
      'lastOAuthError',
      'refreshLockExpiresAt',
      'tokenVersion',
    ]) {
      assert.ok(q.includes(`"${columnFor(field)}"`), `missing column for ${field}`)
    }

    // The guard itself: without it, two concurrent refreshes could both write.
    assert.match(q, /WHERE COALESCE\("token_version", 0\) = \$\d+/)
    assert.match(q, /"token_version" = COALESCE\("token_version", 0\) \+ 1/)
    assert.match(q, /RETURNING "token_version"/)
  })

  it("spells lastOAuthError the way Payload does, not the way it reads", () => {
    // Guards the one column whose generated name looks like a typo.
    assert.equal(columnFor('lastOAuthError'), 'last_o_auth_error')
  })

  it('parameterises every value instead of interpolating it', async () => {
    const { writer, queries } = captureSql()
    await writer.swapTokens(3, ROTATED)
    // No ciphertext, timestamp or scope inlined into the statement text.
    for (const value of Object.values(ROTATED)) {
      assert.ok(!queries[0].includes(String(value)))
    }
    assert.match(queries[0], /\$1/)
  })

  it('the migration creates a column for every field on the global', () => {
    // A field with no column is invisible until production writes to it, so the migration and
    // the global config are checked against each other here rather than at deploy time.
    const ddl = readFileSync(
      new URL('../../../migrations/20260731_160000.ts', import.meta.url),
      'utf8',
    )
    for (const field of PinterestConnection.fields) {
      if (!('name' in field)) continue
      const column = toSnakeCase((field as { name: string }).name)
      assert.ok(ddl.includes(`"${column}"`), `migration is missing a column for ${column}`)
    }
    // Payload's own bookkeeping columns.
    assert.ok(ddl.includes('"updated_at"'))
    assert.ok(ddl.includes('"created_at"'))
    // The select field needs its enum type to exist first.
    assert.ok(ddl.includes('enum_pinterest_connection_connection_status'))
  })

  it('releases the lock without touching any token column', async () => {
    const { writer, queries } = captureSql()
    await writer.releaseRefreshLock()
    assert.ok(queries[0].includes('"refresh_lock_expires_at" = NULL'))
    assert.ok(!queries[0].includes('access_token_encrypted'))
    assert.ok(!queries[0].includes('refresh_token_encrypted'))
  })
})
