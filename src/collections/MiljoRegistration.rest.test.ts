import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { miljoLoginOn } from '@/lib/testing/miljoStandIns'
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
import { APPROVAL_MESSAGES, approveRegistration, rejectRegistration, saveInternalNotes, type ApprovalDeps } from '@/lib/miljo/registration/approval'
import { dashboard, revealPin, signIn, type AccountDeps } from '@/lib/miljo/account/service'
import { currentSession } from '@/lib/miljo/account/session'
import { BusinessCustomers } from './BusinessCustomers'
import { EnvironmentalOrganizations } from './EnvironmentalOrganizations'
import { MiljoAccounts } from './MiljoAccounts'
import { MiljoRegistrationAudit } from './MiljoAudit'
import { MiljoRegistrations } from './MiljoRegistrations'
import { Orders } from './Orders'
import { Users } from './Users'
import { ORDER_USED_FOR_REGISTRATION_MESSAGE } from './hooks/orderDelete'
import { enforceOrderBusinessCustomer, orderBusinessCustomerField } from './hooks/orderBusinessCustomer'

/**
 * Stage 2.2a + 2.6 — self-registration and approval end to end: the real services on a real Payload instance (memory
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
  '910000012': 'PRIVATKJØP AS',
  '910001388': 'KONFLIKT AS',
  '910002759': 'SAMTIDIG AS',
  '910004123': 'TILGANG AS',
  '910005499': 'VENTER AS',
  '910008234': 'NOTAT AS',
  '910009605': 'KANSELLERT AS',
  '910011006': 'KAPPLØP AS',
}
const PASSWORD = 'Hemmelig123'

let h: RestHarness
const miljoLogin = (email: string, password: string) => miljoLoginOn(h, email, password)
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

const approvalDeps = (): ApprovalDeps => ({
  payload: h.payload,
  sendEmail: async (m) => {
    mails.push({ to: m.to, text: m.text })
  },
  siteUrl: 'https://preview.aboks.invalid',
  now: () => new Date(clockMs),
})
const admin = { id: 1, email: 'godkjenner@aboks.invalid' }
const registrationOf = (loginEmail: string) => rows('miljo-registrations').find((r) => r.loginEmail === loginEmail && r.status !== 'superseded')!
const approve = (id: number) => approveRegistration(approvalDeps(), admin, id, { verificationMethod: 'phone', note: 'Ringte sentralbordet' })
/** Confirms the e-mail with the newest link in the outbox addressed to `loginEmail`. */
const confirmFor = (loginEmail: string) => confirmRegistration(deps(), { token: tokenFrom(mails.filter((m) => m.to === loginEmail).at(-1)!.text), ip })
const counts = () => ({ bc: count('business-customers'), acc: count('miljo-accounts'), org: count('environmental-organizations') })

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
  h = await createRestHarness('miljo-registration-test', [Users, ProductsStandIn, OrdersStandIn, EnvironmentalOrganizations, BusinessCustomers, MiljoAccounts, MiljoRegistrations, MiljoRegistrationAudit])
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

  it('submitting stores a «Venter» registration, e-mails the login address and the order address, and creates nothing else', async () => {
    const before = { bc: count('business-customers'), acc: count('miljo-accounts'), org: count('environmental-organizations') }
    const o = addOrder()
    mails.length = 0
    const r = await submit(o, { loginEmail: 'Kari@Fjordvik.invalid' })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.deepEqual(mails.map((m) => m.to), ['kari@fjordvik.invalid', 'kjoper@firma.no'])
    const reg = rows('miljo-registrations').at(-1)!
    assert.equal(reg.status, 'pending')
    assert.equal(reg.officialName, 'FJORDVIK AS')
    assert.doesNotMatch(JSON.stringify(reg), new RegExp(PASSWORD), 'no clear password stored')
    assert.doesNotMatch(JSON.stringify(reg), new RegExp(tokenFrom(mails[0]!.text)), 'no clear token stored')
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
    mails.length = 0
    await submit(o)
    const firstToken = tokenFrom(mails[0]!.text)
    await submit(o, { contactName: 'Kari Fjord-Hansen' })
    const regs = rows('miljo-registrations').filter((r) => r.order === o.id)
    assert.deepEqual(regs.map((r) => r.status).sort(), ['pending', 'superseded'])
    const old = await confirmRegistration(deps(), { token: firstToken, ip })
    assert.equal((old as { code?: string }).code, 'invalid')
  })
})

/* ------------------------------ activation ------------------------------ */

