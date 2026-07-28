import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computePartnerBalance,
  parseAmountOere,
  type BalanceOrderInput,
  type BalancePayoutInput,
  type BalanceUsageInput,
  type UsageExclusionReason,
} from './balance'
import { isCommissionOrderStatus } from './orderStatus'

/* ------------------------------ fixtures ------------------------------ */

/** A complete, valid Stage 3 partner usage worth `commission` kroner on order `orderId`. */
function usage(
  id: number,
  commission: number,
  orderId: number | null = id,
  overrides: Partial<BalanceUsageInput> = {},
): BalanceUsageInput {
  return {
    id,
    isPartnerUsage: true,
    commissionAmount: commission,
    commissionBaseSnapshot: 'orderAfterDiscount',
    orderAmountAfterDiscount: 404.1,
    orderId,
    ...overrides,
  }
}

const order = (id: number, status: string): BalanceOrderInput => ({ id, status })
const payout = (id: number, amount: number | null): BalancePayoutInput => ({ id, amount })

const reasonFor = (
  result: ReturnType<typeof computePartnerBalance>,
  id: number,
): UsageExclusionReason | undefined =>
  result.excludedUsages.find((e) => e.id === String(id))?.reason

const compute = (
  usages: BalanceUsageInput[],
  orders: BalanceOrderInput[] = [],
  payouts: BalancePayoutInput[] = [],
) => computePartnerBalance({ usages, orders, payouts })

/* ------------------------------ 1. arithmetic ------------------------------ */

describe('computePartnerBalance — the three totals', () => {
  it('sums earned commission, payouts, and the remainder', () => {
    const result = compute(
      [usage(1, 40.41), usage(2, 44.9), usage(3, 12.5)],
      [order(1, 'confirmed'), order(2, 'shipped'), order(3, 'delivered')],
      [payout(1, 50), payout(2, 20)],
    )

    assert.equal(result.earnedCommission, 97.81)
    assert.equal(result.paidAmount, 70)
    assert.equal(result.availableToPay, 27.81)
    assert.equal(result.includedUsages, 3)
  })

  it('never reports a negative balance, even when overpaid', () => {
    const result = compute([usage(1, 40.41)], [order(1, 'confirmed')], [payout(1, 100)])

    assert.equal(result.earnedCommission, 40.41)
    assert.equal(result.paidAmount, 100)
    assert.equal(result.availableToPay, 0)
  })

  it('reports zeroes for a partner with no history at all', () => {
    const result = compute([], [], [])

    assert.equal(result.earnedCommission, 0)
    assert.equal(result.paidAmount, 0)
    assert.equal(result.availableToPay, 0)
    assert.deepEqual(result.excludedUsages, [])
  })

  it('exposes the same figures in integer øre', () => {
    const result = compute([usage(1, 40.41)], [order(1, 'confirmed')], [payout(1, 10.2)])

    assert.equal(result.earnedCommissionOere, 4_041)
    assert.equal(result.paidAmountOere, 1_020)
    assert.equal(result.availableToPayOere, 3_021)
  })
})

/* ------------------------------ 2–3. order statuses ------------------------------ */

describe('computePartnerBalance — order status decides whether commission counts', () => {
  it('includes confirmed, shipped and delivered', () => {
    for (const status of ['confirmed', 'shipped', 'delivered']) {
      const result = compute([usage(1, 40.41)], [order(1, status)])
      assert.equal(result.earnedCommission, 40.41, status)
      assert.equal(result.includedUsages, 1, status)
    }
  })

  it('excludes cancelled, pending and any unknown status', () => {
    for (const status of ['cancelled', 'pending', 'refunded', 'draft', '', 'CONFIRMED']) {
      const result = compute([usage(1, 40.41)], [order(1, status)])
      assert.equal(result.earnedCommission, 0, status)
      assert.equal(reasonFor(result, 1), 'order_status_excluded', status)
    }
  })

  it('counts the good orders and excludes the cancelled one from the same partner', () => {
    const result = compute(
      [usage(1, 40.41), usage(2, 44.9), usage(3, 30)],
      [order(1, 'delivered'), order(2, 'cancelled'), order(3, 'shipped')],
    )

    assert.equal(result.earnedCommission, 70.41)
    assert.equal(result.includedUsages, 2)
    assert.equal(reasonFor(result, 2), 'order_status_excluded')
  })

  it('recognises exactly the three allowed statuses', () => {
    assert.equal(isCommissionOrderStatus('confirmed'), true)
    assert.equal(isCommissionOrderStatus('shipped'), true)
    assert.equal(isCommissionOrderStatus('delivered'), true)
    for (const value of ['cancelled', 'pending', null, undefined, 1, {}]) {
      assert.equal(isCommissionOrderStatus(value), false)
    }
  })
})

/* ------------------------------ 4. missing order ------------------------------ */

