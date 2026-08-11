import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import type { KustomCreateOrderPayload, KustomOrder } from '@/lib/kustom'
import {
  checkoutResultFromKustomOrder,
  createTrustedCheckout,
  toTrustedLines,
  type CheckoutDeps,
  type CheckoutInput,
  type CheckoutResult,
} from './checkoutFlow'

/* ------------------------------ test doubles ------------------------------ */

type FakeVariant = { id: number; product: number | null; name: string; displayName: string }
type FakeProduct = {
  id: number
  title: string
  price: number | null
  published?: boolean
  salePrice?: number
  saleStartDate?: string
  saleEndDate?: string
  /** Only read for a product with no variants — see @/lib/stock. */
  stock?: number
}
type FakeCode = {
  id: number
  code: string
  active?: boolean
  discountType?: string
  discountValue?: number
  usageMode?: string
  maxUses?: number
  expiresAt?: string
  applicableProducts?: number[]
  minimumOrderAmount?: number
}

const VARIANTS: FakeVariant[] = [
  { id: 10, product: 1, name: 'Mørk blå', displayName: 'aBoks Vegg – Mørk blå' },
  { id: 11, product: 1, name: 'Sort', displayName: 'aBoks Vegg – Sort' },
  { id: 20, product: 2, name: 'Creme', displayName: 'aBoks Mini – Creme' },
]
const PRODUCTS: FakeProduct[] = [
  { id: 1, title: 'aBoks Vegg', price: 449, published: true },
  { id: 2, title: 'aBoks Mini', price: 299, published: true },
  // No variant row points at this one — it is sold from its own stock.
  {
    id: 7,
    title: 'GP Ultra Plus Alkaline AA-batteri, 10-pakk',
    price: 129,
    published: true,
    stock: 10,
  },
]
const WELCOME: FakeCode = {
  id: 7,
  code: 'WELCOME10',
  active: true,
  discountType: 'percentage',
  discountValue: 10,
  usageMode: 'unlimited',
}

interface Harness {
  deps: CheckoutDeps
  /** Every payload.create call — proves nothing is written when the flow aborts. */
  writes: { collection: string; data: Record<string, unknown> }[]
  /** Every payload it would have sent to Kustom. Empty ⇒ Kustom was never called. */
  kustomCalls: KustomCreateOrderPayload[]
  logs: Record<string, unknown>[]
}

