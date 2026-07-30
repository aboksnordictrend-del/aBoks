import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import type { Media, Product, ProductVariant } from '@/payload-types'
import type { PinterestBlobListing, PinterestBlobObject } from './blobItems'
import { PINTEREST_BLOB_PREFIX } from './blobNaming'
import { collectExportPreview } from './collect'
import { pinterestCsv } from './csv'
import { buildDestinationOptions, buildExportItems, resolveBlobDestination } from './items'
import type { PinterestHomepageItem } from '../homepageItems'
import type { PinterestSourceSelection } from './types'

const BASE = 'https://aboks.no'
const ALL: PinterestSourceSelection = {
  products: true,
  variants: true,
  homepage: true,
  blob: true,
}
const ONLY_BLOB: PinterestSourceSelection = {
  products: false,
  variants: false,
  homepage: false,
  blob: true,
}

let seq = 0
const media = (url: string, createdAt?: string) =>
  ({ id: ++seq, alt: 'a', url, createdAt }) as unknown as Media

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'aBoks',
    slug: 'aboks',
    description: 'Fast plass til batteriene.',
    published: true,
    section: 'products',
    images: [{ image: media('https://cdn.example.com/produkt.webp') }],
    ...overrides,
  } as Product
}

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 10,
    displayName: 'aBoks – Olivengrønn',
    product: 1,
    name: 'Olivengrønn',
    sku: 'ABOKS-OLIVE-001',
    image: media('https://cdn.example.com/variant.webp'),
    ...overrides,
  } as ProductVariant
}

const homepage = (id: string, imageUrl: string): PinterestHomepageItem => ({
  id,
  imageUrl,
  title: 'Kuratert forsidebilde',
  description: 'Kuratert tekst.',
  destinationPath: '/produkter',
  keywords: 'kuratert',
})

const object = (
  pathname: string,
  extra: Partial<PinterestBlobObject> = {},
): PinterestBlobObject => ({
  url: `https://cdn.example.com/${pathname}`,
  pathname,
  size: 4096,
  uploadedAt: '2026-07-01T00:00:00.000Z',
  ...extra,
})

const listing = (objects: PinterestBlobObject[], error: string | null = null) => ({ objects, error })

function build(
  input: {
    products?: Product[]
    variants?: ProductVariant[]
    homepage?: PinterestHomepageItem[]
    blob?: PinterestBlobListing
  },
  sources: PinterestSourceSelection = ONLY_BLOB,
  limit?: number,
) {
  return buildExportItems(
    { products: [], variants: [], homepage: [], ...input },
    { baseUrl: BASE, sources, limit },
  )
}

const p = (name: string) => `${PINTEREST_BLOB_PREFIX}${name}`

// ── Rows from the folder ──────────────────────────────────────────────────────────────────

describe('Pinterest folder → export rows', () => {
  it('turns a filename into a complete Pin', () => {
    const { items, counts } = build({ blob: listing([object(p('orden-pa-kjokkenet.webp'))]) })
    assert.equal(counts.blob, 1)
    assert.equal(items[0].sourceType, 'blob')
    assert.equal(items[0].sourceId, 'blob:Pinterest/orden-pa-kjokkenet.webp')
    assert.equal(items[0].title, 'Orden på kjøkkenet')
    assert.equal(
      items[0].description,
      'Hold orden på batteriene på kjøkkenet. aBoks samler nye og brukte batterier på ett sted.',
    )
    assert.equal(items[0].mediaUrl, 'https://cdn.example.com/Pinterest/orden-pa-kjokkenet.webp')
    assert.equal(items[0].destinationUrl, 'https://aboks.no/produkter')
    assert.ok(items[0].keywords.includes('kjøkkenoppbevaring'))
  })

  it('uses a deterministic pathname-based sourceId, never the list position', () => {
    const objects = [object(p('a.webp')), object(p('interior/b.webp'))]
    const forward = build({ blob: listing(objects) })
    const reversed = build({ blob: listing([...objects].reverse()) })
    assert.deepEqual(forward.items.map((i) => i.sourceId).sort(), [
      'blob:Pinterest/a.webp',
      'blob:Pinterest/interior/b.webp',
    ])
    assert.deepEqual(
      forward.items.map((i) => i.sourceId).sort(),
      reversed.items.map((i) => i.sourceId).sort(),
    )
  })

  it('includes nested folders', () => {
    const { counts } = build({ blob: listing([object(p('interior/aBoks-i-stua.webp'))]) })
    assert.equal(counts.blob, 1)
  })

  it('skips an unsupported file type with a clear reason', () => {
    const { items, skipped } = build({
      blob: listing([object(p('brosjyre.pdf')), object(p('logo.svg')), object(p('film.mp4'))]),
    })
    assert.equal(items.length, 0)
    assert.equal(skipped.length, 3)
    for (const s of skipped) {
      assert.equal(s.reason, 'Filtypen støttes ikke for Pinterest-eksport.')
    }
  })

  it('accepts uppercase extensions', () => {
    const { counts } = build({ blob: listing([object(p('BILDE.PNG')), object(p('bilde2.WebP'))]) })
    assert.equal(counts.blob, 2)
  })

  it('skips a zero-byte folder placeholder', () => {
    const { items, skipped } = build({ blob: listing([object(p('tom.webp'), { size: 0 })]) })
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Tom fil eller mappemarkør.')
  })

  it('skips a hidden or system file', () => {
    const { items, skipped } = build({
      blob: listing([object(p('.DS_Store')), object(p('Thumbs.db'))]),
    })
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Skjult eller systemfil.')
  })

  it('skips a non-https URL', () => {
    const { items, skipped } = build({
      blob: listing([object(p('a.webp'), { url: 'http://cdn.example.com/a.webp' })]),
    })
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Bildet mangler en offentlig https-URL.')
  })

  it('rejects an object smuggled in from outside the folder', () => {
    const { items, skipped } = build({
      blob: listing([{ ...object('media/utenfor.webp'), pathname: 'media/utenfor.webp' }]),
    })
    assert.equal(items.length, 0)
    assert.equal(skipped[0].reason, 'Filen ligger utenfor Pinterest-mappen.')
  })

  it('falls back to a generated title when the filename says nothing usable', () => {
    const { items } = build({ blob: listing([object(p('01.webp'))]) })
    assert.equal(items.length, 1)
    assert.ok(items[0].title.length > 3, items[0].title)
    assert.ok(!/\b(bilde|photo|image)\s*\d/i.test(items[0].title))
  })
})

