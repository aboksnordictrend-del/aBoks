import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Endpoint, PayloadRequest } from 'payload'
import {
  applySubmittedRows,
  parseSources,
  pinterestExportEndpoint,
  pinterestExportPreviewEndpoint,
} from './pinterestExport'
import { PINTEREST_CSV_HEADERS } from '@/lib/pinterest/export/csv'
import type { PinterestExportItem } from '@/lib/pinterest/export/types'

const PRODUCT_IMAGE = 'https://blob.example.com/aboks-main.webp'
const VARIANT_IMAGE = 'https://blob.example.com/aboks-olive.webp'

const PRODUCT_IMAGE_2 = 'https://blob.example.com/aboks-gallery-2.webp'

/** The sourceId the gallery loop produces for `PRODUCT_IMAGE` (media id 1 on product 1). */
const PRODUCT_ROW_ID = 'product:1:image:1'

const productDoc = {
  id: 1,
  title: 'aBoks',
  slug: 'aboks',
  description: 'Fast plass til batteriene.',
  published: true,
  section: 'products',
  images: [
    { image: { id: 1, alt: 'a', url: PRODUCT_IMAGE } },
    { image: { id: 3, alt: 'c', url: PRODUCT_IMAGE_2 } },
  ],
}

const variantDoc = {
  id: 10,
  displayName: 'aBoks – Olivengrønn',
  product: 1,
  name: 'Olivengrønn',
  sku: 'ABOKS-OLIVE-001',
  image: { id: 2, alt: 'b', url: VARIANT_IMAGE },
}

interface MockOpts {
  user?: unknown
  query?: Record<string, unknown>
  body?: unknown
  products?: unknown[]
  variants?: unknown[]
}

function makeReq({ user, query = {}, body, products = [productDoc], variants = [variantDoc] }: MockOpts): PayloadRequest {
  return {
    user,
    query,
    json: body === undefined ? undefined : async () => body,
    payload: {
      find: async ({ collection }: { collection: string }) => {
        const docs = collection === 'products' ? products : variants
        return { docs, totalDocs: docs.length }
      },
      logger: { error() {}, warn() {}, info() {} },
    },
  } as unknown as PayloadRequest
}

const call = (endpoint: Endpoint, opts: MockOpts) => endpoint.handler!(makeReq(opts))

function item(overrides: Partial<PinterestExportItem> = {}): PinterestExportItem {
  return {
    sourceType: 'product',
    sourceId: PRODUCT_ROW_ID,
    title: 'aBoks',
    description: 'Beskrivelse',
    mediaUrl: PRODUCT_IMAGE,
    destinationUrl: 'https://aboks.no/produkter/aboks',
    keywords: '',
    ...overrides,
  }
}

// ── Authorization ─────────────────────────────────────────────────────────────────────────

describe('pinterest export — authorization', () => {
  const ENDPOINTS: Array<[string, Endpoint, MockOpts]> = [
    ['export/preview (GET)', pinterestExportPreviewEndpoint, {}],
    ['export (POST)', pinterestExportEndpoint, { body: { board: 'Tavle' } }],
  ]

  for (const [name, endpoint, extra] of ENDPOINTS) {
    it(`${name}: 401 for an anonymous request`, async () => {
      const res = await call(endpoint, { user: null, ...extra })
      assert.equal(res.status, 401)
    })

    it(`${name}: 403 for an authenticated editor`, async () => {
      const res = await call(endpoint, { user: { role: 'editor' }, ...extra })
      assert.equal(res.status, 403)
    })

    it(`${name}: 200 for an admin`, async () => {
      const res = await call(endpoint, { user: { role: 'admin' }, ...extra })
      assert.equal(res.status, 200)
    })
  }

  it('leaks nothing beyond the error string on a rejected request', async () => {
    const res = await call(pinterestExportPreviewEndpoint, { user: { role: 'editor' } })
    assert.deepEqual(await res.json(), { error: 'Kun for administratorer.' })
  })
})

// ── Preview ───────────────────────────────────────────────────────────────────────────────