describe('e-mail confirmation, approval and activation', () => {
  let order: { id: number; orderNumber: string }
  let token = ''
  let regId = 0

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
    regId = registrationOf('innkjop@kystbygg.invalid').id
  })

  it('confirming the e-mail does NOT activate: nothing is created and sign-in is refused', async () => {
    const before = counts()
    const r = await confirmRegistration(deps(), { token, ip })
    assert.equal(r.ok, true, JSON.stringify(r))
    const res = r as { state: string; alreadyConfirmed: boolean; organizationName: string; publicCode: string | null }
    assert.equal(res.state, 'awaiting_approval')
    assert.equal(res.alreadyConfirmed, false)
    assert.equal(res.organizationName, 'KYSTBYGG AS')
    assert.equal(res.publicCode, null, 'no QR code before approval')
    assert.deepEqual(counts(), before)
    assert.equal(rows('orders').find((o) => o.id === order.id)!.businessCustomer ?? null, null, 'the order is not linked yet')
    const reg = rows('miljo-registrations').find((x) => x.id === regId)!
    assert.equal(reg.status, 'awaiting_approval')
    assert.equal(typeof reg.confirmedAt, 'string')
    assert.equal((await miljoLogin('innkjop@kystbygg.invalid', PASSWORD)).status, 401)
  })

  it('aBoks is told that an application waits; the applicant’s password and link are not in that e-mail', async () => {
    const notice = mails.find((m) => m.to === 'post@aboks.no')
    assert.ok(notice, 'administrator notified')
    assert.match(notice.text, /KYSTBYGG AS/)
    assert.match(notice.text, /\/admin\/collections\/miljo-registrations\//)
    assert.doesNotMatch(notice.text, new RegExp(PASSWORD))
    assert.doesNotMatch(notice.text, /token=/)
  })

  it('opening the link again changes nothing and still says «awaiting approval»', async () => {
    const before = counts()
    mails.length = 0
    const r = await confirmRegistration(deps(), { token, ip })
    assert.equal((r as { state: string }).state, 'awaiting_approval')
    assert.equal((r as { alreadyConfirmed: boolean }).alreadyConfirmed, true)
    assert.deepEqual(counts(), before)
    assert.equal(mails.length, 0, 'aBoks is notified once')
  })

  // Regression (Stage 2.2b on Preview): activation without MILJO_PIN_ENCRYPTION_KEY used to store
  // the new PIN as a hash only, so «Vis PIN» on Min side could never show it. Now it is refused.
  it('without the PIN vault key, approval is refused before anything is written', async () => {
    const key = process.env[PIN_KEY_ENV]
    delete process.env[PIN_KEY_ENV]
    const before = counts()
    try {
      const r = await approve(regId)
      assert.equal(r.ok, false)
      assert.equal((r as { message?: string }).message, APPROVAL_MESSAGES.vault)
    } finally {
      process.env[PIN_KEY_ENV] = key
    }
    assert.deepEqual(counts(), before)
    assert.equal(rows('miljo-registrations').find((r) => r.id === regId)?.status, 'awaiting_approval')
  })

  it('approval needs a stated verification method', async () => {
    const r = await approveRegistration(approvalDeps(), admin, regId, { verificationMethod: 'magefølelse', note: '' })
    assert.equal((r as { field?: string }).field, 'verificationMethod')
    const other = await approveRegistration(approvalDeps(), admin, regId, { verificationMethod: 'other', note: '  ' })
    assert.equal((other as { field?: string }).field, 'note')
    assert.equal(rows('miljo-registrations').find((x) => x.id === regId)?.status, 'awaiting_approval')
  })

  it('an administrator cannot approve an application made with their own e-mail address', async () => {
    const r = await approveRegistration(approvalDeps(), { id: 2, email: 'INNKJOP@kystbygg.invalid' }, regId, { verificationMethod: 'phone', note: '' })
    assert.equal((r as { status?: number }).status, 403)
    assert.equal((r as { message?: string }).message, APPROVAL_MESSAGES.selfApproval)
    assert.equal(rows('miljo-registrations').find((x) => x.id === regId)?.status, 'awaiting_approval')
  })

  it('approval activates everything in one go: company, order link, organisation + QR code, PIN, account', async () => {
    mails.length = 0
    const r = await approve(regId)
    assert.deepEqual(r, { ok: true, emailSent: true })

    const customer = rows('business-customers').find((c) => c.organizationNumber === '974760673')!
    assert.equal(customer.status, 'active')
    assert.equal(customer.name, 'KYSTBYGG AS')
    assert.equal(typeof customer.contactEmailVerifiedAt, 'string')
    assert.equal(rows('orders').find((o) => o.id === order.id)!.businessCustomer, customer.id)

    const org = rows('environmental-organizations').find((o) => o.id === customer.environmentalOrganization)!
    assert.match(String(org.publicCode), /^[a-z2-9]{10}$/)
    assert.match(String(org.pinHash), /^scrypt\$/)
    const pin = openPin(String(org.pinEncrypted), Number(org.id), pinVaultKey()!)
    assert.match(String(pin), /^\d{6,10}$/, 'PIN revealable later through the existing vault')

    const account = rows('miljo-accounts').find((a) => a.businessCustomer === customer.id)!
    assert.equal(account.status, 'active')
    assert.equal(account.email, 'innkjop@kystbygg.invalid')
    assert.equal(typeof account.emailVerifiedAt, 'string')

    const reg = rows('miljo-registrations').find((x) => x.id === regId)!
    assert.equal(reg.status, 'confirmed')
    assert.equal(reg.decidedByLabel, admin.email)
    assert.equal(reg.verificationMethod, 'phone')
    assert.equal(reg.decisionNote, 'Ringte sentralbordet')
    assert.equal(typeof reg.decidedAt, 'string')
    assert.equal(reg.passwordHash ?? null, null, 'the password hash left the registration')

    assert.equal(mails.length, 1)
    assert.equal(mails[0]!.to, 'innkjop@kystbygg.invalid')
    assert.match(mails[0]!.text, /Bedriftskontoen er aktivert/)
    assert.doesNotMatch(mails[0]!.text, new RegExp(PASSWORD))
  })

  it('the account signs in with the password chosen at registration', async () => {
    const res = await miljoLogin('innkjop@kystbygg.invalid', PASSWORD)
    assert.equal(res.status, 200, res.message)
    const wrong = await miljoLogin('innkjop@kystbygg.invalid', 'Feil123456')
    assert.equal(wrong.status, 401)
  })

  // Regression (Stage 2.2b): the PIN written by activation (2.2a) is the PIN Min side reveals —
  // through the REAL environmental-organizations collection, whose PIN fields are closed to every API.
  it('Min side «Vis PIN» shows exactly the PIN created at activation, and viewing changes nothing', async () => {
    const accountDeps: AccountDeps = { payload: h.payload, rateLimits: rate, sendEmail: async () => {}, siteUrl: 'https://preview.aboks.invalid', now: () => new Date(clockMs) }
    const signedIn = await signIn(accountDeps, { email: 'innkjop@kystbygg.invalid', password: PASSWORD, ip })
    assert.equal(signedIn.ok, true, JSON.stringify(signedIn))
    const session = await currentSession(h.payload, (signedIn as { token: string }).token)
    assert.ok(session)
    const customer = rows('business-customers').find((c) => c.organizationNumber === '974760673')!
    const org = rows('environmental-organizations').find((o) => o.id === customer.environmentalOrganization)!
    const stored = { pinHash: org.pinHash, pinEncrypted: org.pinEncrypted, pinSetAt: org.pinSetAt }
    const expected = openPin(String(org.pinEncrypted), Number(org.id), pinVaultKey()!)
    assert.match(String(expected), /^\d{6}$/)

    const revealed = await revealPin(accountDeps, session)
    assert.deepEqual(revealed, { ok: true, pin: expected })
    assert.deepEqual({ pinHash: org.pinHash, pinEncrypted: org.pinEncrypted, pinSetAt: org.pinSetAt }, stored, 'no new PIN')
    assert.equal((await dashboard(session)).publicUrl, `https://aboks.no/miljo/${String(org.publicCode)}`)
  })

  it('a repeated approval is refused and creates nothing', async () => {
    const before = counts()
    mails.length = 0
    const r = await approve(regId)
    assert.equal((r as { status?: number }).status, 409)
    assert.equal((r as { message?: string }).message, APPROVAL_MESSAGES.alreadyDecided)
    assert.deepEqual(counts(), before)
    assert.equal(mails.length, 0)
  })

  it('a rejection after approval is refused: the decision stands', async () => {
    const r = await rejectRegistration(approvalDeps(), admin, regId, { reason: 'Ombestemt' })
    assert.equal((r as { status?: number }).status, 409)
    assert.equal(rows('miljo-registrations').find((x) => x.id === regId)?.status, 'confirmed')
  })

  it('opening the link after approval says the account is active — and creates nothing', async () => {
    const before = counts()
    const r = await confirmRegistration(deps(), { token, ip })
    assert.equal((r as { state: string }).state, 'activated')
    assert.match(String((r as { publicCode: string }).publicCode), /^[a-z2-9]{10}$/)
    assert.deepEqual(counts(), before)
  })

  it('the history records every step, with the administrator, and cannot be changed', async () => {
    const history = rows('miljo-registration-audit').filter((a) => a.registration === regId)
    assert.deepEqual(history.map((a) => a.action), ['submitted', 'email-verified', 'approved', 'activated'])
    const approved = history.find((a) => a.action === 'approved')!
    assert.equal(approved.performedByLabel, admin.email)
    assert.equal(approved.reason, 'Ringte sentralbordet')
    assert.doesNotMatch(JSON.stringify(history), new RegExp(PASSWORD))

    await h.payload.create({ collection: 'users', data: { email: 'historikk@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
    const token2 = await h.login('users', 'historikk@aboks.invalid', PASSWORD)
    const id = history[0]!.id
    assert.equal((await h.rest('DELETE', `/miljo-registration-audit/${id}`, { token: token2 })).status, 403)
    assert.equal((await h.rest('PATCH', `/miljo-registration-audit/${id}`, { token: token2, body: { action: 'rejected' } })).status, 403)
    assert.equal((await h.rest('POST', '/miljo-registration-audit', { token: token2, body: { registration: regId, action: 'approved' } })).status, 403)
    assert.equal((await h.rest('PATCH', `/miljo-registrations/${regId}`, { token: token2, body: { status: 'rejected' } })).status, 403, 'not even an administrator edits a status by hand')
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

describe('a private checkout order', () => {
  it('lets a real organisation apply: nothing about the order is classified, and approval works', async () => {
    const o = addOrder({ customerInfo: { email: 'ola.nordmann@gmail.invalid', firstName: 'Ola', lastName: 'Nordmann' } })
    mails.length = 0
    const r = await submit(o, { email: 'ola.nordmann@gmail.invalid', organizationNumber: '910000012', loginEmail: 'ola@nordlysmiljo.invalid' })
    assert.equal(r.ok, true, JSON.stringify(r))
    const reg = registrationOf('ola@nordlysmiljo.invalid')
    assert.equal(reg.orderEmail, 'ola.nordmann@gmail.invalid')
    await confirmFor('ola@nordlysmiljo.invalid')
    assert.deepEqual(await approve(reg.id), { ok: true, emailSent: true })
    assert.equal((await miljoLogin('ola@nordlysmiljo.invalid', PASSWORD)).status, 200)
  })
})

describe('the security notice to the order’s e-mail address', () => {
  it('goes to the order address, names the order and the organisation, and holds no secrets or login address', async () => {
    const o = addOrder()
    mails.length = 0
    await submit(o, { organizationNumber: '923609016', loginEmail: 'varsel@fjordvik.invalid' })
    const notice = mails.find((m) => m.to === 'kjoper@firma.no')!
    assert.ok(notice)
    assert.match(notice.text, new RegExp(o.orderNumber))
    assert.match(notice.text, /FJORDVIK AS/)
    assert.match(notice.text, /post@aboks\.no/)
    assert.doesNotMatch(notice.text, /token=/)
    assert.doesNotMatch(notice.text, new RegExp(PASSWORD))
    assert.doesNotMatch(notice.text, /varsel@fjordvik/)
    assert.equal(typeof registrationOf('varsel@fjordvik.invalid').orderNoticeSentAt, 'string')
  })

  it('is not sent twice when the login address is the order address', async () => {
    const o = addOrder()
    mails.length = 0
    await submit(o, { organizationNumber: '923609016', loginEmail: 'KJOPER@firma.no' })
    assert.deepEqual(mails.map((m) => m.to), ['kjoper@firma.no'])
    assert.match(mails[0]!.text, /Bekreft registreringen/)
  })

  it('never reveals the order address to the applicant, and a failed notice does not stop the application', async () => {
    const o = addOrder()
    const failing: RegistrationDeps = {
      ...deps(),
      sendEmail: async (m) => {
        if (m.to === 'kjoper@firma.no') throw new Error('smtp down')
        mails.push({ to: m.to, text: m.text })
      },
    }
    const r = await submitRegistration(failing, { orderNumber: o.orderNumber, email: 'kjoper@firma.no', organizationNumber: '923609016', contactName: 'Kari Fjord', loginEmail: 'feilet@fjordvik.invalid', password: PASSWORD, passwordConfirmation: PASSWORD, ip })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.doesNotMatch(JSON.stringify(r), /kjoper@firma/)
    assert.equal(registrationOf('feilet@fjordvik.invalid').orderNoticeSentAt ?? null, null, 'the administrator can see it was not sent')
  })
})

describe('rejection', () => {
  it('stays inactive: no account, no sign-in, a neutral e-mail, the reason kept internal, the password hash gone', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '923609016', loginEmail: 'avvist@fjordvik.invalid' })
    const token = tokenFrom(mails.filter((m) => m.to === 'avvist@fjordvik.invalid').at(-1)!.text)
    await confirmFor('avvist@fjordvik.invalid')
    const reg = registrationOf('avvist@fjordvik.invalid')
    const before = counts()
    mails.length = 0

    assert.equal(((await rejectRegistration(approvalDeps(), admin, reg.id, { reason: ' ' })) as { field?: string }).field, 'reason')
    assert.deepEqual(await rejectRegistration(approvalDeps(), admin, reg.id, { reason: 'Kunne ikke bekrefte tilknytning' }), { ok: true, emailSent: true })

    const row = rows('miljo-registrations').find((x) => x.id === reg.id)!
    assert.equal(row.status, 'rejected')
    assert.equal(row.decisionNote, 'Kunne ikke bekrefte tilknytning')
    assert.equal(row.passwordHash ?? null, null)
    assert.deepEqual(counts(), before)
    assert.equal(mails.length, 1)
    assert.match(mails[0]!.text, /ikke godkjent/)
    assert.match(mails[0]!.text, /post@aboks\.no/)
    assert.doesNotMatch(mails[0]!.text, /Kunne ikke bekrefte tilknytning/)
    assert.equal((await miljoLogin('avvist@fjordvik.invalid', PASSWORD)).status, 401)
    assert.equal(((await confirmRegistration(deps(), { token, ip })) as { state: string }).state, 'rejected')
    assert.equal(rows('orders').find((x) => x.id === o.id)!.businessCustomer ?? null, null)

    const again = await approve(reg.id)
    assert.equal((again as { message?: string }).message, APPROVAL_MESSAGES.alreadyDecided, 'a refused application cannot be approved afterwards')
    assert.deepEqual(rows('miljo-registration-audit').filter((a) => a.registration === reg.id).map((a) => a.action), ['submitted', 'email-verified', 'rejected'])
  })

  it('the applicant may apply again; the earlier refusal is visible to the administrator', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '923609016', loginEmail: 'forste@fjordvik.invalid' })
    await confirmFor('forste@fjordvik.invalid')
    await rejectRegistration(approvalDeps(), admin, registrationOf('forste@fjordvik.invalid').id, { reason: 'Feil' })
    const r = await submit(o, { organizationNumber: '923609016', loginEmail: 'andre@fjordvik.invalid' })
    assert.equal(r.ok, true, JSON.stringify(r))
    const { registrationReview } = await import('@/lib/miljo/registration/approval')
    const req = { payload: h.payload } as never
    const review = await registrationReview(req, admin, registrationOf('andre@fjordvik.invalid').id)
    assert.ok(review?.warnings.some((w) => /avvist/.test(w)), JSON.stringify(review?.warnings))
  })
})

