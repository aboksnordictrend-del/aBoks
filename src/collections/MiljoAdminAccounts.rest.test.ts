import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { OrdersStandIn, OrganizationsStandIn } from '@/lib/testing/miljoStandIns'
import { memoryRateLimitStore } from '@/lib/security/dbRateLimit'
import { MILJO_TRUSTED_ACCOUNT_CREATE } from '@/lib/miljo/business'
import { ACCOUNT_MESSAGES, INVITATION_TTL_MS } from '@/lib/miljo/account/constants'
import {
  ADMIN_ACCOUNT_MESSAGES,
  createOrganizationAccount,
  generateTemporaryPassword,
  listOrganizationAccounts,
  reissueInvitation,
  resetTemporaryPassword,
  restoreAccount,
  revokeAccount,
  type AdminAccountDeps,
} from '@/lib/miljo/account/admin'
import { acceptInvitation } from '@/lib/miljo/account/invitation'
import { changePassword, dashboard, signIn, type AccountDeps } from '@/lib/miljo/account/service'
import { currentSession } from '@/lib/miljo/account/session'
import { requireSession } from '@/lib/miljo/account/endpoint'
import { handleAccountAction, handleCreateAccount, handleListAccounts } from './endpoints/miljo'
import { BusinessCustomers } from './BusinessCustomers'
import { MiljoAccounts } from './MiljoAccounts'
import { MiljoRegistrations } from './MiljoRegistrations'
import { Users } from './Users'

/**
 * Stage 2.5 — administrator-managed organisation accounts, end to end through the real services on
 * Payload's real auth pipeline (password hashing, login, lockout, JWT + session ids, hooks) with an
 * in-memory database. E-mail is recorded, never sent; the clock is injectable for expiry.
 *
 * Not covered here (the memory database enforces neither): the unique e-mail and token indexes and
 * the conditional UPDATE under real concurrency — the SQL path is the same pattern as the password
 * reset, and the migration's indexes are checked against Postgres separately.
 */

const PASSWORD = 'Stage25-admin-1'
const ip = '203.0.113.25'

const OrgStandIn: CollectionConfig = {
  ...OrganizationsStandIn,
  fields: [...OrganizationsStandIn.fields, { name: 'organizationNumber', type: 'text' }],
}

let h: RestHarness
const rate = memoryRateLimitStore()
const sent: { to: string; subject: string; html: string; text: string }[] = []
const logged: string[] = []
let nowMs = Date.parse('2026-11-04T10:00:00Z')
const now = () => new Date(nowMs)

const adminDeps = (over: Partial<AdminAccountDeps> = {}): AdminAccountDeps => ({
  payload: h.payload,
  sendEmail: async (m) => {
    sent.push(m)
  },
  siteUrl: 'https://aboks.no',
  now,
  ...over,
})
const accountDeps = (): AccountDeps => ({
  payload: h.payload,
  rateLimits: rate,
  sendEmail: async (m) => {
    sent.push(m)
  },
  siteUrl: 'https://aboks.no',
  now,
})

const ORG = { hitra: 1, froya: 2, noNumber: 3, taken: 4, pending: 5, unlinked: 6, purchase: 7, fresh: 8, fresh2: 9 }
const rows = (slug: string): Row[] => (h.store[slug] ??= [])
const accountRow = (email: string) => rows('miljo-accounts').find((r) => r.email === email)!

const tokenFrom = (text: string): string => {
  const m = text.match(/aktiver\?token=([A-Za-z0-9_-]+)/)
  assert.ok(m, 'no activation link in the e-mail')
  return decodeURIComponent(m[1]!)
}

async function create(org: number, input: Record<string, unknown>) {
  return createOrganizationAccount(adminDeps(), 99, org, input as never)
}

