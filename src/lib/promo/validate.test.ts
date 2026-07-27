import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload, Where } from 'payload'
import { shippingForSubtotalOere, type PricedCart, type PricedLine } from '@/lib/cartPricing'
import { validatePromoCode } from './validate'
import type { PromoValidationResult, PromoValidationSuccess } from './types'

/* ------------------------------ test doubles ------------------------------ */

type FakePromoCode = {
  id: number
  code: string
  active?: boolean | null
  discountType?: string | null
  discountValue?: number | null
  usageMode?: string | null
  maxUses?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  minimumOrderAmount?: number | null
  applicableProducts?: number[] | null
}

type FakeUsage = { promoCode: number; order?: number | null; email?: string | null }

/**
 * Payload stand-in serving `promo-codes` and `promo-code-usages` from arrays. The usage
 * "query" understands only the three clause shapes the validator builds — an equals on
 * promoCode, a not_equals on order, and an equals on email — which is enough to prove the
 * validator asks the right question, without pretending to be a database.
 */
function fakePayload(opts: {
  codes: FakePromoCode[]
  usages?: FakeUsage[]
  throwOn?: 'promo-codes' | 'promo-code-usages'
}): { payload: Payload; usageQueries: Where[] } {
  const usageQueries: Where[] = []

  const matches = (usage: FakeUsage, where: Where): boolean => {
    const clauses = 'and' in where && Array.isArray(where.and) ? (where.and as Where[]) : [where]
    return clauses.every((clause) => {
      const promo = clause.promoCode as { equals?: unknown } | undefined
      if (promo?.equals != null) return String(usage.promoCode) === String(promo.equals)
      const order = clause.order as { not_equals?: unknown } | undefined
      if (order?.not_equals != null) return String(usage.order ?? '') !== String(order.not_equals)
      const email = clause.email as { equals?: unknown } | undefined
      if (email?.equals != null) return (usage.email ?? '') === email.equals
      return true
    })
  }

  const payload = {
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where?: Where & { code?: { equals?: string } }
    }) => {
      if (opts.throwOn === collection) throw new Error('connection lost')

      if (collection === 'promo-codes') {
        const wanted = where?.code?.equals
        const docs = opts.codes.filter((c) => c.code === wanted)
        return { docs, totalDocs: docs.length }
      }

      usageQueries.push(where as Where)
      const docs = (opts.usages ?? []).filter((u) => matches(u, where as Where))
      return { docs, totalDocs: docs.length }
    },
    logger: { error: () => {}, warn: () => {} },
  } as unknown as Payload

  return { payload, usageQueries }
}

