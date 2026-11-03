import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CollectionConfig } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { OrganizationsStandIn } from '@/lib/testing/miljoStandIns'
import { BusinessCustomers } from './BusinessCustomers'
import { MiljoAccounts } from './MiljoAccounts'
import { Orders } from './Orders'
import { Products } from './Products'
import { ProductVariants } from './ProductVariants'
import { Users } from './Users'
import { enforceOrderBusinessCustomer, orderBusinessCustomerField } from './hooks/orderBusinessCustomer'
import { normalizeManualOrderPricing } from './hooks/orderManualPricing'

/**
 * Manual orders through Payload's REAL REST pipeline (login, JWT, access, hooks) with an in-memory
 * database (@/lib/testing/payloadRestHarness).
 *
 * Orders, products and variants are stand-ins with the project's REAL access rules and the real
 * order hooks under test (`enforceOrderBusinessCustomer`, `normalizeManualOrderPricing`) and the
 * money fields exactly as on Orders — without e-mails, stock and the cost snapshot, which this
 * suite does not exercise.
 */

const PASSWORD = 'Pricing-test-only-1'
let h: RestHarness
const t = { admin: '', editor: '' }
const p = { aboks: 0, accessory: 0, noPrice: 0 }
const v = { aboksBlue: 0, aboksGreen: 0 }
let bc = 0

const ProductsStandIn: CollectionConfig = {
  slug: 'products',
  access: Products.access,
  fields: [
    { name: 'title', type: 'text' },
    { name: 'slug', type: 'text' },
    { name: 'price', type: 'number' },
    { name: 'salePrice', type: 'number' },
    { name: 'saleStartDate', type: 'date' },
    { name: 'saleEndDate', type: 'date' },
  ],
}
const VariantsStandIn: CollectionConfig = {
  slug: 'product-variants',
  access: ProductVariants.access,
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products' },
    { name: 'name', type: 'text' },
  ],
}
const orderField = (name: string) => Orders.fields.find((f) => (f as { name?: string }).name === name)!
const OrdersStandIn: CollectionConfig = {
  slug: 'orders',
  access: Orders.access,
  fields: [
    { name: 'orderNumber', type: 'text' },
    { name: 'status', type: 'text', defaultValue: 'pending' },
    { name: 'kustomOrderId', type: 'text' },
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products' },
        { name: 'variant', type: 'relationship', relationTo: 'product-variants' },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'unitPrice', type: 'number', required: true, min: 0 },
        { name: 'lineTotal', type: 'number', required: true },
        { name: 'discountAmount', type: 'number' },
      ],
    },
    orderField('subtotal'),
    orderField('shipping'),
    orderField('total'),
    { name: 'discount', type: 'group', fields: [{ name: 'discountAmount', type: 'number' }] },
    orderBusinessCustomerField,
  ],
  hooks: { beforeChange: [enforceOrderBusinessCustomer, normalizeManualOrderPricing] },
}

const rest: RestHarness['rest'] = (...args) => h.rest(...args)
const order = (id: number) => (h.store.orders ?? []).find((r) => r.id === id) as Row & Record<string, any>
const create = (body: Record<string, unknown>, token = t.admin) => rest('POST', '/orders', { token, body })
const patch = (id: number, body: Record<string, unknown>, token = t.admin) => rest('PATCH', `/orders/${id}`, { token, body })
const docId = (res: { json: Record<string, unknown> }) => ((res.json.doc as { id: number }) ?? {}).id

