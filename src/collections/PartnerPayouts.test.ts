import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CollectionBeforeChangeHook } from 'payload'
import { PartnerPayouts } from './PartnerPayouts'

/**
 * Access control and server-side immutability for the payout ledger.
 *
 * Reached through the exported `CollectionConfig`, the same way `Reviews.test.ts` tests access
 * — these are the guarantees that stop an editor deleting accounting history or a REST client
 * rewriting the amount of a transfer that already happened.
 */

type AccessFn = (args: { req: { user: unknown } }) => unknown

const access = PartnerPayouts.access!
const guard = (PartnerPayouts.hooks!.beforeChange as CollectionBeforeChangeHook[])[0]

const ADMIN = { id: 1, role: 'admin' }
const EDITOR = { id: 2, role: 'editor' }

/** The document as it stands in the database. */
const ORIGINAL = {
  id: 10,
  promoCode: 7,
  partnerNameSnapshot: 'Ola Nordmann',
  amount: 250,
  payoutDate: '2026-07-20T00:00:00.000Z',
  paymentMethod: 'bankTransfer',
  reference: 'BANK-1',
  note: 'Første utbetaling',
  createdBy: 1,
}

/** Runs the immutability hook as Payload would on an update. */
const update = (data: Record<string, unknown>, originalDoc: Record<string, unknown> = ORIGINAL) =>
  guard({
    operation: 'update',
    data,
    originalDoc,
    // The hook reads nothing else off the args.
  } as unknown as Parameters<CollectionBeforeChangeHook>[0])

const expectRejected = (data: Record<string, unknown>, field: string) => {
  assert.throws(
    () => update(data),
    (err: Error) => {
      assert.match(err.message, new RegExp(field))
      return true
    },
    `changing ${field} must be refused`,
  )
}

/* ------------------------------ 19. access control ------------------------------ */

describe('PartnerPayouts — access control', () => {
  it('requires authentication to read', () => {
    const read = access.read as AccessFn
    assert.equal(read({ req: { user: null } }), false)
    assert.equal(read({ req: { user: EDITOR } }), true)
  })

  it('closes ordinary creation entirely — the endpoint is the only way in', () => {
    const create = access.create as AccessFn
    assert.equal(create({ req: { user: null } }), false)
    assert.equal(create({ req: { user: ADMIN } }), false, 'not even for an admin')
  })

  it('allows an authenticated update (narrowed to reference/note by the hook)', () => {
    const updateAccess = access.update as AccessFn
    assert.equal(updateAccess({ req: { user: null } }), false)
    assert.equal(updateAccess({ req: { user: EDITOR } }), true)
  })

  it('lets only an admin delete', () => {
    const del = access.delete as AccessFn
    assert.equal(del({ req: { user: ADMIN } }), true)
    assert.equal(del({ req: { user: EDITOR } }), false, 'editors must not erase history')
    assert.equal(del({ req: { user: null } }), false)
  })

  it('fails closed when the role is missing or not exactly admin', () => {
    const del = access.delete as AccessFn
    // `users.role` is nullable in the schema, so these are all reachable states.
    for (const role of [null, undefined, '', 'Admin', 'ADMIN', 'superadmin', 1, {}]) {
      assert.equal(del({ req: { user: { id: 3, role } } }), false, JSON.stringify(role))
    }
  })
})

/* ------------------------------ 17. immutable fields ------------------------------ */

