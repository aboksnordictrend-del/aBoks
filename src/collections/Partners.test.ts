import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Field } from 'payload'
import { Partners } from './Partners'

/**
 * The Partners collection after the programme correction: one programme, three standard earning
 * methods shown as information, two optional agreements as independent checkboxes, and the
 * first release's fields kept hidden and frozen.
 *
 * Reached through the exported `CollectionConfig`, the same way `PartnerPayouts.test.ts` tests
 * access.
 */

type AnyField = Field & {
  name?: string
  label?: unknown
  fields?: Field[]
  defaultValue?: unknown
  required?: boolean
  hasMany?: boolean
  access?: { create?: (args: unknown) => unknown; update?: (args: unknown) => unknown }
  validate?: (value: unknown, args: unknown) => unknown
  admin?: {
    hidden?: boolean
    condition?: (data: unknown, siblingData: unknown, ctx: unknown) => boolean
    components?: { Field?: unknown }
  }
}
type AccessFn = (args: { req: { user: unknown } }) => unknown

/** Every field with data, flattened through rows and collapsibles (which store nothing). */
function dataFields(fields: Field[]): AnyField[] {
  return fields.flatMap((f) => {
    const field = f as AnyField
    if ((field.type === 'row' || field.type === 'collapsible') && field.fields) return dataFields(field.fields)
    return [field]
  })
}

const fields = dataFields(Partners.fields)
const byName = (name: string) => {
  const field = fields.find((f) => f.name === name)
  assert.ok(field, `field ${name} must exist`)
  return field
}
const visible = fields.filter((f) => f.admin?.hidden !== true)

const access = Partners.access!
const ADMIN = { id: 1, role: 'admin' }
const EDITOR = { id: 2, role: 'editor' }

const LEGACY = ['partnershipTypes', 'businessSaleCommissionPercent', 'retailerReferralCommissionPercent'] as const
const AGREEMENTS = [
  { checkbox: 'dropshippingEnabled', percent: 'dropshippingDiscountPercent', label: 'Dropshipping', def: 20 },
  { checkbox: 'wholesaleEnabled', percent: 'wholesaleDiscountPercent', label: 'Forhandlerinnkjøp', def: 35 },
] as const

/* ------------------------------ access ------------------------------ */

describe('Partners — access control (unchanged)', () => {
  for (const op of ['read', 'create', 'update'] as const) {
    it(`requires authentication to ${op}`, () => {
      const fn = access[op] as AccessFn
      assert.equal(fn({ req: { user: null } }), false)
      assert.equal(fn({ req: { user: EDITOR } }), true)
    })
  }

  it('allows delete only for role admin', () => {
    const fn = access.delete as AccessFn
    assert.equal(fn({ req: { user: null } }), false)
    assert.equal(fn({ req: { user: EDITOR } }), false)
    assert.equal(fn({ req: { user: { id: 3 } } }), false)
    assert.equal(fn({ req: { user: ADMIN } }), true)
  })
})

/* ------------------------------ one programme ------------------------------ */

describe('Partners — standard earning methods are information, not settings', () => {
  it('shows «Standard partnerfordeler» through a read-only UI component', () => {
    const ui = byName('standardBenefits')
    assert.equal(ui.type, 'ui')
    assert.equal(ui.admin?.components?.Field, '@/components/admin/partner/StandardPartnerBenefits#default')
  })

  it('has no visible field to select or rate Promokode, Bedriftssalg or Forhandlersalg', () => {
    const names = visible.filter((f) => f.type !== 'join').map((f) => f.name ?? '')
    for (const banned of ['partnershipTypes', 'businessSaleCommissionPercent', 'retailerReferralCommissionPercent', 'commissionRate', 'commissionBase']) {
      assert.equal(names.includes(banned), false, `${banned} must not be an admin setting`)
    }
    assert.equal(names.some((n) => /promo/i.test(n)), false, 'no stored promo-code field on the partner')
  })

  it('needs no field at all for a partner to have the three standard methods', () => {
    // A partner with only a name and status validates: nothing has to be ticked.
    for (const field of visible) {
      if (field.name === 'name' || field.name === 'status') continue
      assert.notEqual(field.required, true, `${field.name} must not be required`)
    }
  })
})

/* ------------------------------ partner type ------------------------------ */

