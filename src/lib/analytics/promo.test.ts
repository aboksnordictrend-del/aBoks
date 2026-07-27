import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePromoPerformance,
  type PromoCodeMeta,
  type PromoOrderInput,
  type PromoUsageInput,
} from './promo'

const ORDER: PromoOrderInput = {
  id: '55',
  orderNumber: 'AB-028412',
  status: 'confirmed',
  paidTotal: 473.1,
  promoCode: 'WELCOME10',
  date: '2026-07-20T10:00:00.000Z',
}

const USAGE: PromoUsageInput = {
  promoCodeId: '7',
  orderKey: 'kustom:7:kustom-abc-123',
  orderId: '55',
  orderNumber: 'AB-028412',
  kustomOrderId: 'kustom-abc-123',
  discountAmount: 44.9,
  usedAt: '2026-07-20T10:00:05.000Z',
}

const META: PromoCodeMeta = {
  id: '7',
  code: 'WELCOME10',
  active: true,
  discountType: 'percentage',
  discountValue: 10,
}

const rowFor = (result: ReturnType<typeof computePromoPerformance>, code: string) =>
  result.rows.find((r) => r.code === code)

describe('computePromoPerformance — counting', () => {
  it('counts one confirmed usage once', () => {
    const result = computePromoPerformance([USAGE], [ORDER], [META])
    assert.equal(result.rows.length, 1)
    const row = rowFor(result, 'WELCOME10')!
    assert.equal(row.uses, 1)
    assert.equal(row.discountGranted, 44.9)
    assert.equal(row.revenue, 473.1)
    assert.equal(row.averageOrderValue, 473.1)
  })

  it('counts a duplicated usage identity only once', () => {
    const result = computePromoPerformance([USAGE, { ...USAGE }], [ORDER], [META])
    assert.equal(rowFor(result, 'WELCOME10')?.uses, 1)
    assert.equal(rowFor(result, 'WELCOME10')?.revenue, 473.1)
  })

  it('ten duplicate deliveries still count once', () => {
    const usages = Array.from({ length: 10 }, () => ({ ...USAGE }))
    const result = computePromoPerformance(usages, [ORDER], [META])
    assert.equal(rowFor(result, 'WELCOME10')?.uses, 1)
    assert.equal(result.totalUses, 1)
    assert.equal(result.totalDiscount, 44.9)
  })

  it('counts genuinely distinct orders separately', () => {
    const second: PromoOrderInput = { ...ORDER, id: '56', orderNumber: 'AB-028413', paidTotal: 900 }
    const secondUsage: PromoUsageInput = {
      ...USAGE,
      orderId: '56',
      orderKey: 'kustom:7:kustom-def-456',
      discountAmount: 100,
    }
    const result = computePromoPerformance([USAGE, secondUsage], [ORDER, second], [META])
    const row = rowFor(result, 'WELCOME10')!
    assert.equal(row.uses, 2)
    assert.equal(row.discountGranted, 144.9)
    assert.equal(row.revenue, 1_373.1)
    assert.equal(row.averageOrderValue, 686.55)
  })

  it('deduplicates a legacy row with no orderKey by promo + order', () => {
    const legacy = { ...USAGE, orderKey: null }
    const result = computePromoPerformance([legacy, { ...legacy }], [ORDER], [META])
    assert.equal(rowFor(result, 'WELCOME10')?.uses, 1)
  })
})

describe('computePromoPerformance — order inclusion', () => {
  it('excludes a usage whose order is not in the period set', () => {
    // The order set is already filtered by status and period upstream; a pending or
    // cancelled order simply is not here, so its usage contributes nothing.
    const result = computePromoPerformance([USAGE], [], [META])
    assert.deepEqual(result.rows, [])
    assert.equal(result.totalUses, 0)
    assert.equal(result.revenueWithPromo, 0)
  })

  it('adds no revenue for an orphan usage with no resolvable order', () => {
    const orphan: PromoUsageInput = { ...USAGE, orderId: '999', orderKey: 'kustom:7:gone' }
    const result = computePromoPerformance([USAGE, orphan], [ORDER], [META])
    assert.equal(rowFor(result, 'WELCOME10')?.uses, 1)
    assert.equal(rowFor(result, 'WELCOME10')?.revenue, 473.1)
  })

  it('takes revenue from the stored paid order total, never from the discount', () => {
    const result = computePromoPerformance(
      [{ ...USAGE, discountAmount: 44.9 }],
      [{ ...ORDER, paidTotal: 473.1 }],
      [META],
    )
    assert.equal(rowFor(result, 'WELCOME10')?.revenue, 473.1)
  })

  it('reports the order status on the detail row', () => {
    const result = computePromoPerformance([USAGE], [{ ...ORDER, status: 'delivered' }], [META])
    assert.equal(rowFor(result, 'WELCOME10')?.usages[0].status, 'delivered')
  })
})