function harness(
  opts: {
    variants?: FakeVariant[]
    products?: FakeProduct[]
    codes?: FakeCode[]
    usages?: { promoCode: number; order?: number; email?: string }[]
    throwOn?: string
    createFails?: boolean
    createReturns?: Partial<KustomOrder>
    createFailsInDb?: boolean
    allocateFails?: boolean
  } = {},
): Harness {
  const writes: Harness['writes'] = []
  const kustomCalls: KustomCreateOrderPayload[] = []
  const logs: Record<string, unknown>[] = []

  const payload = {
    find: async ({ collection, where }: { collection: string; where?: Record<string, any> }) => {
      if (opts.throwOn === collection) throw new Error('PostgresError: relation does not exist')
      if (collection === 'product-variants') {
        // `product in (…)` is the existence check priceCart runs for a variant-less line:
        // does this product really have no variants?
        if (where?.product?.in) {
          const parents = (where.product.in as unknown[]).map(String)
          const docs = (opts.variants ?? VARIANTS).filter((v) =>
            parents.includes(String(v.product)),
          )
          return { docs, totalDocs: docs.length }
        }
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
      const docs = opts.usages ?? []
      return { docs, totalDocs: docs.length }
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (opts.createFailsInDb) throw new Error('connection terminated')
      writes.push({ collection, data })
      return { id: 1, ...data }
    },
    update: async () => {
      throw new Error('checkout must never update')
    },
    logger: { error: () => {}, warn: () => {} },
  } as unknown as Payload

  const deps: CheckoutDeps = {
    payload,
    createOrder: async (body) => {
      kustomCalls.push(body)
      if (opts.createFails) throw new Error('Kustom create order failed (400): Bad value')
      return {
        order_id: 'kustom-abc-123',
        status: 'checkout_incomplete',
        html_snippet: '<div id="kustom"></div>',
        purchase_country: 'NO',
        purchase_currency: 'NOK',
        locale: 'nb-NO',
        order_amount: body.order_amount,
        order_tax_amount: body.order_tax_amount,
        order_lines: body.order_lines,
        ...opts.createReturns,
      } as KustomOrder
    },
    allocateOrderNumber: async () => {
      if (opts.allocateFails) throw new Error('sequence unavailable')
      return 'AB-028412'
    },
    fallbackOrderNumber: () => 'AB-099999',
    serverUrl: 'https://aboks.no',
    log: (fields) => logs.push(fields),
  }

  return { deps, writes, kustomCalls, logs }
}

const CART: CheckoutInput = { items: [{ variantId: '10', quantity: 1 }] }

const expectOk = (result: CheckoutResult) => {
  assert.equal(result.ok, true, `expected ok, got ${'type' in result ? result.type : ''}`)
  if (!result.ok) throw new Error('unreachable')
  return result
}

/** Asserts the failure kind and narrows to it, so callers can read its own fields. */
function expectFail<T extends Extract<CheckoutResult, { ok: false }>['type']>(
  result: CheckoutResult,
  type: T,
): Extract<CheckoutResult, { ok: false; type: T }> {
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('unreachable')
  assert.equal(result.type, type)
  assert.ok(result.message.length > 0, 'every failure carries a Norwegian message')
  return result as Extract<CheckoutResult, { ok: false; type: T }>
}

/* ------------------------------ input boundary ------------------------------ */

describe('toTrustedLines', () => {
  it('keeps only variantId and quantity — a tampered object cannot smuggle anything', () => {
    const lines = toTrustedLines([
      { variantId: '10', quantity: 2, price: 1, lineTotal: 1, name: 'Gratis', discountAmount: 999 },
    ])
    assert.deepEqual(lines, [{ variantId: '10', quantity: 2 }])
    assert.deepEqual(Object.keys(lines![0]).sort(), ['quantity', 'variantId'])
  })

  it('rejects malformed shapes', () => {
    for (const items of [null, [], {}, [null], [{ quantity: 1 }], [{ variantId: ' ', quantity: 1 }]]) {
      assert.equal(toTrustedLines(items), null, `should reject ${JSON.stringify(items)}`)
    }
  })

  it('passes quantity through — priceCart stays the authority', () => {
    assert.equal(toTrustedLines([{ variantId: '10', quantity: 'two' }])![0].quantity as unknown, 'two')
  })

  it('accepts a productId line, keeping only that and the quantity', () => {
    const lines = toTrustedLines([
      { productId: '7', quantity: 2, price: 1, colorName: 'Gratis', productSlug: 'x' },
    ])
    assert.deepEqual(lines, [{ productId: '7', quantity: 2 }])
    assert.deepEqual(Object.keys(lines![0]).sort(), ['productId', 'quantity'])
  })

  it('lets the variant win when a line carries both identifiers', () => {
    // A client must not be able to buy a variant product against its parent's stock by
    // sending the product id alongside the variant.
    assert.deepEqual(toTrustedLines([{ variantId: '10', productId: '1', quantity: 1 }]), [
      { variantId: '10', quantity: 1 },
    ])
  })

  it('still rejects a line with no identifier at all', () => {
    assert.equal(toTrustedLines([{ productId: '  ', quantity: 1 }]), null)
    assert.equal(toTrustedLines([{ variantId: null, productId: null, quantity: 1 }]), null)
  })
})

/* ------------------------------ trusted pricing ------------------------------ */

describe('createTrustedCheckout — pricing is never taken from the browser', () => {
  it('ignores a manipulated price, subtotal, shipping and total', async () => {
    const h = harness()
    const tampered = {
      items: [{ variantId: '10', quantity: 1, price: 1, lineTotal: 1 }],
      subtotal: 1,
      shipping: 0,
      total: 1,
      discountAmount: 9_999,
    } as unknown as CheckoutInput

    const result = expectOk(await createTrustedCheckout(h.deps, tampered))

    assert.equal(result.totals.subtotal, 449)
    assert.equal(result.totals.shipping, 69)
    assert.equal(result.totals.total, 518)
    assert.equal(h.kustomCalls[0].order_amount, 51_800)
    assert.equal(h.kustomCalls[0].order_lines[0].unit_price, 44_900)
    // …and the saved order agrees.
    assert.equal(h.writes[0].data.subtotal, 449)
    assert.equal(h.writes[0].data.total, 518)
  })

  it('uses the current catalogue price, not the one the cart was built with', async () => {
    const h = harness({ products: [{ id: 1, title: 'aBoks Vegg', price: 549, published: true }] })
    const result = expectOk(await createTrustedCheckout(h.deps, CART))
    assert.equal(result.totals.subtotal, 549)
    assert.equal(h.kustomCalls[0].order_lines[0].unit_price, 54_900)
  })

  it('applies an active sale price', async () => {
    const h = harness({
      products: [{ id: 1, title: 'aBoks Vegg', price: 449, salePrice: 349, published: true }],
    })
    const result = expectOk(await createTrustedCheckout(h.deps, CART))
    assert.equal(result.totals.subtotal, 349)
  })

  it('ignores an expired sale price', async () => {
    const h = harness({
      products: [
        {
          id: 1,
          title: 'aBoks Vegg',
          price: 449,
          salePrice: 349,
          saleStartDate: '2020-01-01T00:00:00.000Z',
          saleEndDate: '2020-02-01T00:00:00.000Z',
          published: true,
        },
      ],
    })
    const result = expectOk(await createTrustedCheckout(h.deps, CART))
    assert.equal(result.totals.subtotal, 449)
  })

  it('bases free shipping on the trusted pre-discount subtotal', async () => {
    const h = harness()
    const result = expectOk(
      await createTrustedCheckout(h.deps, { items: [{ variantId: '10', quantity: 2 }] }),
    )
    assert.equal(result.totals.subtotal, 898)
    assert.equal(result.totals.shipping, 0)
    assert.ok(!h.kustomCalls[0].order_lines.some((l) => l.type === 'shipping_fee'))
  })

  it('uses the server-resolved display name, never a browser-supplied one', async () => {
    const h = harness()
    const result = expectOk(await createTrustedCheckout(h.deps, CART))
    assert.equal(result.lines[0].displayName, 'aBoks Vegg – Mørk blå')
    assert.equal(h.kustomCalls[0].order_lines[0].name, 'aBoks Vegg – Mørk blå')
  })
})

describe('createTrustedCheckout — stale cart blocks everything', () => {
  const blocks = async (h: Harness, input: CheckoutInput, reason: string) => {
    const result = expectFail(await createTrustedCheckout(h.deps, input), 'cart_invalid')
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, reason)
    assert.deepEqual(h.kustomCalls, [], 'Kustom must not be called')
    assert.deepEqual(h.writes, [], 'no pending order may be created')
  }

  it('blocks a deleted variant', async () => {
    await blocks(harness(), { items: [{ variantId: '999', quantity: 1 }] }, 'variant_not_found')
  })

  it('blocks an unpublished product', async () => {
    const h = harness({ products: [{ id: 1, title: 'aBoks Vegg', price: 449, published: false }] })
    await blocks(h, CART, 'product_unavailable')
  })

  it('blocks an unusable price', async () => {
    const h = harness({ products: [{ id: 1, title: 'aBoks Vegg', price: null, published: true }] })
    await blocks(h, CART, 'invalid_price')
  })

  it('blocks a malformed quantity', async () => {
    for (const quantity of [0, -1, 2.5, 'two']) {
      await blocks(harness(), { items: [{ variantId: '10', quantity } as never] }, 'invalid_quantity')
    }
  })

  it('blocks a malformed request shape before any lookup', async () => {
    const h = harness()
    expectFail(await createTrustedCheckout(h.deps, { items: [] }), 'cart_invalid')
    assert.deepEqual(h.kustomCalls, [])
    assert.deepEqual(h.writes, [])
  })
})

