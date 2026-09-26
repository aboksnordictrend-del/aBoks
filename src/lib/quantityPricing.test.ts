import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUANTITY_PRICING,
  buildPriceTableRows,
  formatTierRange,
  getLineTotal,
  getLineTotalOere,
  getNextPricingTier,
  getPricingTier,
  getPricingTiers,
  getUnitPrice,
  getUnitPriceOere,
  hasQuantityPricing,
  isQuoteThresholdReached,
  quantityPricingFor,
  quoteThresholdFor,
  type QuantityPricedProduct,
} from './quantityPricing'

/**
 * The quantity-pricing engine.
 *
 * Every product below is a real catalogue entry, priced at its real CMS price — the tests are
 * as much a check on the configuration as on the arithmetic, so a tier edited by mistake
 * fails here rather than in a customer's cart.
 */

/** aBoks Mini — the standard shape: 349 / 299 / 249, quote at 40. */
const MINI: QuantityPricedProduct = { slug: 'aboks-mini', price: 349 }
/** aBoks — 449 / 399 / 349, quote at 40. */
const ABOKS: QuantityPricedProduct = { slug: 'aboks', price: 449 }
/** aBoks Office — 549 / 499 / 449, quote at 40. */
const OFFICE: QuantityPricedProduct = { slug: 'aboks-office', price: 549 }
/** aBoks Spesial — 299 / 249 / 199, quote at 40. */
const SPESIAL: QuantityPricedProduct = { slug: 'aboks-spesial', price: 299 }
/** aBoks XL — the exception: 849 / 799 / 749 on 1–3 / 4–6 / 7+, quote at 11. */
const XL: QuantityPricedProduct = { slug: 'aboks-xl', price: 849 }
/** An accessory. No quantity pricing at all. */
const MODUL: QuantityPricedProduct = { slug: 'aa-modul', price: 99 }

describe('configuration', () => {
  it('prices the standard catalogue at its published tiers', () => {
    const expected: Record<string, [number, number, number]> = {
      // slug: [1–9, 10–19, 20+]
      aboks: [449, 399, 349],
      'aboks-mini': [349, 299, 249],
      'aboks-nano': [349, 299, 249],
      'aboks-vegg': [549, 499, 449],
      'aboks-office': [549, 499, 449],
      'aboks-spesial': [299, 249, 199],
    }

    for (const [slug, [base, second, third]] of Object.entries(expected)) {
      const product: QuantityPricedProduct = { slug, price: base }
      assert.equal(getUnitPrice(product, 1), base, `${slug} @1`)
      assert.equal(getUnitPrice(product, 9), base, `${slug} @9`)
      assert.equal(getUnitPrice(product, 10), second, `${slug} @10`)
      assert.equal(getUnitPrice(product, 19), second, `${slug} @19`)
      assert.equal(getUnitPrice(product, 20), third, `${slug} @20`)
      assert.equal(getUnitPrice(product, 39), third, `${slug} @39`)
      assert.equal(quoteThresholdFor(product), 40, `${slug} threshold`)
    }
  })

  it('gives aBoks XL its own bands and its own threshold', () => {
    assert.deepEqual(
      QUANTITY_PRICING['aboks-xl'].volumeTiers.map((t) => [t.minQuantity, t.unitPrice]),
      [
        [4, 799],
        [7, 749],
      ],
    )
    assert.equal(QUANTITY_PRICING['aboks-xl'].quoteThreshold, 11)
  })

  it('never configures a threshold that coincides with a price band', () => {
    // A threshold equal to a band's minimum would read as a fourth discount. Every product's
    // quote offer must sit strictly above its last price change.
    for (const [slug, config] of Object.entries(QUANTITY_PRICING)) {
      const last = config.volumeTiers[config.volumeTiers.length - 1]
      assert.ok(
        config.quoteThreshold > last.minQuantity,
        `${slug}: threshold ${config.quoteThreshold} must be above the last band ${last.minQuantity}`,
      )
    }
  })

  it('configures strictly ascending bands at strictly falling prices', () => {
    for (const [slug, config] of Object.entries(QUANTITY_PRICING)) {
      let previousQty = 1
      let previousPrice = Number.POSITIVE_INFINITY
      for (const tier of config.volumeTiers) {
        assert.ok(tier.minQuantity > previousQty, `${slug}: band ${tier.minQuantity} out of order`)
        assert.ok(tier.unitPrice < previousPrice, `${slug}: price ${tier.unitPrice} out of order`)
        assert.ok(tier.unitPrice > 0, `${slug}: price ${tier.unitPrice} must be positive`)
        previousQty = tier.minQuantity
        previousPrice = tier.unitPrice
      }
    }
  })
})

