import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CARRIER_REQUIRED_MESSAGE,
  SHIPPING_CARRIERS,
  SHIPPING_CARRIER_OPTIONS,
  SHIPPING_CARRIER_VALUES,
  TRACKING_NUMBER_REQUIRED_MESSAGE,
  carrierNameOf,
  isShippingCarrier,
  normalizeShippingCarrier,
  normalizeTrackingNumber,
  shipmentProblems,
  shipmentTransitionProblems,
  trackingUrlFor,
} from './shipment'

/**
 * The carrier map and the transition rule, tested as pure functions.
 *
 * The URLs are asserted literally on purpose: they are the destinations of a button in an
 * e-mail sent in the shop's name, so a typo or a well-meaning "improvement" has to break a
 * test rather than reach a customer.
 */

describe('SHIPPING_CARRIERS', () => {
  it('supports exactly the three carriers aBoks ships with', () => {
    assert.deepEqual(SHIPPING_CARRIER_VALUES, ['postnord', 'posten', 'helthjem'])
  })

  it('maps each carrier to its customer-facing name', () => {
    assert.equal(SHIPPING_CARRIERS.postnord.name, 'PostNord')
    assert.equal(SHIPPING_CARRIERS.posten.name, 'Posten')
    assert.equal(SHIPPING_CARRIERS.helthjem.name, 'Helthjem')
  })

  it('maps PostNord to its tracking page', () => {
    assert.equal(trackingUrlFor('postnord'), 'https://www.postnord.no/')
  })

  it('maps Posten to its tracking page', () => {
    assert.equal(trackingUrlFor('posten'), 'https://www.posten.no/')
  })

  it('maps Helthjem to its tracking page', () => {
    assert.equal(trackingUrlFor('helthjem'), 'https://helthjem.no/sporing')
  })

  it('offers the admin the same labels the e-mail prints', () => {
    assert.deepEqual(SHIPPING_CARRIER_OPTIONS, [
      { label: 'PostNord', value: 'postnord' },
      { label: 'Posten', value: 'posten' },
      { label: 'Helthjem', value: 'helthjem' },
    ])
  })
})

describe('carrier allow-list', () => {
  it('accepts only supported carrier values', () => {
    assert.equal(isShippingCarrier('postnord'), true)
    assert.equal(isShippingCarrier('posten'), true)
    assert.equal(isShippingCarrier('helthjem'), true)
    assert.equal(isShippingCarrier('bring'), false)
    assert.equal(isShippingCarrier('PostNord'), false, 'the stored form is the lowercase key')
    assert.equal(isShippingCarrier(''), false)
    assert.equal(isShippingCarrier(null), false)
    assert.equal(isShippingCarrier(undefined), false)
    assert.equal(isShippingCarrier(42), false)
  })

  it('never resolves a name or a URL for an unsupported value', () => {
    for (const value of ['bring', 'https://evil.example/steal', '', null, undefined, {}]) {
      assert.equal(normalizeShippingCarrier(value), null)
      assert.equal(carrierNameOf(value), null)
      assert.equal(trackingUrlFor(value), null)
    }
  })

  it('does not inherit keys from Object.prototype', () => {
    assert.equal(isShippingCarrier('toString'), false)
    assert.equal(isShippingCarrier('constructor'), false)
  })
})

describe('normalizeTrackingNumber', () => {
  it('trims a real consignment number', () => {
    assert.equal(normalizeTrackingNumber('  707123456789 '), '707123456789')
  })

  it('treats blank and non-string values as absent', () => {
    assert.equal(normalizeTrackingNumber(''), null)
    assert.equal(normalizeTrackingNumber('   '), null)
    assert.equal(normalizeTrackingNumber(null), null)
    assert.equal(normalizeTrackingNumber(undefined), null)
    assert.equal(normalizeTrackingNumber(707123456789), null)
  })
})

describe('shipmentProblems', () => {
  it('is happy with a carrier and a tracking number', () => {
    assert.deepEqual(
      shipmentProblems({ shippingCarrier: 'postnord', trackingNumber: '707123456789' }),
      [],
    )
  })

  it('names the carrier when it is missing', () => {
    assert.deepEqual(shipmentProblems({ trackingNumber: '707123456789' }), [
      { path: 'shippingCarrier', message: CARRIER_REQUIRED_MESSAGE },
    ])
  })

  it('names the tracking number when it is missing', () => {
    assert.deepEqual(shipmentProblems({ shippingCarrier: 'posten' }), [
      { path: 'trackingNumber', message: TRACKING_NUMBER_REQUIRED_MESSAGE },
    ])
  })

  it('rejects a whitespace-only tracking number', () => {
    const problems = shipmentProblems({ shippingCarrier: 'posten', trackingNumber: '   ' })
    assert.deepEqual(
      problems.map((p) => p.path),
      ['trackingNumber'],
    )
  })

  it('rejects an unsupported carrier as if none were selected', () => {
    const problems = shipmentProblems({ shippingCarrier: 'bring', trackingNumber: '123' })
    assert.deepEqual(
      problems.map((p) => p.path),
      ['shippingCarrier'],
    )
  })

  it('names both when both are missing', () => {
    assert.deepEqual(
      shipmentProblems({}).map((p) => p.path),
      ['shippingCarrier', 'trackingNumber'],
    )
  })
})

describe('shipmentTransitionProblems', () => {
  const shipping = (overrides: Record<string, unknown> = {}) =>
    shipmentTransitionProblems({
      operation: 'update',
      previousStatus: 'confirmed',
      nextStatus: 'shipped',
      ...overrides,
    })

  it('rejects confirmed → shipped without a carrier', () => {
    assert.deepEqual(
      shipping({ trackingNumber: '707123456789' }).map((p) => p.path),
      ['shippingCarrier'],
    )
  })

  it('rejects confirmed → shipped without a tracking number', () => {
    assert.deepEqual(
      shipping({ shippingCarrier: 'postnord' }).map((p) => p.path),
      ['trackingNumber'],
    )
  })

  it('accepts confirmed → shipped with both', () => {
    assert.deepEqual(shipping({ shippingCarrier: 'postnord', trackingNumber: '707123456789' }), [])
  })

  it('does not require shipment data for other statuses', () => {
    for (const nextStatus of ['pending', 'confirmed', 'cancelled', 'delivered']) {
      assert.deepEqual(
        shipmentTransitionProblems({
          operation: 'update',
          previousStatus: 'confirmed',
          nextStatus,
        }),
        [],
        `${nextStatus} must not require a carrier`,
      )
    }
  })

  it('lets an already-shipped order be re-saved with both fields empty', () => {
    assert.deepEqual(
      shipmentTransitionProblems({
        operation: 'update',
        previousStatus: 'shipped',
        nextStatus: 'shipped',
      }),
      [],
      'historical shipped orders must stay editable',
    )
  })

  it('lets an old shipped order move on to delivered with both fields empty', () => {
    assert.deepEqual(
      shipmentTransitionProblems({
        operation: 'update',
        previousStatus: 'shipped',
        nextStatus: 'delivered',
      }),
      [],
    )
  })

  it('does not apply on create — the webhook path never sends a shipped email either', () => {
    assert.deepEqual(shipmentTransitionProblems({ operation: 'create', nextStatus: 'shipped' }), [])
  })
})