/* ------------------------------ promo behaviour ------------------------------ */

describe('createTrustedCheckout — valid promo', () => {
  it('revalidates a percentage code and applies it to the Kustom lines', async () => {
    const h = harness()
    const result = expectOk(
      await createTrustedCheckout(h.deps, { ...CART, promoCode: '  welcome10 ' }),
    )

    assert.equal(result.promo?.code, 'WELCOME10')
    assert.equal(result.totals.discount, 44.9)
    assert.equal(result.totals.total, 473.1)

    const sent = h.kustomCalls[0]
    assert.equal(sent.order_amount, 47_310)
    assert.equal(sent.order_tax_amount, 9_462)
    assert.equal(sent.order_lines[0].unit_price, 44_900)
    assert.equal(sent.order_lines[0].total_discount_amount, 4_490)
    assert.equal(sent.order_lines[0].total_amount, 40_410)
    assert.equal(sent.order_lines[0].total_tax_amount, 8_082)
  })

  it('revalidates a fixed code', async () => {
    const h = harness({
      codes: [{ ...WELCOME, code: 'ABOKS100', discountType: 'fixed', discountValue: 100 }],
    })
    const result = expectOk(await createTrustedCheckout(h.deps, { ...CART, promoCode: 'ABOKS100' }))
    assert.equal(result.totals.discount, 100)
    assert.equal(result.totals.total, 418)
    assert.equal(h.kustomCalls[0].order_amount, 41_800)
  })

  it('discounts only the eligible lines of a product-restricted code', async () => {
    const h = harness({ codes: [{ ...WELCOME, applicableProducts: [1] }] })
    const result = expectOk(
      await createTrustedCheckout(h.deps, {
        items: [
          { variantId: '10', quantity: 1 },
          { variantId: '20', quantity: 1 },
        ],
        promoCode: 'WELCOME10',
      }),
    )

    const byRef = Object.fromEntries(h.kustomCalls[0].order_lines.map((l) => [l.reference, l]))
    assert.equal(byRef['10'].total_discount_amount, 4_490)
    assert.equal(byRef['20'].total_discount_amount, 0)
    assert.equal(byRef['20'].total_amount, 29_900)
    assert.equal(result.totals.subtotal, 748)
    assert.equal(result.totals.discount, 44.9)
  })

  it('never discounts shipping', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' })
    const shipping = h.kustomCalls[0].order_lines.find((l) => l.type === 'shipping_fee')!
    assert.equal(shipping.total_discount_amount, 0)
    assert.equal(shipping.total_amount, 6_900)
  })

  it('sums the line discounts to exactly the order discount', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, {
      items: [
        { variantId: '10', quantity: 1 },
        { variantId: '11', quantity: 2 },
      ],
      promoCode: 'WELCOME10',
    })
    const sent = h.kustomCalls[0]
    const summed = sent.order_lines.reduce((s, l) => s + l.total_discount_amount, 0)
    const gross = sent.order_lines
      .filter((l) => l.type === 'physical')
      .reduce((s, l) => s + l.unit_price * l.quantity, 0)
    assert.equal(summed, Math.round((gross * 10) / 100))
    assert.equal(
      sent.order_amount,
      sent.order_lines.reduce((s, l) => s + l.total_amount, 0),
    )
  })
})

