import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { APIError } from 'payload'
import {
  PAYOUT_HAS_CLAWBACK_MESSAGE,
  REFERRAL_PAYOUT_ONLY_MESSAGE,
  assignPayoutSource,
  reverseReferralPayoutOnDelete,
} from './referralPayout'
import {
  ADJUSTMENT_LOCKED_MESSAGE,
  ADJUSTMENT_SETTLEMENT_CONTEXT,
  createClawbackAdjustment,
  guardAdjustmentChanges,
} from './referralAdjustment'
import { REFERRAL_PAYOUT_CONTEXT, enforceReferralSaleRules } from './referralSale'
import { ReferralCommissionAdjustments } from '../ReferralCommissionAdjustments'
import { PartnerPayouts } from '../PartnerPayouts'

/**
 * Stage 4 hooks: the clawback adjustment, the adjustment guard, the payout-source label, the
 * reversal of a deleted referral payout, and the row lock a refund takes before reading its
 * payout link.
 */

type Row = Record<string, unknown>
type AnyArgs = never

/* ------------------------------ clawback adjustment ------------------------------ */

describe('createClawbackAdjustment — exactly one negative adjustment', () => {
  function run(doc: Row, previousDoc: Row, existing = 0) {
    const created: Row[] = []
    const req = {
      user: { id: 42 },
      payload: {
        count: async () => ({ totalDocs: existing }),
        create: async ({ collection, data }: { collection: string; data: Row }) => {
          assert.equal(collection, 'referral-commission-adjustments')
          created.push(data)
          return data
        },
      },
    }
    return Promise.resolve(
      createClawbackAdjustment({ operation: 'update', doc, previousDoc, req } as unknown as AnyArgs),
    ).then(() => created)
  }

  const paidOut = { id: 50, title: 'Sport 1 – 17.10.2026', partner: 7, category: 'retailStore', payout: 500, commissionAmount: 1_830 }

  it('creates −commission when a paid-out sale is refunded', async () => {
    const created = await run(
      { ...paidOut, paymentStatus: 'refunded', commissionStatus: 'reversed' },
      { ...paidOut, paymentStatus: 'paid', commissionStatus: 'paid' },
    )
    assert.equal(created.length, 1)
    assert.deepEqual(
      { sale: created[0].sale, partner: created[0].partner, amount: created[0].amount, reason: created[0].reason, originalPayout: created[0].originalPayout },
      { sale: 50, partner: 7, amount: -1_830, reason: 'refundedAfterPayout', originalPayout: 500 },
    )
    assert.equal(created[0].createdBy, 42)
    assert.match(String(created[0].title), /^Tilbakeføring – Sport 1/)
  })

  it('records a cancellation as such', async () => {
    const created = await run(
      { ...paidOut, paymentStatus: 'cancelled', commissionStatus: 'reversed' },
      { ...paidOut, paymentStatus: 'paid', commissionStatus: 'paid' },
    )
    assert.equal(created[0].reason, 'cancelledAfterPayout')
  })

  it('creates it even when the payout landed while the refund was being saved', async () => {
    // previousDoc was read before the payout committed; doc.payout is the locked, committed value.
    const created = await run(
      { ...paidOut, paymentStatus: 'refunded', commissionStatus: 'reversed' },
      { ...paidOut, payout: null, paymentStatus: 'paid', commissionStatus: 'earned' },
    )
    assert.equal(created.length, 1)
  })

  it('creates nothing for a sale that was never paid out', async () => {
    const created = await run(
      { ...paidOut, payout: null, paymentStatus: 'refunded', commissionStatus: 'reversed' },
      { ...paidOut, payout: null, paymentStatus: 'paid', commissionStatus: 'earned' },
    )
    assert.equal(created.length, 0)
  })

  it('creates nothing on a later save of an already reversed sale (note edit)', async () => {
    const reversed = { ...paidOut, paymentStatus: 'refunded', commissionStatus: 'reversed' }
    assert.equal((await run(reversed, reversed)).length, 0)
  })

  it('creates nothing when an adjustment for the sale already exists', async () => {
    const created = await run(
      { ...paidOut, paymentStatus: 'refunded', commissionStatus: 'reversed' },
      { ...paidOut, paymentStatus: 'paid', commissionStatus: 'paid' },
      1,
    )
    assert.equal(created.length, 0)
  })

  it('creates nothing for a zero commission', async () => {
    const created = await run(
      { ...paidOut, commissionAmount: 0, paymentStatus: 'refunded', commissionStatus: 'reversed' },
      { ...paidOut, commissionAmount: 0, paymentStatus: 'paid', commissionStatus: 'paid' },
    )
    assert.equal(created.length, 0)
  })
})

/* ------------------------------ adjustment collection ------------------------------ */