// ── Destination mapping ───────────────────────────────────────────────────────────────────

describe('destination mapping', () => {
  const catalogue = [
    product({ id: 1, title: 'aBoks', slug: 'aboks' }),
    product({ id: 2, title: 'aBoks Vegg', slug: 'aboks-vegg' }),
    product({ id: 3, title: 'aBoks Mini', slug: 'aboks-mini' }),
    product({ id: 4, title: 'aBoks Nano', slug: 'aboks-nano' }),
  ]

  it('maps each recognized product line to its real published slug', () => {
    assert.equal(resolveBlobDestination('aboks', catalogue, BASE), `${BASE}/produkter/aboks`)
    assert.equal(resolveBlobDestination('aboks-mini', catalogue, BASE), `${BASE}/produkter/aboks-mini`)
    assert.equal(resolveBlobDestination('aboks-nano', catalogue, BASE), `${BASE}/produkter/aboks-nano`)
    assert.equal(resolveBlobDestination('aboks-vegg', catalogue, BASE), `${BASE}/produkter/aboks-vegg`)
  })

  it('falls back to /produkter for generic content', () => {
    assert.equal(resolveBlobDestination(null, catalogue, BASE), `${BASE}/produkter`)
  })

  it('never invents a slug for a product that is not published', () => {
    const onlyBase = [product({ id: 1, title: 'aBoks', slug: 'aboks' })]
    assert.equal(resolveBlobDestination('aboks-mini', onlyBase, BASE), `${BASE}/produkter`)
    const unpublished = [product({ id: 5, title: 'aBoks Mini', slug: 'aboks-mini', published: false })]
    assert.equal(resolveBlobDestination('aboks-mini', unpublished, BASE), `${BASE}/produkter`)
  })

  it('routes a filename to the matching product page end to end', () => {
    const { items } = build(
      { products: catalogue, blob: listing([object(p('aboks-vegg-i-gangen.webp'))]) },
      { ...ONLY_BLOB, products: false },
    )
    assert.equal(items[0].destinationUrl, `${BASE}/produkter/aboks-vegg`)
  })

  it('builds an allowlist of canonical product URLs only', () => {
    const options = buildDestinationOptions(catalogue, BASE)
    assert.deepEqual(options[0], { url: `${BASE}/produkter`, label: 'Alle produkter' })
    assert.equal(options.length, 5)
    for (const option of options) assert.ok(option.url.startsWith(`${BASE}/produkter`))
  })
})

// ── Deduplication and priority ────────────────────────────────────────────────────────────