/** A priced cart built directly (priceCart itself is covered in cartPricing.test.ts). */
function cartOf(...lines: { variantId: string; productId: string; unitKr: number; qty: number }[]): PricedCart {
  const priced: PricedLine[] = lines.map((l) => {
    const unitPriceOere = Math.round(l.unitKr * 100)
    const lineTotalOere = unitPriceOere * l.qty
    return {
      variantId: l.variantId,
      productId: l.productId,
      displayName: `Produkt ${l.productId} – variant ${l.variantId}`,
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

/** One 449 kr aBoks Vegg — under the free-shipping threshold, so shipping is 69 kr. */
const SINGLE_CART = cartOf({ variantId: '10', productId: '1', unitKr: 449, qty: 1 })

const CODE: FakePromoCode = {
  id: 7,
  code: 'WELCOME10',
  active: true,
  discountType: 'percentage',
  discountValue: 10,
  usageMode: 'unlimited',
}

const expectValid = (result: PromoValidationResult): PromoValidationSuccess => {
  assert.equal(result.valid, true, `expected valid, got ${'reason' in result ? result.reason : ''}`)
  if (!result.valid) throw new Error('unreachable')
  return result
}

const expectInvalid = (result: PromoValidationResult, reason: string) => {
  assert.equal(result.valid, false)
  if (result.valid) throw new Error('unreachable')
  assert.equal(result.reason, reason)
  assert.ok(result.message.length > 0, 'every failure carries a Norwegian message')
  return result
}

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

/* ------------------------------ tests ------------------------------ */

describe('validatePromoCode — normalisation', () => {
  it('matches a stored uppercase code from lowercase input', async () => {
    const { payload } = fakePayload({ codes: [CODE] })
    const result = expectValid(
      await validatePromoCode(payload, { code: 'welcome10', cart: SINGLE_CART }),
    )
    assert.equal(result.code, 'WELCOME10')
  })

  it('ignores surrounding whitespace and mixed case', async () => {
    const { payload } = fakePayload({ codes: [CODE] })
    const result = expectValid(
      await validatePromoCode(payload, { code: '  WeLcOmE10 \n', cart: SINGLE_CART }),
    )
    assert.equal(result.code, 'WELCOME10')
    assert.equal(result.discountAmountOere, 4_490)
  })

  it('rejects an empty submission before touching the database', async () => {
    const { payload } = fakePayload({ codes: [CODE] })
    expectInvalid(await validatePromoCode(payload, { code: '   ', cart: SINGLE_CART }), 'empty_code')
  })

  it('rejects an empty cart', async () => {
    const { payload } = fakePayload({ codes: [CODE] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: cartOf() }),
      'cart_empty',
    )
  })
})

describe('validatePromoCode — percentage', () => {
  it('discounts only the goods, never shipping', async () => {
    const { payload } = fakePayload({ codes: [CODE] })
    const r = expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))

    assert.equal(r.eligibleSubtotal, 449)
    assert.equal(r.discountAmount, 44.9)
    assert.equal(r.subtotalBeforeDiscount, 449)
    assert.equal(r.subtotalAfterDiscount, 404.1)
    assert.equal(r.shipping, 69) // untouched
    assert.equal(r.totalBeforeDiscount, 518)
    assert.equal(r.totalAfterDiscount, 473.1)
  })

  it('caps a 100 % code at the eligible subtotal — the total never goes below shipping', async () => {
    const { payload } = fakePayload({
      codes: [{ ...CODE, code: 'ALT100', discountValue: 100 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'ALT100', cart: SINGLE_CART }))
    assert.equal(r.discountAmountOere, 44_900)
    assert.equal(r.subtotalAfterDiscountOere, 0)
    assert.equal(r.totalAfterDiscountOere, 6_900) // shipping still payable
  })

  it('rounds a fractional percentage once, at the end', async () => {
    // 12.5 % of 449 kr = 56.125 kr → 5613 øre.
    const { payload } = fakePayload({
      codes: [{ ...CODE, code: 'HALV', discountValue: 12.5 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'HALV', cart: SINGLE_CART }))
    assert.equal(r.discountAmountOere, 5_613)
    assert.equal(r.discountAmount, 56.13)
  })
})

describe('validatePromoCode — fixed amount', () => {
  it('subtracts the fixed kroner amount from the goods', async () => {
    const { payload } = fakePayload({
      codes: [{ ...CODE, code: 'ABOKS100', discountType: 'fixed', discountValue: 100 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'ABOKS100', cart: SINGLE_CART }))
    assert.equal(r.discountAmount, 100)
    assert.equal(r.subtotalAfterDiscount, 349)
    assert.equal(r.totalAfterDiscount, 418)
  })

  it('never drives the eligible subtotal negative (100 kr off an 80 kr cart)', async () => {
    const cart = cartOf({ variantId: '30', productId: '3', unitKr: 80, qty: 1 })
    const { payload } = fakePayload({
      codes: [{ ...CODE, code: 'ABOKS100', discountType: 'fixed', discountValue: 100 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'ABOKS100', cart }))
    assert.equal(r.discountAmount, 80)
    assert.equal(r.subtotalAfterDiscountOere, 0)
    assert.equal(r.totalAfterDiscountOere, cart.shippingOere)
  })
})

describe('validatePromoCode — product restrictions', () => {
  const mixedCart = cartOf(
    { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
    { variantId: '20', productId: '2', unitKr: 299, qty: 1 },
  )

  it('discounts only the matching product lines', async () => {
    const { payload } = fakePayload({
      codes: [{ ...CODE, code: 'VEGG20', discountValue: 20, applicableProducts: [1] }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'VEGG20', cart: mixedCart }))

    assert.equal(r.eligibleSubtotal, 449) // not 748
    assert.equal(r.discountAmount, 89.8)
    assert.equal(r.lineDiscounts.length, 1)
    assert.equal(r.lineDiscounts[0].variantId, '10')
    // The non-matching product stays at full price; the order still contains both.
    assert.equal(r.subtotalBeforeDiscount, 748)
    assert.equal(r.subtotalAfterDiscount, 658.2)
  })

  it('fails clearly when the cart holds none of the restricted products', async () => {
    const { payload } = fakePayload({
      codes: [{ ...CODE, code: 'TILBEHOR', applicableProducts: [99] }],
    })
    expectInvalid(
      await validatePromoCode(payload, { code: 'TILBEHOR', cart: mixedCart }),
      'no_eligible_products',
    )
  })

  it('treats an empty restriction list as "all products"', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, applicableProducts: [] }] })
    const r = expectValid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: mixedCart }),
    )
    assert.equal(r.eligibleSubtotal, 748)
    assert.equal(r.lineDiscounts.length, 2)
  })
})