describe('applications awaiting approval', () => {
  it('an order with one awaiting approval cannot start another — it cannot be pushed out of the queue', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '923609016', loginEmail: 'ko@fjordvik.invalid' })
    await confirmFor('ko@fjordvik.invalid')
    const verify = await verifyPurchase(deps(), { orderNumber: o.orderNumber, email: 'kjoper@firma.no', ip })
    assert.equal((verify as { code?: string }).code, 'awaiting_approval')
    const again = await submit(o, { organizationNumber: '923609016', loginEmail: 'kaprer@fjordvik.invalid' })
    assert.equal((again as { code?: string }).code, 'awaiting_approval')
    assert.equal(registrationOf('ko@fjordvik.invalid').status, 'awaiting_approval')
  })

  it('an unconfirmed registration cannot be decided', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '923609016', loginEmail: 'ubekreftet@fjordvik.invalid' })
    const reg = registrationOf('ubekreftet@fjordvik.invalid')
    assert.equal(((await approve(reg.id)) as { message?: string }).message, APPROVAL_MESSAGES.notReady)
    assert.equal(((await rejectRegistration(approvalDeps(), admin, reg.id, { reason: 'x' })) as { message?: string }).message, APPROVAL_MESSAGES.notReady)
  })

  it('two organisations can queue for the same number, but only the first approval wins; nothing half-done remains', async () => {
    const a = addOrder()
    const b = addOrder()
    await submit(a, { organizationNumber: '910001388', loginEmail: 'a@konflikt.invalid' })
    await submit(b, { organizationNumber: '910001388', loginEmail: 'b@konflikt.invalid' })
    await confirmFor('a@konflikt.invalid')
    await confirmFor('b@konflikt.invalid')
    const { registrationReview } = await import('@/lib/miljo/registration/approval')
    const review = await registrationReview({ payload: h.payload } as never, admin, registrationOf('b@konflikt.invalid').id)
    assert.ok(review?.warnings.some((w) => /samme organisasjonsnummer/.test(w)), JSON.stringify(review?.warnings))

    assert.deepEqual(await approve(registrationOf('a@konflikt.invalid').id), { ok: true, emailSent: true })
    const beforeSecond = counts()
    const second = await approve(registrationOf('b@konflikt.invalid').id)
    assert.equal((second as { message?: string }).message, APPROVAL_MESSAGES.alreadyRegistered)
    assert.deepEqual(counts(), beforeSecond)
    assert.equal(rows('miljo-accounts').filter((x) => x.email === 'b@konflikt.invalid').length, 0)
  })

  it('an order cancelled while waiting cannot be approved', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '910009605', loginEmail: 'kansellert@x.invalid' })
    await confirmFor('kansellert@x.invalid')
    rows('orders').find((x) => x.id === o.id)!.status = 'cancelled'
    const before = counts()
    const r = await approve(registrationOf('kansellert@x.invalid').id)
    assert.equal((r as { message?: string }).message, APPROVAL_MESSAGES.orderNotEligible)
    assert.deepEqual(counts(), before)
  })

  it('two simultaneous approvals activate exactly once', async () => {
    const p = addOrder()
    await submit(p, { organizationNumber: '910002759', loginEmail: 'samtidig@x.invalid' })
    await confirmFor('samtidig@x.invalid')
    const id = registrationOf('samtidig@x.invalid').id
    const before = counts()
    const results = await Promise.all([approve(id), approve(id), approve(id)])
    assert.equal(results.filter((x) => x.ok).length, 1, JSON.stringify(results))
    assert.equal(rows('miljo-registrations').find((x) => x.id === id)!.status, 'confirmed')
    assert.deepEqual(counts(), { bc: before.bc + 1, acc: before.acc + 1, org: before.org + 1 })
    assert.equal(rows('miljo-accounts').filter((x) => x.email === 'samtidig@x.invalid').length, 1)
    assert.equal(rows('miljo-registration-audit').filter((x) => x.registration === id && x.action === 'approved').length, 1)
  })

  it('a simultaneous approval and rejection cannot both win; the outcome matches what exists', async () => {
    const p = addOrder()
    await submit(p, { organizationNumber: '910011006', loginEmail: 'kapplop@x.invalid' })
    await confirmFor('kapplop@x.invalid')
    const id = registrationOf('kapplop@x.invalid').id
    const before = counts()
    const results = await Promise.all([approve(id), rejectRegistration(approvalDeps(), admin, id, { reason: 'Samtidig' })])
    assert.equal(results.filter((x) => x.ok).length, 1, JSON.stringify(results))
    const status = rows('miljo-registrations').find((x) => x.id === id)!.status
    assert.deepEqual(counts(), status === 'confirmed' ? { bc: before.bc + 1, acc: before.acc + 1, org: before.org + 1 } : before)
  })
})

