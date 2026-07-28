import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMMISSION_BASE_INCLUDES_VAT,
  COMMISSION_EXCLUDES_SHIPPING,
  DEFAULT_COMMISSION_BASE,
} from './constants'
import {
  calculateCommission,
  isCommissionBase,
  toCommissionSnapshotKr,
  validateCommissionRate,
  type CommissionInput,
} from './commission'

/* ------------------------------ fixtures ------------------------------ */

/**
 * The same figures the promo tests use: one 449,00 kr item, 10 % off, 69,00 kr shipping.
 * Merchandise after discount is 404,10 kr, so 10 % commission is 40,41 kr — the worked
 * example in the spec.
 */
const SUBTOTAL_OERE = 44_900
const DISCOUNT_OERE = 4_490
const SHIPPING_OERE = 6_900

function partner(overrides: Partial<CommissionInput> = {}): CommissionInput {
  return {
    isPartnerCode: true,
    commissionRate: 10,
    commissionBase: 'orderAfterDiscount',
    subtotalBeforeDiscountOere: SUBTOTAL_OERE,
    discountAmountOere: DISCOUNT_OERE,
    shippingOere: SHIPPING_OERE,
    ...overrides,
  }
}

/* ------------------------------ 1. ordinary codes ------------------------------ */

describe('calculateCommission — ordinary (non-partner) promo codes', () => {
  it('earns nothing, whatever the order looked like', () => {
    const result = calculateCommission({
      isPartnerCode: false,
      subtotalBeforeDiscountOere: SUBTOTAL_OERE,
      discountAmountOere: DISCOUNT_OERE,
      shippingOere: SHIPPING_OERE,
    })

    assert.equal(result.isPartnerCommission, false)
    assert.equal(result.commissionAmountOere, 0)
    assert.equal(result.commissionRate, 0)
    assert.equal(result.commissionBasisOere, 0)
  })

  it('earns nothing even when a stray rate and base are configured', () => {
    // A code converted back from partner to ordinary keeps its old columns. The flag decides.
    const result = calculateCommission({
      isPartnerCode: false,
      commissionRate: 25,
      commissionBase: 'orderBeforeDiscount',
      subtotalBeforeDiscountOere: SUBTOTAL_OERE,
      discountAmountOere: DISCOUNT_OERE,
    })

    assert.equal(result.commissionAmountOere, 0)
    assert.equal(result.commissionRate, 0)
  })

  it('treats an absent flag as an ordinary code', () => {
    for (const isPartnerCode of [undefined, null, false] as const) {
      const result = calculateCommission({
        isPartnerCode,
        commissionRate: 10,
        subtotalBeforeDiscountOere: SUBTOTAL_OERE,
      })
      assert.equal(result.commissionAmountOere, 0, `isPartnerCode=${String(isPartnerCode)}`)
    }
  })

  it('still records the full merchandise snapshot, and reports no anomalies', () => {
    const result = calculateCommission({
      isPartnerCode: false,
      subtotalBeforeDiscountOere: SUBTOTAL_OERE,
      discountAmountOere: DISCOUNT_OERE,
    })

    assert.equal(result.merchandiseBeforeDiscountOere, 44_900)
    assert.equal(result.merchandiseAfterDiscountOere, 40_410)
    assert.equal(result.discountAmountOere, 4_490)
    // A missing rate on an ordinary code is normal, not an anomaly worth logging.
    assert.deepEqual(result.adjustments, [])
  })
})

/* ------------------------------ 2–3. the two bases ------------------------------ */

