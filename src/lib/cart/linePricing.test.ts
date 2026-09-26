import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cartLineHasVolumePrice,
  cartLinePricingTier,
  cartLineQuoteAvailable,
  cartLineQuoteThreshold,
  cartLineTotal,
  cartLineTotalOere,
  cartLineUnitPrice,
  cartSubtotal,
  type PricedCartLine,
} from './linePricing'

/**
 * What the cart shows for a line.
 *
 * The same boundaries the engine is tested on, asserted through the shape the browser
 * actually holds — a stored `price` that is the catalogue price and a `qty` that moves. The
 * point of these is the recalculation: a line's price is a function of its quantity, so
 * incrementing, decrementing, restoring from storage and adding several at once all have to
 * land on the same answer.
 */

const line = (overrides: Partial<PricedCartLine> = {}): PricedCartLine => ({
  productSlug: 'aboks-mini',
  price: 349,
  qty: 1,
  ...overrides,
})

describe('cart line pricing', () => {
  it('prices every standard boundary', () => {
    const expected: [number, number][] = [
      [1, 349],
      [9, 349],
      [10, 299],
      [19, 299],
      [20, 249],
      [39, 249],
      [40, 249],
      [41, 249],
    ]
    for (const [qty, unitPrice] of expected) {
      assert.equal(cartLineUnitPrice(line({ qty })), unitPrice, `@${qty}`)
      assert.equal(cartLineTotal(line({ qty })), unitPrice * qty, `@${qty}`)
    }
  })

  it('prices every aBoks XL boundary', () => {
    const xl = (qty: number) => line({ productSlug: 'aboks-xl', price: 849, qty })
    const expected: [number, number][] = [
      [1, 849],
      [3, 849],
      [4, 799],
      [6, 799],
      [7, 749],
      [10, 749],
      [11, 749],
      [12, 749],
    ]
    for (const [qty, unitPrice] of expected) {
      assert.equal(cartLineUnitPrice(xl(qty)), unitPrice, `@${qty}`)
    }
    assert.equal(cartLineTotal(xl(12)), 8988)
  })

  it('reprices the whole line, in both directions', () => {
    // 9 → 10: every one of the ten units drops to the 10–19 price.
    assert.equal(cartLineTotal(line({ qty: 9 })), 9 * 349)
    assert.equal(cartLineTotal(line({ qty: 10 })), 10 * 299)
    // 10 → 9: straight back, with nothing left over from the band it was in.
    assert.equal(cartLineUnitPrice(line({ qty: 9 })), 349)
    // 19 → 20 → 19.
    assert.equal(cartLineUnitPrice(line({ qty: 19 })), 299)
    assert.equal(cartLineUnitPrice(line({ qty: 20 })), 249)
    assert.equal(cartLineUnitPrice(line({ qty: 19 })), 299)
  })

  it('marks a volume price only when one is actually active', () => {
    assert.equal(cartLineHasVolumePrice(line({ qty: 1 })), false)
    assert.equal(cartLineHasVolumePrice(line({ qty: 9 })), false)
    assert.equal(cartLineHasVolumePrice(line({ qty: 10 })), true)
    assert.equal(cartLineHasVolumePrice(line({ productSlug: 'aa-modul', price: 99, qty: 40 })), false)
  })

  it('offers a quote at the threshold, at the same price', () => {
    assert.equal(cartLineQuoteAvailable(line({ qty: 39 })), false)
    assert.equal(cartLineQuoteAvailable(line({ qty: 40 })), true)
    assert.equal(cartLineUnitPrice(line({ qty: 40 })), cartLineUnitPrice(line({ qty: 39 })))
    assert.equal(cartLineQuoteThreshold(line()), 40)
    assert.equal(cartLineQuoteThreshold(line({ productSlug: 'aboks-xl', price: 849 })), 11)
  })

  it('leaves a line with no slug, and an unconfigured product, alone', () => {
    const noSlug = { price: 500, qty: 30 }
    assert.equal(cartLineUnitPrice(noSlug), 500)
    assert.equal(cartLineTotal(noSlug), 15000)
    assert.equal(cartLineQuoteAvailable(noSlug), false)

    const accessory = line({ productSlug: 'aa-modul', price: 99, qty: 25 })
    assert.equal(cartLineUnitPrice(accessory), 99)
    assert.equal(cartLineTotal(accessory), 2475)
  })

  it('reports the band the line is in', () => {
    assert.equal(cartLinePricingTier(line({ qty: 5 })).isVolumeTier, false)
    assert.equal(cartLinePricingTier(line({ qty: 15 })).minQuantity, 10)
    assert.equal(cartLinePricingTier(line({ qty: 25 })).minQuantity, 20)
  })

  it('never lets a stored sale price be undercut by a band, or raised by one', () => {
    // A line added during a 279 kr sale. The 10–19 band is 299, so the sale stands.
    const onSale = line({ price: 279, qty: 10 })
    assert.equal(cartLineUnitPrice(onSale), 279)
    // The 20+ band is genuinely lower and applies.
    assert.equal(cartLineUnitPrice(line({ price: 279, qty: 20 })), 249)
  })
})

describe('cart subtotal', () => {
  it('sums each line at its own band', () => {
    const items: PricedCartLine[] = [
      { productSlug: 'aboks', price: 449, qty: 12 },
      { productSlug: 'aboks-office', price: 549, qty: 7 },
      { productSlug: 'aboks-spesial', price: 299, qty: 25 },
      { productSlug: 'aboks-xl', price: 849, qty: 2 },
    ]
    assert.equal(cartSubtotal(items), 12 * 399 + 7 * 549 + 25 * 199 + 2 * 849)
  })

  it('never pools quantities across products', () => {
    // 46 units in total, and not one line is priced as if it were a 46-unit line.
    const items: PricedCartLine[] = [
      { productSlug: 'aboks', price: 449, qty: 12 },
      { productSlug: 'aboks-office', price: 549, qty: 7 },
      { productSlug: 'aboks-spesial', price: 299, qty: 25 },
      { productSlug: 'aboks-xl', price: 849, qty: 2 },
    ]
    assert.equal(items.reduce((n, i) => n + i.qty, 0), 46)
    assert.equal(cartLineUnitPrice(items[1]), 549) // still 1–9
    assert.equal(cartLineUnitPrice(items[3]), 849) // still XL 1–3
  })

  it('sums in integer øre', () => {
    const items: PricedCartLine[] = [
      { productSlug: 'ukjent', price: 0.1, qty: 1 },
      { productSlug: 'ukjent', price: 0.2, qty: 1 },
    ]
    assert.equal(cartLineTotalOere(items[0]) + cartLineTotalOere(items[1]), 30)
    assert.equal(cartSubtotal(items), 0.3)
  })

  it('is empty for an empty cart', () => {
    assert.equal(cartSubtotal([]), 0)
  })
})
