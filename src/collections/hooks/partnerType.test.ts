import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ValidationError } from 'payload'
import { PARTNER_TYPE_LOCKED_MESSAGE } from '@/lib/partner/partnerships'
import { isPartnerTypeLocked } from '@/components/admin/partner/PartnerTypeField'
import { enforcePartnerType } from './partnerType'

/**
 * The server-side partner-type rules: classified once and then permanent — refused with an explicit
 * validation error, never silently dropped — and a regular partner never carries a retailer
 * agreement. Both live in a collection hook, which runs on every write path.
 */

type Args = Parameters<typeof enforcePartnerType>[0]
const run = (operation: 'create' | 'update', data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
  enforcePartnerType({ operation, data, originalDoc, req: {} } as unknown as Args) as Record<string, unknown>

const refused = (fn: () => unknown) =>
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError)
    const data = (err as ValidationError).data as { errors: { path: string; message: string }[] }
    assert.equal(data.errors[0].path, 'partnerType')
    assert.equal(data.errors[0].message, PARTNER_TYPE_LOCKED_MESSAGE)
    return true
  })

describe('enforcePartnerType — classified once, then permanent', () => {
  it('lets a new partner choose either type', () => {
    assert.equal(run('create', { partnerType: 'regular' }).partnerType, 'regular')
    assert.equal(run('create', { partnerType: 'retailer' }).partnerType, 'retailer')
  })

  it('lets an unclassified partner be classified', () => {
    assert.equal(run('update', { partnerType: 'retailer' }, { id: 1, partnerType: null }).partnerType, 'retailer')
    assert.equal(run('update', { partnerType: 'regular' }, { id: 1 }).partnerType, 'regular')
  })

  it('refuses changing a stored type — even with access overridden', () => {
    refused(() => run('update', { partnerType: 'retailer' }, { id: 1, partnerType: 'regular' }))
    refused(() => run('update', { partnerType: 'regular' }, { id: 1, partnerType: 'retailer' }))
  })

  it('refuses clearing a stored type', () => {
    refused(() => run('update', { partnerType: null }, { id: 1, partnerType: 'regular' }))
  })

  it('accepts a resubmission of the same type, and an update that does not carry it', () => {
    assert.doesNotThrow(() => run('update', { partnerType: 'regular', name: 'Ny' }, { id: 1, partnerType: 'regular' }))
    assert.doesNotThrow(() => run('update', { name: 'Ny' }, { id: 1, partnerType: 'retailer' }))
  })
})

