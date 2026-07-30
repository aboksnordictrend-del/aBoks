import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { listPinterestBlobObjects, type PinterestBlobObject } from './blobItems'
import { PINTEREST_BLOB_PREFIX } from './blobNaming'

// Every request is served by a stub. Nothing here reaches a real Blob account.

const TOKEN = 'vercel_blob_rw_TESTTOKEN'
let saved: string | undefined

before(() => {
  saved = process.env.BLOB_READ_WRITE_TOKEN
  process.env.BLOB_READ_WRITE_TOKEN = TOKEN
})
after(() => {
  if (saved === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
  else process.env.BLOB_READ_WRITE_TOKEN = saved
})

interface StubBlob {
  url?: unknown
  pathname?: unknown
  size?: unknown
  uploadedAt?: unknown
}

/** A fetch stub that serves fixed pages and records every request URL it was given. */
function stubFetch(pages: { blobs: StubBlob[]; cursor?: string; hasMore?: boolean }[]) {
  const requests: URL[] = []
  let call = 0
  const impl = (async (input: URL | RequestInfo) => {
    requests.push(new URL(String(input)))
    const page = pages[Math.min(call++, pages.length - 1)]
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => page,
    } as unknown as Response
  }) as unknown as typeof fetch
  return { impl, requests }
}

const blob = (pathname: string, extra: Partial<StubBlob> = {}): StubBlob => ({
  url: `https://cdn.example.com/${pathname}`,
  pathname,
  size: 1234,
  uploadedAt: '2026-07-01T00:00:00.000Z',
  ...extra,
})

const paths = (objects: PinterestBlobObject[]) => objects.map((o) => o.pathname)

