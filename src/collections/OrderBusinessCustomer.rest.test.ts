import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { OrdersStandIn, OrganizationsStandIn } from '@/lib/testing/miljoStandIns'
import { MILJO_TRUSTED_ACCOUNT_CREATE, ORDER_BUSINESS_LINK_CONTEXT, orderGrantsEligibility } from '@/lib/miljo/business'
import { BusinessCustomers } from './BusinessCustomers'
import { MiljoAccounts } from './MiljoAccounts'
import { Orders } from './Orders'
import { Users } from './Users'
import { enforceOrderBusinessCustomer, orderBusinessCustomerField } from './hooks/orderBusinessCustomer'

/**
 * Stage 2.1 — Orders ↔ Bedriftskunder through Payload's REAL REST pipeline (login, JWT, operations,
 * access control, field access, hooks) with an in-memory database (@/lib/testing/payloadRestHarness).
 *
 * The ONE authoritative link is `orders.businessCustomer`; a business customer's «Ordrer» is a
 * read-only join over that column. The memory database does not implement joins, so «the customer
 * shows the order» is tested as the exact query the join performs (orders where businessCustomer =
 * the customer) plus the join's configuration.
 */

const PASSWORD = 'Stage21-test-only-1'
let h: RestHarness
const t = { admin: '', editor: '', account: '' }
const bc = { x: 0, y: 0 }
const o = { a: 21, b: 22, pending: 23, cancelled: 24, delivered: 25, shipped: 26, spare: 27 }

const rest: RestHarness['rest'] = (...args) => h.rest(...args)
const orders = (): Row[] => (h.store.orders ??= [])
const order = (id: number) => orders().find((r) => r.id === id)
const linkOf = (id: number) => {
  const v = order(id)?.businessCustomer
  return v == null ? null : Number(typeof v === 'object' ? (v as { id: unknown }).id : v)
}
/** What a business customer's read-only «Ordrer» join lists: orders whose link is this customer. */
const ordersOf = async (customerId: number) =>
  (
    await h.payload.find({ collection: 'orders', where: { businessCustomer: { equals: customerId } }, depth: 0, pagination: false })
  ).docs.map((d) => d.id as number).sort()
const patchOrder = (id: number, body: Record<string, unknown>, token = t.admin) => rest('PATCH', `/orders/${id}`, { token, body })

