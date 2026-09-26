import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { priceCart, type PricedCart } from '@/lib/cartPricing'
import { SHIPPING_COST_OERE } from '@/lib/shipping'
import { validatePromoCode } from './validate'
import {
  assertKustomOrderInvariants,
  assertLocalOrderParity,
  buildKustomOrder,
} from './kustomLines'
import { buildPendingOrderData } from './checkoutFlow'
import type { PromoValidationSuccess } from './types'

/**
 * Quantity pricing all the way down the checkout.
 *
 * `priceCart` is the only place a unit price is decided, so what this file is really checking
 * is that nothing downstream reconstructs one: the Kustom order lines, the invariants, the
 * pending Payload order and the promo discount are each asserted against the *banded* price,
 * not the catalogue price. A regression that re-derived a line from `products.price` would
 * fail here rather than on a customer's card statement.
 *
 * Everything is a plain object — no database, no api.kustom.co.
 */

/* ------------------------------ catalogue ------------------------------ */

/** aBoks Mini (349 / 299 / 249) and aBoks XL (849 / 799 / 749). */
const CATALOGUE = {
  variants: [
    { id: 30, product: 3, name: 'Sort', displayName: 'aBoks Mini – Sort', inventory: 500 },
    { id: 40, product: 4, name: 'Sort', displayName: 'aBoks XL – Sort', inventory: 500 },
  ],
  products: [
    { id: 3, title: 'aBoks Mini', slug: 'aboks-mini', price: 349, published: true },
    { id: 4, title: 'aBoks XL', slug: 'aboks-xl', price: 849, published: true },
  ],
}

type FakeWhere = { id?: { in: (string | number)[] }; product?: { in: (string | number)[] } }

/** Serves the catalogue, plus one reusable promo code and no usage rows. */
function fakePayload(promo?: {
  id: number
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minimumOrderAmount?: number
  applicableProducts?: number[]
}): Payload {
  return {
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where?: FakeWhere & { code?: { equals?: string } }
    }) => {
      if (collection === 'promo-codes') {
        const docs =
          promo && where?.code?.equals === promo.code
            ? [{ ...promo, active: true, usageMode: 'unlimited' }]
            : []
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'promo-code-usages') return { docs: [], totalDocs: 0 }

      if (where?.product?.in) {
        const parents = where.product.in.map(String)
        return { docs: CATALOGUE.variants.filter((v) => parents.includes(String(v.product))) }
      }
      const ids = (where?.id?.in ?? []).map(String)
      const source = collection === 'product-variants' ? CATALOGUE.variants : CATALOGUE.products
      return { docs: source.filter((doc) => ids.includes(String(doc.id))) }
    },
    logger: { error: () => {}, warn: () => {} },
  } as unknown as Payload
}

async function price(
  payload: Payload,
  lines: { variantId: string; quantity: number }[],
): Promise<PricedCart> {
  const result = await priceCart(payload, lines)
  assert.equal(result.ok, true, `pricing failed: ${'reason' in result ? result.reason : ''}`)
  if (!result.ok) throw new Error('unreachable')
  return result.cart
}

/* ------------------------------ Kustom ------------------------------ */