describe('computePartnerBalance — a usage with no resolvable order', () => {
  it('excludes a usage whose order relationship is null', () => {
    const result = compute([usage(1, 40.41, null)], [])

    assert.equal(result.earnedCommission, 0)
    assert.equal(reasonFor(result, 1), 'order_missing')
  })

  it('excludes a usage whose order row no longer exists', () => {
    // The relationship still points at 99, but the orders query returned nothing for it.
    const result = compute([usage(1, 40.41, 99)], [order(1, 'confirmed')])

    assert.equal(result.earnedCommission, 0)
    assert.equal(reasonFor(result, 1), 'order_missing')
  })

  it('leaves the row itself untouched — exclusion is a reporting decision', () => {
    const row = usage(1, 40.41, null)
    const snapshot = JSON.stringify(row)

    compute([row], [])

    assert.equal(JSON.stringify(row), snapshot)
  })
})

/* ------------------------------ 5. legacy usages ------------------------------ */

describe('computePartnerBalance — legacy rows never contribute money', () => {
  it('excludes a row with no commission base snapshot', () => {
    const result = compute(
      [usage(1, 40.41, 1, { commissionBaseSnapshot: null })],
      [order(1, 'confirmed')],
    )

    assert.equal(result.earnedCommission, 0)
    assert.equal(reasonFor(result, 1), 'legacy_no_snapshot')
  })

  it('excludes a half-written row: a base but no money snapshot', () => {
    const result = compute(
      [usage(1, 40.41, 1, { orderAmountAfterDiscount: null })],
      [order(1, 'confirmed')],
    )

    assert.equal(result.earnedCommission, 0)
    assert.equal(reasonFor(result, 1), 'legacy_no_snapshot')
  })

  it('excludes a row whose base is not a value this system knows', () => {
    const result = compute(
      [usage(1, 40.41, 1, { commissionBaseSnapshot: 'orderPlusShipping' })],
      [order(1, 'confirmed')],
    )

    assert.equal(reasonFor(result, 1), 'legacy_no_snapshot')
  })

  it('still counts the valid rows alongside the legacy ones', () => {
    const result = compute(
      [usage(1, 40.41), usage(2, 99, 2, { commissionBaseSnapshot: null })],
      [order(1, 'confirmed'), order(2, 'delivered')],
    )

    assert.equal(result.earnedCommission, 40.41)
    assert.equal(result.includedUsages, 1)
    assert.equal(result.excludedUsages.length, 1)
  })
})

/* ------------------------------ 6. non-partner usages ------------------------------ */

describe('computePartnerBalance — ordinary usages earn nothing', () => {
  it('excludes a usage flagged as non-partner, whatever its commission says', () => {
    const result = compute(
      [usage(1, 40.41, 1, { isPartnerUsage: false })],
      [order(1, 'confirmed')],
    )

    assert.equal(result.earnedCommission, 0)
    assert.equal(reasonFor(result, 1), 'not_partner_usage')
  })

  it('excludes a usage with no partner flag at all', () => {
    for (const isPartnerUsage of [null, undefined]) {
      const result = compute([usage(1, 40.41, 1, { isPartnerUsage })], [order(1, 'confirmed')])
      assert.equal(reasonFor(result, 1), 'not_partner_usage')
    }
  })

  it('is checked before anything else, so history cannot be reclassified later', () => {
    // A code converted from ordinary to partner does not retroactively earn: the SNAPSHOT
    // flag on the old row is what decides, not the promo code's current configuration.
    const result = compute(
      [usage(1, 0, 1, { isPartnerUsage: false }), usage(2, 40.41)],
      [order(1, 'delivered'), order(2, 'delivered')],
    )

    assert.equal(result.earnedCommission, 40.41)
    assert.equal(result.includedUsages, 1)
  })
})

/* ------------------------------ 7. invalid stored money ------------------------------ */

describe('computePartnerBalance — unusable stored values fail closed', () => {
  it('excludes a usage whose commission is negative, NaN or not a number', () => {
    for (const commissionAmount of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = compute(
        [usage(1, 0, 1, { commissionAmount })],
        [order(1, 'confirmed')],
      )
      assert.equal(result.earnedCommission, 0, String(commissionAmount))
      assert.equal(reasonFor(result, 1), 'invalid_amount', String(commissionAmount))
    }
  })

  it('excludes a usage with a null commission', () => {
    const result = compute([usage(1, 0, 1, { commissionAmount: null })], [order(1, 'confirmed')])
    assert.equal(reasonFor(result, 1), 'invalid_amount')
  })

  it('counts a genuine zero commission as an included, earning-nothing usage', () => {
    // A partner code configured at 0 % is valid, not corrupt.
    const result = compute([usage(1, 0)], [order(1, 'confirmed')])

    assert.equal(result.includedUsages, 1)
    assert.deepEqual(result.excludedUsages, [])
    assert.equal(result.earnedCommission, 0)
  })

  it('flags an unreadable payout instead of quietly treating it as zero', () => {
    const result = compute(
      [usage(1, 100)],
      [order(1, 'confirmed')],
      [payout(1, 30), payout(2, null), payout(3, Number.NaN)],
    )

    assert.equal(result.hasUnreadablePayout, true)
    assert.deepEqual(result.unreadablePayouts, ['2', '3'])
    // The readable ones still count; the figure is a lower bound and the endpoint refuses.
    assert.equal(result.paidAmount, 30)
  })

  it('reports no unreadable payouts in the normal case', () => {
    const result = compute([usage(1, 100)], [order(1, 'confirmed')], [payout(1, 30)])

    assert.equal(result.hasUnreadablePayout, false)
    assert.deepEqual(result.unreadablePayouts, [])
  })
})

