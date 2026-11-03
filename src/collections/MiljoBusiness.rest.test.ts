import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { handleEndpoints } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { BusinessCustomers } from './BusinessCustomers'
import { MiljoAccounts } from './MiljoAccounts'
import { Users } from './Users'
import { MILJO_TRUSTED_ACCOUNT_CREATE } from '@/lib/miljo/business'
import { MILJO_LOGIN, OrdersStandIn, OrganizationsStandIn, miljoLoginOn } from '@/lib/testing/miljoStandIns'

/**
 * Stage 1 — `business-customers` and `miljo-accounts` through Payload's REAL REST pipeline (login,
 * JWT, operations, access control, field access, hooks), with an in-memory database. See
 * @/lib/testing/payloadRestHarness for what the memory database does and does not do: unique
 * indexes and foreign keys are database rules and are verified against Neon `preview`.
 *
 * Orders and environmental organisations are inserted straight into the store — this suite never
 * writes them through Payload, so their own hooks (e-mails, stock, QR codes) never run.
 */

const PASSWORD = 'Stage1-test-only-1'
const ORGNR = { a: '834012952', b: '923609016', c: '974760673', d: '889640782', e: '971526920', invalidCheckDigit: '834012953' }

let h: RestHarness
const miljoLogin = (email: string, password: string) => miljoLoginOn(h, email, password)
const t = { admin: '', editor: '', accA: '', accB: '' }
const id = { bcA: 0, bcB: 0, bcC: 0, bcD: 0, bcE: 0, accA: 0, accB: 0, accC: 0, accD: 0, accE: 0, orgA: 1, orgB: 2, orgFree: 3 }
const order = { confirmedA: 11, confirmedB: 12, pending: 13, cancelled: 14, delivered: 15, shipped: 16 }

const rest: RestHarness['rest'] = (...args) => h.rest(...args)
const rows = (slug: string): Row[] => (h.store[slug] ??= [])
const row = (slug: string, docId: number) => rows(slug).find((r) => r.id === docId)
const docs = (json: Record<string, unknown>) => (json.docs as Record<string, unknown>[] | undefined) ?? []

