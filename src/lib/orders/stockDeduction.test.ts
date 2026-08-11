import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { deductOrderStock } from './stockDeduction'

/**
 * Taking a paid order's goods out of stock, without a database.
 *
 * The fake below is the whole catalogue: `findByID` reads from it and `update` writes back,
 * so an assertion on the final numbers is an assertion on what the real webhook would have
 * written.
 */

interface FakeVariant {
  id: number
  name?: string
  sku?: string
  inventory: number | null
}
interface FakeProduct {
  id: number
  title?: string
  stock: number | null
}

function fakePayload(opts: {
  variants?: FakeVariant[]
  products?: FakeProduct[]
  /** Collections whose reads should blow up, to prove one failure never stops the rest. */
  failReadOn?: ('product-variants' | 'products')[]
}) {
  const variants = new Map((opts.variants ?? []).map((v) => [v.id, { ...v }]))
  const products = new Map((opts.products ?? []).map((p) => [p.id, { ...p }]))
  const failRead = new Set(opts.failReadOn ?? [])

  const payload = {
    findByID: async ({ collection, id }: { collection: string; id: number }) => {
      if (failRead.has(collection as 'products')) throw new Error('connection lost')
      const doc = collection === 'product-variants' ? variants.get(id) : products.get(id)
      if (!doc) throw new Error('not found')
      return doc
    },
    update: async ({
      collection,
      id,
      data,
    }: {
      collection: string
      id: number
      data: Record<string, unknown>
    }) => {
      if (collection === 'product-variants') {
        const doc = variants.get(id)
        if (!doc) throw new Error('not found')
        doc.inventory = data.inventory as number
        return doc
      }
      const doc = products.get(id)
      if (!doc) throw new Error('not found')
      doc.stock = data.stock as number
      return doc
    },
  } as unknown as Payload

  return { payload, variants, products }
}

/** Swallows the module's logging so a test run stays readable. */
const silent = { info: () => {}, error: () => {} }

describe('deductOrderStock — variant lines behave exactly as before', () => {
  it('subtracts the quantity from the variant’s inventory', async () => {
    const { payload, variants } = fakePayload({
      variants: [{ id: 10, name: 'Mørk blå', inventory: 12 }],
    })

    const result = await deductOrderStock(payload, [{ variant: 10, quantity: 3 }], silent)

    assert.equal(variants.get(10)?.inventory, 9)
    assert.deepEqual(result, { variants: 1, products: 0, skipped: 0, failed: 0 })
  })

  it('reads a populated relationship as well as a bare id', async () => {
    const { payload, variants } = fakePayload({ variants: [{ id: 10, inventory: 5 }] })
    await deductOrderStock(payload, [{ variant: { id: 10 }, quantity: 2 }], silent)
    assert.equal(variants.get(10)?.inventory, 3)
  })

  it('never writes a negative inventory', async () => {
    const { payload, variants } = fakePayload({ variants: [{ id: 10, inventory: 2 }] })
    await deductOrderStock(payload, [{ variant: 10, quantity: 5 }], silent)
    assert.equal(variants.get(10)?.inventory, 0)
  })

  it('ignores the parent product when the line has a variant', async () => {
    // The rule stated as a test: a variant line is settled on the variant, and the parent's
    // own stock column is not touched even when the line carries it.
    const { payload, variants, products } = fakePayload({
      variants: [{ id: 10, inventory: 12 }],
      products: [{ id: 1, stock: 50 }],
    })

    await deductOrderStock(payload, [{ variant: 10, product: 1, quantity: 4 }], silent)

    assert.equal(variants.get(10)?.inventory, 8)
    assert.equal(products.get(1)?.stock, 50)
  })
})

describe('deductOrderStock — product lines', () => {
  it('subtracts the quantity from the product’s own stock', async () => {
    const { payload, products } = fakePayload({
      products: [{ id: 7, title: 'GP Ultra Plus AA 10-pakk', stock: 12 }],
    })

    const result = await deductOrderStock(payload, [{ product: 7, quantity: 3 }], silent)

    assert.equal(products.get(7)?.stock, 9)
    assert.deepEqual(result, { variants: 0, products: 1, skipped: 0, failed: 0 })
  })

  it('never writes a negative stock', async () => {
    const { payload, products } = fakePayload({ products: [{ id: 7, stock: 1 }] })
    await deductOrderStock(payload, [{ product: 7, quantity: 4 }], silent)
    assert.equal(products.get(7)?.stock, 0)
  })

  it('reads a product that has never had a stock figure as zero', async () => {
    const { payload, products } = fakePayload({ products: [{ id: 7, stock: null }] })
    await deductOrderStock(payload, [{ product: 7, quantity: 2 }], silent)
    assert.equal(products.get(7)?.stock, 0)
  })
})

describe('deductOrderStock — a mixed order', () => {
  it('settles each line against its own source', async () => {
    const { payload, variants, products } = fakePayload({
      variants: [{ id: 10, inventory: 12 }],
      products: [
        { id: 1, stock: 99 }, // the variant's parent — must not move
        { id: 7, stock: 12 }, // the variant-less accessory
      ],
    })

    const result = await deductOrderStock(
      payload,
      [
        { variant: 10, product: 1, quantity: 2 },
        { product: 7, quantity: 3 },
      ],
      silent,
    )

    assert.equal(variants.get(10)?.inventory, 10)
    assert.equal(products.get(7)?.stock, 9)
    assert.equal(products.get(1)?.stock, 99)
    assert.deepEqual(result, { variants: 1, products: 1, skipped: 0, failed: 0 })
  })
})

describe('deductOrderStock — nothing to do, and things going wrong', () => {
  it('skips a line with no identifier or no quantity', async () => {
    const { payload } = fakePayload({ products: [{ id: 7, stock: 5 }] })
    const result = await deductOrderStock(
      payload,
      [{ quantity: 2 }, { product: 7, quantity: 0 }, { product: 7 }],
      silent,
    )
    assert.deepEqual(result, { variants: 0, products: 0, skipped: 3, failed: 0 })
  })

  it('keeps going after a failed line — a paid order is never lost over stock', async () => {
    const { payload, products } = fakePayload({
      variants: [{ id: 10, inventory: 12 }],
      products: [{ id: 7, stock: 12 }],
      failReadOn: ['product-variants'],
    })

    const result = await deductOrderStock(
      payload,
      [
        { variant: 10, quantity: 2 },
        { product: 7, quantity: 3 },
      ],
      silent,
    )

    assert.equal(result.failed, 1)
    assert.equal(result.products, 1)
    assert.equal(products.get(7)?.stock, 9)
  })

  it('does nothing at all for an order with no items', async () => {
    const { payload } = fakePayload({})
    assert.deepEqual(await deductOrderStock(payload, [], silent), {
      variants: 0,
      products: 0,
      skipped: 0,
      failed: 0,
    })
    assert.deepEqual(await deductOrderStock(payload, null, silent), {
      variants: 0,
      products: 0,
      skipped: 0,
      failed: 0,
    })
  })
})
