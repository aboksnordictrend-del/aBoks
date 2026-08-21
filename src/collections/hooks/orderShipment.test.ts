import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { APIError, type CollectionBeforeValidateHook, type Field } from 'payload'
import type { Order } from '@/payload-types'
import { Orders } from '../Orders'
import { validateShipment } from './orderShipment'
import { SHIPMENT_REQUIRED_MESSAGE } from '@/lib/orders/shipment'

/**
 * The «Sendt» gate as Payload actually runs it: a collection beforeValidate hook that sees
 * the incoming `data` and the stored `originalDoc`.
 *
 * Reached through the exported hook and the exported `CollectionConfig`, the same way
 * `PartnerPayouts.test.ts` reaches its immutability guard.
 */

type HookArgs = Parameters<CollectionBeforeValidateHook>[0]

/** Runs the hook as Payload would on an update. */
const update = (data: Record<string, unknown>, originalDoc: Record<string, unknown>) =>
  validateShipment({ operation: 'update', data, originalDoc } as unknown as HookArgs) as Partial<Order>

const create = (data: Record<string, unknown>) =>
  validateShipment({ operation: 'create', data } as unknown as HookArgs) as Partial<Order>

/** A confirmed order, awaiting shipment. */
const CONFIRMED = {
  id: 42,
  orderNumber: 'AB-1001',
  status: 'confirmed',
  shippingCarrier: null,
  trackingNumber: null,
}

/** An order shipped before the Forsendelse section existed — both columns NULL. */
const LEGACY_SHIPPED = {
  id: 7,
  orderNumber: 'AB-0007',
  status: 'shipped',
  shippedEmailSentAt: '2026-01-04T09:00:00.000Z',
}

const expectRejected = (
  run: () => unknown,
  expectedPaths: string[],
  message = 'the save must be refused',
) => {
  assert.throws(
    run,
    (err: unknown) => {
      assert.ok(err instanceof APIError, 'must be a Payload APIError, not a bare Error')
      assert.equal(err.status, 400, 'a 400 renders in the admin instead of being logged as a 500')
      assert.equal(err.message, SHIPMENT_REQUIRED_MESSAGE)
      const errors = (err.data as { errors: { path: string; message: string }[] }).errors
      assert.deepEqual(
        errors.map((e) => e.path),
        expectedPaths,
        'the admin must be told which field is missing',
      )
      for (const e of errors) assert.ok(e.message.length > 0)
      return true
    },
    message,
  )
}

/* --------------------------- 1. storing the fields --------------------------- */

describe('Orders — Forsendelse fields', () => {
  const fields = Orders.fields as Field[]

  const forsendelse = fields.find(
    (field) => !('name' in field) && field.type === 'group' && field.label === 'Forsendelse',
  ) as (Field & { fields: Field[] }) | undefined

  it('renders a Forsendelse section in the sidebar', () => {
    assert.ok(forsendelse, 'the section must exist')
    assert.equal(forsendelse!.admin?.position, 'sidebar')
  })

  it('sits directly below Notater', () => {
    const notesIndex = fields.findIndex((f) => 'name' in f && f.name === 'notes')
    assert.ok(notesIndex >= 0)
    assert.equal(fields[notesIndex + 1], forsendelse, 'Forsendelse follows Notater')
  })

  it('carries the carrier and the tracking number as top-level, optional fields', () => {
    const [carrier, tracking] = forsendelse!.fields as Array<
      Field & { name: string; required?: boolean }
    >

    assert.equal(carrier.name, 'shippingCarrier')
    assert.equal(carrier.type, 'radio', 'one carrier at a time, by construction')
    assert.equal(carrier.label, 'Transportør')
    assert.notEqual(carrier.required, true, 'historical orders have no carrier')

    assert.equal(tracking.name, 'trackingNumber')
    assert.equal(tracking.type, 'text', 'an ordinary editable text field')
    assert.equal(tracking.label, 'Sendingsnummer')
    assert.notEqual(tracking.required, true, 'historical orders have no tracking number')
  })

  it('offers exactly PostNord, Posten and Helthjem', () => {
    const carrier = forsendelse!.fields[0] as Field & { options: { label: string; value: string }[] }
    assert.deepEqual(carrier.options, [
      { label: 'PostNord', value: 'postnord' },
      { label: 'Posten', value: 'posten' },
      { label: 'Helthjem', value: 'helthjem' },
    ])
  })

  it('has no per-carrier tracking-number fields anywhere on the collection', () => {
    const names = JSON.stringify(fields)
    for (const forbidden of [
      'postNordTrackingNumber',
      'postenTrackingNumber',
      'helthjemTrackingNumber',
    ]) {
      assert.ok(!names.includes(forbidden), `${forbidden} must not exist — the model is normalised`)
    }
  })

  it('runs the shipment gate before the e-mail claim', () => {
    const beforeValidate = Orders.hooks!.beforeValidate as CollectionBeforeValidateHook[]
    assert.ok(
      beforeValidate.includes(validateShipment as CollectionBeforeValidateHook),
      'the gate must be a beforeValidate hook, so a refusal never reaches claimOrderEmails',
    )
  })
})

