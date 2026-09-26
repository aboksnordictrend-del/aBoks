import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import CartLine from './CartLine'
import { formatPrice } from '@/lib/format'
import type { CartItem } from '@/store/cart'

/**
 * What the cart actually prints for each line.
 *
 * The regression under test: every line read "aBoks", whatever had been added, because the
 * product name was a literal in this markup and no cart line carried a title at all. Each
 * assertion below is written so that re-introducing a hardcoded name fails here.
 *
 * CartLine is rendered directly rather than through CartClient: a zustand-persisted store
 * reports its *initial* (empty) state to React's server renderer, so a server-rendered
 * CartClient always shows the empty cart no matter what is in the store.
 */

const CATALOGUE = {
  aboks: 'aBoks',
  'aboks-mini': 'aBoks Mini',
  'aboks-vegg': 'aBoks Vegg',
  kabelholder: 'Kabelholder',
}

const noop = () => {}

function item(overrides: Partial<CartItem> & Pick<CartItem, 'variantId' | 'productSlug'>): CartItem {
  return {
    colorName: 'Sort',
    colorHex: '#1a1d17',
    colorImage: '/sort.jpg',
    price: 499,
    qty: 1,
    ...overrides,
  }
}

function render(line: CartItem, productTitles?: Record<string, string>): string {
  return renderToStaticMarkup(
    <CartLine
      item={line}
      productTitles={productTitles}
      onDecrement={noop}
      onIncrement={noop}
      onRemove={noop}
    />,
  )
}

/** The `<h3>` text — where the product name goes. */
function title(html: string): string {
  return html.match(/<h3[^>]*>([^<]*)<\/h3>/)?.[1] ?? ''
}

describe('cart line shows its own product', () => {
  it('names two different products differently', () => {
    const mini = render(
      item({ variantId: '1', productSlug: 'aboks-mini', productTitle: 'aBoks Mini' }),
      CATALOGUE,
    )
    const vegg = render(
      item({ variantId: '2', productSlug: 'aboks-vegg', productTitle: 'aBoks Vegg', colorName: 'Creme' }),
      CATALOGUE,
    )

    assert.equal(title(mini), 'aBoks Mini')
    assert.equal(title(vegg), 'aBoks Vegg')
    assert.notEqual(title(mini), title(vegg))
  })

  it('gives two colours of one product the same title and separate colour labels', () => {
    const base = { variantId: '1', productSlug: 'aboks-vegg', productTitle: 'aBoks Vegg' }
    const sort = render(item({ ...base, colorName: 'Sort' }), CATALOGUE)
    const creme = render(item({ ...base, variantId: '2', colorName: 'Creme' }), CATALOGUE)

    assert.equal(title(sort), title(creme))
    assert.equal(title(sort), 'aBoks Vegg')

    // Each colour is shown, on its own line, and neither is folded into the title.
    assert.ok(sort.includes('>Sort</span>'))
    assert.ok(creme.includes('>Creme</span>'))
    assert.ok(!title(sort).includes('Sort'))
    assert.ok(!title(creme).includes('Creme'))
  })

  it('names an accessory with its own title', () => {
    const html = render(
      item({ variantId: '9', productSlug: 'kabelholder', productTitle: 'Kabelholder' }),
      CATALOGUE,
    )
    assert.equal(title(html), 'Kabelholder')
    assert.ok(!title(html).toLowerCase().includes('aboks'))
  })

  it('names a line the catalogue does not know from the title stored on it', () => {
    const html = render(
      item({ variantId: '1', productSlug: 'aboks-office', productTitle: 'aBoks Office' }),
      CATALOGUE,
    )
    assert.equal(title(html), 'aBoks Office')
  })
})

describe('cart line with legacy persisted data', () => {
  it('does not force «aBoks» onto lines saved before titles were stored', () => {
    // Exactly what sits in customers' localStorage today: no productTitle at all.
    const titles = [
      render(item({ variantId: '1', productSlug: 'aboks-mini' }), CATALOGUE),
      render(item({ variantId: '2', productSlug: 'aboks-vegg', colorName: 'Creme' }), CATALOGUE),
      render(item({ variantId: '3', productSlug: 'aboks' }), CATALOGUE),
    ].map(title)

    assert.deepEqual(titles, ['aBoks Mini', 'aBoks Vegg', 'aBoks'])
    assert.equal(new Set(titles).size, 3, 'legacy lines must not collapse to one name')
  })

  it('prefers the live catalogue over a stale stored title', () => {
    const html = render(
      item({ variantId: '1', productSlug: 'aboks-mini', productTitle: 'Gammelt navn' }),
      CATALOGUE,
    )
    assert.equal(title(html), 'aBoks Mini')
  })

  it('says «Produkt», never a brand, when a line cannot be identified at all', () => {
    const html = render(item({ variantId: '1', productSlug: 'slettet' }), CATALOGUE)
    assert.equal(title(html), 'Produkt')
    assert.ok(!html.includes('>aBoks<'))
  })
})