describe('Partners — partnerType', () => {
  const field = byName('partnerType') as AnyField & {
    options?: { label: string; value: string }[]
    access?: { update?: (args: unknown) => unknown }
  }

  it('offers exactly «Vanlig partner» and «Nettbutikk / Forhandler»', () => {
    assert.deepEqual(field.options!.map((o) => [o.value, o.label]), [
      ['regular', 'Vanlig partner'],
      ['retailer', 'Nettbutikk / Forhandler'],
    ])
    assert.equal(field.label, 'Partnertype')
  })

  it('has no default — the administrator must choose', () => {
    assert.equal(field.defaultValue, undefined)
  })

  it('is required on every save, with a Norwegian message, but nullable in the database', () => {
    assert.notEqual(field.required, true, 'requiredness in the validator keeps unclassified rows valid')
    for (const value of [undefined, null, '', 'reseller']) {
      assert.match(String(field.validate!(value, {})), /Velg partnertype/, String(value))
    }
    assert.equal(field.validate!('regular', {}), true)
    assert.equal(field.validate!('retailer', {}), true)
  })

  it('uses no field access (which would drop a change silently) — the hook refuses it instead', () => {
    assert.equal(field.access, undefined)
    assert.equal(Partners.hooks?.beforeChange?.length, 1)
  })

  it('renders through PartnerTypeField, read-only once saved', () => {
    assert.equal(field.admin?.components?.Field, '@/components/admin/partner/PartnerTypeField#default')
  })

  it('sits right after Partnernavn and Status', () => {
    const order = (Partners.fields as AnyField[]).map((f) => f.name ?? String(f.label ?? f.type))
    assert.equal(order.indexOf('partnerType'), 1, JSON.stringify(order.slice(0, 4)))
  })

  it('shows «Standard partnerfordeler» only for a regular partner', () => {
    const condition = byName('standardBenefits').admin!.condition!
    assert.equal(condition({ partnerType: 'regular' }, {}, {}), true)
    assert.equal(condition({ partnerType: 'retailer' }, {}, {}), false)
    assert.equal(condition({}, {}, {}), false)
  })

  it('relabels entityType as legal form, distinct from the partner type', () => {
    assert.equal(byName('entityType').label, 'Privatperson / bedrift')
  })
})

/* ------------------------------ address ------------------------------ */

describe('Partners — address (both partner types)', () => {
  const ADDRESS = [
    ['addressLine1', 'Adresse'],
    ['addressLine2', 'Adresselinje 2'],
    ['postalCode', 'Postnummer'],
    ['city', 'Poststed'],
    ['country', 'Land'],
  ] as const

  it('has five optional, Norwegian-labelled text fields in an «Adresse» section', () => {
    const section = (Partners.fields as AnyField[]).find((f) => f.type === 'collapsible' && f.label === 'Adresse')
    assert.ok(section)
    assert.deepEqual(dataFields(section.fields!).map((f) => f.name), ADDRESS.map(([n]) => n))
    for (const [name, label] of ADDRESS) {
      const f = byName(name)
      assert.equal(f.type, 'text', name)
      assert.equal(f.label, label, name)
      assert.notEqual(f.required, true, name)
      assert.equal(f.admin?.condition, undefined, `${name} is shown for both partner types`)
    }
  })

  it('pre-fills «Norge» as the country of a new partner', () => {
    assert.equal(byName('country').defaultValue, 'Norge')
  })

  it('validates a Norwegian postal code against the partner country', () => {
    const v = (value: unknown, country: unknown) => byName('postalCode').validate!(value, { data: { country } })
    assert.equal(v('0150', 'Norge'), true)
    assert.match(String(v('150', 'Norge')), /fire siffer/)
    assert.match(String(v('015A', undefined)), /fire siffer/)
    assert.equal(v('SW1A 1AA', 'Storbritannia'), true)
    assert.equal(v(undefined, 'Norge'), true)
  })

  it('caps the free-text fields with Norwegian messages', () => {
    assert.match(String(byName('addressLine1').validate!('x'.repeat(201), {})), /Adresse kan ikke være lengre enn 200 tegn/)
    assert.equal(byName('addressLine1').validate!('Storgata 1', {}), true)
  })
})

/* ------------------------------ optional agreements ------------------------------ */

