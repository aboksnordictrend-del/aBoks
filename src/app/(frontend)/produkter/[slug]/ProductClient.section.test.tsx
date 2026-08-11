import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductClient from './ProductClient'

/**
 * What the product page shows for Tilbehør versus Produkter, rendered through the real
 * component.
 *
 * Four things on this page are about the product's own nature rather than about its data:
 * the capacity band, the product video, the two trust claims that are only true of something
 * we make ourselves, and the framing above the feature cards. All four read one flag —
 * `product.section === 'accessories'`, the value stored behind the «Tilbehør» label in the
 * Products collection — so every accessory published in future is covered by the same rule,
 * with no slug and no hand-kept list anywhere.
 */

/** The capacity band's eyebrow colour: one occurrence in the page, only inside that band. */
const CAPACITY_MARKER = '#a9c08f'
const CAPACITY_HEADINGS = ['Plass til alt – hver for seg.', 'Plass til AA – og brukte batterier.']
const CAPACITY_EYEBROWS = ['Tre rom, full kapasitet', 'To rom, kompakt design']

/** Claims that are only true of an aBoks. */
const PLA_TRUST = 'Laget i Norge av biobasert PLA Matte'
const GIFT_TRUST = 'En perfekt gave til noen du er glad i'
/** Claims true of everything we sell — these must survive on both kinds of page. */
const UNIVERSAL_TRUST = [
  'Fast frakt 69 kr (fri frakt over kr 650)',
  '100 dagers åpent kjøp',
  'Sendes fra Norge innen 1–3 virkedager',
]

/**
 * The video section's label, printed by both branches of the block — the real player's
 * caption and the placeholder's — so its absence proves the whole section is gone, not just
 * the film.
 */
const VIDEO_LABEL = 'Produktvideo'
/** The placeholder's own rounded frame, the thing that would leave an empty box behind. */
const VIDEO_FRAME = 'aspect-ratio:16/9'

/** The prop shape ProductClient asks for, so a fixture can vary `section` and `images`. */
type ProductProp = React.ComponentProps<typeof ProductClient>['product']
type VariantProp = React.ComponentProps<typeof ProductClient>['variants'][number]

const FEATURES = [
  { id: 'f1', number: '01', title: 'Langvarig ytelse', description: 'Holder lenge.' },
  { id: 'f2', number: '02', title: 'For mange bruksområder', description: 'Passer overalt.' },
  { id: 'f3', number: '03', title: 'Praktisk 10-pakk', description: 'Alltid et batteri klart.' },
]

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
  features: FEATURES,
  capacity: { aa: 20, aaa: 36, usedCompartments: 1 },
  details: [],
  faqs: [],
}

const variantWithVideo: VariantProp = {
  id: 'v1',
  name: 'Sort',
  colorHex: '#2b2b2b',
  image: 'https://blob.example/sort.webp',
  sku: 'AB-MINI-1',
  inventory: 10,
  sortOrder: 0,
  videoUrl: 'https://blob.example/film.mp4',
  videoPoster: 'https://blob.example/sort.webp',
}

/** The same colour with no film — the page then falls back to the video placeholder. */
const variantWithoutVideo: VariantProp = { ...variantWithVideo, videoUrl: null, videoPoster: null }

function render(product: ProductProp, variants: VariantProp[] = [variantWithVideo]) {
  return renderToStaticMarkup(
    <ProductClient
      product={product}
      variants={variants}
      breadcrumbs={[{ label: 'Produkter', href: '/produkter' }]}
    />,
  )
}

/** An accessory as it really arrives: Tilbehør, no colours, its own stock and picture. */
const accessory: ProductProp = {
  ...baseProduct,
  title: 'GP Ultra Plus Alkaline AA-batteri, 10-pakk',
  slug: 'gp-ultra-plus-aa-10-pakk',
  section: 'accessories',
  stock: 10,
  images: [{ src: 'https://blob.example/gp.webp', alt: 'GP' }],
}

describe('Tilbehør — the capacity band', () => {
  it('is absent, leaving no empty section behind', () => {
    const html = render(accessory, [])
    assert.ok(!html.includes(CAPACITY_MARKER), 'the band’s section must not be rendered at all')
    for (const text of [...CAPACITY_HEADINGS, ...CAPACITY_EYEBROWS]) {
      assert.ok(!html.includes(text), `must not render «${text}»`)
    }
  })

  it('stays absent even when the accessory still carries capacity numbers in the CMS', () => {
    // Nothing is cleared in Payload — an accessory that inherited the field defaults keeps
    // them, and the frontend simply stops asking.
    const html = render({ ...accessory, capacity: { aa: 20, aaa: 36, usedCompartments: 1 } }, [])
    assert.ok(!html.includes(CAPACITY_MARKER))
  })
})

