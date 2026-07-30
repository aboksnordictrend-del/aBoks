import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Media, Product, ProductVariant } from '@/payload-types'
import type { PinterestHomepageItem } from '../homepageItems'
import { buildExportItems, mediaTimestamp, parseTimestamp } from './items'
import { pinterestCsv } from './csv'
import type { PinterestSourceSelection } from './types'

const BASE = 'https://aboks.no'
const ALL: PinterestSourceSelection = { products: true, variants: true, homepage: true, blob: false }
const ONLY_PRODUCTS: PinterestSourceSelection = { products: true, variants: false, homepage: false, blob: false }

let seq = 0

const BLOB = 'https://blob.example.com'

/**
 * A Media document for `<filename>`, optionally dated. Bare filenames keep the assertions
 * readable; `order()` strips the host back off again.
 */
function media(filename: string, createdAt?: string, updatedAt?: string): Media {
  return {
    id: ++seq,
    alt: 'a',
    url: `${BLOB}/${filename}`,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
  } as unknown as Media
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
    images: [],
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
    ...overrides,
  } as ProductVariant
}

function homepage(overrides: Partial<PinterestHomepageItem> = {}): PinterestHomepageItem {
  return {
    id: 'h',
    imageUrl: 'https://blob.example.com/h.webp',
    title: 'Orden i skuffen',
    description: 'Slutt på rotet.',
    destinationPath: '/produkter',
    keywords: '',
    ...overrides,
  }
}

function build(
  input: Partial<Parameters<typeof buildExportItems>[0]>,
  sources: PinterestSourceSelection = ONLY_PRODUCTS,
  limit?: number,
) {
  // `homepage: []` by default — an unset value would fall back to the real curated list.
  return buildExportItems(
    { products: [], variants: [], homepage: [], ...input },
    { baseUrl: BASE, sources, limit },
  )
}

/** The image filenames in export order — the readable shape of "what came out". */
const order = (items: { mediaUrl: string }[]) =>
  items.map((i) => i.mediaUrl.replace('https://blob.example.com/', ''))

// ── Timestamp extraction ──────────────────────────────────────────────────────────────────

describe('timestamp extraction', () => {
  it('parses an ISO string to epoch milliseconds', () => {
    assert.equal(parseTimestamp('2026-07-15T00:00:00.000Z'), Date.parse('2026-07-15T00:00:00.000Z'))
    assert.equal(parseTimestamp('2026-07-15'), Date.parse('2026-07-15'))
  })

  it('treats missing, blank and invalid values as no date', () => {
    for (const value of [undefined, null, '', '   ', 'i går', '2026-13-45', 42, {}]) {
      assert.equal(parseTimestamp(value), undefined, JSON.stringify(value))
    }
  })

  it('prefers media.createdAt over media.updatedAt', () => {
    const m = media('u', '2026-01-01T00:00:00.000Z', '2026-09-09T00:00:00.000Z')
    assert.equal(mediaTimestamp(m), Date.parse('2026-01-01T00:00:00.000Z'))
  })

  it('falls back to media.updatedAt when createdAt is missing or invalid', () => {
    assert.equal(
      mediaTimestamp(media('u', undefined, '2026-05-05T00:00:00.000Z')),
      Date.parse('2026-05-05T00:00:00.000Z'),
    )
    assert.equal(
      mediaTimestamp(media('u', 'ikke en dato', '2026-05-05T00:00:00.000Z')),
      Date.parse('2026-05-05T00:00:00.000Z'),
    )
  })

  it('returns no date for an unresolved relationship or a document without timestamps', () => {
    assert.equal(mediaTimestamp(42), undefined)
    assert.equal(mediaTimestamp(null), undefined)
    assert.equal(mediaTimestamp(media('u')), undefined)
  })
})

// ── Ordering ──────────────────────────────────────────────────────────────────────────────