describe('Partners — «Samarbeidsavtaler» (online retailers only)', () => {
  it('groups the two retailer agreements under one collapsible, shown only for retailers', () => {
    const section = (Partners.fields as AnyField[]).find((f) => f.type === 'collapsible' && f.label === 'Samarbeidsavtaler')
    assert.ok(section)
    const condition = section.admin!.condition!
    assert.equal(condition({ partnerType: 'retailer' }, {}, {}), true)
    assert.equal(condition({ partnerType: 'regular' }, {}, {}), false)
    assert.equal(condition({}, {}, {}), false, 'unclassified shows neither section')
    assert.deepEqual(
      dataFields(section.fields!).map((f) => f.name),
      ['dropshippingEnabled', 'dropshippingDiscountPercent', 'wholesaleEnabled', 'wholesaleDiscountPercent'],
    )
  })

  for (const a of AGREEMENTS) {
    describe(a.label, () => {
      const checkbox = byName(a.checkbox)
      const percent = byName(a.percent)
      const validate = (value: unknown, data: Record<string, unknown>) => percent.validate!(value, { data })

      it('is an independent checkbox, off by default, shown only for retailers', () => {
        assert.equal(checkbox.admin!.condition!({ partnerType: 'retailer' }, {}, {}), true)
        assert.equal(checkbox.admin!.condition!({ partnerType: 'regular' }, {}, {}), false)
        assert.equal(checkbox.type, 'checkbox')
        assert.equal(checkbox.label, a.label)
        assert.equal(checkbox.defaultValue, false)
        assert.notEqual(checkbox.required, true)
      })

      it(`has a discount field defaulting to ${a.def} %`, () => {
        assert.equal(percent.type, 'number')
        assert.equal(percent.defaultValue, a.def)
        assert.equal(percent.label, `${a.label} – rabatt (%)`)
      })

      it('shows the discount only while the agreement is enabled', () => {
        const condition = percent.admin!.condition!
        assert.equal(condition({ partnerType: 'retailer', [a.checkbox]: true }, {}, {}), true)
        assert.equal(condition({ partnerType: 'retailer', [a.checkbox]: false }, {}, {}), false)
        assert.equal(condition({ partnerType: 'regular', [a.checkbox]: true }, {}, {}), false, 'never for a regular partner')
        assert.equal(condition({}, {}, {}), false)
      })

      it('validates the discount only while the agreement is enabled', () => {
        const on = { partnerType: 'retailer', [a.checkbox]: true }
        assert.equal(validate(500, { partnerType: 'retailer', [a.checkbox]: false }), true)
        assert.notEqual(validate(undefined, on), true)
        assert.notEqual(validate(101, on), true)
        assert.equal(validate(a.def, on), true)
      })
    })
  }

  it('keeps a ticked agreement visible on a regular or unclassified partner, so it can be unticked', () => {
    const section = (Partners.fields as AnyField[]).find((f) => f.type === 'collapsible' && f.label === 'Samarbeidsavtaler')!
    for (const a of AGREEMENTS) {
      const ticked = { partnerType: 'regular', [a.checkbox]: true }
      assert.equal(section.admin!.condition!(ticked, {}, {}), true, a.label)
      assert.equal(byName(a.checkbox).admin!.condition!(ticked, {}, {}), true, a.label)
      assert.equal(byName(a.checkbox).admin!.condition!({ [a.checkbox]: true }, {}, {}), true, `${a.label} (unclassified)`)
      assert.equal(byName(a.percent).admin!.condition!(ticked, {}, {}), false, 'no discount editing for a regular partner')
    }
    assert.equal(section.admin!.condition!({ partnerType: 'regular', dropshippingEnabled: false, wholesaleEnabled: false }, {}, {}), false)
  })

  it('tells the administrator to untick agreements before choosing «Vanlig partner»', () => {
    const section = (Partners.fields as AnyField[]).find((f) => f.type === 'collapsible' && f.label === 'Samarbeidsavtaler')!
    assert.match(String((section.admin as { description?: unknown }).description), /fjern eventuelle avkrysninger/)
  })

  it('lets both agreements be enabled together', () => {
    const data = { partnerType: 'retailer', dropshippingEnabled: true, wholesaleEnabled: true }
    for (const a of AGREEMENTS) {
      assert.equal(byName(a.percent).admin!.condition!(data, {}, {}), true, a.label)
      assert.equal(byName(a.percent).validate!(a.def, { data }), true, a.label)
    }
  })
})

