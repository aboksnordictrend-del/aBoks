import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import {
  FREE_SHIPPING_THRESHOLD_KR,
  SHIPPING_COST_OERE,
  priceCart,
  shippingForSubtotalOere,
  toOere,
} from './cartPricing'

/**
 * Catalogue stand-in. `priceCart` issues exactly two `find` calls — variants, then their
 * parent products — so the double answers both from plain objects. Nothing here touches a
 * database.
 */
type FakeVariant = {
  id: number
  product: number | null
  name?: string | null
  displayName?: string | null
  inventory?: number | null
}
type FakeProduct = {
  id: number
  title?: string | null
  price?: number | null
  published?: boolean | null
  salePrice?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
  /** Only read for a product with no variants — see @/lib/stock. */
  stock?: number | null
}

type FakeWhere = { id?: { in: (string | number)[] }; product?: { in: (string | number)[] } }

function fakePayload(opts: {
  variants: FakeVariant[]
  products: FakeProduct[]
  throwOn?: 'product-variants' | 'products'
}): { payload: Payload; queries: string[] } {
  const queries: string[] = []
  const payload = {
    find: async ({ collection, where }: { collection: string; where?: FakeWhere }) => {
      queries.push(collection)
      if (opts.throwOn === collection) throw new Error('connection lost')

      // `product in (…)` is the existence check priceCart runs for a variant-less line: does
      // this product really have no variants? Answered from the same fixture list.
      if (where?.product?.in) {
        const parents = where.product.in.map(String)
        return {
          docs: opts.variants.filter((v) => parents.includes(String(v.product))),
        }
      }

      const ids = (where?.id?.in ?? []).map(String)
      const source = collection === 'product-variants' ? opts.variants : opts.products
      return { docs: source.filter((doc) => ids.includes(String(doc.id))) }
    },
    logger: { error: () => {}, warn: () => {} },
  } as unknown as Payload
  return { payload, queries }
}

const CATALOGUE = {
  variants: [
    { id: 10, product: 1, name: 'Mørk blå', displayName: 'aBoks Vegg – Mørk blå', inventory: 12 },
    { id: 11, product: 1, name: 'Sort', displayName: 'aBoks Vegg – Sort', inventory: 4 },
    { id: 20, product: 2, name: 'Creme', displayName: 'aBoks Mini – Creme', inventory: 7 },
  ] satisfies FakeVariant[],
  products: [
    { id: 1, title: 'aBoks Vegg', price: 449, published: true },
    { id: 2, title: 'aBoks Mini', price: 299, published: true },
  ] satisfies FakeProduct[],
}

const ok = (result: Awaited<ReturnType<typeof priceCart>>) => {
  assert.equal(result.ok, true, `expected success, got ${'reason' in result ? result.reason : ''}`)
  if (!result.ok) throw new Error('unreachable')
  return result.cart
}

describe('shippingForSubtotalOere', () => {
  it('keeps the existing 69 kr / 650 kr rule', () => {
    assert.equal(shippingForSubtotalOere(toOere(FREE_SHIPPING_THRESHOLD_KR - 1)), SHIPPING_COST_OERE)
    assert.equal(shippingForSubtotalOere(toOere(FREE_SHIPPING_THRESHOLD_KR)), 0)
    assert.equal(shippingForSubtotalOere(toOere(FREE_SHIPPING_THRESHOLD_KR + 1)), 0)
  })
})