describe('export order — newest image first', () => {
  it('puts a newer gallery image above an older one', () => {
    const { items } = build({
      products: [
        product({
          images: [
            { image: media('gammel.webp', '2024-01-01T00:00:00.000Z') },
            { image: media('nyest.webp', '2026-07-20T00:00:00.000Z') },
            { image: media('midt.webp', '2025-06-01T00:00:00.000Z') },
          ],
        }),
      ],
    })
    assert.deepEqual(order(items), ['nyest.webp', 'midt.webp', 'gammel.webp'])
  })

  it('keeps gallery order when the dates are equal', () => {
    const day = '2026-07-01T00:00:00.000Z'
    const { items } = build({
      products: [
        product({
          images: [
            { image: media('a.webp', day) },
            { image: media('b.webp', day) },
            { image: media('c.webp', day) },
          ],
        }),
      ],
    })
    assert.deepEqual(order(items), ['a.webp', 'b.webp', 'c.webp'])
  })

  it('sorts variant and product rows together, by image date alone', () => {
    const { items } = build(
      {
        products: [
          product({
            images: [
              { image: media('produkt-gammel.webp', '2024-01-01T00:00:00.000Z') },
              { image: media('produkt-ny.webp', '2026-08-01T00:00:00.000Z') },
            ],
          }),
        ],
        variants: [
          variant({ id: 10, sku: 'A', image: media('variant-midt.webp', '2025-05-01T00:00:00.000Z') }),
        ],
      },
      ALL,
    )
    assert.deepEqual(order(items), ['produkt-ny.webp', 'variant-midt.webp', 'produkt-gammel.webp'])
  })

  it('lets a newly dated homepage image outrank older product media', () => {
    const { items } = build(
      {
        products: [
          product({ images: [{ image: media('produkt.webp', '2024-01-01T00:00:00.000Z') }] }),
        ],
        homepage: [
          homepage({
            id: 'kampanje',
            imageUrl: 'https://blob.example.com/kampanje.webp',
            createdAt: '2026-07-25',
          }),
        ],
      },
      ALL,
    )
    assert.deepEqual(order(items), ['kampanje.webp', 'produkt.webp'])
    assert.equal(items[0].sourceType, 'homepage', 'source type is not the primary sort key')
  })

  it('places undated rows after every dated row', () => {
    const { items } = build(
      {
        products: [
          product({
            images: [
              { image: media('udatert.webp') },
              { image: media('datert.webp', '2025-01-01T00:00:00.000Z') },
            ],
          }),
        ],
        homepage: [homepage({ id: 'h', imageUrl: 'https://blob.example.com/h.webp' })],
      },
      ALL,
    )
    assert.equal(order(items)[0], 'datert.webp')
    assert.deepEqual(order(items).slice(1).sort(), ['h.webp', 'udatert.webp'])
  })

  it('treats an invalid timestamp exactly like a missing one', () => {
    const { items } = build({
      products: [
        product({
          images: [
            { image: media('spro-dato.webp', 'i går', 'heller ikke en dato') },
            { image: media('gyldig.webp', '2020-01-01T00:00:00.000Z') },
          ],
        }),
      ],
    })
    assert.deepEqual(order(items), ['gyldig.webp', 'spro-dato.webp'])
  })

  it('keeps undated homepage entries in their configured order', () => {
    const { items } = build(
      {
        products: [],
        homepage: [
          homepage({ id: 'en', imageUrl: 'https://blob.example.com/en.webp' }),
          homepage({ id: 'to', imageUrl: 'https://blob.example.com/to.webp' }),
          homepage({ id: 'tre', imageUrl: 'https://blob.example.com/tre.webp' }),
        ],
      },
      { products: false, variants: false, homepage: true, blob: false },
    )
    assert.deepEqual(order(items), ['en.webp', 'to.webp', 'tre.webp'])
  })

  it('leaves a fully undated export in its original deterministic order', () => {
    const { items } = build({
      products: [
        product({
          images: [
            { image: media('a.webp') },
            { image: media('b.webp') },
            { image: media('c.webp') },
          ],
        }),
      ],
    })
    assert.deepEqual(order(items), ['a.webp', 'b.webp', 'c.webp'])
  })
})

// ── Interaction with the rest of the pipeline ─────────────────────────────────────────────

