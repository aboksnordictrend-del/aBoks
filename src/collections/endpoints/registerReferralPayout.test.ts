import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { createReferralPayoutHandler, registerReferralPayout, type ReferralPayoutDeps } from './registerReferralPayout'
import type { PayoutCandidateAdjustment, PayoutCandidateSale } from '@/lib/partner/referral'
import { REFERRAL_PAYOUT_CONTEXT } from '../hooks/referralSale'
import { ADJUSTMENT_SETTLEMENT_CONTEXT } from '../hooks/referralAdjustment'

/**
 * `POST /api/partner-payouts/register-referral` against stubbed locks and a stubbed Payload.
 *
 * The locks are where concurrency is decided, so the stub models them as a shared table: a payout
 * that commits marks its sales paid, and a second request reading the same table afterwards sees
 * that — exactly what `SELECT … FOR UPDATE` gives the second of two real transactions.
 */

type Row = Record<string, unknown>

const PARTNER = { id: 3, name: 'Ola Nordmann' }

const earned = (id: number, commissionOere: number, overrides: Partial<PayoutCandidateSale> = {}): PayoutCandidateSale => ({
  id,
  partnerId: 3,
  paymentStatus: 'paid',
  commissionStatus: 'earned',
  payoutId: null,
  commissionAmountOere: commissionOere,
  ...overrides,
})

interface World {
  sales: Map<number, PayoutCandidateSale>
  adjustments: Map<number, PayoutCandidateAdjustment & { settledBy: number | null }>
  payouts: Row[]
  updates: { collection: string; id: unknown; data: Row; context: Row }[]
  tx: { begun: number; committed: number; killed: number }
}

function world(sales: PayoutCandidateSale[], adjustments: PayoutCandidateAdjustment[] = []): World {
  return {
    sales: new Map(sales.map((s) => [s.id, { ...s }])),
    adjustments: new Map(adjustments.map((a) => [a.id, { ...a, settledBy: null }])),
    payouts: [],
    updates: [],
    tx: { begun: 0, committed: 0, killed: 0 },
  }
}

function setup(w: World, opts: { noTransaction?: boolean; createThrows?: boolean; updateThrows?: boolean; partner?: Row | null } = {}) {
  // Writes are staged and only applied to the shared world on commit, like a real transaction.
  let staged: (() => void)[] = []

  const deps: ReferralPayoutDeps = {
    initTransaction: async () => {
      w.tx.begun += 1
      staged = []
      return true
    },
    commitTransaction: async () => {
      w.tx.committed += 1
      staged.forEach((apply) => apply())
      staged = []
    },
    killTransaction: async () => {
      w.tx.killed += 1
      staged = []
    },
    lockSales: async (_req, ids) =>
      opts.noTransaction ? null : ids.flatMap((id) => (w.sales.has(id) ? [{ ...w.sales.get(id)! }] : [])),
    lockAdjustments: async (_req, partnerId) =>
      opts.noTransaction
        ? null
        : [...w.adjustments.values()]
            .filter((a) => a.settledBy == null && partnerId === 3)
            .map(({ id, amountOere }) => ({ id, amountOere })),
  }

  const payload = {
    findByID: async ({ collection, id }: { collection: string; id: unknown }) =>
      collection === 'partners' && String(id) === '3' ? (opts.partner === undefined ? PARTNER : opts.partner) : null,
    create: async ({ collection, data, context }: { collection: string; data: Row; context: Row }) => {
      if (opts.createThrows) throw new Error('insert failed')
      assert.equal(collection, 'partner-payouts')
      assert.equal(context[REFERRAL_PAYOUT_CONTEXT], true)
      const row = { id: 500 + w.payouts.length, ...data }
      staged.push(() => w.payouts.push(row))
      return row
    },
    update: async ({ collection, id, data, context }: { collection: string; id: number; data: Row; context: Row }) => {
      if (opts.updateThrows) throw new Error('update failed')
      w.updates.push({ collection, id, data, context })
      staged.push(() => {
        if (collection === 'referral-sales') {
          const sale = w.sales.get(id)!
          sale.payoutId = data.payout as number
          sale.commissionStatus = 'paid'
        } else {
          w.adjustments.get(id)!.settledBy = data.settledByPayout as number
        }
      })
      return { id }
    },
  }
  return { deps, payload }
}

async function call(w: World, body: Row, opts: Parameters<typeof setup>[1] & { user?: unknown } = {}) {
  const { deps, payload } = setup(w, opts)
  const req = {
    user: opts.user === undefined ? { id: 1, role: 'admin' } : opts.user,
    payload,
    json: async () => body,
  } as unknown as PayloadRequest
  const originalError = console.error
  console.error = () => {}
  try {
    const res = await createReferralPayoutHandler(deps)(req)
    return { res, body: (await res.json()) as Row }
  } finally {
    console.error = originalError
  }
}

const BODY = { partnerId: 3, saleIds: [11, 12], expectedAmount: 2_080, paymentMethod: 'bankTransfer', reference: 'BANK-9' }

/* ------------------------------ a valid payout ------------------------------ */