describe('priceCart — trusted pricing', () => {
  it('ignores a price the client sends and uses the catalogue price', async () => {
    const { payload } = fakePayload(CATALOGUE)
    // A tampered cart: 1 kr for a 449 kr product, plus junk fields.
    const tampered = [
      { variantId: '10', quantity: 1, price: 1, lineTotal: 1, name: 'Gratis aBoks', discount: 999 },
    ] as unknown as Parameters<typeof priceCart>[1]

    const cart = ok(await priceCart(payload, tampered))
    assert.equal(cart.lines[0].unitPriceOere, 44_900)
    assert.equal(cart.lines[0].lineTotalOere, 44_900)
    assert.equal(cart.subtotalOere, 44_900)
    // And the client-supplied name never reaches the result either.
    assert.equal(cart.lines[0].displayName, 'aBoks Vegg – Mørk blå')
  })

  it('loads the current price from the database, not the one the cart was built with', async () => {
    const { payload } = fakePayload({
      ...CATALOGUE,
      products: [{ id: 1, title: 'aBoks Vegg', price: 549, published: true }],
    })
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 2 }]))
    assert.equal(cart.lines[0].unitPriceOere, 54_900)
    assert.equal(cart.subtotalOere, 109_800)
  })

  it('applies an active sale through the shared effective-price rule', async () => {
    const { payload } = fakePayload({
      ...CATALOGUE,
      products: [{ id: 1, title: 'aBoks Vegg', price: 449, salePrice: 349, published: true }],
    })
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 1 }]))
    assert.equal(cart.lines[0].unitPriceOere, 34_900)
  })

  it('ignores a sale whose window has passed', async () => {
    const { payload } = fakePayload({
      ...CATALOGUE,
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
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 1 }]))
    assert.equal(cart.lines[0].unitPriceOere, 44_900)
  })

  it('ignores a "sale" price that is not actually lower', async () => {
    const { payload } = fakePayload({
      ...CATALOGUE,
      products: [{ id: 1, title: 'aBoks Vegg', price: 449, salePrice: 599, published: true }],
    })
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 1 }]))
    assert.equal(cart.lines[0].unitPriceOere, 44_900)
  })

  it('resolves the parent product and the variant display name', async () => {
    const { payload } = fakePayload(CATALOGUE)
    const cart = ok(await priceCart(payload, [{ variantId: '20', quantity: 1 }]))
    assert.equal(cart.lines[0].productId, '2')
    assert.equal(cart.lines[0].displayName, 'aBoks Mini – Creme')
    assert.equal(cart.lines[0].variantName, 'Creme')
    assert.equal(cart.lines[0].inventory, 7)
  })

  it('composes a display name from the product title when the variant has none', async () => {
    const { payload } = fakePayload({
      ...CATALOGUE,
      variants: [{ id: 10, product: 1, name: 'Mørk blå' }],
    })
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 1 }]))
    assert.equal(cart.lines[0].displayName, 'aBoks Vegg – Mørk blå')
  })

  it('uses two bounded queries regardless of how many lines the cart has', async () => {
    const { payload, queries } = fakePayload(CATALOGUE)
    ok(
      await priceCart(payload, [
        { variantId: '10', quantity: 1 },
        { variantId: '11', quantity: 1 },
        { variantId: '20', quantity: 1 },
      ]),
    )
    assert.deepEqual(queries, ['product-variants', 'products'])
  })

  it('merges duplicate lines for the same variant', async () => {
    const { payload } = fakePayload(CATALOGUE)
    const cart = ok(
      await priceCart(payload, [
        { variantId: '10', quantity: 1 },
        { variantId: '10', quantity: 2 },
      ]),
    )
    assert.equal(cart.lines.length, 1)
    assert.equal(cart.lines[0].quantity, 3)
    assert.equal(cart.subtotalOere, 134_700)
  })
})

