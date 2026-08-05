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
