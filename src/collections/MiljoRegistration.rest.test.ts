import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { memoryRateLimitStore } from '@/lib/security/dbRateLimit'
import { lookupOrganization } from '@/lib/miljo/registration/brreg'
import { RESEND_MAX_SENDS } from '@/lib/miljo/registration/constants'
import { PURCHASE_MESSAGES } from '@/lib/miljo/registration/purchase'
import {
  REGISTRATION_MESSAGES,
  confirmRegistration,
  lookupOrganizationForRegistration,
  resendConfirmation,
  submitRegistration,
  verifyPurchase,
  type RegistrationDeps,
} from '@/lib/miljo/registration/service'
import { resolveAuthorizedBusinessCustomerId } from '@/lib/miljo/businessAccess'
import { PIN_KEY_ENV, openPin, pinVaultKey } from '@/lib/miljo/pinVault'
import { BusinessCustomers } from './BusinessCustomers'
import { EnvironmentalOrganizations } from './EnvironmentalOrganizations'
import { MiljoAccounts } from './MiljoAccounts'
import { MiljoRegistrations } from './MiljoRegistrations'
import { Orders } from './Orders'
import { Users } from './Users'
import { ORDER_USED_FOR_REGISTRATION_MESSAGE } from './hooks/orderDelete'
import { enforceOrderBusinessCustomer, orderBusinessCustomerField } from './hooks/orderBusinessCustomer'

/**
 * Stage 2.2a — self-registration end to end: the real service on a real Payload instance (memory
 * database) with the real business-customers, miljo-accounts, environmental-organizations (QR code
 * hook, PIN fields) and miljo-registrations collections. The register, the mailer and the clock
 * are fakes. The account is finally signed in through Payload's REST login with the password chosen
 * at registration.
 *
 * Not covered here, because the memory database enforces neither: unique indexes and the atomic
 * conditional UPDATEs (./lib/miljo/registration/atomic) under real concurrency — those are verified
 * against Neon `preview`.
 */

const ProductsStandIn: CollectionConfig = {
  slug: 'products',
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'slug', type: 'text' },
    { name: 'section', type: 'text' },
  ],
}
const OrdersStandIn: CollectionConfig = {
  slug: 'orders',
  access: Orders.access,
  fields: [
    { name: 'orderNumber', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'customerInfo', type: 'group', fields: [{ name: 'email', type: 'text' }] },
    { name: 'items', type: 'array', fields: [{ name: 'product', type: 'relationship', relationTo: 'products' }] },
    orderBusinessCustomerField,
  ],
  hooks: { beforeChange: [enforceOrderBusinessCustomer], beforeDelete: Orders.hooks!.beforeDelete },
}

const REGISTRY: Record<string, string> = {
  '834012952': 'ABOKS AS',
  '923609016': 'FJORDVIK AS',
  '974760673': 'KYSTBYGG AS',
  '914778271': 'NORDLYS MILJØ AS',
  '889640782': 'ADMINBEDRIFT AS',
}
const PASSWORD = 'Hemmelig123'

let h: RestHarness
let clockMs = Date.parse('2026-11-03T12:00:00Z')
const mails: { to: string; text: string }[] = []
const rate = memoryRateLimitStore(() => clockMs)
const deps = (): RegistrationDeps => ({
  payload: h.payload,
  rateLimits: rate,
  lookupOrganization: (n) =>
    lookupOrganization(n, async (url) => {
      const nr = url.split('/').pop() ?? ''
      return REGISTRY[nr]
        ? { status: 200, ok: true, json: async () => ({ organisasjonsnummer: nr, navn: REGISTRY[nr] }) }
        : { status: 404, ok: false, json: async () => null }
    }),
  sendEmail: async (m) => {
    mails.push({ to: m.to, text: m.text })
  },
  siteUrl: 'https://preview.aboks.invalid',
  now: () => new Date(clockMs),
})