describe('Tilbehør — the trust signals', () => {
  it('drops the two aBoks-specific claims', () => {
    const html = render(accessory, [])
    assert.ok(!html.includes(PLA_TRUST), 'a third-party accessory is not printed from PLA Matte')
    assert.ok(!html.includes(GIFT_TRUST), 'and is not positioned as a gift')
  })

  it('keeps every universal claim, with no gap where the two were', () => {
    const html = render(accessory, [])
    for (const claim of UNIVERSAL_TRUST) {
      assert.ok(html.includes(claim), `must still render «${claim}»`)
    }
    // The rows are the list itself, so dropping two entries leaves three — never five with
    // two blanks. Counted by the tick icon that prefixes every row.
    const rows = html.split('M20 6L9 17l-5-5').length - 1
    assert.equal(rows, UNIVERSAL_TRUST.length)
  })
})

describe('Tilbehør — the product video', () => {
  it('is absent when the accessory has no film — no placeholder, no empty frame', () => {
    const html = render(accessory, [])
    assert.ok(!html.includes(VIDEO_LABEL), 'the whole section is gone, label included')
    assert.ok(!html.includes(VIDEO_FRAME), 'and so is its 16/9 frame')
  })

  it('is absent even when a variant does carry a film', () => {
    // The CMS field is never cleared; the page simply stops rendering the section.
    const html = render({ ...accessory, section: 'accessories' }, [variantWithVideo])
    assert.ok(!html.includes(VIDEO_LABEL))
    assert.ok(!html.includes(variantWithVideo.videoUrl as string))
  })
})

describe('Tilbehør — the feature section', () => {
  it('is framed as Produktfordeler rather than as an aBoks pitch', () => {
    const html = render(accessory, [])
    assert.ok(html.includes('Produktfordeler'), 'eyebrow and heading both read Produktfordeler')
    assert.ok(html.includes('Egenskaper og fordeler ved produktet.'))
    assert.ok(!html.includes('Hvorfor aBoks'))
    assert.ok(!html.includes('Derfor velger kunder aBoks'))
    assert.ok(!html.includes('Små detaljer som gjør hverdagen enklere.'))
  })

  it('prints the eyebrow uppercase, as it always has', () => {
    // The string is stored in sentence case and uppercased by CSS, so PRODUKTFORDELER on
    // screen comes from the same rule that renders HVORFOR ABOKS.
    const html = render(accessory, [])
    assert.match(html, /text-transform:uppercase[^"]*"[^>]*>Produktfordeler</)
  })

  it('leaves the CMS feature cards completely alone', () => {
    const html = render(accessory, [])
    for (const feature of FEATURES) {
      assert.ok(html.includes(feature.number), `card ${feature.number} still renders`)
      assert.ok(html.includes(feature.title))
      assert.ok(html.includes(feature.description))
    }
  })
})

describe('Produkter — nothing about an aBoks page changed', () => {
  it('keeps the capacity band, in both its three-room and two-room forms', () => {
    const threeRoom = render(baseProduct)
    assert.ok(threeRoom.includes(CAPACITY_MARKER))
    assert.ok(threeRoom.includes('Tre rom, full kapasitet'))
    assert.ok(threeRoom.includes('Plass til alt – hver for seg.'))
    assert.ok(threeRoom.includes('AAA-batterier'))

    const twoRoom = render({ ...baseProduct, capacity: { aa: 24, aaa: 0, usedCompartments: 8 } })
    assert.ok(twoRoom.includes('To rom, kompakt design'))
    assert.ok(twoRoom.includes('Plass til AA – og brukte batterier.'))
    assert.ok(!twoRoom.includes('AAA-batterier'), 'a product with no AAA lists no AAA room')
  })

  it('keeps all five trust signals, in their original order', () => {
    const html = render(baseProduct)
    const order = [...UNIVERSAL_TRUST, PLA_TRUST, GIFT_TRUST]
    let cursor = -1
    for (const claim of order) {
      const at = html.indexOf(claim)
      assert.ok(at > cursor, `«${claim}» must render, after the one before it`)
      cursor = at
    }
    assert.equal(html.split('M20 6L9 17l-5-5').length - 1, order.length)
  })

  it('keeps the product video — the real player when a film is configured', () => {
    const html = render(baseProduct, [variantWithVideo])
    assert.ok(html.includes(VIDEO_LABEL))
    assert.ok(html.includes(VIDEO_FRAME))
  })

  it('keeps the video section’s placeholder when no film is configured yet', () => {
    const html = render(baseProduct, [variantWithoutVideo])
    assert.ok(html.includes(VIDEO_LABEL), 'an aBoks still promises a video to come')
  })

  it('keeps the original feature heading word for word', () => {
    const html = render(baseProduct)
    assert.ok(html.includes('Hvorfor aBoks'))
    assert.ok(html.includes('Derfor velger kunder aBoks'))
    assert.ok(html.includes('Små detaljer som gjør hverdagen enklere.'))
    assert.ok(!html.includes('Produktfordeler'))
  })

  it('treats a row whose section column predates the field as an ordinary product', () => {
    // `getProductBySlug` can hand back a row with no section; nothing may drop out of a
    // /produkter page because of it.
    const html = render({ ...baseProduct, section: undefined as unknown as 'products' })
    assert.ok(html.includes(CAPACITY_MARKER))
    assert.ok(html.includes(PLA_TRUST))
    assert.ok(html.includes(GIFT_TRUST))
    assert.ok(html.includes(VIDEO_LABEL))
    assert.ok(html.includes('Derfor velger kunder aBoks'))
  })
})
