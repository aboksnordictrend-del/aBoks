import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ValidationError } from 'payload'
import { LINKED_ORDER_COST_MESSAGE } from '@/lib/partner/referralCost'
import { applyReferralSaleCosts } from './referralSaleCost'

/* ------------------------------ harness ------------------------------ */

type Doc = Record<string, unknown>

// aBoks (1) is sold in colours; GP Ultra AA (5) is a variant-less multipack; Prototype (9) has no
// cost set up yet.
const PRODUCTS: Record<string, Doc> = {
  1: { id: 1, costPrice: 69.75, costItems: [{ amount: 62.5 }, { amount: 7.25 }] },
  5: { id: 5, costPrice: 12, costItems: [{ amount: 12 }] },
  9: { id: 9, costPrice: 0, costItems: [] },
}
const VARIANTS: Doc[] = [
  { id: 11, product: 1 }, // aBoks – Sort
  { id: 12, product: 1 }, // aBoks – Hvit
  { id: 91, product: 9 },
]

function stubReq(products: Record<string, Doc> = PRODUCTS) {
  const finds: string[] = []
  const req = {
    payload: {
      find: async (args: { collection: string; where: Record<string, { in: unknown[] }> }) => {
        finds.push(args.collection)
        if (args.collection === 'products') {
          return { docs: args.where.id.in.map((id) => products[String(id)]).filter(Boolean) }
        }
        if ('id' in args.where) {
          const ids = args.where.id.in.map(String)
          return { docs: VARIANTS.filter((v) => ids.includes(String(v.id))) }
        }
        const parents = args.where.product.in.map(String)
        return { docs: VARIANTS.filter((v) => parents.includes(String(v.product))) }
      },
    },
    t: (key: string) => key,
  }
  return { req, finds }
}

async function apply(doc: Doc, original?: Doc, locked = false, products?: Record<string, Doc>) {
  const { req } = stubReq(products)
  await applyReferralSaleCosts({ doc, original, req: req as never, selfId: original?.id, locked })
  return doc
}

async function refused(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (err) {
    assert.ok(err instanceof ValidationError)
    return JSON.stringify((err as ValidationError).data)
  }
  assert.fail('expected a validation error')
}

/* ------------------------------ open sale ------------------------------ */

describe('referral sale costs — open sale', () => {
  it('reads each unit cost from the product and sums cost × quantity over several lines', async () => {
    const doc = await apply({
      items: [
        { product: 1, variant: 11, quantity: 100 },
        { product: 1, variant: 12, quantity: 20 },
        { product: 5, quantity: 3 },
      ],
      actualShippingCost: 450,
    })
    const items = doc.items as Doc[]
    assert.deepEqual(items.map((i) => i.unitCost), [69.75, 69.75, 12])
    assert.deepEqual(items.map((i) => i.lineCost), [6975, 1395, 36])
    assert.equal(doc.productCost, 8406)
    assert.equal(doc.actualShippingCost, 450)
  })

  it('ignores any unit cost, line cost or total sent by the client', async () => {
    const doc = await apply({
      items: [{ product: 1, variant: 11, quantity: 2, unitCost: 1, lineCost: 2 }],
      productCost: 2,
    })
    assert.equal((doc.items as Doc[])[0].unitCost, 69.75)
    assert.equal(doc.productCost, 139.5)
  })

  it('leaves the product cost unknown when a product has no cost set up', async () => {
    const doc = await apply({ items: [{ product: 1, variant: 11, quantity: 2 }, { product: 9, variant: 91, quantity: 1 }] })
    assert.deepEqual((doc.items as Doc[]).map((i) => i.unitCost), [69.75, null])
    assert.equal(doc.productCost, null)
  })

  it('leaves the product cost unknown when no lines are entered', async () => {
    const doc = await apply({ items: [] })
    assert.equal(doc.productCost, null)
  })

  it('keeps an empty shipping cost unknown and an explicit 0 as 0', async () => {
    assert.equal((await apply({ items: [] })).actualShippingCost, null)
    assert.equal((await apply({ items: [], actualShippingCost: 0 })).actualShippingCost, 0)
  })

  it('refuses a variant that belongs to another product', async () => {
    const message = await refused(apply({ items: [{ product: 5, variant: 11, quantity: 1 }] }))
    assert.match(message, /hører ikke til/)
  })

  it('requires a variant for a variant-based product, and none for a variant-less one', async () => {
    assert.match(await refused(apply({ items: [{ product: 1, quantity: 1 }] })), /Velg variant/)
    const doc = await apply({ items: [{ product: 5, quantity: 1 }] })
    assert.equal(doc.productCost, 12)
  })

  it('refuses a missing product and an invalid quantity', async () => {
    assert.match(await refused(apply({ items: [{ quantity: 1 }] })), /Velg produkt/)
    assert.match(await refused(apply({ items: [{ product: 5, quantity: 0 }] })), /Antall/)
    assert.match(await refused(apply({ items: [{ product: 5, quantity: 2.5 }] })), /Antall/)
  })

  it('refuses a negative shipping cost or one with more than two decimals', async () => {
    assert.match(await refused(apply({ items: [], actualShippingCost: -1 })), /Fraktkostnaden/)
    assert.match(await refused(apply({ items: [], actualShippingCost: 1.234 })), /Fraktkostnaden/)
  })

  it('re-reads the current cost on every save while the sale is pending', async () => {
    const original = { id: 3, items: [{ id: 'r1', product: 5, quantity: 2, unitCost: 10, lineCost: 20 }], productCost: 20 }
    const doc = await apply({ items: original.items }, original)
    assert.equal(doc.productCost, 24, 'current Total kostpris 12 × 2')
  })
})