describe('Pinterest folder in the dedup ladder', () => {
  const SHARED = 'https://cdn.example.com/delt.webp'

  it('loses to a product image', () => {
    const { items, skipped } = build(
      {
        products: [product({ images: [{ image: media(SHARED) }] })],
        blob: listing([{ ...object(p('delt.webp')), url: SHARED }]),
      },
      ALL,
    )
    assert.equal(items.length, 1)
    assert.equal(items[0].sourceType, 'product')
    assert.equal(
      skipped.find((s) => s.sourceType === 'blob')!.reason,
      'Duplikat — samme bilde eksporteres allerede som produkt-pin.',
    )
  })

  it('loses to a variant image', () => {
    const { items, skipped } = build(
      {
        products: [product()],
        variants: [variant({ image: media(SHARED) })],
        blob: listing([{ ...object(p('delt.webp')), url: SHARED }]),
      },
      ALL,
    )
    assert.equal(items.filter((i) => i.mediaUrl === SHARED).length, 1)
    assert.equal(items.find((i) => i.mediaUrl === SHARED)!.sourceType, 'variant')
    assert.match(skipped.find((s) => s.sourceType === 'blob')!.reason, /variant-pin/)
  })

  it('loses to a curated homepage image', () => {
    const { items, skipped } = build(
      {
        homepage: [homepage('h', SHARED)],
        blob: listing([{ ...object(p('delt.webp')), url: SHARED }]),
      },
      ALL,
    )
    assert.equal(items.length, 1)
    assert.equal(items[0].sourceType, 'homepage')
    assert.match(skipped.find((s) => s.sourceType === 'blob')!.reason, /forside-pin/)
  })

  it('survives when the image appears nowhere else', () => {
    const { items } = build(
      {
        products: [product()],
        blob: listing([object(p('unik.webp'))]),
      },
      ALL,
    )
    assert.equal(items.filter((i) => i.sourceType === 'blob').length, 1)
  })

  it('resolves a four-way duplicate down to the variant', () => {
    const { items } = build(
      {
        products: [product({ images: [{ image: media(SHARED) }] })],
        variants: [variant({ image: media(SHARED) })],
        homepage: [homepage('h', SHARED)],
        blob: listing([{ ...object(p('delt.webp')), url: SHARED }]),
      },
      ALL,
    )
    assert.equal(items.length, 1)
    assert.equal(items[0].sourceType, 'variant')
  })
})

// ── Sorting, titles, counts ───────────────────────────────────────────────────────────────

describe('Pinterest folder in the shared pipeline', () => {
  it('sorts by the Blob upload timestamp, above older catalogue media', () => {
    const { items } = build(
      {
        products: [
          product({ images: [{ image: media('https://cdn.example.com/gammel.webp', '2020-01-01T00:00:00.000Z') }] }),
        ],
        blob: listing([object(p('ny.webp'), { uploadedAt: '2026-07-30T00:00:00.000Z' })]),
      },
      ALL,
    )
    assert.equal(items[0].sourceType, 'blob')
    assert.equal(items[1].sourceType, 'product')
  })

  it('places an undated Blob object after dated rows', () => {
    const { items } = build(
      {
        products: [
          product({ images: [{ image: media('https://cdn.example.com/datert.webp', '2020-01-01T00:00:00.000Z') }] }),
        ],
        blob: listing([object(p('udatert.webp'), { uploadedAt: null })]),
      },
      ALL,
    )
    assert.equal(items[0].sourceType, 'product')
    assert.equal(items[1].sourceType, 'blob')
  })

  it('keeps titles unique across all four sources', () => {
    const { items } = build(
      {
        products: [
          product({
            images: [
              { image: media('https://cdn.example.com/p1.webp') },
              { image: media('https://cdn.example.com/p2.webp') },
            ],
          }),
        ],
        variants: [variant()],
        homepage: [homepage('h', 'https://cdn.example.com/h.webp')],
        blob: listing([
          object(p('aboks.webp')),
          object(p('aboks-2.webp')),
          object(p('aboks-3.webp')),
        ]),
      },
      ALL,
    )
    const titles = items.map((i) => i.title.toLowerCase())
    assert.equal(titles.length, 7)
    assert.equal(new Set(titles).size, 7)
  })

  it('counts Blob rows that survived deduplication', () => {
    const shared = 'https://cdn.example.com/delt.webp'
    const { counts } = build(
      {
        products: [product({ images: [{ image: media(shared) }] })],
        blob: listing([{ ...object(p('delt.webp')), url: shared }, object(p('unik.webp'))]),
      },
      ALL,
    )
    assert.equal(counts.blob, 1, 'the deduplicated row is not counted')
    assert.equal(counts.products, 1)
    assert.equal(counts.total, 2)
  })

  it('keeps the newest distinct images at the 200-row cap', () => {
    const objects = Array.from({ length: 260 }, (_, i) =>
      object(p(`bilde-${String(i).padStart(3, '0')}.webp`), {
        uploadedAt: new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString(),
      }),
    )
    const { items, omitted } = build({ blob: listing(objects) })
    assert.equal(items.length, 200)
    assert.equal(omitted, 60)
    assert.equal(items[0].mediaUrl, 'https://cdn.example.com/Pinterest/bilde-259.webp')
    assert.equal(items[199].mediaUrl, 'https://cdn.example.com/Pinterest/bilde-060.webp')
  })

  it('is excluded entirely when the source filter is off', () => {
    const { items, counts, skipped, warnings } = build(
      { products: [product()], blob: listing([object(p('unik.webp'))]) },
      { products: true, variants: false, homepage: false, blob: false },
    )
    assert.equal(counts.blob, 0)
    assert.ok(!items.some((i) => i.sourceType === 'blob'))
    assert.ok(!skipped.some((s) => s.sourceType === 'blob'))
    assert.deepEqual(warnings, [])
  })
})

