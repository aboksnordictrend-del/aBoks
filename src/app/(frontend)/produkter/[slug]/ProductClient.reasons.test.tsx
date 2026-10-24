import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductClient from './ProductClient'
import ProductImageCarousel from '@/components/ProductImageCarousel'
import { galleryReasonsFor } from '@/lib/galleryReasons'

/**
 * "Hvorfor trenger du aBoks?" — the reasons laid over the aBoks gallery.
 *
 * Messages belong to gallery positions, never to images: position n shows message n whatever
 * image the CMS puts there, positions beyond the last message show none, and only aBoks gets
 * the feature at all.
 */

const HEADING = 'Hvorfor trenger du aBoks?'

const EXPECTED = [
  'Du vet alltid hvor de nye batteriene er.',
  'Du vet alltid hvor du skal legge brukte batterier.',
  'Vennene dine har ikke en sånn. Ennå. 😉',
  'Mamma fortjener en gave hun faktisk får bruk for. ❤️',
  'Pappa blir glad for en ny leke! 😁',
  'Batterirot? Her er løsningen! 💡',
  'Kjøp én gang – glem batterirotet!',
  'Fordi batterier fortjener et bedre hjem enn roteskuffen. 😎',
  'Støtt en norsk produsent! 🇳🇴',
  'Slutt å lete etter batterier i alle skuffene!',
  'Gjør morgendagen bedre enn gårsdagen. ✨',
]

const images = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ src: `https://cdn.test/img-${i}.webp`, alt: `Bilde ${i + 1}` }))

/** Text of every caption in the markup, in order. */
function captions(html: string): string[] {
  return [...html.matchAll(/data-gallery-caption=""[^>]*><p[^>]*>([^<]*)<\/p>/g)].map((m) =>
    m[1].replace(/&#x27;/g, "'"),
  )
}

function renderCarousel(count: number, index: number) {
  return renderToStaticMarkup(
    <ProductImageCarousel
      images={images(count)}
      initialIndex={index}
      captions={galleryReasonsFor('aboks')!.messages}
    />,
  )
}

const product = (slug: string, title: string) => ({
  id: 'p1',
  title,
  slug,
  tagline: 'Batteriorganiserer',
  description: 'Oppbevaring for batterier.',
  price: 499,
  section: 'products' as const,
  stock: 10,
  images: images(11),
  features: [],
  capacity: { aa: 24, aaa: 24, usedCompartments: 1 },
  details: [],
  faqs: [],
})

function renderPage(slug: string, title: string) {
  return renderToStaticMarkup(
    <ProductClient
      product={product(slug, title)}
      variants={[]}
      breadcrumbs={[{ label: 'Produkter', href: '/produkter' }]}
    />,
  )
}

describe('aBoks gallery reasons', () => {
  it('carries the exact eleven messages, in order', () => {
    assert.deepEqual([...galleryReasonsFor('aboks')!.messages], EXPECTED)
    assert.equal(galleryReasonsFor('aboks')!.heading, HEADING)
  })

  it('shows message n on gallery position n, for all eleven', () => {
    for (let i = 0; i < 11; i++) {
      const html = renderCarousel(11, i)
      assert.deepEqual(captions(html), [EXPECTED[i]], `position ${i + 1}`)
      // The image at that position is the one on screen — order untouched.
      assert.match(html, new RegExp(`img-${i}\\.webp`))
    }
  })

  it('shows only the messages for positions that exist when there are fewer images', () => {
    const html = renderCarousel(5, 4)
    assert.deepEqual(captions(html), [EXPECTED[4]])
  })

  it('shows no message on positions past the eleventh', () => {
    for (const i of [11, 12]) {
      assert.deepEqual(captions(renderCarousel(13, i)), [], `position ${i + 1}`)
    }
  })

  it('renders the heading and the first message on the aBoks page', () => {
    const html = renderPage('aboks', 'aBoks')
    assert.ok(html.includes(`>${HEADING}</h2>`))
    assert.deepEqual(captions(html), [EXPECTED[0]])
  })

  it('leaves every other product page without heading or messages', () => {
    for (const [slug, title] of [
      ['aboks-mini', 'aBoks Mini'],
      ['aboks-nano', 'aBoks Nano'],
      ['aboks-xl', 'aBoks XL'],
      ['aboks-vegg', 'aBoks Vegg'],
    ]) {
      const html = renderPage(slug, title)
      assert.ok(!html.includes(HEADING), slug)
      assert.deepEqual(captions(html), [], slug)
    }
  })
})
