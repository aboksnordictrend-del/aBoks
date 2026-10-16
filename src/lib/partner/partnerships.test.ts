import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'
import {
  DROPSHIPPING_DISCOUNT_PERCENT,
  PARTNERSHIP_DEFAULT_PERCENT,
  PARTNERSHIP_KIND,
  PARTNERSHIP_TYPES,
  PARTNERSHIP_TYPE_OPTIONS,
  PURCHASE_DISCOUNTS_STACK,
  WHOLESALE_DISCOUNT_PERCENT,
  hasPartnershipType,
  selectedPartnershipTypes,
  validatePartnershipPercent,
} from './partnerships'

/**
 * The partnership vocabulary: five models, their Norwegian labels, and the programme terms
 * they default to. These tests pin the business terms the user approved, so a changed number
 * or a merged label fails loudly instead of quietly changing what a partner is offered.
 */

const labelOf = (value: string) => PARTNERSHIP_TYPE_OPTIONS.find((o) => o.value === value)?.label

describe('partnerships — the five models', () => {
  it('has exactly the three existing and two new models', () => {
    assert.deepEqual(
      [...PARTNERSHIP_TYPES],
      ['promoCode', 'businessSale', 'retailerReferral', 'dropshipping', 'wholesale'],
    )
  })

  it('labels every model in Norwegian, one option per model', () => {
    assert.deepEqual(
      PARTNERSHIP_TYPE_OPTIONS.map((o) => o.value),
      [...PARTNERSHIP_TYPES],
    )
    assert.equal(labelOf('promoCode'), 'Promokode')
    assert.equal(labelOf('businessSale'), 'Bedriftssalg')
    assert.equal(labelOf('retailerReferral'), 'Forhandlersalg')
    assert.equal(labelOf('dropshipping'), 'Dropshipping')
    assert.equal(labelOf('wholesale'), 'Forhandlerinnkjøp')
  })

  it('keeps Forhandlersalg (referral) and Forhandlerinnkjøp (purchase) distinct', () => {
    assert.notEqual(labelOf('retailerReferral'), labelOf('wholesale'))
    assert.equal(PARTNERSHIP_KIND.retailerReferral, 'commission')
    assert.equal(PARTNERSHIP_KIND.wholesale, 'discount')
  })

  it('classifies the three existing models as commission and the two new as discount', () => {
    assert.equal(PARTNERSHIP_KIND.promoCode, 'commission')
    assert.equal(PARTNERSHIP_KIND.businessSale, 'commission')
    assert.equal(PARTNERSHIP_KIND.retailerReferral, 'commission')
    assert.equal(PARTNERSHIP_KIND.dropshipping, 'discount')
    assert.equal(PARTNERSHIP_KIND.wholesale, 'discount')
  })
})

describe('partnerships — programme terms', () => {
  it('defaults the existing referral models to the /bli-partner rates', () => {
    assert.equal(PARTNERSHIP_DEFAULT_PERCENT.businessSale, BUSINESS_SALE_COMMISSION_PERCENT)
    assert.equal(PARTNERSHIP_DEFAULT_PERCENT.retailerReferral, RETAILER_COMMISSION_PERCENT)
    assert.equal(PARTNERSHIP_DEFAULT_PERCENT.businessSale, 25)
    assert.equal(PARTNERSHIP_DEFAULT_PERCENT.retailerReferral, 15)
  })

  it('defaults Dropshipping to 20 % and Forhandlerinnkjøp to 35 %', () => {
    assert.equal(DROPSHIPPING_DISCOUNT_PERCENT, 20)
    assert.equal(PARTNERSHIP_DEFAULT_PERCENT.dropshipping, 20)
    assert.equal(WHOLESALE_DISCOUNT_PERCENT, 35)
    assert.equal(PARTNERSHIP_DEFAULT_PERCENT.wholesale, 35)
    // Same retailer price rule as the public page — one constant, not two copies.
    assert.equal(WHOLESALE_DISCOUNT_PERCENT, RETAILER_DISCOUNT_PERCENT)
  })

  it('stores no promo-code rate: the rate on each promo code stays authoritative', () => {
    assert.equal('promoCode' in PARTNERSHIP_DEFAULT_PERCENT, false)
  })

  it('declares that purchase discounts never stack', () => {
    assert.equal(PURCHASE_DISCOUNTS_STACK, false)
  })
})

describe('partnerships — validatePartnershipPercent', () => {
  const selected = { selected: true, label: 'Dropshipping – rabatt' }
  const unselected = { selected: false, label: 'Dropshipping – rabatt' }

  it('ignores the value entirely while the model is not selected', () => {
    for (const value of [undefined, null, '', -5, 500, 'abc', Number.NaN]) {
      assert.equal(validatePartnershipPercent(value, unselected), true)
    }
  })

  it('requires a value once the model is selected', () => {
    assert.match(String(validatePartnershipPercent(undefined, selected)), /må fylles ut/)
    assert.match(String(validatePartnershipPercent(null, selected)), /må fylles ut/)
    assert.match(String(validatePartnershipPercent('', selected)), /må fylles ut/)
  })

  it('refuses non-numbers and values outside 0–100', () => {
    assert.match(String(validatePartnershipPercent('20', selected)), /må være et tall/)
    assert.match(String(validatePartnershipPercent(Number.NaN, selected)), /må være et tall/)
    assert.match(String(validatePartnershipPercent(-0.01, selected)), /negativ/)
    assert.match(String(validatePartnershipPercent(100.01, selected)), /høyere enn 100/)
  })

  it('accepts the bounds and ordinary rates', () => {
    for (const value of [0, 12.5, 20, 35, 100]) {
      assert.equal(validatePartnershipPercent(value, selected), true)
    }
  })

  it('names the field in its message', () => {
    assert.match(String(validatePartnershipPercent(undefined, selected)), /^Dropshipping – rabatt/)
  })
})

describe('partnerships — reading the selection', () => {
  it('returns the known models a document has selected', () => {
    assert.deepEqual(selectedPartnershipTypes({ partnershipTypes: ['wholesale', 'promoCode'] }), [
      'wholesale',
      'promoCode',
    ])
  })

  it('supports several models at once', () => {
    const data = { partnershipTypes: ['promoCode', 'retailerReferral', 'wholesale'] }
    assert.equal(hasPartnershipType(data, 'promoCode'), true)
    assert.equal(hasPartnershipType(data, 'retailerReferral'), true)
    assert.equal(hasPartnershipType(data, 'wholesale'), true)
    assert.equal(hasPartnershipType(data, 'dropshipping'), false)
  })

  it('tolerates missing, malformed and unknown values', () => {
    assert.deepEqual(selectedPartnershipTypes(undefined), [])
    assert.deepEqual(selectedPartnershipTypes(null), [])
    assert.deepEqual(selectedPartnershipTypes({}), [])
    assert.deepEqual(selectedPartnershipTypes({ partnershipTypes: 'promoCode' }), [])
    assert.deepEqual(selectedPartnershipTypes({ partnershipTypes: ['nope', 7, 'dropshipping'] }), [
      'dropshipping',
    ])
  })
})
