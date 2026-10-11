import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductClient from './ProductClient'
import { productGuide } from '@/lib/productGuides'

/**
 * The PDF guide link below a product's accordion group, rendered through the real page
 * component.
 *
 * Three things matter and are all structural rather than visual: the link carries the
 * model's own PDF, it sits after the last accordion rather than inside a panel, and aBoks
 * Vegg — which had the link hard-coded before the guides were shared — has exactly one.
 */

type ProductProp = React.ComponentProps<typeof ProductClient>['product']
type VariantProp = React.ComponentProps<typeof ProductClient>['variants'][number]

/** The three accordion panels every aBoks page carries. */
const DETAILS = [
  { id: 'd1', title: 'Dette følger med', content: 'Boksen og festemateriell.' },
  { id: 'd2', title: 'Produktdetaljer', content: 'Mål og materiale.' },
  { id: 'd3', title: 'Frakt og retur', content: '100 dagers åpent kjøp.' },
]

function product(slug: string, title: string): ProductProp {
  return {
    id: 'p1',
    title,
    slug,
    tagline: 'Oppbevaring',
    description: 'Oppbevaring av batterier.',
    price: 899,
    section: 'products',
    stock: 0,
    images: [],
    features: [],
    capacity: { aa: 24, aaa: 0, usedCompartments: 8 },
    details: DETAILS,
    faqs: [],
  }
}

const variants: VariantProp[] = [
  {
    id: 'v1',
    name: 'Sort',
    colorHex: '#2b2b2b',
    image: 'https://blob.example/sort.webp',
    sku: 'AB-1',
    inventory: 10,
    sortOrder: 0,
    videoUrl: null,
    videoPoster: null,
  },
]

function render(p: ProductProp) {
  return renderToStaticMarkup(
    <ProductClient
      product={p}
      variants={variants}
      breadcrumbs={[{ label: 'Produkter', href: '/produkter' }]}
    />,
  )
}

/** Every model that has a guide, with the wording its kind calls for. */
const MODELS: [slug: string, title: string, label: string][] = [
  ['aboks', 'aBoks', 'Last ned bruksveiledning'],
  ['aboks-mini', 'aBoks Mini', 'Last ned bruksveiledning'],
  ['aboks-nano', 'aBoks Nano', 'Last ned bruksveiledning'],
  ['aboks-office', 'aBoks Office', 'Last ned bruksveiledning'],
  ['aboks-spesial', 'aBoks Spesial', 'Last ned monteringsveiledning'],
  ['aboks-vegg', 'aBoks Vegg', 'Last ned monteringsveiledning'],
  ['aboks-xl', 'aBoks XL', 'Last ned monteringsveiledning'],
]

describe('the guide link on a product page', () => {
  for (const [slug, title, label] of MODELS) {
    it(`${title} links its own PDF in a new tab`, () => {
      const html = render(product(slug, title))
      const url = productGuide(slug)!.url
      assert.ok(html.includes(`href="${url}"`), `${slug} does not link ${url}`)
      assert.ok(html.includes(label), `${slug} is missing "${label}"`)

      // The anchor itself opens in a new tab with the referrer and opener withheld.
      const anchor = html.slice(html.indexOf(`href="${url}"`))
      const end = anchor.indexOf('>')
      assert.match(anchor.slice(0, end), /target="_blank"/)
      assert.match(anchor.slice(0, end), /rel="noopener noreferrer"/)
    })
  }

  // The regression this replaces: the link was matched on the CMS title and rendered from a
  // second hard-coded URL, so Vegg could end up with two.
  it('aBoks Vegg has exactly one guide link, not a duplicate', () => {
    const html = render(product('aboks-vegg', 'aBoks Vegg'))
    const url = productGuide('aboks-vegg')!.url
    assert.equal(html.split(`href="${url}"`).length - 1, 1)
    // Counted on the filename rather than the link text, which the anchor's own
    // `aria-label` repeats: one mention of the PDF anywhere in the page means one link.
    assert.equal(html.split('Monteringsveiledning.pdf').length - 1, 1)
    // The superseded path the link used to point at is gone.
    assert.ok(!html.includes('/aboks-vegg/aBoks-Vegg-Monteringsveiledning.pdf'))
  })

  // A closed accordion panel renders nothing, so the last panel's *button* is what marks
  // the end of the group — the link must follow it, not sit between two of them.
  it('sits after the last accordion, outside its panels', () => {
    const html = render(product('aboks-vegg', 'aBoks Vegg'))
    const lastHeader = html.lastIndexOf(DETAILS[2].title)
    const link = html.indexOf(productGuide('aboks-vegg')!.url)
    assert.ok(lastHeader > 0 && link > 0)
    assert.ok(link > lastHeader, 'the guide link renders before the accordion group ends')
    // Nothing from the accordion follows the link.
    const after = html.slice(link)
    for (const detail of DETAILS) {
      assert.ok(!after.includes(detail.title), `${detail.title} renders after the guide link`)
    }
  })

  it('is absent for a product with no guide', () => {
    const html = render({
      ...product('gp-ultra-plus-aa-10-pakk', 'GP Ultra Plus Alkaline AA-batteri, 10-pakk'),
      section: 'accessories',
      stock: 10,
      details: [],
    })
    assert.ok(!html.includes('Last ned bruksveiledning'))
    assert.ok(!html.includes('Last ned monteringsveiledning'))
  })
})