const rows = (slug: string): Row[] => (h.store[slug] ??= [])
const count = (slug: string) => rows(slug).length
const tokenFrom = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? ''
const lastToken = () => tokenFrom(mails[mails.length - 1]!.text)
const ip = '203.0.113.7'

let pid = { aboks: 0, accessory: 0 }
let orderSeq = 0
function addOrder(over: Record<string, unknown> = {}): { id: number; orderNumber: string } {
  orderSeq += 1
  const id = 500 + orderSeq
  const orderNumber = `AB-${String(100000 + orderSeq)}`
  rows('orders').push({ id, orderNumber, status: 'confirmed', customerInfo: { email: 'kjoper@firma.no' }, items: [{ id: `l${id}`, product: pid.aboks }], ...over })
  return { id, orderNumber }
}

const submit = (order: { orderNumber: string }, over: Record<string, unknown> = {}) =>
  submitRegistration(deps(), {
    orderNumber: order.orderNumber,
    email: 'kjoper@firma.no',
    organizationNumber: '923609016',
    contactName: 'Kari Fjord',
    loginEmail: 'kari@fjordvik.invalid',
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
    ip,
    ...over,
  })

before(async () => {
  process.env[PIN_KEY_ENV] = randomBytes(32).toString('base64')
  h = await createRestHarness('miljo-registration-test', [Users, ProductsStandIn, OrdersStandIn, EnvironmentalOrganizations, BusinessCustomers, MiljoAccounts, MiljoRegistrations])
  pid.aboks = (await h.payload.create({ collection: 'products', data: { title: 'aBoks', slug: 'aboks', section: 'products' } as never })).id as number
  pid.accessory = (await h.payload.create({ collection: 'products', data: { title: 'AA-Modul', slug: 'aa-modul', section: 'accessories' } as never })).id as number
})

beforeEach(() => rate.reset())

after(async () => {
  delete process.env[PIN_KEY_ENV]
  await h?.payload.destroy?.()
})

/* ------------------------------ step 1 ------------------------------ */

describe('step 1 — purchase', () => {
  it('a valid order and e-mail pass (order number and e-mail normalised)', async () => {
    const o = addOrder()
    const r = await verifyPurchase(deps(), { orderNumber: o.orderNumber.toLowerCase().replace('-', ' '), email: '  KJOPER@firma.no ', ip })
    assert.deepEqual(r, { ok: true, orderNumber: o.orderNumber })
  })

  it('unknown order and wrong e-mail give the SAME answer (no enumeration)', async () => {
    const o = addOrder()
    const unknown = await verifyPurchase(deps(), { orderNumber: 'AB-999999', email: 'kjoper@firma.no', ip })
    const wrongMail = await verifyPurchase(deps(), { orderNumber: o.orderNumber, email: 'annen@firma.no', ip })
    const garbage = await verifyPurchase(deps(), { orderNumber: 'hei', email: 'ikke-epost', ip })
    assert.deepEqual(unknown, wrongMail)
    assert.deepEqual(unknown, garbage)
    assert.deepEqual(unknown, { ok: false, status: 400, message: PURCHASE_MESSAGES.not_found, field: undefined, code: 'not_found' })
  })

  it('pending, cancelled and accessory-only orders are refused with their reason', async () => {
    const pending = addOrder({ status: 'pending' })
    const cancelled = addOrder({ status: 'cancelled' })
    const accessory = addOrder({ items: [{ id: 'acc', product: pid.accessory }] })
    assert.equal(((await verifyPurchase(deps(), { orderNumber: pending.orderNumber, email: 'kjoper@firma.no', ip })) as { code: string }).code, 'not_eligible_status')
    assert.equal(((await verifyPurchase(deps(), { orderNumber: cancelled.orderNumber, email: 'kjoper@firma.no', ip })) as { code: string }).code, 'not_eligible_status')
    assert.equal(((await verifyPurchase(deps(), { orderNumber: accessory.orderNumber, email: 'kjoper@firma.no', ip })) as { code: string }).code, 'no_aboks_product')
  })

  it('is rate-limited per client and per order', async () => {
    const o = addOrder()
    let last
    for (let i = 0; i < 9; i++) last = await verifyPurchase(deps(), { orderNumber: o.orderNumber, email: 'feil@firma.no', ip: `198.51.100.${i}` })
    assert.equal((last as { status: number }).status, 429, 'per-order limit across clients')
  })
})

