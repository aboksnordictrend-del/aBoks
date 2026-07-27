import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { shippingForSubtotalOere, type PricedCart, type PricedLine } from '@/lib/cartPricing'
import {
  KustomInvariantError,
  assertKustomOrderInvariants,
  assertLocalOrderParity,
  buildKustomOrder,
  kustomReferenceTaxOere,
  lineTaxOere,
  type KustomOrderBuild,
} from './kustomLines'
import type { PromoValidationSuccess } from './types'

/* ------------------------------ fixtures ------------------------------ */

function cartOf(...lines: { variantId: string; productId: string; unitKr: number; qty: number }[]): PricedCart {
  const priced: PricedLine[] = lines.map((l) => {
    const unitPriceOere = Math.round(l.unitKr * 100)
    const lineTotalOere = unitPriceOere * l.qty
    return {
      variantId: l.variantId,
      productId: l.productId,
      displayName: `aBoks – ${l.variantId}`,
      variantName: 'Farge',
      quantity: l.qty,
      unitPriceOere,
      lineTotalOere,
      unitPriceKr: unitPriceOere / 100,
      lineTotalKr: lineTotalOere / 100,
      inventory: 10,
    }
  })
  const subtotalOere = priced.reduce((s, l) => s + l.lineTotalOere, 0)
  const shippingOere = shippingForSubtotalOere(subtotalOere)
  const totalOere = subtotalOere + shippingOere
  return {
    lines: priced,
    subtotalOere,
    shippingOere,
    totalOere,
    subtotalKr: subtotalOere / 100,
    shippingKr: shippingOere / 100,
    totalKr: totalOere / 100,
    freeShipping: shippingOere === 0,
  }
}

/** A promo success shaped exactly as validatePromoCode returns it. */
function promoOf(
  cart: PricedCart,
  allocations: Record<string, number>,
  overrides: Partial<PromoValidationSuccess> = {},
): PromoValidationSuccess {
  const discountOere = Object.values(allocations).reduce((a, b) => a + b, 0)
  const lineDiscounts = Object.entries(allocations).map(([variantId, discountOere]) => ({
    variantId,
    productId: cart.lines.find((l) => l.variantId === variantId)?.productId ?? '1',
    discountOere,
    discountAmount: discountOere / 100,
  }))
  return {
    valid: true,
    promoCodeId: '7',
    code: 'WELCOME10',
    discountType: 'percentage',
    discountValue: 10,
    eligibleSubtotal: cart.subtotalKr,
    discountAmount: discountOere / 100,
    subtotalBeforeDiscount: cart.subtotalKr,
    subtotalAfterDiscount: (cart.subtotalOere - discountOere) / 100,
    shipping: cart.shippingKr,
    totalBeforeDiscount: cart.totalKr,
    totalAfterDiscount: (cart.totalOere - discountOere) / 100,
    eligibleSubtotalOere: cart.subtotalOere,
    discountAmountOere: discountOere,
    subtotalBeforeDiscountOere: cart.subtotalOere,
    subtotalAfterDiscountOere: cart.subtotalOere - discountOere,
    shippingOere: cart.shippingOere,
    totalBeforeDiscountOere: cart.totalOere,
    totalAfterDiscountOere: cart.totalOere - discountOere,
    lineDiscounts,
    ...overrides,
  }
}

const SINGLE = cartOf({ variantId: '10', productId: '1', unitKr: 449, qty: 1 })

const buildAndAssert = (cart: PricedCart, promo: PromoValidationSuccess | null) => {
  const build = buildKustomOrder(cart, promo)
  assertKustomOrderInvariants(build, cart, promo)
  return build
}

const invariantCode = (fn: () => void): string => {
  try {
    fn()
  } catch (err) {
    assert.ok(err instanceof KustomInvariantError, 'must be a KustomInvariantError')
    return err.code
  }
  throw new Error('expected an invariant failure, none was thrown')
}

/* ------------------------------ tax ------------------------------ */

describe('lineTaxOere', () => {
  it('matches Kustom’s documented inclusive formula exactly', () => {
    for (const amount of [44900, 40410, 6900, 89800, 1, 7, 123457]) {
      assert.ok(
        Math.abs(lineTaxOere(amount) - kustomReferenceTaxOere(amount)) <= 1,
        `amount ${amount} outside ±1 tolerance`,
      )
    }
  })

  it('computes the documented worked values', () => {
    assert.equal(lineTaxOere(44900), 8980) // undiscounted 449 kr
    assert.equal(lineTaxOere(40410), 8082) // 449 kr less 10 %
    assert.equal(lineTaxOere(6900), 1380) // shipping
  })
})

