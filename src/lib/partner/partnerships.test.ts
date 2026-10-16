import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PARTNER_COMMISSION_PERCENT, PARTNER_DISCOUNT_PERCENT } from '@/lib/partnerProgram/calculator'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'
import {
  DROPSHIPPING_DISCOUNT_PERCENT,
  LEGACY_PARTNERSHIP_TYPE_OPTIONS,
  OPTIONAL_AGREEMENTS,
  PARTNER_TYPE_OPTIONS,
  PARTNER_TYPES,
  PROMO_LINK_ELIGIBLE_STATUS,
  PROMO_LINK_ELIGIBLE_TYPE,
  STANDARD_METHODS_NOTE,
  isPartnerType,
  PURCHASE_DISCOUNTS_STACK,
  STANDARD_EARNING_METHODS,
  WHOLESALE_DISCOUNT_PERCENT,
  isAgreementEnabled,
  validateAgreementPercent,
} from './partnerships'

/**
 * The partner programme vocabulary: one programme, three standard earning methods every partner
 * has, two optional agreements. These tests pin the established business terms so a changed
 * number, a merged label or a fourth "programme" fails loudly.
 */

const method = (id: string) => STANDARD_EARNING_METHODS.find((m) => m.id === id)!
const agreement = (id: string) => OPTIONAL_AGREEMENTS.find((a) => a.id === id)!

describe('partnerships — three standard earning methods', () => {
  it('has exactly Promokode, Bedriftssalg and Forhandlersalg, in that order', () => {
    assert.deepEqual(
      STANDARD_EARNING_METHODS.map((m) => [m.id, m.label]),
      [
        ['promoCode', 'Promokode'],
        ['businessSale', 'Bedriftssalg'],
        ['retailerReferral', 'Forhandlersalg'],
      ],
    )
  })

  it('shows the /bli-partner programme rates: 15 %, 25 %, 15 %', () => {
    assert.equal(method('promoCode').commissionPercent, PARTNER_COMMISSION_PERCENT)
    assert.equal(method('businessSale').commissionPercent, BUSINESS_SALE_COMMISSION_PERCENT)
    assert.equal(method('retailerReferral').commissionPercent, RETAILER_COMMISSION_PERCENT)
    assert.deepEqual(STANDARD_EARNING_METHODS.map((m) => m.commissionPercent), [15, 25, 15])
  })

  it('says the Promokode rate and base are set on each promo code', () => {
    assert.match(method('promoCode').description, /settes på hver enkelt rabattkode/)
    assert.match(method('promoCode').description, new RegExp(`${PARTNER_DISCOUNT_PERCENT} % rabatt`))
  })

  it('uses the agreed Bedriftssalg wording, with no customer discount', () => {
    assert.equal(method('businessSale').description, 'Partneren får 25 % provisjon av endelig betalt ordrebeløp.')
  })

  it('never lets a purchasing store earn Forhandlersalg on its own purchases', () => {
    assert.match(method('retailerReferral').description, /ingen provisjon på egne innkjøp/)
  })

  it('limits Forhandlersalg to physical stores — never online stores', () => {
    assert.match(method('retailerReferral').description, /fysisk butikk/)
    assert.match(method('retailerReferral').description, /ikke nettbutikker/)
  })

  it('presents the three methods as regular-partner benefits', () => {
    assert.match(STANDARD_METHODS_NOTE, /^Alle vanlige partnere/)
  })
})

