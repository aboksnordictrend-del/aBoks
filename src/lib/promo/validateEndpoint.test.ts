import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import type { RateLimitResult } from '@/lib/rateLimit'
import {
  MAX_CART_LINES,
  MAX_CODE_LENGTH,
  MAX_EMAIL_LENGTH,
  handlePromoValidation,
  parsePromoValidationRequest,
  type PromoEndpointDeps,
  type PromoEndpointResult,
} from './validateEndpoint'

/* ------------------------------ test doubles ------------------------------ */

type FakeVariant = { id: number; product: number | null; name: string; displayName: string }
type FakeProduct = { id: number; title: string; price: number; published?: boolean }
type FakeCode = {
  id: number
  code: string
  active?: boolean
  discountType?: string
  discountValue?: number
  usageMode?: string
  maxUses?: number | null
  expiresAt?: string | null
  applicableProducts?: number[]
  /** Never returned to the client — asserted absent from every response. */
  name?: string
  minimumOrderAmount?: number | null
}

const VARIANTS: FakeVariant[] = [
  { id: 10, product: 1, name: 'Mørk blå', displayName: 'aBoks Vegg – Mørk blå' },
  { id: 20, product: 2, name: 'Creme', displayName: 'aBoks Mini – Creme' },
]
const PRODUCTS: FakeProduct[] = [
  { id: 1, title: 'aBoks Vegg', price: 449, published: true },
  { id: 2, title: 'aBoks Mini', price: 299, published: true },
]
const WELCOME: FakeCode = {
  id: 7,
  code: 'WELCOME10',
  active: true,
  discountType: 'percentage',
  discountValue: 10,
  usageMode: 'unlimited',
  name: 'INTERNT NOTAT — skal aldri ut til kunden',
}

/**
 * Payload stand-in. Records every collection it is asked for, and — importantly — exposes
 * `writes`, which stays empty because the endpoint must never create or update anything.
 */
function fakePayload(opts: {
  variants?: FakeVariant[]
  products?: FakeProduct[]
  codes?: FakeCode[]
  usages?: { promoCode: number; order?: number; email?: string }[]
  throwOn?: string
}) {
  const reads: string[] = []
  const writes: string[] = []

  const payload = {
    find: async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      reads.push(collection)
      if (opts.throwOn === collection) throw new Error('ORA-00942: table or view does not exist')

      if (collection === 'product-variants') {
        const ids = (where?.id?.in ?? []).map(String)
        const docs = (opts.variants ?? VARIANTS).filter((v) => ids.includes(String(v.id)))
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'products') {
        const ids = (where?.id?.in ?? []).map(String)
        const docs = (opts.products ?? PRODUCTS).filter((p) => ids.includes(String(p.id)))
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'promo-codes') {
        const docs = (opts.codes ?? [WELCOME]).filter((c) => c.code === where?.code?.equals)
        return { docs, totalDocs: docs.length }
      }
      // promo-code-usages
      const docs = opts.usages ?? []
      return { docs, totalDocs: docs.length }
    },
    create: async ({ collection }: { collection: string }) => {
      writes.push(`create:${collection}`)
      return {}
    },
    update: async ({ collection }: { collection: string }) => {
      writes.push(`update:${collection}`)
      return {}
    },
    delete: async ({ collection }: { collection: string }) => {
      writes.push(`delete:${collection}`)
      return {}
    },
    logger: { error: () => {}, warn: () => {} },
  } as unknown as Payload

  return { payload, reads, writes }
}

const allow = (): RateLimitResult => ({ ok: true, remaining: 29, resetMs: 300_000 })
const block = (): RateLimitResult => ({ ok: false, remaining: 0, resetMs: 90_000 })

function deps(
  overrides: Partial<PromoEndpointDeps> & { payload?: Payload } = {},
): PromoEndpointDeps {
  const payload = overrides.payload ?? fakePayload({}).payload
  return {
    getPayload: overrides.getPayload ?? (async () => payload),
    rateLimit: overrides.rateLimit ?? (async () => allow()),
    originAllowed: overrides.originAllowed ?? (() => true),
    log: overrides.log ?? (() => {}),
  }
}

