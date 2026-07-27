import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import type { KustomOrder } from '@/lib/kustom'
import { buildKustomMerchantData, type TrustedPromoSnapshot } from './kustomMerchantData'
import {
  isUniqueViolation,
  registerPromoUsageOnce,
  usageKustomOrderKey,
  type RegisterUsageResult,
} from './usageRegistration'
import { resolvePromoSnapshot, restorePromoSnapshotPatch } from './webhookPromo'

/* ------------------------------ fixtures ------------------------------ */

const SNAPSHOT: TrustedPromoSnapshot = {
  code: 'WELCOME10',
  promoCodeId: '7',
  type: 'percentage',
  value: 10,
  discountAmountOere: 4_490,
  subtotalBeforeDiscountOere: 44_900,
  shippingOere: 6_900,
  totalAfterDiscountOere: 47_310,
}

function kustomOrder(overrides: Partial<KustomOrder> = {}, promo: TrustedPromoSnapshot | null = SNAPSHOT): KustomOrder {
  return {
    order_id: 'kustom-abc-123',
    status: 'checkout_complete',
    purchase_country: 'NO',
    purchase_currency: 'NOK',
    locale: 'nb-NO',
    order_amount: 47_310,
    order_tax_amount: 9_462,
    merchant_reference: 'AB-028412',
    merchant_data: buildKustomMerchantData(promo),
    order_lines: [
      {
        type: 'physical',
        reference: '10',
        name: 'aBoks Vegg – Mørk blå',
        quantity: 1,
        quantity_unit: 'pcs',
        unit_price: 44_900,
        tax_rate: 2_500,
        total_amount: 40_410,
        total_discount_amount: 4_490,
        total_tax_amount: 8_082,
      },
      {
        type: 'shipping_fee',
        reference: 'FRAKT-STD',
        name: 'Frakt',
        quantity: 1,
        quantity_unit: 'pcs',
        unit_price: 6_900,
        tax_rate: 2_500,
        total_amount: 6_900,
        total_discount_amount: 0,
        total_tax_amount: 1_380,
      },
    ],
    ...overrides,
  } as KustomOrder
}

/** An order with no promo at all: no merchant_data, no line discounts. */
const undiscountedOrder = () =>
  kustomOrder(
    {
      order_amount: 51_800,
      order_lines: [
        {
          type: 'physical',
          reference: '10',
          name: 'aBoks Vegg – Mørk blå',
          quantity: 1,
          quantity_unit: 'pcs',
          unit_price: 44_900,
          tax_rate: 2_500,
          total_amount: 44_900,
          total_discount_amount: 0,
          total_tax_amount: 8_980,
        },
      ],
    } as Partial<KustomOrder>,
    null,
  )

class UniqueViolationError extends Error {
  code = '23505'
  constructor() {
    super('duplicate key value violates unique constraint "promo_code_usages_order_key_idx"')
  }
}

interface Harness {
  payload: Payload
  usages: Record<string, unknown>[]
  logs: Record<string, unknown>[]
  deps: { payload: Payload; log: (f: Record<string, unknown>) => void }
}

function harness(
  opts: {
    promo?: { id: number; code: string; usageMode?: string; maxUses?: number } | null
    findThrows?: boolean
    createThrows?: Error
    promoLookupThrows?: boolean
    /** Simulates the unique index: a second insert with the same orderKey fails. */
    enforceUnique?: boolean
  } = {},
): Harness {
  const usages: Record<string, unknown>[] = []
  const logs: Record<string, unknown>[] = []
  const promoDoc = opts.promo === undefined ? { id: 7, code: 'WELCOME10', usageMode: 'unlimited' } : opts.promo

  const payload = {
    findByID: async ({ collection }: { collection: string }) => {
      if (collection === 'promo-codes') {
        if (opts.promoLookupThrows) throw new Error('connection terminated')
        return promoDoc ?? null
      }
      return null
    },
    find: async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      if (collection !== 'promo-code-usages') return { docs: [], totalDocs: 0 }
      if (opts.findThrows) throw new Error('connection terminated unexpectedly')
      const key = where?.orderKey?.equals
      const docs = usages.filter((u) => u.orderKey === key)
      return { docs, totalDocs: docs.length }
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection !== 'promo-code-usages') throw new Error(`unexpected write to ${collection}`)
      if (opts.createThrows) throw opts.createThrows
      if (opts.enforceUnique && usages.some((u) => u.orderKey === data.orderKey)) {
        throw new UniqueViolationError()
      }
      const row = { id: usages.length + 1, ...data }
      usages.push(row)
      return row
    },
    logger: { warn: () => {}, error: () => {} },
  } as unknown as Payload

  return { payload, usages, logs, deps: { payload, log: (f) => logs.push(f) } }
}

