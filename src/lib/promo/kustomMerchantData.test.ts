import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_MERCHANT_DATA_BYTES,
  buildKustomMerchantData,
  crossCheckMerchantData,
  parseKustomMerchantData,
  type TrustedPromoSnapshot,
} from './kustomMerchantData'

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

/** The paid Kustom order matching SNAPSHOT. */
const PAID = {
  orderAmountOere: 47_310,
  orderLines: [
    { type: 'physical' as const, total_discount_amount: 4_490 },
    { type: 'shipping_fee' as const, total_discount_amount: 0 },
  ],
}

const parsedPromo = (raw: string | undefined) => {
  const parsed = parseKustomMerchantData(raw)
  assert.equal(parsed.ok, true)
  if (!parsed.ok) throw new Error('unreachable')
  return parsed.promo
}

const rejects = (value: unknown, reason: string) => {
  const parsed = parseKustomMerchantData(value)
  assert.equal(parsed.ok, false, `should have rejected ${String(value).slice(0, 60)}`)
  if (parsed.ok) throw new Error('unreachable')
  assert.equal(parsed.reason, reason)
}

/** Serialises a payload object directly, bypassing the builder's validation. */
const raw = (payload: unknown) => JSON.stringify(payload)

describe('buildKustomMerchantData', () => {
  it('serialises a trusted snapshot at the supported version', () => {
    const built = buildKustomMerchantData(SNAPSHOT)!
    const decoded = JSON.parse(built)
    assert.equal(decoded.version, 1)
    assert.deepEqual(decoded.promo, SNAPSHOT)
  })

  it('omits merchant_data entirely when there is no promo', () => {
    assert.equal(buildKustomMerchantData(undefined), undefined)
    assert.equal(buildKustomMerchantData(null), undefined)
  })

  it('normalises the code on the way out', () => {
    const built = buildKustomMerchantData({ ...SNAPSHOT, code: '  welcome10 ' })!
    assert.equal(JSON.parse(built).promo.code, 'WELCOME10')
  })

  it('carries no customer data, credentials or browser input', () => {
    const built = buildKustomMerchantData(SNAPSHOT)!
    for (const forbidden of ['email', 'password', 'secret', 'token', 'address', 'phone']) {
      assert.ok(!built.toLowerCase().includes(forbidden), `must not contain ${forbidden}`)
    }
    // Exactly the documented field set — nothing extra rides along.
    assert.deepEqual(Object.keys(JSON.parse(built).promo).sort(), [
      'code',
      'discountAmountOere',
      'promoCodeId',
      'shippingOere',
      'subtotalBeforeDiscountOere',
      'totalAfterDiscountOere',
      'type',
      'value',
    ])
  })

  it('round-trips through the parser', () => {
    assert.deepEqual(parsedPromo(buildKustomMerchantData(SNAPSHOT)), SNAPSHOT)
  })
})

describe('parseKustomMerchantData — acceptance', () => {
  it('accepts a valid payload', () => {
    assert.deepEqual(parsedPromo(raw({ version: 1, promo: SNAPSHOT })), SNAPSHOT)
  })

  it('accepts a valid payload with no promo', () => {
    assert.equal(parsedPromo(raw({ version: 1 })), null)
    assert.equal(parsedPromo(raw({ version: 1, promo: null })), null)
  })

  it('normalises the code on the way in', () => {
    const promo = parsedPromo(raw({ version: 1, promo: { ...SNAPSHOT, code: ' welcome10 ' } }))
    assert.equal(promo?.code, 'WELCOME10')
  })
})

describe('parseKustomMerchantData — rejection', () => {
  it('reports an absent value distinctly', () => {
    rejects(undefined, 'absent')
    rejects(null, 'absent')
    rejects('', 'absent')
  })

  it('rejects malformed JSON without throwing', () => {
    rejects('{ "version": ', 'malformed_json')
    rejects('not json at all', 'malformed_json')
    rejects('<html>502 Bad Gateway</html>', 'malformed_json')
  })

  it('rejects a non-object payload', () => {
    rejects(raw([1, 2, 3]), 'not_an_object')
    rejects(raw('a string'), 'not_an_object')
    rejects(42, 'not_an_object')
  })

  it('rejects an unknown version', () => {
    rejects(raw({ version: 2, promo: SNAPSHOT }), 'unsupported_version')
    rejects(raw({ version: '1', promo: SNAPSHOT }), 'unsupported_version')
    rejects(raw({ promo: SNAPSHOT }), 'unsupported_version')
  })

  it('rejects an oversized payload', () => {
    const huge = raw({ version: 1, promo: { ...SNAPSHOT, code: 'A'.repeat(MAX_MERCHANT_DATA_BYTES) } })
    rejects(huge, 'too_large')
  })

  it('rejects negative money', () => {
    for (const field of [
      'discountAmountOere',
      'subtotalBeforeDiscountOere',
      'shippingOere',
      'totalAfterDiscountOere',
    ] as const) {
      rejects(raw({ version: 1, promo: { ...SNAPSHOT, [field]: -1 } }), 'invalid_promo')
    }
  })

  it('rejects non-integer øre', () => {
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, discountAmountOere: 4490.5 } }), 'invalid_promo')
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, shippingOere: Number.NaN } }), 'invalid_promo')
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, shippingOere: '6900' } }), 'invalid_promo')
  })

  it('rejects a zero discount — that is not a promo', () => {
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, discountAmountOere: 0 } }), 'invalid_promo')
  })

  it('rejects an unknown discount type', () => {
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, type: 'bogus' } }), 'invalid_promo')
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, type: 'discount' } }), 'invalid_promo')
  })

  it('rejects a malformed promo id', () => {
    for (const promoCodeId of ['', 'abc', '7; DROP TABLE', '  ', 'A'.repeat(80), 7 as unknown as string]) {
      rejects(raw({ version: 1, promo: { ...SNAPSHOT, promoCodeId } }), 'invalid_promo')
    }
  })

  it('rejects a missing or over-long code', () => {
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, code: '' } }), 'invalid_promo')
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, code: 'A'.repeat(120) } }), 'invalid_promo')
  })

  it('rejects a non-positive discount value', () => {
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, value: 0 } }), 'invalid_promo')
    rejects(raw({ version: 1, promo: { ...SNAPSHOT, value: -10 } }), 'invalid_promo')
  })

  it('cannot be tricked by extra fields a browser might try to inject', () => {
    // Even if arbitrary keys arrive, only the known ones are read — the result is exactly the
    // documented shape, and injected values simply do not exist on it.
    const promo = parsedPromo(
      raw({
        version: 1,
        promo: { ...SNAPSHOT, isAdmin: true, freeShipping: true, discountAmount: 999_999 },
        extra: 'ignored',
      }),
    )
    assert.deepEqual(promo, SNAPSHOT)
    assert.equal((promo as unknown as Record<string, unknown>).isAdmin, undefined)
  })
})

