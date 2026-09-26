import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import {
  FREE_SHIPPING_THRESHOLD_KR,
  MAX_LINE_QUANTITY,
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
  /** The quantity-pricing key. Left off in most fixtures, so they price as before. */
  slug?: string | null
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
    // One past the shared limit. Written as the constant rather than a literal, so raising
    // the limit moves this case with it instead of quietly leaving a hole under it.
    await reject([{ variantId: '10', quantity: MAX_LINE_QUANTITY + 1 }], 'invalid_quantity')
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

/**
 * Quantity pricing at the trust boundary.
 *
 * The same table the cart displays from, applied where it actually decides what is charged.
 * The fixtures below carry real slugs and real catalogue prices; everything above this point
 * uses slug-less products, which is what proves an unconfigured product is untouched.
 */
describe('priceCart — quantity pricing', () => {
  /** aBoks Mini (349 / 299 / 249, quote at 40) and aBoks XL (849 / 799 / 749, quote at 11). */
  const TIERED = {
    variants: [
      { id: 30, product: 3, name: 'Sort', displayName: 'aBoks Mini – Sort', inventory: 500 },
      { id: 40, product: 4, name: 'Sort', displayName: 'aBoks XL – Sort', inventory: 500 },
    ] satisfies FakeVariant[],
    products: [
      { id: 3, title: 'aBoks Mini', slug: 'aboks-mini', price: 349, published: true },
      { id: 4, title: 'aBoks XL', slug: 'aboks-xl', price: 849, published: true },
    ] satisfies FakeProduct[],
  }

  it('charges the catalogue price below the first band', async () => {
    const { payload } = fakePayload(TIERED)
    const cart = ok(await priceCart(payload, [{ variantId: '30', quantity: 9 }]))
    assert.equal(cart.lines[0].unitPriceOere, 34_900)
    assert.equal(cart.lines[0].lineTotalOere, 9 * 34_900)
  })

  it('reprices the whole line once a band is reached', async () => {
    const { payload } = fakePayload(TIERED)
    const cart = ok(await priceCart(payload, [{ variantId: '30', quantity: 10 }]))
    assert.equal(cart.lines[0].unitPriceOere, 29_900)
    // 10 × 299, not 9 × 349 + 1 × 299.
    assert.equal(cart.lines[0].lineTotalOere, 299_000)
    assert.equal(cart.subtotalOere, 299_000)
  })

  it('walks every standard boundary', async () => {
    const expected: [number, number][] = [
      [1, 34_900],
      [9, 34_900],
      [10, 29_900],
      [19, 29_900],
      [20, 24_900],
      [39, 24_900],
      [40, 24_900],
      [41, 24_900],
    ]
    for (const [quantity, unitPriceOere] of expected) {
      const { payload } = fakePayload(TIERED)
      const cart = ok(await priceCart(payload, [{ variantId: '30', quantity }]))
      assert.equal(cart.lines[0].unitPriceOere, unitPriceOere, `@${quantity}`)
      assert.equal(cart.lines[0].lineTotalOere, unitPriceOere * quantity, `@${quantity}`)
    }
  })

  it('walks every aBoks XL boundary, on its own thresholds', async () => {
    const expected: [number, number][] = [
      [1, 84_900],
      [3, 84_900],
      [4, 79_900],
      [6, 79_900],
      [7, 74_900],
      [10, 74_900],
      [11, 74_900],
      [12, 74_900],
      // 20 is a standard boundary and means nothing to XL.
      [20, 74_900],
    ]
    for (const [quantity, unitPriceOere] of expected) {
      const { payload } = fakePayload(TIERED)
      const cart = ok(await priceCart(payload, [{ variantId: '40', quantity }]))
      assert.equal(cart.lines[0].unitPriceOere, unitPriceOere, `@${quantity}`)
    }
  })

  it('reports the quote threshold without changing the price', async () => {
    const { payload: a } = fakePayload(TIERED)
    const at39 = ok(await priceCart(a, [{ variantId: '30', quantity: 39 }]))
    const { payload: b } = fakePayload(TIERED)
    const at40 = ok(await priceCart(b, [{ variantId: '30', quantity: 40 }]))

    assert.equal(at39.lines[0].quoteAvailable, false)
    assert.equal(at40.lines[0].quoteAvailable, true)
    assert.equal(at40.lines[0].unitPriceOere, at39.lines[0].unitPriceOere)
    assert.equal(at40.lines[0].lineTotalOere, 996_000) // 40 × 249
    // And the order is still a perfectly ordinary one — nothing is excluded or blocked.
    assert.equal(at40.subtotalOere, 996_000)
    assert.equal(at40.freeShipping, true)
  })

  it('does the same for aBoks XL at 11', async () => {
    const { payload } = fakePayload(TIERED)
    const cart = ok(await priceCart(payload, [{ variantId: '40', quantity: 11 }]))
    assert.equal(cart.lines[0].quoteAvailable, true)
    assert.equal(cart.lines[0].unitPriceOere, 74_900)
    assert.equal(cart.lines[0].lineTotalOere, 823_900)
  })

  it('carries the pre-quantity base price alongside the effective one', async () => {
    const { payload } = fakePayload(TIERED)
    const cart = ok(await priceCart(payload, [{ variantId: '30', quantity: 12 }]))
    assert.equal(cart.lines[0].baseUnitPriceOere, 34_900)
    assert.equal(cart.lines[0].unitPriceOere, 29_900)
    assert.equal(cart.lines[0].baseUnitPriceKr, 349)
    assert.equal(cart.lines[0].unitPriceKr, 299)
  })

  it('never combines quantities of different products into a band', async () => {
    const { payload } = fakePayload(TIERED)
    // 9 Mini + 3 XL is 12 units, and neither line reaches its own second band.
    const cart = ok(
      await priceCart(payload, [
        { variantId: '30', quantity: 9 },
        { variantId: '40', quantity: 3 },
      ]),
    )
    assert.equal(cart.lines[0].unitPriceOere, 34_900)
    assert.equal(cart.lines[1].unitPriceOere, 84_900)
    assert.equal(cart.subtotalOere, 9 * 34_900 + 3 * 84_900)
  })

  it('bands a merged duplicate line on the merged quantity', async () => {
    const { payload } = fakePayload(TIERED)
    // Two entries for the same variant are one request for 12 — and that is what is priced.
    const cart = ok(
      await priceCart(payload, [
        { variantId: '30', quantity: 5 },
        { variantId: '30', quantity: 7 },
      ]),
    )
    assert.equal(cart.lines.length, 1)
    assert.equal(cart.lines[0].quantity, 12)
    assert.equal(cart.lines[0].unitPriceOere, 29_900)
  })

  it('bands each variant of one product separately', async () => {
    const { payload } = fakePayload({
      ...TIERED,
      variants: [
        ...TIERED.variants,
        { id: 31, product: 3, name: 'Creme', displayName: 'aBoks Mini – Creme', inventory: 500 },
      ],
    })
    // Two colours of aBoks Mini, 6 of each. Each variant is its own line and its own quantity;
    // they are not pooled into 12 just because they share a parent product.
    const cart = ok(
      await priceCart(payload, [
        { variantId: '30', quantity: 6 },
        { variantId: '31', quantity: 6 },
      ]),
    )
    assert.equal(cart.lines[0].unitPriceOere, 34_900)
    assert.equal(cart.lines[1].unitPriceOere, 34_900)
  })

  it('leaves a product with no configured bands exactly as it was', async () => {
    const { payload } = fakePayload({
      variants: [{ id: 50, product: 5, name: 'Sort', inventory: 500 }],
      products: [{ id: 5, title: 'AA-Modul', slug: 'aa-modul', price: 99, published: true }],
    })
    const cart = ok(await priceCart(payload, [{ variantId: '50', quantity: 40 }]))
    assert.equal(cart.lines[0].unitPriceOere, 9_900)
    assert.equal(cart.lines[0].lineTotalOere, 396_000)
    assert.equal(cart.lines[0].quoteAvailable, false)
  })

  it('never charges more than an active sale, whatever the band says', async () => {
    const { payload } = fakePayload({
      ...TIERED,
      products: [
        { id: 3, title: 'aBoks Mini', slug: 'aboks-mini', price: 349, salePrice: 279, published: true },
      ],
    })
    // The 10–19 band is 299, above the 279 sale price. The customer keeps 279.
    const cart = ok(await priceCart(payload, [{ variantId: '30', quantity: 10 }]))
    assert.equal(cart.lines[0].unitPriceOere, 27_900)
  })

  it('cannot be talked into a band by a tampered cart', async () => {
    const { payload } = fakePayload(TIERED)
    // The browser claims the 20+ price at a quantity of 2. Only the quantity is read.
    const tampered = [
      { variantId: '30', quantity: 2, price: 249, unitPrice: 249, tier: '20+' },
    ] as unknown as Parameters<typeof priceCart>[1]
    const cart = ok(await priceCart(payload, tampered))
    assert.equal(cart.lines[0].unitPriceOere, 34_900)
    assert.equal(cart.lines[0].lineTotalOere, 69_800)
  })

  it('decides free shipping on the effective subtotal', async () => {
    // 2 × 349 = 698 — over the 650 threshold at the catalogue price.
    const { payload: a } = fakePayload(TIERED)
    const two = ok(await priceCart(a, [{ variantId: '30', quantity: 2 }]))
    assert.equal(two.freeShipping, true)

    // 1 × 349 is under it, and pays for shipping, exactly as before.
    const { payload: b } = fakePayload(TIERED)
    const one = ok(await priceCart(b, [{ variantId: '30', quantity: 1 }]))
    assert.equal(one.shippingOere, SHIPPING_COST_OERE)
    assert.equal(one.totalOere, 34_900 + SHIPPING_COST_OERE)

    // And a volume-priced line still counts towards it on what is actually paid: 10 × 299.
    const { payload: c } = fakePayload(TIERED)
    const ten = ok(await priceCart(c, [{ variantId: '30', quantity: 10 }]))
    assert.equal(ten.freeShipping, true)
    assert.equal(ten.totalOere, 299_000)
  })

  it('keeps every figure in integer øre', async () => {
    const { payload } = fakePayload(TIERED)
    const cart = ok(
      await priceCart(payload, [
        { variantId: '30', quantity: 13 },
        { variantId: '40', quantity: 5 },
      ]),
    )
    for (const line of cart.lines) {
      assert.equal(Number.isInteger(line.unitPriceOere), true)
      assert.equal(Number.isInteger(line.lineTotalOere), true)
      assert.equal(Number.isInteger(line.baseUnitPriceOere), true)
    }
    assert.equal(Number.isInteger(cart.subtotalOere), true)
    assert.equal(cart.subtotalOere, 13 * 29_900 + 5 * 79_900)
    assert.equal(cart.subtotalKr, (13 * 29_900 + 5 * 79_900) / 100)
  })
})

/**
 * Large B2B orders.
 *
 * The cart used to stop at 99 units while the solution configurator offered 9 999 — so a
 * school ordering 120 aBoks Spesial built a cart that was refused at the payment step. One
 * shared limit now governs both, and these are its boundaries.
 */
describe('priceCart — large quantities', () => {
  /** aBoks Spesial: 299 / 249 / 199, quote at 40. */
  const SPESIAL = {
    variants: [
      { id: 80, product: 8, name: 'Sort', displayName: 'aBoks Spesial – Sort', inventory: 100_000 },
    ] satisfies FakeVariant[],
    products: [
      { id: 8, title: 'aBoks Spesial', slug: 'aboks-spesial', price: 299, published: true },
    ] satisfies FakeProduct[],
  }

  it('accepts every quantity up to the limit', async () => {
    for (const quantity of [99, 100, 999, 1000, MAX_LINE_QUANTITY]) {
      const { payload } = fakePayload(SPESIAL)
      const cart = ok(await priceCart(payload, [{ variantId: '80', quantity }]))
      assert.equal(cart.lines[0].quantity, quantity, `@${quantity}`)
      assert.equal(cart.lines[0].unitPriceOere, 19_900, `@${quantity}`)
      assert.equal(cart.lines[0].lineTotalOere, quantity * 19_900, `@${quantity}`)
    }
  })

  it('accepts 9999 and rejects 10000', async () => {
    assert.equal(MAX_LINE_QUANTITY, 9999)

    const { payload: a } = fakePayload(SPESIAL)
    const accepted = await priceCart(a, [{ variantId: '80', quantity: 9999 }])
    assert.equal(accepted.ok, true)

    const { payload: b } = fakePayload(SPESIAL)
    const rejected = await priceCart(b, [{ variantId: '80', quantity: 10_000 }])
    assert.equal(rejected.ok, false)
    if (rejected.ok) throw new Error('unreachable')
    assert.equal(rejected.reason, 'invalid_quantity')
  })

  it('rejects a merge that would cross the limit, rather than truncating it', async () => {
    const { payload } = fakePayload(SPESIAL)
    const result = await priceCart(payload, [
      { variantId: '80', quantity: 9000 },
      { variantId: '80', quantity: 1500 },
    ])
    assert.equal(result.ok, false)
    if (result.ok) throw new Error('unreachable')
    assert.equal(result.reason, 'invalid_quantity')
  })

  it('prices 120 × aBoks Spesial at 23 880 kr', async () => {
    const { payload } = fakePayload(SPESIAL)
    const cart = ok(await priceCart(payload, [{ variantId: '80', quantity: 120 }]))
    const line = cart.lines[0]

    // The 20–39 price continues above the quote threshold — 120 is not a fourth band.
    assert.equal(line.unitPriceOere, 19_900)
    assert.equal(line.unitPriceKr, 199)
    assert.equal(line.lineTotalOere, 2_388_000)
    assert.equal(line.lineTotalKr, 23_880)
    assert.equal(line.quantity, 120)
    // Still an ordinary order line: in the subtotal, in the total, free shipping earned.
    assert.equal(cart.subtotalKr, 23_880)
    assert.equal(cart.freeShipping, true)
    assert.equal(cart.totalKr, 23_880)
    // And the quote offer is available beside it, at that same price.
    assert.equal(line.quoteAvailable, true)
    assert.equal(line.baseUnitPriceKr, 299)
  })

  it('keeps a large order in safe-integer arithmetic', async () => {
    const { payload } = fakePayload(SPESIAL)
    const cart = ok(await priceCart(payload, [{ variantId: '80', quantity: MAX_LINE_QUANTITY }]))
    assert.equal(cart.subtotalOere, 9999 * 19_900)
    assert.equal(Number.isSafeInteger(cart.subtotalOere), true)
    assert.equal(Number.isInteger(cart.totalOere), true)
  })
})