const ORDER = { id: 55, orderNumber: 'AB-028412' }

const expectStatus = (result: RegisterUsageResult, status: RegisterUsageResult['status']) => {
  assert.equal(result.status, status)
  return result
}

/* ------------------------------ happy path ------------------------------ */

describe('registerPromoUsageOnce — confirmed paid order', () => {
  it('creates exactly one usage row with the right values', async () => {
    const h = harness()
    const result = expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'created',
    )
    assert.equal(result.status === 'created' && result.usageId, '1')

    assert.equal(h.usages.length, 1)
    const usage = h.usages[0]
    assert.equal(usage.promoCode, 7)
    assert.equal(usage.order, 55)
    assert.equal(usage.orderNumber, 'AB-028412')
    assert.equal(usage.discountAmount, 44.9, 'the discount actually paid')
    assert.equal(usage.currency, 'NOK')
    assert.equal(usage.kustomOrderId, 'kustom-abc-123')
    assert.equal(usage.orderKey, 'kustom:7:kustom-abc-123')
    assert.equal(usage.uniquenessKey, null, 'reusable codes are unconstrained')
    assert.equal(usage.email, null, 'no customer address is copied into the audit table')
    assert.ok(typeof usage.usedAt === 'string')
  })

  it('uses a stable identity derived from the Kustom order id', () => {
    assert.equal(usageKustomOrderKey('7', 'kustom-abc-123'), 'kustom:7:kustom-abc-123')
    assert.equal(usageKustomOrderKey(7, 'kustom-abc-123'), 'kustom:7:kustom-abc-123')
  })
})

/* ------------------------------ nothing to register ------------------------------ */

describe('registerPromoUsageOnce — not applicable', () => {
  const notApplicable = async (
    h: Harness,
    order: KustomOrder,
    reason: string,
    localOrder: Parameters<typeof registerPromoUsageOnce>[1]['order'] = ORDER,
  ) => {
    const result = await registerPromoUsageOnce(h.deps, { kustomOrder: order, order: localOrder })
    assert.equal(result.status, 'not_applicable')
    if (result.status !== 'not_applicable') throw new Error('unreachable')
    assert.equal(result.reason, reason)
    assert.deepEqual(h.usages, [], 'nothing may be written')
    return result
  }

  it('registers nothing for an order with no promo', async () => {
    await notApplicable(harness(), undiscountedOrder(), 'no_merchant_data')
  })

  it('registers nothing when merchant_data is missing but lines were discounted', async () => {
    // Money is preserved elsewhere; the identity is simply unavailable, so never invent one.
    const order = kustomOrder({ merchant_data: undefined }, null)
    await notApplicable(harness(), order, 'discounted_without_promo_identity')
  })

  it('registers nothing for corrupt merchant_data', async () => {
    await notApplicable(harness(), kustomOrder({ merchant_data: '{ broken' }), 'invalid_merchant_data')
  })

  it('registers nothing when merchant_data disagrees with the paid amounts', async () => {
    const order = kustomOrder({}, { ...SNAPSHOT, discountAmountOere: 9_999, totalAfterDiscountOere: 41_801 })
    await notApplicable(harness(), order, 'cross_check_failed')
  })

  it('registers nothing when merchant_data claims a promo but no line was discounted', async () => {
    const order = kustomOrder(
      {
        order_amount: 51_800,
        order_lines: [
          {
            type: 'physical', reference: '10', name: 'x', quantity: 1, quantity_unit: 'pcs',
            unit_price: 44_900, tax_rate: 2_500, total_amount: 44_900,
            total_discount_amount: 0, total_tax_amount: 8_980,
          },
        ],
      } as Partial<KustomOrder>,
      SNAPSHOT,
    )
    await notApplicable(harness(), order, 'cross_check_failed')
  })

  it('registers nothing when the promo record no longer exists', async () => {
    await notApplicable(harness({ promo: null }), kustomOrder(), 'promo_not_found')
  })

  it('registers nothing when the id no longer names that code', async () => {
    const h = harness({ promo: { id: 7, code: 'SOMETHINGELSE', usageMode: 'unlimited' } })
    await notApplicable(h, kustomOrder(), 'promo_identity_mismatch')
  })

  it('registers nothing for a promo whose mode is unsupported at launch', async () => {
    for (const mode of ['single_use_global', 'limited', 'once_per_customer']) {
      const h = harness({ promo: { id: 7, code: 'WELCOME10', usageMode: mode, maxUses: 5 } })
      await notApplicable(h, kustomOrder(), 'promo_unsupported')
    }
  })

  it('registers nothing when the order already names a different code', async () => {
    const h = harness()
    await notApplicable(h, kustomOrder(), 'order_promo_conflict', {
      ...ORDER,
      discount: { code: 'SOMMER20' },
    })
    assert.ok(
      h.logs.some((l) => l.event === 'integrity-conflict'),
      'a conflict must be surfaced, not silently ignored',
    )
  })

  it('accepts an order whose stored code matches', async () => {
    const h = harness()
    expectStatus(
      await registerPromoUsageOnce(h.deps, {
        kustomOrder: kustomOrder(),
        order: { ...ORDER, discount: { code: 'welcome10' } },
      }),
      'created',
    )
  })
})

