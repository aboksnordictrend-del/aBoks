import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PHOTO_UPLOAD_MESSAGES,
  REVIEW_LIMITS,
  UPLOAD_LIMITS,
  validatePhotoUpload,
} from './reviewValidation'

/**
 * The upload budget that keeps the review form under Vercel's ~4.5 MB request limit. Both the
 * browser (before building the FormData) and the Server Action (on what actually arrived)
 * call validatePhotoUpload, so these assertions cover both layers at once.
 */

const MB = 1024 * 1024

describe('photo upload limits', () => {
  it('pins the exact budget the form and the action are built around', () => {
    assert.equal(UPLOAD_LIMITS.maxDimension, 1600)
    assert.equal(UPLOAD_LIMITS.quality, 0.8)
    assert.equal(UPLOAD_LIMITS.retryMaxDimension, 1280)
    assert.equal(UPLOAD_LIMITS.retryQuality, 0.7)
    assert.equal(UPLOAD_LIMITS.perPhotoBytes, 1.5 * MB)
    assert.equal(UPLOAD_LIMITS.totalBytes, 3.5 * MB)
    assert.equal(REVIEW_LIMITS.photosMax, 5)
  })

  it('stays clear of the ~4.5 MB platform limit with room for the rest of the form', () => {
    const vercelLimit = 4.5 * MB
    assert.ok(UPLOAD_LIMITS.totalBytes < vercelLimit)
    assert.ok(vercelLimit - UPLOAD_LIMITS.totalBytes >= MB, 'need ~1 MB for multipart + fields')
  })
})

describe('validatePhotoUpload — photo count', () => {
  it('accepts the maximum of 5 photos', () => {
    const check = validatePhotoUpload(Array(5).fill(400 * 1024))
    assert.equal(check.ok, true)
  })

  it('rejects a 6th photo with the Norwegian count message', () => {
    const check = validatePhotoUpload(Array(6).fill(100 * 1024))
    assert.equal(check.ok, false)
    assert.equal(check.ok === false && check.message, 'Du kan laste opp maksimalt 5 bilder.')
    assert.equal(check.ok === false && check.message, PHOTO_UPLOAD_MESSAGES.tooMany)
  })

  it('reports the count problem before the size problem, since dropping a photo fixes both', () => {
    const check = validatePhotoUpload(Array(6).fill(3 * MB))
    assert.equal(check.ok === false && check.message, PHOTO_UPLOAD_MESSAGES.tooMany)
  })

  it('accepts a review with no photos at all', () => {
    const check = validatePhotoUpload([])
    assert.equal(check.ok, true)
    assert.equal(check.ok === true && check.totalBytes, 0)
  })
})

describe('validatePhotoUpload — per-photo size', () => {
  it('accepts a photo exactly at the 1.5 MB ceiling', () => {
    assert.equal(validatePhotoUpload([UPLOAD_LIMITS.perPhotoBytes]).ok, true)
  })

  it('rejects a single photo one byte over the ceiling', () => {
    const check = validatePhotoUpload([UPLOAD_LIMITS.perPhotoBytes + 1])
    assert.equal(check.ok, false)
    assert.equal(
      check.ok === false && check.message,
      'Ett av bildene er for stort selv etter komprimering. Velg et annet bilde.',
    )
  })

  it('flags the oversized photo even when the total would otherwise fit', () => {
    const check = validatePhotoUpload([2 * MB])
    assert.ok(2 * MB < UPLOAD_LIMITS.totalBytes)
    assert.equal(check.ok === false && check.message, PHOTO_UPLOAD_MESSAGES.perPhotoTooLarge)
  })
})

describe('validatePhotoUpload — total size', () => {
  it('accepts a set exactly at the 3.5 MB total', () => {
    const check = validatePhotoUpload([1.5 * MB, 1.5 * MB, 0.5 * MB])
    assert.equal(check.ok, true)
    assert.equal(check.ok === true && check.totalBytes, 3.5 * MB)
  })

  it('rejects a set one byte over the total with the Norwegian total message', () => {
    const check = validatePhotoUpload([1.5 * MB, 1.5 * MB, 0.5 * MB + 1])
    assert.equal(check.ok, false)
    assert.equal(
      check.ok === false && check.message,
      'Bildene er for store selv etter komprimering. Fjern ett eller flere bilder.',
    )
  })

  it('rejects 5 individually-legal photos that together blow the budget', () => {
    // The realistic mobile case: every photo passes on its own, the set does not.
    const check = validatePhotoUpload(Array(5).fill(1.2 * MB))
    assert.equal(check.ok === false && check.message, PHOTO_UPLOAD_MESSAGES.totalTooLarge)
  })

  it('accepts a typical optimised 5-photo mobile submission', () => {
    // 1600px @ q0.8 lands around 250–600 KB per photo.
    const check = validatePhotoUpload([520, 480, 610, 350, 440].map((kb) => kb * 1024))
    assert.equal(check.ok, true)
  })
})

describe('Norwegian error messages', () => {
  it('uses the exact agreed wording', () => {
    assert.equal(PHOTO_UPLOAD_MESSAGES.tooMany, 'Du kan laste opp maksimalt 5 bilder.')
    assert.equal(
      PHOTO_UPLOAD_MESSAGES.perPhotoTooLarge,
      'Ett av bildene er for stort selv etter komprimering. Velg et annet bilde.',
    )
    assert.equal(
      PHOTO_UPLOAD_MESSAGES.totalTooLarge,
      'Bildene er for store selv etter komprimering. Fjern ett eller flere bilder.',
    )
  })

  it('never surfaces an English or byte-count message to the customer', () => {
    for (const message of Object.values(PHOTO_UPLOAD_MESSAGES)) {
      assert.ok(/[æøå]/i.test(message) || /bilde/i.test(message), message)
      assert.ok(!/\b(bytes?|MB|too large|failed)\b/i.test(message), message)
    }
  })
})
