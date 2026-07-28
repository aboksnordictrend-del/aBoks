import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { loadPartnerStatistics, type PartnerStatistics } from './statistics'

/**
 * Statistics are a presentation of the frozen Stage 4 accounting module, so these tests focus
 * on exactly that: that the displayed totals are the balance module's totals, that every row
 * is labelled with the right status, and that nothing unavailable is invented.
 */

/* ------------------------------ harness ------------------------------ */

const usage = (
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  isPartnerUsage: true,
  order: id,
  orderNumber: `AB-00000${id}`,
  usedAt: `2026-07-${String(10 + id).padStart(2, '0')}T10:00:00.000Z`,
  discountAmount: 44.9,
  orderAmountBeforeDiscount: 449,
  orderAmountAfterDiscount: 404.1,
  shippingAmount: 69,
  commissionAmount: 40.41,
  commissionRateSnapshot: 10,
  commissionBaseSnapshot: 'orderAfterDiscount',
  partnerNameSnapshot: 'Lokal testpartner',
  ...overrides,
})

/** A pre-Stage-3 row: no snapshot at all. */
const legacyUsage = (id: number) => ({
  id,
  isPartnerUsage: true,
  order: id,
  orderNumber: `AB-00000${id}`,
  usedAt: '2026-06-01T10:00:00.000Z',
  discountAmount: 30,
  orderAmountBeforeDiscount: null,
  orderAmountAfterDiscount: null,
  commissionAmount: null,
  commissionBaseSnapshot: null,
})

function stubPayload(opts: {
  usages?: Record<string, unknown>[]
  orders?: Record<string, unknown>[]
  payouts?: Record<string, unknown>[]
  throwOn?: string
}): { payload: Payload; queries: string[] } {
  const queries: string[] = []
  const payload = {
    find: async ({ collection }: { collection: string }) => {
      queries.push(collection)
      if (opts.throwOn === collection) throw new Error('connection terminated')
      if (collection === 'promo-code-usages') {
        const docs = opts.usages ?? []
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'orders') {
        const docs = opts.orders ?? []
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'partner-payouts') {
        const docs = opts.payouts ?? []
        return { docs, totalDocs: docs.length }
      }
      return { docs: [], totalDocs: 0 }
    },
  } as unknown as Payload
  return { payload, queries }
}

const load = (opts: Parameters<typeof stubPayload>[0]): Promise<PartnerStatistics> => {
  const { payload } = stubPayload(opts)
  return loadPartnerStatistics(payload, 7)
}

const rowFor = (stats: PartnerStatistics, id: number) =>
  stats.sales.find((r) => r.usageId === String(id))

/* ------------------------------ summary figures ------------------------------ */

describe('loadPartnerStatistics — summary figures', () => {
  it('reports uses, revenue, earned commission and outstanding balance', async () => {
    const stats = await load({
      usages: [usage(1), usage(2)],
      orders: [
        { id: 1, status: 'delivered' },
        { id: 2, status: 'shipped' },
      ],
      payouts: [{ id: 1, amount: 30, payoutDate: '2026-07-20T00:00:00.000Z', paymentMethod: 'vipps', reference: 'V-1' }],
    })

    assert.equal(stats.counts.valid, 2)
    assert.equal(stats.revenue, 808.2, 'Σ merchandise AFTER discount over included usages')
    assert.equal(stats.balance.earnedCommission, 80.82)
    assert.equal(stats.balance.paidAmount, 30)
    assert.equal(stats.balance.availableToPay, 50.82)
  })

  it('takes its money totals from the balance module, not from its own sums', async () => {
    // A cancelled order must not reach either the revenue card or the commission total.
    const stats = await load({
      usages: [usage(1), usage(2)],
      orders: [
        { id: 1, status: 'delivered' },
        { id: 2, status: 'cancelled' },
      ],
    })

    assert.equal(stats.balance.earnedCommission, 40.41)
    assert.equal(stats.revenue, 404.1, 'the cancelled order contributes no revenue either')
    assert.equal(stats.counts.valid, 1)
  })

  it('never reports a negative outstanding balance', async () => {
    const stats = await load({
      usages: [usage(1)],
      orders: [{ id: 1, status: 'confirmed' }],
      payouts: [{ id: 1, amount: 500 }],
    })

    assert.equal(stats.balance.availableToPay, 0)
  })

  it('sums revenue in integer øre, without floating-point drift', async () => {
    const stats = await load({
      usages: [
        usage(1, { orderAmountAfterDiscount: 0.1 }),
        usage(2, { orderAmountAfterDiscount: 0.2 }),
      ],
      orders: [
        { id: 1, status: 'confirmed' },
        { id: 2, status: 'confirmed' },
      ],
    })

    assert.equal(stats.revenue, 0.3)
  })
})