// ── Failure handling ──────────────────────────────────────────────────────────────────────

describe('Blob failure does not break the export', () => {
  it('still returns the other sources, with a warning and a skip', () => {
    const { items, counts, warnings, skipped } = build(
      {
        products: [product()],
        variants: [variant()],
        homepage: [homepage('h', 'https://cdn.example.com/h.webp')],
        blob: listing([], 'Kunne ikke hente bilder fra Pinterest-mappen i Blob.'),
      },
      ALL,
    )
    assert.equal(counts.products, 1)
    assert.equal(counts.variants, 1)
    assert.equal(counts.homepage, 1)
    assert.equal(counts.blob, 0)
    assert.equal(items.length, 3)
    assert.deepEqual(warnings, ['Kunne ikke hente bilder fra Pinterest-mappen i Blob.'])
    assert.equal(
      skipped.find((s) => s.sourceType === 'blob')!.reason,
      'Kunne ikke lese Pinterest-mappen i Blob.',
    )
  })
})

// ── Through collectExportPreview, with an injected lister ─────────────────────────────────

function fakePayload(products: Product[], variants: ProductVariant[]) {
  return {
    find: async ({ collection }: { collection: string }) => {
      const docs = collection === 'products' ? products : variants
      return { docs, totalDocs: docs.length }
    },
  } as unknown as Payload
}

describe('collectExportPreview', () => {
  const user = { id: 1, role: 'admin' } as never

  it('lists the approved prefix and includes the rows', async () => {
    const seen: string[] = []
    const preview = await collectExportPreview(
      fakePayload([product()], []),
      user,
      { baseUrl: BASE, sources: ALL },
      async (prefix) => {
        seen.push(prefix)
        return listing([object(p('orden-pa-kjokkenet.webp'))])
      },
    )
    assert.deepEqual(seen, ['Pinterest/'])
    assert.equal(preview.counts.blob, 1)
    assert.ok(preview.items.some((i) => i.sourceType === 'blob'))
  })

  it('does not list Blob when the source is unticked', async () => {
    let called = false
    const preview = await collectExportPreview(
      fakePayload([product()], []),
      user,
      { baseUrl: BASE, sources: { ...ALL, blob: false } },
      async () => {
        called = true
        return listing([])
      },
    )
    assert.equal(called, false)
    assert.equal(preview.counts.blob, 0)
  })

  it('surfaces a listing failure without losing the catalogue', async () => {
    const preview = await collectExportPreview(
      fakePayload([product()], []),
      user,
      { baseUrl: BASE, sources: ALL },
      async () => listing([], 'Kunne ikke hente bilder fra Pinterest-mappen i Blob.'),
    )
    assert.ok(preview.counts.products > 0)
    assert.deepEqual(preview.warnings, ['Kunne ikke hente bilder fra Pinterest-mappen i Blob.'])
  })

  it('produces a CSV in exactly the previewed order', async () => {
    const preview = await collectExportPreview(
      fakePayload([product()], []),
      user,
      { baseUrl: BASE, sources: ALL },
      async () =>
        listing([
          object(p('ny.webp'), { uploadedAt: '2026-07-30T00:00:00.000Z' }),
          object(p('gammel.webp'), { uploadedAt: '2021-01-01T00:00:00.000Z' }),
        ]),
    )
    const rows = pinterestCsv(preview.items, 'Tavle').trimEnd().split('\r\n').slice(1)
    assert.equal(rows.length, preview.items.length)
    preview.items.forEach((item, i) => {
      assert.ok(rows[i].includes(item.mediaUrl), `row ${i}`)
    })
    assert.equal(preview.items[0].mediaUrl, 'https://cdn.example.com/Pinterest/ny.webp')
  })
})