describe('referral-commission-adjustments — locked ledger', () => {
  const original = { id: 1, sale: 50, partner: 7, amount: -1_830, reason: 'refundedAfterPayout', settledByPayout: null, note: null }
  const update = (data: Row, context: Row = {}) => () =>
    guardAdjustmentChanges({ operation: 'update', data, originalDoc: original, context } as unknown as AnyArgs)

  it('allows only the note to change', () => {
    update({ ...original, note: 'Avtalt med partner' })()
    assert.throws(update({ ...original, amount: -1 }), (e: Error) => e.message === ADJUSTMENT_LOCKED_MESSAGE)
    assert.throws(update({ ...original, sale: 51 }))
  })

  it('lets only the payout endpoint settle it', () => {
    assert.throws(update({ ...original, settledByPayout: 500 }))
    update({ ...original, settledByPayout: 500, settledAt: '2026-10-17T00:00:00.000Z' }, { [ADJUSTMENT_SETTLEMENT_CONTEXT]: true })()
  })

  it('compares a populated relationship by id', () => {
    update({ ...original, sale: { id: 50 }, partner: { id: 7, name: 'Ola' } })()
  })

  it('is never created by hand and never deleted', () => {
    const access = ReferralCommissionAdjustments.access!
    assert.equal((access.create as () => unknown)(), false)
    assert.equal((access.delete as () => unknown)(), false)
    assert.equal((access.read as (a: unknown) => unknown)({ req: { user: null } }), false)
  })

  it('allows one adjustment per sale (unique) and only negative amounts', () => {
    const fields = ReferralCommissionAdjustments.fields.flatMap((f) => ('fields' in f ? f.fields : [f])) as Row[]
    const sale = fields.find((f) => f.name === 'sale')!
    const amount = fields.find((f) => f.name === 'amount')!
    assert.equal(sale.unique, true)
    assert.equal(amount.max, 0)
  })
})

/* ------------------------------ payout source ------------------------------ */

describe('assignPayoutSource', () => {
  const create = (data: Row, context: Row = {}) =>
    assignPayoutSource({ operation: 'create', data, context } as unknown as AnyArgs) as Row

  it('labels a promo payout and still requires its promo code', () => {
    assert.equal(create({ promoCode: 7, amount: 10 }).source, 'promoCode')
    assert.throws(() => create({ amount: 10 }), /Rabattkode mangler/)
  })

  it('a client cannot turn a promo payout into a referral one without the endpoint', () => {
    assert.throws(
      () => create({ source: 'referral', referralSales: [11] }),
      (e: Error) => e instanceof APIError && e.message === REFERRAL_PAYOUT_ONLY_MESSAGE,
    )
  })

  it('accepts a referral payout from the endpoint, with sales and no promo code', () => {
    const ctx = { [REFERRAL_PAYOUT_CONTEXT]: true }
    assert.equal(create({ source: 'referral', promoCode: null, referralSales: [11] }, ctx).source, 'referral')
    assert.throws(() => create({ source: 'referral', promoCode: 7, referralSales: [11] }, ctx), /ingen rabattkode/)
    assert.throws(() => create({ source: 'referral', referralSales: [] }, ctx), /minst ett salg/)
  })

  it('does nothing on update', () => {
    const data = { note: 'x' }
    assert.equal(assignPayoutSource({ operation: 'update', data } as unknown as AnyArgs), data)
  })
})

describe('PartnerPayouts — referral fields are immutable, old rows read as promo payouts', () => {
  const guard = (PartnerPayouts.hooks!.beforeChange as ((a: unknown) => unknown)[])[0]
  const original = {
    id: 9,
    source: 'referral',
    promoCode: null,
    partner: 3,
    partnerNameSnapshot: 'Ola',
    amount: 1_500,
    payoutDate: '2026-10-17T00:00:00.000Z',
    paymentMethod: 'bankTransfer',
    referralSales: [11, 12],
    referralAdjustments: [1],
    referralGrossAmount: 1_830,
    referralDeductedAmount: 330,
    createdBy: 1,
  }
  const update = (data: Row, originalDoc: Row = original) => () => guard({ operation: 'update', data, originalDoc })

  for (const [field, value] of [
    ['source', 'promoCode'],
    ['referralSales', [11]],
    ['referralAdjustments', []],
    ['referralGrossAmount', 2_000],
    ['referralDeductedAmount', 0],
  ] as const) {
    it(`refuses changing ${field}`, () => {
      assert.throws(update({ ...original, [field]: value }), new RegExp(field))
    })
  }

  it('accepts the form resending populated relationships in another order', () => {
    update({ ...original, referralSales: [{ id: 12 }, { id: 11 }], referralAdjustments: [{ id: 1 }], note: 'x' })()
  })

  it('treats a legacy promo row (source NULL) as a promo payout — resending «promoCode» is no change', () => {
    const legacy = { id: 1, promoCode: 7, partnerNameSnapshot: 'Ola', amount: 30, payoutDate: '2026-07-20T00:00:00.000Z', paymentMethod: 'vipps', source: null }
    update({ ...legacy, source: 'promoCode', note: 'x' }, legacy)()
    update({ ...legacy, note: 'x' }, legacy)()
  })

  it('requires a promo code for a promo payout only', () => {
    const field = (PartnerPayouts.fields as Row[]).find((f) => f.name === 'promoCode') as { validate: (v: unknown, a: unknown) => unknown }
    assert.equal(field.validate(7, { data: {} }), true)
    assert.equal(field.validate(null, { data: { source: 'referral' } }), true)
    assert.match(String(field.validate(null, { data: { source: 'promoCode' } })), /Rabattkode mangler/)
    assert.match(String(field.validate(null, { data: {} })), /Rabattkode mangler/)
  })
})