describe('only an administrator decides', () => {
  let id = 0
  let adminToken = ''
  let editorToken = ''
  const paths = () => [`/miljo-registrations/${id}/approve`, `/miljo-registrations/${id}/reject`, `/miljo-registrations/${id}/notes`]
  const body = { verificationMethod: 'phone', reason: 'x', notes: 'x' }

  before(async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '910004123', loginEmail: 'tilgang@x.invalid' })
    await confirmFor('tilgang@x.invalid')
    id = registrationOf('tilgang@x.invalid').id
    await h.payload.create({ collection: 'users', data: { email: 'rest-admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
    await h.payload.create({ collection: 'users', data: { email: 'rest-editor@aboks.invalid', password: PASSWORD, role: 'editor' } as never })
    adminToken = await h.login('users', 'rest-admin@aboks.invalid', PASSWORD)
    editorToken = await h.login('users', 'rest-editor@aboks.invalid', PASSWORD)
  })

  it('anonymous visitors and editors are refused by every endpoint, and nothing changes', async () => {
    const before = counts()
    for (const path of paths()) {
      assert.equal((await h.rest('POST', path, { body })).status, 401, path)
      assert.equal((await h.rest('POST', path, { token: editorToken, body })).status, 403, path)
    }
    assert.equal((await h.rest('GET', `/miljo-registrations/${id}/review`)).status, 401)
    assert.equal((await h.rest('GET', `/miljo-registrations/${id}/review`, { token: editorToken })).status, 403)
    assert.deepEqual(counts(), before)
    assert.equal(registrationOf('tilgang@x.invalid').status, 'awaiting_approval')
  })

  it('a signed-in Miljø account of ANOTHER organisation is refused too', async () => {
    const res = await miljoLogin('innkjop@kystbygg.invalid', PASSWORD)
    assert.equal(res.status, 200)
    for (const path of paths()) assert.ok([401, 403].includes((await h.rest('POST', path, { token: res.token, body })).status), path)
    assert.equal(registrationOf('tilgang@x.invalid').status, 'awaiting_approval')
  })

  it('an administrator reviews, notes and approves through the real endpoints', async () => {
    const review = await h.rest('GET', `/miljo-registrations/${id}/review`, { token: adminToken })
    assert.equal(review.status, 200, JSON.stringify(review.json))
    assert.equal(review.json.canDecide, true)
    assert.equal((review.json.order as { orderEmail: string }).orderEmail, 'kjoper@firma.no')
    assert.doesNotMatch(JSON.stringify(review.json), /passwordHash|tokenHash/)

    const noted = await h.rest('POST', `/miljo-registrations/${id}/notes`, { token: adminToken, body: { notes: 'Ringt, venter svar' } })
    assert.equal(noted.status, 200, JSON.stringify(noted.json))
    assert.equal(registrationOf('tilgang@x.invalid').internalNotes, 'Ringt, venter svar')

    const missing = await h.rest('POST', `/miljo-registrations/${id}/approve`, { token: adminToken, body: {} })
    assert.equal(missing.status, 400)

    const ok = await h.rest('POST', `/miljo-registrations/${id}/approve`, { token: adminToken, body: { verificationMethod: 'document' } })
    assert.equal(ok.status, 200, JSON.stringify(ok.json))
    assert.equal(registrationOf('tilgang@x.invalid').decidedByLabel, 'rest-admin@aboks.invalid')
    assert.equal((await miljoLogin('tilgang@x.invalid', PASSWORD)).status, 200)
    const again = await h.rest('POST', `/miljo-registrations/${id}/approve`, { token: adminToken, body: { verificationMethod: 'document' } })
    assert.equal(again.status, 409)
    assert.deepEqual(rows('miljo-registration-audit').filter((a) => a.registration === id).map((a) => a.action), ['submitted', 'email-verified', 'note-updated', 'approved', 'activated'])
  })

  it('a registration activated before approval existed keeps working and is not asked to wait', async () => {
    const legacy = rows('miljo-registrations').find((r) => r.status === 'confirmed')!
    const { decidedAt, decidedBy, decidedByLabel } = legacy
    Object.assign(legacy, { decidedAt: null, decidedBy: null, decidedByLabel: null })
    const res = await h.rest('GET', `/miljo-registrations/${legacy.id}/review`, { token: adminToken })
    assert.equal(res.json.legacyActivation, true)
    assert.equal(res.json.canDecide, false)
    assert.equal((await miljoLogin(String(legacy.loginEmail), PASSWORD)).status, 200)
    Object.assign(legacy, { decidedAt, decidedBy, decidedByLabel })
  })
})