describe('registerReferralPayout — a valid payout', () => {
  it('pays the selected earned sales in one committed transaction', async () => {
    const w = world([earned(11, 183_000), earned(12, 25_000)])
    const { res, body } = await call(w, BODY)
    assert.equal(res.status, 200, JSON.stringify(body))
    assert.deepEqual(
      { amount: body.amount, gross: body.grossCommission, deducted: body.deducted, sales: body.saleCount },
      { amount: 2_080, gross: 2_080, deducted: 0, sales: 2 },
    )
    assert.deepEqual(w.tx, { begun: 1, committed: 1, killed: 0 })

    const payout = w.payouts[0]
    assert.equal(payout.source, 'referral')
    assert.equal(payout.promoCode, null)
    assert.equal(payout.partner, 3)
    assert.equal(payout.partnerNameSnapshot, 'Ola Nordmann')
    assert.equal(payout.amount, 2_080)
    assert.deepEqual(payout.referralSales, [11, 12])
    assert.equal(payout.createdBy, 1)
    assert.equal(payout.reference, 'BANK-9')

    assert.deepEqual(
      w.updates.map((u) => [u.collection, u.id, u.data.payout, u.context[REFERRAL_PAYOUT_CONTEXT]]),
      [
        ['referral-sales', 11, 500, true],
        ['referral-sales', 12, 500, true],
      ],
    )
    assert.equal(w.sales.get(11)!.commissionStatus, 'paid')
  })

  it('deducts every outstanding adjustment and settles each of them', async () => {
    const w = world([earned(11, 183_000)], [{ id: 1, amountOere: -30_000 }, { id: 2, amountOere: -3_000 }])
    const { res, body } = await call(w, { ...BODY, saleIds: [11], expectedAmount: 1_500 })
    assert.equal(res.status, 200, JSON.stringify(body))
    assert.equal(body.amount, 1_500)
    assert.equal(body.deducted, 330)
    assert.equal(w.payouts[0].referralGrossAmount, 1_830)
    assert.equal(w.payouts[0].referralDeductedAmount, 330)
    assert.deepEqual(w.payouts[0].referralAdjustments, [1, 2])
    const settlements = w.updates.filter((u) => u.collection === 'referral-commission-adjustments')
    assert.deepEqual(settlements.map((u) => u.id), [1, 2])
    assert.ok(settlements.every((u) => u.context[ADJUSTMENT_SETTLEMENT_CONTEXT] === true && u.data.settledByPayout === 500))
  })

  it('is mounted at /register-referral beside the unchanged promo endpoint', () => {
    assert.equal(registerReferralPayout.path, '/register-referral')
    assert.equal(registerReferralPayout.method, 'post')
  })
})

/* ------------------------------ no duplicate payouts ------------------------------ */

describe('registerReferralPayout — no duplicate payouts', () => {
  it('refuses the same selection a second time', async () => {
    const w = world([earned(11, 183_000), earned(12, 25_000)])
    assert.equal((await call(w, BODY)).res.status, 200)
    const second = await call(w, BODY)
    assert.equal(second.res.status, 409)
    assert.equal(second.body.code, 'sale_not_payable')
    assert.equal(w.payouts.length, 1)
    assert.equal(w.tx.killed, 1)
  })

  it('refuses an overlapping selection', async () => {
    const w = world([earned(11, 183_000), earned(12, 25_000), earned(13, 1_000)])
    await call(w, { ...BODY, saleIds: [11], expectedAmount: 1_830 })
    const overlap = await call(w, { ...BODY, saleIds: [11, 13], expectedAmount: 1_840 })
    assert.equal(overlap.body.code, 'sale_not_payable')
    assert.equal(w.payouts.length, 1)
  })

  it('never deducts an adjustment twice', async () => {
    const w = world([earned(11, 183_000), earned(12, 25_000)], [{ id: 1, amountOere: -30_000 }])
    await call(w, { ...BODY, saleIds: [11], expectedAmount: 1_530 })
    const next = await call(w, { ...BODY, saleIds: [12], expectedAmount: 250 })
    assert.equal(next.res.status, 200, JSON.stringify(next.body))
    assert.equal(next.body.deducted, 0)
    assert.deepEqual(w.payouts[1].referralAdjustments, [])
  })

  it('refuses a stale screen: the amount must match the locked rows exactly', async () => {
    const w = world([earned(11, 183_000)], [{ id: 1, amountOere: -30_000 }])
    const { res, body } = await call(w, { ...BODY, saleIds: [11], expectedAmount: 1_830 })
    assert.equal(res.status, 409)
    assert.equal(body.code, 'balance_changed')
    assert.match(String(body.error), /1530,00 kr/)
    assert.equal(w.payouts.length, 0)
  })
})

/* ------------------------------ refusals ------------------------------ */