/* ------------------------------ zero / empty state ------------------------------ */

describe('loadPartnerStatistics — empty state', () => {
  it('returns zeroes and empty tables for a partner with no history', async () => {
    const stats = await load({})

    assert.equal(stats.counts.valid, 0)
    assert.equal(stats.revenue, 0)
    assert.equal(stats.balance.earnedCommission, 0)
    assert.equal(stats.balance.paidAmount, 0)
    assert.equal(stats.balance.availableToPay, 0)
    assert.deepEqual(stats.sales, [])
    assert.deepEqual(stats.payouts, [])
  })

  it('still reports zero cards when every usage is excluded', async () => {
    const stats = await load({
      usages: [usage(1)],
      orders: [{ id: 1, status: 'cancelled' }],
    })

    assert.equal(stats.balance.earnedCommission, 0)
    assert.equal(stats.revenue, 0)
    assert.equal(stats.counts.valid, 0)
    assert.equal(stats.sales.length, 1, 'the row is still listed')
  })
})

/* ------------------------------ row statuses ------------------------------ */

describe('loadPartnerStatistics — row statuses', () => {
  it('labels an included row with its order status', async () => {
    for (const status of ['confirmed', 'shipped', 'delivered']) {
      const stats = await load({ usages: [usage(1)], orders: [{ id: 1, status }] })
      const row = rowFor(stats, 1)
      assert.equal(row?.status, status)
      assert.equal(row?.counted, true)
    }
  })

  it('shows a cancelled order, with its snapshot, excluded from totals', async () => {
    const stats = await load({ usages: [usage(1)], orders: [{ id: 1, status: 'cancelled' }] })
    const row = rowFor(stats, 1)

    assert.equal(row?.status, 'cancelled')
    assert.equal(row?.counted, false)
    assert.equal(row?.commissionAmount, 40.41, 'the snapshot is still displayed')
    assert.equal(stats.counts.cancelled, 1)
    assert.equal(stats.balance.earnedCommission, 0)
  })

  it('shows a usage whose order no longer exists', async () => {
    const stats = await load({ usages: [usage(1, { order: 999 })], orders: [] })
    const row = rowFor(stats, 1)

    assert.equal(row?.status, 'order_missing')
    assert.equal(row?.counted, false)
    assert.equal(stats.counts.missingOrder, 1)
  })

  it('shows a usage with no order relationship at all', async () => {
    const stats = await load({ usages: [usage(1, { order: null })], orders: [] })

    assert.equal(rowFor(stats, 1)?.status, 'order_missing')
  })

  it('shows a legacy row with dashes instead of invented amounts', async () => {
    const stats = await load({ usages: [legacyUsage(1)], orders: [{ id: 1, status: 'delivered' }] })
    const row = rowFor(stats, 1)

    assert.equal(row?.status, 'legacy')
    assert.equal(row?.counted, false)
    assert.equal(row?.orderAmountBeforeDiscount, null)
    assert.equal(row?.commissionAmount, null)
    assert.equal(row?.commissionBasis, null)
    assert.equal(stats.counts.legacy, 1)
    assert.equal(stats.balance.earnedCommission, 0)
  })

  it('labels a pending order as excluded rather than cancelled', async () => {
    const stats = await load({ usages: [usage(1)], orders: [{ id: 1, status: 'pending' }] })

    assert.equal(rowFor(stats, 1)?.status, 'excluded')
    assert.equal(stats.counts.cancelled, 0)
  })

  it('counts each exclusion category separately', async () => {
    const stats = await load({
      usages: [usage(1), usage(2), usage(3, { order: 999 }), legacyUsage(4)],
      orders: [
        { id: 1, status: 'delivered' },
        { id: 2, status: 'cancelled' },
        { id: 4, status: 'delivered' },
      ],
    })

    assert.equal(stats.counts.valid, 1)
    assert.equal(stats.counts.excluded, 3)
    assert.equal(stats.counts.cancelled, 1)
    assert.equal(stats.counts.missingOrder, 1)
    assert.equal(stats.counts.legacy, 1)
  })
})