describe('the rest of the line is unchanged', () => {
  const line = item({
    variantId: '7',
    productSlug: 'aboks-mini',
    productTitle: 'aBoks Mini',
    price: 299,
    qty: 3,
  })
  const html = render(line, CATALOGUE)

  it('keeps the quantity stepper and its labels', () => {
    assert.ok(html.includes('aria-label="Færre"'))
    assert.ok(html.includes('aria-label="Flere"'))
    assert.ok(html.includes('>3</span>'))
  })

  it('keeps the remove control', () => {
    assert.ok(html.includes('Fjern'))
  })

  it('keeps the line total, priced exactly as before', () => {
    assert.ok(html.includes(formatPrice(897))) // 3 × 299
  })

  it('keeps the colour swatch and the product image', () => {
    assert.ok(html.includes('#1a1d17'))
    assert.ok(html.includes('/sort.jpg'))
    assert.ok(html.includes('alt="Sort"'))
  })
})

/**
 * What the line prints once quantity pricing is in play.
 *
 * Rendered markup rather than the helper, deliberately: the regression these guard against is
 * a component going back to `item.qty * item.price`, and only the markup can catch that.
 */

/** The text of the rendered line, with tags stripped and whitespace flattened. */
function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** aBoks Mini at its catalogue price: 349 / 299 / 249, quote at 40. */
const mini = (qty: number): CartItem =>
  item({ variantId: '60', productSlug: 'aboks-mini', productTitle: 'aBoks Mini', price: 349, qty })

describe('cart line — quantity pricing', () => {
  it('prints the catalogue price and total below the first band', () => {
    const html = render(mini(9))
    assert.ok(html.includes(formatPrice(9 * 349)), '9 × 349 is the line total')
    assert.ok(!html.includes(formatPrice(299)), 'no band is active yet')
  })

  it('reprices the whole line at the band, and shows the unit price', () => {
    const html = render(mini(10))
    assert.ok(html.includes(formatPrice(10 * 299)), '10 × 299 is the line total')
    assert.ok(html.includes(`${formatPrice(299)} per stk.`), 'the effective unit price is shown')
    // The old figure is still on screen, struck through, but never as the total.
    assert.ok(html.includes(formatPrice(349)), 'the ordinary price is struck through')
    assert.ok(html.includes('line-through'))
    assert.ok(!html.includes(formatPrice(10 * 349)), 'the undiscounted total is never printed')
  })

  it('goes back to the catalogue price when the quantity drops', () => {
    const html = render(mini(9))
    assert.ok(!html.includes('line-through'), 'nothing is struck through at the ordinary price')
    assert.ok(html.includes(`${formatPrice(349)} per stk.`))
  })

  it('shows the 20+ price at 20, and the same price at 40', () => {
    assert.ok(render(mini(20)).includes(formatPrice(20 * 249)))
    assert.ok(render(mini(39)).includes(formatPrice(39 * 249)))
    assert.ok(render(mini(40)).includes(formatPrice(40 * 249)))
  })

  it('prints no unit-price row for a single unit', () => {
    const html = render(mini(1))
    assert.ok(!html.includes('per stk.'), 'the line total already is the unit price')
    assert.ok(html.includes(formatPrice(349)))
  })

  it('offers a quote at the threshold — beside the price, not instead of it', () => {
    const html = render(mini(40))
    assert.ok(html.includes('Be om tilbud'), 'the CTA appears')
    assert.ok(html.includes('/bedrifter?produkt=aboks-mini&amp;antall=40'), 'it carries context')
    assert.ok(html.includes('40 eller flere'), 'the explanation names the threshold')
    assert.ok(html.includes(formatPrice(40 * 249)), 'the line is still priced and totalled')
    // And the ordinary controls are all still there.
    assert.ok(html.includes('aria-label="Flere"'))
    assert.ok(html.includes('Fjern'))
  })

  it('makes no quote offer one unit below the threshold', () => {
    assert.ok(!render(mini(39)).includes('Be om tilbud'))
  })

  it('uses aBoks XL’s own bands and its own threshold', () => {
    const xl = (qty: number) =>
      item({ variantId: '61', productSlug: 'aboks-xl', productTitle: 'aBoks XL', price: 849, qty })

    assert.ok(render(xl(3)).includes(formatPrice(3 * 849)))
    assert.ok(render(xl(4)).includes(formatPrice(4 * 799)))
    assert.ok(render(xl(7)).includes(formatPrice(7 * 749)))
    assert.ok(!render(xl(10)).includes('Be om tilbud'), 'no offer at 10')
    assert.ok(render(xl(11)).includes('Be om tilbud'), 'but one at 11')
    assert.ok(render(xl(11)).includes(formatPrice(11 * 749)), 'at the same unit price')
  })

  it('leaves a product with no quantity pricing exactly as it was', () => {
    const accessory = item({
      productId: '70',
      productSlug: 'aa-modul',
      productTitle: 'AA-Modul',
      colorName: '',
      colorHex: '',
      colorImage: '',
      price: 99,
      qty: 40,
    })
    const html = render(accessory)
    assert.ok(html.includes(formatPrice(40 * 99)))
    assert.ok(!html.includes('line-through'))
    assert.ok(!html.includes('Be om tilbud'))
    assert.ok(text(html).includes('AA-Modul'))
  })
})