describe('createTrustedCheckout — promo no longer usable', () => {
  const rejects = async (h: Harness, reason: string) => {
    const result = await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' })
    const failure = expectFail(result, 'promo_invalid')
    if (failure.ok) throw new Error('unreachable')
    assert.equal(failure.reason, reason)
    assert.deepEqual(h.kustomCalls, [], 'Kustom must not be called for a rejected promo')
    assert.deepEqual(h.writes, [], 'no pending order may be created')
    // The customer is shown what they WOULD pay without the code — never charged silently.
    assert.deepEqual(failure.trustedTotals, { subtotal: 449, discount: 0, shipping: 69, total: 518 })
    return failure
  }

  it('blocks an expired code and returns the Norwegian reason', async () => {
    const h = harness({
      codes: [{ ...WELCOME, expiresAt: new Date(Date.now() - 86_400_000).toISOString() }],
    })
    const failure = await rejects(h, 'expired')
    assert.equal(failure.message, 'Denne rabattkoden er utløpt.')
  })

  it('blocks an inactive code', async () => {
    await rejects(harness({ codes: [{ ...WELCOME, active: false }] }), 'inactive')
  })

  // Usage-limited modes are not supported at launch (see ./supportPolicy.ts), so they are
  // refused as `not_supported` before any counting happens. What matters here is unchanged:
  // Kustom is never called and no order is created.
  it('blocks a single-use code', async () => {
    const h = harness({
      codes: [{ ...WELCOME, usageMode: 'single_use_global' }],
      usages: [{ promoCode: 7, order: 99 }],
    })
    await rejects(h, 'not_supported')
  })

  it('blocks a limited-count code', async () => {
    const h = harness({
      codes: [{ ...WELCOME, usageMode: 'limited', maxUses: 2 }],
      usages: [{ promoCode: 7, order: 1 }, { promoCode: 7, order: 2 }],
    })
    await rejects(h, 'not_supported')
  })

  it('blocks a once-per-customer code', async () => {
    const h = harness({ codes: [{ ...WELCOME, usageMode: 'once_per_customer' }] })
    await rejects(h, 'not_supported')
  })

  it('blocks a code below its minimum', async () => {
    await rejects(harness({ codes: [{ ...WELCOME, minimumOrderAmount: 900 }] }), 'minimum_not_reached')
  })

  it('blocks a code that no longer applies to the cart', async () => {
    await rejects(harness({ codes: [{ ...WELCOME, applicableProducts: [99] }] }), 'no_eligible_products')
  })

  it('blocks an unknown code rather than charging full price', async () => {
    await rejects(harness({ codes: [] }), 'not_found')
  })
})