/* ------------------------------ webshop-linked sale ------------------------------ */

describe('referral sale costs — sale linked to a webshop order', () => {
  it('refuses lines and shipping cost, because the order already carries them', async () => {
    assert.match(await refused(apply({ order: 77, items: [{ product: 5, quantity: 1 }] })), new RegExp(LINKED_ORDER_COST_MESSAGE.slice(0, 30)))
    assert.match(await refused(apply({ order: 77, items: [], actualShippingCost: 99 })), /nettbutikkordre/)
  })

  it('stores no cost of its own', async () => {
    const doc = await apply({ order: 77, items: [] })
    assert.deepEqual(doc.items, [])
    assert.equal(doc.productCost, null)
    assert.equal(doc.actualShippingCost, null)
  })
})

/* ------------------------------ snapshot after payment ------------------------------ */

describe('referral sale costs — snapshot once the sale is paid', () => {
  const paid = {
    id: 4,
    paymentStatus: 'paid',
    items: [{ id: 'r1', product: 5, variant: null, quantity: 10, unitCost: 10, lineCost: 100 }],
    productCost: 100,
    actualShippingCost: 80,
  }

  it('keeps the stored unit cost even after the product’s cost has changed', async () => {
    // Total kostpris is now 12, the snapshot says 10.
    const doc = await apply({ items: paid.items, actualShippingCost: 80 }, paid, true)
    assert.equal((doc.items as Doc[])[0].unitCost, 10)
    assert.equal(doc.productCost, 100)
  })

  it('refuses changed lines or a changed shipping cost', async () => {
    assert.match(
      await refused(apply({ items: [{ ...paid.items[0], quantity: 11 }] }, paid, true)),
      /låst/,
    )
    assert.match(await refused(apply({ actualShippingCost: 90 }, paid, true)), /låst/)
  })

  it('lets a paid sale without lines receive them once, snapshotted at that save', async () => {
    const legacy = { id: 5, paymentStatus: 'paid', items: [], productCost: null, actualShippingCost: null }
    const doc = await apply({ items: [{ product: 5, quantity: 4 }], actualShippingCost: 0 }, legacy, true)
    assert.equal(doc.productCost, 48)
    assert.equal(doc.actualShippingCost, 0)
  })

  it('leaves a paid sale without lines unavailable until they are supplied', async () => {
    const legacy = { id: 5, paymentStatus: 'paid', items: [], productCost: null, actualShippingCost: null }
    const doc = await apply({ internalNote: 'notat' }, legacy, true)
    assert.equal(doc.productCost, null)
    assert.equal(doc.actualShippingCost, null)
  })
})
