import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Media, Product, ProductVariant } from '@/payload-types'
import type { PinterestHomepageItem } from '../homepageItems'
import { PINTEREST_ROW_LIMIT, buildExportItems, productImageSourceId } from './items'
import { validateBoardName } from './board'
import {
  PINTEREST_CANONICAL_FALLBACK,
  isCanonicalDestination,
  isPublicHttpsUrl,
  resolveCanonicalBase,
  resolveMediaUrl,
} from './urls'
import type { PinterestSourceSelection } from './types'

const BASE = 'https://aboks.no'
const ALL: PinterestSourceSelection = { products: true, variants: true, homepage: true }
const ONLY = (k: keyof PinterestSourceSelection): PinterestSourceSelection => ({
  products: false,
  variants: false,
  homepage: false,
  [k]: true,
})

let mediaSeq = 0
function media(url: string, sizes?: Media['sizes']): Media {
  return {
    id: ++mediaSeq,
    alt: 'alt',
    url,
    sizes,
    updatedAt: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
  } as Media
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'aBoks',
    slug: 'aboks',
    description: 'Fast plass til batteriene.',
    price: 499,
    published: true,
    section: 'products',
    images: [{ image: media('https://blob.example.com/aboks-main.webp') }],
    updatedAt: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Product
}

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 10,
    displayName: 'aBoks – Olivengrønn',
    product: 1,
    name: 'Olivengrønn',
    colorHex: '#5b6347',
    sku: 'ABOKS-OLIVE-001',
    inventory: 5,
    image: media('https://blob.example.com/aboks-olive.webp'),
    updatedAt: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as ProductVariant
}

function homepage(overrides: Partial<PinterestHomepageItem> = {}): PinterestHomepageItem {
  return {
    id: 'hero',
    imageUrl: 'https://blob.example.com/hero.webp',
    title: 'aBoks – fast plass til batteriene',
    description: 'Slutt på rotet i skuffen.',
    destinationPath: '/produkter',
    keywords: 'batterier, oppbevaring',
    ...overrides,
  }
}

function build(
  input: Partial<Parameters<typeof buildExportItems>[0]>,
  sources: PinterestSourceSelection = ALL,
  limit?: number,
) {
  return buildExportItems(
    { products: [], variants: [], homepage: [], ...input },
    { baseUrl: BASE, sources, limit },
  )
}

// ── Canonical base + URL validation ───────────────────────────────────────────────────────

describe('canonical base', () => {
  it('accepts a configured https origin', () => {
    assert.deepEqual(resolveCanonicalBase('https://aboks.no'), {
      baseUrl: 'https://aboks.no',
      fallback: false,
    })
  })

  it('falls back to production for http, localhost, empty and garbage', () => {
    for (const value of ['http://localhost:3000', '', '   ', 'not a url', null, undefined]) {
      const result = resolveCanonicalBase(value)
      assert.equal(result.baseUrl, PINTEREST_CANONICAL_FALLBACK, `for ${String(value)}`)
      assert.equal(result.fallback, true)
    }
  })

  it('strips a path and trailing slash down to the origin', () => {
    assert.equal(resolveCanonicalBase('https://aboks.no/').baseUrl, 'https://aboks.no')
  })
})

describe('URL validation', () => {
  it('requires https, a dotted host and no embedded credentials', () => {
    assert.equal(isPublicHttpsUrl('https://cdn.example.com/a.webp'), true)
    assert.equal(isPublicHttpsUrl('http://cdn.example.com/a.webp'), false)
    assert.equal(isPublicHttpsUrl('https://localhost/a.webp'), false)
    assert.equal(isPublicHttpsUrl('https://user:pw@cdn.example.com/a.webp'), false)
    assert.equal(isPublicHttpsUrl('/api/media/file/a.webp'), false)
    assert.equal(isPublicHttpsUrl(''), false)
  })

  it('only accepts a destination on the canonical origin', () => {
    assert.equal(isCanonicalDestination('https://aboks.no/produkter/x', BASE), true)
    assert.equal(isCanonicalDestination('https://evil.example.com/produkter/x', BASE), false)
    assert.equal(isCanonicalDestination('http://aboks.no/produkter/x', BASE), false)
  })
})