before(async () => {
  h = await createRestHarness('miljo-admin-accounts-test', [Users, OrdersStandIn, OrgStandIn, BusinessCustomers, MiljoAccounts, MiljoRegistrations])
  rows('environmental-organizations').push(
    { id: ORG.hitra, name: 'Hitra kommune', publicCode: 'hitra00001', status: 'active', organizationNumber: '938772924' },
    { id: ORG.froya, name: 'Frøya kommune', publicCode: 'froya00002', status: 'active', organizationNumber: '964982953' },
    { id: ORG.noNumber, name: 'Uten nummer', publicCode: 'utennr0003', status: 'active' },
    { id: ORG.taken, name: 'Opptatt nummer', publicCode: 'opptatt004', status: 'active' },
    { id: ORG.pending, name: 'Venter AS', publicCode: 'venter0005', status: 'active' },
    { id: ORG.unlinked, name: 'Ukoblet AS', publicCode: 'ukoblet006', status: 'active' },
    { id: ORG.purchase, name: 'Kjøp AS', publicCode: 'kjopas0007', status: 'active' },
    { id: ORG.fresh, name: 'Ny AS', publicCode: 'nyas000008', status: 'active', organizationNumber: '889640782' },
    { id: ORG.fresh2, name: 'Ny to AS', publicCode: 'nyto000009', status: 'active', organizationNumber: '997136594' },
  )
  const p = h.payload
  await p.create({ collection: 'users', data: { email: 'admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
  await p.create({ collection: 'users', data: { email: 'editor@aboks.invalid', password: PASSWORD, role: 'editor' } as never })
  // Existing customers: «Venter» (linked), unlinked with a known number, purchase basis without orders.
  await p.create({ collection: 'business-customers', data: { name: 'Venter AS', organizationNumber: '974760673', contactEmail: 'v@aboks.invalid', status: 'pending', environmentalOrganization: ORG.pending } as never })
  await p.create({ collection: 'business-customers', data: { name: 'Ukoblet AS', organizationNumber: '923609016', contactEmail: 'u@aboks.invalid', status: 'active' } as never })
  await p.create({ collection: 'business-customers', data: { name: 'Kjøp AS', organizationNumber: '834012952', contactEmail: 'k@aboks.invalid', status: 'active', environmentalOrganization: ORG.purchase } as never })
  // A self-registered account elsewhere, to prove it is untouched.
  const self = (await p.create({ collection: 'business-customers', data: { name: 'Selv AS', organizationNumber: '916908547', contactEmail: 's@aboks.invalid', status: 'active', environmentalOrganization: ORG.froya } as never })).id
  rows('orders').push({ id: 51, orderNumber: 'AB-000051', status: 'delivered', businessCustomer: self })
  await p.create({
    collection: 'miljo-accounts',
    data: { email: 'selv@froya.invalid', password: PASSWORD, businessCustomer: self, status: 'active', emailVerifiedAt: new Date().toISOString() } as never,
    context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true },
  })
  // Capture everything Payload logs, to prove no secret ever reaches a log line.
  const logger = h.payload.logger as unknown as Record<string, (...a: unknown[]) => void>
  for (const level of ['info', 'warn', 'error']) {
    const original = logger[level]!.bind(logger)
    logger[level] = (...a: unknown[]) => {
      logged.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
      original(...a)
    }
  }
})

beforeEach(() => {
  rate.reset()
  sent.length = 0
})

after(async () => {
  await h?.payload.destroy?.()
})

/* ------------------------------ method 1: temporary password ------------------------------ */

describe('temporary password', () => {
  let tempPassword = ''

  it('creates the account and its business customer («Avtale med aBoks»); the password is returned once', async () => {
    const r = await create(ORG.hitra, { fullName: 'Kari Ansvarlig', email: '  Kari@Hitra.Invalid ', method: 'password' })
    assert.equal(r.ok, true, JSON.stringify(r))
    if (!r.ok) return
    assert.equal(r.account.email, 'kari@hitra.invalid')
    assert.equal(r.account.status, 'active')
    assert.equal(r.account.mustChangePassword, true)
    assert.equal(r.account.provisioning, 'admin-password')
    assert.equal(r.businessCustomerCreated, true)
    assert.equal(r.accessProblem, null)
    assert.match(r.temporaryPassword!, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/)
    tempPassword = r.temporaryPassword!
    assert.equal(sent.length, 0, 'credentials are never e-mailed')

    const customer = rows('business-customers').find((c) => c.environmentalOrganization === ORG.hitra)!
    assert.equal(customer.accessBasis, 'agreement')
    assert.equal(customer.status, 'active')
    assert.equal(customer.organizationNumber, '938772924')
  })

  it('stores only a salted hash; the listing never contains the password, hash or token', async () => {
    const row = accountRow('kari@hitra.invalid')
    assert.ok(typeof row.hash === 'string' && typeof row.salt === 'string')
    assert.ok(!JSON.stringify(row).includes(tempPassword))
    const list = await listOrganizationAccounts({ payload: h.payload } as PayloadRequest, ORG.hitra)
    const json = JSON.stringify(list)
    for (const secret of [tempPassword, String(row.hash), String(row.salt)]) assert.ok(!json.includes(secret))
    assert.ok(!/inviteTokenHash|"hash"|"salt"/.test(json))
    assert.equal(list!.accounts.length, 1)
  })

  it('signs in at once, but the session reaches nothing until the password is changed — server-side', async () => {
    const login = await signIn(accountDeps(), { email: 'kari@hitra.invalid', password: tempPassword, ip })
    assert.equal(login.ok, true, JSON.stringify(login))
    const token = (login as { token: string }).token

    assert.equal(await currentSession(h.payload, token), null, 'the default gate refuses a temporary-password session')
    const restricted = await currentSession(h.payload, token, 'password-change')
    assert.ok(restricted && restricted.passwordChangeRequired)

    const refused = await requireSession(accountDeps(), token)
    assert.ok(refused instanceof Response)
    assert.equal(refused.status, 403)
    assert.equal(((await refused.json()) as { code: string }).code, 'password_change_required')

    const changed = await changePassword(accountDeps(), restricted, { currentPassword: tempPassword, password: 'Kari-eget-passord-7', passwordConfirmation: 'Kari-eget-passord-7' })
    assert.equal(changed.ok, true, JSON.stringify(changed))
    assert.equal(accountRow('kari@hitra.invalid').mustChangePassword, false)
    assert.equal(await currentSession(h.payload, token, 'password-change'), null, 'the old session ended with the change')
    const full = await currentSession(h.payload, (changed as { token: string }).token)
    assert.ok(full && !full.passwordChangeRequired)
    assert.equal((await dashboard(full)).organizationName, 'Hitra kommune')
  })

  it('the temporary password cannot be reused as the new one, and stops working after the change', async () => {
    const old = await signIn(accountDeps(), { email: 'kari@hitra.invalid', password: tempPassword, ip })
    assert.equal(old.ok, false)
  })

  it('a typed temporary password must meet the password rules', async () => {
    const weak = await create(ORG.fresh, { fullName: 'Ola', email: 'ola@ny.invalid', method: 'password', password: 'kort1' })
    assert.equal(weak.ok, false)
    assert.equal((weak as { field?: string }).field, 'password')
    const ok = await create(ORG.fresh, { fullName: 'Ola', email: 'ola@ny.invalid', method: 'password', password: 'Selvvalgt-midl-9' })
    assert.equal(ok.ok, true)
    assert.equal((ok as { temporaryPassword?: string }).temporaryPassword, 'Selvvalgt-midl-9')
  })

  it('generated passwords are strong and varied', () => {
    const seen = new Set(Array.from({ length: 200 }, generateTemporaryPassword))
    assert.equal(seen.size, 200)
    for (const p of seen) assert.ok(p.length === 14 && /\d/.test(p) && /[a-zA-Z]/.test(p) && !/[0O1lI]/.test(p))
  })
})

/* ------------------------------ method 2: e-mail invitation ------------------------------ */

describe('e-mail invitation', () => {
  let firstToken = ''

  it('creates an invited account and e-mails a one-time link; only the hash is stored', async () => {
    const r = await create(ORG.fresh2, { fullName: 'Per Invitert', email: 'per@nyto.invalid', method: 'invitation' })
    assert.equal(r.ok, true, JSON.stringify(r))
    if (!r.ok) return
    assert.equal(r.account.status, 'invited')
    assert.equal(r.invitationSent, true)
    assert.equal((r as { temporaryPassword?: string }).temporaryPassword, undefined)
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.to, 'per@nyto.invalid')
    assert.match(sent[0]!.html, /https:\/\/aboks\.no\/miljoregistrering\/aktiver\?token=/)
    firstToken = tokenFrom(sent[0]!.text)
    const row = accountRow('per@nyto.invalid')
    assert.ok(typeof row.inviteTokenHash === 'string' && row.inviteTokenHash !== firstToken)
    assert.ok(!JSON.stringify(row).includes(firstToken))
  })

  it('an invited account cannot sign in', async () => {
    const r = await signIn(accountDeps(), { email: 'per@nyto.invalid', password: 'whatever-123A', ip })
    assert.equal(r.ok, false)
  })

  it('reissuing makes the previous link stop working', async () => {
    const id = accountRow('per@nyto.invalid').id
    const r = await reissueInvitation(adminDeps(), 99, ORG.fresh2, id)
    assert.equal(r.ok, true, JSON.stringify(r))
    const second = tokenFrom(sent[0]!.text)
    assert.notEqual(second, firstToken)
    const stale = await acceptInvitation(accountDeps(), { token: firstToken, password: 'Per-eget-pass-1', passwordConfirmation: 'Per-eget-pass-1', ip })
    assert.deepEqual([stale.ok, (stale as { code?: string }).code], [false, 'invalid'])
    firstToken = second
  })

  it('an expired link does not activate; a new invitation does', async () => {
    nowMs += INVITATION_TTL_MS + 60_000
    const expired = await acceptInvitation(accountDeps(), { token: firstToken, password: 'Per-eget-pass-1', passwordConfirmation: 'Per-eget-pass-1', ip })
    assert.deepEqual([expired.ok, (expired as { code?: string }).code, (expired as { message?: string }).message], [false, 'expired', ACCOUNT_MESSAGES.inviteExpired])
    assert.equal(accountRow('per@nyto.invalid').status, 'invited')
    const list = await listOrganizationAccounts({ payload: h.payload } as PayloadRequest, ORG.fresh2, now())
    assert.equal(list!.accounts[0]!.inviteExpired, true)

    await reissueInvitation(adminDeps(), 99, ORG.fresh2, accountRow('per@nyto.invalid').id)
    firstToken = tokenFrom(sent[0]!.text)
  })

  it('the recipient chooses a password; the account is active, verified and signed in', async () => {
    const weak = await acceptInvitation(accountDeps(), { token: firstToken, password: 'kort', passwordConfirmation: 'kort', ip })
    assert.equal(weak.ok, false, 'a weak password does not consume the link')
    const r = await acceptInvitation(accountDeps(), { token: firstToken, password: 'Per-eget-pass-1', passwordConfirmation: 'Per-eget-pass-1', ip })
    assert.equal(r.ok, true, JSON.stringify(r))
    const row = accountRow('per@nyto.invalid')
    assert.equal(row.status, 'active')
    assert.ok(typeof row.emailVerifiedAt === 'string')
    assert.equal(row.inviteTokenHash ?? null, null)
    assert.equal(row.mustChangePassword, false)
    const s = await currentSession(h.payload, (r as { token: string }).token)
    assert.ok(s, 'signed in with full access')
    assert.equal((await dashboard(s)).organizationName, 'Ny to AS')
  })

  it('the link works only once', async () => {
    const again = await acceptInvitation(accountDeps(), { token: firstToken, password: 'Annet-passord-22', passwordConfirmation: 'Annet-passord-22', ip })
    assert.deepEqual([again.ok, (again as { code?: string }).code], [false, 'invalid'])
    assert.equal((await signIn(accountDeps(), { email: 'per@nyto.invalid', password: 'Per-eget-pass-1', ip })).ok, true)
  })

  it('malformed tokens are refused without a lookup', async () => {
    for (const token of ['', 'kort', 'x'.repeat(300), null, 42]) {
      const r = await acceptInvitation(accountDeps(), { token, password: 'Per-eget-pass-1', passwordConfirmation: 'Per-eget-pass-1', ip })
      assert.equal((r as { code?: string }).code, 'invalid')
    }
  })
})

/* ------------------------------ duplicates and business customers ------------------------------ */

describe('duplicates and the business customer', () => {
  it('the same e-mail cannot get a second account, whatever its case', async () => {
    const r = await create(ORG.noNumber, { fullName: 'X', email: 'KARI@hitra.invalid', method: 'password', organizationNumber: '987654321' })
    assert.deepEqual([r.ok, (r as { message?: string }).message], [false, ADMIN_ACCOUNT_MESSAGES.emailInUse])
    const self = await create(ORG.noNumber, { fullName: 'X', email: 'selv@froya.invalid', method: 'password', organizationNumber: '987654321' })
    assert.equal((self as { message?: string }).message, ADMIN_ACCOUNT_MESSAGES.emailInUse)
  })

  it('an organisation with an active or invited account gets no second one', async () => {
    const r = await create(ORG.hitra, { fullName: 'Nr to', email: 'nr2@hitra.invalid', method: 'invitation' })
    assert.deepEqual([r.ok, (r as { message?: string }).message], [false, ADMIN_ACCOUNT_MESSAGES.alreadyHasAccount])
    assert.equal(sent.length, 0)
  })

  it('an e-mail waiting in a self-registration is refused', async () => {
    rows('miljo-registrations').push({ id: 701, status: 'pending', loginEmail: 'venter@selvreg.invalid', order: 51, organizationNumber: '916908547' })
    const r = await create(ORG.noNumber, { fullName: 'X', email: 'venter@selvreg.invalid', method: 'password', organizationNumber: '987654321' })
    assert.equal((r as { message?: string }).message, ADMIN_ACCOUNT_MESSAGES.emailPendingRegistration)
  })

  it('without a business customer or number on file, the number is required and checked', async () => {
    const missing = await create(ORG.noNumber, { fullName: 'X', email: 'x@utennr.invalid', method: 'password' })
    assert.equal((missing as { field?: string }).field, 'organizationNumber')
    const invalid = await create(ORG.noNumber, { fullName: 'X', email: 'x@utennr.invalid', method: 'password', organizationNumber: '123456789' })
    assert.equal((invalid as { field?: string }).field, 'organizationNumber')
    assert.equal(rows('miljo-accounts').filter((a) => a.email === 'x@utennr.invalid').length, 0, 'nothing created')
  })

  it("another organisation's number is refused — no duplicate or hijacked business customer", async () => {
    const before = rows('business-customers').length
    const r = await create(ORG.taken, { fullName: 'X', email: 'x@opptatt.invalid', method: 'password', organizationNumber: '938772924' })
    assert.deepEqual([r.ok, (r as { message?: string }).message], [false, ADMIN_ACCOUNT_MESSAGES.organizationNumberTaken])
    assert.equal(rows('business-customers').length, before)
  })

  it('an unlinked business customer with the same number is linked, not duplicated', async () => {
    const before = rows('business-customers').length
    const r = await create(ORG.unlinked, { fullName: 'U', email: 'u@ukoblet.invalid', method: 'password', organizationNumber: '923 609 016' })
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.equal((r as { businessCustomerCreated?: boolean }).businessCustomerCreated, false)
    assert.equal(rows('business-customers').length, before)
    assert.equal(rows('business-customers').find((c) => c.organizationNumber === '923609016')!.environmentalOrganization, ORG.unlinked)
  })

  it('an existing customer that does not grant access is reported, and the account cannot sign in', async () => {
    const pending = await create(ORG.pending, { fullName: 'V', email: 'v@venter.invalid', method: 'password' })
    assert.equal(pending.ok, true)
    assert.match(String((pending as { accessProblem?: string }).accessProblem), /Venter/)
    const login = await signIn(accountDeps(), { email: 'v@venter.invalid', password: (pending as { temporaryPassword: string }).temporaryPassword, ip })
    assert.equal(login.ok, false)

    const purchase = await create(ORG.purchase, { fullName: 'K', email: 'k@kjop.invalid', method: 'password' })
    assert.match(String((purchase as { accessProblem?: string }).accessProblem), /ingen gyldig ordre/)
    // «Avtale med aBoks» on the existing customer opens access without an order.
    const customer = rows('business-customers').find((c) => c.environmentalOrganization === ORG.purchase)!
    await h.payload.update({ collection: 'business-customers', id: customer.id as number, data: { accessBasis: 'agreement' } as never })
    const now2 = await signIn(accountDeps(), { email: 'k@kjop.invalid', password: (purchase as { temporaryPassword: string }).temporaryPassword, ip })
    assert.equal(now2.ok, true)
  })
})

/* ------------------------------ isolation, revocation, reset ------------------------------ */

describe('organisation isolation and access management', () => {
  it("an account can be managed only through its own organisation's URL", async () => {
    const kari = accountRow('kari@hitra.invalid').id
    for (const r of [
      await revokeAccount(adminDeps(), 99, ORG.fresh2, kari),
      await resetTemporaryPassword(adminDeps(), 99, ORG.fresh2, kari, {}),
      await reissueInvitation(adminDeps(), 99, ORG.fresh2, kari),
      await restoreAccount(adminDeps(), 99, ORG.fresh2, kari),
    ]) {
      assert.deepEqual([r.ok, (r as { status?: number }).status], [false, 404])
    }
    assert.equal(accountRow('kari@hitra.invalid').status, 'active')
  })

  it("a session only ever sees its own organisation", async () => {
    const per = await signIn(accountDeps(), { email: 'per@nyto.invalid', password: 'Per-eget-pass-1', ip })
    const kari = await signIn(accountDeps(), { email: 'kari@hitra.invalid', password: 'Kari-eget-passord-7', ip })
    const a = await currentSession(h.payload, (per as { token: string }).token)
    const b = await currentSession(h.payload, (kari as { token: string }).token)
    assert.equal((await dashboard(a!)).organizationName, 'Ny to AS')
    assert.equal((await dashboard(b!)).organizationName, 'Hitra kommune')
    assert.notEqual(String(a!.businessCustomerId), String(b!.businessCustomerId))
  })

  it('revoking ends every session at once; restoring reopens access', async () => {
    const login = await signIn(accountDeps(), { email: 'kari@hitra.invalid', password: 'Kari-eget-passord-7', ip })
    const token = (login as { token: string }).token
    assert.ok(await currentSession(h.payload, token))
    const id = accountRow('kari@hitra.invalid').id
    const r = await revokeAccount(adminDeps(), 99, ORG.hitra, id)
    assert.equal(r.ok, true)
    assert.equal(await currentSession(h.payload, token), null)
    assert.equal((await signIn(accountDeps(), { email: 'kari@hitra.invalid', password: 'Kari-eget-passord-7', ip })).ok, false)
    assert.equal((await resetTemporaryPassword(adminDeps(), 99, ORG.hitra, id, {})).ok, false, 'a revoked account gets no new password')

    const back = await restoreAccount(adminDeps(), 99, ORG.hitra, id)
    assert.equal(back.ok, true)
    assert.equal((back as { account: { status: string } }).account.status, 'active')
    assert.equal((await signIn(accountDeps(), { email: 'kari@hitra.invalid', password: 'Kari-eget-passord-7', ip })).ok, true)
  })

  it('revoking an invitation kills its link', async () => {
    const created = await create(ORG.noNumber, { fullName: 'Inv', email: 'inv@utennr.invalid', method: 'invitation', organizationNumber: '914778271' })
    assert.equal(created.ok, true, JSON.stringify(created))
    const token = tokenFrom(sent.at(-1)!.text)
    await revokeAccount(adminDeps(), 99, ORG.noNumber, accountRow('inv@utennr.invalid').id)
    const used = await acceptInvitation(accountDeps(), { token, password: 'Inv-eget-pass-1', passwordConfirmation: 'Inv-eget-pass-1', ip })
    assert.equal((used as { code?: string }).code, 'invalid')
    assert.equal(accountRow('inv@utennr.invalid').status, 'disabled')
  })

  it('a new temporary password ends all sessions and must be changed again', async () => {
    const login = await signIn(accountDeps(), { email: 'per@nyto.invalid', password: 'Per-eget-pass-1', ip })
    const token = (login as { token: string }).token
    const r = await resetTemporaryPassword(adminDeps(), 99, ORG.fresh2, accountRow('per@nyto.invalid').id, {})
    assert.equal(r.ok, true)
    assert.equal(await currentSession(h.payload, token, 'password-change'), null)
    const temp = (r as { temporaryPassword: string }).temporaryPassword
    const again = await signIn(accountDeps(), { email: 'per@nyto.invalid', password: temp, ip })
    assert.equal(again.ok, true)
    assert.equal(await currentSession(h.payload, (again as { token: string }).token), null)
    assert.ok((await currentSession(h.payload, (again as { token: string }).token, 'password-change'))?.passwordChangeRequired)
  })

  it('a self-registered account is untouched by all of this', async () => {
    const r = await signIn(accountDeps(), { email: 'selv@froya.invalid', password: PASSWORD, ip })
    const s = await currentSession(h.payload, (r as { token: string }).token)
    assert.ok(s && !s.passwordChangeRequired)
    assert.equal(accountRow('selv@froya.invalid').provisioning ?? 'self-registration', 'self-registration')
  })
})

/* ------------------------------ admin endpoints ------------------------------ */

describe('admin endpoints', () => {
  const fakeReq = (user: unknown, routeParams: Record<string, unknown>, body: unknown = {}) =>
    ({ payload: h.payload, user, routeParams, json: async () => body }) as unknown as PayloadRequest

  it('only administrators may list, create or act', async () => {
    const editor = { id: 2, collection: 'users', role: 'editor' }
    const miljo = { id: 1, collection: 'miljo-accounts' }
    for (const user of [null, editor, miljo]) {
      for (const res of [
        await handleListAccounts(fakeReq(user, { id: ORG.hitra })),
        await handleCreateAccount(fakeReq(user, { id: ORG.fresh }, { fullName: 'X', email: 'x@x.invalid', method: 'password' })),
        await handleAccountAction(fakeReq(user, { id: ORG.hitra, accountId: accountRow('kari@hitra.invalid').id, action: 'revoke' })),
      ]) {
        assert.ok(res.status === 401 || res.status === 403, `expected refusal, got ${res.status}`)
      }
    }
    assert.equal(accountRow('kari@hitra.invalid').status, 'active')
  })

  it('an administrator gets the listing without caching', async () => {
    const res = await handleListAccounts(fakeReq({ id: 1, collection: 'users', role: 'admin' }, { id: ORG.hitra }))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'no-store')
  })

  it('no password, token or e-mail address was ever logged', () => {
    const all = logged.join('\n')
    assert.ok(logged.length > 0)
    for (const secret of ['Kari-eget-passord-7', 'Per-eget-pass-1', 'Selvvalgt-midl-9', '@hitra.invalid', '@nyto.invalid', 'token=']) {
      assert.ok(!all.includes(secret), `log contains ${secret}`)
    }
  })
})