/* ------------------------------ legacy fields ------------------------------ */

describe('Partners — first-release fields are kept, hidden and frozen', () => {
  for (const name of LEGACY) {
    it(`${name}: still in the schema, hidden, closed to create and update`, () => {
      const field = byName(name)
      assert.equal(field.admin?.hidden, true)
      assert.equal(field.access?.create?.({}), false)
      assert.equal(field.access?.update?.({}), false)
      assert.equal(field.validate, undefined, 'no validation can block a save on a legacy value')
    })
  }

  it('puts the stored value back on every update, even when access is overridden', () => {
    type Hook = (args: { operation: string; originalDoc?: Record<string, unknown>; value?: unknown }) => unknown
    for (const name of LEGACY) {
      const hook = ((byName(name) as AnyField & { hooks?: { beforeChange?: Hook[] } }).hooks?.beforeChange ?? [])[0]
      assert.ok(hook, `${name} needs a freeze hook`)
      assert.deepEqual(hook({ operation: 'update', originalDoc: { [name]: 'stored' }, value: 'attempt' }), 'stored', name)
    }
    const rate = ((byName('businessSaleCommissionPercent') as AnyField & { hooks?: { beforeChange?: Hook[] } }).hooks!.beforeChange!)[0]
    assert.equal(rate({ operation: 'create', value: 99 }), 25, 'a new partner gets the column default, not the attempt')
    const types = ((byName('partnershipTypes') as AnyField & { hooks?: { beforeChange?: Hook[] } }).hooks!.beforeChange!)[0]
    assert.equal(types({ operation: 'create', value: ['businessSale'] }), null)
  })

  it('keeps the legacy multi-select options matching the database enum', () => {
    const field = byName('partnershipTypes') as AnyField & { options?: { value: string }[] }
    assert.equal(field.hasMany, true)
    assert.deepEqual(field.options!.map((o) => o.value), ['promoCode', 'businessSale', 'retailerReferral', 'dropshipping', 'wholesale'])
  })
})

/* ------------------------------ identity, links, hooks ------------------------------ */

describe('Partners — identity, contact and links are preserved', () => {
  it('keeps name, status, contact, payment and note fields', () => {
    for (const name of ['name', 'status', 'entityType', 'organizationNumber', 'contactPerson', 'email', 'phone', 'bankAccount', 'accountOwner', 'agreementDate', 'internalNote']) {
      assert.ok(visible.some((f) => f.name === name), name)
    }
    assert.equal(byName('name').required, true)
    assert.equal(byName('status').defaultValue, 'active')
  })

  it('lists linked promo codes and payouts through join fields', () => {
    const codes = byName('promoCodes') as AnyField & { collection?: string; on?: string }
    const payouts = byName('payouts') as AnyField & { collection?: string; on?: string }
    assert.deepEqual([codes.type, codes.collection, codes.on], ['join', 'promo-codes', 'partner'])
    assert.deepEqual([payouts.type, payouts.collection, payouts.on], ['join', 'partner-payouts', 'partner'])
  })

  it('stores no link itself', () => {
    for (const field of fields) assert.ok(!['relationship', 'upload'].includes(field.type), String(field.name))
  })

  it('keeps the delete guard and the name sync, plus the partner-type rules', () => {
    assert.equal(Partners.hooks?.beforeChange?.length, 1)
    assert.equal(Partners.hooks?.beforeDelete?.length, 1)
    assert.equal(Partners.hooks?.afterChange?.length, 1)
    assert.equal(Partners.endpoints, undefined)
  })

  it('lists the agreements, not the legacy selector, as columns', () => {
    const columns = Partners.admin?.defaultColumns ?? []
    assert.ok(columns.includes('dropshippingEnabled') && columns.includes('wholesaleEnabled'))
    assert.equal(columns.includes('partnershipTypes'), false)
  })
})

/* ------------------------------ migrations ------------------------------ */

const read = (file: string) => readFileSync(resolve(process.cwd(), 'src/migrations', file), 'utf8')
const upOf = (source: string) =>
  source.slice(source.indexOf('export async function up'), source.indexOf('export async function down')).replace(/--.*$/gm, '')
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