describe('createTrustedCheckout — promo lookup temporarily unavailable', () => {
  it('creates nothing and returns a retryable error', async () => {
    const h = harness({ throwOn: 'promo-codes' })
    const result = expectFail(
      await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' }),
      'promo_unavailable',
    )
    assert.deepEqual(h.kustomCalls, [], 'no full-price order may be created behind the scenes')
    assert.deepEqual(h.writes, [])
    if (result.ok) throw new Error('unreachable')
    assert.ok(!result.message.includes('Postgres'), 'no database detail reaches the customer')
  })

  it('does the same when the promo lookup fails on a supported code', async () => {
    const h = harness({ throwOn: 'promo-codes' })
    expectFail(
      await createTrustedCheckout(h.deps, { ...CART, promoCode: 'ABOKS100' }),
      'promo_unavailable',
    )
    assert.deepEqual(h.kustomCalls, [])
    assert.deepEqual(h.writes, [])
  })
})

describe('createTrustedCheckout — no promo code', () => {
  it('behaves exactly as an ordinary checkout', async () => {
    const h = harness()
    const result = expectOk(await createTrustedCheckout(h.deps, CART))

    assert.equal(result.promo, null)
    assert.equal(result.totals.discount, 0)
    assert.equal(h.kustomCalls[0].order_amount, 51_800)
    assert.equal(h.kustomCalls[0].order_tax_amount, 10_360)
    assert.equal(h.kustomCalls[0].order_lines[0].total_discount_amount, 0)
    // No discount group is written for an ordinary order.
    assert.equal(h.writes[0].data.discount, undefined)
  })

  it('keeps the existing Kustom request shape', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, CART)
    const sent = h.kustomCalls[0]

    assert.equal(sent.purchase_country, 'NO')
    assert.equal(sent.purchase_currency, 'NOK')
    assert.equal(sent.locale, 'nb-NO')
    assert.deepEqual(sent.billing_countries, ['NO'])
    assert.deepEqual(sent.shipping_countries, ['NO'])
    assert.equal(sent.merchant_reference, 'AB-028412')
    assert.equal(sent.merchant_urls.terms, 'https://aboks.no/kjopsvilkar')
    assert.equal(
      sent.merchant_urls.push,
      'https://aboks.no/api/kustom/webhook?order_id={checkout.order.id}',
    )
    // Option A: no separate discount line, no discount type.
    assert.deepEqual(sent.order_lines.map((l) => l.type), ['physical', 'shipping_fee'])
  })
})