/* ------------------------------ step 2 ------------------------------ */

describe('step 2 — organisation and registration', () => {
  it('the official name comes from Enhetsregisteret; unknown and invalid numbers are refused', async () => {
    const o = addOrder()
    const ok = await lookupOrganizationForRegistration(deps(), { orderNumber: o.orderNumber, email: 'kjoper@firma.no', organizationNumber: '923 609 016', ip })
    assert.deepEqual(ok, { ok: true, organizationNumber: '923609016', officialName: 'FJORDVIK AS' })
    const unknown = await lookupOrganizationForRegistration(deps(), { orderNumber: o.orderNumber, email: 'kjoper@firma.no', organizationNumber: '988077917', ip })
    assert.equal((unknown as { code?: string }).code, 'not_found')
    const invalid = await lookupOrganizationForRegistration(deps(), { orderNumber: o.orderNumber, email: 'kjoper@firma.no', organizationNumber: '834012953', ip })
    assert.equal((invalid as { code?: string }).code, 'invalid')
  })

  it('the lookup requires a verified purchase (not an open proxy to the register)', async () => {
    const r = await lookupOrganizationForRegistration(deps(), { orderNumber: 'AB-999999', email: 'x@firma.no', organizationNumber: '923609016', ip })
    assert.equal((r as { code?: string }).code, 'not_found')
  })

  it('submitting stores a «Venter» registration, sends ONE e-mail to the login address and creates nothing else', async () => {
    const before = { bc: count('business-customers'), acc: count('miljo-accounts'), org: count('environmental-organizations') }
    const o = addOrder()
    mails.length = 0
    const r = await submit(o, { loginEmail: 'Kari@Fjordvik.invalid' })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.equal(mails.length, 1)
    assert.equal(mails[0]!.to, 'kari@fjordvik.invalid', 'login e-mail, not the purchase e-mail')
    const reg = rows('miljo-registrations').at(-1)!
    assert.equal(reg.status, 'pending')
    assert.equal(reg.officialName, 'FJORDVIK AS')
    assert.doesNotMatch(JSON.stringify(reg), new RegExp(PASSWORD), 'no clear password stored')
    assert.doesNotMatch(JSON.stringify(reg), new RegExp(lastToken()), 'no clear token stored')
    assert.deepEqual({ bc: count('business-customers'), acc: count('miljo-accounts'), org: count('environmental-organizations') }, before)
  })

  it('validation: contact, login e-mail, password policy and confirmation', async () => {
    const o = addOrder()
    assert.equal(((await submit(o, { contactName: ' ' })) as { field?: string }).field, 'contactName')
    assert.equal(((await submit(o, { loginEmail: 'nei' })) as { field?: string }).field, 'loginEmail')
    assert.equal(((await submit(o, { password: 'kort', passwordConfirmation: 'kort' })) as { field?: string }).field, 'password')
    assert.equal(((await submit(o, { passwordConfirmation: 'Annet12345' })) as { field?: string }).field, 'password')
  })

  it('a new attempt for the same order supersedes the earlier one — only one «Venter» per order', async () => {
    const o = addOrder()
    await submit(o)
    const firstToken = lastToken()
    await submit(o, { contactName: 'Kari Fjord-Hansen' })
    const regs = rows('miljo-registrations').filter((r) => r.order === o.id)
    assert.deepEqual(regs.map((r) => r.status).sort(), ['pending', 'superseded'])
    const old = await confirmRegistration(deps(), { token: firstToken, ip })
    assert.equal((old as { code?: string }).code, 'invalid')
  })
})

/* ------------------------------ activation ------------------------------ */

