import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CART_LINE_TITLE_FALLBACK,
  cartLineLabel,
  cartLineTitle,
  productTitlesBySlug,
} from './lineTitle'

/**
 * The cart-line naming rules, as pure functions.
 *
 * The bug these exist to prevent: every cart line read "aBoks", whatever had been added,
 * because the title was a literal in the markup and no cart line ever carried one. The
 * assertions below are written so that a return to any hardcoded brand name fails.
 */

const CATALOGUE = productTitlesBySlug([
  { slug: 'aboks', title: 'aBoks' },
  { slug: 'aboks-mini', title: 'aBoks Mini' },
  { slug: 'aboks-vegg', title: 'aBoks Vegg' },
  { slug: 'kabelholder', title: 'Kabelholder' },
])

describe('cartLineTitle — each line shows its own product', () => {
  it('gives two different products two different titles', () => {
    const mini = { productSlug: 'aboks-mini', productTitle: 'aBoks Mini', colorName: 'Sort' }
    const vegg = { productSlug: 'aboks-vegg', productTitle: 'aBoks Vegg', colorName: 'Creme' }

    assert.equal(cartLineTitle(mini, CATALOGUE), 'aBoks Mini')
    assert.equal(cartLineTitle(vegg, CATALOGUE), 'aBoks Vegg')
    assert.notEqual(cartLineTitle(mini, CATALOGUE), cartLineTitle(vegg, CATALOGUE))
  })

  it('gives two colours of one product the same title and different colours', () => {
    const sort = { productSlug: 'aboks-vegg', productTitle: 'aBoks Vegg', colorName: 'Sort' }
    const creme = { productSlug: 'aboks-vegg', productTitle: 'aBoks Vegg', colorName: 'Creme' }

    assert.equal(cartLineTitle(sort, CATALOGUE), cartLineTitle(creme, CATALOGUE))
    assert.equal(cartLineTitle(sort, CATALOGUE), 'aBoks Vegg')
    // The colour is never folded into the title — it stays a field of its own.
    assert.ok(!cartLineTitle(sort, CATALOGUE).includes('Sort'))
    assert.notEqual(sort.colorName, creme.colorName)
  })

  it('names an accessory with its own title', () => {
    const accessory = { productSlug: 'kabelholder', productTitle: 'Kabelholder', colorName: 'Sort' }
    assert.equal(cartLineTitle(accessory, CATALOGUE), 'Kabelholder')
    assert.ok(!cartLineTitle(accessory, CATALOGUE).toLowerCase().includes('aboks'))
  })

  it('names a product the catalogue has never heard of from the line itself', () => {
    // A future product, or one added just before a rename — the stored title still answers.
    const future = { productSlug: 'aboks-office', productTitle: 'aBoks Office', colorName: 'Sort' }
    assert.equal(cartLineTitle(future, CATALOGUE), 'aBoks Office')
    assert.equal(cartLineTitle(future, {}), 'aBoks Office')
  })
})

describe('cartLineTitle — precedence and legacy carts', () => {
  it('prefers the live catalogue, so a rename in Payload is reflected', () => {
    const renamed = { productSlug: 'aboks-mini', productTitle: 'Gammelt navn', colorName: 'Sort' }
    assert.equal(cartLineTitle(renamed, CATALOGUE), 'aBoks Mini')
  })

  it('does not force «aBoks» onto a persisted legacy line', () => {
    // Exactly what is in a customer's localStorage today: no productTitle at all.
    const legacyMini = { productSlug: 'aboks-mini', colorName: 'Mørk blå' }
    const legacyVegg = { productSlug: 'aboks-vegg', colorName: 'Creme' }
    const legacyAboks = { productSlug: 'aboks', colorName: 'Sort' }

    assert.equal(cartLineTitle(legacyMini, CATALOGUE), 'aBoks Mini')
    assert.equal(cartLineTitle(legacyVegg, CATALOGUE), 'aBoks Vegg')
    // The one line that genuinely is aBoks still says so — the fix is not "never say aBoks".
    assert.equal(cartLineTitle(legacyAboks, CATALOGUE), 'aBoks')

    const titles = [legacyMini, legacyVegg, legacyAboks].map((i) => cartLineTitle(i, CATALOGUE))
    assert.equal(new Set(titles).size, 3, 'every legacy line must resolve to its own product')
  })

  it('falls back to a neutral word, never a brand, when nothing can name the line', () => {
    const orphan = { productSlug: 'slettet-produkt', colorName: 'Sort' }
    assert.equal(cartLineTitle(orphan, CATALOGUE), CART_LINE_TITLE_FALLBACK)
    assert.equal(CART_LINE_TITLE_FALLBACK, 'Produkt')
    assert.ok(!CART_LINE_TITLE_FALLBACK.toLowerCase().includes('aboks'))
  })

  it('ignores blank and whitespace-only titles from either source', () => {
    assert.equal(cartLineTitle({ productSlug: 'x', productTitle: '   ' }, {}), 'Produkt')
    assert.equal(
      cartLineTitle({ productSlug: 'aboks-mini', productTitle: 'Reserve' }, { 'aboks-mini': '  ' }),
      'Reserve',
    )
    assert.equal(cartLineTitle({ productSlug: 'x' }, null), 'Produkt')
  })
})

describe('cartLineLabel', () => {
  it('composes «Produkt – Farge» with the shared formatter', () => {
    const line = { productSlug: 'aboks-vegg', productTitle: 'aBoks Vegg', colorName: 'Mørk blå' }
    assert.equal(cartLineLabel(line, CATALOGUE), 'aBoks Vegg – Mørk blå')
  })

  it('names a legacy line correctly instead of prefixing «aBoks»', () => {
    assert.equal(
      cartLineLabel({ productSlug: 'aboks-mini', colorName: 'Sort' }, CATALOGUE),
      'aBoks Mini – Sort',
    )
  })

  it('omits the separator when a line has no colour', () => {
    assert.equal(cartLineLabel({ productSlug: 'kabelholder' }, CATALOGUE), 'Kabelholder')
  })
})

describe('productTitlesBySlug', () => {
  it('maps published products from both catalogues', () => {
    assert.equal(CATALOGUE['aboks-mini'], 'aBoks Mini')
    assert.equal(CATALOGUE['kabelholder'], 'Kabelholder')
  })

  it('skips documents missing a slug or a title rather than storing blanks', () => {
    const map = productTitlesBySlug([
      { slug: 'ok', title: 'Ok' },
      { slug: '', title: 'Uten slug' },
      { slug: 'uten-tittel', title: '' },
      { slug: 'null-tittel', title: null },
      { title: 'Ingen slug' },
    ])
    assert.deepEqual(map, { ok: 'Ok' })
  })
})
