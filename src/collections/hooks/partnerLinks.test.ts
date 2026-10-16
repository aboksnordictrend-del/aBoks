import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APIError } from 'payload'
import {
  PARTNER_IN_USE_MESSAGE,
  guardPartnerDelete,
  propagatePartnerName,
} from './partnerLinks'

/**
 * Integrity of the links into a partner, plus the schema migration that creates them.
 */

/* ------------------------------ harness ------------------------------ */

function stubReq(counts: Record<string, number> = {}) {
  const calls = { count: [] as { collection: string; where: unknown }[], updateMany: [] as unknown[] }
  const req = {
    payload: {
      count: async (args: { collection: string; where: unknown }) => {
        calls.count.push(args)
        return { totalDocs: counts[args.collection] ?? 0 }
      },
      db: {
        updateMany: async (args: unknown) => {
          calls.updateMany.push(args)
          return null
        },
      },
    },
  }
  return { req, calls }
}

type DeleteArgs = Parameters<typeof guardPartnerDelete>[0]
type AfterArgs = Parameters<typeof propagatePartnerName>[0]

/* ------------------------------ guardPartnerDelete ------------------------------ */

describe('guardPartnerDelete', () => {
  const del = (counts: Record<string, number>) => {
    const { req, calls } = stubReq(counts)
    return { run: () => guardPartnerDelete({ id: 5, req } as unknown as DeleteArgs), calls }
  }

  const refused = (run: () => Promise<unknown>) =>
    assert.rejects(run, (err: unknown) => {
      assert.ok(err instanceof APIError)
      assert.equal((err as APIError).message, PARTNER_IN_USE_MESSAGE)
      assert.equal((err as APIError).status, 409)
      return true
    })

  it('refuses deleting a partner with linked promo codes', async () => {
    await refused(del({ 'promo-codes': 1 }).run)
  })

  it('refuses deleting a partner with registered payouts', async () => {
    await refused(del({ 'partner-payouts': 1 }).run)
  })

  it('allows deleting a partner nothing points at', async () => {
    const g = del({})
    await g.run()
    assert.deepEqual(
      g.calls.count.map((c) => [c.collection, c.where]),
      [
        ['promo-codes', { partner: { equals: 5 } }],
        ['partner-payouts', { partner: { equals: 5 } }],
      ],
    )
  })
})

/* ------------------------------ propagatePartnerName ------------------------------ */

describe('propagatePartnerName', () => {
  const after = (doc: Record<string, unknown>, previousDoc: Record<string, unknown>, operation = 'update') => {
    const { req, calls } = stubReq()
    return propagatePartnerName({ operation, doc, previousDoc, req } as unknown as AfterArgs).then(
      () => calls.updateMany,
    )
  }

  it('copies a new name onto every linked promo code, bypassing promo validation', async () => {
    const writes = await after({ id: 5, name: 'Ola AS' }, { id: 5, name: 'Ola Nordmann' })
    assert.equal(writes.length, 1)
    const args = writes[0] as Record<string, unknown>
    assert.equal(args.collection, 'promo-codes')
    assert.deepEqual(args.where, { partner: { equals: 5 } })
    assert.deepEqual(args.data, { partnerName: 'Ola AS' }, 'only the name copy — nothing financial')
    assert.ok(args.req, 'runs on the request transaction')
  })

  it('does nothing when the name is unchanged', async () => {
    assert.equal((await after({ id: 5, name: 'Ola' }, { id: 5, name: 'Ola' })).length, 0)
  })

  it('does nothing on create — no code can be linked yet', async () => {
    assert.equal((await after({ id: 5, name: 'Ola' }, {}, 'create')).length, 0)
  })

  it('never writes an empty name', async () => {
    assert.equal((await after({ id: 5, name: '  ' }, { id: 5, name: 'Ola' })).length, 0)
  })
})

/* ------------------------------ migration ------------------------------ */

describe('migration 20261017_090000 — partner links', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/migrations/20261017_090000.ts'), 'utf8')
  const up = source
    .slice(source.indexOf('export async function up'), source.indexOf('export async function down'))
    .replace(/--.*$/gm, '')

  it('adds a nullable partner_id to promo_codes and partner_payouts', () => {
    assert.match(up, /ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_id" integer;/)
    assert.match(up, /ALTER TABLE "partner_payouts" ADD COLUMN IF NOT EXISTS "partner_id" integer;/)
    assert.doesNotMatch(up, /NOT NULL/, 'every existing row must stay valid unlinked')
  })

  it('indexes both columns and references partners', () => {
    assert.match(up, /"promo_codes_partner_idx" ON "promo_codes" USING btree \("partner_id"\)/)
    assert.match(up, /"partner_payouts_partner_idx" ON "partner_payouts" USING btree \("partner_id"\)/)
    assert.equal((up.match(/REFERENCES "public"\."partners"\("id"\) ON DELETE set null/g) ?? []).length, 2)
  })

  it('is purely additive: no DROP, DELETE, TRUNCATE or UPDATE statement in up()', () => {
    const statements = up.replace(/ON (DELETE|UPDATE) (cascade|restrict|set null|no action)/gi, '')
    assert.doesNotMatch(statements, /\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i)
  })

  it('touches no usage, order or partner table', () => {
    for (const table of ['promo_code_usages', 'orders', 'partners"', 'payload_locked_documents_rels']) {
      assert.doesNotMatch(up, new RegExp(`ALTER TABLE "${table}`), `${table} must be untouched`)
    }
  })

  it('is idempotent', () => {
    assert.doesNotMatch(up, /CREATE INDEX (?!IF NOT EXISTS)/)
    assert.doesNotMatch(up, /ADD COLUMN (?!IF NOT EXISTS)/)
    assert.equal((up.match(/EXCEPTION WHEN duplicate_object THEN null/g) ?? []).length, 2)
  })

  it('is registered in the migration index after the Partners migration', () => {
    const index = readFileSync(resolve(process.cwd(), 'src/migrations/index.ts'), 'utf8')
    const phase1 = index.indexOf("name: '20261016_090000'")
    const links = index.indexOf("name: '20261017_090000'")
    assert.ok(phase1 >= 0 && links > phase1)
  })
})