before(async () => {
  h = await createRestHarness('order-business-customer-test', [Users, OrdersStandIn, OrganizationsStandIn, BusinessCustomers, MiljoAccounts])
  orders().push(
    { id: o.a, orderNumber: 'AB-000021', status: 'confirmed' },
    { id: o.b, orderNumber: 'AB-000022', status: 'confirmed' },
    { id: o.pending, orderNumber: 'AB-000023', status: 'pending' },
    { id: o.cancelled, orderNumber: 'AB-000024', status: 'cancelled' },
    { id: o.delivered, orderNumber: 'AB-000025', status: 'delivered' },
    { id: o.shipped, orderNumber: 'AB-000026', status: 'shipped' },
    { id: o.spare, orderNumber: 'AB-000027', status: 'confirmed' },
  )
  const p = h.payload
  await p.create({ collection: 'users', data: { email: 'admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
  await p.create({ collection: 'users', data: { email: 'editor@aboks.invalid', password: PASSWORD, role: 'editor' } as never })
  const make = async (name: string, organizationNumber: string) =>
    (await p.create({ collection: 'business-customers', data: { name, organizationNumber, contactEmail: `${name}@aboks.invalid`, status: 'active' } as never })).id as number
  bc.x = await make('bedrift-x', '834012952')
  bc.y = await make('bedrift-y', '923609016')
  await p.create({
    collection: 'miljo-accounts',
    data: { email: 'konto-x@aboks.invalid', password: PASSWORD, businessCustomer: bc.x, status: 'active', emailVerifiedAt: new Date().toISOString() } as never,
    context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true },
  })
  t.admin = await h.login('users', 'admin@aboks.invalid', PASSWORD)
  t.editor = await h.login('users', 'editor@aboks.invalid', PASSWORD)
  t.account = await h.login('miljo-accounts', 'konto-x@aboks.invalid', PASSWORD)
})

after(async () => {
  await h?.payload.destroy?.()
})

describe('configuration — one authoritative link', () => {
  it('Orders has the optional, admin-only «Bedriftskunde» field and its hook runs first', () => {
    const field = Orders.fields.find((f) => (f as { name?: string }).name === 'businessCustomer')
    assert.equal(field, orderBusinessCustomerField)
    assert.equal(orderBusinessCustomerField.label, 'Bedriftskunde')
    assert.equal(orderBusinessCustomerField.relationTo, 'business-customers')
    assert.notEqual((orderBusinessCustomerField as { required?: boolean }).required, true)
    assert.notEqual((orderBusinessCustomerField as { hasMany?: boolean }).hasMany, true, 'one company per order')
    assert.equal(Orders.hooks?.beforeChange?.[0], enforceOrderBusinessCustomer)
  })

  it('the business customer lists its orders through a read-only join on that same column — no second writable list', () => {
    const fields = BusinessCustomers.fields.flatMap((f) => ('fields' in f && f.type === 'row' ? f.fields : [f])) as { name?: string; type?: string; collection?: string; on?: string }[]
    const join = fields.find((f) => f.name === 'orders')
    assert.deepEqual({ type: join?.type, collection: join?.collection, on: join?.on }, { type: 'join', collection: 'orders', on: 'businessCustomer' })
    assert.equal(fields.find((f) => f.name === 'eligibleOrders'), undefined)
    assert.equal(fields.some((f) => f.type === 'relationship' && (f as { relationTo?: string }).relationTo === 'orders'), false)
  })
})

describe('administrator — linking orders', () => {
  it('an order without a business customer is valid and stays unlinked', async () => {
    const res = await rest('POST', '/orders', { token: t.admin, body: { orderNumber: 'AB-000099', status: 'confirmed' } })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const created = orders().find((r) => r.orderNumber === 'AB-000099')!
    assert.equal(created.businessCustomer ?? null, null)
    // Saving an unrelated field keeps it unlinked.
    assert.equal((await patchOrder(created.id, { status: 'shipped' })).status, 200)
    assert.equal(linkOf(created.id), null)
  })

  it('assigns an existing business customer; the customer then shows the order', async () => {
    const res = await patchOrder(o.a, { businessCustomer: bc.x })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.equal(linkOf(o.a), bc.x)
    assert.deepEqual(await ordersOf(bc.x), [o.a])
  })

  it('one business customer can have several orders', async () => {
    for (const id of [o.b, o.delivered, o.shipped]) assert.equal((await patchOrder(id, { businessCustomer: bc.x })).status, 200)
    assert.deepEqual(await ordersOf(bc.x), [o.a, o.b, o.delivered, o.shipped].sort())
  })

  it('changing the organisation moves the order: gone from the old customer, present at the new one', async () => {
    assert.equal((await patchOrder(o.b, { businessCustomer: bc.y })).status, 200)
    assert.equal(linkOf(o.b), bc.y)
    assert.equal((await ordersOf(bc.x)).includes(o.b), false)
    assert.deepEqual(await ordersOf(bc.y), [o.b])
  })

  it('removing the link updates both views', async () => {
    assert.equal((await patchOrder(o.shipped, { businessCustomer: null })).status, 200)
    assert.equal(linkOf(o.shipped), null)
    assert.equal((await ordersOf(bc.x)).includes(o.shipped), false)
  })

  it('rejects linking a pending or cancelled order, or a business customer that does not exist', async () => {
    for (const [id, body] of [
      [o.pending, { businessCustomer: bc.x }],
      [o.cancelled, { businessCustomer: bc.x }],
      [o.spare, { businessCustomer: 99999 }],
    ] as const) {
      const res = await patchOrder(id, body)
      assert.equal(res.status, 400, `${id}: ${JSON.stringify(res.json)}`)
      assert.equal(linkOf(id), null)
    }
  })

  it('«confirm and link» in one save is accepted', async () => {
    const res = await patchOrder(o.pending, { status: 'confirmed', businessCustomer: bc.y })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.equal(linkOf(o.pending), bc.y)
  })

  it('a linked order that is later cancelled keeps its link (history) but no longer grants eligibility', async () => {
    assert.equal((await patchOrder(o.a, { status: 'cancelled' })).status, 200)
    assert.equal(linkOf(o.a), bc.x, 'the link is never deleted silently')
    assert.equal(orderGrantsEligibility(order(o.a), bc.x), false)
    assert.equal(orderGrantsEligibility(order(o.delivered), bc.x), true)
  })

  it('an order belongs to at most one business customer, also under concurrent saves', async () => {
    const [r1, r2] = await Promise.all([patchOrder(o.spare, { businessCustomer: bc.x }), patchOrder(o.spare, { businessCustomer: bc.y })])
    assert.equal(r1.status, 200)
    assert.equal(r2.status, 200)
    const owner = linkOf(o.spare)
    assert.ok(owner === bc.x || owner === bc.y)
    const listedBy: number[] = []
    for (const c of [bc.x, bc.y]) if ((await ordersOf(c)).includes(o.spare)) listedBy.push(c)
    assert.deepEqual(listedBy, [owner], 'listed by exactly one company')
  })

  it('a business customer with linked orders cannot be deleted — the links are history', async () => {
    const res = await rest('DELETE', `/business-customers/${bc.y}`, { token: t.admin })
    assert.equal(res.status, 409)
    assert.ok(h.store['business-customers']!.some((r) => r.id === bc.y))
  })
})

describe('unauthorised assignments', () => {
  it('anonymous: cannot read or change an order', async () => {
    assert.equal((await rest('GET', `/orders/${o.delivered}`)).status, 403)
    assert.equal((await rest('PATCH', `/orders/${o.delivered}`, { body: { businessCustomer: bc.y } })).status, 403)
    assert.equal(linkOf(o.delivered), bc.x)
  })

  it('editor: may still edit orders, but cannot see or change the link', async () => {
    const res = await patchOrder(o.delivered, { businessCustomer: bc.y, status: 'shipped' }, t.editor)
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.equal(order(o.delivered)?.status, 'shipped', 'the editor’s other change is saved')
    assert.equal(linkOf(o.delivered), bc.x, 'the link is unchanged')
    const read = await rest('GET', `/orders/${o.delivered}`, { token: t.editor })
    assert.equal(read.status, 200)
    assert.equal(read.json.businessCustomer, undefined, 'hidden from editors')
    // An editor cannot clear it either.
    await patchOrder(o.delivered, { businessCustomer: null }, t.editor)
    assert.equal(linkOf(o.delivered), bc.x)
  })

  it('Miljø account: no access to Orders at all, and cannot assign', async () => {
    assert.equal((await rest('GET', '/orders', { token: t.account })).status, 403)
    assert.equal((await rest('GET', `/orders/${o.delivered}`, { token: t.account })).status, 403)
    assert.equal((await patchOrder(o.spare, { businessCustomer: bc.x }, t.account)).status, 403)
  })

  it('Miljø account: its own business customer never exposes the linked orders', async () => {
    const res = await rest('GET', '/business-customers', { token: t.account })
    const own = (res.json.docs as Record<string, unknown>[])[0]!
    assert.equal(own.id, bc.x)
    assert.equal(own.orders, undefined)
  })
})

describe('forged links on server-side paths (checkout pre-create, Kustom webhook)', () => {
  it('a checkout-style Local API create (no user, access overridden) never stores a businessCustomer', async () => {
    const created = await h.payload.create({
      collection: 'orders',
      data: { orderNumber: 'AB-000100', status: 'pending', businessCustomer: bc.x } as never,
    })
    assert.equal(linkOf(created.id as number), null)
  })

  it('a webhook-style confirm cannot move or clear an existing link', async () => {
    const created = await h.payload.create({ collection: 'orders', data: { orderNumber: 'AB-000101', status: 'pending' } as never })
    await h.payload.update({ collection: 'orders', id: created.id, data: { status: 'confirmed', businessCustomer: bc.y } as never })
    assert.equal(linkOf(created.id as number), null)
    await patchOrder(created.id as number, { businessCustomer: bc.x })
    await h.payload.update({ collection: 'orders', id: created.id, data: { businessCustomer: bc.y } as never })
    assert.equal(linkOf(created.id as number), bc.x)
    await h.payload.update({ collection: 'orders', id: created.id, data: { businessCustomer: null } as never })
    assert.equal(linkOf(created.id as number), bc.x)
  })

  it('explicitly trusted server code may link — and is validated like an administrator', async () => {
    const created = await h.payload.create({ collection: 'orders', data: { orderNumber: 'AB-000102', status: 'pending' } as never })
    const context = { [ORDER_BUSINESS_LINK_CONTEXT]: true }
    await assert.rejects(h.payload.update({ collection: 'orders', id: created.id, data: { businessCustomer: bc.x } as never, context }))
    assert.equal(linkOf(created.id as number), null)
    await h.payload.update({ collection: 'orders', id: created.id, data: { status: 'confirmed', businessCustomer: bc.x } as never, context })
    assert.equal(linkOf(created.id as number), bc.x)
  })

  it('the real checkout and webhook code never write a businessCustomer', () => {
    for (const file of ['src/lib/promo/checkoutFlow.ts', 'src/app/api/kustom/webhook/route.ts', 'src/app/(frontend)/kasse/actions.ts']) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8')
      assert.doesNotMatch(src, /businessCustomer/, file)
    }
  })
})