/* ------------------------------ 8–9. partial and full payouts ------------------------------ */

describe('computePartnerBalance — payout progression', () => {
  const earned = () => compute([usage(1, 100)], [order(1, 'confirmed')])

  it('a partial payout leaves the correct remainder', () => {
    const result = compute([usage(1, 100)], [order(1, 'confirmed')], [payout(1, 40)])

    assert.equal(result.paidAmount, 40)
    assert.equal(result.availableToPay, 60)
  })

  it('a full payout brings the balance to exactly zero', () => {
    const result = compute([usage(1, 100)], [order(1, 'confirmed')], [payout(1, 100)])

    assert.equal(result.availableToPay, 0)
  })

  it('several payouts accumulate correctly', () => {
    const result = compute(
      [usage(1, 100)],
      [order(1, 'confirmed')],
      [payout(1, 25), payout(2, 25), payout(3, 30)],
    )

    assert.equal(result.paidAmount, 80)
    assert.equal(result.availableToPay, 20)
  })

  it('starts with the whole commission available', () => {
    assert.equal(earned().availableToPay, 100)
  })

  it('a cancelled order after payout can leave the balance at zero, never negative', () => {
    // The partner was paid, then the order was cancelled. History is untouched; the balance
    // simply stops offering anything further.
    const result = compute([usage(1, 100)], [order(1, 'cancelled')], [payout(1, 100)])

    assert.equal(result.earnedCommission, 0)
    assert.equal(result.paidAmount, 100)
    assert.equal(result.availableToPay, 0)
  })
})

/* ------------------------------ 21. money conversion ------------------------------ */

describe('computePartnerBalance — integer øre arithmetic', () => {
  it('sums many awkward decimals without floating-point drift', () => {
    // 0.1 + 0.2 in floating point is 0.30000000000000004; three of these must be exactly 0,60.
    const result = compute(
      [usage(1, 0.1), usage(2, 0.2), usage(3, 0.3)],
      [order(1, 'confirmed'), order(2, 'confirmed'), order(3, 'confirmed')],
    )

    assert.equal(result.earnedCommissionOere, 60)
    assert.equal(result.earnedCommission, 0.6)
  })

  it('a hundred identical commissions sum exactly', () => {
    const usages = Array.from({ length: 100 }, (_, i) => usage(i + 1, 40.41, i + 1))
    const orders = usages.map((u) => order(u.id as number, 'delivered'))

    const result = computePartnerBalance({ usages, orders, payouts: [] })

    assert.equal(result.earnedCommissionOere, 404_100)
    assert.equal(result.earnedCommission, 4_041)
  })

  it('keeps the remainder exact when payouts are awkward too', () => {
    const result = compute(
      [usage(1, 40.41), usage(2, 0.1)],
      [order(1, 'confirmed'), order(2, 'confirmed')],
      [payout(1, 0.2), payout(2, 0.1)],
    )

    assert.equal(result.earnedCommissionOere, 4_051)
    assert.equal(result.paidAmountOere, 30)
    assert.equal(result.availableToPay, 40.21)
  })
})

/* ------------------------------ amount parsing ------------------------------ */

describe('parseAmountOere', () => {
  it('converts kroner to whole øre', () => {
    assert.equal(parseAmountOere(250), 25_000)
    assert.equal(parseAmountOere(40.41), 4_041)
    assert.equal(parseAmountOere(0.01), 1)
    assert.equal(parseAmountOere(0), 0)
  })

  it('accepts a plain decimal string, as a JSON body may carry', () => {
    assert.equal(parseAmountOere('250'), 25_000)
    assert.equal(parseAmountOere('250.00'), 25_000)
    assert.equal(parseAmountOere(' 40.41 '), 4_041)
  })

  it('rounds sub-øre precision with the project conversion step', () => {
    assert.equal(parseAmountOere(12.345), 1_235)
    assert.equal(parseAmountOere(0.004), 0)
  })

  it('preserves the sign so the caller can reject it explicitly', () => {
    assert.equal(parseAmountOere(-5), -500)
  })

  it('refuses anything that is not plain money', () => {
    for (const value of [
      null, undefined, '', '   ', 'abc', '1e5', '0x10', '1,5', '250 kr',
      true, {}, [], Number.NaN, Number.POSITIVE_INFINITY,
    ]) {
      assert.equal(parseAmountOere(value), null, JSON.stringify(value) ?? String(value))
    }
  })

  it('never drifts: 0,1 + 0,2 as two amounts is exactly 30 øre', () => {
    assert.equal((parseAmountOere(0.1) as number) + (parseAmountOere(0.2) as number), 30)
  })
})