describe('sorting sits between dedup and the row cap', () => {
  it('deduplicates before sorting — a dropped row cannot claim a slot', () => {
    const shared = 'https://blob.example.com/delt.webp'
    const { items } = build(
      {
        products: [
          product({
            images: [
              { image: media('gammel.webp', '2020-01-01T00:00:00.000Z') },
              { image: media('delt.webp', '2026-01-01T00:00:00.000Z') },
            ],
          }),
        ],
        // Same image, newer curated date — but it loses dedup to the product row, so the
        // surviving row sorts on the PRODUCT media date, not the homepage one.
        homepage: [homepage({ id: 'dupe', imageUrl: shared, createdAt: '2030-01-01' })],
      },
      ALL,
    )
    assert.equal(items.length, 2)
    assert.equal(items.filter((i) => i.mediaUrl === shared).length, 1)
    assert.equal(items.find((i) => i.mediaUrl === shared)!.sourceType, 'product')
  })

  it('still gives the variant the duplicate, whatever the dates say', () => {
    const url = 'https://blob.example.com/olive.webp'
    const { items } = build(
      {
        products: [
          product({ images: [{ image: media('olive.webp', '2026-09-01T00:00:00.000Z') }] }),
        ],
        variants: [variant({ image: media('olive.webp', '2020-01-01T00:00:00.000Z') })],
      },
      ALL,
    )
    assert.equal(items.length, 1)
    assert.equal(items[0].sourceType, 'variant', 'source priority is unchanged by sorting')
    assert.equal(items[0].mediaUrl, url)
  })

  it('caps to the NEWEST 200, not the first 200 encountered', () => {
    // 260 images written oldest-first, so a cap applied before sorting would keep the wrong ones.
    const dated = Array.from({ length: 260 }, (_, i) => ({
      image: media(
        `i-${String(i).padStart(3, '0')}.webp`,
        new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString(),
      ),
    }))
    const { items, omitted } = build({ products: [product({ images: dated })] })

    assert.equal(items.length, 200)
    assert.equal(omitted, 60)
    // Newest is i-259; the 200th kept is i-060; i-059 and older are gone.
    assert.equal(order(items)[0], 'i-259.webp')
    assert.equal(order(items)[199], 'i-060.webp')
    assert.ok(!order(items).includes('i-059.webp'))
  })

  it('assigns unique titles after sorting, so the top row keeps the best copy', () => {
    const { items } = build({
      products: [
        product({
          images: [
            { image: media('gammel.webp', '2020-01-01T00:00:00.000Z') },
            { image: media('ny.webp', '2026-01-01T00:00:00.000Z') },
          ],
        }),
      ],
    })
    assert.equal(order(items)[0], 'ny.webp')
    assert.equal(items[0].title, 'aBoks', 'the newest row gets the product’s own title')
    assert.notEqual(items[1].title, items[0].title)
  })

  it('keeps every title unique after sorting a large mixed export', () => {
    const images = Array.from({ length: 40 }, (_, i) => ({
      image: media(`m-${i}.webp`, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()),
    }))
    const { items } = build(
      {
        products: [product({ images })],
        variants: [
          variant({ id: 10, sku: 'A', image: media('v1.webp', '2026-06-01T00:00:00.000Z') }),
          variant({ id: 11, sku: 'B', image: media('v2.webp') }),
        ],
        homepage: [homepage({ id: 'h1', imageUrl: 'https://blob.example.com/h1.webp' })],
      },
      ALL,
    )
    const titles = items.map((i) => i.title.toLowerCase())
    assert.equal(new Set(titles).size, titles.length)
  })
})

describe('preview order equals CSV order', () => {
  it('writes the CSV rows in exactly the previewed sequence', () => {
    const { items } = build(
      {
        products: [
          product({
            images: [
              { image: media('c.webp', '2024-03-03T00:00:00.000Z') },
              { image: media('a.webp', '2026-05-05T00:00:00.000Z') },
              { image: media('b.webp', '2025-04-04T00:00:00.000Z') },
              { image: media('d.webp') },
            ],
          }),
        ],
        variants: [variant({ image: media('v.webp', '2026-01-01T00:00:00.000Z') })],
        homepage: [
          homepage({ id: 'h', imageUrl: 'https://blob.example.com/h.webp', createdAt: '2026-06-06' }),
        ],
      },
      ALL,
    )

    const csvRows = pinterestCsv(items, 'Tavle').trimEnd().split('\r\n').slice(1)
    assert.equal(csvRows.length, items.length)
    items.forEach((item, i) => {
      // Media URL is column 2 and never needs quoting, so a plain split is safe here.
      assert.equal(csvRows[i].split(',')[1], item.mediaUrl, `row ${i}`)
    })
    assert.deepEqual(order(items), [
      'h.webp', // 2026-06-06
      'a.webp', // 2026-05-05
      'v.webp', // 2026-01-01
      'b.webp', // 2025-04-04
      'c.webp', // 2024-03-03
      'd.webp', // undated
    ])
  })
})