describe('priceCart — rejection', () => {
  const reject = async (
    lines: unknown,
    expected: string,
    catalogue: Parameters<typeof fakePayload>[0] = CATALOGUE,
  ) => {
    const { payload } = fakePayload(catalogue)
    const result = await priceCart(payload, lines as Parameters<typeof priceCart>[1])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, expected)
    assert.ok(result.message.length > 0, 'every failure carries a Norwegian message')
  }

  it('rejects an empty cart', async () => {
    await reject([], 'cart_empty')
    await reject(null, 'cart_empty')
  })

  it('rejects a malformed line', async () => {
    await reject([null], 'invalid_line')
    await reject([{ quantity: 1 }], 'invalid_line')
    await reject([{ variantId: '   ', quantity: 1 }], 'invalid_line')
  })

  it('rejects invalid quantities', async () => {
    await reject([{ variantId: '10', quantity: 0 }], 'invalid_quantity')
    await reject([{ variantId: '10', quantity: -3 }], 'invalid_quantity')
    await reject([{ variantId: '10', quantity: 1.5 }], 'invalid_quantity')
    await reject([{ variantId: '10', quantity: NaN }], 'invalid_quantity')
    await reject([{ variantId: '10', quantity: 100 }], 'invalid_quantity')
    await reject([{ variantId: '10', quantity: '2' }], 'invalid_quantity')
  })

  it('rejects a variant that no longer exists', async () => {
    await reject([{ variantId: '999', quantity: 1 }], 'variant_not_found')
  })

  it('rejects a variant whose parent product is gone', async () => {
    await reject([{ variantId: '10', quantity: 1 }], 'product_not_found', {
      variants: [{ id: 10, product: 1, name: 'Mørk blå' }],
      products: [],
    })
    await reject([{ variantId: '10', quantity: 1 }], 'product_not_found', {
      variants: [{ id: 10, product: null, name: 'Mørk blå' }],
      products: CATALOGUE.products,
    })
  })

  it('rejects a product that has been unpublished', async () => {
    await reject([{ variantId: '10', quantity: 1 }], 'product_unavailable', {
      variants: CATALOGUE.variants,
      products: [{ id: 1, title: 'aBoks Vegg', price: 449, published: false }],
    })
  })

  it('rejects a product with no usable price', async () => {
    await reject([{ variantId: '10', quantity: 1 }], 'invalid_price', {
      variants: CATALOGUE.variants,
      products: [{ id: 1, title: 'aBoks Vegg', price: null, published: true }],
    })
  })

  it('reports a failing catalogue lookup instead of pricing zero', async () => {
    await reject([{ variantId: '10', quantity: 1 }], 'lookup_failed', {
      ...CATALOGUE,
      throwOn: 'product-variants',
    })
  })
})

describe('priceCart — shipping', () => {
  it('charges shipping under the threshold', async () => {
    const { payload } = fakePayload(CATALOGUE)
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 1 }]))
    assert.equal(cart.subtotalOere, 44_900)
    assert.equal(cart.shippingOere, 6_900)
    assert.equal(cart.totalOere, 51_800)
    assert.equal(cart.freeShipping, false)
    assert.equal(cart.totalKr, 518)
  })

  it('gives free shipping at or above the threshold', async () => {
    const { payload } = fakePayload(CATALOGUE)
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 2 }]))
    assert.equal(cart.subtotalOere, 89_800)
    assert.equal(cart.shippingOere, 0)
    assert.equal(cart.freeShipping, true)
  })

  it('reports kroner and øre consistently', async () => {
    const { payload } = fakePayload(CATALOGUE)
    const cart = ok(await priceCart(payload, [{ variantId: '20', quantity: 3 }]))
    assert.equal(cart.subtotalOere, 89_700)
    assert.equal(cart.subtotalKr, 897)
    assert.equal(cart.lines[0].unitPriceKr, 299)
    assert.equal(cart.lines[0].lineTotalKr, 897)
  })
})

/**
 * Variant-less products — the case that has no Product Variant row at all, and is therefore
 * priced and stock-checked against the product itself.
 */
const MIXED_CATALOGUE = {
  variants: [
    { id: 10, product: 1, name: 'Mørk blå', displayName: 'aBoks Vegg – Mørk blå', inventory: 12 },
  ] satisfies FakeVariant[],
  products: [
    { id: 1, title: 'aBoks Vegg', price: 449, published: true },
    // No variant row points at these two.
    { id: 7, title: 'GP Ultra Plus Alkaline AA-batteri, 10-pakk', price: 129, published: true, stock: 10 },
    { id: 8, title: 'Utsolgt tilbehør', price: 99, published: true, stock: 0 },
  ] satisfies FakeProduct[],
}