describe('calculateCommission — commission base', () => {
  it('orderAfterDiscount: 10 % of 404,10 kr is 40,41 kr', () => {
    const result = calculateCommission(partner())

    assert.equal(result.isPartnerCommission, true)
    assert.equal(result.merchandiseAfterDiscountOere, 40_410)
    assert.equal(result.commissionBasisOere, 40_410)
    assert.equal(result.commissionAmountOere, 4_041)
    assert.equal(result.commissionBase, 'orderAfterDiscount')
    assert.deepEqual(result.adjustments, [])
  })

  it('orderBeforeDiscount: 10 % of 449,00 kr is 44,90 kr', () => {
    const result = calculateCommission(partner({ commissionBase: 'orderBeforeDiscount' }))

    assert.equal(result.commissionBasisOere, 44_900)
    assert.equal(result.commissionAmountOere, 4_490)
    assert.equal(result.commissionBase, 'orderBeforeDiscount')
  })

  it('an absent base is the default, and is not reported as an anomaly', () => {
    const result = calculateCommission(partner({ commissionBase: undefined }))

    assert.equal(result.commissionBase, DEFAULT_COMMISSION_BASE)
    assert.equal(result.commissionAmountOere, 4_041)
    assert.deepEqual(result.adjustments, [])
  })

  it('the two bases agree exactly when there is no discount', () => {
    const after = calculateCommission(
      partner({ discountAmountOere: 0, commissionBase: 'orderAfterDiscount' }),
    )
    const before = calculateCommission(
      partner({ discountAmountOere: 0, commissionBase: 'orderBeforeDiscount' }),
    )

    assert.equal(after.commissionAmountOere, 4_490)
    assert.equal(before.commissionAmountOere, after.commissionAmountOere)
  })
})

/* ------------------------------ 4. shipping ------------------------------ */

describe('calculateCommission — shipping is excluded', () => {
  it('is declared excluded', () => {
    assert.equal(COMMISSION_EXCLUDES_SHIPPING, true)
  })

  it('produces an identical commission for every shipping amount', () => {
    // Free shipping, standard shipping, and an absurd one — the merchandise is unchanged, so
    // the commission must be too.
    const shippings = [0, 6_900, 99_900, undefined, null] as const

    const results = shippings.map((shippingOere) =>
      calculateCommission(partner({ shippingOere })),
    )

    for (const result of results) {
      assert.equal(result.commissionAmountOere, 4_041)
      assert.equal(result.commissionBasisOere, 40_410)
      assert.equal(result.merchandiseBeforeDiscountOere, 44_900)
    }
  })

  it('echoes shipping through for the audit snapshot without ever using it', () => {
    const result = calculateCommission(partner({ shippingOere: 6_900 }))

    assert.equal(result.shippingOere, 6_900)
    // Present in the result, absent from every base.
    assert.equal(result.commissionBasisOere, 40_410)
    assert.equal(result.commissionAmountOere, 4_041)
  })

  it('normalises a corrupt shipping value to 0 without raising an adjustment', () => {
    // It cannot influence a payout, so it must not trigger an integrity warning.
    for (const shippingOere of [-100, 69.5, Number.NaN]) {
      const result = calculateCommission(partner({ shippingOere }))
      assert.equal(result.shippingOere, 0)
      assert.deepEqual(result.adjustments, [])
      assert.equal(result.commissionAmountOere, 4_041)
    }
  })

  it('never lets shipping reach the before-discount base either', () => {
    const withShipping = calculateCommission(
      partner({ commissionBase: 'orderBeforeDiscount', shippingOere: 12_300 }),
    )
    const withoutShipping = calculateCommission(
      partner({ commissionBase: 'orderBeforeDiscount', shippingOere: 0 }),
    )

    assert.equal(withShipping.commissionAmountOere, withoutShipping.commissionAmountOere)
    assert.equal(withShipping.commissionAmountOere, 4_490)
  })
})

/* ------------------------------ 5. negative bases ------------------------------ */