describe('media resolution', () => {
  it('prefers the hero size, then card, then the original', () => {
    const withSizes = media('https://b.example.com/orig.webp', {
      card: { url: 'https://b.example.com/card.webp' },
      hero: { url: 'https://b.example.com/hero.webp' },
    } as Media['sizes'])
    assert.equal(resolveMediaUrl(withSizes, BASE), 'https://b.example.com/hero.webp')

    const cardOnly = media('https://b.example.com/orig.webp', {
      card: { url: 'https://b.example.com/card.webp' },
    } as Media['sizes'])
    assert.equal(resolveMediaUrl(cardOnly, BASE), 'https://b.example.com/card.webp')

    assert.equal(
      resolveMediaUrl(media('https://b.example.com/orig.webp'), BASE),
      'https://b.example.com/orig.webp',
    )
  })

  it('promotes a relative Payload URL against the canonical origin', () => {
    assert.equal(
      resolveMediaUrl(media('/api/media/file/a.webp'), BASE),
      'https://aboks.no/api/media/file/a.webp',
    )
  })

  it('returns null for an unresolved relationship or a missing url', () => {
    assert.equal(resolveMediaUrl(42, BASE), null)
    assert.equal(resolveMediaUrl(null, BASE), null)
    assert.equal(resolveMediaUrl(media(''), BASE), null)
  })
})

// ── Products ──────────────────────────────────────────────────────────────────────────────