describe('an applicant without approval reaches nothing', () => {
  it('cannot sign in, request a password reset, or touch any organisation resource', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '910005499', loginEmail: 'venter@x.invalid' })
    const accountDeps: AccountDeps = { payload: h.payload, rateLimits: rate, sendEmail: async (m) => void mails.push({ to: m.to, text: m.text }), siteUrl: 'https://preview.aboks.invalid', now: () => new Date(clockMs) }

    const check = async () => {
      const signedIn = await signIn(accountDeps, { email: 'venter@x.invalid', password: PASSWORD, ip })
      assert.equal(signedIn.ok, false)
      assert.equal((signedIn as { status: number }).status, 401)
      assert.equal((await miljoLogin('venter@x.invalid', PASSWORD)).status, 401)
      assert.equal(await currentSession(h.payload, 'not.a.session.token.at.all'), null)
      assert.equal(rows('miljo-accounts').filter((a) => a.email === 'venter@x.invalid').length, 0, 'there is no account to act with')
      assert.equal(rows('business-customers').filter((c) => c.organizationNumber === '910005499').length, 0)
      mails.length = 0
      const { requestPasswordReset } = await import('@/lib/miljo/account/service')
      await requestPasswordReset(accountDeps, { email: 'venter@x.invalid', ip })
      assert.equal(mails.length, 0, 'no reset link for an applicant')
    }
    await check()
    // The same again once the e-mail is confirmed.
    const second = await submit(addOrder(), { organizationNumber: '910005499', loginEmail: 'venter2@x.invalid' })
    assert.equal(second.ok, true, JSON.stringify(second))
    await confirmFor('venter2@x.invalid')
    assert.equal(registrationOf('venter2@x.invalid').status, 'awaiting_approval')
    assert.equal((await miljoLogin('venter2@x.invalid', PASSWORD)).status, 401, 'confirmed e-mail, still no access')
    assert.equal(rows('miljo-accounts').filter((a) => a.email === 'venter2@x.invalid').length, 0)
  })
})