describe('calculateCommission — the merchandise base can never go negative', () => {
  it('floors the after-discount base at zero when the discount is larger', () => {
    const result = calculateCommission(
      partner({ subtotalBeforeDiscountOere: 10_000, discountAmountOere: 15_000 }),
    )

    assert.equal(result.merchandiseAfterDiscountOere, 0)
    assert.equal(result.commissionAmountOere, 0)
    assert.ok(result.adjustments.includes('discount_exceeds_merchandise'))
  })

  it('a discount equal to the merchandise leaves nothing to earn on', () => {
    const result = calculateCommission(
      partner({ subtotalBeforeDiscountOere: 10_000, discountAmountOere: 10_000 }),
    )

    assert.equal(result.merchandiseAfterDiscountOere, 0)
    assert.equal(result.commissionAmountOere, 0)
    assert.deepEqual(result.adjustments, [])
  })

  it('but the before-discount base is unaffected by an oversized discount', () => {
    const result = calculateCommission(
      partner({
        commissionBase: 'orderBeforeDiscount',
        subtotalBeforeDiscountOere: 10_000,
        discountAmountOere: 15_000,
      }),
    )

    assert.equal(result.commissionBasisOere, 10_000)
    assert.equal(result.commissionAmountOere, 1_000)
  })
})

/* ------------------------------ 6–8. rates and rounding ------------------------------ */

describe('calculateCommission — rates', () => {
  it('0 % earns nothing, and is not an anomaly', () => {
    const result = calculateCommission(partner({ commissionRate: 0 }))

    assert.equal(result.commissionAmountOere, 0)
    assert.equal(result.commissionRate, 0)
    assert.equal(result.isPartnerCommission, true)
    assert.deepEqual(result.adjustments, [])
  })

  it('100 % hands over the whole base', () => {
    const result = calculateCommission(partner({ commissionRate: 100 }))

    assert.equal(result.commissionAmountOere, 40_410)
    assert.equal(result.commissionAmountOere, result.commissionBasisOere)
  })

  it('handles a fractional percentage exactly', () => {
    // 12,5 % of 404,10 kr = 50,5125 kr → 5051 øre.
    const result = calculateCommission(partner({ commissionRate: 12.5 }))

    assert.equal(result.commissionAmountOere, 5_051)
    assert.equal(result.commissionRate, 12.5)
  })

  it('handles a percentage that is not exactly representable in binary', () => {
    // 12,3 × 100 is 1229.999… in IEEE-754; it must still become 1230 basis points.
    const result = calculateCommission(
      partner({ commissionRate: 12.3, subtotalBeforeDiscountOere: 10_000, discountAmountOere: 0 }),
    )

    assert.equal(result.commissionRate, 12.3)
    assert.equal(result.commissionAmountOere, 1_230)
  })

  it('rounds a half øre up, deterministically', () => {
    // 5 % of 10 øre = 0,5 øre.
    const result = calculateCommission(
      partner({ commissionRate: 5, subtotalBeforeDiscountOere: 10, discountAmountOere: 0 }),
    )

    assert.equal(result.commissionAmountOere, 1)
  })

  it('rounds to the nearest øre, both directions', () => {
    // 15 % of 333 øre = 49,95 → 50.  10 % of 333 øre = 33,3 → 33.
    const up = calculateCommission(
      partner({ commissionRate: 15, subtotalBeforeDiscountOere: 333, discountAmountOere: 0 }),
    )
    const down = calculateCommission(
      partner({ commissionRate: 10, subtotalBeforeDiscountOere: 333, discountAmountOere: 0 }),
    )

    assert.equal(up.commissionAmountOere, 50)
    assert.equal(down.commissionAmountOere, 33)
  })

  it('always returns whole øre', () => {
    for (const rate of [1, 3.33, 7.77, 12.5, 33.33, 66.67, 99.99]) {
      const result = calculateCommission(partner({ commissionRate: rate }))
      assert.ok(
        Number.isInteger(result.commissionAmountOere),
        `rate ${rate} produced ${result.commissionAmountOere}`,
      )
    }
  })
})

/* ------------------------------ 9–10. invalid configuration ------------------------------ */

