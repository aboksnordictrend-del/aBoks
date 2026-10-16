import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ValidationError } from 'payload'
import {
  PARTNER_LOCKED_MESSAGE,
  PARTNER_WITHOUT_PROMO_MODEL_MESSAGE,
  guardPartnerChange,
  relationshipId,
  syncPartnerName,
  validatePartnerLink,
} from './promoCodePartner'

/**
 * The promo code ↔ partner link: the name copy that keeps every existing reader working, and
 * the lock that keeps a used code's history with its original partner.
 */

/* ------------------------------ harness ------------------------------ */

interface Stub {
  partners?: Record<string, { name?: unknown } | null>
  usageCount?: number
}

function stubReq(stub: Stub = {}) {
  const calls = { findByID: [] as unknown[], count: [] as unknown[] }
  const req = {
    payload: {
      findByID: async (args: { collection: string; id: unknown }) => {
        calls.findByID.push(args)
        assert.equal(args.collection, 'partners', 'only the partner may be looked up')
        return stub.partners?.[String(args.id)] ?? null
      },
      count: async (args: unknown) => {
        calls.count.push(args)
        return { totalDocs: stub.usageCount ?? 0 }
      },
    },
  }
  return { req, calls }
}

type SyncArgs = Parameters<typeof syncPartnerName>[0]
type GuardArgs = Parameters<typeof guardPartnerChange>[0]

const sync = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>, stub?: Stub) => {
  const { req, calls } = stubReq(stub)
  return Promise.resolve(syncPartnerName({ data, originalDoc, req } as unknown as SyncArgs)).then((result: unknown) => ({
    result: result as Record<string, unknown>,
    calls,
  }))
}

const guard = (
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  stub?: Stub,
  operation: 'create' | 'update' = 'update',
) => {
  const { req, calls } = stubReq(stub)
  return {
    run: () => guardPartnerChange({ operation, data, originalDoc, req } as unknown as GuardArgs),
    calls,
  }
}

const OLA = { '5': { name: '  Ola Nordmann  ' } }

/* ------------------------------ relationshipId ------------------------------ */

describe('relationshipId', () => {
  it('reads a raw id, a populated document and nothing', () => {
    assert.equal(relationshipId(5), '5')
    assert.equal(relationshipId('5'), '5')
    assert.equal(relationshipId({ id: 5, name: 'x' }), '5')
    assert.equal(relationshipId(null), null)
    assert.equal(relationshipId(undefined), null)
    assert.equal(relationshipId(''), null)
    assert.equal(relationshipId({}), null)
  })
})

/* ------------------------------ syncPartnerName ------------------------------ */

describe('syncPartnerName — copies the partner name into partnerName', () => {
  it('fills partnerName from the selected partner, trimmed', async () => {
    const { result } = await sync({ isPartnerCode: true, partner: 5 }, undefined, { partners: OLA })
    assert.equal(result.partnerName, 'Ola Nordmann')
  })

  it('overwrites a stale or hand-typed name with the partner record', async () => {
    const { result } = await sync(
      { isPartnerCode: true, partner: 5, partnerName: 'Gammelt navn' },
      undefined,
      { partners: OLA },
    )
    assert.equal(result.partnerName, 'Ola Nordmann')
  })

  it('accepts a populated partner document as the value', async () => {
    const { result } = await sync({ isPartnerCode: true, partner: { id: 5 } }, undefined, {
      partners: OLA,
    })
    assert.equal(result.partnerName, 'Ola Nordmann')
  })

  it('reads the flag and link from the stored document on a partial update', async () => {
    const { result } = await sync({ active: false }, { isPartnerCode: true, partner: 5 }, {
      partners: OLA,
    })
    assert.equal(result.partnerName, 'Ola Nordmann')
  })

  it('leaves an unlinked partner code exactly as typed', async () => {
    const { result, calls } = await sync({ isPartnerCode: true, partnerName: 'Kari' })
    assert.equal(result.partnerName, 'Kari')
    assert.equal(calls.findByID.length, 0, 'no lookup without a link')
  })

  it('never touches an ordinary promo code, even one with a stale link', async () => {
    const { result, calls } = await sync({ isPartnerCode: false, partner: 5, partnerName: null }, undefined, {
      partners: OLA,
    })
    assert.equal(result.partnerName, null)
    assert.equal(calls.findByID.length, 0)
  })

  it('leaves the name alone when the partner cannot be found', async () => {
    const { result } = await sync({ isPartnerCode: true, partner: 99, partnerName: 'Kari' })
    assert.equal(result.partnerName, 'Kari', 'Payload’s relationship validation reports the bad id')
  })

  it('never writes a discount or commission field', async () => {
    const data = {
      isPartnerCode: true,
      partner: 5,
      commissionRate: 15,
      commissionBase: 'orderAfterDiscount',
      discountValue: 10,
    }
    const { result } = await sync({ ...data }, undefined, { partners: OLA })
    assert.equal(result.commissionRate, 15)
    assert.equal(result.commissionBase, 'orderAfterDiscount')
    assert.equal(result.discountValue, 10)
  })
})