describe('storing a shipment', () => {
  it('stores a carrier and a tracking number on an order', () => {
    const data = update(
      { status: 'shipped', shippingCarrier: 'postnord', trackingNumber: '707123456789' },
      CONFIRMED,
    )

    assert.equal(data.shippingCarrier, 'postnord')
    assert.equal(data.trackingNumber, '707123456789')
  })

  it('trims the tracking number before it is stored', () => {
    const data = update(
      { status: 'shipped', shippingCarrier: 'helthjem', trackingNumber: '  707123456789  ' },
      CONFIRMED,
    )

    assert.equal(data.trackingNumber, '707123456789')
  })

  it('stores a blank tracking number as null rather than an empty string', () => {
    const data = update({ trackingNumber: '   ' }, CONFIRMED)
    assert.equal(data.trackingNumber, null)
  })

  it('leaves a tracking number absent from the patch untouched', () => {
    const data = update({ notes: 'Pakket i eske' }, CONFIRMED)
    assert.ok(!('trackingNumber' in data), 'a partial PATCH must not blank the stored value')
  })
})

/* ------------------------ 2. the transition into Sendt ------------------------ */

describe('transition to Sendt', () => {
  it('is rejected without a carrier', () => {
    expectRejected(
      () => update({ status: 'shipped', trackingNumber: '707123456789' }, CONFIRMED),
      ['shippingCarrier'],
    )
  })

  it('is rejected without a tracking number', () => {
    expectRejected(
      () => update({ status: 'shipped', shippingCarrier: 'postnord' }, CONFIRMED),
      ['trackingNumber'],
    )
  })

  it('is rejected with a whitespace-only tracking number', () => {
    expectRejected(
      () => update({ status: 'shipped', shippingCarrier: 'postnord', trackingNumber: '  ' }, CONFIRMED),
      ['trackingNumber'],
    )
  })

  it('is rejected when both are missing, naming both fields', () => {
    expectRejected(() => update({ status: 'shipped' }, CONFIRMED), [
      'shippingCarrier',
      'trackingNumber',
    ])
  })

  it('succeeds with both values', () => {
    const data = update(
      { status: 'shipped', shippingCarrier: 'posten', trackingNumber: '707123456789' },
      CONFIRMED,
    )

    assert.equal(data.status, 'shipped')
    assert.equal(data.shippingCarrier, 'posten')
    assert.equal(data.trackingNumber, '707123456789')
  })

  it('accepts a status-only PATCH when the shipment is already stored', () => {
    const readyToShip = {
      ...CONFIRMED,
      shippingCarrier: 'helthjem',
      trackingNumber: '707123456789',
    }

    assert.doesNotThrow(() => update({ status: 'shipped' }, readyToShip))
  })

  it('refuses a save that would blank the carrier while entering Sendt', () => {
    const readyToShip = {
      ...CONFIRMED,
      shippingCarrier: 'helthjem',
      trackingNumber: '707123456789',
    }

    expectRejected(() => update({ status: 'shipped', shippingCarrier: null }, readyToShip), [
      'shippingCarrier',
    ])
  })
})

/* ------------------------- 3. backward compatibility ------------------------- */

describe('orders created before the Forsendelse section', () => {
  it('can be re-saved while already shipped, with both fields empty', () => {
    assert.doesNotThrow(() => update({ notes: 'Levert i postkassen' }, LEGACY_SHIPPED))
  })

  it('can be re-saved with status resubmitted as shipped (the admin sends the whole doc)', () => {
    assert.doesNotThrow(() => update({ status: 'shipped', notes: 'ny lapp' }, LEGACY_SHIPPED))
  })

  it('can still be moved on to Levert', () => {
    assert.doesNotThrow(() => update({ status: 'delivered' }, LEGACY_SHIPPED))
  })

  it('can still be cancelled', () => {
    assert.doesNotThrow(() => update({ status: 'cancelled' }, LEGACY_SHIPPED))
  })
})

describe('statuses that require nothing', () => {
  for (const status of ['pending', 'confirmed', 'delivered', 'cancelled']) {
    it(`lets an order be saved as ${status} with no shipment data`, () => {
      assert.doesNotThrow(() => update({ status }, CONFIRMED))
    })
  }

  it('lets the Kustom webhook create an order without shipment data', () => {
    assert.doesNotThrow(() => create({ status: 'confirmed', orderNumber: 'AB-1002' }))
  })
})