describe('crossCheckMerchantData', () => {
  it('accepts a snapshot matching the paid order', () => {
    assert.deepEqual(crossCheckMerchantData(SNAPSHOT, PAID), { ok: true })
  })

  it('rejects a discount that differs from the summed line discounts', () => {
    const result = crossCheckMerchantData({ ...SNAPSHOT, discountAmountOere: 9_999 }, PAID)
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'discount_mismatch')
  })

  it('rejects a total that differs from the Kustom order amount', () => {
    const result = crossCheckMerchantData(SNAPSHOT, { ...PAID, orderAmountOere: 51_800 })
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'total_mismatch')
  })

  it('rejects internally inconsistent arithmetic', () => {
    // subtotal + shipping − discount must equal the total.
    const bad = { ...SNAPSHOT, shippingOere: 0, totalAfterDiscountOere: 47_310 }
    const result = crossCheckMerchantData(bad, PAID)
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'arithmetic_mismatch')
  })

  it('rejects a claimed promo when nothing was actually discounted', () => {
    const result = crossCheckMerchantData(SNAPSHOT, {
      orderAmountOere: 51_800,
      orderLines: [{ type: 'physical', total_discount_amount: 0 }],
    })
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'no_line_discounts')
  })

  it('ignores discounts on non-physical lines when summing', () => {
    const result = crossCheckMerchantData(SNAPSHOT, {
      orderAmountOere: 47_310,
      orderLines: [
        { type: 'physical', total_discount_amount: 4_490 },
        // A shipping line should never carry one; if it did, it must not count.
        { type: 'shipping_fee', total_discount_amount: 500 },
      ],
    })
    assert.deepEqual(result, { ok: true })
  })
})

/* --------------------- audit hardening: subtotal / shipping split --------------------- */

/** The full Kustom line shape, so the split checks have something to verify against. */
const PAID_WITH_LINES = {
  orderAmountOere: 47_310,
  orderLines: [
    { type: 'physical' as const, unit_price: 44_900, quantity: 1, total_amount: 40_410, total_discount_amount: 4_490 },
    { type: 'shipping_fee' as const, unit_price: 6_900, quantity: 1, total_amount: 6_900, total_discount_amount: 0 },
  ],
}

describe('crossCheckMerchantData — subtotal and shipping split', () => {
  it('accepts a snapshot that matches the charged lines exactly', () => {
    assert.deepEqual(crossCheckMerchantData(SNAPSHOT, PAID_WITH_LINES), { ok: true })
  })

  it('rejects a compensating shift between subtotal and shipping', () => {
    // 51 800 + 0 − 4 490 === 47 310, so the arithmetic identity alone would pass this.
    const shifted = { ...SNAPSHOT, subtotalBeforeDiscountOere: 51_800, shippingOere: 0 }
    const result = crossCheckMerchantData(shifted, PAID_WITH_LINES)
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.ok(['subtotal_mismatch', 'shipping_mismatch'].includes(result.reason))
  })

  it('rejects a subtotal that does not match the summed line gross', () => {
    const wrong = { ...SNAPSHOT, subtotalBeforeDiscountOere: 40_000, totalAfterDiscountOere: 47_310, shippingOere: 11_800 }
    const result = crossCheckMerchantData(wrong, PAID_WITH_LINES)
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'subtotal_mismatch')
  })

  it('still works for a caller that supplies only the reduced line shape', () => {
    // The two extra checks are skipped rather than failing an older/leaner caller.
    assert.deepEqual(crossCheckMerchantData(SNAPSHOT, PAID), { ok: true })
  })

  it('accepts a free-shipping order with no shipping line', () => {
    const freeShipping = { ...SNAPSHOT, subtotalBeforeDiscountOere: 70_000, shippingOere: 0, totalAfterDiscountOere: 65_510 }
    assert.deepEqual(
      crossCheckMerchantData(freeShipping, {
        orderAmountOere: 65_510,
        orderLines: [
          { type: 'physical' as const, unit_price: 35_000, quantity: 2, total_amount: 65_510, total_discount_amount: 4_490 },
        ],
      }),
      { ok: true },
    )
  })
})