/* ------------------------------ guardPartnerChange ------------------------------ */

describe('guardPartnerChange — a used code keeps its partner', () => {
  const USED = { usageCount: 3 }

  const rejects = async (run: () => Promise<unknown>) => {
    await assert.rejects(run, (err: unknown) => {
      assert.ok(err instanceof ValidationError, 'a field-level validation error')
      const data = (err as ValidationError).data as { errors: { path: string; message: string }[] }
      assert.equal(data.errors[0].path, 'partner')
      assert.equal(data.errors[0].message, PARTNER_LOCKED_MESSAGE)
      return true
    })
  }

  it('refuses moving a used code to another partner', async () => {
    await rejects(guard({ partner: 6 }, { id: 1, partner: 5 }, USED).run)
  })

  it('refuses unlinking a used code', async () => {
    await rejects(guard({ partner: null }, { id: 1, partner: 5 }, USED).run)
  })

  it('counts usages of exactly this promo code', async () => {
    const g = guard({ partner: 6 }, { id: 42, partner: 5 }, USED)
    await assert.rejects(g.run)
    assert.deepEqual((g.calls.count[0] as { collection: string; where: unknown }).collection, 'promo-code-usages')
    assert.deepEqual((g.calls.count[0] as { where: unknown }).where, { promoCode: { equals: 42 } })
  })

  it('allows linking a used code for the first time', async () => {
    const g = guard({ partner: 5 }, { id: 1, partner: null }, USED)
    await g.run()
    assert.equal(g.calls.count.length, 0, 'a first link is never checked')
  })

  it('allows changing the partner on a code that has never been used', async () => {
    await guard({ partner: 6 }, { id: 1, partner: 5 }, { usageCount: 0 }).run()
  })

  it('treats a resubmitted, unchanged partner as no change — raw id or populated', async () => {
    for (const value of [5, '5', { id: 5 }]) {
      const g = guard({ partner: value, active: false }, { id: 1, partner: 5 }, USED)
      await g.run()
      assert.equal(g.calls.count.length, 0)
    }
  })

  it('ignores an update that does not carry the partner at all', async () => {
    const g = guard({ active: false }, { id: 1, partner: 5 }, USED)
    await g.run()
    assert.equal(g.calls.count.length, 0)
  })

  it('leaves creation alone', async () => {
    const g = guard({ partner: 5 }, undefined, USED, 'create')
    await g.run()
    assert.equal(g.calls.count.length, 0)
  })
})

/* ------------------------------ validatePartnerLink ------------------------------ */


describe('validatePartnerLink — Payload’s relationship validation, in Norwegian', () => {
  const EN_INVALID = 'This field has the following invalid selections:'
  /** A request whose partner lookup returns only the given (Promokode) partner ids. */
  const options = (allowedIds: number[], extra: Record<string, unknown> = {}) =>
    ({
      relationTo: 'partners',
      filterOptions: () => ({ partnershipTypes: { in: ['promoCode'] } }),
      data: {},
      siblingData: {},
      req: {
        t: (key: string) => (key === 'validation:invalidSelections' ? EN_INVALID : key),
        user: { id: 1 },
        payload: { collections: {}, db: { defaultIDType: 'number' } },
        payloadDataLoader: { find: async () => ({ docs: allowedIds.map((id) => ({ id })) }) },
      },
      ...extra,
    }) as unknown as Parameters<typeof validatePartnerLink>[1]

  it('accepts a partner with the Promokode model', async () => {
    assert.equal(await validatePartnerLink(5, options([5])), true)
  })

  it('accepts an empty link — the field is optional', async () => {
    assert.equal(await validatePartnerLink(null, options([])), true)
    assert.equal(await validatePartnerLink(undefined, options([])), true)
  })

  it('replaces Payload’s English refusal with a Norwegian explanation', async () => {
    const result = await validatePartnerLink(7, options([5]))
    assert.equal(result, PARTNER_WITHOUT_PROMO_MODEL_MESSAGE)
    assert.match(String(result), /«Promokode»/)
    assert.doesNotMatch(String(result), /invalid selections/)
  })

  it('passes any other validation result through unchanged', async () => {
    const result = await validatePartnerLink(null, options([], { required: true }))
    assert.equal(result, 'validation:required')
  })
})
