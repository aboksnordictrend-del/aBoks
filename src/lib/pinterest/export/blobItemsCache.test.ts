import { after, afterEach, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearPinterestBlobCache,
  listPinterestBlobObjectsCached,
  PINTEREST_BLOB_CACHE_MS,
} from './blobItems'
import { PINTEREST_BLOB_PREFIX } from './blobNaming'
import { collectExportPreview } from './collect'
import type { PinterestSourceSelection } from './types'

/**
 * The export page rebuilds its preview whenever a source checkbox is toggled. Before the cache
 * that meant one billed Vercel Blob `list()` per click for a folder that had not changed.
 *
 * Every request here is served by a stub and the clock is injected, so nothing reaches a real
 * Blob account and nothing waits on a real minute.
 */

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
afterEach(() => {
  clearPinterestBlobCache()
})

/** A fetch stub that counts how many Blob listings were actually issued. */
function counting(pathnames: string[] = ['Pinterest/stue.webp']) {
  let calls = 0
  const impl = (async () => {
    calls++
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        blobs: pathnames.map((pathname) => ({
          url: `https://cdn.example.com/${pathname}`,
          pathname,
          size: 1234,
          uploadedAt: '2026-07-01T00:00:00.000Z',
        })),
      }),
    } as unknown as Response
  }) as unknown as typeof fetch
  return { impl, calls: () => calls }
}

/** A fetch stub that always fails the listing. */
function failing() {
  let calls = 0
  const impl = (async () => {
    calls++
    return { ok: false, status: 500, statusText: 'Server Error' } as unknown as Response
  }) as unknown as typeof fetch
  return { impl, calls: () => calls }
}

/** A clock the test moves by hand. */
function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('Pinterest blob listing — checkbox toggles', () => {
  it('lists Blob once for a burst of source-filter changes', async () => {
    const { impl, calls } = counting()
    const time = clock()

    // What an admin actually does: untick products, untick variants, re-tick products,
    // untick homepage. Four previews, one unchanged folder.
    for (let toggle = 0; toggle < 4; toggle++) {
      await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
      time.advance(1_500)
    }

    assert.equal(calls(), 1, 'four toggles must cost exactly one Blob list()')
  })

  it('still returns the full listing on every one of those calls', async () => {
    const { impl } = counting(['Pinterest/a.webp', 'Pinterest/b.webp'])
    const time = clock()
    const first = await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    time.advance(2_000)
    const second = await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)

    assert.deepEqual(
      second.objects.map((o) => o.pathname),
      ['Pinterest/a.webp', 'Pinterest/b.webp'],
    )
    assert.deepEqual(second, first)
    assert.equal(second.error, null)
  })

  it('collapses concurrent previews onto a single listing', async () => {
    const { impl, calls } = counting()
    const time = clock()
    const results = await Promise.all([
      listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now),
      listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now),
      listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now),
    ])
    assert.equal(calls(), 1, 'overlapping requests must share one listing')
    for (const r of results) assert.equal(r.objects.length, 1)
  })
})

describe('Pinterest blob listing — freshness', () => {
  it('re-reads once the 60-second window has passed', async () => {
    const { impl, calls } = counting()
    const time = clock()
    await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    time.advance(PINTEREST_BLOB_CACHE_MS + 1)
    await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    assert.equal(calls(), 2)
  })

  it('still serves from cache at the last moment before expiry', async () => {
    const { impl, calls } = counting()
    const time = clock()
    await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    time.advance(PINTEREST_BLOB_CACHE_MS - 1)
    await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    assert.equal(calls(), 1)
  })

  it('keeps the window short enough that a fresh upload appears within a minute', () => {
    assert.equal(PINTEREST_BLOB_CACHE_MS, 60_000)
    assert.ok(PINTEREST_BLOB_CACHE_MS <= 60_000)
  })

  it('never caches a failed listing, so the next attempt really retries', async () => {
    const { impl, calls } = failing()
    const time = clock()
    const first = await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    const second = await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    assert.ok(first.error)
    assert.ok(second.error)
    assert.equal(calls(), 2, 'a failure must not be pinned for the whole window')
  })

  it('recovers on the retry after a failure, without waiting out the window', async () => {
    const bad = failing()
    const good = counting()
    const time = clock()
    const failed = await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, bad.impl, time.now)
    assert.ok(failed.error)
    const ok = await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, good.impl, time.now)
    assert.equal(ok.error, null)
    assert.equal(ok.objects.length, 1)
  })

  it('caches per prefix, so one folder cannot answer for another', async () => {
    const { impl, calls } = counting()
    const time = clock()
    await listPinterestBlobObjectsCached(PINTEREST_BLOB_PREFIX, impl, time.now)
    await listPinterestBlobObjectsCached('Annet/', impl, time.now)
    assert.equal(calls(), 2)
  })
})

// ── The same guarantee, through the endpoint's own collection step ────────────────────────

const payloadStub = {
  find: async () => ({ docs: [], totalDocs: 0 }),
} as never

const selection = (blob: boolean): PinterestSourceSelection => ({
  products: true,
  variants: true,
  homepage: false,
  blob,
})

describe('collectExportPreview — Blob round trips', () => {
  it('lists once across repeated previews with the Blob source ticked', async () => {
    const { impl, calls } = counting()
    const time = clock()
    const listBlob = (prefix: string) => listPinterestBlobObjectsCached(prefix, impl, time.now)

    for (let i = 0; i < 3; i++) {
      await collectExportPreview(
        payloadStub,
        { role: 'admin' } as never,
        { baseUrl: 'https://aboks.no', sources: selection(true) },
        listBlob,
      )
      time.advance(1_000)
    }
    assert.equal(calls(), 1)
  })

  it('still costs nothing at all when the Blob source is unticked', async () => {
    const { impl, calls } = counting()
    const time = clock()
    const preview = await collectExportPreview(
      payloadStub,
      { role: 'admin' } as never,
      { baseUrl: 'https://aboks.no', sources: selection(false) },
      (prefix: string) => listPinterestBlobObjectsCached(prefix, impl, time.now),
    )
    assert.equal(calls(), 0)
    assert.equal(preview.counts.blob, 0)
  })
})