/* ------------------------------ the worked example ------------------------------ */

describe('buildKustomOrder — 449 kr + 10 % + 69 kr shipping', () => {
  const promo = promoOf(SINGLE, { '10': 4490 })
  const build = buildAndAssert(SINGLE, promo)

  it('produces exactly order_amount 47310 and order_tax_amount 9462', () => {
    assert.equal(build.orderAmountOere, 47_310)
    assert.equal(build.orderTaxAmountOere, 9_462)
  })

  it('carries the discount on the product line, not in unit_price', () => {
    const line = build.orderLines[0]
    assert.equal(line.type, 'physical')
    assert.equal(line.reference, '10')
    assert.equal(line.quantity, 1)
    assert.equal(line.unit_price, 44_900) // unchanged catalogue price
    assert.equal(line.total_discount_amount, 4_490)
    assert.equal(line.total_amount, 40_410) // gross − discount
    assert.equal(line.total_tax_amount, 8_082) // tax on the DISCOUNTED total
    assert.equal(line.tax_rate, 2_500)
  })

  it('leaves shipping alone', () => {
    const shipping = build.orderLines[1]
    assert.equal(shipping.type, 'shipping_fee')
    assert.equal(shipping.total_amount, 6_900)
    assert.equal(shipping.total_discount_amount, 0)
    assert.equal(shipping.total_tax_amount, 1_380)
  })

  it('adds no separate discount line and no discount type', () => {
    assert.deepEqual(build.orderLines.map((l) => l.type), ['physical', 'shipping_fee'])
    assert.ok(!JSON.stringify(build.orderLines).includes('"discount"'))
  })

  it('reports trusted totals in kroner', () => {
    assert.deepEqual(build.totals, {
      subtotalOere: 44_900,
      discountOere: 4_490,
      shippingOere: 6_900,
      totalOere: 47_310,
      subtotal: 449,
      discount: 44.9,
      shipping: 69,
      total: 473.1,
    })
  })
})

/* ------------------------------ no promo ------------------------------ */

describe('buildKustomOrder — without a promo code', () => {
  it('is the ordinary undiscounted order', () => {
    const build = buildAndAssert(SINGLE, null)
    assert.equal(build.orderAmountOere, 51_800)
    assert.equal(build.orderTaxAmountOere, 10_360)
    assert.equal(build.orderLines[0].total_discount_amount, 0)
    assert.equal(build.orderLines[0].total_amount, 44_900)
    assert.equal(build.totals.discount, 0)
  })

  it('omits the shipping line when shipping is free', () => {
    const cart = cartOf({ variantId: '10', productId: '1', unitKr: 449, qty: 2 })
    const build = buildAndAssert(cart, null)
    assert.equal(cart.shippingOere, 0)
    assert.equal(build.orderLines.length, 1)
    assert.equal(build.orderAmountOere, 89_800)
  })
})

/* ------------------------------ allocation ------------------------------ */

