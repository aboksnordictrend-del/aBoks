import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { APIError, ValidationError } from 'payload'
import {
  CATEGORY_LOCKED_MESSAGE,
  CUSTOMER_HAS_SALES_MESSAGE,
  DUPLICATE_REASON_MESSAGE,
  PARTNER_LOCKED_MESSAGE,
  PARTNER_NOT_ELIGIBLE_MESSAGE,
  enforceReferredCustomerRules,
  guardReferredCustomerDelete,
} from './referredCustomer'

/* ------------------------------ harness ------------------------------ */

type Doc = Record<string, unknown>

interface Stub {
  partners?: Record<string, Doc>
  /** Open records returned for a `registrationKey` / `nameKey` lookup. */
  byRegistrationKey?: Doc[]
  byNameKey?: Doc[]
  /** Number of sales registered on the customer. */
  sales?: number
}

function stubReq(stub: Stub = {}) {
  const calls = { find: [] as Doc[], findByID: [] as Doc[], count: [] as Doc[] }
  const req = {
    user: { id: 42 },
    payload: {
      findByID: async (args: Doc) => {
        calls.findByID.push(args)
        return stub.partners?.[String(args.id)] ?? null
      },
      find: async (args: { where: { and: Doc[] } }) => {
        calls.find.push(args as unknown as Doc)
        const first = args.where.and[0]
        const docs = 'registrationKey' in first ? stub.byRegistrationKey ?? [] : stub.byNameKey ?? []
        return { docs }
      },
      count: async (args: Doc) => {
        calls.count.push(args)
        return { totalDocs: stub.sales ?? 0 }
      },
    },
    t: (key: string) => key,
  }
  return { req, calls }
}

type ChangeArgs = Parameters<typeof enforceReferredCustomerRules>[0]

const PARTNERS = {
  7: { id: 7, partnerType: 'regular', status: 'active', name: 'Ola' },
  8: { id: 8, partnerType: 'regular', status: 'paused', name: 'Kari' },
  9: { id: 9, partnerType: 'retailer', status: 'active', name: 'Nettbutikken AS' },
  10: { id: 10, partnerType: null, status: 'active', name: 'Uklassifisert' },
  11: { id: 11, partnerType: 'regular', status: 'ended', name: 'Per' },
  12: { id: 12, partnerType: 'regular', status: 'active', name: 'Nils' },
}

const IDENTITY = 'elkjøp lørenskog|NO:834012952'

const base = (overrides: Doc = {}): Doc => ({
  name: 'Elkjøp Lørenskog AS',
  category: 'retailStore',
  partner: 7,
  status: 'pending',
  country: 'NO',
  organizationNumber: '834 012 952',
  ...overrides,
})

/** A stored, open record with its derived keys, as the database would return it. */
const stored = (overrides: Doc = {}): Doc => ({
  id: 1,
  ...base(),
  registrationKey: 'NO:834012952',
  nameKey: 'elkjøp lørenskog',
  ...overrides,
})

function run(operation: 'create' | 'update', data: Doc, originalDoc?: Doc, stub: Stub = {}) {
  const { req, calls } = stubReq({ partners: PARTNERS, ...stub })
  const promise = Promise.resolve(
    enforceReferredCustomerRules({ operation, data, originalDoc, req } as unknown as ChangeArgs),
  )
  return { promise, calls }
}

async function refused(promise: Promise<unknown>, path: string, message?: string | RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `expected ValidationError, got ${String(err)}`)
    const errors = (err as ValidationError).data.errors
    assert.equal(errors[0].path, path)
    if (typeof message === 'string') assert.equal(errors[0].message, message)
    else if (message) assert.match(errors[0].message, message)
    return true
  })
}

/* ------------------------------ derived keys ------------------------------ */