describe('registerReferralPayout — refusals roll back and write nothing', () => {
  const refused = async (w: World, body: Row, code: string, status: number, opts = {}) => {
    const r = await call(w, body, opts)
    assert.equal(r.body.code, code, JSON.stringify(r.body))
    assert.equal(r.res.status, status)
    assert.equal(w.payouts.length, 0)
    assert.ok(w.sales.size === 0 || [...w.sales.values()].every((s) => s.payoutId == null))
    return r
  }

  it('a sale that is not paid, refunded, of another partner or missing', async () => {
    await refused(world([earned(11, 1_000, { paymentStatus: 'pending', commissionStatus: 'pending' })]), { ...BODY, saleIds: [11], expectedAmount: 10 }, 'sale_not_payable', 409)
    await refused(world([earned(11, 1_000, { paymentStatus: 'refunded', commissionStatus: 'reversed' })]), { ...BODY, saleIds: [11], expectedAmount: 10 }, 'sale_not_payable', 409)
    await refused(world([earned(11, 1_000, { partnerId: 4 })]), { ...BODY, saleIds: [11], expectedAmount: 10 }, 'sale_other_partner', 409)
    await refused(world([]), { ...BODY, saleIds: [11], expectedAmount: 10 }, 'sale_not_found', 404)
  })

  it('adjustments that would make the payout zero or negative', async () => {
    const w = world([earned(11, 10_000)], [{ id: 1, amountOere: -10_000 }])
    const r = await refused(w, { ...BODY, saleIds: [11], expectedAmount: 1 }, 'adjustments_exceed_selection', 409)
    assert.match(String(r.body.error), /Velg flere salg/)
    assert.equal(w.adjustments.get(1)!.settledBy, null, 'the adjustment stays outstanding')
  })

  it('no database transaction → refuses instead of writing unlocked', async () => {
    await refused(world([earned(11, 1_000)]), { ...BODY, saleIds: [11], expectedAmount: 10 }, 'transaction_unavailable', 503, { noTransaction: true })
  })

  it('a failed insert rolls everything back', async () => {
    const w = world([earned(11, 1_000)])
    await refused(w, { ...BODY, saleIds: [11], expectedAmount: 10 }, 'create_failed', 500, { createThrows: true })
    assert.equal(w.tx.killed, 1)
    assert.equal(w.tx.committed, 0)
  })

  it('a failed sale update rolls back the payout too', async () => {
    const w = world([earned(11, 1_000)])
    await refused(w, { ...BODY, saleIds: [11], expectedAmount: 10 }, 'create_failed', 500, { updateThrows: true })
    assert.equal(w.tx.committed, 0)
  })

  it('request-level problems', async () => {
    const w = world([earned(11, 1_000)])
    await refused(w, { ...BODY, saleIds: [11], expectedAmount: 10 }, 'unauthorized', 401, { user: null })
    await refused(w, { ...BODY, partnerId: 'x' }, 'invalid_body', 400)
    await refused(w, { ...BODY, saleIds: [] }, 'no_sales', 400)
    await refused(w, { ...BODY, saleIds: [11, 'x'] }, 'invalid_body', 400)
    await refused(w, { ...BODY, saleIds: [11, 11], expectedAmount: 20 }, 'duplicate_sales', 409)
    await refused(w, { ...BODY, saleIds: Array.from({ length: 201 }, (_, i) => i + 1) }, 'too_many_sales', 400)
    await refused(w, { ...BODY, expectedAmount: 0 }, 'invalid_amount', 400)
    await refused(w, { ...BODY, paymentMethod: 'cash' }, 'invalid_payment_method', 400)
    await refused(w, { ...BODY, payoutDate: 'not a date' }, 'invalid_payout_date', 400)
    await refused(w, { ...BODY, partnerId: 99 }, 'partner_not_found', 404)
    assert.equal(w.tx.begun, 1, 'only the duplicate-selection check reached the transaction')
  })

  it('never reads an amount from the request', async () => {
    const w = world([earned(11, 183_000)])
    const { body } = await call(w, { ...BODY, saleIds: [11], expectedAmount: 1_830, amount: 999_999, grossCommission: 999_999 })
    assert.equal(body.amount, 1_830)
    assert.equal(w.payouts[0].amount, 1_830)
  })
})

/* ------------------------------ an accounting record only ------------------------------ */

describe('registerReferralPayout — records a transfer, never makes one', () => {
  it('makes no network request of any kind while registering a payout', async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      throw new Error('a payout registration must never call out')
    }) as typeof fetch
    try {
      const w = world([earned(11, 183_000)])
      const { res } = await call(w, { ...BODY, saleIds: [11], expectedAmount: 1_830 })
      assert.equal(res.status, 200)
      assert.equal(calls, 0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('has no payment, bank or e-mail call in its source', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(process.cwd(), 'src/collections/endpoints/registerReferralPayout.ts'), 'utf8')
    assert.doesNotMatch(source, /\bfetch\(|sendEmail|kustom|klarna|vipps\.|stripe/i)
  })
})

describe('registerReferralPayout — payout date', () => {
  it('stores a date-only payout date at 12:00 UTC (same calendar day everywhere)', async () => {
    const w = world([earned(11, 1_000)])
    await call(w, { ...BODY, saleIds: [11], expectedAmount: 10, payoutDate: '2026-10-17' })
    assert.equal(w.payouts[0].payoutDate, '2026-10-17T12:00:00.000Z')
  })
})