describe('partnerships — two optional agreements', () => {
  it('has exactly Dropshipping and Forhandlerinnkjøp', () => {
    assert.deepEqual(
      OPTIONAL_AGREEMENTS.map((a) => [a.id, a.label]),
      [
        ['dropshipping', 'Dropshipping'],
        ['wholesale', 'Forhandlerinnkjøp'],
      ],
    )
  })

  it('defaults Dropshipping to 20 % and Forhandlerinnkjøp to 35 %', () => {
    assert.equal(DROPSHIPPING_DISCOUNT_PERCENT, 20)
    assert.equal(agreement('dropshipping').defaultDiscountPercent, 20)
    assert.equal(WHOLESALE_DISCOUNT_PERCENT, 35)
    assert.equal(agreement('wholesale').defaultDiscountPercent, 35)
    assert.equal(WHOLESALE_DISCOUNT_PERCENT, RETAILER_DISCOUNT_PERCENT, 'same retailer price rule as the public page')
  })

  it('maps each agreement to its own checkbox and discount field', () => {
    assert.deepEqual(
      OPTIONAL_AGREEMENTS.map((a) => [a.enabledField, a.percentField]),
      [
        ['dropshippingEnabled', 'dropshippingDiscountPercent'],
        ['wholesaleEnabled', 'wholesaleDiscountPercent'],
      ],
    )
  })

  it('states no commission on the online store’s own sales or purchases', () => {
    assert.match(agreement('dropshipping').description, /Ingen provisjon på nettbutikkens egne salg/)
    assert.match(agreement('wholesale').description, /Ingen provisjon på egne innkjøp/)
  })

  it('promises no referral commission for introducing an online store', () => {
    for (const a of OPTIONAL_AGREEMENTS) assert.doesNotMatch(a.description, /Forhandlersalg/, a.label)
  })

  it('declares that purchase discounts never stack', () => {
    assert.equal(PURCHASE_DISCOUNTS_STACK, false)
  })

  it('reads an agreement as in force only for an online retailer with an explicit true', () => {
    const dropshipping = agreement('dropshipping')
    assert.equal(isAgreementEnabled({ partnerType: 'retailer', dropshippingEnabled: true }, dropshipping), true)
    for (const data of [{ partnerType: 'retailer', dropshippingEnabled: false }, { partnerType: 'retailer', dropshippingEnabled: null }, { partnerType: 'retailer' }, null, undefined, { partnerType: 'retailer', dropshippingEnabled: 'true' }]) {
      assert.equal(isAgreementEnabled(data, dropshipping), false, JSON.stringify(data))
    }
  })

  it('never treats an agreement as in force for a regular or unclassified partner', () => {
    for (const partnerType of ['regular', null, undefined]) {
      assert.equal(isAgreementEnabled({ partnerType, dropshippingEnabled: true, wholesaleEnabled: true }, agreement('dropshipping')), false, String(partnerType))
      assert.equal(isAgreementEnabled({ partnerType, dropshippingEnabled: true, wholesaleEnabled: true }, agreement('wholesale')), false, String(partnerType))
    }
  })

  it('treats the two agreements independently', () => {
    const data = { partnerType: 'retailer', dropshippingEnabled: false, wholesaleEnabled: true }
    assert.equal(isAgreementEnabled(data, agreement('dropshipping')), false)
    assert.equal(isAgreementEnabled(data, agreement('wholesale')), true)
  })
})

describe('partnerships — validateAgreementPercent', () => {
  const enabled = { enabled: true, label: 'Dropshipping – rabatt' }
  const disabled = { enabled: false, label: 'Dropshipping – rabatt' }

  it('ignores the value while the agreement is disabled', () => {
    for (const value of [undefined, null, '', -5, 500, 'abc']) {
      assert.equal(validateAgreementPercent(value, disabled), true)
    }
  })

  it('requires a number within 0–100 once enabled', () => {
    assert.match(String(validateAgreementPercent(undefined, enabled)), /må fylles ut/)
    assert.match(String(validateAgreementPercent('20', enabled)), /må være et tall/)
    assert.match(String(validateAgreementPercent(-0.01, enabled)), /negativ/)
    assert.match(String(validateAgreementPercent(100.01, enabled)), /høyere enn 100/)
    for (const value of [0, 20, 35, 100]) assert.equal(validateAgreementPercent(value, enabled), true)
  })
})

describe('partnerships — eligibility and legacy values', () => {
  it('allows new promo-code links only to active regular partners', () => {
    assert.equal(PROMO_LINK_ELIGIBLE_STATUS, 'active')
    assert.equal(PROMO_LINK_ELIGIBLE_TYPE, 'regular')
  })

  it('has exactly two partner types, with Norwegian labels', () => {
    assert.deepEqual([...PARTNER_TYPES], ['regular', 'retailer'])
    assert.deepEqual(PARTNER_TYPE_OPTIONS.map((o) => [o.value, o.label]), [['regular', 'Vanlig partner'], ['retailer', 'Nettbutikk / Forhandler']])
    assert.equal(isPartnerType('regular'), true)
    for (const v of ['retail', '', null, undefined, 'promoCode']) assert.equal(isPartnerType(v), false, String(v))
  })

  it('keeps the legacy enum values exactly as the database created them', () => {
    assert.deepEqual(
      LEGACY_PARTNERSHIP_TYPE_OPTIONS.map((o) => o.value),
      ['promoCode', 'businessSale', 'retailerReferral', 'dropshipping', 'wholesale'],
    )
  })
})
