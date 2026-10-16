import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Field } from 'payload'
import { Partners } from './Partners'
import { PARTNERSHIP_DEFAULT_PERCENT, PARTNERSHIP_TYPES } from '@/lib/partner/partnerships'

/**
 * The Partners register (Phase 1).
 *
 * Reached through the exported `CollectionConfig`, the same way `PartnerPayouts.test.ts` tests
 * access. Beyond access, these tests pin the Phase 1 boundary: the collection holds
 * configuration only, stores no promo-code rate, and links to nothing yet — so it cannot
 * change checkout, commission or payout behaviour.
 */

type AccessFn = (args: { req: { user: unknown } }) => unknown
type AnyField = Field & {
  name?: string
  label?: unknown
  fields?: Field[]
  defaultValue?: unknown
  required?: boolean
  hasMany?: boolean
  options?: { label: string; value: string }[]
  validate?: (value: unknown, args: unknown) => unknown
  admin?: { condition?: (data: unknown, siblingData: unknown, ctx: unknown) => boolean }
}

/** Every field with data, flattened through rows and collapsibles (which store nothing). */
function dataFields(fields: Field[]): AnyField[] {
  return fields.flatMap((f) => {
    const field = f as AnyField
    if ((field.type === 'row' || field.type === 'collapsible') && field.fields) {
      return dataFields(field.fields)
    }
    return [field]
  })
}

const fields = dataFields(Partners.fields)
const byName = (name: string) => {
  const field = fields.find((f) => f.name === name)
  assert.ok(field, `field ${name} must exist`)
  return field
}

const access = Partners.access!
const ADMIN = { id: 1, role: 'admin' }
const EDITOR = { id: 2, role: 'editor' }
const NO_ROLE = { id: 3 }

const PERCENT_FIELDS = {
  businessSaleCommissionPercent: 'businessSale',
  retailerReferralCommissionPercent: 'retailerReferral',
  dropshippingDiscountPercent: 'dropshipping',
  wholesaleDiscountPercent: 'wholesale',
} as const

/* ------------------------------ access ------------------------------ */

describe('Partners — access control', () => {
  for (const op of ['read', 'create', 'update'] as const) {
    it(`requires authentication to ${op}`, () => {
      const fn = access[op] as AccessFn
      assert.equal(fn({ req: { user: null } }), false)
      assert.equal(fn({ req: { user: EDITOR } }), true)
      assert.equal(fn({ req: { user: ADMIN } }), true)
    })
  }

  it('allows delete only for role admin', () => {
    const fn = access.delete as AccessFn
    assert.equal(fn({ req: { user: null } }), false)
    assert.equal(fn({ req: { user: EDITOR } }), false)
    assert.equal(fn({ req: { user: NO_ROLE } }), false)
    assert.equal(fn({ req: { user: ADMIN } }), true)
  })
})

/* ------------------------------ shape ------------------------------ */

describe('Partners — collection shape', () => {
  it('is the `partners` collection with Norwegian admin labels', () => {
    assert.equal(Partners.slug, 'partners')
    assert.deepEqual(Partners.labels, { singular: 'Partner', plural: 'Partnere' })
    assert.equal(Partners.admin?.group, 'Partnere')
    assert.equal(Partners.admin?.useAsTitle, 'name')
  })

  it('requires a name and defaults the status to active', () => {
    const name = byName('name')
    assert.equal(name.required, true)
    assert.equal(name.label, 'Partnernavn')
    assert.notEqual(name.validate!('   ', {}), true, 'a blank name must be refused')
    assert.equal(name.validate!('Ola Nordmann', {}), true)

    const status = byName('status')
    assert.equal(status.required, true)
    assert.equal(status.defaultValue, 'active')
  })

  it('lets one partner take part in several models through one multi-select', () => {
    const types = byName('partnershipTypes')
    assert.equal(types.type, 'select')
    assert.equal(types.hasMany, true)
    assert.equal(types.label, 'Samarbeidsformer')
    assert.deepEqual(
      (types.options as { value: string }[]).map((o) => o.value),
      [...PARTNERSHIP_TYPES],
    )
  })

  it('holds the contact and payment details previously only on promo codes', () => {
    for (const name of [
      'email',
      'phone',
      'bankAccount',
      'accountOwner',
      'organizationNumber',
      'internalNote',
    ]) {
      byName(name)
    }
  })

  it('labels every data field in Norwegian (no English fallbacks)', () => {
    for (const field of fields) {
      assert.equal(typeof field.label, 'string', `${field.name} must have an explicit label`)
    }
  })
})

/* ------------------------------ Phase 1 boundary ------------------------------ */