describe('enforceReferredCustomerRules — derived keys', () => {
  it('computes registrationKey and nameKey on the server', async () => {
    const data = base()
    await run('create', data).promise
    assert.equal(data.registrationKey, 'NO:834012952')
    assert.equal(data.nameKey, 'elkjøp lørenskog')
  })

  it('overwrites keys a client tried to send', async () => {
    const data = base({ registrationKey: 'NO:000000000', nameKey: 'forged', duplicateConfirmedFor: IDENTITY })
    await run('create', data).promise
    assert.equal(data.registrationKey, 'NO:834012952')
    assert.equal(data.nameKey, 'elkjøp lørenskog')
    assert.equal(data.duplicateConfirmedFor, null)
  })

  it('keys a foreign customer by ISO code and number', async () => {
    const data = base({ country: 'SE', organizationNumber: '556677-8899' })
    await run('create', data).promise
    assert.equal(data.registrationKey, 'SE:5566778899')
  })

  it('stores no registration key when no number is entered', async () => {
    const data = base({ organizationNumber: '' })
    await run('create', data).promise
    assert.equal(data.registrationKey, null)
  })
})

/* ------------------------------ partner eligibility ------------------------------ */

describe('enforceReferredCustomerRules — partner eligibility', () => {
  it('accepts an active regular partner', async () => {
    await run('create', base()).promise
  })

  for (const [id, why] of [
    [8, 'paused'],
    [11, 'ended'],
    [9, 'online retailer'],
    [10, 'unclassified'],
    [404, 'missing'],
  ] as const) {
    it(`refuses a ${why} partner on create`, async () => {
      await refused(run('create', base({ partner: id })).promise, 'partner', PARTNER_NOT_ELIGIBLE_MESSAGE)
    })
  }

  it('refuses reassignment to an ineligible partner', async () => {
    await refused(run('update', { partner: 9 }, stored(), { sales: 0 }).promise, 'partner', PARTNER_NOT_ELIGIBLE_MESSAGE)
    await refused(run('update', { partner: 8 }, stored(), { sales: 0 }).promise, 'partner', PARTNER_NOT_ELIGIBLE_MESSAGE)
  })

  it('keeps an existing link valid after its partner was paused (editing a note)', async () => {
    const doc = stored({ partner: 8 })
    const { promise, calls } = run('update', { ...doc, internalNote: 'Ringt' }, doc)
    await promise
    assert.equal(calls.findByID.length, 0, 'an unchanged partner is not re-checked')
  })

  it('accepts a populated relationship object as the same partner', async () => {
    const doc = stored({ partner: 8 })
    await run('update', { ...doc, partner: { id: 8, name: 'Kari' } }, doc).promise
  })
})

/* ------------------------------ lock once a sale exists ------------------------------ */

describe('enforceReferredCustomerRules — partner and category lock', () => {
  it('allows correcting partner and category before the first sale', async () => {
    await run('update', { partner: 12 }, stored(), { sales: 0 }).promise
    await run('update', { category: 'businessSale' }, stored(), { sales: 0 }).promise
  })

  it('locks the partner once a sale exists', async () => {
    await refused(run('update', { partner: 12 }, stored(), { sales: 1 }).promise, 'partner', PARTNER_LOCKED_MESSAGE)
  })

  it('locks the category once a sale exists', async () => {
    await refused(
      run('update', { category: 'businessSale' }, stored(), { sales: 3 }).promise,
      'category',
      CATEGORY_LOCKED_MESSAGE,
    )
  })

  it('does not count sales on an unrelated edit', async () => {
    const doc = stored()
    const { promise, calls } = run('update', { ...doc, internalNote: 'x' }, doc, { sales: 5 })
    await promise
    assert.equal(calls.count.length, 0)
  })

  it('counts the sales of this customer only', async () => {
    const { promise, calls } = run('update', { category: 'businessSale' }, stored(), { sales: 0 })
    await promise
    assert.equal(calls.count[0].collection, 'referral-sales')
    assert.deepEqual(calls.count[0].where, { referredCustomer: { equals: 1 } })
  })
})

/* ------------------------------ duplicates ------------------------------ */

