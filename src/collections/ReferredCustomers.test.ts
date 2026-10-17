import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { ReferredCustomers } from './ReferredCustomers'
import { Partners } from './Partners'
import { enforceReferredCustomerRules, guardReferredCustomerDelete } from './hooks/referredCustomer'

/**
 * The `referred-customers` collection config: Norwegian labels, admin-only access, required
 * fields, the partner filter, version history, and the «Henviste kunder» join on the partner.
 * The rules themselves are tested in `./hooks/referredCustomer.test.ts`.
 */

type AnyField = Field & {
  name?: string
  label?: unknown
  fields?: Field[]
  required?: boolean
  defaultValue?: unknown
  options?: { label: string; value: string }[]
  filterOptions?: (args: unknown) => unknown
  validate?: (value: unknown, args: unknown) => unknown
  collection?: string
  on?: string
  admin?: { hidden?: boolean; condition?: (data: unknown) => boolean }
}
type AccessFn = (args: { req: { user: unknown } }) => unknown

function dataFields(fields: Field[]): AnyField[] {
  return fields.flatMap((f) => {
    const field = f as AnyField
    if ((field.type === 'row' || field.type === 'collapsible') && field.fields) return dataFields(field.fields)
    return [field]
  })
}

const fields = dataFields(ReferredCustomers.fields)
const byName = (name: string) => {
  const field = fields.find((f) => f.name === name)
  assert.ok(field, `field ${name} must exist`)
  return field
}

describe('ReferredCustomers — collection', () => {
  it('is labelled in Norwegian and grouped with the partners', () => {
    assert.deepEqual(ReferredCustomers.labels, { singular: 'Henvist kunde', plural: 'Henviste kunder' })
    assert.equal(ReferredCustomers.admin?.group, 'Partnere')
  })

  it('keeps version history for audit', () => {
    assert.ok(ReferredCustomers.versions && typeof ReferredCustomers.versions === 'object')
  })

  it('wires the rules and the delete guard', () => {
    assert.deepEqual(ReferredCustomers.hooks?.beforeChange, [enforceReferredCustomerRules])
    assert.deepEqual(ReferredCustomers.hooks?.beforeDelete, [guardReferredCustomerDelete])
  })
})

describe('ReferredCustomers — access', () => {
  const access = ReferredCustomers.access!
  for (const op of ['read', 'create', 'update'] as const) {
    it(`requires a logged-in user to ${op}`, () => {
      assert.equal((access[op] as AccessFn)({ req: { user: null } }), false)
      assert.equal((access[op] as AccessFn)({ req: { user: { id: 2, role: 'editor' } } }), true)
    })
  }

  it('allows delete only for role admin', () => {
    const fn = access.delete as AccessFn
    assert.equal(fn({ req: { user: null } }), false)
    assert.equal(fn({ req: { user: { id: 2, role: 'editor' } } }), false)
    assert.equal(fn({ req: { user: { id: 3 } } }), false)
    assert.equal(fn({ req: { user: { id: 1, role: 'admin' } } }), true)
  })
})

describe('ReferredCustomers — fields', () => {
  it('requires name, category, partner, status and referral date', () => {
    for (const name of ['name', 'category', 'partner', 'status', 'referralDate']) {
      assert.equal(byName(name).required, true, name)
    }
  })

  it('leaves registration number, contact details and notes optional', () => {
    for (const name of ['organizationNumber', 'contactPerson', 'email', 'phone', 'internalNote']) {
      assert.notEqual(byName(name).required, true, name)
    }
  })

  it('offers exactly Bedriftssalg and Forhandlersalg (physical store)', () => {
    assert.deepEqual(
      byName('category').options?.map((o) => o.value),
      ['businessSale', 'retailStore'],
    )
  })

  it('defaults to status Venter with the four statuses', () => {
    const status = byName('status')
    assert.equal(status.defaultValue, 'pending')
    assert.deepEqual(status.options?.map((o) => o.label), ['Venter', 'Godkjent', 'Avvist', 'Inaktiv'])
  })

  it('picks the country from the ISO list, Norge (NO) first and by default', () => {
    const country = byName('country')
    assert.equal(country.type, 'select')
    assert.equal(country.required, true)
    assert.equal(country.defaultValue, 'NO')
    assert.equal(country.options?.length, 249)
    assert.deepEqual(country.options?.slice(0, 2), [
      { label: 'Norge (NO)', value: 'NO' },
      { label: 'Sverige (SE)', value: 'SE' },
    ])
    assert.equal(country.validate!('SE', {}), true)
    assert.match(String(country.validate!('Sverige', {})), /Velg land/)
  })

  it('validates the registration number against the country code', () => {
    const validate = byName('organizationNumber').validate!
    assert.equal(validate('834012952', { data: { country: 'NO' } }), true)
    assert.match(String(validate('834012953', { data: { country: 'NO' } })), /kontrollsifferet/)
    assert.equal(validate('834012953', { data: { country: 'SE' } }), true)
  })

  it('rejects a blank name', () => {
    assert.match(String(byName('name').validate!('   ', {})), /må fylles ut/)
  })

  it('offers only active regular partners, plus the current one', () => {
    const filter = byName('partner').filterOptions!
    const eligible = { and: [{ partnerType: { equals: 'regular' } }, { status: { equals: 'active' } }] }
    assert.deepEqual(filter({ data: {} }), eligible)
    assert.deepEqual(filter({ data: { partner: 8 } }), { or: [eligible, { id: { equals: 8 } }] })
    assert.deepEqual(filter({ data: { partner: { id: 8 } } }), { or: [eligible, { id: { equals: 8 } }] })
  })

  it('hides the derived keys', () => {
    assert.equal(byName('registrationKey').admin?.hidden, true)
    assert.equal(byName('nameKey').admin?.hidden, true)
    assert.equal(byName('duplicateConfirmedFor').admin?.hidden, true)
  })

  it('shows the duplicate reason when ticked or when a reason is stored', () => {
    const condition = byName('duplicateReason').admin!.condition!
    assert.equal(condition({ duplicateConfirmed: true }), true)
    assert.equal(condition({ duplicateConfirmed: false, duplicateReason: 'x' }), true)
    assert.equal(condition({ duplicateConfirmed: false }), false)
  })

  it('lists the sales of the customer, with «Legg til» filling in the customer', () => {
    const join = byName('sales')
    assert.equal(join.type, 'join')
    assert.equal(join.collection, 'referral-sales')
    assert.equal(join.on, 'referredCustomer')
    assert.equal(join.label, 'Salg')
  })
})

describe('Partners — «Henviste kunder»', () => {
  const join = dataFields(Partners.fields).find((f) => f.name === 'referredCustomers')

  it('joins the referred customers on their partner', () => {
    assert.ok(join)
    assert.equal(join.type, 'join')
    assert.equal(join.collection, 'referred-customers')
    assert.equal(join.on, 'partner')
    assert.equal(join.label, 'Henviste kunder')
  })

  it('is shown for regular partners only', () => {
    const condition = join!.admin!.condition!
    assert.equal(condition({ partnerType: 'regular' }), true)
    assert.equal(condition({ partnerType: 'retailer' }), false)
    assert.equal(condition({}), false)
  })
})
