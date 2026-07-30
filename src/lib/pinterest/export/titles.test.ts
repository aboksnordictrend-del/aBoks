import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Media, Product, ProductVariant } from '@/payload-types'
import type { PinterestHomepageItem } from '../homepageItems'
import { buildExportItems } from './items'
import { pickUniqueTitle, titleCandidates } from './titles'
import { TITLE_MAX } from './text'
import type { PinterestSourceSelection } from './types'

const BASE = 'https://aboks.no'
const ALL: PinterestSourceSelection = { products: true, variants: true, homepage: true, blob: false }
const ONLY_PRODUCTS: PinterestSourceSelection = { products: true, variants: false, homepage: false, blob: false }

let seq = 0
const media = (url: string) =>
  ({ id: ++seq, alt: 'a', url, updatedAt: '', createdAt: '' }) as unknown as Media

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'aBoks',
    slug: 'aboks',
    description: 'Fast plass til batteriene.',
    price: 499,
    published: true,
    section: 'products',
    images: [{ image: media('https://blob.example.com/main.webp') }],
    updatedAt: '',
    createdAt: '',
    ...overrides,
  } as Product
}

function gallery(count: number, prefix = 'g'): Product['images'] {
  return Array.from({ length: count }, (_, i) => ({
    image: media(`https://blob.example.com/${prefix}-${i}.webp`),
  }))
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
    image: media('https://blob.example.com/olive.webp'),
    updatedAt: '',
    createdAt: '',
    ...overrides,
  } as ProductVariant
}

const homepage = (id: string, url: string): PinterestHomepageItem => ({
  id,
  imageUrl: url,
  title: 'Orden i skuffen',
  description: 'Slutt på rotet.',
  destinationPath: '/produkter',
  keywords: '',
})

function build(
  input: Parameters<typeof buildExportItems>[0],
  sources: PinterestSourceSelection = ONLY_PRODUCTS,
) {
  return buildExportItems(input, { baseUrl: BASE, sources })
}

/** Case-folded titles, the way Pinterest would see collisions. */
const folded = (items: { title: string }[]) => items.map((i) => i.title.toLowerCase())

describe('pickUniqueTitle', () => {
  it('returns the row’s own copy when nothing has claimed it', () => {
    const used = new Set<string>()
    assert.equal(pickUniqueTitle({ base: 'aBoks Vegg', productName: 'aBoks Vegg' }, used), 'aBoks Vegg')
  })

  it('moves to a natural template once the base is taken', () => {
    const used = new Set<string>()
    const first = pickUniqueTitle({ base: 'aBoks', productName: 'aBoks' }, used)
    const second = pickUniqueTitle({ base: 'aBoks', productName: 'aBoks' }, used)
    assert.equal(first, 'aBoks')
    assert.notEqual(second, first)
    assert.ok(second.includes('aBoks') || second.includes('batterier'), second)
    assert.ok(!/\d/.test(second), 'no numbering')
  })

  it('uses the colour as a qualifier only after the stems run out', () => {
    const ctx = { base: 'aBoks', productName: 'aBoks', colour: 'Olivengrønn' }
    const candidates: string[] = []
    for (const c of titleCandidates(ctx)) {
      candidates.push(c)
      if (candidates.length > 40) break
    }
    // The first eleven are the base plus the ten templates — no qualifiers yet.
    assert.equal(candidates[0], 'aBoks')
    assert.ok(!candidates.slice(0, 11).some((c) => c.includes('i olivengrønn')))
    assert.ok(candidates.slice(11).some((c) => c.includes('i olivengrønn')))
  })

  it('never repeats a phrasing across many draws', () => {
    const used = new Set<string>()
    const titles = Array.from({ length: 250 }, () =>
      pickUniqueTitle({ base: 'aBoks', productName: 'aBoks' }, used),
    )
    assert.equal(new Set(titles.map((t) => t.toLowerCase())).size, 250)
    for (const t of titles) {
      assert.ok(t.length > 0)
      assert.ok(Array.from(t).length <= TITLE_MAX, t)
      assert.ok(!/\b(bilde|photo|image)\s*\d/i.test(t), t)
    }
  })

  it('does not repeat a qualifier the stem already contains', () => {
    const all = [...titleCandidates({ base: 'aBoks til hjemmet', productName: 'aBoks' })]
    assert.ok(!all.some((c) => /til hjemmet.*til hjemmet/.test(c)))
  })
})

describe('unique titles across an export', () => {
  it('gives ten gallery images ten different titles', () => {
    const { items } = build({ products: [product({ images: gallery(10) })], variants: [] })
    assert.equal(items.length, 10)
    assert.equal(new Set(folded(items)).size, 10)
    for (const row of items) assert.ok(!/\d/.test(row.title), row.title)
  })

  it('keeps titles unique across two products with the same name', () => {
    const { items } = build({
      products: [
        product({ id: 1, slug: 'a', images: gallery(6, 'a') }),
        product({ id: 2, slug: 'b', images: gallery(6, 'b') }),
      ],
      variants: [],
    })
    assert.equal(items.length, 12)
    assert.equal(new Set(folded(items)).size, 12)
  })

  it('keeps titles unique across products, variants and homepage together', () => {
    const { items } = build(
      {
        products: [product({ images: gallery(5) })],
        variants: [
          variant({ id: 10, sku: 'A', image: media('https://blob.example.com/v1.webp') }),
          variant({ id: 11, sku: 'B', image: media('https://blob.example.com/v2.webp') }),
        ],
        homepage: [
          homepage('h1', 'https://blob.example.com/h1.webp'),
          homepage('h2', 'https://blob.example.com/h2.webp'),
        ],
      },
      ALL,
    )
    assert.equal(items.length, 9)
    assert.equal(new Set(folded(items)).size, 9)
  })

  it('keeps titles unique across homepage items that share curated copy', () => {
    const { items } = build(
      {
        products: [],
        variants: [],
        homepage: [
          homepage('h1', 'https://blob.example.com/h1.webp'),
          homepage('h2', 'https://blob.example.com/h2.webp'),
          homepage('h3', 'https://blob.example.com/h3.webp'),
        ],
      },
      { products: false, variants: false, homepage: true, blob: false },
    )
    assert.equal(items.length, 3)
    assert.equal(new Set(folded(items)).size, 3)
  })

  it('holds at the 200-row ceiling from a single huge gallery', () => {
    const { items, omitted } = build({ products: [product({ images: gallery(260) })], variants: [] })
    assert.equal(items.length, 200)
    assert.equal(omitted, 60)
    assert.equal(new Set(folded(items)).size, 200, 'every one of the 200 titles is distinct')
    for (const row of items) assert.ok(Array.from(row.title).length <= TITLE_MAX)
  })

  it('spends no phrasing on rows that dedup or the cap removed', () => {
    // The homepage row duplicates the product image, so it never reaches the title stage.
    const shared = 'https://blob.example.com/shared.webp'
    const { items } = build(
      {
        products: [product({ images: [{ image: media(shared) }] })],
        variants: [],
        homepage: [homepage('dupe', shared)],
      },
      ALL,
    )
    assert.equal(items.length, 1)
    assert.equal(items[0].title, 'aBoks', 'the surviving row still gets the best copy')
  })

  it('leaves the description alone — only titles need to differ', () => {
    const { items } = build({
      products: [product({ tagline: 'Fast plass til batteriene', images: gallery(4) })],
      variants: [],
    })
    const descriptions = new Set(items.map((i) => i.description))
    assert.equal(descriptions.size, 1)
    assert.equal(new Set(folded(items)).size, 4)
  })
})