describe('standard product boundaries', () => {
  const cases: [number, number][] = [
    [1, 349],
    [9, 349],
    [10, 299],
    [19, 299],
    [20, 249],
    [39, 249],
    [40, 249],
    [41, 249],
  ]

  for (const [quantity, unitPrice] of cases) {
    it(`charges ${unitPrice} kr/stk at ${quantity}`, () => {
      assert.equal(getUnitPrice(MINI, quantity), unitPrice)
      assert.equal(getLineTotal(MINI, quantity), unitPrice * quantity)
    })
  }

  it('reprices every unit on the line, never only the units above the boundary', () => {
    assert.equal(getLineTotal(MINI, 9), 9 * 349)
    assert.equal(getLineTotal(MINI, 10), 10 * 299) // NOT 9 × 349 + 1 × 299
    assert.equal(getLineTotal(MINI, 19), 19 * 299)
    assert.equal(getLineTotal(MINI, 20), 20 * 249) // NOT 19 × 299 + 1 × 249
  })

  it('moves back down the moment the quantity does', () => {
    const transitions: [number, number, number, number][] = [
      // from, to, price before, price after
      [9, 10, 349, 299],
      [10, 9, 299, 349],
      [19, 20, 299, 249],
      [20, 19, 249, 299],
      [39, 40, 249, 249],
      [40, 39, 249, 249],
    ]
    for (const [from, to, before, after] of transitions) {
      assert.equal(getUnitPrice(MINI, from), before, `${from} → ${before}`)
      assert.equal(getUnitPrice(MINI, to), after, `${to} → ${after}`)
    }
  })
})

describe('the quote threshold is not a price', () => {
  it('40 costs exactly what 39 costs', () => {
    assert.equal(getUnitPrice(MINI, 40), getUnitPrice(MINI, 39))
    assert.equal(getLineTotal(MINI, 40), 40 * 249)
    assert.equal(getLineTotal(MINI, 40), 9960)
  })

  it('introduces no further discount above the threshold', () => {
    for (const quantity of [40, 41, 60, 99, 500]) {
      assert.equal(getUnitPrice(MINI, quantity), 249, `@${quantity}`)
    }
  })

  it('turns the quote offer on at the threshold and not before', () => {
    assert.equal(isQuoteThresholdReached(MINI, 39), false)
    assert.equal(isQuoteThresholdReached(MINI, 40), true)
    assert.equal(isQuoteThresholdReached(MINI, 41), true)
  })

  it('keeps the same price band across the threshold', () => {
    assert.equal(getPricingTier(MINI, 39).index, getPricingTier(MINI, 40).index)
  })

  it('offers no quote for a product without quantity pricing, at any quantity', () => {
    assert.equal(isQuoteThresholdReached(MODUL, 1), false)
    assert.equal(isQuoteThresholdReached(MODUL, 99), false)
    assert.equal(quoteThresholdFor(MODUL), null)
  })
})

describe('aBoks XL boundaries', () => {
  const cases: [number, number][] = [
    [1, 849],
    [3, 849],
    [4, 799],
    [6, 799],
    [7, 749],
    [10, 749],
    [11, 749],
    [12, 749],
  ]

  for (const [quantity, unitPrice] of cases) {
    it(`charges ${unitPrice} kr/stk at ${quantity}`, () => {
      assert.equal(getUnitPrice(XL, quantity), unitPrice)
    })
  }

  it('moves back down the moment the quantity does', () => {
    const transitions: [number, number, number, number][] = [
      [3, 4, 849, 799],
      [4, 3, 799, 849],
      [6, 7, 799, 749],
      [7, 6, 749, 799],
      [10, 11, 749, 749],
      [11, 10, 749, 749],
    ]
    for (const [from, to, before, after] of transitions) {
      assert.equal(getUnitPrice(XL, from), before, `${from} → ${before}`)
      assert.equal(getUnitPrice(XL, to), after, `${to} → ${after}`)
    }
  })

  it('11 costs exactly what 10 costs, and adds the quote offer', () => {
    assert.equal(getUnitPrice(XL, 11), getUnitPrice(XL, 10))
    assert.equal(isQuoteThresholdReached(XL, 10), false)
    assert.equal(isQuoteThresholdReached(XL, 11), true)
  })

  it('totals 12 × 749 = 8 988', () => {
    assert.equal(getLineTotal(XL, 12), 8988)
  })

  it('does not apply the standard 10 / 20 / 40 boundaries', () => {
    // 10 is inside XL's open-ended 7+ band, not the start of a new one.
    assert.equal(getPricingTier(XL, 7).index, getPricingTier(XL, 10).index)
    assert.equal(getUnitPrice(XL, 20), 749)
    assert.equal(isQuoteThresholdReached(XL, 4), false)
  })
})