describe('confirmation and automatic activation', () => {
  let order: { id: number; orderNumber: string }
  let token = ''

  before(async () => {
    order = addOrder({ customerInfo: { email: 'innkjop@kystbygg.invalid' } })
    mails.length = 0
    const r = await submitRegistration(deps(), {
      orderNumber: order.orderNumber,
      email: 'innkjop@kystbygg.invalid',
      organizationNumber: '974760673',
      contactName: 'Ola Kyst',
      loginEmail: 'innkjop@kystbygg.invalid', // same as the purchase e-mail — allowed
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
      ip,
    })
    assert.equal(r.ok, true, JSON.stringify(r))
    token = lastToken()
  })

  it('activates everything in one go: company, order link, organisation + QR code, PIN, account', async () => {
    const r = await confirmRegistration(deps(), { token, ip })
    assert.equal(r.ok, true, JSON.stringify(r))
    const res = r as { alreadyActivated: boolean; organizationName: string; publicCode: string }
    assert.equal(res.alreadyActivated, false)
    assert.equal(res.organizationName, 'KYSTBYGG AS')
    assert.match(res.publicCode, /^[a-z2-9]{10}$/)

    const customer = rows('business-customers').find((c) => c.organizationNumber === '974760673')!
    assert.equal(customer.status, 'active')
    assert.equal(customer.name, 'KYSTBYGG AS')
    assert.equal(typeof customer.contactEmailVerifiedAt, 'string')
    assert.equal(rows('orders').find((o) => o.id === order.id)!.businessCustomer, customer.id)

    const org = rows('environmental-organizations').find((o) => o.id === customer.environmentalOrganization)!
    assert.equal(org.publicCode, res.publicCode)
    assert.match(String(org.pinHash), /^scrypt\$/)
    const pin = openPin(String(org.pinEncrypted), Number(org.id), pinVaultKey()!)
    assert.match(String(pin), /^\d{6,10}$/, 'PIN revealable later through the existing vault')

    const account = rows('miljo-accounts').find((a) => a.businessCustomer === customer.id)!
    assert.equal(account.status, 'active')
    assert.equal(account.email, 'innkjop@kystbygg.invalid')
    assert.equal(typeof account.emailVerifiedAt, 'string')
  })

  it('the account signs in with the password chosen at registration', async () => {
    const res = await h.rest('POST', '/miljo-accounts/login', { body: { email: 'innkjop@kystbygg.invalid', password: PASSWORD } })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    const wrong = await h.rest('POST', '/miljo-accounts/login', { body: { email: 'innkjop@kystbygg.invalid', password: 'Feil123456' } })
    assert.equal(wrong.status, 401)
  })

  it('opening the link again creates nothing — «already activated»', async () => {
    const before = [count('business-customers'), count('miljo-accounts'), count('environmental-organizations')]
    const r = await confirmRegistration(deps(), { token, ip })
    assert.equal(r.ok, true)
    assert.equal((r as { alreadyActivated: boolean }).alreadyActivated, true)
    assert.deepEqual([count('business-customers'), count('miljo-accounts'), count('environmental-organizations')], before)
  })

  it('the same order cannot register another company afterwards', async () => {
    const r = await verifyPurchase(deps(), { orderNumber: order.orderNumber, email: 'innkjop@kystbygg.invalid', ip })
    assert.equal((r as { code?: string }).code, 'linked_elsewhere')
  })

  it('a second purchase by the same company never creates a second account', async () => {
    const again = addOrder({ customerInfo: { email: 'innkjop@kystbygg.invalid' } })
    const r = await submitRegistration(deps(), {
      orderNumber: again.orderNumber,
      email: 'innkjop@kystbygg.invalid',
      organizationNumber: '974760673',
      contactName: 'Ola Kyst',
      loginEmail: 'ola2@kystbygg.invalid',
      password: PASSWORD,
      passwordConfirmation: PASSWORD,
      ip,
    })
    assert.equal((r as { code?: string }).code, 'already_registered')
    assert.equal(rows('miljo-accounts').filter((a) => a.email === 'ola2@kystbygg.invalid').length, 0)
  })

  it('cancelling the company’s only order pauses access; history stays; a valid purchase restores it', async () => {
    const account = rows('miljo-accounts').find((a) => a.email === 'innkjop@kystbygg.invalid')!
    const req = { payload: h.payload, user: { ...account, collection: 'miljo-accounts' } } as never
    assert.notEqual(await resolveAuthorizedBusinessCustomerId(req), null)
    const o = rows('orders').find((x) => x.id === order.id)!
    o.status = 'cancelled'
    assert.equal(await resolveAuthorizedBusinessCustomerId({ payload: h.payload, user: { ...account, collection: 'miljo-accounts' } } as never), null)
    assert.ok(rows('business-customers').some((c) => c.organizationNumber === '974760673'), 'nothing deleted')
    o.status = 'delivered'
    assert.notEqual(await resolveAuthorizedBusinessCustomerId({ payload: h.payload, user: { ...account, collection: 'miljo-accounts' } } as never), null)
  })
})