describe('enforceReferredCustomerRules — duplicate registration number', () => {
  const other = {
    id: 2,
    name: 'Elkjøp Lørenskog AS',
    status: 'approved',
    partner: { id: 12, name: 'Nils' },
    registrationKey: 'NO:834012952',
    nameKey: 'elkjøp lørenskog',
  }

  it('blocks outright, naming the existing record — even with a name confirmation', async () => {
    await refused(
      run('create', base({ duplicateConfirmed: true, duplicateReason: 'x' }), undefined, { byRegistrationKey: [other] }).promise,
      'organizationNumber',
      /allerede registrert: «Elkjøp Lørenskog AS» \(id 2, partner Nils, status Godkjent\).*«Inaktiv» eller «Avvist»/,
    )
  })

  it('looks only among open records, excluding itself', async () => {
    const { promise, calls } = run('update', { status: 'pending' }, stored({ status: 'inactive' }))
    await promise
    const and = (calls.find[0].where as { and: Doc[] }).and
    assert.deepEqual(and[0], { registrationKey: { equals: 'NO:834012952' } })
    assert.deepEqual(and[1], { status: { in: ['pending', 'approved'] } })
    assert.deepEqual(and[2], { id: { not_equals: 1 } })
  })

  it('does not check rejected or inactive records at all', async () => {
    const { promise, calls } = run('create', base({ status: 'inactive' }), undefined, { byRegistrationKey: [other] })
    await promise
    assert.equal(calls.find.length, 0)
  })

  it('re-checks when a closed record is reopened', async () => {
    await refused(
      run('update', { status: 'approved' }, stored({ status: 'inactive' }), { byRegistrationKey: [other] }).promise,
      'organizationNumber',
    )
  })

  it('does not re-check an unchanged open record (editing a note)', async () => {
    const doc = stored()
    const { promise, calls } = run('update', { ...doc, internalNote: 'x' }, doc, { byRegistrationKey: [other] })
    await promise
    assert.equal(calls.find.length, 0)
  })

  it('treats the same digits in another country as a different company', async () => {
    const { promise, calls } = run('create', base({ country: 'SE', organizationNumber: '834012952' }))
    await promise
    assert.deepEqual((calls.find[0].where as { and: Doc[] }).and[0], { registrationKey: { equals: 'SE:834012952' } })
  })

  it('re-checks when only the country changes', async () => {
    const { promise, calls } = run('update', { country: 'SE' }, stored())
    await promise
    assert.deepEqual((calls.find[0].where as { and: Doc[] }).and[0], { registrationKey: { equals: 'SE:834012952' } })
  })
})