describe('validatePromoCode — state and configuration', () => {
  it('rejects an unknown code', async () => {
    const { payload } = fakePayload({ codes: [CODE] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'NOPE', cart: SINGLE_CART }),
      'not_found',
    )
  })

  it('rejects an inactive code', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, active: false }] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'inactive',
    )
  })

  it('rejects a code before its start date', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, startsAt: daysFromNow(3) }] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'not_started',
    )
  })

  it('accepts a code whose start date has passed', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, startsAt: daysFromNow(-3) }] })
    expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))
  })

  it('rejects an expired code', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, expiresAt: daysFromNow(-1) }] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'expired',
    )
  })

  it('accepts a code inside its validity window', async () => {
    const { payload } = fakePayload({
      codes: [{ ...CODE, startsAt: daysFromNow(-1), expiresAt: daysFromNow(1) }],
    })
    expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))
  })

  it('fails closed on an unusable stored configuration', async () => {
    const bad: Partial<FakePromoCode>[] = [
      { discountType: 'bogus' },
      { discountValue: 0 },
      { discountValue: -10 },
      { discountValue: null },
      { discountType: 'percentage', discountValue: 150 },
      { usageMode: 'bogus' },
      { usageMode: 'limited', maxUses: null },
      { usageMode: 'limited', maxUses: 0 },
    ]
    for (const overrides of bad) {
      const { payload } = fakePayload({ codes: [{ ...CODE, ...overrides }] })
      expectInvalid(
        await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
        'invalid_configuration',
      )
    }
  })

  it('reports a failing lookup as retryable rather than as an unknown code', async () => {
    const { payload } = fakePayload({ codes: [CODE], throwOn: 'promo-codes' })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'lookup_failed',
    )
  })
})

describe('validatePromoCode — minimum order amount', () => {
  it('rejects a cart below the minimum', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, minimumOrderAmount: 500 }] })
    const result = expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'minimum_not_reached',
    )
    assert.match(result.message, /500/)
  })

  it('accepts a cart exactly at the minimum', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, minimumOrderAmount: 449 }] })
    expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))
  })

  it('measures the minimum before discount and without shipping', async () => {
    // Cart total incl. shipping is 518 kr, but the goods are only 449 kr — a 500 kr minimum
    // must not be satisfied by shipping.
    const { payload } = fakePayload({ codes: [{ ...CODE, minimumOrderAmount: 500 }] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'minimum_not_reached',
    )
  })

  it('measures against the eligible lines for a product-restricted code', async () => {
    const mixed = cartOf(
      { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
      { variantId: '20', productId: '2', unitKr: 299, qty: 1 },
    )
    const { payload } = fakePayload({
      codes: [{ ...CODE, applicableProducts: [1], minimumOrderAmount: 500 }],
    })
    // 748 kr in the cart, but only 449 kr of it qualifies.
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: mixed }),
      'minimum_not_reached',
    )
  })
})

