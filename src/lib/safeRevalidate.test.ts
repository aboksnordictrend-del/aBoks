import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { safeRevalidate } from './safeRevalidate'

// Keep the warning log out of the test output.
beforeEach(() => {
  mock.method(console, 'warn', () => {})
})

describe('safeRevalidate', () => {
  it('runs the callback when there is no error', async () => {
    let ran = false
    await safeRevalidate(() => {
      ran = true
    }, 'test')
    assert.equal(ran, true)
  })

  it('swallows a throwing revalidation so the surrounding write is not aborted', async () => {
    // Reproduces the review-submit regression: revalidateTag threw
    // "Invariant: static generation store missing" inside payload.create, which rolled the
    // invitation back to active and saved no review. safeRevalidate must NOT rethrow.
    await assert.doesNotReject(
      safeRevalidate(() => {
        throw new Error('Invariant: static generation store missing in revalidateTag reviews')
      }, 'reviews-revalidate'),
    )
  })

  it('swallows an async rejection too', async () => {
    await assert.doesNotReject(
      safeRevalidate(async () => {
        throw new Error('boom')
      }, 'test'),
    )
  })
})