/* ------------------------------ idempotency ------------------------------ */

describe('registerPromoUsageOnce — duplicate webhooks', () => {
  it('a second delivery does not create a second usage', async () => {
    const h = harness({ enforceUnique: true })
    const order = kustomOrder()

    expectStatus(await registerPromoUsageOnce(h.deps, { kustomOrder: order, order: ORDER }), 'created')
    expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: order, order: ORDER }),
      'already_registered',
    )
    assert.equal(h.usages.length, 1)
  })

  it('ten deliveries still leave exactly one usage', async () => {
    const h = harness({ enforceUnique: true })
    const order = kustomOrder()
    const results: string[] = []
    for (let i = 0; i < 10; i++) {
      results.push((await registerPromoUsageOnce(h.deps, { kustomOrder: order, order: ORDER })).status)
    }
    assert.equal(h.usages.length, 1)
    assert.equal(results[0], 'created')
    assert.ok(results.slice(1).every((s) => s === 'already_registered'))
  })

  it('a duplicate that slips past the read is caught by the unique index', async () => {
    // The lookup finds nothing (as in a concurrent delivery), and the insert loses the race.
    const h = harness({ createThrows: new UniqueViolationError() })
    const result = expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'already_registered',
    )
    assert.equal(result.status, 'already_registered')
    assert.ok(h.logs.some((l) => l.viaUniqueIndex === true))
  })

  it('remains idempotent when the order was reconstructed under a different local id', async () => {
    // The identity is the Kustom order id, so a second local row cannot double-register.
    const h = harness({ enforceUnique: true })
    const order = kustomOrder()
    expectStatus(await registerPromoUsageOnce(h.deps, { kustomOrder: order, order: ORDER }), 'created')
    expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: order, order: { id: 999, orderNumber: 'AB-028412' } }),
      'already_registered',
    )
    assert.equal(h.usages.length, 1)
  })
})

/* ------------------------------ transient failures ------------------------------ */

describe('registerPromoUsageOnce — transient failures', () => {
  it('an unrelated insert error stays retryable and is never mistaken for a duplicate', async () => {
    const h = harness({ createThrows: new Error('deadlock detected') })
    const result = expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'retryable_error',
    )
    assert.equal(result.status === 'retryable_error' && result.reason, 'usage_insert_failed')
    assert.deepEqual(h.usages, [])
  })

  it('a failing lookup is retryable', async () => {
    const h = harness({ findThrows: true })
    expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'retryable_error',
    )
  })

  it('a failing promo lookup is retryable', async () => {
    const h = harness({ promoLookupThrows: true })
    expectStatus(
      await registerPromoUsageOnce(h.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'retryable_error',
    )
  })

  it('a later retry succeeds after a transient failure, creating exactly one usage', async () => {
    // First delivery: the insert fails transiently.
    const failing = harness({ createThrows: new Error('connection terminated') })
    expectStatus(
      await registerPromoUsageOnce(failing.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'retryable_error',
    )
    assert.deepEqual(failing.usages, [])

    // Kustom retries the push; this time the database is healthy.
    const healthy = harness({ enforceUnique: true })
    expectStatus(
      await registerPromoUsageOnce(healthy.deps, { kustomOrder: kustomOrder(), order: ORDER }),
      'created',
    )
    assert.equal(healthy.usages.length, 1)
  })
})

