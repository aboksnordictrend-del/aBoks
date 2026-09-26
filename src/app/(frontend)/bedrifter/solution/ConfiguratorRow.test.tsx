import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ConfiguratorRow from './ConfiguratorRow'
import { formatPrice } from '@/lib/format'
import {
  getLineTotal,
  getNextPricingTier,
  getUnitPrice,
  isQuoteThresholdReached,
} from '@/lib/quantityPricing'
import { getEffectivePrice } from '@/lib/pricing'
import type { ConfigurableProduct } from '@/lib/solutions/types'

/**
 * The quantity-price guidance on a solution configurator card.
 *
 * The props are derived here exactly as `SolutionConfigurator` derives them — from the shared
 * engine, by the same four calls — so these tests cover the derivation as well as the markup.
 * The whole point of the feature is that the card promotes a *real* lower price and never the
 * quote threshold, and `getNextPricingTier` returning null in the last band is what guarantees
 * it; the assertions below are written so that inventing a "Kjøp 40 stk." message anywhere
 * fails here.
 */

const product = (
  slug: string,
  title: string,
  price: number,
): ConfigurableProduct => ({
  id: '1',
  slug,
  title,
  tagline: '',
  price,
  sale: null,
  image: '',
  imageAlt: title,
  defaultQuantity: 0,
  variants: [],
})

/** aBoks Office: 549 / 499 / 449 on 1–9 / 10–19 / 20+, quote from 40. */
const OFFICE = product('aboks-office', 'aBoks Office', 549)
/** aBoks XL: 849 / 799 / 749 on 1–3 / 4–6 / 7+, quote from 11. */
const XL = product('aboks-xl', 'aBoks XL', 849)

/**
 * Renders one card at one quantity, with every price taken from the engine — the same calls,
 * in the same order, that the configurator makes for each of its lines.
 */
function card(p: ConfigurableProduct, quantity: number): string {
  const basePrice = getEffectivePrice(p.price, p.sale)
  return renderToStaticMarkup(
    <ConfiguratorRow
      product={p}
      quantity={quantity}
      basePrice={basePrice}
      unitPrice={getUnitPrice(p, Math.max(1, quantity))}
      lineTotal={quantity > 0 ? getLineTotal(p, quantity) : 0}
      nextTier={getNextPricingTier(p, Math.max(1, quantity))}
      onVariantChange={() => {}}
      onQuantityChange={() => {}}
    />,
  )
}

/** Visible text, tags stripped and whitespace flattened. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * An amount as it reads in flattened text. `formatPrice` separates with a non-breaking space,
 * which `text()` above flattens along with every other run of whitespace — so assertions
 * against extracted text compare with this, and assertions against raw markup with
 * `formatPrice` itself.
 */
function nok(amount: number): string {
  return formatPrice(amount).replace(/ /g, ' ')
}

/** The «Kjøp N stk. og betal …» sentence, or null when the card shows none. */
function nextTierMessage(html: string): string | null {
  return text(html).match(/Kjøp \d+ stk\. og betal [^·]*? per stk\./)?.[0]?.trim() ?? null
}

/** The «kr X per stk.» figure the card reports for the current quantity. */
function unitPriceShown(html: string): string | null {
  return text(html).match(/(kr[\s ][\d\s ]+) per stk\./)?.[1]?.trim() ?? null
}

describe('configurator card — aBoks Office guidance', () => {
  const cases: {
    quantity: number
    unitPrice: number
    next: { minQuantity: number; unitPrice: number } | null
  }[] = [
    { quantity: 1, unitPrice: 549, next: { minQuantity: 10, unitPrice: 499 } },
    { quantity: 9, unitPrice: 549, next: { minQuantity: 10, unitPrice: 499 } },
    { quantity: 10, unitPrice: 499, next: { minQuantity: 20, unitPrice: 449 } },
    { quantity: 19, unitPrice: 499, next: { minQuantity: 20, unitPrice: 449 } },
    // The last automatic band. There is no cheaper price left, so nothing is promoted.
    { quantity: 20, unitPrice: 449, next: null },
    { quantity: 39, unitPrice: 449, next: null },
    // The quote threshold. Same price as 39, and still no promoted "next price".
    { quantity: 40, unitPrice: 449, next: null },
  ]

  for (const { quantity, unitPrice, next } of cases) {
    it(`at ${quantity} shows ${unitPrice} kr/stk and ${next ? `promotes ${next.minQuantity}` : 'promotes nothing'}`, () => {
      const html = card(OFFICE, quantity)

      assert.equal(unitPriceShown(html), nok(unitPrice), 'current unit price')

      if (next) {
        assert.equal(
          nextTierMessage(html),
          `Kjøp ${next.minQuantity} stk. og betal ${nok(next.unitPrice)} per stk.`,
        )
      } else {
        assert.equal(nextTierMessage(html), null, 'no next price may be promoted')
      }
    })
  }

  it('strikes the ordinary price through only while a band is active', () => {
    assert.ok(!card(OFFICE, 9).includes('line-through'), 'nothing struck at the ordinary price')
    const banded = card(OFFICE, 10)
    assert.ok(banded.includes('line-through'))
    assert.ok(banded.includes(formatPrice(549)), 'the ordinary price is what is struck through')
  })

  it('never promotes the 40-unit quote threshold as a cheaper price', () => {
    for (const quantity of [20, 25, 39, 40, 41, 120]) {
      const html = card(OFFICE, quantity)
      assert.ok(!text(html).includes('Kjøp 40 stk.'), `@${quantity}`)
      assert.equal(nextTierMessage(html), null, `@${quantity}`)
      // …and the price genuinely has not moved.
      assert.equal(unitPriceShown(html), nok(449), `@${quantity}`)
    }
  })

  it('keeps the line total and the headline price unchanged', () => {
    const html = card(OFFICE, 19)
    assert.ok(text(html).includes(`${nok(19 * 499)} for 19 stk.`), 'line total')
    // The card's headline stays the price of one, as it always was.
    assert.ok(html.includes(formatPrice(549)))
  })

  it('shows nothing extra for a product that is not in the solution', () => {
    const html = card(OFFICE, 0)
    assert.ok(text(html).includes('Ikke med i løsningen'))
    assert.equal(nextTierMessage(html), null)
    assert.equal(unitPriceShown(html), null)
  })
})

