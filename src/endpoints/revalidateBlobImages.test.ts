import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { BLOB_IMAGES_TAG } from '@/lib/blobImagesCache'
import {
  blobImagesRevalidateEndpoint,
  handleBlobImagesRevalidate,
  type TagRevalidator,
} from './revalidateBlobImages'

/**
 * The manual Blob-listing refresh. Two things are on trial here: that the action is reachable
 * only by an admin, and that when it does run it purges exactly the tag the storefront cache
 * is stored under — a mismatch between the two would be a silent no-op, the worst possible
 * failure for a button whose only job is to invalidate a cache.
 *
 * The real `revalidateTag` is never called: the handler takes an injectable revalidator, and
 * every test passes a spy.
 */

const logs: string[] = []

function makeReq(user: unknown): PayloadRequest {
  return {
    user,
    payload: {
      logger: {
        error(msg: unknown) {
          logs.push(String(msg))
        },
        warn() {},
        info() {},
      },
    },
  } as unknown as PayloadRequest
}

/** A revalidator that records the tags it was handed. */
function spy(behaviour?: () => never) {
  const tags: string[] = []
  const fn: TagRevalidator = (tag) => {
    tags.push(tag)
    if (behaviour) behaviour()
  }
  return { fn, tags }
}

async function call(user: unknown, revalidate?: TagRevalidator) {
  const res = await handleBlobImagesRevalidate(makeReq(user), revalidate)
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

describe('blob-images revalidation — authorization', () => {
  it('401 for an anonymous caller', async () => {
    const { fn, tags } = spy()
    const { status, json } = await call(null, fn)
    assert.equal(status, 401)
    assert.equal(json.error, 'Unauthorized')
    assert.deepEqual(tags, [], 'must not revalidate for a guest')
  })

  it('403 for an authenticated non-admin', async () => {
    const { fn, tags } = spy()
    const { status, json } = await call({ role: 'editor' }, fn)
    assert.equal(status, 403)
    assert.equal(json.error, 'Kun for administratorer.')
    assert.deepEqual(tags, [], 'must not revalidate for a non-admin')
  })

  it('403 for a user with no role at all', async () => {
    const { fn, tags } = spy()
    const { status } = await call({ email: 'x@y.z' }, fn)
    assert.equal(status, 403)
    assert.deepEqual(tags, [])
  })

  it('guards the endpoint object that is actually registered, not just the inner handler', async () => {
    // Goes through the shipped Endpoint, whose default revalidator is the real one. Both cases
    // return before that is ever resolved, so no cache machinery is touched here.
    for (const [user, expected] of [
      [null, 401],
      [{ role: 'editor' }, 403],
    ] as const) {
      const res = await blobImagesRevalidateEndpoint.handler!(makeReq(user))
      assert.equal(res.status, expected)
    }
  })

  it('is registered as a POST under /admin, so it is neither public nor GET-triggerable', () => {
    assert.equal(blobImagesRevalidateEndpoint.method, 'post')
    assert.equal(blobImagesRevalidateEndpoint.path, '/admin/blob-images/revalidate')
  })
})

describe('blob-images revalidation — behaviour', () => {
  it('purges exactly the tag the storefront cache uses, once', async () => {
    const { fn, tags } = spy()
    const { status, json } = await call({ role: 'admin' }, fn)
    assert.equal(status, 200)
    assert.equal(json.ok, true)
    assert.deepEqual(tags, [BLOB_IMAGES_TAG])
    assert.deepEqual(tags, ['blob-images'])
  })

  it('reports the tag and the folders it covers back to the admin', async () => {
    const { fn } = spy()
    const { json } = await call({ role: 'admin' }, fn)
    assert.equal(json.tag, BLOB_IMAGES_TAG)
    assert.deepEqual(json.folders, ['Video/', 'aboks-vegg/'])
  })

  it('timestamps the refresh so the UI can confirm it happened', async () => {
    const { fn } = spy()
    const { json } = await call({ role: 'admin' }, fn)
    const at = new Date(String(json.revalidatedAt))
    assert.ok(!Number.isNaN(at.getTime()), 'revalidatedAt must be an ISO timestamp')
  })

  it('never reports success when the revalidation threw', async () => {
    logs.length = 0
    const { fn, tags } = spy(() => {
      throw new Error('static generation store missing')
    })
    const { status, json } = await call({ role: 'admin' }, fn)
    assert.equal(status, 500)
    assert.equal(json.ok, false)
    assert.equal(json.error, 'Kunne ikke oppdatere bildelistene. Prøv igjen.')
    assert.deepEqual(tags, ['blob-images'], 'it did attempt the purge')
    assert.equal(logs.length, 1)
  })

  it('does not leak the internal error text to the admin response', async () => {
    const { fn } = spy(() => {
      throw new Error('secret internal detail')
    })
    const { json } = await call({ role: 'admin' }, fn)
    assert.doesNotMatch(JSON.stringify(json), /secret internal detail/)
  })

  it('is safe to press repeatedly', async () => {
    const { fn, tags } = spy()
    for (let i = 0; i < 3; i++) {
      const { status } = await call({ role: 'admin' }, fn)
      assert.equal(status, 200)
    }
    assert.deepEqual(tags, ['blob-images', 'blob-images', 'blob-images'])
  })
})