describe('validatePromoCode — usage allowance', () => {
  // Usage counting exists in the validator for the limited/single-use/once-per-customer
  // modes, but at launch none of those modes is supported: the policy check refuses them
  // first, so the counting path is deliberately unreachable. These tests pin that down —
  // the guarantee that matters is that a limited code can never behave like an unlimited
  // one, not that the (dormant) counter works.

  it('never counts usage for an unlimited code', async () => {
    const { payload, usageQueries } = fakePayload({ codes: [CODE] })
    expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))
    assert.deepEqual(usageQueries, [])
  })

  it('refuses every counted mode before any usage query is made', async () => {
    const counted: Partial<FakePromoCode>[] = [
      { usageMode: 'single_use_global' },
      { usageMode: 'limited', maxUses: 3 },
      { usageMode: 'once_per_customer' },
    ]
    for (const overrides of counted) {
      const { payload, usageQueries } = fakePayload({ codes: [{ ...CODE, ...overrides }], usages: [] })
      expectInvalid(
        await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
        'not_supported',
      )
      assert.deepEqual(usageQueries, [], 'the usage table is never consulted')
    }
  })

  it('refuses a once-per-customer code with or without an email', async () => {
    for (const email of [undefined, 'kari@example.no']) {
      const { payload } = fakePayload({ codes: [{ ...CODE, usageMode: 'once_per_customer' }] })
      expectInvalid(
        await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART, email }),
        'not_supported',
      )
    }
  })

  it('a supported code still reaches the discount calculation with no usage lookup', async () => {
    const { payload, usageQueries } = fakePayload({ codes: [CODE], usages: [] })
    const r = expectValid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART, orderId: 100 }),
    )
    assert.equal(r.discountAmountOere, 4_490)
    assert.deepEqual(usageQueries, [])
  })
})
describe('validatePromoCode — allocation and totals', () => {
  it('line discounts sum exactly to the order discount', async () => {
    const cart = cartOf(
      { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
      { variantId: '11', productId: '1', unitKr: 449, qty: 1 },
      { variantId: '20', productId: '2', unitKr: 299, qty: 3 },
    )
    const { payload } = fakePayload({ codes: [{ ...CODE, discountValue: 13 }] })
    const r = expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart }))

    const summed = r.lineDiscounts.reduce((s, l) => s + l.discountOere, 0)
    assert.equal(summed, r.discountAmountOere)
    assert.equal(
      r.subtotalBeforeDiscountOere - r.discountAmountOere,
      r.subtotalAfterDiscountOere,
    )
    assert.equal(r.totalBeforeDiscountOere - r.discountAmountOere, r.totalAfterDiscountOere)
  })

  it('no line is ever discounted below zero', async () => {
    const cart = cartOf(
      { variantId: '10', productId: '1', unitKr: 449, qty: 1 },
      { variantId: '20', productId: '2', unitKr: 19, qty: 1 },
    )
    const { payload } = fakePayload({
      codes: [{ ...CODE, discountType: 'fixed', discountValue: 400 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart }))

    for (const line of r.lineDiscounts) {
      const cartLine = cart.lines.find((l) => l.variantId === line.variantId)!
      assert.ok(line.discountOere <= cartLine.lineTotalOere)
    }
  })

  it('keeps free shipping tied to the pre-discount subtotal', async () => {
    // 700 kr of goods → free shipping. A 100 kr code must not reinstate the 69 kr fee.
    const cart = cartOf({ variantId: '10', productId: '1', unitKr: 350, qty: 2 })
    assert.equal(cart.shippingOere, 0)

    const { payload } = fakePayload({
      codes: [{ ...CODE, discountType: 'fixed', discountValue: 100 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart }))

    assert.equal(r.shipping, 0)
    assert.equal(r.totalAfterDiscount, 600)
  })

  it('a discount can never buy free shipping either', async () => {
    const cart = cartOf({ variantId: '10', productId: '1', unitKr: 449, qty: 1 })
    const { payload } = fakePayload({
      codes: [{ ...CODE, discountType: 'fixed', discountValue: 400 }],
    })
    const r = expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart }))
    assert.equal(r.shipping, 69)
    assert.equal(r.totalAfterDiscount, 118)
  })

  it('every returned figure stays a whole number of øre', async () => {
    const cart = cartOf(
      { variantId: '10', productId: '1', unitKr: 449, qty: 2 },
      { variantId: '20', productId: '2', unitKr: 299, qty: 1 },
    )
    const { payload } = fakePayload({ codes: [{ ...CODE, discountValue: 7.5 }] })
    const r = expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart }))

    for (const value of [
      r.eligibleSubtotalOere,
      r.discountAmountOere,
      r.subtotalBeforeDiscountOere,
      r.subtotalAfterDiscountOere,
      r.shippingOere,
      r.totalBeforeDiscountOere,
      r.totalAfterDiscountOere,
      ...r.lineDiscounts.map((l) => l.discountOere),
    ]) {
      assert.ok(Number.isInteger(value), `${value} is not whole øre`)
    }
  })
})