describe('products without quantity pricing', () => {
  it('keeps the ordinary price at every quantity', () => {
    for (const quantity of [1, 9, 10, 19, 20, 39, 40, 99]) {
      assert.equal(getUnitPrice(MODUL, quantity), 99, `@${quantity}`)
      assert.equal(getLineTotal(MODUL, quantity), 99 * quantity, `@${quantity}`)
    }
  })

  it('reports one open-ended band and no configuration', () => {
    assert.equal(hasQuantityPricing(MODUL), false)
    assert.equal(quantityPricingFor(MODUL), null)
    assert.deepEqual(
      getPricingTiers(MODUL).map((t) => [t.minQuantity, t.maxQuantity, t.unitPrice]),
      [[1, null, 99]],
    )
    assert.equal(getNextPricingTier(MODUL, 1), null)
  })

  it('treats an unknown slug as unconfigured rather than failing', () => {
    const unknown: QuantityPricedProduct = { slug: 'ikke-i-katalogen', price: 1234 }
    assert.equal(getUnitPrice(unknown, 50), 1234)
    assert.equal(isQuoteThresholdReached(unknown, 50), false)
  })

  it('treats a missing slug as unconfigured', () => {
    const noSlug = { slug: '', price: 200 }
    assert.equal(getUnitPrice(noSlug, 25), 200)
    assert.equal(hasQuantityPricing(noSlug), false)
  })
})

describe('sale prices', () => {
  const onSale: QuantityPricedProduct = {
    slug: 'aboks-mini',
    price: 349,
    sale: { salePrice: 279 },
  }

  it('uses the sale price as the 1–9 band', () => {
    assert.equal(getUnitPrice(onSale, 1), 279)
    assert.equal(getUnitPrice(onSale, 9), 279)
  })

  it('never charges more than the sale price at a higher quantity', () => {
    // The 10–19 band is 299, above the 279 sale — the customer keeps the better price.
    assert.equal(getUnitPrice(onSale, 10), 279)
    // The 20+ band is 249, genuinely below the sale, so it wins.
    assert.equal(getUnitPrice(onSale, 20), 249)
  })

  it('ignores a sale window that has not started or has ended', () => {
    const expired: QuantityPricedProduct = {
      slug: 'aboks-mini',
      price: 349,
      sale: { salePrice: 279, saleEndDate: '2020-01-01T00:00:00.000Z' },
    }
    assert.equal(getUnitPrice(expired, 1), 349)
    assert.equal(getUnitPrice(expired, 10), 299)
  })
})

describe('quantities are never combined across products', () => {
  it('prices a mixed basket line by line', () => {
    // 12 × aBoks, 7 × Office, 25 × Spesial, 2 × XL — the totals are 46 units, which is above
    // every threshold in play, and not one line is priced as if it were.
    const lines: [QuantityPricedProduct, number, number][] = [
      [ABOKS, 12, 399], // 10–19 band
      [OFFICE, 7, 549], // still 1–9
      [SPESIAL, 25, 199], // 20–39 band
      [XL, 2, 849], // XL's own 1–3 band
    ]

    for (const [product, quantity, unitPrice] of lines) {
      assert.equal(getUnitPrice(product, quantity), unitPrice, product.slug)
    }

    const subtotal = lines.reduce((sum, [product, quantity]) => sum + getLineTotal(product, quantity), 0)
    assert.equal(subtotal, 12 * 399 + 7 * 549 + 25 * 199 + 2 * 849)
    assert.equal(subtotal, 4788 + 3843 + 4975 + 1698)

    // And nobody reached a quote threshold on the basket's 46 units either.
    for (const [product, quantity] of lines) {
      assert.equal(isQuoteThresholdReached(product, quantity), false, product.slug)
    }
  })

  it('prices a package of 3 + 12 + 25 as three independent lines, never as 40', () => {
    assert.equal(getUnitPrice(XL, 3), 849)
    assert.equal(getUnitPrice(OFFICE, 12), 499)
    assert.equal(getUnitPrice(SPESIAL, 25), 199)
    assert.equal(
      getLineTotal(XL, 3) + getLineTotal(OFFICE, 12) + getLineTotal(SPESIAL, 25),
      3 * 849 + 12 * 499 + 25 * 199,
    )
  })

  it('prices the same product bought in two lines by each line’s own quantity', () => {
    // Two colour variants of one product are two lines, and each is its own quantity. This is
    // the rule the cart obeys — a variant is the thing being bought.
    assert.equal(getUnitPrice(MINI, 6), 349)
    assert.equal(getUnitPrice(MINI, 6), getUnitPrice(MINI, 6))
    assert.notEqual(getUnitPrice(MINI, 12), getUnitPrice(MINI, 6))
  })
})

