import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeDefaultShipping, computeKustomFee, deriveLine } from './orderSnapshot'
import type { EconomySetting } from '@/payload-types'

const settings = (over: Partial<EconomySetting> = {}): EconomySetting =>
  ({ id: 1, updatedAt: '', createdAt: '', ...over }) as EconomySetting

describe('deriveLine', () => {
  it('returns nulls when unitCost is missing (old order line)', () => {
    assert.deepEqual(deriveLine({ quantity: 2, lineTotal: 250, vatRate: 25 }), {
      lineCost: null,
      lineProfit: null,
    })
  })

  it('computes lineCost and VAT-adjusted lineProfit', () => {
    // 250 incl 25% VAT → net 200 ; cost 40*2 = 80 ; profit 120
    assert.deepEqual(deriveLine({ unitCost: 40, quantity: 2, lineTotal: 250, vatRate: 25 }), {
      lineCost: 80,
      lineProfit: 120,
    })
  })

  it('treats 0% VAT as no adjustment', () => {
    assert.deepEqual(deriveLine({ unitCost: 40, quantity: 1, lineTotal: 100, vatRate: 0 }), {
      lineCost: 40,
      lineProfit: 60,
    })
  })

  it('defaults a missing vatRate to 0', () => {
    assert.deepEqual(deriveLine({ unitCost: 10, quantity: 3, lineTotal: 90 }), {
      lineCost: 30,
      lineProfit: 60,
    })
  })
})

describe('computeKustomFee', () => {
  const order = { total: 1000, subtotal: 900, shipping: 100 }

  it('returns null when automation is disabled', () => {
    assert.equal(computeKustomFee(settings({ kustomEnabled: false, fixedFee: 5 }), order), null)
    assert.equal(computeKustomFee(null, order), null)
  })

  it('fixed fee only', () => {
    assert.equal(computeKustomFee(settings({ kustomEnabled: true, fixedFee: 4, percentageFee: 0 }), order), 4)
  })

  it('percentage fee only (base = order total incl. shipping)', () => {
    // 1.5% of 1000 = 15
    assert.equal(
      computeKustomFee(settings({ kustomEnabled: true, percentageFee: 1.5, calculateFrom: 'orderTotalInclShipping' }), order),
      15,
    )
  })

  it('combined fixed + percentage', () => {
    // 3 + 2% of 1000 = 3 + 20 = 23
    assert.equal(
      computeKustomFee(settings({ kustomEnabled: true, fixedFee: 3, percentageFee: 2, calculateFrom: 'orderTotalInclShipping' }), order),
      23,
    )
  })

  it('base = product total only excludes shipping', () => {
    // 2% of subtotal 900 = 18
    assert.equal(
      computeKustomFee(settings({ kustomEnabled: true, percentageFee: 2, calculateFrom: 'productTotalOnly' }), order),
      18,
    )
  })

  it('feeVatRate is NOT added on top of the fee', () => {
    const withVat = computeKustomFee(
      settings({ kustomEnabled: true, fixedFee: 3, percentageFee: 2, feeVatRate: 25, calculateFrom: 'orderTotalInclShipping' }),
      order,
    )
    // still 23 — feeVatRate never inflates the stored fee
    assert.equal(withVat, 23)
  })
})

describe('computeDefaultShipping', () => {
  it('returns null when automation is disabled', () => {
    assert.equal(computeDefaultShipping(settings({ applyDefaultShippingCost: false, defaultShippingCost: 50 }), { shipping: 0 }), null)
    assert.equal(computeDefaultShipping(null, { shipping: 0 }), null)
  })

  it('applies the default cost even when the customer paid for shipping', () => {
    assert.equal(
      computeDefaultShipping(settings({ applyDefaultShippingCost: true, defaultShippingCost: 50, freeShippingStillHasCost: true }), { shipping: 69 }),
      50,
    )
  })

  it('free shipping to the customer still costs the business by default', () => {
    assert.equal(
      computeDefaultShipping(settings({ applyDefaultShippingCost: true, defaultShippingCost: 50, freeShippingStillHasCost: true }), { shipping: 0 }),
      50,
    )
  })

  it('free shipping costs 0 when freeShippingStillHasCost is off', () => {
    assert.equal(
      computeDefaultShipping(settings({ applyDefaultShippingCost: true, defaultShippingCost: 50, freeShippingStillHasCost: false }), { shipping: 0 }),
      0,
    )
  })
})
