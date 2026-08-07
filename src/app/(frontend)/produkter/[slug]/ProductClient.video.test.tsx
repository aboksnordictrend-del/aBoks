import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductClient from './ProductClient'

/**
 * The product video block, rendered through the real page component.
 *
 * The regression: all four aBoks Vegg colours share one film that was uploaded
 * without a `-poster.webp`, so the derived poster 404'd and the frame sat on its
 * flat background. The still now arrives resolved from the server as
 * `variant.videoPoster` — the markup must carry it as handed over, for the
 * selected colour, and must still not put the film in `src`.
 */

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'
/** What production really stores: one film on every aBoks Vegg variant. */
const VEGG_VIDEO = `${BLOB}/Video/aBoks-Vegg-4x3.mp4`

const VEGG_COLOURS = [
  { name: 'Sort', hex: '#2b2b2b', image: `${BLOB}/aBoks-vegg-sort-1.webp` },
  { name: 'Olivengrønn', hex: '#5d6b4a', image: `${BLOB}/aBoks-vegg-olive-2.webp` },
  { name: 'Mørk blå', hex: '#2f3d55', image: `${BLOB}/aBoks-vegg-mork-blue-2.webp` },
  { name: 'Creme', hex: '#e8dfcc', image: `${BLOB}/aBoks-vegg-creme-1.webp` },
]

const veggVariants = VEGG_COLOURS.map((colour, i) => ({
  id: `v${i + 1}`,
  name: colour.name,
  colorHex: colour.hex,
  image: colour.image,
  sku: `AB-VEGG-${i + 1}`,
  inventory: 10,
  sortOrder: i,
  videoUrl: VEGG_VIDEO,
  // What withVideoPosters hands over for a film with no still of its own.
  videoPoster: colour.image,
}))

const product = {
  id: 'p1',
  title: 'aBoks Vegg',
  slug: 'aboks-vegg',
  tagline: 'Veggmontert',
  description: 'Veggmontert oppbevaring.',
  price: 899,
  images: [],
  features: [],
  capacity: { aa: 24, aaa: 0, usedCompartments: 8 },
  details: [],
  faqs: [],
}

function render(sku?: string, variants = veggVariants) {
  return renderToStaticMarkup(
    <ProductClient
      product={product}
      variants={variants}
      initialSku={sku}
      breadcrumbs={[{ label: 'Produkter', href: '/produkter' }]}
    />,
  )
}

describe('product video poster', () => {
  it('shows the selected colour its own picture, for every aBoks Vegg colour', () => {
    for (const variant of veggVariants) {
      const html = render(variant.sku)
      assert.match(
        html,
        new RegExp(`<video[^>]*poster="${variant.image}"`),
        `${variant.name} should be posted with its own image`,
      )
      // And never the still that was never uploaded.
      assert.doesNotMatch(html, /aBoks-Vegg-4x3-poster\.webp/)
    }
  })

  it('poster and film are settled in the server markup, not after hydration', () => {
    // Safari lays a poster out once; anything that arrives later is ignored.
    const html = render('AB-VEGG-2')
    assert.match(html, new RegExp(`<video[^>]*poster="${VEGG_COLOURS[1].image}"`))
    assert.match(html, new RegExp(`data-src="${VEGG_VIDEO}"`))
  })

  it('still refuses to load the film before the press', () => {
    const html = render('AB-VEGG-1')
    assert.match(html, /<video[^>]*preload="none"/)
    assert.doesNotMatch(html, new RegExp(`<video[^>]*[^-]src="${VEGG_VIDEO}"`))
    assert.doesNotMatch(html, /autoplay/i)
    assert.match(html, /aria-label="Spill av produktvideo: aBoks Sort"/)
  })

  it('keeps the frame filled edge to edge', () => {
    const html = render('AB-VEGG-1')
    assert.match(html, /<video[^>]*style="[^"]*object-fit:cover/)
  })

  it('carries an uploaded still through untouched — /produkter/aboks', () => {
    // Those four films really do have a -poster.webp beside them, and the server
    // resolver keeps pointing at it.
    const aboks = [
      {
        ...veggVariants[0],
        name: 'Olivengrønn',
        sku: 'AB-1',
        image: `${BLOB}/aBoks-olive.webp`,
        videoUrl: `${BLOB}/Video/aBoks-olive-video-1.mp4`,
        videoPoster: `${BLOB}/Video/aBoks-olive-video-1-poster.webp`,
      },
    ]
    const html = render('AB-1', aboks)
    assert.match(html, new RegExp(`<video[^>]*poster="${BLOB}/Video/aBoks-olive-video-1-poster\\.webp"`))
    assert.doesNotMatch(html, new RegExp(`poster="${BLOB}/aBoks-olive\\.webp"`))
  })
})