describe('Partners — boundary', () => {
  it('stores no promo-code commission rate — the promo code stays authoritative', () => {
    const stored = fields.filter((f) => f.type !== 'join').map((f) => f.name ?? '')
    assert.equal(stored.includes('commissionRate'), false)
    assert.equal(stored.includes('commissionBase'), false)
    assert.equal(
      stored.some((n) => /promo|commissionRate/i.test(n)),
      false,
      'no stored promo-code field of any kind on the partner',
    )
  })

  it('stores no link itself: only virtual join fields, no relationship or upload columns', () => {
    for (const field of fields) {
      assert.ok(
        !['relationship', 'upload'].includes(field.type),
        `${field.name} must not be a stored link — the links live on promo codes and payouts`,
      )
    }
  })

  it('lists the linked promo codes and payouts through join fields', () => {
    const codes = byName('promoCodes') as AnyField & { collection?: string; on?: string }
    assert.equal(codes.type, 'join')
    assert.equal(codes.collection, 'promo-codes')
    assert.equal(codes.on, 'partner')
    assert.equal(codes.label, 'Rabattkoder')

    const payouts = byName('payouts') as AnyField & { collection?: string; on?: string }
    assert.equal(payouts.type, 'join')
    assert.equal(payouts.collection, 'partner-payouts')
    assert.equal(payouts.on, 'partner')
    assert.equal(payouts.label, 'Utbetalinger')
  })

  it('registers only the link-integrity hooks, and no endpoints', () => {
    assert.equal(Partners.hooks?.beforeChange?.length, 1)
    assert.equal(Partners.hooks?.beforeDelete?.length, 1)
    assert.equal(Partners.hooks?.afterChange?.length, 1)
    assert.equal(Partners.hooks?.beforeValidate, undefined)
    assert.equal(Partners.endpoints, undefined)
  })
})

/* ------------------------------ agreed terms ------------------------------ */

describe('Partners — agreed rates and discounts', () => {
  for (const [name, type] of Object.entries(PERCENT_FIELDS)) {
    describe(name, () => {
      const field = byName(name)
      const validate = (value: unknown, partnershipTypes: unknown) =>
        field.validate!(value, { data: { partnershipTypes } })

      it(`defaults to the programme term (${PARTNERSHIP_DEFAULT_PERCENT[type]} %)`, () => {
        assert.equal(field.defaultValue, PARTNERSHIP_DEFAULT_PERCENT[type])
      })

      it('is shown only while its model is selected', () => {
        const condition = field.admin!.condition!
        assert.equal(condition({ partnershipTypes: [type] }, {}, {}), true)
        assert.equal(condition({ partnershipTypes: ['promoCode', type] }, {}, {}), true)
        assert.equal(condition({ partnershipTypes: [] }, {}, {}), false)
        assert.equal(condition({}, {}, {}), false)
      })

      it('is required and range-checked only while its model is selected', () => {
        assert.equal(validate(undefined, []), true)
        assert.equal(validate(500, ['promoCode']), true)
        assert.notEqual(validate(undefined, [type]), true)
        assert.notEqual(validate(101, [type]), true)
        assert.notEqual(validate(-1, [type]), true)
        assert.equal(validate(PARTNERSHIP_DEFAULT_PERCENT[type], [type]), true)
      })
    })
  }

  it('labels Forhandlersalg and Forhandlerinnkjøp differently', () => {
    const referral = String(byName('retailerReferralCommissionPercent').label)
    const wholesale = String(byName('wholesaleDiscountPercent').label)
    assert.match(referral, /^Forhandlersalg/)
    assert.match(wholesale, /^Forhandlerinnkjøp/)
    assert.match(referral, /provisjon/)
    assert.match(wholesale, /rabatt/)
  })
})

/* ------------------------------ migration ------------------------------ */

describe('Partners — migration 20261016_090000', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/migrations/20261016_090000.ts'), 'utf8')
  const up = source.slice(source.indexOf('export async function up'), source.indexOf('export async function down'))
  const upSql = up.replace(/--.*$/gm, '')

  const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

  it('creates a column for every scalar field on the collection', () => {
    for (const field of fields) {
      // `ui` and `join` fields are virtual; a hasMany select gets its own table.
      if (!field.name || field.type === 'ui' || field.type === 'join' || field.hasMany) continue
      assert.match(upSql, new RegExp(`"${snake(field.name)}"`), `${field.name} needs a column`)
    }
    assert.match(upSql, /CREATE TABLE IF NOT EXISTS "partners_partnership_types"/)
  })

  it('writes the programme terms as the column defaults', () => {
    for (const [name, type] of Object.entries(PERCENT_FIELDS)) {
      assert.match(
        upSql,
        new RegExp(`"${snake(name)}" numeric DEFAULT ${PARTNERSHIP_DEFAULT_PERCENT[type]}\\b`),
      )
    }
  })

  it('is purely additive: no DROP, DELETE, TRUNCATE or UPDATE in up()', () => {
    // Foreign-key referential actions (`ON DELETE cascade ON UPDATE no action`) are clauses,
    // not statements, so they are removed before looking for destructive statements.
    const statements = upSql.replace(/ON (DELETE|UPDATE) (cascade|restrict|set null|no action)/gi, '')
    assert.doesNotMatch(statements, /\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i)
  })

  it('touches no existing table other than the admin lock relation', () => {
    const altered = [...upSql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1])
    for (const table of altered) {
      assert.ok(
        ['partners', 'partners_partnership_types', 'payload_locked_documents_rels'].includes(table),
        `${table} must not be altered`,
      )
    }
    for (const existing of ['promo_codes', 'promo_code_usages', 'partner_payouts', 'orders']) {
      assert.doesNotMatch(upSql, new RegExp(`"${existing}"`), `${existing} must be untouched`)
    }
  })

  it('is idempotent', () => {
    assert.doesNotMatch(upSql, /CREATE TABLE (?!IF NOT EXISTS)/)
    assert.doesNotMatch(upSql, /CREATE INDEX (?!IF NOT EXISTS)/)
    assert.doesNotMatch(upSql, /ADD COLUMN (?!IF NOT EXISTS)/)
  })

  it('is registered in the migration index', () => {
    const index = readFileSync(resolve(process.cwd(), 'src/migrations/index.ts'), 'utf8')
    assert.match(index, /name: '20261016_090000'/)
  })
})