describe('calculateCommission — invalid configuration fails closed', () => {
  it('a partner code with no rate earns nothing and reports it', () => {
    for (const commissionRate of [undefined, null] as const) {
      const result = calculateCommission(partner({ commissionRate }))
      assert.equal(result.commissionAmountOere, 0)
      assert.ok(result.adjustments.includes('rate_missing'))
    }
  })

  it('a non-finite rate earns nothing', () => {
    for (const commissionRate of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = calculateCommission(partner({ commissionRate }))
      assert.equal(result.commissionAmountOere, 0)
      assert.ok(result.adjustments.includes('rate_not_finite'))
    }
  })

  it('a rate above 100 % earns NOTHING — it is never clamped up to the maximum', () => {
    const result = calculateCommission(partner({ commissionRate: 5_000 }))

    assert.equal(result.commissionAmountOere, 0)
    assert.equal(result.commissionRate, 0)
    assert.ok(result.adjustments.includes('rate_out_of_range'))
  })

  it('a negative rate earns nothing', () => {
    const result = calculateCommission(partner({ commissionRate: -10 }))

    assert.equal(result.commissionAmountOere, 0)
    assert.ok(result.adjustments.includes('rate_out_of_range'))
  })

  it('an unrecognised base degrades to the smaller (after-discount) base and reports it', () => {
    const result = calculateCommission(partner({ commissionBase: 'orderPlusShipping' }))

    assert.equal(result.commissionBase, DEFAULT_COMMISSION_BASE)
    assert.equal(result.commissionBasisOere, 40_410)
    assert.equal(result.commissionAmountOere, 4_041)
    assert.ok(result.adjustments.includes('base_unrecognised'))
  })

  it('a corrupt merchandise subtotal earns nothing', () => {
    for (const subtotalBeforeDiscountOere of [-100, 449.5, Number.NaN]) {
      const result = calculateCommission(partner({ subtotalBeforeDiscountOere }))
      assert.equal(result.merchandiseBeforeDiscountOere, 0)
      assert.equal(result.commissionAmountOere, 0)
      assert.ok(result.adjustments.includes('subtotal_invalid'))
    }
  })

  it('a corrupt discount is treated as no discount', () => {
    const result = calculateCommission(partner({ discountAmountOere: -500 }))

    assert.equal(result.discountAmountOere, 0)
    assert.equal(result.merchandiseAfterDiscountOere, 44_900)
    assert.ok(result.adjustments.includes('discount_invalid'))
  })

  it('never throws, for any input at all', () => {
    const nonsense: unknown[] = [
      {},
      { isPartnerCode: true },
      { isPartnerCode: true, commissionRate: '10', commissionBase: 42 },
      { isPartnerCode: 'yes', subtotalBeforeDiscountOere: '44900' },
      { isPartnerCode: true, subtotalBeforeDiscountOere: Number.MAX_SAFE_INTEGER, commissionRate: 100 },
    ]

    for (const input of nonsense) {
      assert.doesNotThrow(() => calculateCommission(input as CommissionInput))
    }
  })
})

/* ------------------------------ 11. large values ------------------------------ */

describe('calculateCommission — large but realistic values', () => {
  it('has no floating-point drift at 99 999 kr', () => {
    // 12,5 % of 99 999,00 kr = 12 499,875 kr → 1 249 988 øre.
    const result = calculateCommission(
      partner({
        commissionRate: 12.5,
        subtotalBeforeDiscountOere: 9_999_900,
        discountAmountOere: 0,
      }),
    )

    assert.equal(result.commissionAmountOere, 1_249_988)
  })

  it('stays within safe-integer arithmetic', () => {
    const result = calculateCommission(
      partner({
        commissionRate: 100,
        subtotalBeforeDiscountOere: 100_000_000, // 1 000 000 kr
        discountAmountOere: 0,
      }),
    )

    assert.equal(result.commissionAmountOere, 100_000_000)
    assert.ok(Number.isSafeInteger(result.commissionAmountOere))
  })

  it('a hundred separate orders sum to the same figure as one big one', () => {
    // Integer øre throughout means a running total cannot drift the way decimal kroner would.
    let sum = 0
    for (let i = 0; i < 100; i++) {
      sum += calculateCommission(
        partner({ commissionRate: 7.5, subtotalBeforeDiscountOere: 33_333, discountAmountOere: 0 }),
      ).commissionAmountOere
    }

    // 7,5 % of 33 333 øre = 2 499,975 → 2 500 each.
    assert.equal(sum, 250_000)
  })
})