const post = (
  body: unknown,
  d: PromoEndpointDeps = deps(),
  input: { origin?: string | null; ip?: string } = {},
): Promise<PromoEndpointResult> =>
  handlePromoValidation(d, {
    origin: input.origin ?? 'https://aboks.no',
    ip: input.ip ?? '198.51.100.7',
    rawBody: typeof body === 'string' ? body : JSON.stringify(body),
  })

const CART = [{ variantId: '10', quantity: 1 }]

const expectFailure = (result: PromoEndpointResult, status: number, reason: string) => {
  assert.equal(result.status, status)
  assert.equal(result.body.valid, false)
  if (result.body.valid) throw new Error('unreachable')
  assert.equal(result.body.reason, reason)
  assert.ok(result.body.message.length > 0, 'every failure carries a Norwegian message')
  return result.body
}

/* ------------------------------ parser ------------------------------ */

describe('parsePromoValidationRequest', () => {
  it('keeps only variantId and quantity — tampered fields cannot survive parsing', () => {
    const parsed = parsePromoValidationRequest({
      code: 'WELCOME10',
      items: [
        {
          variantId: '10',
          quantity: 2,
          price: 1,
          lineTotal: 1,
          name: 'Gratis',
          eligible: true,
          discountAmount: 9_999,
        },
      ],
      subtotal: 1,
      shipping: 0,
      discountAmount: 9_999,
      total: 1,
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) throw new Error('unreachable')
    assert.deepEqual(parsed.value.items, [{ variantId: '10', quantity: 2 }])
    assert.deepEqual(Object.keys(parsed.value).sort(), ['code', 'items'])
  })

  it('accepts a numeric variantId and normalises it to a string', () => {
    const parsed = parsePromoValidationRequest({ code: 'X', items: [{ variantId: 10, quantity: 1 }] })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) throw new Error('unreachable')
    assert.equal(parsed.value.items[0].variantId, '10')
  })

  it('passes quantity through untouched — priceCart stays the authority', () => {
    const parsed = parsePromoValidationRequest({
      code: 'X',
      items: [{ variantId: '10', quantity: 'two' }],
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) throw new Error('unreachable')
    assert.equal(parsed.value.items[0].quantity as unknown, 'two')
  })

  it('accepts a productId line — a product with no variants', () => {
    const parsed = parsePromoValidationRequest({
      code: 'X',
      items: [{ productId: 7, quantity: 2, price: 129, colorName: 'Gratis' }],
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) throw new Error('unreachable')
    assert.deepEqual(parsed.value.items, [{ productId: '7', quantity: 2 }])
  })

  it('lets the variant win when a line carries both identifiers', () => {
    const parsed = parsePromoValidationRequest({
      code: 'X',
      items: [{ variantId: '10', productId: '1', quantity: 1 }],
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) throw new Error('unreachable')
    assert.deepEqual(parsed.value.items, [{ variantId: '10', quantity: 1 }])
  })

  it('rejects a line with no usable identifier at all', () => {
    for (const item of [{ quantity: 1 }, { productId: '  ', quantity: 1 }, { variantId: null, quantity: 1 }]) {
      const parsed = parsePromoValidationRequest({ code: 'X', items: [item] })
      assert.equal(parsed.ok, false, `should reject ${JSON.stringify(item)}`)
    }
  })

  it('rejects malformed shapes', () => {
    const bad: unknown[] = [
      null,
      'string body',
      [],
      42,
      { items: CART },                                   // no code
      { code: 123, items: CART },                        // code not a string
      { code: '   ', items: CART },                      // blank code
      { code: 'X' },                                     // no items
      { code: 'X', items: {} },                          // items not an array
      { code: 'X', items: [] },                          // empty cart
      { code: 'X', items: [null] },
      { code: 'X', items: [{ quantity: 1 }] },           // no variantId
      { code: 'X', items: [{ variantId: '  ', quantity: 1 }] },
      { code: 'X', items: [{ variantId: { id: 1 }, quantity: 1 }] },
      { code: 'X', items: CART, email: 42 },
    ]
    for (const body of bad) {
      const parsed = parsePromoValidationRequest(body)
      assert.equal(parsed.ok, false, `should have rejected ${JSON.stringify(body)}`)
    }
  })

  it('enforces the documented limits', () => {
    assert.equal(
      parsePromoValidationRequest({ code: 'A'.repeat(MAX_CODE_LENGTH + 1), items: CART }).ok,
      false,
    )
    assert.equal(parsePromoValidationRequest({ code: 'A'.repeat(MAX_CODE_LENGTH), items: CART }).ok, true)

    const tooMany = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({
      variantId: String(i),
      quantity: 1,
    }))
    assert.equal(parsePromoValidationRequest({ code: 'X', items: tooMany }).ok, false)
    assert.equal(parsePromoValidationRequest({ code: 'X', items: tooMany.slice(1) }).ok, true)

    assert.equal(
      parsePromoValidationRequest({
        code: 'X',
        items: CART,
        email: `${'a'.repeat(MAX_EMAIL_LENGTH)}@x.no`,
      }).ok,
      false,
    )
  })

  it('treats a blank email as absent', () => {
    const parsed = parsePromoValidationRequest({ code: 'X', items: CART, email: '   ' })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) throw new Error('unreachable')
    assert.equal(parsed.value.email, undefined)
  })
})

/* ------------------------------ happy path ------------------------------ */

describe('handlePromoValidation — success', () => {
  it('returns server-calculated totals for a valid code', async () => {
    const result = await post({ code: 'welcome10', items: CART })

    assert.equal(result.status, 200)
    assert.equal(result.body.valid, true)
    if (!result.body.valid) throw new Error('unreachable')

    assert.equal(result.body.code, 'WELCOME10')
    assert.equal(result.body.discountType, 'percentage')
    assert.equal(result.body.discountValue, 10)
    assert.equal(result.body.eligibleSubtotal, 449)
    assert.equal(result.body.discountAmount, 44.9)
    assert.equal(result.body.subtotalBeforeDiscount, 449)
    assert.equal(result.body.subtotalAfterDiscount, 404.1)
    assert.equal(result.body.shipping, 69)
    assert.equal(result.body.totalBeforeDiscount, 518)
    assert.equal(result.body.totalAfterDiscount, 473.1)

    assert.deepEqual(result.body.oere, {
      eligibleSubtotal: 44_900,
      discountAmount: 4_490,
      subtotalBeforeDiscount: 44_900,
      subtotalAfterDiscount: 40_410,
      shipping: 6_900,
      totalBeforeDiscount: 51_800,
      totalAfterDiscount: 47_310,
    })
  })

  it('ignores every client-supplied money field and prices from the catalogue', async () => {
    const tampered = await post({
      code: 'WELCOME10',
      items: [{ variantId: '10', quantity: 1, price: 1, lineTotal: 1, discountAmount: 9_999 }],
      subtotal: 1,
      shipping: 0,
      discountAmount: 9_999,
      total: 1,
    })

    assert.equal(tampered.body.valid, true)
    if (!tampered.body.valid) throw new Error('unreachable')
    // Identical to the untampered request above.
    assert.equal(tampered.body.subtotalBeforeDiscount, 449)
    assert.equal(tampered.body.discountAmount, 44.9)
    assert.equal(tampered.body.totalAfterDiscount, 473.1)
  })

  it('leaks nothing beyond the display contract', async () => {
    const { payload } = fakePayload({
      codes: [{ ...WELCOME, applicableProducts: [1], minimumOrderAmount: 100 }],
      usages: [],
    })
    const result = await post({ code: 'WELCOME10', items: CART, email: 'kari@example.no' }, deps({ payload }))

    assert.equal(result.body.valid, true)
    const serialised = JSON.stringify(result.body)

    assert.deepEqual(Object.keys(result.body).sort(), [
      'code',
      'discountAmount',
      'discountType',
      'discountValue',
      'eligibleSubtotal',
      'oere',
      'shipping',
      'subtotalAfterDiscount',
      'subtotalBeforeDiscount',
      'totalAfterDiscount',
      'totalBeforeDiscount',
      'valid',
    ])
    // No internal note, no promo-code id, no usage data, no email, no product restrictions.
    assert.ok(!serialised.includes('INTERNT NOTAT'))
    assert.ok(!serialised.includes('kari@example.no'))
    assert.ok(!/"promoCodeId"|"applicableProducts"|"usage"|"maxUses"|"id":/.test(serialised))
  })
})

/* ------------------------------ request failures ------------------------------ */

describe('handlePromoValidation — malformed requests', () => {
  it('rejects malformed JSON without exposing the parser error', async () => {
    const body = expectFailure(await post('{ "code": '), 400, 'invalid_request')
    assert.ok(!/JSON|Unexpected|SyntaxError/i.test(body.message))
  })

  it('rejects an empty body', async () => {
    expectFailure(await post(''), 400, 'invalid_request')
  })

  it('rejects a missing code', async () => {
    expectFailure(await post({ items: CART }), 400, 'invalid_request')
  })

  it('rejects an over-long code', async () => {
    expectFailure(
      await post({ code: 'A'.repeat(MAX_CODE_LENGTH + 1), items: CART }),
      400,
      'invalid_request',
    )
  })

  it('rejects an empty cart', async () => {
    expectFailure(await post({ code: 'WELCOME10', items: [] }), 400, 'invalid_request')
  })

  it('rejects too many cart lines', async () => {
    const items = Array.from({ length: MAX_CART_LINES + 1 }, () => ({ variantId: '10', quantity: 1 }))
    expectFailure(await post({ code: 'WELCOME10', items }), 400, 'invalid_request')
  })

  it('rejects an oversized body before parsing it', async () => {
    const huge = JSON.stringify({ code: 'WELCOME10', items: CART, padding: 'x'.repeat(20_000) })
    expectFailure(await post(huge), 400, 'invalid_request')
  })

  it('reports an invalid quantity safely, from priceCart', async () => {
    for (const quantity of [0, -1, 2.5, 'two', null]) {
      const result = await post({ code: 'WELCOME10', items: [{ variantId: '10', quantity }] })
      expectFailure(result, 400, 'invalid_quantity')
    }
  })
})

describe('handlePromoValidation — stale cart', () => {
  it('reports an unknown variant as a conflict', async () => {
    const result = await post({ code: 'WELCOME10', items: [{ variantId: '999', quantity: 1 }] })
    expectFailure(result, 409, 'variant_not_found')
  })

  it('reports an unpublished product as a conflict', async () => {
    const { payload } = fakePayload({
      products: [{ id: 1, title: 'aBoks Vegg', price: 449, published: false }],
    })
    const result = await post({ code: 'WELCOME10', items: CART }, deps({ payload }))
    expectFailure(result, 409, 'product_unavailable')
  })

  it('reports a missing parent product as a conflict', async () => {
    const { payload } = fakePayload({ products: [] })
    const result = await post({ code: 'WELCOME10', items: CART }, deps({ payload }))
    expectFailure(result, 409, 'product_not_found')
  })
})

/* ------------------------------ business failures ------------------------------ */

describe('handlePromoValidation — business answers are HTTP 200', () => {
  it('returns the validator reason and message for an expired code', async () => {
    const { payload } = fakePayload({
      codes: [{ ...WELCOME, expiresAt: new Date(Date.now() - 86_400_000).toISOString() }],
    })
    const body = expectFailure(
      await post({ code: 'WELCOME10', items: CART }, deps({ payload })),
      200,
      'expired',
    )
    assert.equal(body.message, 'Denne rabattkoden er utløpt.')
  })

  it('returns not_found without hinting at any other code', async () => {
    const body = expectFailure(await post({ code: 'GUESS1', items: CART }), 200, 'not_found')
    assert.equal(body.message, 'Ukjent rabattkode.')
    assert.ok(!body.message.includes('WELCOME'))
  })

  it('returns inactive for a deactivated code', async () => {
    const { payload } = fakePayload({ codes: [{ ...WELCOME, active: false }] })
    expectFailure(await post({ code: 'WELCOME10', items: CART }, deps({ payload })), 200, 'inactive')
  })

  it('rejects every usage-limited mode as unsupported at launch', async () => {
    for (const usageMode of ['once_per_customer', 'single_use_global', 'limited']) {
      const { payload } = fakePayload({
        codes: [{ ...WELCOME, usageMode, ...(usageMode === 'limited' ? { maxUses: 5 } : {}) }],
      })
      const body = expectFailure(
        await post({ code: 'WELCOME10', items: CART }, deps({ payload })),
        200,
        'not_supported',
      )
      assert.equal(body.message, 'Denne rabattkoden er ikke tilgjengelig akkurat nå.')
      // The reason for the refusal is never disclosed.
      assert.ok(!/kunde|én gang|begrenset|maks/i.test(body.message))
    }
  })

  it('accepts a reusable code with an email supplied', async () => {
    const { payload } = fakePayload({ codes: [WELCOME], usages: [] })
    const result = await post(
      { code: 'WELCOME10', items: CART, email: '  Kari@Example.NO ' },
      deps({ payload }),
    )
    assert.equal(result.status, 200)
    assert.equal(result.body.valid, true)
  })

  it('reports a code with no eligible products in the cart', async () => {
    const { payload } = fakePayload({ codes: [{ ...WELCOME, applicableProducts: [99] }] })
    expectFailure(
      await post({ code: 'WELCOME10', items: CART }, deps({ payload })),
      200,
      'no_eligible_products',
    )
  })
})

/* ------------------------------ security ------------------------------ */

describe('handlePromoValidation — security', () => {
  it('refuses an untrusted Origin before doing any work', async () => {
    const { payload, reads } = fakePayload({})
    const result = await post(
      { code: 'WELCOME10', items: CART },
      deps({ payload, originAllowed: (o) => o === 'https://aboks.no' }),
      { origin: 'https://evil.example' },
    )
    expectFailure(result, 403, 'forbidden_origin')
    assert.deepEqual(reads, [], 'a rejected origin must not reach the database')
  })

  it('allows a trusted Origin', async () => {
    const result = await post(
      { code: 'WELCOME10', items: CART },
      deps({ originAllowed: (o) => o === 'https://aboks.no' }),
      { origin: 'https://aboks.no' },
    )
    assert.equal(result.status, 200)
  })

  it('rate-limits per IP and reports Retry-After', async () => {
    const { payload, reads } = fakePayload({})
    const result = await post(
      { code: 'WELCOME10', items: CART },
      deps({ payload, rateLimit: async () => block() }),
    )
    const body = expectFailure(result, 429, 'rate_limited')
    assert.equal(body.retryAfter, 90)
    assert.equal(result.headers?.['Retry-After'], '90')
    assert.deepEqual(reads, [], 'a rate-limited request must not reach the database')
  })

  it('keys the rate limit on the caller IP', async () => {
    const keys: string[] = []
    await post(
      { code: 'WELCOME10', items: CART },
      deps({
        rateLimit: async ({ key }) => {
          keys.push(key)
          return allow()
        },
      }),
      { ip: '203.0.113.9' },
    )
    assert.deepEqual(keys, ['promo-validate:203.0.113.9'])
  })

  it('hides a pricing lookup error behind a retryable status', async () => {
    const { payload } = fakePayload({ throwOn: 'product-variants' })
    const body = expectFailure(
      await post({ code: 'WELCOME10', items: CART }, deps({ payload })),
      503,
      'lookup_failed',
    )
    assert.ok(!body.message.includes('ORA-00942'))
    assert.ok(!/table or view|stack|at Object/i.test(body.message))
  })

  it('hides a promo lookup error behind a retryable status', async () => {
    const { payload } = fakePayload({ throwOn: 'promo-codes' })
    const body = expectFailure(
      await post({ code: 'WELCOME10', items: CART }, deps({ payload })),
      503,
      'lookup_failed',
    )
    assert.ok(!body.message.includes('ORA-00942'))
  })

  it('turns an unexpected failure into a bare 500', async () => {
    const body = expectFailure(
      await post(
        { code: 'WELCOME10', items: CART },
        deps({
          getPayload: async () => {
            throw new Error('DATABASE_URI missing: postgres://user:secret@host/db')
          },
        }),
      ),
      500,
      'server_error',
    )
    assert.equal(body.message, 'Noe gikk galt. Prøv igjen om litt.')
    assert.ok(!body.message.includes('secret'))
  })

  it('never logs the code, the email or the cart contents', async () => {
    const lines: Record<string, unknown>[] = []
    await post(
      { code: 'WELCOME10', items: CART, email: 'kari@example.no' },
      deps({ log: (line) => lines.push(line) }),
    )
    const serialised = JSON.stringify(lines)
    assert.ok(lines.length > 0, 'the request is logged')
    assert.ok(!serialised.includes('WELCOME10'))
    assert.ok(!serialised.includes('kari@example.no'))
    // Shape and outcome only.
    assert.equal(lines[0].scope, 'promo-validate')
    assert.equal(lines[0].status, 200)
    assert.equal(lines[0].hasEmail, true)
    assert.equal(lines[0].lineCount, 1)
  })
})

/* ------------------------------ read-only ------------------------------ */

describe('handlePromoValidation — read-only', () => {
  it('performs no writes on any path', async () => {
    const scenarios: [string, unknown, ReturnType<typeof fakePayload>][] = [
      ['valid code', { code: 'WELCOME10', items: CART }, fakePayload({})],
      [
        'single-use code',
        { code: 'WELCOME10', items: CART },
        fakePayload({ codes: [{ ...WELCOME, usageMode: 'single_use_global' }], usages: [] }),
      ],
      [
        'limited code',
        { code: 'WELCOME10', items: CART },
        fakePayload({ codes: [{ ...WELCOME, usageMode: 'limited', maxUses: 5 }], usages: [] }),
      ],
      ['unknown code', { code: 'NOPE', items: CART }, fakePayload({})],
      ['stale cart', { code: 'WELCOME10', items: [{ variantId: '999', quantity: 1 }] }, fakePayload({})],
    ]

    for (const [label, body, fake] of scenarios) {
      await post(body, deps({ payload: fake.payload }))
      assert.deepEqual(fake.writes, [], `${label} must not write`)
    }
  })

  it('only ever reads the catalogue and the promo code itself', async () => {
    // At launch only reusable codes are supported, so the usage table is not even consulted
    // during validation — it is written once, after payment, by the webhook.
    const { payload, reads } = fakePayload({ codes: [WELCOME], usages: [] })
    await post({ code: 'WELCOME10', items: CART }, deps({ payload }))
    assert.deepEqual(reads, ['product-variants', 'products', 'promo-codes'])
  })

  it('validating a code does not consume it — a second call still succeeds', async () => {
    const fake = fakePayload({ codes: [WELCOME], usages: [] })
    const first = await post({ code: 'WELCOME10', items: CART }, deps({ payload: fake.payload }))
    const second = await post({ code: 'WELCOME10', items: CART }, deps({ payload: fake.payload }))

    assert.equal(first.body.valid, true)
    assert.equal(second.body.valid, true, 'validation is advisory, never a reservation')
    assert.deepEqual(fake.writes, [])
  })
})