describe('pinterest export — preview', () => {
  it('returns items, counts, skips and the row limit', async () => {
    const res = await call(pinterestExportPreviewEndpoint, { user: { role: 'admin' } })
    const body = (await res.json()) as {
      items: PinterestExportItem[]
      counts: { products: number; variants: number; homepage: number; total: number }
      skipped: unknown[]
      omitted: number
      limit: number
      baseUrl: string
    }
    assert.equal(body.limit, 200)
    // Two gallery images on the one product — the count is image Pins, not documents.
    assert.equal(body.counts.products, 2)
    assert.equal(body.counts.variants, 1)
    assert.ok(body.counts.homepage > 0, 'the curated homepage list contributes rows')
    assert.equal(body.counts.total, body.items.length)
    assert.equal(body.omitted, 0)
    assert.ok(body.baseUrl.startsWith('https://'))
  })

  it('every previewed row is https on the canonical origin', async () => {
    const res = await call(pinterestExportPreviewEndpoint, { user: { role: 'admin' } })
    const { items, baseUrl } = (await res.json()) as {
      items: PinterestExportItem[]
      baseUrl: string
    }
    for (const row of items) {
      assert.ok(row.mediaUrl.startsWith('https://'), row.mediaUrl)
      assert.ok(row.destinationUrl.startsWith(`${baseUrl}/`), row.destinationUrl)
    }
  })

  it('honours the sources query parameter', async () => {
    const res = await call(pinterestExportPreviewEndpoint, {
      user: { role: 'admin' },
      query: { sources: 'products' },
    })
    const body = (await res.json()) as { counts: { variants: number; homepage: number } }
    assert.equal(body.counts.variants, 0)
    assert.equal(body.counts.homepage, 0)
  })

  it('reports an unpublished product as skipped rather than dropping it silently', async () => {
    const res = await call(pinterestExportPreviewEndpoint, {
      user: { role: 'admin' },
      query: { sources: 'products' },
      products: [{ ...productDoc, published: false }],
    })
    const body = (await res.json()) as {
      counts: { total: number }
      skipped: { reason: string }[]
    }
    assert.equal(body.counts.total, 0)
    assert.equal(body.skipped[0].reason, 'Ikke publisert.')
  })
})

describe('parseSources', () => {
  it('defaults to all three when absent or empty', () => {
    assert.deepEqual(parseSources(undefined), { products: true, variants: true, homepage: true })
    assert.deepEqual(parseSources(''), { products: true, variants: true, homepage: true })
  })

  it('parses a comma-separated subset and ignores unknown names', () => {
    assert.deepEqual(parseSources('products,homepage'), {
      products: true,
      variants: false,
      homepage: true,
    })
    assert.deepEqual(parseSources('orders,customers'), {
      products: false,
      variants: false,
      homepage: false,
    })
  })
})

// ── CSV generation ────────────────────────────────────────────────────────────────────────

describe('pinterest export — CSV generation', () => {
  it('serves a CSV attachment with the official header row', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: { board: 'Batterioppbevaring' },
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('Content-Type'), 'text/csv; charset=utf-8')
    assert.match(
      res.headers.get('Content-Disposition') ?? '',
      /^attachment; filename="pinterest-export-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
    const text = await res.text()
    assert.equal(text.split('\r\n')[0], PINTEREST_CSV_HEADERS.join(','))
    assert.ok(text.includes(',Batterioppbevaring,'))
  })

  it('encodes the body as UTF-8 with Norwegian characters intact', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: { board: 'Bærekraft' },
    })
    const bytes = new Uint8Array(await res.arrayBuffer())
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    assert.ok(text.includes('Bærekraft'))
    assert.ok(text.includes('Olivengrønn'))
    assert.notEqual(bytes[0], 0xef, 'no UTF-8 BOM')
  })

  it('rejects a missing or invalid board with 400', async () => {
    for (const board of [undefined, '', '   ', '=evil', 'a/b/c']) {
      const res = await call(pinterestExportEndpoint, {
        user: { role: 'admin' },
        body: { board },
      })
      assert.equal(res.status, 400, `board=${String(board)}`)
    }
  })

  it('rejects an export with no rows', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: {
        board: 'Tavle',
        sources: { products: false, variants: false, homepage: false },
      },
    })
    assert.equal(res.status, 400)
  })

  it('exports only the sources requested in the body', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: { board: 'Tavle', sources: { products: true, variants: false, homepage: false } },
    })
    // One row per gallery image.
    assert.equal(res.headers.get('X-Pinterest-Rows'), '2')
  })

  it('writes one CSV row per gallery image, all pointing at the same product page', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: { board: 'Tavle', sources: { products: true, variants: false, homepage: false } },
    })
    const lines = (await res.text()).trimEnd().split('\r\n')
    assert.equal(lines.length, 3, 'header + two gallery images')
    assert.ok(lines[1].includes(PRODUCT_IMAGE))
    assert.ok(lines[2].includes(PRODUCT_IMAGE_2))
    for (const line of lines.slice(1)) {
      assert.ok(line.includes('https://aboks.no/produkter/aboks,'))
    }
  })
})

// ── Row selection and edits ───────────────────────────────────────────────────────────────