describe('buildKustomOrder — allocation across lines', () => {
  const multi = cartOf(
    { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
    { variantId: '11', productId: '1', unitKr: 299, qty: 2 },
    { variantId: '20', productId: '2', unitKr: 199, qty: 1 },
  )

  it('gives a non-eligible product line zero discount', () => {
    // Product-restricted code: only product 1's lines are allocated anything.
    const promo = promoOf(multi, { '10': 4490, '11': 5980 })
    const build = buildAndAssert(multi, promo)

    const byRef = Object.fromEntries(build.orderLines.map((l) => [l.reference, l]))
    assert.equal(byRef['10'].total_discount_amount, 4_490)
    assert.equal(byRef['11'].total_discount_amount, 5_980)
    assert.equal(byRef['20'].total_discount_amount, 0)
    assert.equal(byRef['20'].total_amount, 19_900) // full price
  })

  it('sums line discounts to exactly the trusted order discount', () => {
    const promo = promoOf(multi, { '10': 1497, '11': 1993, '20': 663 })
    const build = buildAndAssert(multi, promo)
    const summed = build.orderLines.reduce((s, l) => s + l.total_discount_amount, 0)
    assert.equal(summed, promo.discountAmountOere)
    assert.equal(summed, 4_153)
  })

  it('keeps percentage rounding exact across several lines', () => {
    // 7 % of 124 600 øre = 8 722 exactly; allocated 3 143 / 4 186 / 1 393.
    const promo = promoOf(multi, { '10': 3143, '11': 4186, '20': 1393 })
    const build = buildAndAssert(multi, promo)

    assert.equal(build.orderAmountOere, multi.subtotalOere - 8_722 + multi.shippingOere)
    assert.equal(
      build.orderLines.reduce((s, l) => s + l.total_amount, 0),
      build.orderAmountOere,
    )
    assert.equal(
      build.orderLines.reduce((s, l) => s + l.total_tax_amount, 0),
      build.orderTaxAmountOere,
    )
  })

  it('handles a fixed discount capped at the eligible subtotal', () => {
    const small = cartOf({ variantId: '30', productId: '3', unitKr: 80, qty: 1 })
    const promo = promoOf(small, { '30': 8000 }, { discountType: 'fixed', discountValue: 100 })
    const build = buildAndAssert(small, promo)

    assert.equal(build.orderLines[0].total_amount, 0)
    assert.equal(build.orderLines[0].total_tax_amount, 0)
    assert.equal(build.orderAmountOere, small.shippingOere) // only shipping remains payable
  })

  it('keeps free shipping free even when the discount drops the payable amount under 650 kr', () => {
    const cart = cartOf({ variantId: '10', productId: '1', unitKr: 350, qty: 2 }) // 700 kr → free
    assert.equal(cart.shippingOere, 0)

    const promo = promoOf(cart, { '10': 10_000 }) // −100 kr → 600 kr payable
    const build = buildAndAssert(cart, promo)

    assert.equal(build.totals.shippingOere, 0, 'shipping stays free')
    assert.equal(build.orderAmountOere, 60_000)
    assert.ok(!build.orderLines.some((l) => l.type === 'shipping_fee'))
  })
})

/* ------------------------------ invariants ------------------------------ */

describe('assertKustomOrderInvariants', () => {
  it('accepts a well-formed order', () => {
    assert.doesNotThrow(() => buildAndAssert(SINGLE, promoOf(SINGLE, { '10': 4490 })))
    assert.doesNotThrow(() => buildAndAssert(SINGLE, null))
  })

  it('rejects an allocation that does not match the trusted discount', () => {
    const promo = promoOf(SINGLE, { '10': 4490 })
    const build = buildKustomOrder(SINGLE, promo)
    // Internally consistent line, but it no longer adds up to the validated discount —
    // exactly the drift the allocation check exists to catch.
    build.productLines[0].discountOere = 4_000
    build.productLines[0].totalOere = build.productLines[0].grossOere - 4_000
    assert.equal(
      invariantCode(() => assertKustomOrderInvariants(build, SINGLE, promo)),
      'allocation-mismatch',
    )
  })

  it('rejects a line whose own arithmetic is inconsistent', () => {
    const promo = promoOf(SINGLE, { '10': 4490 })
    const build = buildKustomOrder(SINGLE, promo)
    build.productLines[0].discountOere = 4_000 // total no longer equals gross − discount
    assert.equal(
      invariantCode(() => assertKustomOrderInvariants(build, SINGLE, promo)),
      'bad-line-total',
    )
  })

  it('rejects a discount when no promo was validated', () => {
    const build = buildKustomOrder(SINGLE, promoOf(SINGLE, { '10': 4490 }))
    assert.equal(
      invariantCode(() => assertKustomOrderInvariants(build, SINGLE, null)),
      'allocation-mismatch',
    )
  })

  it('rejects a broken order sum', () => {
    const build = buildAndAssert(SINGLE, null)
    build.orderAmountOere += 100
    assert.equal(invariantCode(() => assertKustomOrderInvariants(build, SINGLE, null)), 'order-amount-sum')
  })

  it('rejects a broken tax sum', () => {
    const build = buildAndAssert(SINGLE, null)
    build.orderTaxAmountOere += 5
    assert.equal(invariantCode(() => assertKustomOrderInvariants(build, SINGLE, null)), 'order-tax-sum')
  })

  it('rejects a line tax outside Kustom’s tolerance', () => {
    const build = buildAndAssert(SINGLE, null)
    build.orderLines[0].total_tax_amount += 3
    build.orderTaxAmountOere += 3
    assert.equal(invariantCode(() => assertKustomOrderInvariants(build, SINGLE, null)), 'line-tax-tolerance')
  })

  it('rejects non-integer money', () => {
    const build = buildAndAssert(SINGLE, null)
    build.orderLines[0].total_amount = 44_900.5
    assert.equal(invariantCode(() => assertKustomOrderInvariants(build, SINGLE, null)), 'non-integer')
  })

  it('rejects a discount larger than the line', () => {
    const promo = promoOf(SINGLE, { '10': 90_000 })
    const build = buildKustomOrder(SINGLE, promo)
    assert.equal(
      invariantCode(() => assertKustomOrderInvariants(build, SINGLE, promo)),
      'discount-out-of-range',
    )
  })

  it('rejects a negative line total', () => {
    const promo = promoOf(SINGLE, { '10': 4490 })
    const build = buildKustomOrder(SINGLE, promo)
    build.productLines[0].totalOere = -1
    assert.ok(['bad-line-total', 'negative-line-total'].includes(
      invariantCode(() => assertKustomOrderInvariants(build, SINGLE, promo)),
    ))
  })

  it('rejects a discounted shipping line', () => {
    const build = buildAndAssert(SINGLE, null)
    const shipping = build.orderLines.find((l) => l.type === 'shipping_fee')!
    shipping.total_discount_amount = 100
    assert.equal(invariantCode(() => assertKustomOrderInvariants(build, SINGLE, null)), 'shipping-discounted')
  })

  it('rejects shipping that was not derived from the pre-discount subtotal', () => {
    const tampered: PricedCart = { ...SINGLE, shippingOere: 0 }
    const build = buildKustomOrder(tampered, null)
    assert.equal(
      invariantCode(() => assertKustomOrderInvariants(build, tampered, null)),
      'shipping-basis',
    )
  })

  it('rejects duplicate line references', () => {
    const dup = cartOf(
      { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
      { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
    )
    const build = buildKustomOrder(dup, null)
    assert.equal(invariantCode(() => assertKustomOrderInvariants(build, dup, null)), 'duplicate-reference')
  })

  it('every money field it emits is an integer number of øre', () => {
    const promo = promoOf(SINGLE, { '10': 4490 })
    const build = buildAndAssert(SINGLE, promo)
    for (const line of build.orderLines) {
      for (const v of [
        line.quantity,
        line.unit_price,
        line.tax_rate,
        line.total_amount,
        line.total_discount_amount,
        line.total_tax_amount,
      ]) {
        assert.ok(Number.isInteger(v), `${v} is not an integer`)
      }
    }
    assert.ok(Number.isInteger(build.orderAmountOere))
    assert.ok(Number.isInteger(build.orderTaxAmountOere))
  })
})

/* ------------------------------ local parity ------------------------------ */

describe('assertLocalOrderParity', () => {
  const promo = promoOf(SINGLE, { '10': 4490 })
  const build: KustomOrderBuild = buildAndAssert(SINGLE, promo)

  const goodOrder = () => ({
    subtotal: 449,
    shipping: 69,
    total: 473.1,
    items: [{ variant: 10, lineTotal: 449, discountAmount: 44.9 }],
    discount: { discountAmount: 44.9 },
  })

  it('accepts an order that matches the Kustom figures', () => {
    assert.doesNotThrow(() => assertLocalOrderParity(goodOrder(), build))
  })

  it('rejects a total that differs from order_amount', () => {
    const order = { ...goodOrder(), total: 518 } // the undiscounted amount
    assert.equal(invariantCode(() => assertLocalOrderParity(order, build)), 'parity-total')
  })

  it('rejects a mismatched subtotal, shipping or discount', () => {
    assert.equal(
      invariantCode(() => assertLocalOrderParity({ ...goodOrder(), subtotal: 404.1 }, build)),
      'parity-subtotal',
    )
    assert.equal(
      invariantCode(() => assertLocalOrderParity({ ...goodOrder(), shipping: 0 }, build)),
      'parity-shipping',
    )
    assert.equal(
      invariantCode(() => assertLocalOrderParity({ ...goodOrder(), discount: { discountAmount: 0 } }, build)),
      'parity-discount',
    )
  })

  it('rejects a line discount that differs from the Kustom line', () => {
    const order = goodOrder()
    order.items[0].discountAmount = 0
    assert.equal(invariantCode(() => assertLocalOrderParity(order, build)), 'parity-line-discount')
  })

  it('rejects a line total that is post-discount instead of pre-discount', () => {
    const order = goodOrder()
    order.items[0].lineTotal = 404.1
    assert.equal(invariantCode(() => assertLocalOrderParity(order, build)), 'parity-line-total')
  })

  it('holds the receipt identity subtotal + shipping − total === discount', () => {
    const order = goodOrder()
    assert.equal(
      Math.round((order.subtotal + order.shipping - order.total) * 100),
      Math.round((order.discount.discountAmount ?? 0) * 100),
    )
  })
})