describe('Partners — migrations', () => {
  const phase1 = upOf(read('20261016_090000.ts'))
  const correction = upOf(read('20261018_090000.ts'))
  const typeMigration = upOf(read('20261019_090000.ts'))
  const addressMigration = upOf(read('20261020_090000.ts'))

  it('has a column for every scalar field across 20261016, 20261018, 20261019 and 20261020', () => {
    for (const field of fields) {
      if (!field.name || field.type === 'ui' || field.type === 'join' || field.hasMany) continue
      assert.match(phase1 + correction + typeMigration + addressMigration, new RegExp(`"${snake(field.name)}"`), `${field.name} needs a column`)
    }
    assert.match(phase1, /CREATE TABLE IF NOT EXISTS "partners_partnership_types"/)
  })

  it('20261018 drops, deletes and truncates nothing', () => {
    assert.doesNotMatch(correction, /\b(DROP|DELETE|TRUNCATE)\b/i)
  })

  it('20261018 writes only the two new columns', () => {
    const sets = [...correction.matchAll(/SET\s+"([a-z_]+)"\s*=/g)].map((m) => m[1])
    assert.deepEqual(sets, ['dropshipping_enabled', 'wholesale_enabled'])
    const updated = [...correction.matchAll(/UPDATE\s+"([a-z_]+)"/g)].map((m) => m[1])
    assert.deepEqual(updated, ['partners', 'partners'])
  })

  it('20261018 copies the legacy Dropshipping/Forhandlerinnkjøp selections, only into unmigrated rows', () => {
    assert.match(correction, /t\."value" = 'dropshipping'/)
    assert.match(correction, /t\."value" = 'wholesale'/)
    assert.equal((correction.match(/IS NULL;/g) ?? []).length, 2, 'never overwrites a checkbox an admin set')
  })

  it('20261018 adds the columns before filling them and sets the default last', () => {
    const add = correction.indexOf('ADD COLUMN IF NOT EXISTS "dropshipping_enabled" boolean;')
    const fill = correction.indexOf('SET "dropshipping_enabled"')
    const def = correction.indexOf('ALTER COLUMN "dropshipping_enabled" SET DEFAULT false')
    assert.ok(add >= 0 && fill > add && def > fill)
  })

  it('20261019 adds a nullable, default-free partner_type and classifies nobody', () => {
    assert.match(typeMigration, /CREATE TYPE "public"\."enum_partners_partner_type" AS ENUM\('regular', 'retailer'\)/)
    assert.match(typeMigration, /ADD COLUMN IF NOT EXISTS "partner_type" "enum_partners_partner_type";/)
    assert.doesNotMatch(typeMigration, /NOT NULL|DEFAULT/i, 'no default — nothing is classified automatically')
    assert.doesNotMatch(typeMigration, /\b(UPDATE|DROP|DELETE|TRUNCATE|INSERT)\b/i, 'no existing row is touched')
    assert.doesNotMatch(typeMigration, /ALTER TABLE "(?!partners")/, 'no other table is altered')
  })

  it('20261020 adds five nullable address columns and gives existing rows no country', () => {
    for (const col of ['address_line1', 'address_line2', 'postal_code', 'city', 'country']) {
      assert.match(addressMigration, new RegExp(`ADD COLUMN IF NOT EXISTS "${col}" varchar;`), col)
    }
    assert.doesNotMatch(addressMigration, /ADD COLUMN[^;]*DEFAULT/, 'no column is added WITH a default')
    const add = addressMigration.indexOf('ADD COLUMN IF NOT EXISTS "country"')
    const def = addressMigration.indexOf(`ALTER COLUMN "country" SET DEFAULT 'Norge'`)
    assert.ok(add >= 0 && def > add, 'the default is set only after the column exists')
    assert.doesNotMatch(addressMigration, /\b(UPDATE|DROP|DELETE|TRUNCATE|INSERT)\b/i)
    assert.doesNotMatch(addressMigration, /ALTER TABLE "(?!partners")/)
  })

  it('registers the five partner migrations in order', () => {
    const index = readFileSync(resolve(process.cwd(), 'src/migrations/index.ts'), 'utf8')
    const at = (n: string) => index.indexOf(`name: '${n}'`)
    assert.ok(at('20261016_090000') >= 0)
    assert.ok(at('20261017_090000') > at('20261016_090000'))
    assert.ok(at('20261018_090000') > at('20261017_090000'))
    assert.ok(at('20261019_090000') > at('20261018_090000'))
    assert.ok(at('20261020_090000') > at('20261019_090000'))
  })
})