describe('links: expiry, resend, concurrency', () => {
  it('an expired link is refused and activates nothing', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '914778271', loginEmail: 'utlopt@nordlys.invalid' })
    const token = lastToken()
    const before = count('miljo-accounts')
    clockMs += 25 * 60 * 60 * 1000
    const r = await confirmRegistration(deps(), { token, ip })
    clockMs -= 25 * 60 * 60 * 1000
    assert.equal((r as { code?: string }).code, 'expired')
    assert.equal(count('miljo-accounts'), before)
  })

  it('resend: a new link replaces the old one, at most once a minute and five times in total', async () => {
    const o = addOrder()
    mails.length = 0
    const r = await submit(o, { organizationNumber: '914778271', loginEmail: 'resend@nordlys.invalid' })
    const key = (r as { resendKey: string }).resendKey
    const first = lastToken()
    assert.equal(((await resendConfirmation(deps(), { resendKey: key, ip })) as { status?: number }).status, 429, 'too soon')
    clockMs += 61_000
    assert.equal((await resendConfirmation(deps(), { resendKey: key, ip })).ok, true)
    assert.equal(mails.length, 2)
    assert.notEqual(lastToken(), first)
    assert.equal(((await confirmRegistration(deps(), { token: first, ip })) as { code?: string }).code, 'invalid', 'the old link stopped working')
    for (let i = 2; i < RESEND_MAX_SENDS; i++) {
      clockMs += 61_000
      assert.equal((await resendConfirmation(deps(), { resendKey: key, ip })).ok, true)
    }
    clockMs += 61_000
    assert.equal(((await resendConfirmation(deps(), { resendKey: key, ip })) as { message?: string }).message, REGISTRATION_MESSAGES.resendLimit)
    assert.equal(rows('miljo-registrations').filter((x) => x.order === o.id).length, 1, 'resend never creates a registration')
  })

  it('two simultaneous confirmations of the same link activate exactly once', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '914778271', loginEmail: 'samtidig@nordlys.invalid' })
    const token = lastToken()
    const before = { bc: count('business-customers'), acc: count('miljo-accounts'), org: count('environmental-organizations') }
    const [a, b] = await Promise.all([confirmRegistration(deps(), { token, ip }), confirmRegistration(deps(), { token, ip })])
    assert.equal(a.ok && b.ok, true, JSON.stringify([a, b]))
    assert.deepEqual([a, b].map((x) => (x as { alreadyActivated: boolean }).alreadyActivated).sort(), [false, true])
    assert.deepEqual({ bc: count('business-customers'), acc: count('miljo-accounts'), org: count('environmental-organizations') }, { bc: before.bc + 1, acc: before.acc + 1, org: before.org + 1 })
  })
})

