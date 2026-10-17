import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { ReferralSales } from './ReferralSales'
import { enforceReferralSaleRules, guardReferralSaleDelete } from './hooks/referralSale'

/**
 * The `referral-sales` collection config. The rules are tested in `./hooks/referralSale.test.ts`.
 */

type AnyField = Field & {
  name?: string
  fields?: Field[]
  required?: boolean
  defaultValue?: unknown
  options?: { label: string; value: string }[]
  filterOptions?: (args: unknown) => unknown
  relationTo?: string
  admin?: { readOnly?: boolean; hidden?: boolean; condition?: (data: unknown) => boolean }
}
type AccessFn = (args: { req: { user: unknown } }) => unknown

function dataFields(fields: Field[]): AnyField[] {
  return fields.flatMap((f) => {
    const field = f as AnyField
    if ((field.type === 'row' || field.type === 'collapsible') && field.fields) return dataFields(field.fields)
    return [field]
  })
}

const fields = dataFields(ReferralSales.fields)
const byName = (name: string) => {
  const field = fields.find((f) => f.name === name)
  assert.ok(field, `field ${name} must exist`)
  return field
}

describe('ReferralSales — collection', () => {
  it('is Norwegian, grouped with the partners, and versioned', () => {
    assert.equal(ReferralSales.labels?.plural, 'Henvisningssalg')
    assert.equal(ReferralSales.admin?.group, 'Partnere')
    assert.ok(ReferralSales.versions && typeof ReferralSales.versions === 'object')
  })

  it('wires the rules and the delete guard', () => {
    assert.deepEqual(ReferralSales.hooks?.beforeChange, [enforceReferralSaleRules])
    assert.deepEqual(ReferralSales.hooks?.beforeDelete, [guardReferralSaleDelete])
  })

  it('is admin-only; delete for role admin only', () => {
    const access = ReferralSales.access!
    for (const op of ['read', 'create', 'update'] as const) {
      assert.equal((access[op] as AccessFn)({ req: { user: null } }), false)
      assert.equal((access[op] as AccessFn)({ req: { user: { id: 2, role: 'editor' } } }), true)
    }
    assert.equal((access.delete as AccessFn)({ req: { user: { id: 2, role: 'editor' } } }), false)
    assert.equal((access.delete as AccessFn)({ req: { user: { id: 1, role: 'admin' } } }), true)
  })
})

describe('ReferralSales — fields', () => {
  it('requires the manually entered sale: customer, date, invoiced amount, VAT treatment, payment status', () => {
    for (const name of ['referredCustomer', 'saleDate', 'invoicedTotal', 'vatTreatment', 'paymentStatus']) {
      assert.equal(byName(name).required, true, name)
    }
  })

  it('shows every derived value read-only', () => {
    for (const name of ['partner', 'category', 'currency', 'commissionBase', 'commissionAmount', 'commissionStatus', 'closedAt', 'payout', 'promoCommissionOnOrder', 'createdBy']) {
      assert.equal(byName(name).admin?.readOnly, true, name)
    }
  })

  it('leaves eligibility and rate empty by default so the category standard applies', () => {
    assert.equal(byName('commissionEligibility').defaultValue, undefined)
    assert.equal(byName('commissionRate').defaultValue, undefined)
  })

  it('offers exactly two VAT treatments, neither keeping VAT in the base', () => {
    assert.deepEqual(byName('vatTreatment').options?.map((o) => o.value), ['noVat', 'vatDeducted'])
    assert.equal(byName('vatTreatment').defaultValue, undefined)
  })

  it('shows the VAT amount only for a VAT invoice', () => {
    const condition = byName('vatAmount').admin!.condition!
    assert.equal(condition({ vatTreatment: 'vatDeducted' }), true)
    assert.equal(condition({ vatTreatment: 'noVat' }), false)
  })

  it('labels the statuses in Norwegian', () => {
    assert.deepEqual(byName('paymentStatus').options?.map((o) => o.label), ['Venter på betaling', 'Betalt', 'Kansellert', 'Refundert'])
    assert.deepEqual(byName('commissionStatus').options?.map((o) => o.label), ['Venter', 'Opptjent', 'Utbetalt', 'Tilbakeført'])
  })

  it('offers only approved customers, plus the current one', () => {
    const filter = byName('referredCustomer').filterOptions!
    assert.deepEqual(filter({ data: {} }), { status: { equals: 'approved' } })
    assert.deepEqual(filter({ data: { referredCustomer: 3 } }), {
      or: [{ status: { equals: 'approved' } }, { id: { equals: 3 } }],
    })
  })

  it('links to the existing payout ledger without changing it', () => {
    assert.equal(byName('payout').relationTo, 'partner-payouts')
  })
})
