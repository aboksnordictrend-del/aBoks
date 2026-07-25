import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { detectImageType, processReviewPhoto, safePhotoFilename, PHOTO_LIMITS } from './reviewPhotos'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

describe('detectImageType', () => {
  it('detects jpeg, png and webp by magic bytes', () => {
    assert.equal(detectImageType(JPEG), 'jpeg')
    assert.equal(detectImageType(PNG), 'png')
    assert.equal(detectImageType(WEBP), 'webp')
  })
  it('rejects svg and unknown content regardless of "extension"', () => {
    assert.equal(detectImageType(SVG), null)
    assert.equal(detectImageType(Buffer.from('not an image at all')), null)
    assert.equal(detectImageType(Buffer.alloc(4)), null)
  })
})

describe('processReviewPhoto', () => {
  it('rejects files above the size limit', async () => {
    const big = Buffer.alloc(PHOTO_LIMITS.maxBytes + 1)
    const r = await processReviewPhoto(big)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'too-large')
  })

  it('rejects a non-image (unsupported type)', async () => {
    const r = await processReviewPhoto(Buffer.from('hello world, not an image'))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'unsupported-type')
  })

  it('re-encodes a real PNG to an optimised WebP and downsizes large images', async () => {
    // A 3000×3000 red PNG — larger than maxDimension, so it must be scaled down.
    const png = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: '#c00' } })
      .png()
      .toBuffer()

    const r = await processReviewPhoto(png)
    assert.ok(r.ok)
    if (r.ok) {
      assert.equal(r.photo.mimeType, 'image/webp')
      assert.equal(detectImageType(r.photo.buffer), 'webp')
      assert.ok(r.photo.width <= PHOTO_LIMITS.maxDimension)
      assert.ok(r.photo.height <= PHOTO_LIMITS.maxDimension)
      // Metadata must be stripped (no EXIF block).
      const meta = await sharp(r.photo.buffer).metadata()
      assert.equal(meta.exif, undefined)
    }
  })
})

describe('safePhotoFilename', () => {
  it('generates unique, unguessable .webp filenames', () => {
    const a = safePhotoFilename()
    const b = safePhotoFilename()
    assert.notEqual(a, b)
    assert.match(a, /^review-[a-z0-9]+-[0-9a-f]{24}\.webp$/)
  })
})