/* ------------------------------ order snapshot ------------------------------ */

describe('createTrustedCheckout — pending order snapshot', () => {
  it('stores server prices, the allocation and the promo snapshot', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' })

    const order = h.writes[0].data as Record<string, any>
    assert.equal(order.orderNumber, 'AB-028412')
    assert.equal(order.kustomOrderId, 'kustom-abc-123')
    assert.equal(order.status, 'pending')
    assert.equal(order.subtotal, 449)
    assert.equal(order.shipping, 69)
    assert.equal(order.total, 473.1)

    assert.equal(order.items[0].variant, 10)
    assert.equal(order.items[0].displayName, 'aBoks Vegg – Mørk blå')
    assert.equal(order.items[0].variantName, 'Mørk blå')
    assert.equal(order.items[0].unitPrice, 449)
    assert.equal(order.items[0].lineTotal, 449, 'line total stays PRE-discount')
    assert.equal(order.items[0].discountAmount, 44.9)

    assert.equal(order.discount.code, 'WELCOME10')
    assert.equal(order.discount.promoCode, 7)
    assert.equal(order.discount.discountType, 'percentage')
    assert.equal(order.discount.discountValue, 10)
    assert.equal(order.discount.discountAmount, 44.9)
    assert.equal(order.discount.subtotalBeforeDiscount, 449)
    assert.equal(order.discount.subtotalAfterDiscount, 404.1)
    assert.equal(order.discount.totalBeforeDiscount, 518)
    assert.equal(order.discount.totalAfterDiscount, 473.1)
  })

  it('the stored total equals the Kustom order_amount, and line discounts agree', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' })

    const order = h.writes[0].data as Record<string, any>
    const sent = h.kustomCalls[0]
    assert.equal(Math.round(order.total * 100), sent.order_amount)
    assert.equal(Math.round(order.items[0].discountAmount * 100), sent.order_lines[0].total_discount_amount)
    // The identity the PDF receipt reads.
    assert.equal(
      Math.round((order.subtotal + order.shipping - order.total) * 100),
      Math.round(order.discount.discountAmount * 100),
    )
  })

  it('never stores a browser-supplied price or name', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, {
      items: [{ variantId: '10', quantity: 1, price: 1, displayName: 'Gratis aBoks' }],
    } as unknown as CheckoutInput)

    const serialised = JSON.stringify(h.writes[0].data)
    assert.ok(!serialised.includes('Gratis aBoks'))
    assert.ok(!/"unitPrice":1[,}]/.test(serialised))
  })

  it('creates no promo-code-usage row during checkout', async () => {
    const h = harness()
    await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' })
    assert.deepEqual(
      h.writes.map((w) => w.collection),
      ['orders'],
      'checkout must never register promo usage',
    )
  })

  it('still lets the customer pay when the local write fails', async () => {
    const h = harness({ createFailsInDb: true })
    const result = expectOk(await createTrustedCheckout(h.deps, CART))
    assert.equal(result.kustomOrderId, 'kustom-abc-123')
  })
})

