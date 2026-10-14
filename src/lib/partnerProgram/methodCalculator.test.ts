import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getLineTotalOere } from '@/lib/quantityPricing'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
  calculateBusinessSaleExample,
  calculateRetailerExample,
  normalizeOrders,
  normalizeQuantity,
} from './methodCalculator'

// Catalogue prices as stated in QUANTITY_PRICING's comments.
const OFFICE = { slug: 'aboks-office', price: 549 } // 499 from 10, 449 from 20, quote at 40
const ABOKS = { slug: 'aboks', price: 449 } // 399 from 10, 349 from 20
const XL = { slug: 'aboks-xl', price: 849 } // 799 from 4, 749 from 7, quote at 11
const ACCESSORY = { slug: 'aa-modul', price: 99 } // no quantity pricing

describe('programme terms', () => {
  it('are the published rates', () => {
    assert.equal(BUSINESS_SALE_COMMISSION_PERCENT, 25)
    assert.equal(RETAILER_DISCOUNT_PERCENT, 35)
    assert.equal(RETAILER_COMMISSION_PERCENT, 15)
  })
})

describe('Bedriftssalg — volume price from the real tiers, 25 % of the paid goods value', () => {
  it('25 × aBoks Office: 13 725 → 11 225 paid → 2 806,25 kr commission', () => {
    const o = calculateBusinessSaleExample(OFFICE, 25)
    assert.equal(o.listUnitOere, 54_900)
    assert.equal(o.ordinaryOere, 1_372_500)
    assert.equal(o.paidOere, 1_122_500)
    assert.equal(o.discountOere, 250_000)
    assert.equal(o.commissionOere, 280_625)
    assert.equal(o.retainedOere, 841_875)
    assert.equal(o.tierRange, '20+ stk.')
    assert.equal(o.isVolumeTier, true)
    assert.equal(o.quoteOffered, false)
  })

  it('pays exactly the line total the shop charges, at every quantity', () => {
    for (const product of [OFFICE, ABOKS, XL, ACCESSORY]) {
      for (const qty of [1, 3, 4, 9, 10, 19, 20, 39, 40, 250]) {
        const o = calculateBusinessSaleExample(product, qty)
        assert.equal(o.paidOere, getLineTotalOere(product, qty))
        assert.equal(o.ordinaryOere - o.discountOere, o.paidOere)
        assert.equal(o.commissionOere + o.retainedOere, o.paidOere)
      }
    }
  })

  it('has no volume discount below the first band, and none for an unconfigured product', () => {
    assert.equal(calculateBusinessSaleExample(OFFICE, 9).discountOere, 0)
    assert.equal(calculateBusinessSaleExample(OFFICE, 9).isVolumeTier, false)
    assert.equal(calculateBusinessSaleExample(ACCESSORY, 500).discountOere, 0)
  })

  it('flags the quote threshold without changing the price', () => {
    const at39 = calculateBusinessSaleExample(OFFICE, 39)
    const at40 = calculateBusinessSaleExample(OFFICE, 40)
    assert.equal(at39.quoteOffered, false)
    assert.equal(at40.quoteOffered, true)
    assert.equal(at40.paidUnitOere, at39.paidUnitOere)
    assert.equal(calculateBusinessSaleExample(XL, 11).quoteOffered, true)
  })
})

describe('Forhandlersalg — 35 % off the ordinary price, replacing volume tiers; 15 % commission', () => {
  it('20 × aBoks: 8 980 − 3 143 = 5 837 paid → 875,55 kr commission', () => {
    const { perOrder: o } = calculateRetailerExample(ABOKS, 20)
    assert.equal(o.ordinaryOere, 898_000)
    assert.equal(o.discountOere, 314_300)
    assert.equal(o.paidOere, 583_700)
    assert.equal(o.commissionOere, 87_555)
    assert.equal(o.retainedOere, 496_145)
  })

  it('never stacks with the volume tiers', () => {
    for (const qty of [1, 10, 20, 100]) {
      const { perOrder: o } = calculateRetailerExample(OFFICE, qty)
      // Always 35 % of the ordinary (1–n band) price, whatever band the quantity is in.
      assert.equal(o.ordinaryOere, 54_900 * qty)
      assert.equal(o.discountOere, Math.round(o.ordinaryOere * 0.35))
    }
  })

  it('uses the regular catalogue price, never an active sale price', () => {
    // No dates → the sale is active now; the shop would charge 299 for one unit.
    const onSale = { ...ABOKS, sale: { salePrice: 299 } }
    const { perOrder: o } = calculateRetailerExample(onSale, 20)
    assert.equal(o.listUnitOere, 44_900)
    assert.equal(o.ordinaryOere, 898_000)
    assert.equal(o.paidOere, 583_700)
    assert.equal(o.commissionOere, 87_555)
    // Identical to the same product without a sale.
    assert.deepEqual(o, calculateRetailerExample(ABOKS, 20).perOrder)
  })

  it('applies the same 15 % to every subsequent order', () => {
    const { perOrder, total, orders } = calculateRetailerExample(ABOKS, 20, 4)
    assert.equal(orders, 4)
    assert.equal(total.commissionOere, perOrder.commissionOere * 4)
    assert.equal(total.paidOere, perOrder.paidOere * 4)
    assert.equal(total.listUnitOere, perOrder.listUnitOere)
  })

  it('every split adds back up, in whole øre', () => {
    for (const product of [OFFICE, ABOKS, XL, ACCESSORY]) {
      for (const qty of [1, 3, 7, 33]) {
        const { perOrder: o } = calculateRetailerExample(product, qty)
        assert.equal(o.ordinaryOere - o.discountOere, o.paidOere)
        assert.equal(o.commissionOere + o.retainedOere, o.paidOere)
        for (const value of Object.values(o)) assert.ok(Number.isInteger(value))
      }
    }
  })
})

describe('input normalisation', () => {
  it('clamps and defaults instead of throwing', () => {
    assert.equal(normalizeQuantity(Number.NaN), 1)
    assert.equal(normalizeQuantity(0), 1)
    assert.equal(normalizeQuantity(2.6), 3)
    assert.equal(normalizeQuantity(1_000_000), 9999)
    assert.equal(normalizeOrders(-1), 1)
    assert.equal(normalizeOrders(500), 52)
  })

  it('has no VAT or shipping field', () => {
    const keys = [
      ...Object.keys(calculateBusinessSaleExample(OFFICE, 25)),
      ...Object.keys(calculateRetailerExample(ABOKS, 20).perOrder),
    ]
    for (const key of keys) assert.doesNotMatch(key, /vat|mva|shipping|frakt/i)
  })
})
