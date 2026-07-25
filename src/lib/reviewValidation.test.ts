import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateReviewInput,
  normalizeWhitespace,
  stripHtml,
  REVIEW_LIMITS,
  type RawReviewInput,
} from './reviewValidation'

const valid: RawReviewInput = {
  productId: '5',
  rating: 5,
  title: 'Veldig fornøyd',
  text: 'aBoks holder orden i alle batteriene mine. Anbefales!',
  customerName: 'Kari N.',
  customerCity: 'Oslo',
  consentToPublishName: 'true',
  consentToPublishPhotos: 'false',
  photoCount: 2,
}

describe('validateReviewInput', () => {
  it('accepts a valid review and normalises fields', () => {
    const r = validateReviewInput(valid)
    assert.ok(r.ok)
    if (r.ok) {
      assert.equal(r.value.rating, 5)
      assert.equal(r.value.productId, '5')
      assert.equal(r.value.consentToPublishName, true)
      assert.equal(r.value.consentToPublishPhotos, false)
    }
  })

  it('rejects rating outside 1–5 and non-integers', () => {
    for (const rating of [0, 6, -1, 2.5, 'x', NaN]) {
      const r = validateReviewInput({ ...valid, rating })
      assert.equal(r.ok, false, `rating=${String(rating)} should fail`)
      if (!r.ok) assert.ok(r.errors.rating)
    }
  })

  it('rejects a missing/empty rating (never lets Number("") collapse to a valid 0)', () => {
    for (const rating of ['', '   ', undefined, null, '0', 0]) {
      const r = validateReviewInput({ ...valid, rating: rating as unknown })
      assert.equal(r.ok, false, `rating=${JSON.stringify(rating)} should fail`)
      if (!r.ok) assert.equal(r.errors.rating, 'Gi en vurdering mellom 1 og 5 stjerner.')
    }
  })

  it('accepts each integer rating 1–5 (as number and as string)', () => {
    for (const rating of [1, 2, 3, 4, 5, '1', '5']) {
      const r = validateReviewInput({ ...valid, rating: rating as unknown })
      assert.equal(r.ok, true, `rating=${JSON.stringify(rating)} should pass`)
    }
  })

  it('rejects a missing product', () => {
    const r = validateReviewInput({ ...valid, productId: '' })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.errors.productId)
  })

  it('enforces text min and max length', () => {
    const short = validateReviewInput({ ...valid, text: 'kort' })
    assert.equal(short.ok, false)
    const long = validateReviewInput({ ...valid, text: 'a'.repeat(REVIEW_LIMITS.textMax + 1) })
    assert.equal(long.ok, false)
    if (!long.ok) assert.ok(long.errors.text)
  })

  it('rejects meaningless text and link-spam', () => {
    assert.equal(validateReviewInput({ ...valid, text: 'aaaaaaaaaaaa' }).ok, false)
    assert.equal(validateReviewInput({ ...valid, text: '............' }).ok, false)
    assert.equal(
      validateReviewInput({
        ...valid,
        text: 'Se her http://spam.ru og www.spam.no og spam.shop og annet.com',
      }).ok,
      false,
    )
  })

  it('enforces title, name and city length limits', () => {
    assert.equal(validateReviewInput({ ...valid, title: 'a'.repeat(REVIEW_LIMITS.titleMax + 1) }).ok, false)
    assert.equal(validateReviewInput({ ...valid, customerName: 'a'.repeat(REVIEW_LIMITS.nameMax + 1) }).ok, false)
    assert.equal(validateReviewInput({ ...valid, customerCity: 'a'.repeat(REVIEW_LIMITS.cityMax + 1) }).ok, false)
  })

  it('rejects more than the max number of photos', () => {
    const r = validateReviewInput({ ...valid, photoCount: REVIEW_LIMITS.photosMax + 1 })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.errors.photos)
  })

  it('strips HTML from text and title (no HTML allowed)', () => {
    const r = validateReviewInput({ ...valid, text: 'Bra <script>alert(1)</script> boks som virker fint' })
    assert.ok(r.ok)
    if (r.ok) assert.ok(!r.value.text.includes('<'))
  })
})

describe('normalise helpers', () => {
  it('collapses whitespace', () => {
    assert.equal(normalizeWhitespace('  a   b\t c '), 'a b c')
  })
  it('strips angle-bracket markup', () => {
    assert.equal(stripHtml('a<b>c</b>d'), 'acd')
  })
})
