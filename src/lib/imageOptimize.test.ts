import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPRESSION_ATTEMPTS,
  compressWithAttempts,
  outputFilename,
  scaleToFit,
  type CompressionAttempt,
  type EncodeFn,
} from './imageOptimize'
import { UPLOAD_LIMITS } from './reviewValidation'

/**
 * The browser half of the 413 fix. The canvas itself cannot run under node:test, so what is
 * covered here is everything that decides *how much* is encoded: the no-upscale scaling, the
 * retry ladder and its stopping condition. `optimizeImage` is a thin wire-up of these plus
 * canvas calls.
 */

/** Encoder stub: reports `size` bytes for each pass, in order, and records what it was asked. */
function fakeEncoder(sizes: number[]): { encode: EncodeFn; calls: (CompressionAttempt & { width: number; height: number })[] } {
  const calls: (CompressionAttempt & { width: number; height: number })[] = []
  const encode: EncodeFn = async (attempt) => {
    calls.push(attempt)
    const size = sizes[calls.length - 1] ?? sizes[sizes.length - 1]!
    return new Blob([new Uint8Array(size)], { type: 'image/webp' })
  }
  return { encode, calls }
}

const MB = 1024 * 1024

describe('scaleToFit', () => {
  it('scales a landscape photo to the max dimension on its longest side', () => {
    assert.deepEqual(scaleToFit({ width: 4032, height: 3024 }, 1600), { width: 1600, height: 1200 })
  })

  it('scales a portrait iPhone photo by its height, keeping the aspect ratio', () => {
    assert.deepEqual(scaleToFit({ width: 3024, height: 4032 }, 1600), { width: 1200, height: 1600 })
  })

  it('never upscales an image that is already smaller than the box', () => {
    assert.deepEqual(scaleToFit({ width: 800, height: 600 }, 1600), { width: 800, height: 600 })
    assert.deepEqual(scaleToFit({ width: 1600, height: 900 }, 1600), { width: 1600, height: 900 })
  })

  it('keeps a degenerate dimension at a drawable minimum of 1px', () => {
    const out = scaleToFit({ width: 5000, height: 2 }, 1600)
    assert.equal(out.width, 1600)
    assert.ok(out.height >= 1)
  })
})

describe('outputFilename', () => {
  it('renames to the encoded type rather than keeping a lying extension', () => {
    assert.equal(outputFilename('IMG_0421.HEIC.jpg', 'image/webp'), 'IMG_0421.HEIC.webp')
    assert.equal(outputFilename('photo.png', 'image/jpeg'), 'photo.jpg')
  })

  it('falls back to a neutral name when there is nothing but an extension', () => {
    assert.equal(outputFilename('.jpg', 'image/webp'), 'bilde.webp')
  })
})

describe('compressWithAttempts', () => {
  it('stops after one pass when the first attempt is already within budget', async () => {
    const { encode, calls } = fakeEncoder([400 * 1024])
    const result = await compressWithAttempts({ width: 4032, height: 3024 }, encode)

    assert.equal(result.attempts, 1)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.quality, UPLOAD_LIMITS.quality)
    assert.equal(calls[0]!.width, 1600)
  })

  it('retries at 1280px / quality 0.7 when the first pass is still too large', async () => {
    const { encode, calls } = fakeEncoder([2 * MB, 900 * 1024])
    const result = await compressWithAttempts({ width: 6000, height: 4000 }, encode)

    assert.equal(calls.length, 2, 'the retry pass must run')
    assert.equal(calls[1]!.quality, UPLOAD_LIMITS.retryQuality)
    assert.equal(calls[1]!.width, UPLOAD_LIMITS.retryMaxDimension)
    assert.equal(result.attempts, 2)
    assert.equal(result.blob.size, 900 * 1024)
    assert.equal(result.width, 1280)
  })

  it('gives up after the ladder is exhausted and returns the smallest result, without throwing', async () => {
    const { encode, calls } = fakeEncoder([5 * MB, 3 * MB])
    const result = await compressWithAttempts({ width: 8000, height: 6000 }, encode)

    assert.equal(calls.length, COMPRESSION_ATTEMPTS.length)
    assert.equal(result.blob.size, 3 * MB, 'the smaller of the two passes is kept')
    // Deliberately over budget: validatePhotoUpload is what turns this into a user message.
    assert.ok(result.blob.size > UPLOAD_LIMITS.perPhotoBytes)
  })

  it('keeps the smallest pass even when a lower quality encodes larger', async () => {
    const { encode } = fakeEncoder([2 * MB, 4 * MB])
    const result = await compressWithAttempts({ width: 8000, height: 6000 }, encode)
    assert.equal(result.blob.size, 2 * MB)
  })

  it('does not upscale a small photo on either pass', async () => {
    const { encode, calls } = fakeEncoder([5 * MB, 5 * MB])
    await compressWithAttempts({ width: 900, height: 700 }, encode)

    for (const call of calls) {
      assert.equal(call.width, 900)
      assert.equal(call.height, 700)
    }
  })

  it('uses the 1600px / 0.8 then 1280px / 0.7 ladder that the review form is specified with', () => {
    assert.deepEqual([...COMPRESSION_ATTEMPTS], [
      { maxDimension: 1600, quality: 0.8 },
      { maxDimension: 1280, quality: 0.7 },
    ])
  })
})