before(async () => {
  h = await createRestHarness('order-manual-pricing-test', [Users, ProductsStandIn, VariantsStandIn, OrdersStandIn, OrganizationsStandIn, BusinessCustomers, MiljoAccounts])
  const pl = h.payload
  await pl.create({ collection: 'users', data: { email: 'admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
  await pl.create({ collection: 'users', data: { email: 'editor@aboks.invalid', password: PASSWORD, role: 'editor' } as never })
  // `aboks` has quantity bands (10+ → 399, 20+ → 349) in @/lib/quantityPricing.
  p.aboks = (await pl.create({ collection: 'products', data: { title: 'aBoks', slug: 'aboks', price: 449 } as never })).id as number
  p.accessory = (await pl.create({ collection: 'products', data: { title: 'AA-Modul', slug: 'aa-modul', price: 99 } as never })).id as number
  p.noPrice = (await pl.create({ collection: 'products', data: { title: 'Uten pris', slug: 'uten-pris' } as never })).id as number
  v.aboksBlue = (await pl.create({ collection: 'product-variants', data: { product: p.aboks, name: 'Mørk blå' } as never })).id as number
  v.aboksGreen = (await pl.create({ collection: 'product-variants', data: { product: p.aboks, name: 'Olivengrønn' } as never })).id as number
  bc = (await pl.create({ collection: 'business-customers', data: { name: 'Fjordvik AS', organizationNumber: '834012952', contactEmail: 'post@fjordvik.invalid', status: 'active' } as never })).id as number
  t.admin = await h.login('users', 'admin@aboks.invalid', PASSWORD)
  t.editor = await h.login('users', 'editor@aboks.invalid', PASSWORD)
})

after(async () => {
  await h?.payload.destroy?.()
})

describe('manual order — catalogue price and totals', () => {
  it('a product without variants gets its catalogue price; totals follow', async () => {
    const res = await create({ orderNumber: 'AB-1', status: 'confirmed', items: [{ product: p.accessory, quantity: 2 }], shipping: 0 })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const o = order(docId(res))
    assert.equal(o.items[0].unitPrice, 99)
    assert.equal(o.items[0].lineTotal, 198)
    assert.equal(o.subtotal, 198)
    assert.equal(o.total, 198)
  })

  it('a variant is priced by its product — quantity bands included — and the product is filled in', async () => {
    const res = await create({ orderNumber: 'AB-2', items: [{ variant: v.aboksBlue, quantity: 10 }] })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const line = order(docId(res)).items[0]
    assert.equal(line.unitPrice, 399)
    assert.equal(line.lineTotal, 3990)
    assert.equal(Number(line.product?.id ?? line.product), p.aboks)
  })

  it('an individual price is kept and drives the totals', async () => {
    const res = await create({ orderNumber: 'AB-3', items: [{ product: p.aboks, variant: v.aboksGreen, quantity: 10, unitPrice: 300 }] })
    const o = order(docId(res))
    assert.equal(o.items[0].unitPrice, 300)
    assert.equal(o.items[0].lineTotal, 3000)
    assert.equal(o.total, 3000)
  })

  it('several lines, shipping and a discount: total = subtotal + shipping − discount, never MVA on top', async () => {
    const res = await create({
      orderNumber: 'AB-4',
      items: [
        { product: p.aboks, variant: v.aboksBlue, quantity: 2 },
        { product: p.accessory, quantity: 3, unitPrice: 89.5 },
      ],
      shipping: 69,
      discount: { discountAmount: 50 },
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const o = order(docId(res))
    assert.deepEqual(o.items.map((l: Row) => l.lineTotal), [898, 268.5])
    assert.equal(o.subtotal, 1166.5)
    assert.equal(o.total, 1185.5)
  })

  it('a client cannot supply its own line totals, subtotal or total', async () => {
    const res = await create({ orderNumber: 'AB-5', items: [{ product: p.accessory, quantity: 1, lineTotal: 1 }], subtotal: 1, total: 1 })
    const o = order(docId(res))
    assert.equal(o.items[0].lineTotal, 99)
    assert.equal(o.subtotal, 99)
    assert.equal(o.total, 99)
  })
})

describe('manual order — refused values (Norwegian messages)', () => {
  const refused = async (items: unknown[], extra: Record<string, unknown> = {}) => {
    const res = await create({ orderNumber: `AB-X${Math.random()}`, items, ...extra })
    assert.equal(res.status, 400, JSON.stringify(res.json))
    return JSON.stringify(res.json)
  }

  it('negative or over-precise prices and invalid quantities', async () => {
    assert.match(await refused([{ product: p.accessory, quantity: 1, unitPrice: -5 }]), /0 kr eller mer|Enhetspris/)
    await refused([{ product: p.accessory, quantity: 1, unitPrice: 9.999 }])
    assert.match(await refused([{ product: p.accessory, quantity: 1.5 }]), /Antall/)
    await refused([{ product: p.accessory, quantity: 10000 }])
  })

  it('a variant of another product, a product that needs a variant, a product without a price', async () => {
    assert.match(await refused([{ product: p.accessory, variant: v.aboksBlue, quantity: 1 }]), /annet produkt/)
    assert.match(await refused([{ product: p.aboks, quantity: 1 }]), /Velg variant/)
    assert.match(await refused([{ product: p.noPrice, quantity: 1 }]), /ingen gyldig pris/)
  })

  it('a product without a price is fine with an explicit individual price', async () => {
    const res = await create({ orderNumber: 'AB-6', items: [{ product: p.noPrice, quantity: 2, unitPrice: 50 }] })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    assert.equal(order(docId(res)).total, 100)
  })

  it('negative shipping, and a discount larger than the goods', async () => {
    await refused([{ product: p.accessory, quantity: 1 }], { shipping: -1 })
    assert.match(await refused([{ product: p.accessory, quantity: 1 }], { discount: { discountAmount: 500 } }), /Rabatten/)
  })
})

describe('manual order — editing', () => {
  let id = 0
  before(async () => {
    const res = await create({ orderNumber: 'AB-E', status: 'confirmed', items: [{ product: p.accessory, quantity: 1 }], shipping: 69 })
    id = docId(res)
  })

  it('adding a line recalculates; the existing line keeps its price', async () => {
    const lines = order(id).items
    const res = await patch(id, { items: [...lines, { product: p.aboks, variant: v.aboksBlue, quantity: 1 }] })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    const o = order(id)
    assert.deepEqual(o.items.map((l: Row) => l.unitPrice), [99, 449])
    assert.equal(o.subtotal, 548)
    assert.equal(o.total, 617)
  })

  it('changing a quantity keeps the stored unit price (the server never re-prices from the catalogue)', async () => {
    const lines = order(id).items.map((l: Row, i: number) => (i === 1 ? { ...l, quantity: 20 } : l))
    await patch(id, { items: lines })
    const o = order(id)
    assert.equal(o.items[1].unitPrice, 449, 'the form, not the server, offers the band price')
    assert.equal(o.items[1].lineTotal, 8980)
    assert.equal(o.subtotal, 9079)
  })

  it('removing a line recalculates', async () => {
    await patch(id, { items: [order(id).items[0]] })
    const o = order(id)
    assert.equal(o.items.length, 1)
    assert.equal(o.subtotal, 99)
    assert.equal(o.total, 168)
  })

  it('changing shipping recalculates the total', async () => {
    await patch(id, { shipping: 0 })
    assert.equal(order(id).total, 99)
  })

  it('a status-only save — or a resubmitted unchanged form with tampered totals — changes no amount', async () => {
    const before = structuredClone(order(id))
    assert.equal((await patch(id, { status: 'shipped' })).status, 200)
    await patch(id, { items: order(id).items.map((l: Row) => ({ ...l, lineTotal: 1 })), subtotal: 1, total: 1 })
    const o = order(id)
    assert.equal(o.status, 'shipped')
    assert.deepEqual(o.items.map((l: Row) => l.lineTotal), before.items.map((l: Row) => l.lineTotal))
    assert.equal(o.subtotal, before.subtotal)
    assert.equal(o.total, before.total)
  })

  it('an editor (staff) gets the same normalisation; anonymous visitors cannot write at all', async () => {
    const res = await create({ orderNumber: 'AB-ED', items: [{ product: p.accessory, quantity: 1 }], total: 1 }, t.editor)
    assert.equal(res.status, 201, JSON.stringify(res.json))
    assert.equal(order(docId(res)).total, 99)
    assert.equal((await rest('POST', '/orders', { body: { orderNumber: 'AB-AN', items: [{ product: p.accessory, quantity: 1 }] } })).status, 403)
  })
})

describe('historical and automatic orders are never recalculated', () => {
  it('a historical order keeps its frozen prices after the catalogue changes', async () => {
    const res = await create({ orderNumber: 'AB-H', status: 'delivered', items: [{ product: p.accessory, quantity: 1 }] })
    const id = docId(res)
    await h.payload.update({ collection: 'products', id: p.accessory, data: { price: 129 } as never })
    await patch(id, { status: 'confirmed' })
    await patch(id, { items: order(id).items })
    assert.equal(order(id).items[0].unitPrice, 99)
    assert.equal(order(id).total, 99)
    await h.payload.update({ collection: 'products', id: p.accessory, data: { price: 99 } as never })
  })

  it('a legacy line whose stored total differs keeps it when another field changes', async () => {
    h.store.orders!.push({
      id: 9001,
      orderNumber: 'AB-LEGACY',
      status: 'delivered',
      items: [{ id: 'legacy-line', product: p.accessory, quantity: 2, unitPrice: 100, lineTotal: 180 }],
      subtotal: 180,
      shipping: 0,
      total: 180,
    })
    assert.equal((await patch(9001, { shipping: 69 })).status, 200)
    const o = order(9001)
    assert.equal(o.items[0].lineTotal, 180, 'not re-derived as 2 × 100')
    assert.equal(o.subtotal, 180)
    assert.equal(o.total, 249)
  })

  it('checkout and the Kustom webhook (Local API, no user) store their amounts exactly as given', async () => {
    // Deliberately NOT what the manual-order formula would give (79 + 69 − 10 = 138): Kustom's
    // charged amounts are the truth for these orders and must never be "corrected".
    const created = await h.payload.create({
      collection: 'orders',
      data: { orderNumber: 'AB-K', kustomOrderId: 'k-1', items: [{ product: p.accessory, quantity: 1, unitPrice: 79, lineTotal: 79, discountAmount: 10 }], subtotal: 79, shipping: 69, total: 130, discount: { discountAmount: 10 } } as never,
    })
    const id = created.id as number
    assert.deepEqual([order(id).items[0].unitPrice, order(id).items[0].lineTotal, order(id).subtotal, order(id).total], [79, 79, 79, 130])
    await h.payload.update({ collection: 'orders', id, data: { status: 'confirmed', shipping: 0, items: order(id).items } as never })
    assert.equal(order(id).total, 130, 'the webhook path never recalculates')
    assert.equal(order(id).shipping, 0)
  })
})

describe('Bedriftskunde', () => {
  it('an order with a Bedriftskunde and no Kunde is saved; choosing the company does not change prices', async () => {
    const res = await create({ orderNumber: 'AB-B', status: 'confirmed', businessCustomer: bc, items: [{ product: p.aboks, variant: v.aboksBlue, quantity: 1, unitPrice: 400 }] })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const o = order(docId(res))
    assert.equal(Number(o.businessCustomer?.id ?? o.businessCustomer), bc)
    assert.equal(o.items[0].unitPrice, 400)
    assert.equal(o.total, 400)
  })
})