describe('tiers and next tier', () => {
  it('resolves the full table for a standard product', () => {
    assert.deepEqual(
      getPricingTiers(MINI).map((t) => [t.minQuantity, t.maxQuantity, t.unitPrice]),
      [
        [1, 9, 349],
        [10, 19, 299],
        [20, null, 249],
      ],
    )
  })

  it('resolves the full table for aBoks XL', () => {
    assert.deepEqual(
      getPricingTiers(XL).map((t) => [t.minQuantity, t.maxQuantity, t.unitPrice]),
      [
        [1, 3, 849],
        [4, 6, 799],
        [7, null, 749],
      ],
    )
  })

  it('points at the next band, and at nothing from the last one', () => {
    assert.equal(getNextPricingTier(MINI, 1)?.minQuantity, 10)
    assert.equal(getNextPricingTier(MINI, 9)?.unitPrice, 299)
    assert.equal(getNextPricingTier(MINI, 10)?.minQuantity, 20)
    assert.equal(getNextPricingTier(MINI, 20), null)
    assert.equal(getNextPricingTier(MINI, 40), null)
  })

  it('marks the catalogue band apart from the volume bands', () => {
    assert.equal(getPricingTier(MINI, 5).isVolumeTier, false)
    assert.equal(getPricingTier(MINI, 15).isVolumeTier, true)
    assert.equal(getPricingTier(MODUL, 50).isVolumeTier, false)
  })
})

describe('money is never a float', () => {
  it('computes in integer øre', () => {
    assert.equal(getUnitPriceOere(MINI, 12), 29900)
    assert.equal(getLineTotalOere(MINI, 12), 358800)
    assert.equal(Number.isInteger(getLineTotalOere(MINI, 12)), true)
  })

  it('keeps a non-round price exact across a whole line', () => {
    const odd: QuantityPricedProduct = { slug: 'ukjent', price: 0.1 }
    assert.equal(getLineTotalOere(odd, 3), 30)
    assert.equal(getLineTotal(odd, 3), 0.3)
  })

  it('returns integer øre for every configured product and band', () => {
    for (const slug of Object.keys(QUANTITY_PRICING)) {
      for (const tier of getPricingTiers({ slug, price: 1000 })) {
        assert.equal(Number.isInteger(tier.unitPriceOere), true, `${slug} @${tier.minQuantity}`)
      }
    }
  })
})

describe('odd quantities', () => {
  it('reads a fraction as whole units', () => {
    assert.equal(getUnitPrice(MINI, 10.9), 299)
    assert.equal(getLineTotalOere(MINI, 10.9), 10 * 29900)
  })

  it('never prices below one unit', () => {
    assert.equal(getUnitPrice(MINI, 0), 349)
    assert.equal(getUnitPrice(MINI, -5), 349)
    assert.equal(getLineTotal(MINI, 0), 349)
  })

  it('survives a nonsense quantity', () => {
    assert.equal(getUnitPrice(MINI, Number.NaN), 349)
    assert.equal(getUnitPrice(MINI, Number.POSITIVE_INFINITY), 349)
  })
})

describe('price table rows', () => {
  it('closes the last price band at the threshold and adds a quote row', () => {
    assert.deepEqual(
      buildPriceTableRows(MINI).map((r) => [r.range, r.unitPrice, r.isQuoteRow]),
      [
        ['1–9 stk.', 349, false],
        ['10–19 stk.', 299, false],
        ['20–39 stk.', 249, false],
        ['40+ stk.', 249, true],
      ],
    )
  })

  it('does the same for aBoks XL, with its own numbers', () => {
    assert.deepEqual(
      buildPriceTableRows(XL).map((r) => [r.range, r.unitPrice, r.isQuoteRow]),
      [
        ['1–3 stk.', 849, false],
        ['4–6 stk.', 799, false],
        ['7–10 stk.', 749, false],
        ['11+ stk.', 749, true],
      ],
    )
  })

  it('carries the published price on the quote row, not a blank', () => {
    const quoteRow = buildPriceTableRows(MINI).find((r) => r.isQuoteRow)
    assert.equal(quoteRow?.unitPrice, getUnitPrice(MINI, 40))
  })

  it('renders a single open-ended row for an unconfigured product', () => {
    assert.deepEqual(
      buildPriceTableRows(MODUL).map((r) => [r.range, r.unitPrice, r.isQuoteRow]),
      [['1+ stk.', 99, false]],
    )
  })

  it('writes ranges the way the page prints them', () => {
    assert.equal(formatTierRange({ minQuantity: 1, maxQuantity: 9 }), '1–9 stk.')
    assert.equal(formatTierRange({ minQuantity: 40, maxQuantity: null }), '40+ stk.')
    assert.equal(formatTierRange({ minQuantity: 5, maxQuantity: 5 }), '5 stk.')
  })
})