describe('isUniqueViolation', () => {
  it('recognises a Postgres unique violation, however it is wrapped', () => {
    assert.equal(isUniqueViolation(new UniqueViolationError()), true)
    assert.equal(isUniqueViolation({ code: '23505' }), true)
    assert.equal(isUniqueViolation({ cause: { code: '23505' } }), true)
    assert.equal(isUniqueViolation({ originalError: new UniqueViolationError() }), true)
  })

  it('does not treat anything else as a duplicate', () => {
    assert.equal(isUniqueViolation(new Error('deadlock detected')), false)
    assert.equal(isUniqueViolation({ code: '23503' }), false) // foreign key
    assert.equal(isUniqueViolation({ code: '08006' }), false) // connection failure
    assert.equal(isUniqueViolation(null), false)
    assert.equal(isUniqueViolation('boom'), false)
  })

  it('terminates on a self-referencing cause chain', () => {
    const err: Record<string, unknown> = { message: 'x' }
    err.cause = err
    assert.equal(isUniqueViolation(err), false)
  })
})

/* ------------------------------ logging safety ------------------------------ */

describe('registerPromoUsageOnce — logging', () => {
  it('never logs credentials or raw database errors', async () => {
    const h = harness({ createThrows: new Error('connect ECONNREFUSED postgres://user:hunter2@host/db') })
    await registerPromoUsageOnce(h.deps, { kustomOrder: kustomOrder(), order: ORDER })
    const serialised = JSON.stringify(h.logs)
    assert.ok(!serialised.includes('hunter2'))
    assert.ok(!serialised.includes('postgres://'))
  })
})

/* ------------------------------ snapshot restoration ------------------------------ */

describe('restorePromoSnapshotPatch', () => {
  it('restores a full snapshot for an order that has none', () => {
    // `true` = the promo record still exists, so the convenience relationship may be written.
    const decision = restorePromoSnapshotPatch(kustomOrder(), {}, true)
    assert.equal(decision.action, 'restore')
    if (decision.action !== 'restore') throw new Error('unreachable')

    const discount = (decision.patch as { discount: Record<string, unknown> }).discount
    assert.equal(discount.code, 'WELCOME10')
    assert.equal(discount.promoCode, 7)
    assert.equal(discount.discountType, 'percentage')
    assert.equal(discount.discountValue, 10)
    assert.equal(discount.discountAmount, 44.9)
    assert.equal(discount.subtotalBeforeDiscount, 449)
    assert.equal(discount.subtotalAfterDiscount, 404.1)
    assert.equal(discount.totalBeforeDiscount, 518)
    assert.equal(discount.totalAfterDiscount, 473.1)
  })

  it('leaves a complete snapshot untouched', () => {
    const decision = restorePromoSnapshotPatch(kustomOrder(), {
      discount: { code: 'WELCOME10', discountAmount: 44.9 },
    })
    assert.deepEqual(decision, { action: 'none', reason: 'already_complete' })
  })

  it('fills in a partially written snapshot', () => {
    const decision = restorePromoSnapshotPatch(kustomOrder(), {
      discount: { code: 'WELCOME10', discountAmount: null },
    })
    assert.equal(decision.action, 'restore')
  })

  it('never overwrites a snapshot naming a different code', () => {
    const decision = restorePromoSnapshotPatch(kustomOrder(), { discount: { code: 'SOMMER20', discountAmount: 100 } })
    assert.deepEqual(decision, { action: 'conflict', storedCode: 'SOMMER20', paidCode: 'WELCOME10' })
  })

  it('does nothing for an order with no promo', () => {
    assert.deepEqual(restorePromoSnapshotPatch(undiscountedOrder(), {}), {
      action: 'none',
      reason: 'no_promo',
    })
  })

  it('does nothing when the promo data cannot be trusted', () => {
    const corrupt = kustomOrder({ merchant_data: '{ broken' })
    assert.deepEqual(restorePromoSnapshotPatch(corrupt, {}), {
      action: 'none',
      reason: 'unusable_promo_data',
    })
  })
})