describe('product export', () => {
  it('maps a published product into the normalized model', () => {
    const gallery = product()
    const mediaId = (gallery.images![0].image as Media).id
    const { items, counts } = build({ products: [gallery] }, ONLY('products'))
    assert.equal(counts.products, 1)
    assert.deepEqual(items[0], {
      sourceType: 'product',
      sourceId: `product:1:image:${mediaId}`,
      title: 'aBoks',
      description: 'Fast plass til batteriene.',
      mediaUrl: 'https://blob.example.com/aboks-main.webp',
      destinationUrl: 'https://aboks.no/produkter/aboks',
      keywords: '',
    })
  })

  it('excludes an unpublished product and says why', () => {
    const { items, skipped } = build(
      { products: [product({ published: false })] },
      ONLY('products'),
    )
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Ikke publisert.')
  })

  it('prefers the SEO title and SEO description', () => {
    const { items } = build(
      {
        products: [
          product({
            seo: { title: 'SEO-tittel', description: 'SEO-beskrivelse' },
            tagline: 'Tagline',
          }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items[0].title, 'SEO-tittel')
    assert.equal(items[0].description, 'SEO-beskrivelse')
  })

  it('falls back SEO description → tagline → description', () => {
    const withTagline = build(
      { products: [product({ tagline: 'Tagline' })] },
      ONLY('products'),
    )
    assert.equal(withTagline.items[0].description, 'Tagline')

    const plain = build({ products: [product()] }, ONLY('products'))
    assert.equal(plain.items[0].description, 'Fast plass til batteriene.')
  })

  it('keeps an accessory on the /produkter route', () => {
    const { items } = build(
      { products: [product({ section: 'accessories', slug: 'aboks-vegg' })] },
      ONLY('products'),
    )
    assert.equal(items[0].destinationUrl, 'https://aboks.no/produkter/aboks-vegg')
  })

  it('skips a gallery image that is not a public https URL', () => {
    const { items, skipped } = build(
      { products: [product({ images: [{ image: media('http://insecure.example.com/a.webp') }] })] },
      ONLY('products'),
    )
    assert.equal(items.length, 0)
    assert.equal(skipped.length, 1)
    assert.match(skipped[0].reason, /galleribilde mangler en offentlig https-URL/)
  })

  it('skips a product with no images at all', () => {
    const { items, skipped } = build({ products: [product({ images: [] })] }, ONLY('products'))
    assert.equal(items.length, 0)
    assert.equal(skipped.length, 1)
    assert.equal(skipped[0].reason, 'Mangler produktbilder.')
  })

  it('creates one Pin per gallery image, in Payload order', () => {
    const urls = [
      'https://blob.example.com/g1.webp',
      'https://blob.example.com/g2.webp',
      'https://blob.example.com/g3.webp',
      'https://blob.example.com/g4.webp',
    ]
    const { items, counts } = build(
      { products: [product({ images: urls.map((u) => ({ image: media(u) })) })] },
      ONLY('products'),
    )
    assert.equal(items.length, 4)
    assert.equal(counts.products, 4, 'the count is image Pins, not product documents')
    assert.deepEqual(items.map((i) => i.mediaUrl), urls)
  })

  it('gives every gallery image the same title, description and destination', () => {
    const { items } = build(
      {
        products: [
          product({
            tagline: 'Fast plass til batteriene',
            images: [
              { image: media('https://blob.example.com/g1.webp') },
              { image: media('https://blob.example.com/g2.webp') },
            ],
          }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items[0].title, items[1].title)
    assert.equal(items[0].description, items[1].description)
    assert.equal(items[0].destinationUrl, items[1].destinationUrl)
    // No "Bilde 2" / "Photo 3" suffixes.
    for (const row of items) assert.equal(row.title, 'aBoks')
  })

  it('emits the main image exactly once — it is gallery entry 0, not a separate row', () => {
    const main = 'https://blob.example.com/main.webp'
    const { items } = build(
      {
        products: [
          product({
            images: [{ image: media(main) }, { image: media('https://blob.example.com/b.webp') }],
          }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items.filter((i) => i.mediaUrl === main).length, 1)
    assert.equal(items.length, 2)
  })

  it('skips a gallery entry whose media relationship is unresolved', () => {
    const { items, skipped } = build(
      {
        products: [
          product({
            images: [
              { image: media('https://blob.example.com/ok.webp') },
              { image: 999 }, // depth too shallow — an id, not a document
              { image: media('') },
            ],
          }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items.length, 1)
    assert.equal(skipped.filter((s) => /galleribilde/.test(s.reason)).length, 2)
  })

  it('removes an exact duplicate image inside one gallery', () => {
    const dupe = 'https://blob.example.com/same.webp'
    const { items, skipped } = build(
      {
        products: [
          product({
            images: [
              { image: media(dupe) },
              { image: media('https://blob.example.com/other.webp') },
              { image: media(dupe) },
            ],
          }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items.length, 2)
    assert.ok(skipped.some((s) => s.reason === 'Samme bilde ligger flere ganger i galleriet.'))
  })

  it('treats differently-spelled but equivalent URLs as the same image', () => {
    const { items } = build(
      {
        products: [
          product({
            images: [
              { image: media('https://blob.example.com/Pa-soverommet.png') },
              { image: media('https://BLOB.example.com/Pa-soverommet.png#frag') },
            ],
          }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items.length, 1)
  })

  it('strips HTML and truncates an over-long description', () => {
    const { items } = build(
      { products: [product({ description: `<p>${'x'.repeat(900)}</p>` })] },
      ONLY('products'),
    )
    assert.equal(Array.from(items[0].description).length, 500)
    assert.ok(!items[0].description.includes('<p>'))
  })
})

// ── Gallery source identity ───────────────────────────────────────────────────────────────

describe('gallery sourceId', () => {
  it('uses the media document id', () => {
    const img = media('https://blob.example.com/a.webp')
    assert.equal(
      productImageSourceId('7', img, img.url!),
      `product:7:image:${img.id}`,
    )
  })

  it('falls back deterministically to a hash of the normalized URL', () => {
    const noId = { alt: 'a', url: 'https://blob.example.com/a.webp' } as unknown as Media
    const first = productImageSourceId('7', noId, 'https://blob.example.com/a.webp')
    const again = productImageSourceId('7', noId, 'https://blob.example.com/a.webp')
    assert.equal(first, again, 'stable across calls')
    assert.match(first, /^product:7:url:[0-9a-f]{8}$/)
    // Equivalent spellings of the same URL produce the same id …
    assert.equal(first, productImageSourceId('7', noId, 'https://BLOB.example.com/a.webp'))
    // … and a different image or product does not.
    assert.notEqual(first, productImageSourceId('7', noId, 'https://blob.example.com/b.webp'))
    assert.notEqual(first, productImageSourceId('8', noId, 'https://blob.example.com/a.webp'))
  })

  it('does not depend on the gallery index, so reordering keeps identities stable', () => {
    const a = media('https://blob.example.com/a.webp')
    const b = media('https://blob.example.com/b.webp')
    const forward = build(
      { products: [product({ images: [{ image: a }, { image: b }] })] },
      ONLY('products'),
    )
    const reversed = build(
      { products: [product({ images: [{ image: b }, { image: a }] })] },
      ONLY('products'),
    )
    assert.deepEqual(
      [...forward.items.map((i) => i.sourceId)].sort(),
      [...reversed.items.map((i) => i.sourceId)].sort(),
    )
    // The order of the rows themselves does follow the gallery.
    assert.notDeepEqual(
      forward.items.map((i) => i.sourceId),
      reversed.items.map((i) => i.sourceId),
    )
  })

  it('keeps ids unique across products that share an image', () => {
    const shared = media('https://blob.example.com/shared.webp')
    const { items } = build(
      {
        products: [
          product({ id: 1, slug: 'a', images: [{ image: shared }] }),
          product({ id: 2, slug: 'b', images: [{ image: shared }] }),
        ],
      },
      ONLY('products'),
    )
    assert.equal(items.length, 2, 'different destinations, so both survive dedup')
    assert.equal(new Set(items.map((i) => i.sourceId)).size, 2)
  })
})

// ── Variants ──────────────────────────────────────────────────────────────────────────────

describe('variant export', () => {
  it('exports a variant that has its own image, linking with ?variant=<sku>', () => {
    const { items, counts } = build(
      { products: [product()], variants: [variant()] },
      ONLY('variants'),
    )
    assert.equal(counts.variants, 1)
    assert.equal(items[0].sourceType, 'variant')
    assert.equal(items[0].title, 'aBoks – Olivengrønn')
    assert.equal(items[0].mediaUrl, 'https://blob.example.com/aboks-olive.webp')
    assert.equal(
      items[0].destinationUrl,
      'https://aboks.no/produkter/aboks?variant=ABOKS-OLIVE-001',
    )
  })

  it('skips a variant with no image of its own', () => {
    const { items, skipped } = build(
      { products: [product()], variants: [variant({ image: null })] },
      ONLY('variants'),
    )
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Mangler eget bilde.')
  })

  it('skips a variant that reuses the parent image', () => {
    const shared = 'https://blob.example.com/aboks-main.webp'
    const { items, skipped } = build(
      { products: [product()], variants: [variant({ image: media(shared) })] },
      ONLY('variants'),
    )
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Bruker samme bilde som hovedproduktet.')
  })

  it('skips a variant whose parent is unpublished', () => {
    const { items, skipped } = build(
      { products: [product({ published: false })], variants: [variant()] },
      ONLY('variants'),
    )
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Overordnet produkt er ikke publisert.')
  })

  it('resolves the parent when the relationship comes back as a document', () => {
    const parent = product()
    const { items } = build(
      { products: [parent], variants: [variant({ product: parent })] },
      ONLY('variants'),
    )
    assert.equal(items.length, 1)
  })

  it('builds a title from the product and colour when displayName is missing', () => {
    const { items } = build(
      { products: [product()], variants: [variant({ displayName: null })] },
      ONLY('variants'),
    )
    assert.equal(items[0].title, 'aBoks – Olivengrønn')
  })

  it('exports an image once when it is both a gallery entry and a variant image', () => {
    const olive = media('https://blob.example.com/aboks-olive.webp')
    const parent = product({
      images: [{ image: media('https://blob.example.com/main.webp') }, { image: olive }],
    })
    const { items } = build(
      { products: [parent], variants: [variant({ image: olive })] },
      ALL,
    )
    const oliveRows = items.filter((i) => i.mediaUrl === olive.url)
    assert.equal(oliveRows.length, 1)
    // The variant row is preferred: more specific title, colour keyword, colour preselected.
    assert.equal(oliveRows[0].sourceType, 'variant')
    assert.equal(oliveRows[0].title, 'aBoks – Olivengrønn')
    assert.equal(oliveRows[0].keywords, 'Olivengrønn')
    assert.match(oliveRows[0].destinationUrl, /\?variant=ABOKS-OLIVE-001$/)
    assert.equal(items.length, 2, 'main image + the variant row')
  })

  it('keeps that gallery image when variants are not being exported', () => {
    const olive = media('https://blob.example.com/aboks-olive.webp')
    const parent = product({
      images: [{ image: media('https://blob.example.com/main.webp') }, { image: olive }],
    })
    const { items } = build(
      { products: [parent], variants: [variant({ image: olive })] },
      ONLY('products'),
    )
    assert.equal(items.length, 2)
    assert.ok(items.some((i) => i.mediaUrl === olive.url && i.sourceType === 'product'))
  })

  it('only defers to a variant of the same product', () => {
    const shared = media('https://blob.example.com/shared.webp')
    const other = product({ id: 2, slug: 'annet', images: [{ image: shared }] })
    const owner = product({ id: 1, slug: 'aboks', images: [{ image: media('https://blob.example.com/main.webp') }] })
    const { items } = build(
      { products: [owner, other], variants: [variant({ product: 1, image: shared })] },
      ALL,
    )
    // Product 2's gallery keeps the image — the variant belongs to product 1.
    assert.ok(
      items.some((i) => i.sourceType === 'product' && i.destinationUrl.endsWith('/annet')),
    )
  })

  it('percent-encodes a SKU with characters that need it', () => {
    const { items } = build(
      { products: [product()], variants: [variant({ sku: 'A B/C' })] },
      ONLY('variants'),
    )
    assert.equal(items[0].destinationUrl, 'https://aboks.no/produkter/aboks?variant=A%20B%2FC')
  })
})

// ── Homepage ──────────────────────────────────────────────────────────────────────────────

describe('homepage export', () => {
  it('maps a curated entry onto a canonical destination', () => {
    const { items, counts } = build({ homepage: [homepage()] }, ONLY('homepage'))
    assert.equal(counts.homepage, 1)
    assert.deepEqual(items[0], {
      sourceType: 'homepage',
      sourceId: 'hero',
      title: 'aBoks – fast plass til batteriene',
      description: 'Slutt på rotet i skuffen.',
      mediaUrl: 'https://blob.example.com/hero.webp',
      destinationUrl: 'https://aboks.no/produkter',
      keywords: 'batterier, oppbevaring',
    })
  })

  it('resolves a site-relative image path against the canonical origin', () => {
    const { items } = build(
      { homepage: [homepage({ imageUrl: '/images/hero-desktop.webp' })] },
      ONLY('homepage'),
    )
    assert.equal(items[0].mediaUrl, 'https://aboks.no/images/hero-desktop.webp')
  })

  it('skips an entry whose image is not public https', () => {
    const { items, skipped } = build(
      { homepage: [homepage({ imageUrl: 'http://insecure.example.com/a.png' })] },
      ONLY('homepage'),
    )
    assert.equal(items.length, 0)
    assert.match(skipped[0].reason, /https-URL/)
  })

  it('preserves a percent-encoded Norwegian filename', () => {
    const url = 'https://blob.example.com/Pa-familiekj%C3%B8kkenet.png'
    const { items } = build({ homepage: [homepage({ imageUrl: url })] }, ONLY('homepage'))
    assert.equal(items[0].mediaUrl, url)
  })
})

// ── Source selection, dedup, limit ────────────────────────────────────────────────────────

describe('source selection', () => {
  it('honours each toggle independently', () => {
    const input = { products: [product()], variants: [variant()], homepage: [homepage()] }
    assert.equal(build(input, ALL).counts.total, 3)
    assert.equal(build(input, ONLY('products')).counts.total, 1)
    assert.equal(build(input, ONLY('variants')).counts.total, 1)
    assert.equal(build(input, ONLY('homepage')).counts.total, 1)
    assert.equal(
      build(input, { products: false, variants: false, homepage: false }).counts.total,
      0,
    )
  })
})

describe('deduplication', () => {
  it('keeps the curated homepage row when its copy genuinely differs', () => {
    const dupe = homepage({
      id: 'dupe',
      imageUrl: 'https://blob.example.com/aboks-main.webp',
      destinationPath: '/produkter/aboks',
      title: 'Orden i skuffen på 30 sekunder',
    })
    const { items, skipped } = build({ products: [product()], homepage: [dupe] }, ALL)
    assert.equal(items.length, 1)
    assert.equal(items[0].sourceType, 'homepage')
    assert.equal(items[0].title, 'Orden i skuffen på 30 sekunder')
    assert.ok(skipped.some((s) => s.reason.startsWith('Duplikat')))
  })

  it('keeps the product row when the curated copy adds nothing', () => {
    const echo = homepage({
      id: 'echo',
      imageUrl: 'https://blob.example.com/aboks-main.webp',
      destinationPath: '/produkter/aboks',
      // Identical to what the product row already produces.
      title: 'aBoks',
      description: 'Fast plass til batteriene.',
    })
    const { items } = build({ products: [product()], homepage: [echo] }, ALL)
    assert.equal(items.length, 1)
    assert.equal(items[0].sourceType, 'product')
  })

  it('resolves a collision the same way regardless of which side is seen first', () => {
    const pair = homepage({
      id: 'x',
      imageUrl: 'https://blob.example.com/aboks-main.webp',
      destinationPath: '/produkter/aboks',
      title: 'Kuratert tittel',
    })
    const a = build({ products: [product()], homepage: [pair] }, ALL)
    const b = build({ homepage: [pair], products: [product()] }, ALL)
    assert.deepEqual(a.items, b.items)
  })

  it('keeps rows that share an image but differ in destination', () => {
    const same = homepage({
      id: 'same-image',
      imageUrl: 'https://blob.example.com/aboks-main.webp',
      destinationPath: '/slik-fungerer-det',
    })
    assert.equal(build({ products: [product()], homepage: [same] }, ALL).items.length, 2)
  })
})

describe('200-row limit', () => {
  it('matches the documented Pinterest maximum', () => {
    assert.equal(PINTEREST_ROW_LIMIT, 200)
  })

  it('caps the export and reports how many were omitted', () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      product({
        id: i + 1,
        slug: `p-${i}`,
        title: `Produkt ${i}`,
        images: [{ image: media(`https://blob.example.com/p-${i}.webp`) }],
      }),
    )
    const { items, omitted, counts } = build({ products: many }, ONLY('products'))
    assert.equal(items.length, 200)
    assert.equal(counts.total, 200)
    assert.equal(omitted, 50)
  })

  it('caps a small number of products with very large galleries', () => {
    // 5 products × 60 gallery images = 300 candidate Pins.
    const big = Array.from({ length: 5 }, (_, p) =>
      product({
        id: p + 1,
        slug: `p-${p}`,
        images: Array.from({ length: 60 }, (_, i) => ({
          image: media(`https://blob.example.com/p${p}-i${i}.webp`),
        })),
      }),
    )
    const { items, omitted, counts } = build({ products: big }, ONLY('products'))
    assert.equal(items.length, 200)
    assert.equal(counts.products, 200)
    assert.equal(omitted, 100)
    // The cap must not slice mid-product in a way that loses gallery order.
    assert.equal(items[0].mediaUrl, 'https://blob.example.com/p0-i0.webp')
    assert.equal(items[59].mediaUrl, 'https://blob.example.com/p0-i59.webp')
    assert.equal(items[60].mediaUrl, 'https://blob.example.com/p1-i0.webp')
  })

  it('reports zero omitted when everything fits', () => {
    assert.equal(build({ products: [product()] }, ONLY('products')).omitted, 0)
  })
})

// ── Board ─────────────────────────────────────────────────────────────────────────────────

describe('board validation', () => {
  it('accepts a plain board and a Board/Section', () => {
    assert.deepEqual(validateBoardName('  Batterioppbevaring  '), {
      ok: true,
      value: 'Batterioppbevaring',
    })
    assert.deepEqual(validateBoardName('Bærekraft / Produkter'), {
      ok: true,
      value: 'Bærekraft/Produkter',
    })
  })

  it('rejects empty, non-string, control characters and two slashes', () => {
    assert.equal(validateBoardName('').ok, false)
    assert.equal(validateBoardName('   ').ok, false)
    assert.equal(validateBoardName(undefined).ok, false)
    assert.equal(validateBoardName(42).ok, false)
    assert.equal(validateBoardName('Tavle\nSeksjon').ok, false)
    assert.equal(validateBoardName('a/b/c').ok, false)
    assert.equal(validateBoardName('Tavle/').ok, false)
  })

  it('rejects a formula-looking board name outright', () => {
    assert.equal(validateBoardName('=1+1').ok, false)
    assert.equal(validateBoardName('@import').ok, false)
  })

  it('rejects an over-long name', () => {
    assert.equal(validateBoardName('x'.repeat(181)).ok, false)
    assert.equal(validateBoardName('x'.repeat(180)).ok, true)
  })
})