/* ------------------------------ commission basis ------------------------------ */

describe('loadPartnerStatistics — commission basis column', () => {
  it('uses the after-discount amount when that base was snapshotted', async () => {
    const stats = await load({ usages: [usage(1)], orders: [{ id: 1, status: 'delivered' }] })
    assert.equal(rowFor(stats, 1)?.commissionBasis, 404.1)
  })

  it('uses the before-discount amount when that base was snapshotted', async () => {
    const stats = await load({
      usages: [usage(1, { commissionBaseSnapshot: 'orderBeforeDiscount' })],
      orders: [{ id: 1, status: 'delivered' }],
    })
    assert.equal(rowFor(stats, 1)?.commissionBasis, 449)
  })

  it('reads the frozen snapshot, never the promo code current setting', async () => {
    // Two rows on the same code with different historical bases — both must keep their own.
    const stats = await load({
      usages: [usage(1), usage(2, { commissionBaseSnapshot: 'orderBeforeDiscount' })],
      orders: [
        { id: 1, status: 'delivered' },
        { id: 2, status: 'delivered' },
      ],
    })

    assert.equal(rowFor(stats, 1)?.commissionBasis, 404.1)
    assert.equal(rowFor(stats, 2)?.commissionBasis, 449)
  })
})

/* ------------------------------ payouts ------------------------------ */

describe('loadPartnerStatistics — payout rows', () => {
  it('maps the payout fields the table shows and nothing else', async () => {
    const stats = await load({
      payouts: [
        { id: 5, amount: 250, payoutDate: '2026-07-20T00:00:00.000Z', paymentMethod: 'bankTransfer', reference: 'B-1', note: 'internal' },
      ],
    })

    assert.deepEqual(stats.payouts, [
      { payoutId: '5', payoutDate: '2026-07-20T00:00:00.000Z', amount: 250, paymentMethod: 'bankTransfer', reference: 'B-1' },
    ])
  })

  it('tolerates a payout with no reference', async () => {
    const stats = await load({ payouts: [{ id: 5, amount: 10, payoutDate: null, paymentMethod: 'other' }] })

    assert.equal(stats.payouts[0].reference, null)
    assert.equal(stats.payouts[0].payoutDate, null)
  })
})

/* ------------------------------ privacy + queries ------------------------------ */

describe('loadPartnerStatistics — data hygiene', () => {
  it('exposes no customer data on a sales row', async () => {
    const stats = await load({
      usages: [usage(1, { email: 'kunde@example.no', kustomOrderId: 'kustom-secret' })],
      orders: [{ id: 1, status: 'delivered' }],
    })

    const serialized = JSON.stringify(stats.sales)
    for (const forbidden of ['example.no', 'kustom-secret', 'email', 'kustom']) {
      assert.equal(serialized.includes(forbidden), false, forbidden)
    }
  })

  it('issues exactly three queries and never one per row', async () => {
    const { payload, queries } = stubPayload({
      usages: [usage(1), usage(2), usage(3)],
      orders: [
        { id: 1, status: 'delivered' },
        { id: 2, status: 'delivered' },
        { id: 3, status: 'delivered' },
      ],
      payouts: [{ id: 1, amount: 10 }],
    })

    await loadPartnerStatistics(payload, 7)

    assert.deepEqual(queries, ['promo-code-usages', 'orders', 'partner-payouts'])
  })

  it('skips the orders query entirely when there is nothing to look up', async () => {
    const { payload, queries } = stubPayload({ usages: [] })
    await loadPartnerStatistics(payload, 7)

    assert.deepEqual(queries, ['promo-code-usages', 'partner-payouts'])
  })
})