describe('Blob listing — scope', () => {
  it('asks the API for exactly the approved prefix', async () => {
    const { impl, requests } = stubFetch([{ blobs: [] }])
    await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].searchParams.get('prefix'), 'Pinterest/')
    assert.equal(requests[0].origin, 'https://blob.vercel-storage.com')
  })

  it('returns only objects under Pinterest/', async () => {
    const { impl } = stubFetch([
      {
        blobs: [
          blob('Pinterest/a.webp'),
          // A server that ignored the prefix must not widen our scope.
          blob('media/b.webp'),
          blob('review-photos/c.jpg'),
          blob('aboks-vegg/d.webp'),
        ],
      },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(paths(objects), ['Pinterest/a.webp'])
  })

  it('excludes similarly named sibling prefixes', async () => {
    const { impl } = stubFetch([
      {
        blobs: [
          blob('Pinterest/keep.webp'),
          blob('Pinterest-old/skip.webp'),
          blob('Pinterest-backup/skip.webp'),
          blob('PinterestArchive/skip.webp'),
        ],
      },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(paths(objects), ['Pinterest/keep.webp'])
  })

  it('is case-sensitive, matching Blob pathname semantics', async () => {
    const { impl } = stubFetch([
      { blobs: [blob('Pinterest/keep.webp'), blob('pinterest/skip.webp'), blob('PINTEREST/skip.webp')] },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(paths(objects), ['Pinterest/keep.webp'])
  })

  it('includes nested paths inside the folder', async () => {
    const { impl } = stubFetch([
      {
        blobs: [
          blob('Pinterest/interior/aBoks-i-stua.webp'),
          blob('Pinterest/2026/sommer/kampanje.jpg'),
        ],
      },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(objects.length, 2)
  })
})

describe('Blob listing — pagination', () => {
  it('follows the cursor until hasMore is false', async () => {
    const { impl, requests } = stubFetch([
      { blobs: [blob('Pinterest/a.webp')], cursor: 'c1', hasMore: true },
      { blobs: [blob('Pinterest/b.webp')], cursor: 'c2', hasMore: true },
      { blobs: [blob('Pinterest/c.webp')], hasMore: false },
    ])
    const { objects, error } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(error, null)
    assert.deepEqual(paths(objects), ['Pinterest/a.webp', 'Pinterest/b.webp', 'Pinterest/c.webp'])
    assert.equal(requests.length, 3)
    assert.equal(requests[0].searchParams.get('cursor'), null)
    assert.equal(requests[1].searchParams.get('cursor'), 'c1')
    assert.equal(requests[2].searchParams.get('cursor'), 'c2')
    // Every page stays inside the approved prefix.
    for (const req of requests) assert.equal(req.searchParams.get('prefix'), 'Pinterest/')
  })

  it('stops when hasMore is true but no cursor came back', async () => {
    const { impl, requests } = stubFetch([{ blobs: [blob('Pinterest/a.webp')], hasMore: true }])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(objects.length, 1)
    assert.equal(requests.length, 1)
  })

  it('stops at the page ceiling instead of looping forever', async () => {
    const { impl, requests } = stubFetch([
      { blobs: [blob('Pinterest/loop.webp')], cursor: 'same', hasMore: true },
    ])
    await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(requests.length, 10)
  })

  it('sorts the result deterministically by pathname', async () => {
    const { impl } = stubFetch([
      { blobs: [blob('Pinterest/c.webp'), blob('Pinterest/a.webp'), blob('Pinterest/b.webp')] },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(paths(objects), ['Pinterest/a.webp', 'Pinterest/b.webp', 'Pinterest/c.webp'])
  })
})

describe('Blob listing — metadata', () => {
  it('returns only url, pathname, size and uploadedAt', async () => {
    const { impl } = stubFetch([
      {
        blobs: [
          {
            ...blob('Pinterest/a.webp'),
            // Fields the export has no business surfacing.
            downloadUrl: 'https://cdn.example.com/private',
            contentDisposition: 'attachment',
          } as StubBlob,
        ],
      },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(Object.keys(objects[0]).sort(), ['pathname', 'size', 'uploadedAt', 'url'])
  })

  it('sends the token as a bearer header and never returns it', async () => {
    let seenAuth: string | undefined
    const impl = (async (input: URL | RequestInfo, init?: RequestInit) => {
      seenAuth = (init?.headers as Record<string, string>)?.authorization
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ blobs: [] }) } as unknown as Response
    }) as unknown as typeof fetch

    const result = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(seenAuth, `Bearer ${TOKEN}`)
    assert.ok(!JSON.stringify(result).includes(TOKEN))
  })

  it('tolerates missing size and uploadedAt', async () => {
    const { impl } = stubFetch([
      { blobs: [{ url: 'https://cdn.example.com/x.webp', pathname: 'Pinterest/x.webp' }] },
    ])
    const { objects } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(objects[0].size, 0)
    assert.equal(objects[0].uploadedAt, null)
  })

  it('drops a malformed entry rather than throwing', async () => {
    const { impl } = stubFetch([
      { blobs: [{ url: 42, pathname: 'Pinterest/x.webp' }, { pathname: 'Pinterest/y.webp' }, blob('Pinterest/ok.webp')] },
    ])
    const { objects, error } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.equal(error, null)
    assert.deepEqual(paths(objects), ['Pinterest/ok.webp'])
  })
})

describe('Blob listing — failure is safe', () => {
  it('reports an HTTP error in Norwegian instead of throwing', async () => {
    const impl = (async () =>
      ({ ok: false, status: 403, statusText: 'Forbidden', json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch
    const { objects, error } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(objects, [])
    assert.equal(error, 'Kunne ikke hente bilder fra Pinterest-mappen i Blob.')
  })

  it('reports a network failure instead of throwing', async () => {
    const impl = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const { objects, error } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.deepEqual(objects, [])
    assert.ok(error)
  })

  it('never leaks the token in the error string', async () => {
    const impl = (async () => {
      throw new Error(`request to https://blob.vercel-storage.com failed, token=${TOKEN}`)
    }) as unknown as typeof fetch
    const { error } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    assert.ok(error && !error.includes(TOKEN))
  })

  it('reports a missing token without opening a socket', async () => {
    const previous = process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.BLOB_READ_WRITE_TOKEN
    let called = false
    const impl = (async () => {
      called = true
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ blobs: [] }) } as unknown as Response
    }) as unknown as typeof fetch

    const { objects, error } = await listPinterestBlobObjects(PINTEREST_BLOB_PREFIX, impl)
    process.env.BLOB_READ_WRITE_TOKEN = previous
    assert.equal(called, false)
    assert.deepEqual(objects, [])
    assert.match(error ?? '', /ikke konfigurert/)
  })
})