describe('anti-abuse limits', () => {
  it('the organisation lookup is limited per order across addresses, and per address across orders', async () => {
    const o = addOrder()
    let last
    for (let i = 0; i < 21; i++) last = await lookupOrganizationForRegistration(deps(), { orderNumber: o.orderNumber, email: 'gjett@firma.no', organizationNumber: '923609016', ip: `198.51.100.${i}` })
    assert.equal((last as { status: number }).status, 429, 'per order')
    rate.reset()
    for (let i = 0; i < 41; i++) last = await lookupOrganizationForRegistration(deps(), { orderNumber: `AB-${String(200000 + i)}`, email: 'gjett@firma.no', organizationNumber: '923609016', ip })
    assert.equal((last as { status: number }).status, 429, 'per address')
  })

  it('the lookup answers an unknown order and a wrong e-mail identically, like the purchase step', async () => {
    const o = addOrder()
    const unknown = await lookupOrganizationForRegistration(deps(), { orderNumber: 'AB-999999', email: 'kjoper@firma.no', organizationNumber: '923609016', ip })
    const wrongMail = await lookupOrganizationForRegistration(deps(), { orderNumber: o.orderNumber, email: 'annen@firma.no', organizationNumber: '923609016', ip })
    assert.deepEqual(unknown, wrongMail)
  })

  it('submitting is limited per order and per address', async () => {
    const o = addOrder()
    let last
    for (let i = 0; i < 6; i++) last = await submit(o, { contactName: ' ', ip: `198.51.100.${i}` })
    assert.equal((last as { status: number }).status, 429)
  })
})

