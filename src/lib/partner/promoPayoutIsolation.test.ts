import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload, PayloadRequest } from 'payload'
import { loadPartnerBalance } from './balanceQuery'
import { loadPartnerStatistics } from './statistics'
import { registerPartnerPayout } from '@/collections/endpoints/registerPartnerPayout'
import { PartnerPayouts } from '@/collections/PartnerPayouts'

/**
 * Regression suite: promo-code payout accounting is isolated from referral payouts.
 *
 * Written BEFORE `partner-payouts.promoCode` became optional (referral payouts, Stage 4), and kept
 * as the guard that it stays true. The stub database below applies the `where` it receives
 * honestly, so a referral payout row — no promo code, same partner — sits next to the promo rows
 * exactly as it will in production. Every promo figure must ignore it.
 */

/* ------------------------------ an honest stub database ------------------------------ */

type Row = Record<string, unknown>

const idOf = (value: unknown) =>
  value && typeof value === 'object' ? String((value as { id?: unknown }).id) : value == null ? null : String(value)

/** The subset of Payload's `where` the promo accounting uses: `equals` and `in`, combined with `and`. */
function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return (condition as Row[]).every((w) => matches(row, w))
    const c = condition as { equals?: unknown; in?: unknown[] }
    const value = row[field]
    if ('equals' in c) return c.equals == null ? value == null : idOf(value) === String(c.equals)
    if ('in' in c) return (c.in ?? []).map(String).includes(String(idOf(value)))
    throw new Error(`stub does not understand ${field}: ${JSON.stringify(condition)}`)
  })
}

const PROMO = { id: 7, code: 'OLA15', isPartnerCode: true, partnerName: 'Ola', partner: 3 }

const USAGE = {
  id: 1,
  promoCode: 7,
  isPartnerUsage: true,
  commissionAmount: 100,
  commissionBaseSnapshot: 'orderAfterDiscount',
  orderAmountAfterDiscount: 666.67,
  orderAmountBeforeDiscount: 740.74,
  discountAmount: 74.07,
  order: 1,
}

/** One promo payout of 30 kr on code 7, and a referral payout of 5 000 kr to the SAME partner. */
const PAYOUTS: Row[] = [
  { id: 1, promoCode: 7, partner: 3, amount: 30, payoutDate: '2026-10-01T00:00:00.000Z', paymentMethod: 'vipps', source: null },
  {
    id: 2,
    promoCode: null,
    partner: 3,
    amount: 5_000,
    payoutDate: '2026-10-02T00:00:00.000Z',
    paymentMethod: 'bankTransfer',
    source: 'referral',
    referralSales: [11, 12],
  },
]

function database() {
  const tables: Record<string, Row[]> = {
    'promo-code-usages': [USAGE],
    orders: [{ id: 1, status: 'delivered' }],
    'partner-payouts': PAYOUTS.map((p) => ({ ...p })),
  }
  const payoutQueries: unknown[] = []
  const payload = {
    find: async ({ collection, where }: { collection: string; where?: Row }) => {
      if (collection === 'partner-payouts') payoutQueries.push(where)
      const docs = (tables[collection] ?? []).filter((row) => matches(row, where))
      return { docs, totalDocs: docs.length }
    },
    findByID: async ({ collection, id }: { collection: string; id: unknown }) => {
      if (collection === 'promo-codes' && String(id) === '7') return PROMO
      if (collection === 'partners' && String(id) === '3') return { id: 3, name: 'Ola', email: null }
      return null
    },
    create: async ({ collection, data }: { collection: string; data: Row }) => {
      if (collection !== 'partner-payouts') throw new Error(`unexpected write to ${collection}`)
      const row = { id: 100 + tables[collection].length, ...data }
      tables[collection].push(row)
      return row
    },
    sendEmail: async () => ({}),
  }
  return { payload: payload as unknown as Payload, tables, payoutQueries }
}

/* ------------------------------ balance ------------------------------ */

describe('promo payout isolation — balance', () => {
  it('counts only payouts of this promo code, never a referral payout to the same partner', async () => {
    const { payload, payoutQueries } = database()
    const balance = await loadPartnerBalance(payload, 7)
    assert.equal(balance.earnedCommission, 100)
    assert.equal(balance.paidAmount, 30, 'the 5 000 kr referral payout must not count')
    assert.equal(balance.availableToPay, 70)
    assert.deepEqual(payoutQueries, [{ promoCode: { equals: 7 } }])
  })
})

/* ------------------------------ statistics ------------------------------ */

describe('promo payout isolation — Partnerstatistikk', () => {
  it('lists and sums only this code’s payouts', async () => {
    const { payload, payoutQueries } = database()
    const stats = await loadPartnerStatistics(payload, 7)
    assert.equal(stats.balance.paidAmount, 30)
    assert.equal(stats.payouts.length, 1)
    assert.equal(stats.payouts[0].payoutId, '1')
    assert.deepEqual(payoutQueries, [{ promoCode: { equals: 7 } }])
  })
})

/* ------------------------------ promo payout endpoint ------------------------------ */

async function callPromoEndpoint(payload: Payload, body: Row) {
  const req = { user: { id: 1, role: 'admin' }, payload, json: async () => body } as unknown as PayloadRequest
  const originalError = console.error
  console.error = () => {}
  try {
    const res = await registerPartnerPayout.handler(req)
    return { res, body: (await res.json()) as Row }
  } finally {
    console.error = originalError
  }
}

describe('promo payout isolation — POST /api/partner-payouts/register', () => {
  it('pays exactly the promo balance, unaffected by referral payouts', async () => {
    const { payload, tables } = database()
    const { res, body } = await callPromoEndpoint(payload, {
      promoCodeId: 7,
      amount: 70,
      paymentMethod: 'bankTransfer',
      expectFullBalance: true,
    })
    assert.equal(res.status, 200, JSON.stringify(body))
    assert.equal(body.availableToPay, 0)
    assert.equal(body.paidAmount, 100)

    const created = tables['partner-payouts'].at(-1)!
    assert.equal(created.promoCode, 7)
    assert.equal(created.partner, 3)
    assert.equal(created.amount, 70)
    assert.equal('referralSales' in created, false, 'the promo endpoint never writes referral fields')
  })

  it('still refuses more than the promo balance, however much referral commission exists', async () => {
    const { payload } = database()
    const { res, body } = await callPromoEndpoint(payload, { promoCodeId: 7, amount: 70.01, paymentMethod: 'vipps' })
    assert.equal(res.status, 409)
    assert.equal(body.code, 'amount_exceeds_balance')
  })
})

/* ------------------------------ collection ------------------------------ */

describe('promo payout isolation — PartnerPayouts collection', () => {
  const field = (name: string) =>
    (PartnerPayouts.fields as { name?: string; filterOptions?: unknown; admin?: { readOnly?: boolean } }[]).find(
      (f) => f.name === name,
    )

  it('keeps the promo endpoint and closed create access', () => {
    assert.ok(PartnerPayouts.endpoints && PartnerPayouts.endpoints.some((e) => e.path === '/register' && e.method === 'post'))
    assert.equal((PartnerPayouts.access!.create as () => unknown)(), false)
  })

  it('keeps the promo-code field read-only and limited to partner codes', () => {
    const promo = field('promoCode')!
    assert.equal(promo.admin?.readOnly, true)
    assert.deepEqual((promo.filterOptions as () => unknown)(), { isPartnerCode: { equals: true } })
  })
})
