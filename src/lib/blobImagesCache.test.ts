import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  BLOB_IMAGES_ADMIN_ROUTE,
  BLOB_IMAGES_FOLDERS,
  BLOB_IMAGES_REVALIDATE_API,
  BLOB_IMAGES_REVALIDATE_SECONDS,
  BLOB_IMAGES_TAG,
} from './blobImagesCache'

/**
 * The storefront's Blob listing cache is a billing control, not a detail: every miss is one
 * Vercel Blob `list()`, billed as an Advanced Operation. Two folders listed on an hourly
 * window cost ~1 440 operations a month; on a daily window, ~60.
 *
 * `unstable_cache` gives no way to read back the options it was constructed with, so the
 * window is asserted two ways: the exported value here, and — below — that blobImages.ts
 * really passes these constants rather than re-inlining a literal. The second half is what
 * catches the regression that matters, someone quietly editing 86400 back to 3600.
 */

const readSource = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

describe('Blob listing cache window', () => {
  it('is 24 hours', () => {
    assert.equal(BLOB_IMAGES_REVALIDATE_SECONDS, 86_400)
    assert.equal(BLOB_IMAGES_REVALIDATE_SECONDS, 24 * 60 * 60)
  })

  it('is expressed in whole hours, so the admin copy can render it without a fraction', () => {
    assert.equal(BLOB_IMAGES_REVALIDATE_SECONDS % 3600, 0)
  })

  it('costs about 60 list() operations a month for the two folders in use', () => {
    const perMonth = ((30 * 24 * 60 * 60) / BLOB_IMAGES_REVALIDATE_SECONDS) * BLOB_IMAGES_FOLDERS.length
    assert.equal(perMonth, 60)
  })
})

describe('Blob listing cache identity', () => {
  it('uses the tag the revalidation endpoint purges', () => {
    assert.equal(BLOB_IMAGES_TAG, 'blob-images')
  })

  it('exposes an admin-scoped API path, never a public one', () => {
    assert.equal(BLOB_IMAGES_REVALIDATE_API, '/api/admin/blob-images/revalidate')
    assert.ok(BLOB_IMAGES_REVALIDATE_API.startsWith('/api/admin/'))
  })

  it('points at an admin route for the manual refresh', () => {
    assert.ok(BLOB_IMAGES_ADMIN_ROUTE.startsWith('/admin/'))
  })

  it('names both folders the tag actually covers', () => {
    assert.deepEqual([...BLOB_IMAGES_FOLDERS], ['Video/', 'aboks-vegg/'])
  })
})

describe('blobImages.ts wiring', () => {
  const source = readSource('./blobImages.ts')

  it('passes the shared constants into unstable_cache instead of inlining values', () => {
    assert.match(source, /revalidate:\s*BLOB_IMAGES_REVALIDATE_SECONDS/)
    assert.match(source, /tags:\s*\[\s*BLOB_IMAGES_TAG\s*\]/)
  })

  it('no longer carries the old hourly window or a literal tag in its cache options', () => {
    assert.doesNotMatch(source, /revalidate:\s*3600/)
    assert.doesNotMatch(source, /tags:\s*\[\s*'blob-images'\s*\]/)
  })
})
