import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  feedbackFromResult,
  isReviewSuccess,
  type ReviewActionResult,
} from './reviewSubmitResult'

describe('review submit result contract', () => {
  it('shows success (submitted:true) ONLY for { success: true }', () => {
    const ok: ReviewActionResult = { success: true, reviewId: '42' }
    const fb = feedbackFromResult(ok)
    assert.equal(fb.submitted, true)
    assert.deepEqual(fb.fieldErrors, {})
    assert.equal(fb.generalError, '')
  })

  it('a validation error result never yields success UI', () => {
    const res: ReviewActionResult = {
      success: false,
      errors: { rating: 'Gi en vurdering mellom 1 og 5 stjerner.' },
    }
    const fb = feedbackFromResult(res)
    assert.equal(fb.submitted, false)
    assert.equal(fb.fieldErrors.rating, 'Gi en vurdering mellom 1 og 5 stjerner.')
    assert.equal(fb.generalError, '')
  })

  it('a general error result never yields success UI', () => {
    const res: ReviewActionResult = { success: false, message: 'Noe gikk galt. Prøv igjen senere.' }
    const fb = feedbackFromResult(res)
    assert.equal(fb.submitted, false)
    assert.equal(fb.generalError, 'Noe gikk galt. Prøv igjen senere.')
  })

  it('an empty failure result (e.g. honeypot with no message) is still not success', () => {
    const fb = feedbackFromResult({ success: false })
    assert.equal(fb.submitted, false)
  })

  it('isReviewSuccess narrows strictly on success === true', () => {
    assert.equal(isReviewSuccess({ success: true }), true)
    assert.equal(isReviewSuccess({ success: false }), false)
    assert.equal(isReviewSuccess({ success: false, errors: { rating: 'x' } }), false)
  })

  it('submitted is true for every success and false for every non-success — no truthy leak', () => {
    // Guards against the class of bug where `if (result)` / `if (!result.errors)` would let a
    // non-success be treated as success. Only success===true maps to submitted.
    const nonSuccess: ReviewActionResult[] = [
      { success: false },
      { success: false, errors: { rating: 'x' } },
      { success: false, message: 'oops' },
      { success: false, errors: {}, message: '' },
    ]
    for (const r of nonSuccess) assert.equal(feedbackFromResult(r).submitted, false)
    assert.equal(feedbackFromResult({ success: true }).submitted, true)
  })
})
