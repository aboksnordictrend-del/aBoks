import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductClient from './ProductClient'

/**
 * The green «Kapasitet» band, rendered through the real page component.
 *
 * It answers "how many batteries fit inside", which only an aBoks can answer. On a Tilbehør
 * page — a battery multipack, say — it used to render as a heading over an empty grid.
 *
 * The rule is keyed on the CMS `section` field, whose stored value behind the «Tilbehør»
 * label is `accessories`. Not on a slug and not on a hand-kept list, so every accessory
 * published in future is covered by the same condition.
 */

/**
 * The eyebrow's pale-green colour, which appears exactly once in the page and only inside
 * this band. Deliberately not the band's `#39402c` background — the buy button and the
 * mobile bar are that colour too, so it would never disappear from the markup.
 */
const BAND_MARKER = '#a9c08f'
const BAND_HEADINGS = ['Plass til alt – hver for seg.', 'Plass til AA – og brukte batterier.']
const BAND_EYEBROWS = ['Tre rom, full kapasitet', 'To rom, kompakt design']

/** The prop shape ProductClient asks for, so a fixture can vary `section` and `images`. */
type ProductProp = React.ComponentProps<typeof ProductClient>['product']

const baseProduct: ProductProp = {
  id: 'p1',
  title: 'aBoks Mini',
  slug: 'aboks-mini',
  tagline: 'Kompakt',
  description: 'Kompakt oppbevaring.',
  price: 449,
  section: 'products',
  stock: 0,
  images: [],
  features: [],
  capacity: { aa: 20, aaa: 36, usedCompartments: 1 },
  details: [],
  faqs: [],
}

const variants = [
  {
    id: 'v1',
    name: 'Sort',
    colorHex: '#2b2b2b',
    image: 'https://blob.example/sort.webp',
    sku: 'AB-MINI-1',
    inventory: 10,
    sortOrder: 0,
    videoUrl: null,
    videoPoster: null,
  },
]

function render(product: ProductProp, productVariants = variants) {
  return renderToStaticMarkup(
    <ProductClient
      product={product}
      variants={productVariants}
      breadcrumbs={[{ label: 'Produkter', href: '/produkter' }]}
    />,
  )
}

/** Every trace of the band: its own colour, and both possible headings and eyebrows. */
function assertBandAbsent(html: string) {
  assert.ok(!html.includes(BAND_MARKER), 'the band’s section must not be rendered at all')
  for (const heading of [...BAND_HEADINGS, ...BAND_EYEBROWS]) {
    assert.ok(!html.includes(heading), `must not render «${heading}»`)
  }
}

describe('capacity band — Tilbehør', () => {
  it('is absent for an accessory, leaving no empty section behind', () => {
    const html = render({ ...baseProduct, section: 'accessories' })
    assertBandAbsent(html)
  })

  it('stays absent even when the accessory still carries capacity numbers in the CMS', () => {
    // Nothing is cleared in Payload — an accessory that inherited the field defaults keeps
    // them, and the frontend simply stops asking.
    const html = render({
      ...baseProduct,
      section: 'accessories',
      capacity: { aa: 20, aaa: 36, usedCompartments: 1 },
    })
    assertBandAbsent(html)
  })

  it('is absent for an accessory with no variants — the GP battery case', () => {
    const html = render(
      {
        ...baseProduct,
        title: 'GP Ultra Plus Alkaline AA-batteri, 10-pakk',
        slug: 'gp-ultra-plus-aa-10-pakk',
        section: 'accessories',
        stock: 10,
        images: [{ src: 'https://blob.example/gp.webp', alt: 'GP' }],
      },
      [],
    )
    assertBandAbsent(html)
  })
})

describe('capacity band — ordinary products are untouched', () => {
  it('renders for a product in the Produkter section', () => {
    const html = render(baseProduct)
    assert.ok(html.includes(BAND_MARKER))
    // Three rooms, because this product has AAA capacity.
    assert.ok(html.includes('Tre rom, full kapasitet'))
    assert.ok(html.includes('Plass til alt – hver for seg.'))
    assert.ok(html.includes('AA-batterier'))
    assert.ok(html.includes('AAA-batterier'))
    assert.ok(html.includes('rom for brukte'))
  })

  it('keeps the two-room wording for a product without AAA capacity', () => {
    const html = render({ ...baseProduct, capacity: { aa: 24, aaa: 0, usedCompartments: 8 } })
    assert.ok(html.includes('To rom, kompakt design'))
    assert.ok(html.includes('Plass til AA – og brukte batterier.'))
    assert.ok(!html.includes('AAA-batterier'), 'a product with no AAA lists no AAA room')
  })

  it('renders for a product whose section column predates the field', () => {
    // `getProductBySlug` can hand back a row with no section; the page reads that as an
    // ordinary product, so the band must stay exactly as it was.
    const html = render({ ...baseProduct, section: undefined as unknown as 'products' })
    assert.ok(html.includes(BAND_MARKER))
  })
})