before(async () => {
  h = await createRestHarness('miljo-business-rest-test', [Users, OrdersStandIn, OrganizationsStandIn, BusinessCustomers, MiljoAccounts])

  rows('orders').push(
    { id: order.confirmedA, orderNumber: 'AB-000011', status: 'confirmed' },
    { id: order.confirmedB, orderNumber: 'AB-000012', status: 'confirmed' },
    { id: order.pending, orderNumber: 'AB-000013', status: 'pending' },
    { id: order.cancelled, orderNumber: 'AB-000014', status: 'cancelled' },
    { id: order.delivered, orderNumber: 'AB-000015', status: 'delivered' },
    { id: order.shipped, orderNumber: 'AB-000016', status: 'shipped' },
  )
  rows('environmental-organizations').push(
    { id: id.orgA, name: 'Org A', publicCode: 'aaaaaaaaaa', status: 'active' },
    { id: id.orgB, name: 'Org B', publicCode: 'bbbbbbbbbb', status: 'active' },
    { id: id.orgFree, name: 'Org fri', publicCode: 'cccccccccc', status: 'active' },
  )

  const p = h.payload
  await p.create({ collection: 'users', data: { email: 'admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
  await p.create({ collection: 'users', data: { email: 'editor@aboks.invalid', password: PASSWORD, role: 'editor' } as never })

  const bc = async (name: string, organizationNumber: string, extra: Record<string, unknown>) =>
    (await p.create({ collection: 'business-customers', data: { name, organizationNumber, contactEmail: `${name}@aboks.invalid`, status: 'active', ...extra } as never })).id as number
  id.bcA = await bc('bedrift-a', ORGNR.a, { environmentalOrganization: id.orgA, internalNote: 'intern A' })
  id.bcB = await bc('bedrift-b', ORGNR.b, { environmentalOrganization: id.orgB, internalNote: 'intern B' })
  id.bcC = await bc('bedrift-c', ORGNR.c, {})

  // emailVerifiedAt is system-only: set here through the trusted Local API path, as the
  // verification flow will in a later stage.
  const verified = new Date().toISOString()
  const acc = async (email: string, businessCustomer: number, status: string, emailVerifiedAt: string | null) =>
    (
      await p.create({
        collection: 'miljo-accounts',
        data: { email, password: PASSWORD, businessCustomer, status, emailVerifiedAt } as never,
        context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true },
      })
    ).id as number
  id.accA = await acc('konto-a@aboks.invalid', id.bcA, 'active', verified)
  id.accB = await acc('konto-b@aboks.invalid', id.bcB, 'active', verified)
  id.accC = await acc('konto-c@aboks.invalid', id.bcC, 'invited', null)

  // D: active, suspended by a test below. E: never activated («Venter»).
  id.bcD = await bc('bedrift-d', ORGNR.d, {})
  id.bcE = await bc('bedrift-e', ORGNR.e, { status: 'pending' })
  // Access needs at least one linked, valid aBoks order per company (Stage 2.2 rule).
  const link = (orderId: number, customerId: number) => {
    rows('orders').find((r) => r.id === orderId)!.businessCustomer = customerId
  }
  link(order.confirmedA, id.bcA)
  link(order.confirmedB, id.bcB)
  link(order.delivered, id.bcD)
  link(order.shipped, id.bcE)
  id.accD = await acc('konto-d@aboks.invalid', id.bcD, 'active', verified)
  id.accE = await acc('konto-e@aboks.invalid', id.bcE, 'active', verified)

  t.admin = await h.login('users', 'admin@aboks.invalid', PASSWORD)
  t.editor = await h.login('users', 'editor@aboks.invalid', PASSWORD)
  t.accA = await h.login('miljo-accounts', 'konto-a@aboks.invalid', PASSWORD, MILJO_LOGIN)
  t.accB = await h.login('miljo-accounts', 'konto-b@aboks.invalid', PASSWORD, MILJO_LOGIN)
})

after(async () => {
  await h?.payload.destroy?.()
})

/* -------------------------------- anonymous -------------------------------- */

describe('anonymous', () => {
  it('cannot list or read business customers or accounts', async () => {
    for (const path of ['/business-customers', `/business-customers/${id.bcA}`, '/miljo-accounts', `/miljo-accounts/${id.accA}`]) {
      const res = await rest('GET', path)
      assert.ok(res.status === 403 || res.status === 404, `${path} → ${res.status}`)
      assert.equal(docs(res.json).length, 0)
    }
  })

  it('cannot sign up (public account creation is disabled) or create a business customer', async () => {
    const before = rows('miljo-accounts').length
    const signUp = await rest('POST', '/miljo-accounts', {
      body: { email: 'ny@aboks.invalid', password: PASSWORD, businessCustomer: id.bcC, status: 'active' },
    })
    assert.equal(signUp.status, 403)
    assert.equal(rows('miljo-accounts').length, before)
    const bc = await rest('POST', '/business-customers', { body: { name: 'x', organizationNumber: ORGNR.c, contactEmail: 'x@aboks.invalid' } })
    assert.equal(bc.status, 403)
  })

  it('password reset is closed in Stage 1 — no reset token is created', async () => {
    const res = await rest('POST', '/miljo-accounts/forgot-password', { body: { email: 'konto-a@aboks.invalid' } })
    assert.equal(res.status, 403)
    assert.equal(row('miljo-accounts', id.accA)?.resetPasswordToken ?? null, null)
    const reset = await rest('POST', '/miljo-accounts/reset-password', { body: { token: 'x', password: 'Ny-pass-1' } })
    assert.equal(reset.status, 403)
  })
})

describe('first-register on an EMPTY miljo-accounts collection (Payload creates it with overrideAccess)', () => {
  let fresh: RestHarness

  before(async () => {
    fresh = await createRestHarness('miljo-first-register-test', [Users, OrdersStandIn, OrganizationsStandIn, BusinessCustomers, MiljoAccounts])
    await fresh.payload.create({
      collection: 'business-customers',
      data: { name: 'offer', organizationNumber: ORGNR.a, contactEmail: 'offer@aboks.invalid', status: 'active' } as never,
    })
  })

  after(async () => {
    await fresh?.payload.destroy?.()
  })

  it('anonymous POST /api/miljo-accounts/first-register creates nothing', async () => {
    const victim = fresh.store['business-customers']![0]!.id
    const res = await fresh.rest('POST', '/miljo-accounts/first-register', {
      body: {
        email: 'angriper@aboks.invalid',
        password: PASSWORD,
        businessCustomer: victim,
        status: 'active',
        emailVerifiedAt: new Date().toISOString(),
      },
    })
    assert.equal(res.status, 403, JSON.stringify(res.json))
    assert.equal((fresh.store['miljo-accounts'] ?? []).length, 0)
    const login = await fresh.rest('POST', '/miljo-accounts/login', { body: { email: 'angriper@aboks.invalid', password: PASSWORD } })
    assert.notEqual(login.status, 200)
  })

  it('the Local API without an admin or the trusted-create flag is refused too', async () => {
    const victim = fresh.store['business-customers']![0]!.id
    await assert.rejects(
      fresh.payload.create({
        collection: 'miljo-accounts',
        data: { email: 'x@aboks.invalid', password: PASSWORD, businessCustomer: victim } as never,
      }),
    )
    assert.equal((fresh.store['miljo-accounts'] ?? []).length, 0)
  })
})

/* ------------------------------ business account ------------------------------ */

describe('Miljø account — authentication', () => {
  it('an active account with a verified e-mail signs in', () => {
    assert.ok(t.accA.length > 20)
  })

  it('Payload’s own login and refresh endpoints are closed — no token, no payload-token cookie', async () => {
    const request = (path: string, init: RequestInit) =>
      handleEndpoints({ config: h.payload.config as never, request: new Request(`http://localhost:3000/api${path}`, init), payloadInstanceCacheKey: 'miljo-business-rest-test' } as never)
    const login = await request('/miljo-accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'konto-a@aboks.invalid', password: PASSWORD }),
    })
    assert.equal(login.status, 403)
    assert.equal(login.headers.get('set-cookie'), null)
    assert.equal(((await login.json()) as { token?: unknown }).token, undefined)
    const refresh = await request('/miljo-accounts/refresh-token', { method: 'POST', headers: { Authorization: `JWT ${t.accA}` } })
    assert.equal(refresh.status, 403)
    assert.equal(refresh.headers.get('set-cookie'), null)
    // Administrators sign in through Payload exactly as before.
    assert.ok(t.admin.length > 20)
  })

  it('an invited (unverified) account is refused with the same answer as a wrong password', async () => {
    const inactive = await miljoLogin('konto-c@aboks.invalid', PASSWORD)
    const wrong = await miljoLogin('konto-a@aboks.invalid', 'Feil-passord-1')
    const unknown = await miljoLogin('finnes-ikke@aboks.invalid', PASSWORD)
    assert.equal(inactive.status, 401)
    assert.equal(wrong.status, 401)
    assert.equal(unknown.status, 401)
    assert.equal(inactive.token, undefined)
    assert.deepEqual(inactive.message, wrong.message, 'no hint that the account exists or what state it is in')
  })

  it('cannot reach the admin panel', () => {
    const fn = MiljoAccounts.access!.admin as (a: unknown) => unknown
    assert.equal(fn({ req: { user: { collection: 'miljo-accounts', id: id.accA, status: 'active', emailVerifiedAt: 'x' } } }), false)
    const usersAdmin = Users.access!.admin as (a: unknown) => unknown
    assert.equal(usersAdmin({ req: { user: { collection: 'miljo-accounts', id: id.accA, role: 'admin' } } }), false)
  })

  it('is never staff: internal collections stay closed', async () => {
    for (const path of ['/orders', `/orders/${order.confirmedA}`, '/users', '/environmental-organizations', `/environmental-organizations/${id.orgA}`]) {
      const res = await rest('GET', path, { token: t.accA })
      assert.ok(res.status === 403 || res.status === 404, `${path} → ${res.status}`)
      assert.equal(docs(res.json).length, 0, path)
    }
  })
})

/* ------------------------------ ownership isolation ------------------------------ */

describe('Miljø account — organisation isolation', () => {
  it('lists exactly its own business customer, without internal fields', async () => {
    const res = await rest('GET', '/business-customers', { token: t.accA })
    assert.equal(res.status, 200)
    assert.deepEqual(docs(res.json).map((d) => d.id), [id.bcA])
    const own = docs(res.json)[0]!
    assert.equal(own.organizationNumber, ORGNR.a)
    assert.equal(own.internalNote, undefined)
    assert.equal(own.orders, undefined)
  })

  it('cannot read another business customer — by id or by a crafted where', async () => {
    const byId = await rest('GET', `/business-customers/${id.bcB}`, { token: t.accA })
    assert.ok(byId.status === 403 || byId.status === 404, `→ ${byId.status}`)
    assert.equal(byId.json.name, undefined)
    const crafted = await rest('GET', `/business-customers?where[id][equals]=${id.bcB}`, { token: t.accA })
    assert.equal(docs(crafted.json).length, 0)
    const orAttempt = await rest('GET', `/business-customers?where[or][0][id][equals]=${id.bcB}&where[or][1][id][equals]=${id.bcA}`, { token: t.accA })
    assert.deepEqual(docs(orAttempt.json).map((d) => d.id), [id.bcA])
  })

  it('cannot change or delete any business customer, its own included', async () => {
    const snapshotA = structuredClone(row('business-customers', id.bcA))
    const snapshotB = structuredClone(row('business-customers', id.bcB))
    for (const target of [id.bcA, id.bcB]) {
      assert.equal((await rest('PATCH', `/business-customers/${target}`, { token: t.accA, body: { name: 'x', status: 'active' } })).status, 403)
      assert.equal((await rest('DELETE', `/business-customers/${target}`, { token: t.accA })).status, 403)
    }
    assert.equal((await rest('PATCH', '/business-customers?where[id][exists]=true', { token: t.accA, body: { name: 'x' } })).status, 403)
    assert.deepEqual(row('business-customers', id.bcA), snapshotA)
    assert.deepEqual(row('business-customers', id.bcB), snapshotB)
  })

  it('reads only its own account; cannot read, change or delete another account', async () => {
    const list = await rest('GET', '/miljo-accounts', { token: t.accA })
    assert.deepEqual(docs(list.json).map((d) => d.id), [id.accA])
    const other = await rest('GET', `/miljo-accounts/${id.accB}`, { token: t.accA })
    assert.ok(other.status === 403 || other.status === 404)
    const snapshot = structuredClone(row('miljo-accounts', id.accB))
    assert.equal((await rest('PATCH', `/miljo-accounts/${id.accB}`, { token: t.accA, body: { email: 'kapret@aboks.invalid', password: 'Kapret-1' } })).status, 403)
    assert.equal((await rest('DELETE', `/miljo-accounts/${id.accB}`, { token: t.accA })).status, 403)
    assert.deepEqual(row('miljo-accounts', id.accB), snapshot)
  })

  it('cannot change its own account in Stage 1 — not its status, verification or company', async () => {
    const snapshot = structuredClone(row('miljo-accounts', id.accA))
    const res = await rest('PATCH', `/miljo-accounts/${id.accA}`, {
      token: t.accA,
      body: { businessCustomer: id.bcB, status: 'active', emailVerifiedAt: new Date().toISOString() },
    })
    assert.equal(res.status, 403)
    assert.deepEqual(row('miljo-accounts', id.accA), snapshot)
  })

  it('a deactivated account loses access on its next request, and cannot refresh its token', async () => {
    const before = await rest('GET', '/business-customers', { token: t.accB })
    assert.deepEqual(docs(before.json).map((d) => d.id), [id.bcB])
    const off = await rest('PATCH', `/miljo-accounts/${id.accB}`, { token: t.admin, body: { status: 'disabled' } })
    assert.equal(off.status, 200, JSON.stringify(off.json))
    const after = await rest('GET', '/business-customers', { token: t.accB })
    assert.ok(after.status === 403 || docs(after.json).length === 0, `→ ${after.status}`)
    const refresh = await rest('POST', '/miljo-accounts/refresh-token', { token: t.accB })
    assert.notEqual(refresh.status, 200)
    assert.equal(refresh.json.refreshedToken, undefined)
  })
})

/* ------------------------- business customer status ------------------------- */

describe('business customer status — «Sperret» / «Venter» close every account of the company', () => {
  const sameAsWrongPassword = async (email: string) => {
    const res = await miljoLogin(email, PASSWORD)
    const wrong = await miljoLogin(email, 'Feil-passord-1')
    assert.equal(res.status, 401, `${email}: ${res.message}`)
    assert.equal(res.token, undefined)
    assert.deepEqual(res.message, wrong.message, 'no hint about the company’s status')
  }

  it('an account of a «Venter» business customer cannot sign in, though the account itself is active', async () => {
    await sameAsWrongPassword('konto-e@aboks.invalid')
  })

  it('suspending the business customer closes an already signed-in account on its next request', async () => {
    const token = await h.login('miljo-accounts', 'konto-d@aboks.invalid', PASSWORD, MILJO_LOGIN)
    const before = await rest('GET', '/business-customers', { token })
    assert.deepEqual(docs(before.json).map((d) => d.id), [id.bcD])

    const suspend = await rest('PATCH', `/business-customers/${id.bcD}`, { token: t.admin, body: { status: 'suspended' } })
    assert.equal(suspend.status, 200, JSON.stringify(suspend.json))
    assert.equal(row('miljo-accounts', id.accD)?.status, 'active', 'the account itself is not touched')

    // Same token, every kind of authorised request:
    const list = await rest('GET', '/business-customers', { token })
    assert.ok(list.status === 403 || docs(list.json).length === 0, `list → ${list.status}`)
    const byId = await rest('GET', `/business-customers/${id.bcD}`, { token })
    assert.ok(byId.status === 403 || byId.status === 404, `byId → ${byId.status}`)
    assert.equal(byId.json.name, undefined)
    const accounts = await rest('GET', '/miljo-accounts', { token })
    assert.ok(accounts.status === 403 || docs(accounts.json).length === 0, `accounts → ${accounts.status}`)
    const me = await rest('GET', '/miljo-accounts/me', { token })
    assert.equal((me.json.user as unknown) ?? null, null, `me → ${JSON.stringify(me.json)}`)

    // Token refresh and a fresh login are refused:
    const refresh = await rest('POST', '/miljo-accounts/refresh-token', { token })
    assert.notEqual(refresh.status, 200)
    assert.equal(refresh.json.refreshedToken, undefined)
    await sameAsWrongPassword('konto-d@aboks.invalid')
  })

  it('re-activating the business customer restores access — the accounts were never changed', async () => {
    const reactivate = await rest('PATCH', `/business-customers/${id.bcD}`, { token: t.admin, body: { status: 'active' } })
    assert.equal(reactivate.status, 200)
    const token = await h.login('miljo-accounts', 'konto-d@aboks.invalid', PASSWORD, MILJO_LOGIN)
    const res = await rest('GET', '/business-customers', { token })
    assert.deepEqual(docs(res.json).map((d) => d.id), [id.bcD])
  })

  it('suspending one company never affects another company’s account', async () => {
    await rest('PATCH', `/business-customers/${id.bcD}`, { token: t.admin, body: { status: 'suspended' } })
    const other = await rest('GET', '/business-customers', { token: t.accA })
    assert.deepEqual(docs(other.json).map((d) => d.id), [id.bcA])
    await rest('PATCH', `/business-customers/${id.bcD}`, { token: t.admin, body: { status: 'active' } })
  })
})

/* --------------------------------- staff --------------------------------- */

describe('editor (staff, not admin)', () => {
  it('has no access to business customers or Miljø accounts', async () => {
    for (const path of ['/business-customers', '/miljo-accounts']) {
      const res = await rest('GET', path, { token: t.editor })
      assert.equal(res.status, 403, path)
    }
    assert.equal((await rest('POST', '/business-customers', { token: t.editor, body: { name: 'x', organizationNumber: ORGNR.c, contactEmail: 'x@aboks.invalid' } })).status, 403)
    assert.equal((await rest('POST', '/miljo-accounts', { token: t.editor, body: { email: 'e@aboks.invalid', password: PASSWORD, businessCustomer: id.bcC } })).status, 403)
  })
})

describe('administrator — business customers', () => {
  const create = (body: Record<string, unknown>) => rest('POST', '/business-customers', { token: t.admin, body })
  const base = { name: 'Ny bedrift AS', contactEmail: 'Post@Ny-Bedrift.invalid' }

  it('rejects an invalid organisation number', async () => {
    const res = await create({ ...base, organizationNumber: ORGNR.invalidCheckDigit })
    assert.equal(res.status, 400)
    assert.match(JSON.stringify(res.json), /kontrollsifferet/)
    assert.equal((await create({ ...base, organizationNumber: '12345' })).status, 400)
  })

  it('rejects an environmental organisation that does not exist', async () => {
    const res = await create({ ...base, organizationNumber: '914778271', environmentalOrganization: 9999 })
    assert.equal(res.status, 400)
  })

  it('creates a valid customer: number normalised, e-mail lower-cased, system fields ignored', async () => {
    const res = await create({
      ...base,
      organizationNumber: 'NO 914 778 271 MVA',
      environmentalOrganization: id.orgFree,
      activatedAt: '2000-01-01T00:00:00.000Z',
      contactEmailVerifiedAt: '2000-01-01T00:00:00.000Z',
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const created = rows('business-customers').find((r) => r.name === base.name)!
    assert.equal(created.organizationNumber, '914778271')
    assert.equal(created.contactEmail, 'post@ny-bedrift.invalid')
    assert.equal(created.status, 'pending')
    assert.equal(created.activatedAt ?? null, null)
    assert.equal(created.contactEmailVerifiedAt ?? null, null)

    const activate = await rest('PATCH', `/business-customers/${created.id}`, { token: t.admin, body: { status: 'active' } })
    assert.equal(activate.status, 200, JSON.stringify(activate.json))
    assert.ok(typeof row('business-customers', created.id)?.activatedAt === 'string')
  })

  it('refuses deleting a business customer that has a Miljø account', async () => {
    const res = await rest('DELETE', `/business-customers/${id.bcA}`, { token: t.admin })
    assert.equal(res.status, 409)
    assert.ok(row('business-customers', id.bcA))
  })
})

describe('administrator — Miljø accounts', () => {
  it('rejects an account for a business customer that does not exist, or without one', async () => {
    assert.equal((await rest('POST', '/miljo-accounts', { token: t.admin, body: { email: 'x1@aboks.invalid', password: PASSWORD, businessCustomer: 9999 } })).status, 400)
    assert.equal((await rest('POST', '/miljo-accounts', { token: t.admin, body: { email: 'x2@aboks.invalid', password: PASSWORD } })).status, 400)
  })

  it('creates an account; a client-sent verification time is ignored', async () => {
    const customer = rows('business-customers').find((r) => r.name === 'Ny bedrift AS')!
    const res = await rest('POST', '/miljo-accounts', {
      token: t.admin,
      body: { email: 'ny@aboks.invalid', password: PASSWORD, businessCustomer: customer.id, status: 'active', emailVerifiedAt: '2000-01-01T00:00:00.000Z' },
    })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const created = rows('miljo-accounts').find((r) => r.email === 'ny@aboks.invalid')!
    assert.equal(created.emailVerifiedAt ?? null, null)
    // Not verified → cannot sign in, even though the status is «Aktiv».
    const login = await miljoLogin('ny@aboks.invalid', PASSWORD)
    assert.equal(login.status, 401)
  })

  it('an account can never be moved to another business customer', async () => {
    const res = await rest('PATCH', `/miljo-accounts/${id.accA}`, { token: t.admin, body: { businessCustomer: id.bcC } })
    assert.equal(res.status, 400)
    assert.equal(row('miljo-accounts', id.accA)?.businessCustomer, id.bcA)
  })
})