/* ------------------------------ deleting a referral payout ------------------------------ */

describe('reverseReferralPayoutOnDelete', () => {
  function run(payout: Row | null, opts: { clawbacks?: number; sales?: Row[]; settled?: Row[] } = {}) {
    const updates: { collection: string; id: unknown; data: Row; context: Row }[] = []
    const req = {
      payload: {
        findByID: async () => payout,
        count: async () => ({ totalDocs: opts.clawbacks ?? 0 }),
        find: async ({ collection }: { collection: string }) => ({
          docs: collection === 'referral-sales' ? opts.sales ?? [] : opts.settled ?? [],
        }),
        update: async (args: { collection: string; id: unknown; data: Row; context: Row }) => {
          updates.push(args)
          return {}
        },
      },
    }
    return { promise: Promise.resolve(reverseReferralPayoutOnDelete({ id: 500, req } as unknown as AnyArgs)), updates }
  }

  it('ignores promo payouts entirely', async () => {
    const { promise, updates } = run({ id: 500, source: 'promoCode' }, { sales: [{ id: 11 }] })
    await promise
    assert.equal(updates.length, 0)
    const legacy = run({ id: 500, source: null }, { sales: [{ id: 11 }] })
    await legacy.promise
    assert.equal(legacy.updates.length, 0)
  })

  it('puts its sales back to unpaid and its adjustments back to outstanding', async () => {
    const { promise, updates } = run({ id: 500, source: 'referral' }, { sales: [{ id: 11 }, { id: 12 }], settled: [{ id: 1 }] })
    await promise
    assert.deepEqual(
      updates.map((u) => [u.collection, u.id, JSON.stringify(u.data)]),
      [
        ['referral-sales', 11, '{"payout":null}'],
        ['referral-sales', 12, '{"payout":null}'],
        ['referral-commission-adjustments', 1, '{"settledByPayout":null,"settledAt":null}'],
      ],
    )
    assert.equal(updates[0].context[REFERRAL_PAYOUT_CONTEXT], true)
    assert.equal(updates[2].context[ADJUSTMENT_SETTLEMENT_CONTEXT], true)
  })

  it('is refused once a sale it paid has a clawback against it', async () => {
    const { promise, updates } = run({ id: 500, source: 'referral' }, { clawbacks: 1, sales: [{ id: 11 }] })
    await assert.rejects(promise, (e: Error) => e instanceof APIError && e.message === PAYOUT_HAS_CLAWBACK_MESSAGE)
    assert.equal(updates.length, 0)
  })
})

/* ------------------------------ refund racing a payout ------------------------------ */

describe('referral sale — a refund reads the payout link under a row lock', () => {
  const paidSale = {
    id: 50,
    referredCustomer: 1,
    partner: 7,
    category: 'retailStore',
    saleDate: '2026-10-17T10:00:00.000Z',
    invoicedTotal: 12_500,
    vatTreatment: 'noVat',
    paymentStatus: 'paid',
    commissionStatus: 'earned',
    commissionAmount: 1_830,
    payout: null,
  }

  function run(data: Row, lockedPayoutId: number | null) {
    const queries: unknown[] = []
    const req = {
      user: { id: 42 },
      transactionID: 'tx-1',
      payload: {
        db: {
          sessions: {
            'tx-1': {
              db: {
                execute: async (query: unknown) => {
                  queries.push(query)
                  return { rows: [{ payout_id: lockedPayoutId }] }
                },
              },
            },
          },
        },
      },
      t: (key: string) => key,
    }
    return Promise.resolve(
      enforceReferralSaleRules({ operation: 'update', data, originalDoc: paidSale, req, context: {} } as unknown as AnyArgs),
    ).then(() => ({ data, queries }))
  }

  it('uses the committed payout link, so the refund is seen as a refund after payout', async () => {
    const { data, queries } = await run({ ...paidSale, paymentStatus: 'refunded' }, 500)
    assert.equal(queries.length, 1)
    assert.equal(data.payout, 500)
    assert.equal(data.commissionStatus, 'reversed')
  })

  it('refuses undoing «Betalt» when the locked row shows a payout', async () => {
    await assert.rejects(run({ ...paidSale, paymentStatus: 'pending' }, 500), (err: unknown) => {
      const errors = (err as { data?: { errors?: { path: string; message: string }[] } }).data?.errors ?? []
      assert.equal(errors[0]?.path, 'paymentStatus')
      assert.match(errors[0]?.message ?? '', /utbetalt/)
      return true
    })
  })

  it('takes no lock when the payment status does not change', async () => {
    const { queries } = await run({ ...paidSale, internalNote: 'x' }, 500)
    assert.equal(queries.length, 0)
  })
})