/* ------------------------------ audit fix 1: deleted promo ------------------------------ */

describe('restorePromoSnapshotPatch — deleted promo record', () => {
  it('omits the promo relationship by default, keeping every snapshot value', () => {
    // orders.discount_promo_code_id carries a foreign key and Payload validates only the id
    // FORMAT, never existence — so a dangling id would reach Postgres and fail the order
    // write. Omitting is the safe default.
    const decision = restorePromoSnapshotPatch(kustomOrder(), {})
    assert.equal(decision.action, 'restore')
    if (decision.action !== 'restore') throw new Error('unreachable')

    const discount = (decision.patch as { discount: Record<string, unknown> }).discount
    assert.equal('promoCode' in discount, false, 'no dangling relationship id')
    // The historical truth survives in full.
    assert.equal(discount.code, 'WELCOME10')
    assert.equal(discount.discountType, 'percentage')
    assert.equal(discount.discountValue, 10)
    assert.equal(discount.discountAmount, 44.9)
    assert.equal(discount.subtotalBeforeDiscount, 449)
    assert.equal(discount.totalAfterDiscount, 473.1)
  })

  it('does not discard the discount snapshot merely because the relation is gone', () => {
    const decision = restorePromoSnapshotPatch(kustomOrder(), {}, false)
    assert.equal(decision.action, 'restore')
  })
})

describe('resolvePromoSnapshot — relationship resolution', () => {
  const payloadWith = (promoDoc: unknown, opts: { throws?: boolean } = {}) =>
    ({
      findByID: async () => {
        if (opts.throws) throw new Error('connection terminated')
        return promoDoc
      },
    }) as unknown as Payload

  it('includes the relationship when the promo record still exists', async () => {
    const decision = await resolvePromoSnapshot(payloadWith({ id: 7 }), kustomOrder(), {})
    assert.equal(decision.action, 'restore')
    if (decision.action !== 'restore') throw new Error('unreachable')
    const discount = (decision.patch as { discount: Record<string, unknown> }).discount
    assert.equal(discount.promoCode, 7)
  })

  it('omits it when the promo record has been deleted', async () => {
    const decision = await resolvePromoSnapshot(payloadWith(null), kustomOrder(), {})
    assert.equal(decision.action, 'restore')
    if (decision.action !== 'restore') throw new Error('unreachable')
    const discount = (decision.patch as { discount: Record<string, unknown> }).discount
    assert.equal('promoCode' in discount, false)
    assert.equal(discount.code, 'WELCOME10', 'the snapshot is still restored')
  })

  it('fails closed when the lookup itself errors', async () => {
    const decision = await resolvePromoSnapshot(payloadWith(null, { throws: true }), kustomOrder(), {})
    assert.equal(decision.action, 'restore')
    if (decision.action !== 'restore') throw new Error('unreachable')
    assert.equal('promoCode' in (decision.patch as { discount: Record<string, unknown> }).discount, false)
  })

  it('does not pay for a lookup when there is nothing to restore', async () => {
    let looked = false
    const payload = {
      findByID: async () => {
        looked = true
        return { id: 7 }
      },
    } as unknown as Payload

    // An order with no promo at all.
    const decision = await resolvePromoSnapshot(payload, undiscountedOrder(), {})
    assert.deepEqual(decision, { action: 'none', reason: 'no_promo' })
    assert.equal(looked, false)
  })

  it('still reports a conflicting snapshot without touching the database', async () => {
    let looked = false
    const payload = {
      findByID: async () => {
        looked = true
        return { id: 7 }
      },
    } as unknown as Payload

    const decision = await resolvePromoSnapshot(payload, kustomOrder(), {
      discount: { code: 'SOMMER20', discountAmount: 100 },
    })
    assert.equal(decision.action, 'conflict')
    assert.equal(looked, false)
  })
})