describe('priceCart — a product with no variants', () => {
  it('prices a line sent as a bare product', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const cart = ok(await priceCart(payload, [{ productId: '7', quantity: 1 }]))

    assert.equal(cart.lines.length, 1)
    assert.equal(cart.lines[0].variantId, null, 'no variant is invented for it')
    assert.equal(cart.lines[0].productId, '7')
    assert.equal(cart.lines[0].displayName, 'GP Ultra Plus Alkaline AA-batteri, 10-pakk')
    assert.equal(cart.lines[0].variantName, '', 'a product with no colours has no colour name')
    assert.equal(cart.lines[0].unitPriceOere, 12_900)
    assert.equal(cart.lines[0].inventory, 10, 'stock is reported from the product')
  })

  it('allows exactly the stock on the shelf', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const cart = ok(await priceCart(payload, [{ productId: '7', quantity: 10 }]))
    assert.equal(cart.lines[0].quantity, 10)
  })

  it('refuses more than the stock on the shelf', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const result = await priceCart(payload, [{ productId: '7', quantity: 11 }])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'insufficient_stock')
    assert.equal(result.ref, 'product-7')
  })

  it('counts merged duplicate lines against the same stock', async () => {
    // Two lines of 6 is a request for 12 — it must not sneak past a stock of 10 as two
    // separately-legal halves.
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const result = await priceCart(payload, [
      { productId: '7', quantity: 6 },
      { productId: '7', quantity: 6 },
    ])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'insufficient_stock')
  })

  it('refuses a sold-out product outright', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const result = await priceCart(payload, [{ productId: '8', quantity: 1 }])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'insufficient_stock')
  })

  it('refuses a bare product line for a product that DOES have variants', async () => {
    // The rule made unbypassable: product 1 is an aBoks with colours, so it can never be
    // bought against `products.stock` — even by a hand-crafted request.
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const result = await priceCart(payload, [{ productId: '1', quantity: 1 }])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'variant_required')
  })

  it('lets the variant win when a line carries both identifiers', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const cart = ok(await priceCart(payload, [{ variantId: '10', productId: '7', quantity: 1 }]))
    assert.equal(cart.lines[0].variantId, '10')
    assert.equal(cart.lines[0].productId, '1')
    assert.equal(cart.lines[0].unitPriceOere, 44_900)
  })

  it('rejects a line with neither identifier', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const result = await priceCart(payload, [{ quantity: 1 } as never])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'invalid_line')
  })
})

describe('priceCart — a mixed cart', () => {
  it('prices a variant line and a variant-less line side by side', async () => {
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const cart = ok(
      await priceCart(payload, [
        { variantId: '10', quantity: 1 },
        { productId: '7', quantity: 2 },
      ]),
    )

    assert.equal(cart.lines.length, 2)
    assert.equal(cart.lines[0].variantId, '10')
    assert.equal(cart.lines[0].variantName, 'Mørk blå')
    assert.equal(cart.lines[1].variantId, null)
    assert.equal(cart.lines[1].productId, '7')
    // 449 + 2 × 129 = 707 kr, which clears the free-shipping threshold.
    assert.equal(cart.subtotalOere, 70_700)
    assert.equal(cart.shippingOere, 0)
  })

  it('leaves a variant line’s stock unenforced, exactly as before', async () => {
    // Deliberate and unchanged: the shop has never blocked a checkout on variant inventory,
    // and this feature does not change that for any existing product.
    const { payload } = fakePayload(MIXED_CATALOGUE)
    const cart = ok(await priceCart(payload, [{ variantId: '10', quantity: 20 }]))
    assert.equal(cart.lines[0].quantity, 20)
    assert.equal(cart.lines[0].inventory, 12)
  })
})