/* ------------------------------ 12. VAT ------------------------------ */

describe('calculateCommission — gross amounts including VAT', () => {
  it('is declared VAT-inclusive', () => {
    assert.equal(COMMISSION_BASE_INCLUDES_VAT, true)
  })

  it('applies the rate to the gross merchandise amount, with no VAT deduction', () => {
    // 449,00 kr gross contains 89,80 kr VAT at 25 %; the net amount is 359,20 kr.
    // 10 % of gross is 44,90 kr — NOT the 35,92 kr a net base would give.
    const result = calculateCommission(
      partner({ commissionBase: 'orderBeforeDiscount', discountAmountOere: 0 }),
    )

    assert.equal(result.commissionAmountOere, 4_490)
    assert.notEqual(result.commissionAmountOere, 3_592)
  })
})

/* ------------------------------ admin input validation ------------------------------ */

describe('validateCommissionRate', () => {
  it('accepts a rate inside the range', () => {
    for (const rate of [0, 0.5, 10, 12.5, 100]) {
      assert.deepEqual(validateCommissionRate(rate, { required: true }), { ok: true, rate })
    }
  })

  it('requires a rate on a partner code', () => {
    const result = validateCommissionRate(undefined, { required: true })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.problem, 'missing')
      assert.match(result.message, /Provisjon/)
    }
  })

  it('allows an empty rate on an ordinary code, reading it as 0 %', () => {
    assert.deepEqual(validateCommissionRate(undefined), { ok: true, rate: 0 })
    assert.deepEqual(validateCommissionRate(null), { ok: true, rate: 0 })
    assert.deepEqual(validateCommissionRate(''), { ok: true, rate: 0 })
  })

  it('rejects out-of-range and non-numeric rates with a Norwegian message', () => {
    const cases: [unknown, string][] = [
      [-1, 'below_minimum'],
      [100.01, 'above_maximum'],
      [Number.NaN, 'not_a_number'],
      ['10', 'not_a_number'],
    ]

    for (const [value, problem] of cases) {
      const result = validateCommissionRate(value, { required: true })
      assert.equal(result.ok, false, `expected ${String(value)} to be rejected`)
      if (!result.ok) {
        assert.equal(result.problem, problem)
        assert.ok(result.message.length > 0)
      }
    }
  })
})

describe('isCommissionBase', () => {
  it('recognises exactly the two configured bases', () => {
    assert.equal(isCommissionBase('orderAfterDiscount'), true)
    assert.equal(isCommissionBase('orderBeforeDiscount'), true)
  })

  it('rejects anything else', () => {
    for (const value of ['orderTotal', '', null, undefined, 0, {}]) {
      assert.equal(isCommissionBase(value), false)
    }
  })
})

/* ------------------------------ storage boundary ------------------------------ */

describe('toCommissionSnapshotKr', () => {
  it('converts every amount to decimal kroner, exactly', () => {
    const snapshot = toCommissionSnapshotKr(calculateCommission(partner()))

    assert.deepEqual(snapshot, {
      orderAmountBeforeDiscount: 449,
      discountAmount: 44.9,
      orderAmountAfterDiscount: 404.1,
      shippingAmount: 69,
      commissionRateSnapshot: 10,
      commissionBaseSnapshot: 'orderAfterDiscount',
      commissionAmount: 40.41,
    })
  })

  it('zeroes the commission fields for an ordinary code while keeping the amounts', () => {
    const snapshot = toCommissionSnapshotKr(
      calculateCommission({
        isPartnerCode: false,
        subtotalBeforeDiscountOere: SUBTOTAL_OERE,
        discountAmountOere: DISCOUNT_OERE,
      }),
    )

    assert.equal(snapshot.commissionAmount, 0)
    assert.equal(snapshot.commissionRateSnapshot, 0)
    assert.equal(snapshot.orderAmountAfterDiscount, 404.1)
  })
})