describe('enforcePartnerType — a regular partner never has a retailer agreement (explicit refusal)', () => {
  /** Runs the hook and returns the refused paths and messages, or null when it passes. */
  const refusal = (operation: 'create' | 'update', data: Record<string, unknown>, originalDoc?: Record<string, unknown>) => {
    try {
      run(operation, data, originalDoc)
      return null
    } catch (err) {
      assert.ok(err instanceof ValidationError, 'must be a ValidationError')
      assert.equal((err as ValidationError).status, 400)
      return ((err as ValidationError).data as { errors: { path: string; message: string }[] }).errors
    }
  }

  it('refuses creating a regular partner with an agreement ticked, naming the checkbox', () => {
    const errors = refusal('create', { partnerType: 'regular', dropshippingEnabled: true })
    assert.deepEqual(errors?.map((e) => e.path), ['dropshippingEnabled'])
    assert.match(errors![0].message, /En vanlig partner kan ikke ha avtalen «Dropshipping»/)
    assert.match(errors![0].message, /Fjern avkrysningen/)
  })

  it('names both agreements when both are ticked', () => {
    const errors = refusal('create', { partnerType: 'regular', dropshippingEnabled: true, wholesaleEnabled: true })
    assert.deepEqual(errors?.map((e) => e.path), ['dropshippingEnabled', 'wholesaleEnabled'])
    assert.match(errors![1].message, /«Forhandlerinnkjøp»/)
  })

  it('refuses classifying an unclassified partner as regular while a STORED agreement is ticked', () => {
    const errors = refusal('update', { partnerType: 'regular' }, { id: 1, partnerType: null, wholesaleEnabled: true })
    assert.deepEqual(errors?.map((e) => e.path), ['wholesaleEnabled'])
  })

  it('accepts that classification once the administrator has unticked the agreement explicitly', () => {
    const data = { partnerType: 'regular', wholesaleEnabled: false }
    assert.equal(refusal('update', data, { id: 1, partnerType: null, wholesaleEnabled: true }), null)
    assert.equal(data.wholesaleEnabled, false)
  })

  it('refuses ticking an agreement on a stored regular partner', () => {
    const errors = refusal('update', { dropshippingEnabled: true }, { id: 1, partnerType: 'regular' })
    assert.deepEqual(errors?.map((e) => e.path), ['dropshippingEnabled'])
  })

  it('never changes a flag or a percentage — it refuses or passes the data through untouched', () => {
    const data = { partnerType: 'regular', dropshippingEnabled: true, dropshippingDiscountPercent: 22, wholesaleDiscountPercent: 35 }
    const snapshot = JSON.stringify(data)
    assert.ok(refusal('create', data))
    assert.equal(JSON.stringify(data), snapshot, 'refused data is not modified')
    const ok = { partnerType: 'regular', dropshippingEnabled: false, dropshippingDiscountPercent: 22 }
    const out = run('create', ok)
    assert.deepEqual(out, { partnerType: 'regular', dropshippingEnabled: false, dropshippingDiscountPercent: 22 })
  })

  it('lets a regular partner without agreements save normally, including unrelated updates', () => {
    assert.equal(refusal('create', { partnerType: 'regular' }), null)
    assert.equal(refusal('update', { name: 'Ny' }, { id: 1, partnerType: 'regular', dropshippingEnabled: false, wholesaleEnabled: false }), null)
  })

  it('lets an online retailer enable either or both agreements', () => {
    for (const flags of [{ dropshippingEnabled: true }, { wholesaleEnabled: true }, { dropshippingEnabled: true, wholesaleEnabled: true }]) {
      const out = run('update', { ...flags }, { id: 1, partnerType: 'retailer' })
      assert.deepEqual(out, flags)
    }
  })

  it('leaves an unclassified partner with stored agreements untouched on unrelated saves', () => {
    const out = run('update', { status: 'paused' }, { id: 1, partnerType: null, dropshippingEnabled: true })
    assert.deepEqual(out, { status: 'paused' })
  })

  it('checks the type change BEFORE the agreements — a locked type wins', () => {
    const errors = refusal('update', { partnerType: 'regular', dropshippingEnabled: true }, { id: 1, partnerType: 'retailer', dropshippingEnabled: true })
    assert.deepEqual(errors?.map((e) => e.path), ['partnerType'])
  })
})

describe('enforcePartnerType — the refusal is an explicit error, not a silent drop', () => {
  it('throws a ValidationError (HTTP 400) naming the field, with a Norwegian message', () => {
    try {
      run('update', { partnerType: 'retailer' }, { id: 7, partnerType: 'regular' })
      assert.fail('must throw')
    } catch (err) {
      assert.ok(err instanceof ValidationError)
      assert.equal((err as ValidationError).status, 400)
      const data = (err as ValidationError).data as { errors: { path: string; message: string }[] }
      assert.deepEqual(data.errors.map((e) => e.path), ['partnerType'])
      assert.match(data.errors[0].message, /kan ikke endres/)
    }
  })

  it('leaves the request data unmodified when it refuses', () => {
    const data = { partnerType: 'retailer', name: 'X' }
    assert.throws(() => run('update', data, { id: 7, partnerType: 'regular' }))
    assert.deepEqual(data, { partnerType: 'retailer', name: 'X' })
  })
})

describe('PartnerTypeField — read-only display once saved', () => {
  it('locks the radio only when the SAVED document has a type', () => {
    assert.equal(isPartnerTypeLocked('regular'), true)
    assert.equal(isPartnerTypeLocked('retailer'), true)
    for (const v of [undefined, null, '']) assert.equal(isPartnerTypeLocked(v), false, String(v))
  })
})