describe('PartnerPayouts — immutable fields are enforced server-side', () => {
  it('refuses a changed amount', () => {
    expectRejected({ ...ORIGINAL, amount: 500 }, 'amount')
  })

  it('refuses a changed promo code', () => {
    expectRejected({ ...ORIGINAL, promoCode: 8 }, 'promoCode')
  })

  it('refuses a changed payout date', () => {
    expectRejected({ ...ORIGINAL, payoutDate: '2026-07-25T00:00:00.000Z' }, 'payoutDate')
  })

  it('refuses a changed partner name', () => {
    expectRejected({ ...ORIGINAL, partnerNameSnapshot: 'Kari Nordmann' }, 'partnerNameSnapshot')
  })

  it('refuses a changed payment method', () => {
    expectRejected({ ...ORIGINAL, paymentMethod: 'vipps' }, 'paymentMethod')
  })

  it('refuses a changed createdBy', () => {
    expectRejected({ ...ORIGINAL, createdBy: 99 }, 'createdBy')
  })

  it('names every field that was tampered with', () => {
    assert.throws(
      () => update({ ...ORIGINAL, amount: 1, paymentMethod: 'vipps' }),
      /amount.*paymentMethod/,
    )
  })

  it('refuses an amount changed by a single øre', () => {
    expectRejected({ ...ORIGINAL, amount: 250.01 }, 'amount')
  })
})

/* ------------------------------ 18. editable fields ------------------------------ */

describe('PartnerPayouts — reference and note stay editable', () => {
  it('accepts a full resubmission that changes only the reference', () => {
    // The admin form sends the WHOLE document back, readOnly fields included. Unchanged
    // immutable values must not be mistaken for an edit.
    assert.doesNotThrow(() => update({ ...ORIGINAL, reference: 'BANK-2' }))
  })

  it('accepts a changed note', () => {
    assert.doesNotThrow(() => update({ ...ORIGINAL, note: 'Rettet notat' }))
  })

  it('accepts a partial update carrying only the editable fields', () => {
    assert.doesNotThrow(() => update({ reference: 'BANK-3', note: 'Kun notat' }))
  })

  it('treats equivalent representations as unchanged', () => {
    // A date as a Date object, a relationship as a populated document, money as 250.0 —
    // all the same values Payload may hand back in a different shape.
    assert.doesNotThrow(() =>
      update({
        ...ORIGINAL,
        payoutDate: new Date('2026-07-20T00:00:00.000Z'),
        promoCode: { id: 7, code: 'WELCOME10' },
        createdBy: { id: 1, email: 'a@b.no' },
        amount: 250.0,
        reference: 'BANK-4',
      }),
    )
  })

  it('leaves creation completely alone', () => {
    const data = { ...ORIGINAL, amount: 999 }
    const result = guard({
      operation: 'create',
      data,
      originalDoc: undefined,
    } as unknown as Parameters<CollectionBeforeChangeHook>[0])

    assert.deepEqual(result, data)
  })
})

/* ------------------------------ collection shape ------------------------------ */

describe('PartnerPayouts — collection configuration', () => {
  it('uses the agreed slug, labels and admin group', () => {
    assert.equal(PartnerPayouts.slug, 'partner-payouts')
    assert.equal(PartnerPayouts.labels?.singular, 'Partnerutbetaling')
    assert.equal(PartnerPayouts.labels?.plural, 'Partnerutbetalinger')
    assert.equal(PartnerPayouts.admin?.group, 'Butikk')
  })

  it('sorts newest payout first and shows the accounting columns', () => {
    assert.equal(PartnerPayouts.defaultSort, '-payoutDate')
    assert.deepEqual(PartnerPayouts.admin?.defaultColumns, [
      'payoutDate',
      'partnerNameSnapshot',
      'promoCode',
      'amount',
      'paymentMethod',
      'reference',
      'createdAt',
    ])
  })

  it('keeps Payload timestamps on', () => {
    assert.equal(PartnerPayouts.timestamps, true)
  })

  it('registers the payout endpoint at /register', () => {
    const endpoints = PartnerPayouts.endpoints
    assert.ok(Array.isArray(endpoints), 'the collection must register endpoints')

    const endpoint = endpoints.find((e) => e.path === '/register')
    assert.ok(endpoint, 'POST /api/partner-payouts/register must exist')
    assert.equal(endpoint.method, 'post')
  })
})