describe('Kustom receives the banded price', () => {
  it('sends the effective unit price, and a total that matches the cart', async () => {
    const cart = await price(fakePayload(), [{ variantId: '30', quantity: 12 }])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)

    const line = build.orderLines[0]
    assert.equal(line.unit_price, 29_900, 'the 10–19 price, not 349')
    assert.equal(line.quantity, 12)
    assert.equal(line.total_amount, 358_800)
    assert.equal(line.total_discount_amount, 0, 'a band is a price, never a discount line')
    // Over the free-shipping threshold, so no shipping line at all — unchanged behaviour.
    assert.equal(build.orderLines.length, 1)
    assert.equal(build.orderAmountOere, 358_800)
    // The cart and Kustom cannot disagree: both come from the same PricedCart.
    assert.equal(build.orderAmountOere, cart.totalOere)
  })

  it('bands each line independently inside one Kustom order', async () => {
    const cart = await price(fakePayload(), [
      { variantId: '30', quantity: 12 },
      { variantId: '40', quantity: 2 },
    ])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)

    assert.equal(build.orderLines[0].unit_price, 29_900) // Mini, 10–19
    assert.equal(build.orderLines[1].unit_price, 84_900) // XL, still 1–3
    assert.equal(build.orderAmountOere, 12 * 29_900 + 2 * 84_900)
  })

  it('charges VAT on the banded amount, inclusive as before', async () => {
    const cart = await price(fakePayload(), [{ variantId: '30', quantity: 10 }])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)

    assert.equal(build.orderLines[0].tax_rate, 2500)
    // 25 % of 299 000 øre, inclusive: 299000 × 2500 / 12500.
    assert.equal(build.orderLines[0].total_tax_amount, 59_800)
    assert.equal(build.orderTaxAmountOere, 59_800)
  })

  it('keeps shipping on a small banded order, decided by the effective subtotal', async () => {
    // One unit: 349, under the 650 threshold. Nothing about that changes.
    const cart = await price(fakePayload(), [{ variantId: '30', quantity: 1 }])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)

    const shipping = build.orderLines.find((l) => l.type === 'shipping_fee')
    assert.ok(shipping, 'a small order still pays shipping')
    assert.equal(shipping.total_amount, SHIPPING_COST_OERE)
    assert.equal(build.orderAmountOere, 34_900 + SHIPPING_COST_OERE)
  })
})

/* ------------------------------ promo codes ------------------------------ */

describe('promo codes apply on top of quantity pricing', () => {
  const TAKK10 = {
    id: 1,
    code: 'TAKK10',
    discountType: 'percentage' as const,
    discountValue: 10,
  }

  it('takes its percentage from the banded subtotal, not the catalogue one', async () => {
    const payload = fakePayload(TAKK10)
    const cart = await price(payload, [{ variantId: '30', quantity: 12 }])
    const result = await validatePromoCode(payload, { code: 'TAKK10', cart })
    assert.equal(result.valid, true)
    if (!result.valid) throw new Error('unreachable')

    // 12 × 299 = 3 588. Ten per cent of that is 358,80 — not 10 % of 12 × 349.
    assert.equal(cart.subtotalOere, 358_800)
    assert.equal(result.discountAmountOere, 35_880)
    assert.notEqual(result.discountAmountOere, Math.round(0.1 * 12 * 34_900))
  })

  it('runs in the documented order: band, then line totals, then discount, then shipping', async () => {
    const payload = fakePayload(TAKK10)
    const cart = await price(payload, [{ variantId: '30', quantity: 10 }])
    const promo = (await validatePromoCode(payload, {
      code: 'TAKK10',
      cart,
    })) as PromoValidationSuccess

    const build = buildKustomOrder(cart, promo)
    assertKustomOrderInvariants(build, cart, promo)

    // 1–2: the band, applied to every unit.
    assert.equal(build.orderLines[0].unit_price, 29_900)
    // 3: the subtotal from those line totals.
    assert.equal(build.totals.subtotalOere, 299_000)
    // 4: the discount, off the banded subtotal.
    assert.equal(build.totals.discountOere, 29_900)
    // 5: shipping, from the PRE-discount subtotal — the discount cannot take free shipping
    //    away, and the band cannot buy it either. 299 000 ≥ 65 000, so it is free.
    assert.equal(build.totals.shippingOere, 0)
    // 6: the final total.
    assert.equal(build.orderAmountOere, 299_000 - 29_900)
  })

  it('never applies a band twice, or as a discount', async () => {
    const payload = fakePayload()
    const cart = await price(payload, [{ variantId: '30', quantity: 20 }])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)

    // The saving lives entirely in `unit_price`. With no promo code there is no discount
    // anywhere on the order — which is what stops it being counted a second time.
    assert.equal(build.orderLines[0].unit_price, 24_900)
    assert.equal(build.totals.discountOere, 0)
    assert.equal(build.orderAmountOere, 498_000)
  })

  it('measures a minimum order amount against the banded subtotal', async () => {
    // A code that needs 3 000 kr. 10 × 299 = 2 990 — ten kroner short at the banded price,
    // although 10 × 349 would have cleared it. The banded figure is the one that counts,
    // because it is the one the customer pays.
    const payload = fakePayload({ ...TAKK10, minimumOrderAmount: 3000 })
    const cart = await price(payload, [{ variantId: '30', quantity: 10 }])
    const result = await validatePromoCode(payload, { code: 'TAKK10', cart })
    assert.equal(result.valid, false)
    if (result.valid) throw new Error('unreachable')
    assert.equal(result.reason, 'minimum_not_reached')
  })

  it('restricts to products on the banded line totals', async () => {
    // TAKK10 applies to aBoks Mini only. Its 10 % comes off 12 × 299, and the XL line is
    // untouched — at its own band.
    const payload = fakePayload({ ...TAKK10, applicableProducts: [3] })
    const cart = await price(payload, [
      { variantId: '30', quantity: 12 },
      { variantId: '40', quantity: 4 },
    ])
    const result = await validatePromoCode(payload, { code: 'TAKK10', cart })
    assert.equal(result.valid, true)
    if (!result.valid) throw new Error('unreachable')

    assert.equal(result.eligibleSubtotalOere, 12 * 29_900)
    assert.equal(result.discountAmountOere, Math.round(0.1 * 12 * 29_900))
    assert.equal(cart.lines[1].unitPriceOere, 79_900, 'XL still gets its own 4–6 price')
  })
})