/* ------------------------------ Kustom failures ------------------------------ */

describe('createTrustedCheckout — Kustom failures', () => {
  it('reports a refused order without leaking the API response', async () => {
    const h = harness({ createFails: true })
    const result = expectFail(await createTrustedCheckout(h.deps, CART), 'payment_unavailable')
    if (result.ok) throw new Error('unreachable')
    assert.ok(!result.message.includes('400'))
    assert.ok(!result.message.includes('Bad value'))
    assert.deepEqual(h.writes, [], 'no local order when Kustom refused')
  })

  it('reports an account with no payment methods enabled', async () => {
    const h = harness({
      createReturns: { html_snippet: '', external_payment_methods: [], external_checkouts: [] },
    })
    const result = expectFail(await createTrustedCheckout(h.deps, CART), 'payment_unavailable')
    if (result.ok) throw new Error('unreachable')
    assert.match(result.message, /betalingsmetoder/)
  })

  it('falls back to a generated order number when the allocator is down', async () => {
    const h = harness({ allocateFails: true })
    expectOk(await createTrustedCheckout(h.deps, CART))
    assert.equal(h.kustomCalls[0].merchant_reference, 'AB-099999')
  })
})

/* ------------------------------ logging and safety ------------------------------ */

describe('createTrustedCheckout — logging', () => {
  it('never logs the promo code or a raw database error', async () => {
    const h = harness({ throwOn: 'promo-codes' })
    await createTrustedCheckout(h.deps, { ...CART, promoCode: 'WELCOME10' })
    const serialised = JSON.stringify(h.logs)
    assert.ok(h.logs.length > 0)
    assert.ok(!serialised.includes('WELCOME10'))
    assert.ok(!serialised.includes('PostgresError'))
  })
})

/* ------------------------------ existing checkout ------------------------------ */

describe('checkoutResultFromKustomOrder', () => {
  it('reads the discount back off the physical lines', () => {
    const order = {
      order_id: 'kustom-abc-123',
      html_snippet: '<div/>',
      order_amount: 47_310,
      order_tax_amount: 9_462,
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
    } as unknown as KustomOrder

    const result = expectOk(checkoutResultFromKustomOrder(order))
    assert.deepEqual(result.totals, { subtotal: 449, discount: 44.9, shipping: 69, total: 473.1 })
    assert.equal(result.lines[0].lineTotal, 449)
    assert.equal(result.lines[0].discountAmount, 44.9)
  })
})

/* ------------------------ products with no variants ------------------------ */

describe('createTrustedCheckout — a product with no variants', () => {
  it('prices it, references it as a product line, and stores an order line with no variant', async () => {
    const h = harness()
    const result = expectOk(
      await createTrustedCheckout(h.deps, { items: [{ productId: '7', quantity: 2 }] }),
    )

    assert.equal(result.totals.subtotal, 258)
    assert.equal(result.lines[0].variantId, null, 'no variant is invented for it')
    assert.equal(result.lines[0].productId, '7')
    assert.equal(result.lines[0].displayName, 'GP Ultra Plus Alkaline AA-batteri, 10-pakk')

    // The Kustom reference is the namespaced product form, so the push webhook can read it
    // back and decrement the right row.
    assert.equal(h.kustomCalls[0].order_lines[0].reference, 'product-7')

    const items = h.writes[0].data.items as Record<string, unknown>[]
    assert.equal(items[0].product, 7)
    assert.equal('variant' in items[0], false, 'the order line stores no variant at all')
    assert.equal(items[0].quantity, 2)
    assert.equal(items[0].unitPrice, 129)
    assert.equal(items[0].lineTotal, 258)
    assert.equal(items[0].displayName, 'GP Ultra Plus Alkaline AA-batteri, 10-pakk')
  })

  it('refuses more than the product has in stock, before Kustom is ever called', async () => {
    const h = harness()
    const result = await createTrustedCheckout(h.deps, { items: [{ productId: '7', quantity: 11 }] })

    assert.equal(expectFail(result, 'cart_invalid').reason, 'insufficient_stock')
    assert.equal(h.kustomCalls.length, 0, 'nobody is sent to a payment screen')
    assert.equal(h.writes.length, 0, 'and no order is written')
  })

  it('refuses a bare product line for a product that does have variants', async () => {
    const h = harness()
    const result = await createTrustedCheckout(h.deps, { items: [{ productId: '1', quantity: 1 }] })

    assert.equal(expectFail(result, 'cart_invalid').reason, 'variant_required')
    assert.equal(h.kustomCalls.length, 0)
  })
})