/* ------------------------------ launch support policy ------------------------------ */

describe('validatePromoCode — first-launch support policy', () => {
  it('accepts a reusable unlimited code (percentage and fixed)', async () => {
    for (const overrides of [
      { discountType: 'percentage', discountValue: 10 },
      { discountType: 'fixed', discountValue: 100 },
    ]) {
      const { payload } = fakePayload({ codes: [{ ...CODE, ...overrides }] })
      expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))
    }
  })

  it('keeps accepting the features that are still supported', async () => {
    const supported: Partial<FakePromoCode>[] = [
      { expiresAt: daysFromNow(30) },
      { startsAt: daysFromNow(-1) },
      { minimumOrderAmount: 100 },
      { applicableProducts: [1] },
    ]
    for (const overrides of supported) {
      const { payload } = fakePayload({ codes: [{ ...CODE, ...overrides }] })
      expectValid(await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }))
    }
  })

  it('rejects every usage-limited mode with the safe Norwegian message', async () => {
    const unsupported: Partial<FakePromoCode>[] = [
      { usageMode: 'single_use_global' },
      { usageMode: 'limited', maxUses: 50 },
      { usageMode: 'once_per_customer' },
      // A stale ceiling left on an otherwise unlimited code must fail closed too.
      { usageMode: 'unlimited', maxUses: 5 },
    ]
    for (const overrides of unsupported) {
      const { payload } = fakePayload({ codes: [{ ...CODE, ...overrides }] })
      const result = expectInvalid(
        await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
        'not_supported',
      )
      assert.equal(result.message, 'Denne rabattkoden er ikke tilgjengelig akkurat nå.')
    }
  })

  it('never leaks which restriction was configured', async () => {
    const { payload } = fakePayload({ codes: [{ ...CODE, usageMode: 'limited', maxUses: 3 }] })
    const result = expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'not_supported',
    )
    for (const leak of ['limited', 'maxUses', '3', 'single', 'kunde']) {
      assert.ok(!result.message.includes(leak), `message must not mention ${leak}`)
    }
  })

  it('rejects a legacy row that bypassed admin validation entirely', async () => {
    // Written straight to the database with a mode the admin form can no longer produce.
    const { payload } = fakePayload({
      codes: [{ ...CODE, usageMode: 'single_use_global' }],
      usages: [],
    })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'not_supported',
    )
  })

  it('rejects a mode the schema does not know at all', async () => {
    // Reported as invalid configuration rather than "not supported" — either way it fails
    // closed, and either way no discount is granted.
    const { payload } = fakePayload({ codes: [{ ...CODE, usageMode: 'some_future_mode' as never }] })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'invalid_configuration',
    )
  })

  it('never silently treats a limited code as unlimited', async () => {
    // No usage rows exist, so an unlimited code would sail through — the policy must still
    // refuse, and must not fall back to the usage-count path.
    const { payload, usageQueries } = fakePayload({
      codes: [{ ...CODE, usageMode: 'limited', maxUses: 99 }],
      usages: [],
    })
    expectInvalid(
      await validatePromoCode(payload, { code: 'WELCOME10', cart: SINGLE_CART }),
      'not_supported',
    )
    assert.deepEqual(usageQueries, [], 'usage counting must not even be attempted')
  })
})