describe('enforceReferredCustomerRules — duplicate name confirmation', () => {
  const sameName = {
    id: 2,
    name: 'Elkjøp Lørenskog',
    status: 'approved',
    partner: { id: 12, name: 'Nils' },
    registrationKey: null,
    nameKey: 'elkjøp lørenskog',
  }

  it('blocks a name match until it is confirmed', async () => {
    await refused(
      run('create', base({ organizationNumber: '' }), undefined, { byNameKey: [sameName] }).promise,
      'duplicateConfirmed',
      /samme navn.*Bekreft: ikke duplikat/,
    )
  })

  it('requires a reason with the confirmation', async () => {
    await refused(
      run('create', base({ organizationNumber: '', duplicateConfirmed: true, duplicateReason: '  ' }), undefined, {
        byNameKey: [sameName],
      }).promise,
      'duplicateReason',
      DUPLICATE_REASON_MESSAGE,
    )
  })

  it('records a confirmation for the exact identity, by whom and when', async () => {
    const data = base({ organizationNumber: '', duplicateConfirmed: true, duplicateReason: 'To butikker i samme kjede' })
    await run('create', data, undefined, { byNameKey: [sameName] }).promise
    assert.equal(data.duplicateConfirmedFor, 'elkjøp lørenskog|')
    assert.equal(data.duplicateConfirmedBy, 42)
    assert.ok(typeof data.duplicateConfirmedAt === 'string')
    assert.equal(data.duplicateReason, 'To butikker i samme kjede')
  })

  it('never stores the checkbox as ticked — it is an action for one save', async () => {
    const data = base({ organizationNumber: '', duplicateConfirmed: true, duplicateReason: 'x' })
    await run('create', data, undefined, { byNameKey: [sameName] }).promise
    assert.equal(data.duplicateConfirmed, false)
  })

  it('keeps a confirmation while the identity is unchanged (reopening a record)', async () => {
    const doc = stored({
      organizationNumber: '',
      registrationKey: null,
      status: 'inactive',
      duplicateConfirmedFor: 'elkjøp lørenskog|',
      duplicateReason: 'To butikker',
    })
    const data: Doc = { ...doc, status: 'approved' }
    await run('update', data, doc, { byNameKey: [sameName] }).promise
    assert.equal(data.duplicateConfirmedFor, 'elkjøp lørenskog|')
    assert.equal(data.duplicateReason, 'To butikker')
  })

  it('resets the confirmation and its reason when the name changes', async () => {
    const doc = stored({
      name: 'Elkjøp Lørenskog',
      organizationNumber: '',
      registrationKey: null,
      duplicateConfirmedFor: 'elkjøp lørenskog|',
      duplicateConfirmedAt: '2026-10-17T10:00:00.000Z',
      duplicateConfirmedBy: 42,
      duplicateReason: 'Gammel begrunnelse',
    })
    // The form resends the old reason; no new tick. No conflict for the new name.
    const data: Doc = { ...doc, name: 'Elkjøp Strømmen' }
    await run('update', data, doc).promise
    assert.equal(data.duplicateConfirmedFor, null)
    assert.equal(data.duplicateConfirmedAt, null)
    assert.equal(data.duplicateConfirmedBy, null)
    assert.equal(data.duplicateReason, null)
  })

  it('an old confirmation cannot authorise a new conflict', async () => {
    const doc = stored({
      name: 'Elkjøp Strømmen',
      nameKey: 'elkjøp strømmen',
      organizationNumber: '',
      registrationKey: null,
      duplicateConfirmedFor: 'elkjøp strømmen|',
      duplicateReason: 'Gjaldt Strømmen',
    })
    // Renamed into a clash with another open record, resending the old reason and no fresh tick.
    await refused(
      run('update', { ...doc, name: 'Elkjøp Lørenskog' }, doc, { byNameKey: [sameName] }).promise,
      'duplicateConfirmed',
    )
  })

  it('resets the confirmation when the registration number or country changes', async () => {
    const doc = stored({ duplicateConfirmedFor: IDENTITY, duplicateReason: 'x' })
    const data: Doc = { ...doc, organizationNumber: '937172877' }
    await run('update', data, doc).promise
    assert.equal(data.duplicateConfirmedFor, null)
    assert.equal(data.duplicateReason, null)

    const countryData: Doc = { ...doc, country: 'SE' }
    await run('update', countryData, doc).promise
    assert.equal(countryData.duplicateConfirmedFor, null)
  })

  it('accepts a fresh tick with a new reason after an identity change', async () => {
    const doc = stored({ name: 'Elkjøp Strømmen', nameKey: 'elkjøp strømmen', organizationNumber: '', registrationKey: null })
    const data: Doc = { ...doc, name: 'Elkjøp Lørenskog', duplicateConfirmed: true, duplicateReason: 'Ny kontroll' }
    await run('update', data, doc, { byNameKey: [sameName] }).promise
    assert.equal(data.duplicateConfirmedFor, 'elkjøp lørenskog|')
    assert.equal(data.duplicateReason, 'Ny kontroll')
  })

  it('keeps the confirmation untouched on an unrelated edit', async () => {
    const doc = stored({ duplicateConfirmedFor: IDENTITY, duplicateReason: 'x', duplicateConfirmedBy: { id: 42 } })
    const data: Doc = { ...doc, internalNote: 'notat' }
    await run('update', data, doc).promise
    assert.equal(data.duplicateConfirmedFor, IDENTITY)
    assert.equal(data.duplicateReason, 'x')
    assert.equal(data.duplicateConfirmedBy, 42)
  })

  it('does not flag a same-name company with a different registration number', async () => {
    await run('create', base(), undefined, { byNameKey: [{ ...sameName, registrationKey: 'NO:937172877' }] }).promise
  })
})

/* ------------------------------ delete ------------------------------ */

describe('guardReferredCustomerDelete', () => {
  type DeleteArgs = Parameters<typeof guardReferredCustomerDelete>[0]

  it('refuses deleting a customer with sales', async () => {
    const { req } = stubReq({ sales: 1 })
    await assert.rejects(
      Promise.resolve(guardReferredCustomerDelete({ id: 1, req } as unknown as DeleteArgs)),
      (err: unknown) => {
        assert.ok(err instanceof APIError)
        assert.equal((err as APIError).message, CUSTOMER_HAS_SALES_MESSAGE)
        assert.equal((err as APIError).status, 409)
        return true
      },
    )
  })

  it('allows deleting a customer without sales', async () => {
    const { req } = stubReq({ sales: 0 })
    await guardReferredCustomerDelete({ id: 1, req } as unknown as DeleteArgs)
  })
})