/* ------------------------------ stored order ------------------------------ */

describe('the stored order keeps the banded price', () => {
  it('writes the effective unit price and line total onto the order', async () => {
    const cart = await price(fakePayload(), [{ variantId: '30', quantity: 12 }])
    const build = buildKustomOrder(cart, null)
    const order = buildPendingOrderData('AB-000001', build, null)

    assert.equal(order.items[0].unitPrice, 299, 'the receipt and the e-mails print this')
    assert.equal(order.items[0].lineTotal, 3588)
    assert.equal(order.items[0].quantity, 12)
    assert.equal(order.subtotal, 3588)
    assert.equal(order.total, 3588)
    // The one check that would catch a downstream reconstruction from `products.price`.
    assertLocalOrderParity(order, build)
  })

  it('keeps the receipt discount identity intact with a promo code', async () => {
    const payload = fakePayload({
      id: 1,
      code: 'TAKK10',
      discountType: 'percentage',
      discountValue: 10,
    })
    const cart = await price(payload, [{ variantId: '30', quantity: 12 }])
    const promo = (await validatePromoCode(payload, {
      code: 'TAKK10',
      cart,
    })) as PromoValidationSuccess
    const build = buildKustomOrder(cart, promo)
    const order = buildPendingOrderData('AB-000002', build, promo)

    assertLocalOrderParity(order, build)
    // subtotal + shipping − total === discountAmount, on the banded figures. Compared in øre,
    // for the reason `renderOrderSummary` already documents: the identity holds exactly in
    // integer øre and only approximately in decimal kroner.
    const toOere = (kr: number) => Math.round(kr * 100)
    assert.equal(
      toOere(order.subtotal) + toOere(order.shipping) - toOere(order.total),
      toOere(order.discount?.discountAmount ?? 0),
    )
    assert.equal(order.items[0].unitPrice, 299)
    assert.equal(order.items[0].lineTotal, 3588, 'the line keeps its pre-discount value')
    assert.equal(order.items[0].discountAmount, 358.8)
  })

  it('stores a quote-threshold order as an entirely ordinary one', async () => {
    const cart = await price(fakePayload(), [{ variantId: '30', quantity: 40 }])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)
    const order = buildPendingOrderData('AB-000003', build, null)

    // 40 × 249 — the same unit price 39 would have paid, and nothing missing from the order.
    assert.equal(order.items[0].unitPrice, 249)
    assert.equal(order.items[0].lineTotal, 9960)
    assert.equal(order.total, 9960)
    assert.equal(order.items.length, 1)
    assertLocalOrderParity(order, build)
  })
})

/* ------------------------------ large B2B orders ------------------------------ */

/**
 * 120 × aBoks Spesial — a school-sized order, well past the 99 units the cart used to stop
 * at, and past the 40-unit quote threshold.
 *
 * The point of the whole file applies at scale here: the band is decided once, and Kustom,
 * the promo discount, the shipping rule and the stored order all follow from it.
 */