describe('internal notes', () => {
  it('are kept with their history and never reach the applicant', async () => {
    const o = addOrder()
    await submit(o, { organizationNumber: '910008234', loginEmail: 'notat@x.invalid' })
    const reg = registrationOf('notat@x.invalid')
    assert.deepEqual(await saveInternalNotes(approvalDeps(), admin, reg.id, { notes: 'Hemmelig merknad' }), { ok: true })
    assert.deepEqual(await saveInternalNotes(approvalDeps(), admin, reg.id, { notes: 'Hemmelig merknad' }), { ok: true })
    assert.equal(rows('miljo-registration-audit').filter((a) => a.registration === reg.id && a.action === 'note-updated').length, 1, 'no change, no row')
    const token = tokenFrom(mails.filter((m) => m.to === 'notat@x.invalid').at(-1)!.text)
    assert.doesNotMatch(JSON.stringify(await confirmRegistration(deps(), { token, ip })), /Hemmelig/)
  })
})

describe('links: expiry, resend, concurrency', () => {
  it('an expired link is refused and activates nothing', async () => {
    const o = addOrder()
    mails.length = 0
    await submit(o, { organizationNumber: '914778271', loginEmail: 'utlopt@nordlys.invalid' })
    const token = tokenFrom(mails[0]!.text)
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
    const first = tokenFrom(mails[0]!.text)
    mails.length = 0
    assert.equal(((await resendConfirmation(deps(), { resendKey: key, ip })) as { status?: number }).status, 429, 'too soon')
    clockMs += 61_000
    assert.equal((await resendConfirmation(deps(), { resendKey: key, ip })).ok, true)
    assert.deepEqual(mails.map((m) => m.to), ['resend@nordlys.invalid'], 'the order address is told once, not per link')
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

  it('two simultaneous confirmations of the same link confirm once and activate nothing', async () => {
    const o = addOrder()
    mails.length = 0
    await submit(o, { organizationNumber: '914778271', loginEmail: 'samtidig@nordlys.invalid' })
    const token = tokenFrom(mails[0]!.text)
    const before = counts()
    const [a, b] = await Promise.all([confirmRegistration(deps(), { token, ip }), confirmRegistration(deps(), { token, ip })])
    assert.equal(a.ok && b.ok, true, JSON.stringify([a, b]))
    assert.deepEqual([a, b].map((x) => (x as unknown as { alreadyConfirmed: boolean }).alreadyConfirmed).sort(), [false, true])
    assert.deepEqual(counts(), before)
    assert.equal(rows('miljo-registration-audit').filter((x) => x.registration === registrationOf('samtidig@nordlys.invalid').id && x.action === 'email-verified').length, 1)
  })
})

describe('existing companies are never taken over', () => {
  it('a company created by aBoks is linked ONLY when aBoks linked this order to it', async () => {
    const admin_ = (await h.payload.create({ collection: 'business-customers', data: { name: 'Adminbedrift', organizationNumber: '889640782', contactEmail: 'admin@adminbedrift.invalid', status: 'pending' } as never })).id as number
    const unlinked = addOrder()
    const refused = await submit(unlinked, { organizationNumber: '889640782', loginEmail: 'x@adminbedrift.invalid' })
    assert.equal((refused as { code?: string }).code, 'contact_aboks')

    const linked = addOrder({ businessCustomer: admin_ })
    mails.length = 0
    const ok = await submit(linked, { organizationNumber: '889640782', loginEmail: 'kontakt@adminbedrift.invalid' })
    assert.equal(ok.ok, true, JSON.stringify(ok))
    const conf = await confirmFor('kontakt@adminbedrift.invalid')
    assert.equal(conf.ok, true, JSON.stringify(conf))
    assert.equal(rows('business-customers').find((c) => c.id === admin_)!.status, 'pending', 'still waiting until an administrator approves')
    const act = await approve(registrationOf('kontakt@adminbedrift.invalid').id)
    assert.equal(act.ok, true, JSON.stringify(act))
    assert.equal(rows('business-customers').filter((c) => c.organizationNumber === '889640782').length, 1, 'no duplicate')
    const customer = rows('business-customers').find((c) => c.id === admin_)!
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
    const r = await submit(o, { organizationNumber: '889640782', loginEmail: 'feil@annen.invalid' })
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