describe('createTrustedCheckout — a mixed cart', () => {
  it('carries a variant line and a variant-less line through to one order', async () => {
    const h = harness()
    const result = expectOk(
      await createTrustedCheckout(h.deps, {
        items: [
          { variantId: '10', quantity: 1 },
          { productId: '7', quantity: 2 },
        ],
      }),
    )

    // 449 + 2 × 129 = 707 kr → over the free-shipping threshold.
    assert.equal(result.totals.subtotal, 707)
    assert.equal(result.totals.shipping, 0)
    assert.equal(result.totals.total, 707)

    assert.deepEqual(
      h.kustomCalls[0].order_lines.map((l) => l.reference),
      ['10', 'product-7'],
      'the variant line keeps its bare id, exactly as before',
    )

    const items = h.writes[0].data.items as Record<string, unknown>[]
    assert.equal(items[0].variant, 10)
    assert.equal(items[0].product, 1)
    assert.equal(items[1].product, 7)
    assert.equal('variant' in items[1], false)
  })

  it('splits a promo discount across both kinds of line', async () => {
    const h = harness()
    const result = expectOk(
      await createTrustedCheckout(h.deps, {
        items: [
          { variantId: '10', quantity: 1 },
          { productId: '7', quantity: 2 },
        ],
        promoCode: 'WELCOME10',
      }),
    )

    // 10 % of 707 kr, and every line must get its share — a variant-less line losing its
    // allocation would break the order's subtotal + shipping − total === discount identity.
    assert.equal(result.totals.discount, 70.7)
    const allocated = result.lines.reduce((sum, l) => sum + l.discountAmount, 0)
    assert.equal(Math.round(allocated * 100), 7_070)
    assert.ok(
      result.lines.every((l) => l.discountAmount > 0),
      'neither line is left out of the allocation',
    )
  })
})

describe('checkoutResultFromKustomOrder — reading a product reference back', () => {
  it('splits the reference into its two halves', () => {
    const order = {
      order_id: 'k-1',
      order_amount: 25_800,
      order_lines: [
        {
          type: 'physical',
          reference: 'product-7',
          name: 'GP Ultra Plus Alkaline AA-batteri, 10-pakk',
          quantity: 2,
          unit_price: 12_900,
          total_amount: 25_800,
          total_discount_amount: 0,
        },
        {
          type: 'physical',
          reference: '10',
          name: 'aBoks Vegg – Mørk blå',
          quantity: 1,
          unit_price: 44_900,
          total_amount: 44_900,
          total_discount_amount: 0,
        },
      ],
    } as unknown as KustomOrder

    const result = expectOk(checkoutResultFromKustomOrder(order))
    assert.equal(result.lines[0].variantId, null)
    assert.equal(result.lines[0].productId, '7')
    assert.equal(result.lines[1].variantId, '10')
    assert.equal(result.lines[1].productId, null)
  })
})