describe('existing companies are never taken over', () => {
  it('a company created by aBoks is linked ONLY when aBoks linked this order to it', async () => {
    const admin = (await h.payload.create({ collection: 'business-customers', data: { name: 'Adminbedrift', organizationNumber: '889640782', contactEmail: 'admin@adminbedrift.invalid', status: 'pending' } as never })).id as number
    const unlinked = addOrder()
    const refused = await submit(unlinked, { organizationNumber: '889640782', loginEmail: 'x@adminbedrift.invalid' })
    assert.equal((refused as { code?: string }).code, 'contact_aboks')

    const linked = addOrder({ businessCustomer: admin })
    mails.length = 0
    const ok = await submit(linked, { organizationNumber: '889640782', loginEmail: 'kontakt@adminbedrift.invalid' })
    assert.equal(ok.ok, true, JSON.stringify(ok))
    const act = await confirmRegistration(deps(), { token: lastToken(), ip })
    assert.equal(act.ok, true, JSON.stringify(act))
    assert.equal(rows('business-customers').filter((c) => c.organizationNumber === '889640782').length, 1, 'no duplicate')
    const customer = rows('business-customers').find((c) => c.id === admin)!
    assert.equal(customer.status, 'active')
    assert.equal(customer.name, 'Adminbedrift', 'aBoks’ own data kept')
  })

  it('a company that already has an account is never registered again — by number or by order', async () => {
    const o = addOrder()
    const r = await submit(o, { organizationNumber: '974760673', loginEmail: 'kaprer@kystbygg.invalid' })
    assert.equal((r as { code?: string }).code, 'already_registered')
  })

  it('an order linked to one company cannot register another number', async () => {
    const other = (await h.payload.create({ collection: 'business-customers', data: { name: 'Annen', organizationNumber: '834012952', contactEmail: 'a@annen.invalid', status: 'pending' } as never })).id as number
    const o = addOrder({ businessCustomer: other })
    const r = await submit(o, { organizationNumber: '923609016', loginEmail: 'feil@annen.invalid' })
    assert.equal((r as { field?: string }).field, 'organizationNumber')
  })

  it('a login e-mail already used by another account is refused', async () => {
    const o = addOrder()
    const r = await submit(o, { organizationNumber: '923609016', loginEmail: 'innkjop@kystbygg.invalid' })
    assert.equal((r as { field?: string }).field, 'loginEmail')
  })
})

describe('deleting an order a registration was verified with', () => {
  it('is refused with a Norwegian message; an unrelated order can still be deleted', async () => {
    await h.payload.create({ collection: 'users', data: { email: 'admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
    const admin = await h.login('users', 'admin@aboks.invalid', PASSWORD)
    const used = rows('miljo-registrations')[0]!.order as number
    const res = await h.rest('DELETE', `/orders/${used}`, { token: admin })
    assert.equal(res.status, 409, JSON.stringify(res.json))
    assert.match(JSON.stringify(res.json), /brukt til å bekrefte en registrering i aBoks Miljøregistrering/)
    assert.equal((res.json.errors as { message: string }[])[0]!.message, ORDER_USED_FOR_REGISTRATION_MESSAGE)
    assert.ok(rows('orders').some((o) => o.id === used), 'the order is still there')

    const free = addOrder()
    assert.equal((await h.rest('DELETE', `/orders/${free.id}`, { token: admin })).status, 200)
    assert.equal(rows('orders').some((o) => o.id === free.id), false)
  })
})

describe('the public API stays closed', () => {
  it('nobody can list, create or change registrations through REST', async () => {
    assert.equal((await h.rest('GET', '/miljo-registrations')).status, 403)
    assert.equal((await h.rest('POST', '/miljo-registrations', { body: { status: 'confirmed', order: 1 } })).status, 403)
    const anyId = rows('miljo-registrations')[0]!.id
    assert.equal((await h.rest('PATCH', `/miljo-registrations/${anyId}`, { body: { status: 'confirmed' } })).status, 403)
  })

  it('a forged activation (public account creation) is still refused', async () => {
    const customer = rows('business-customers')[0]!
    const res = await h.rest('POST', '/miljo-accounts', { body: { email: 'falsk@x.invalid', password: PASSWORD, businessCustomer: customer.id, status: 'active', emailVerifiedAt: new Date().toISOString() } })
    assert.equal(res.status, 403)
  })
})