describe('configurator card — aBoks XL guidance', () => {
  const cases: {
    quantity: number
    unitPrice: number
    next: { minQuantity: number; unitPrice: number } | null
  }[] = [
    { quantity: 1, unitPrice: 849, next: { minQuantity: 4, unitPrice: 799 } },
    { quantity: 3, unitPrice: 849, next: { minQuantity: 4, unitPrice: 799 } },
    { quantity: 4, unitPrice: 799, next: { minQuantity: 7, unitPrice: 749 } },
    { quantity: 6, unitPrice: 799, next: { minQuantity: 7, unitPrice: 749 } },
    // The last automatic band for XL — 10 is inside it, not a boundary.
    { quantity: 7, unitPrice: 749, next: null },
    { quantity: 10, unitPrice: 749, next: null },
    // XL's own quote threshold. Same price as 10.
    { quantity: 11, unitPrice: 749, next: null },
  ]

  for (const { quantity, unitPrice, next } of cases) {
    it(`at ${quantity} shows ${unitPrice} kr/stk and ${next ? `promotes ${next.minQuantity}` : 'promotes nothing'}`, () => {
      const html = card(XL, quantity)

      assert.equal(unitPriceShown(html), nok(unitPrice), 'current unit price')

      if (next) {
        assert.equal(
          nextTierMessage(html),
          `Kjøp ${next.minQuantity} stk. og betal ${nok(next.unitPrice)} per stk.`,
        )
      } else {
        assert.equal(nextTierMessage(html), null, 'no next price may be promoted')
      }
    })
  }

  it('never promotes the 11-unit quote threshold as a cheaper price', () => {
    for (const quantity of [7, 10, 11, 12, 30]) {
      const html = card(XL, quantity)
      assert.ok(!text(html).includes('Kjøp 11 stk.'), `@${quantity}`)
      assert.equal(nextTierMessage(html), null, `@${quantity}`)
      assert.equal(unitPriceShown(html), nok(749), `@${quantity}`)
    }
  })

  it('does not use the standard 10 / 20 boundaries', () => {
    // 10 is not a band start for XL, so nothing changes there and nothing is promoted.
    assert.equal(unitPriceShown(card(XL, 9)), nok(749))
    assert.equal(unitPriceShown(card(XL, 10)), nok(749))
    assert.ok(!text(card(XL, 9)).includes('Kjøp 10 stk.'))
    assert.ok(!text(card(XL, 19)).includes('Kjøp 20 stk.'))
  })
})

describe('configurator card — a product with no quantity pricing', () => {
  /** An accessory: no bands, no threshold. */
  const MODUL = product('aa-modul', 'AA-Modul', 99)

  it('promotes nothing and strikes nothing through, at any quantity', () => {
    for (const quantity of [1, 10, 20, 40, 120]) {
      const html = card(MODUL, quantity)
      assert.equal(nextTierMessage(html), null, `@${quantity}`)
      assert.ok(!html.includes('line-through'), `@${quantity}`)
      assert.equal(unitPriceShown(html), nok(99), `@${quantity}`)
      assert.equal(isQuoteThresholdReached(MODUL, quantity), false, `@${quantity}`)
    }
  })
})

describe('configurator card — a product on sale', () => {
  const onSale: ConfigurableProduct = {
    ...product('aboks-office', 'aBoks Office', 549),
    sale: { salePrice: 479 },
  }

  it('keeps the sale on the headline and the band on the guidance line', () => {
    // At 1–9 the sale price is the unit price, and the headline shows it with 549 struck.
    const single = card(onSale, 1)
    assert.equal(unitPriceShown(single), nok(479))
    assert.ok(single.includes(formatPrice(549)), 'the catalogue price is struck on the headline')

    // The 10–19 band (499) is above the 479 sale, so the customer keeps 479 and nothing is
    // promoted as an improvement on it until a band genuinely beats it.
    assert.equal(unitPriceShown(card(onSale, 10)), nok(479))
    // The 20+ band is 449, genuinely lower, and that is what gets promoted and then applied.
    assert.equal(
      nextTierMessage(card(onSale, 10)),
      `Kjøp 20 stk. og betal ${nok(449)} per stk.`,
    )
    assert.equal(unitPriceShown(card(onSale, 20)), nok(449))
  })
})
