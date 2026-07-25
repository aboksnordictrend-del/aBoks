import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkInvitationEligibility,
  buildReviewableProducts,
  productInOrder,
  findReviewable,
  computeReviewAggregate,
  classifyInvitation,
  publicDisplayName,
  mayPublishPhotos,
  formatRating,
  formatReviewDate,
  type OrderLike,
} from './reviews'

const deliveredOrder = (over: Partial<OrderLike> = {}): OrderLike => ({
  id: 1,
  status: 'delivered',
  customerInfo: { email: 'kunde@example.com', firstName: 'Kari', city: 'Oslo' },
  customer: 9,
  items: [
    { product: { id: 5, title: 'aBoks' }, variant: { name: 'Sort' }, variantName: 'Sort', quantity: 1 },
    { product: { id: 5, title: 'aBoks' }, variant: { name: 'Sort' }, variantName: 'Sort', quantity: 2 },
    { product: { id: 7, title: 'aBoks Mini' }, variantName: 'Blå', quantity: 1 },
  ],
  ...over,
})

describe('checkInvitationEligibility', () => {
  it('accepts a delivered order with items and email', () => {
    assert.deepEqual(checkInvitationEligibility(deliveredOrder()), { eligible: true, reason: 'ok' })
  })
  it('rejects a cancelled order', () => {
    assert.equal(checkInvitationEligibility(deliveredOrder({ status: 'cancelled' })).reason, 'cancelled')
  })
  it('rejects a not-yet-delivered order', () => {
    assert.equal(checkInvitationEligibility(deliveredOrder({ status: 'shipped' })).reason, 'not-delivered')
  })
  it('rejects an order with no items', () => {
    assert.equal(checkInvitationEligibility(deliveredOrder({ items: [] })).reason, 'no-items')
  })
  it('rejects an order with no email', () => {
    assert.equal(checkInvitationEligibility(deliveredOrder({ customerInfo: { email: '' } })).reason, 'no-email')
  })
  it('rejects a missing order', () => {
    assert.equal(checkInvitationEligibility(null).reason, 'not-found')
  })
})

describe('buildReviewableProducts', () => {
  it('dedupes by product+variant and sums quantities', () => {
    const products = buildReviewableProducts(deliveredOrder())
    assert.equal(products.length, 2)
    const sort = products.find((p) => p.productId === '5')!
    assert.equal(sort.quantity, 3)
    assert.equal(sort.variantName, 'Sort')
    assert.equal(sort.title, 'aBoks')
  })
})

describe('productInOrder', () => {
  it('accepts a purchased product and rejects one not on the order', () => {
    const order = deliveredOrder()
    assert.equal(productInOrder(order, '5'), true)
    assert.equal(productInOrder(order, '7'), true)
    assert.equal(productInOrder(order, '999'), false)
  })
})

describe('findReviewable', () => {
  it('finds by product + variant, falling back to product only', () => {
    const products = buildReviewableProducts(deliveredOrder())
    assert.equal(findReviewable(products, '5', 'Sort')?.title, 'aBoks')
    assert.equal(findReviewable(products, '7')?.variantName, 'Blå')
    assert.equal(findReviewable(products, '999'), undefined)
  })
})

describe('classifyInvitation', () => {
  const future = new Date(Date.now() + 86400000).toISOString()
  const past = new Date(Date.now() - 86400000).toISOString()

  it('valid for an active, unused, unexpired invitation', () => {
    assert.equal(classifyInvitation({ status: 'active', usedAt: null, expiresAt: future }), 'valid')
  })
  it('used when usedAt is set or status is used', () => {
    assert.equal(classifyInvitation({ status: 'active', usedAt: past, expiresAt: future }), 'used')
    assert.equal(classifyInvitation({ status: 'used', expiresAt: future }), 'used')
  })
  it('expired by time or status', () => {
    assert.equal(classifyInvitation({ status: 'active', expiresAt: past }), 'expired')
    assert.equal(classifyInvitation({ status: 'expired', expiresAt: future }), 'expired')
  })
  it('maps revoked to invalid (indistinguishable from non-existent)', () => {
    assert.equal(classifyInvitation({ status: 'revoked', expiresAt: future }), 'invalid')
  })
})

describe('multiple invitations for the same order (regression for AB-037513)', () => {
  const future = new Date(Date.now() + 86400000).toISOString()
  const past = new Date(Date.now() - 86400000).toISOString()

  // Order X has an OLD used invitation A and a NEW active invitation B. Submitting via B's
  // token must be governed only by B — A's `used` state must not block or leak into B.
  const A = { status: 'used' as const, usedAt: past, expiresAt: future } // old link
  const B = { status: 'active' as const, usedAt: null, expiresAt: future } // new link

  it('classifies the old used invitation as used and the new active one as valid — independently', () => {
    assert.equal(classifyInvitation(A), 'used')
    assert.equal(classifyInvitation(B), 'valid')
  })

  it('a deleted review leaving A.review = null does not change B being valid', () => {
    // After the old test review was deleted, A.review_id becomes null (ON DELETE set null).
    // That has no bearing on B.
    const aAfterDelete = { ...A }
    assert.equal(classifyInvitation(aAfterDelete), 'used')
    assert.equal(classifyInvitation(B), 'valid')
  })
})

describe('privacy display', () => {
  it('shows the chosen name only with consent', () => {
    assert.equal(publicDisplayName(true, 'Kari N.'), 'Kari N.')
    assert.equal(publicDisplayName(false, 'Kari N.'), 'Verifisert kunde')
    assert.equal(publicDisplayName(true, '  '), 'Verifisert kunde')
  })
  it('gates photo publication on consent', () => {
    assert.equal(mayPublishPhotos(true), true)
    assert.equal(mayPublishPhotos(false), false)
  })
})

describe('computeReviewAggregate', () => {
  it('computes average, distribution, withPhotos and positive percent', () => {
    const agg = computeReviewAggregate([
      { rating: 5, photoCount: 2 },
      { rating: 5 },
      { rating: 4, photoCount: 1 },
      { rating: 2 },
    ])
    assert.equal(agg.count, 4)
    assert.equal(agg.average, 4) // (5+5+4+2)/4
    assert.equal(agg.distribution[5], 2)
    assert.equal(agg.distribution[4], 1)
    assert.equal(agg.distribution[2], 1)
    assert.equal(agg.withPhotos, 2)
    assert.equal(agg.positivePercent, 75) // 3 of 4 are 4–5
  })
  it('returns zeros for an empty set (no invented numbers)', () => {
    const agg = computeReviewAggregate([])
    assert.equal(agg.count, 0)
    assert.equal(agg.average, 0)
    assert.equal(agg.positivePercent, 0)
  })
})

describe('formatting', () => {
  it('formats a Norwegian one-decimal rating', () => {
    assert.equal(formatRating(4.8), '4,8')
    assert.equal(formatRating(5), '5,0')
  })
  it('formats a Norwegian long date', () => {
    assert.equal(formatReviewDate('2026-07-03T10:00:00.000Z'), '3. juli 2026')
  })
})