describe('computePromoPerformance — historical promos', () => {
  it('keeps reporting an inactive promo', () => {
    const result = computePromoPerformance([USAGE], [ORDER], [{ ...META, active: false }])
    const row = rowFor(result, 'WELCOME10')!
    assert.equal(row.active, false)
    assert.equal(row.exists, true)
    assert.equal(row.revenue, 473.1)
  })

  it('keeps reporting an expired promo', () => {
    const expired = { ...META, expiresAt: '2020-01-01T00:00:00.000Z' }
    const row = rowFor(computePromoPerformance([USAGE], [ORDER], [expired]), 'WELCOME10')!
    assert.equal(row.expiresAt, '2020-01-01T00:00:00.000Z')
    assert.equal(row.revenue, 473.1)
  })

  it('falls back to the order snapshot when the promo record was deleted', () => {
    const result = computePromoPerformance([USAGE], [ORDER], [])
    const row = rowFor(result, 'WELCOME10')!
    assert.equal(row.exists, false)
    assert.equal(row.code, 'WELCOME10')
    assert.equal(row.revenue, 473.1)
    assert.equal(row.discountGranted, 44.9)
  })

  it('never infers the historical discount from the current configuration', () => {
    // The record now says 50 %, but the stored usage says 44,90 — the snapshot wins.
    const changed = { ...META, discountValue: 50 }
    const row = rowFor(computePromoPerformance([USAGE], [ORDER], [changed]), 'WELCOME10')!
    assert.equal(row.discountGranted, 44.9)
    assert.equal(row.discountValue, 50, 'the current value is shown as a label only')
  })

  it('drops a usage with no resolvable code identity rather than inventing one', () => {
    const anonymous: PromoUsageInput = { ...USAGE, promoCodeId: null }
    const result = computePromoPerformance([anonymous], [{ ...ORDER, promoCode: undefined }], [])
    assert.deepEqual(result.rows, [])
  })

  it('reports both promo types correctly', () => {
    const fixed = { ...META, id: '8', code: 'ABOKS100', discountType: 'fixed', discountValue: 100 }
    const fixedUsage = { ...USAGE, promoCodeId: '8', orderKey: 'kustom:8:x', orderId: '56' }
    const order2 = { ...ORDER, id: '56', promoCode: 'ABOKS100' }
    const result = computePromoPerformance([USAGE, fixedUsage], [ORDER, order2], [META, fixed])
    assert.equal(rowFor(result, 'WELCOME10')?.discountType, 'percentage')
    assert.equal(rowFor(result, 'ABOKS100')?.discountType, 'fixed')
    assert.equal(rowFor(result, 'ABOKS100')?.discountValue, 100)
  })
})

describe('computePromoPerformance — output shape', () => {
  it('sorts deterministically by revenue, then uses, then code', () => {
    const codes: PromoCodeMeta[] = [
      META,
      { ...META, id: '8', code: 'AAA' },
      { ...META, id: '9', code: 'ZZZ' },
    ]
    const orders: PromoOrderInput[] = [
      ORDER,
      { ...ORDER, id: '56', paidTotal: 1_000, promoCode: 'AAA' },
      { ...ORDER, id: '57', paidTotal: 100, promoCode: 'ZZZ' },
    ]
    const usages: PromoUsageInput[] = [
      USAGE,
      { ...USAGE, promoCodeId: '8', orderId: '56', orderKey: 'k:8:1' },
      { ...USAGE, promoCodeId: '9', orderId: '57', orderKey: 'k:9:1' },
    ]
    const first = computePromoPerformance(usages, orders, codes).rows.map((r) => r.code)
    assert.deepEqual(first, ['AAA', 'WELCOME10', 'ZZZ'])
    // Same input, same order, every time — including with the input reshuffled.
    const shuffled = computePromoPerformance([...usages].reverse(), orders, codes).rows.map((r) => r.code)
    assert.deepEqual(shuffled, first)
  })

  it('reports first and last use', () => {
    const second: PromoUsageInput = {
      ...USAGE,
      orderId: '56',
      orderKey: 'k:7:2',
      usedAt: '2026-07-25T10:00:00.000Z',
    }
    const result = computePromoPerformance(
      [second, USAGE],
      [ORDER, { ...ORDER, id: '56' }],
      [META],
    )
    const row = rowFor(result, 'WELCOME10')!
    assert.equal(row.firstUsedAt, '2026-07-20T10:00:05.000Z')
    assert.equal(row.lastUsedAt, '2026-07-25T10:00:00.000Z')
    assert.equal(row.usages[0].usedAt, '2026-07-25T10:00:00.000Z', 'detail rows are newest first')
  })

  it('falls back to the order date when the usage has no timestamp', () => {
    const row = rowFor(
      computePromoPerformance([{ ...USAGE, usedAt: null }], [ORDER], [META]),
      'WELCOME10',
    )!
    assert.equal(row.usages[0].usedAt, ORDER.date)
  })

  it('returns zeroed totals for an empty period', () => {
    const result = computePromoPerformance([], [], [])
    assert.deepEqual(result, {
      rows: [],
      codesUsed: 0,
      totalUses: 0,
      totalDiscount: 0,
      revenueWithPromo: 0,
    })
  })

  it('contains no customer personal data', () => {
    const withEmail = { ...USAGE, email: 'kari@example.no' } as PromoUsageInput
    const result = computePromoPerformance([withEmail], [ORDER], [META])
    const serialised = JSON.stringify(result)
    for (const pii of ['kari@example.no', 'email', 'phone', 'address', 'Storgata']) {
      assert.ok(!serialised.includes(pii), `must not contain ${pii}`)
    }
  })

  it('never emits NaN or Infinity from malformed rows', () => {
    const malformed: PromoUsageInput = { ...USAGE, discountAmount: Number.NaN }
    const row = rowFor(
      computePromoPerformance([malformed], [{ ...ORDER, paidTotal: 0 }], [META]),
      'WELCOME10',
    )!
    assert.ok(Number.isFinite(row.discountGranted))
    assert.ok(Number.isFinite(row.revenue))
    assert.ok(Number.isFinite(row.averageOrderValue))
    assert.equal(row.averageOrderValue, 0)
  })
})