describe('applySubmittedRows', () => {
  const server = [item(), item({ sourceType: 'variant', sourceId: '10', title: 'Variant' })]

  it('applies edited title, description and keywords', () => {
    const out = applySubmittedRows(server, [
      { sourceType: 'product', sourceId: PRODUCT_ROW_ID, title: 'Ny tittel', description: 'Ny tekst', keywords: 'a, b' },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].title, 'Ny tittel')
    assert.equal(out[0].description, 'Ny tekst')
    assert.equal(out[0].keywords, 'a, b')
  })

  it('never lets the client change the media or destination URL', () => {
    const out = applySubmittedRows(server, [
      {
        sourceType: 'product',
        sourceId: PRODUCT_ROW_ID,
        // Both of these must be ignored — the server owns the URLs.
        ...({ mediaUrl: 'https://evil.example.com/x.png', destinationUrl: 'https://evil.example.com' } as object),
      },
    ])
    assert.equal(out[0].mediaUrl, PRODUCT_IMAGE)
    assert.equal(out[0].destinationUrl, 'https://aboks.no/produkter/aboks')
  })

  it('drops a disabled row', () => {
    const out = applySubmittedRows(server, [
      { sourceType: 'product', sourceId: PRODUCT_ROW_ID, enabled: false },
      { sourceType: 'variant', sourceId: '10' },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].sourceId, '10')
  })

  it('ignores a key the server did not produce', () => {
    const out = applySubmittedRows(server, [
      { sourceType: 'product', sourceId: '999' },
      { sourceType: 'article', sourceId: '1' },
    ])
    assert.equal(out.length, 0)
  })

  it('emits a repeated key only once, so the file cannot be padded', () => {
    const out = applySubmittedRows(
      server,
      Array.from({ length: 50 }, () => ({ sourceType: 'product', sourceId: PRODUCT_ROW_ID })),
    )
    assert.equal(out.length, 1)
  })

  it('truncates an over-long edited title and falls back when emptied', () => {
    const long = applySubmittedRows(server, [
      { sourceType: 'product', sourceId: PRODUCT_ROW_ID, title: 'x'.repeat(300) },
    ])
    assert.equal(Array.from(long[0].title).length, 100)

    const emptied = applySubmittedRows(server, [
      { sourceType: 'product', sourceId: PRODUCT_ROW_ID, title: '   ' },
    ])
    assert.equal(emptied[0].title, 'aBoks')
  })

  it('preserves the order the preview submitted', () => {
    const out = applySubmittedRows(server, [
      { sourceType: 'variant', sourceId: '10' },
      { sourceType: 'product', sourceId: PRODUCT_ROW_ID },
    ])
    assert.deepEqual(out.map((r) => r.sourceId), ['10', PRODUCT_ROW_ID])
  })
})

describe('pinterest export — edits reach the file', () => {
  it('writes the edited title and drops disabled rows', async () => {
    const preview = await call(pinterestExportPreviewEndpoint, { user: { role: 'admin' } })
    const { items } = (await preview.json()) as { items: PinterestExportItem[] }

    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: {
        board: 'Tavle',
        rows: items.map((row, i) => ({
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          enabled: i === 0,
          title: i === 0 ? 'Redigert tittel æøå' : row.title,
        })),
      },
    })

    assert.equal(res.headers.get('X-Pinterest-Rows'), '1')
    const text = await res.text()
    assert.ok(text.includes('Redigert tittel æøå'))
    assert.equal(text.trimEnd().split('\r\n').length, 2)
  })

  it('matches an edit to the right gallery image, not to its sibling', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: {
        board: 'Tavle',
        sources: { products: true, variants: false, homepage: false },
        rows: [
          { sourceType: 'product', sourceId: 'product:1:image:3', title: 'Andre galleribilde' },
          { sourceType: 'product', sourceId: PRODUCT_ROW_ID, title: 'Første galleribilde' },
        ],
      },
    })
    const lines = (await res.text()).trimEnd().split('\r\n')
    assert.equal(lines.length, 3)
    // Row order follows the submitted order, and each title landed on its own image.
    assert.ok(lines[1].startsWith('Andre galleribilde,'))
    assert.ok(lines[1].includes(PRODUCT_IMAGE_2))
    assert.ok(lines[2].startsWith('Første galleribilde,'))
    assert.ok(lines[2].includes(PRODUCT_IMAGE))
  })

  it('can disable one gallery image and keep its sibling', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: {
        board: 'Tavle',
        sources: { products: true, variants: false, homepage: false },
        rows: [
          { sourceType: 'product', sourceId: PRODUCT_ROW_ID, enabled: false },
          { sourceType: 'product', sourceId: 'product:1:image:3', enabled: true },
        ],
      },
    })
    assert.equal(res.headers.get('X-Pinterest-Rows'), '1')
    assert.ok((await res.text()).includes(PRODUCT_IMAGE_2))
  })

  it('guards a formula injected through an edited field', async () => {
    const res = await call(pinterestExportEndpoint, {
      user: { role: 'admin' },
      body: {
        board: 'Tavle',
        rows: [{ sourceType: 'product', sourceId: PRODUCT_ROW_ID, title: '=HYPERLINK("http://evil")' }],
      },
    })
    const text = await res.text()
    assert.ok(text.includes("'=HYPERLINK"), 'the leading = must be neutralized')
  })
})