describe('a 120-unit B2B order', () => {
  /** aBoks Spesial: 299 / 249 / 199, quote at 40. */
  const SPESIAL = {
    variants: [
      { id: 80, product: 8, name: 'Sort', displayName: 'aBoks Spesial – Sort', inventory: 100_000 },
    ],
    products: [
      { id: 8, title: 'aBoks Spesial', slug: 'aboks-spesial', price: 299, published: true },
    ],
  }

  /** The catalogue double above serves Mini and XL; this one serves Spesial. */
  function spesialPayload(promo?: {
    id: number
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
  }): Payload {
    return {
      find: async ({
        collection,
        where,
      }: {
        collection: string
        where?: FakeWhere & { code?: { equals?: string } }
      }) => {
        if (collection === 'promo-codes') {
          const docs =
            promo && where?.code?.equals === promo.code
              ? [{ ...promo, active: true, usageMode: 'unlimited' }]
              : []
          return { docs, totalDocs: docs.length }
        }
        if (collection === 'promo-code-usages') return { docs: [], totalDocs: 0 }
        if (where?.product?.in) {
          const parents = where.product.in.map(String)
          return { docs: SPESIAL.variants.filter((v) => parents.includes(String(v.product))) }
        }
        const ids = (where?.id?.in ?? []).map(String)
        const source = collection === 'product-variants' ? SPESIAL.variants : SPESIAL.products
        return { docs: source.filter((doc) => ids.includes(String(doc.id))) }
      },
      logger: { error: () => {}, warn: () => {} },
    } as unknown as Payload
  }

  it('is accepted by server-side validation at the 20–39 price', async () => {
    const cart = await price(spesialPayload(), [{ variantId: '80', quantity: 120 }])
    assert.equal(cart.lines[0].quantity, 120)
    assert.equal(cart.lines[0].unitPriceKr, 199)
    assert.equal(cart.lines[0].lineTotalKr, 23_880)
    assert.equal(cart.subtotalKr, 23_880)
    // Included in the subtotal, earning free shipping like any other order.
    assert.equal(cart.freeShipping, true)
    assert.equal(cart.shippingOere, 0)
    assert.equal(cart.totalKr, 23_880)
    // And the quote offer sits beside the price, not instead of it.
    assert.equal(cart.lines[0].quoteAvailable, true)
  })

  it('reaches Kustom with the right quantity and the right unit price', async () => {
    const cart = await price(spesialPayload(), [{ variantId: '80', quantity: 120 }])
    const build = buildKustomOrder(cart, null)
    assertKustomOrderInvariants(build, cart, null)

    const line = build.orderLines[0]
    assert.equal(line.quantity, 120)
    assert.equal(line.unit_price, 19_900)
    assert.equal(line.total_amount, 2_388_000)
    assert.equal(line.total_discount_amount, 0)
    assert.equal(build.orderAmountOere, 2_388_000)
    assert.equal(build.orderAmountOere, cart.totalOere, 'Kustom and the cart cannot disagree')
    // VAT on the banded amount, inclusive, unchanged: 2 388 000 × 2500 / 12500.
    assert.equal(build.orderTaxAmountOere, 477_600)
  })

  it('lets a promo code apply on top, off the banded subtotal', async () => {
    const payload = spesialPayload({
      id: 1,
      code: 'TAKK10',
      discountType: 'percentage',
      discountValue: 10,
    })
    const cart = await price(payload, [{ variantId: '80', quantity: 120 }])
    const promo = (await validatePromoCode(payload, {
      code: 'TAKK10',
      cart,
    })) as PromoValidationSuccess
    const build = buildKustomOrder(cart, promo)
    assertKustomOrderInvariants(build, cart, promo)

    // 10 % of 23 880, not of 120 × 299.
    assert.equal(build.totals.discountOere, 238_800)
    assert.equal(build.orderAmountOere, 2_388_000 - 238_800)
    assert.equal(build.orderLines[0].unit_price, 19_900, 'the band stays in unit_price')
    assert.equal(build.totals.shippingOere, 0)
  })

  it('stores the order with the quantity and the banded price intact', async () => {
    const cart = await price(spesialPayload(), [{ variantId: '80', quantity: 120 }])
    const build = buildKustomOrder(cart, null)
    const order = buildPendingOrderData('AB-000120', build, null)

    assert.equal(order.items[0].quantity, 120)
    assert.equal(order.items[0].unitPrice, 199)
    assert.equal(order.items[0].lineTotal, 23_880)
    assert.equal(order.subtotal, 23_880)
    assert.equal(order.shipping, 0)
    assert.equal(order.total, 23_880)
    assertLocalOrderParity(order, build)
  })
})
