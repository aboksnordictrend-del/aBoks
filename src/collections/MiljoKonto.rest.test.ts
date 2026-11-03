import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { jwtSign } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { OrdersStandIn, OrganizationsStandIn } from '@/lib/testing/miljoStandIns'
import { memoryRateLimitStore } from '@/lib/security/dbRateLimit'
import { MILJO_TRUSTED_ACCOUNT_CREATE } from '@/lib/miljo/business'
import { hashPin } from '@/lib/miljo/pin'
import { PIN_KEY_ENV, pinVaultKey, sealPin } from '@/lib/miljo/pinVault'
import { hashToken } from '@/lib/reviewToken'
import { ACCOUNT_MESSAGES, ACCOUNT_RATE_LIMITS, MILJO_SESSION_COOKIE } from '@/lib/miljo/account/constants'
import { parsePost } from '@/lib/miljo/account/endpoint'
import { QR_CAPTION, qrFor, qrPdf, qrPng } from '@/lib/miljo/account/qrFiles'
import {
  changePassword,
  dashboard,
  requestPasswordReset,
  resetPassword,
  revealPin,
  signIn,
  signOut,
  type AccountDeps,
} from '@/lib/miljo/account/service'
import { clearedSessionCookieHeader, currentSession, readSessionToken, sessionCookieHeader, type MiljoSession } from '@/lib/miljo/account/session'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import { BusinessCustomers } from './BusinessCustomers'
import { MiljoAccounts } from './MiljoAccounts'
import { Users } from './Users'

/**
 * Stage 2.2b — sign-in, Min side, password recovery, PIN and QR files, through the account service
 * (@/lib/miljo/account/service) on Payload's REAL auth pipeline (login, lockout, JWT + session ids,
 * hooks) with an in-memory database (@/lib/testing/payloadRestHarness). Rate limits use the
 * in-memory twin of the database store. No e-mail leaves the test: `sendEmail` records messages.
 */

const PASSWORD = 'Stage22b-test-1'
const NEW_PASSWORD = 'Nytt-passord-22b'
const ip = '203.0.113.9'

let h: RestHarness
const rate = memoryRateLimitStore()
const sent: { to: string; subject: string; html: string; text: string }[] = []
const deps = (over: Partial<AccountDeps> = {}): AccountDeps => ({
  payload: h.payload,
  rateLimits: rate,
  sendEmail: async (m) => {
    sent.push(m)
  },
  siteUrl: 'https://aboks-git-preview.vercel.app',
  ...over,
})

const id = { bcA: 0, bcB: 0, bcSuspend: 0, accA: 0, accB: 0, accOff: 0, accSuspend: 0, orgA: 1, orgB: 2, orgNoPin: 3 }
const PIN = { a: '482915', b: '730264' }
const rows = (slug: string): Row[] => (h.store[slug] ??= [])
const row = (slug: string, docId: number) => rows(slug).find((r) => r.id === docId)!

async function session(token: string): Promise<MiljoSession> {
  const s = await currentSession(h.payload, token)
  assert.ok(s, 'expected a valid session')
  return s
}

async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await signIn(deps(), { email, password, ip })
  assert.equal(res.ok, true, JSON.stringify(res))
  return (res as { token: string }).token
}

before(async () => {
  process.env[PIN_KEY_ENV] = randomBytes(32).toString('base64')
  h = await createRestHarness('miljo-konto-test', [Users, OrdersStandIn, OrganizationsStandIn, BusinessCustomers, MiljoAccounts])
  const key = pinVaultKey()!
  rows('environmental-organizations').push(
    { id: id.orgA, name: 'Fjordvik AS', publicCode: 'fjordvik01', status: 'active', pinHash: await hashPin(PIN.a), pinEncrypted: sealPin(PIN.a, id.orgA, key) },
    { id: id.orgB, name: 'Kystbygg AS', publicCode: 'kystbygg02', status: 'active', pinHash: await hashPin(PIN.b), pinEncrypted: sealPin(PIN.b, id.orgB, key) },
    { id: id.orgNoPin, name: 'Uten PIN AS', publicCode: 'utenpin003', status: 'active' },
  )
  const p = h.payload
  await p.create({ collection: 'users', data: { email: 'admin@aboks.invalid', password: PASSWORD, role: 'admin' } as never })
  const bc = async (name: string, organizationNumber: string, org: number) =>
    (await p.create({ collection: 'business-customers', data: { name, organizationNumber, contactName: `Kontakt ${name}`, contactEmail: `${organizationNumber}@aboks.invalid`, status: 'active', environmentalOrganization: org } as never })).id as number
  id.bcA = await bc('Fjordvik AS', '834012952', id.orgA)
  id.bcB = await bc('Kystbygg AS', '923609016', id.orgB)
  id.bcSuspend = await bc('Uten PIN AS', '974760673', id.orgNoPin)
  rows('orders').push(
    { id: 31, orderNumber: 'AB-000031', status: 'confirmed', businessCustomer: id.bcA },
    { id: 32, orderNumber: 'AB-000032', status: 'delivered', businessCustomer: id.bcB },
    { id: 33, orderNumber: 'AB-000033', status: 'shipped', businessCustomer: id.bcSuspend },
  )
  const verified = new Date().toISOString()
  const acc = async (email: string, businessCustomer: number, status = 'active') =>
    (await p.create({ collection: 'miljo-accounts', data: { email, password: PASSWORD, businessCustomer, status, emailVerifiedAt: verified } as never, context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true } })).id as number
  id.accA = await acc('konto@fjordvik.invalid', id.bcA)
  id.accB = await acc('konto@kystbygg.invalid', id.bcB)
  id.accSuspend = await acc('konto@utenpin.invalid', id.bcSuspend)
  // A deactivated account of company A's sibling: uses its own business customer.
  const bcOff = await bc('Av AS', '889640782', id.orgNoPin)
  rows('orders').push({ id: 34, orderNumber: 'AB-000034', status: 'confirmed', businessCustomer: bcOff })
  id.accOff = await acc('konto@av.invalid', bcOff, 'disabled')
})

beforeEach(() => {
  rate.reset()
  sent.length = 0
})

after(async () => {
  delete process.env[PIN_KEY_ENV]
  await h?.payload.destroy?.()
})

/* ------------------------------ sign-in ------------------------------ */

describe('sign-in', () => {
  it('an active account signs in; the session belongs to its own business customer', async () => {
    const s = await session(await login('konto@fjordvik.invalid'))
    assert.equal(String(s.businessCustomerId), String(id.bcA))
    assert.equal(s.account.id, id.accA)
  })

  it('e-mail is case- and space-insensitive', async () => {
    await session(await login('  KONTO@Fjordvik.invalid '))
  })

  it('wrong password, unknown e-mail and a deactivated account get the SAME answer and no token', async () => {
    const wrong = await signIn(deps(), { email: 'konto@fjordvik.invalid', password: 'Feil-passord-9', ip })
    const unknown = await signIn(deps(), { email: 'finnes-ikke@aboks.invalid', password: PASSWORD, ip })
    const disabled = await signIn(deps(), { email: 'konto@av.invalid', password: PASSWORD, ip })
    for (const r of [wrong, unknown, disabled]) {
      assert.equal(r.ok, false)
      assert.equal((r as { status: number }).status, 401)
      assert.equal((r as { message: string }).message, ACCOUNT_MESSAGES.loginFailed)
      assert.equal((r as { token?: string }).token, undefined)
    }
  })

  it('brute force: five wrong passwords lock the account (Payload lockout) — even the right one is refused', async () => {
    const email = 'konto@kystbygg.invalid'
    for (let i = 0; i < 5; i++) await signIn(deps(), { email, password: `Feil-passord-${i}`, ip: `198.51.100.${i}` })
    const right = await signIn(deps(), { email, password: PASSWORD, ip: '198.51.100.99' })
    assert.equal(right.ok, false)
    assert.equal((right as { message: string }).message, ACCOUNT_MESSAGES.loginFailed, 'locked looks like a wrong password')
    assert.ok(row('miljo-accounts', id.accB).lockUntil, 'lockUntil set')
    // An administrator's unlock (here: the expired lock) restores sign-in.
    Object.assign(row('miljo-accounts', id.accB), { lockUntil: null, loginAttempts: 0 })
    await login(email)
  })

  it('the database rate limit refuses more attempts per e-mail than allowed, whatever the client address', async () => {
    const email = 'konto@fjordvik.invalid'
    const limit = ACCOUNT_RATE_LIMITS.loginPerEmail.limit
    for (let i = 0; i < limit; i++) rate.hit(`acct:login:email:${email}`, 60)
    const res = await signIn(deps(), { email, password: PASSWORD, ip: '192.0.2.200' })
    assert.equal((res as { status: number }).status, 429)
  })

  it('the cookie: aboks-miljo-session, HttpOnly, SameSite=Lax, Path=/, two hours; Secure in production', () => {
    const header = sessionCookieHeader('a.b.c-token-value-123456')
    assert.match(header, new RegExp(`^${MILJO_SESSION_COOKIE}=a\\.b\\.c-token-value-123456;`))
    for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=7200']) assert.ok(header.includes(part), part)
    const env = process.env as Record<string, string | undefined>
    const previous = env.NODE_ENV
    env.NODE_ENV = 'production'
    try {
      assert.ok(sessionCookieHeader('x'.repeat(30)).includes('; Secure'))
      assert.ok(clearedSessionCookieHeader().includes('Max-Age=0'))
    } finally {
      env.NODE_ENV = previous
    }
  })

  it('only the Miljø cookie is read — never payload-token', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.c2lnbmF0dXJl'
    assert.equal(readSessionToken(`payload-token=${token}`), null)
    assert.equal(readSessionToken(`payload-token=${token}; ${MILJO_SESSION_COOKIE}=${token}`), token)
    assert.equal(readSessionToken(`${MILJO_SESSION_COOKIE}=<script>`), null)
  })
})

/* ------------------------------ sessions ------------------------------ */

describe('sessions', () => {
  it('sign-out revokes THAT session only', async () => {
    const one = await login('konto@fjordvik.invalid')
    const two = await login('konto@fjordvik.invalid')
    await signOut(deps(), one)
    assert.equal(await currentSession(h.payload, one), null)
    await session(two)
  })

  it('an expired token is refused', async () => {
    const live = await login('konto@fjordvik.invalid')
    const sid = (await session(live)).sid
    const { token } = await jwtSign({
      fieldsToSign: { id: id.accA, collection: 'miljo-accounts', email: 'konto@fjordvik.invalid', sid },
      secret: h.payload.secret,
      tokenExpiration: -60,
    } as never)
    assert.equal(await currentSession(h.payload, token), null)
  })

  it('a tampered token, a random string and an administrator token are refused', async () => {
    const live = await login('konto@fjordvik.invalid')
    assert.equal(await currentSession(h.payload, `${live.slice(0, -4)}AAAA`), null)
    assert.equal(await currentSession(h.payload, 'not-a-token-at-all-xxxxxxxxxx'), null)
    const admin = await h.login('users', 'admin@aboks.invalid', PASSWORD)
    assert.equal(await currentSession(h.payload, admin), null, 'staff tokens are not Miljø sessions')
  })

  it('suspending the business customer ends the session on the next request', async () => {
    const token = await login('konto@utenpin.invalid')
    await session(token)
    row('business-customers', id.bcSuspend).status = 'suspended'
    try {
      assert.equal(await currentSession(h.payload, token), null)
      const again = await signIn(deps(), { email: 'konto@utenpin.invalid', password: PASSWORD, ip })
      assert.equal(again.ok, false)
    } finally {
      row('business-customers', id.bcSuspend).status = 'active'
    }
  })

  it('losing the last valid order pauses access', async () => {
    const token = await login('konto@utenpin.invalid')
    const order = rows('orders').find((o) => o.id === 33)!
    order.status = 'cancelled'
    try {
      assert.equal(await currentSession(h.payload, token), null)
    } finally {
      order.status = 'shipped'
    }
  })
})

/* ------------------------------ password recovery ------------------------------ */

describe('password recovery', () => {
  const tokenFromMail = () => {
    const m = /nytt-passord\?token=([A-Za-z0-9_-]+)/.exec(sent[0]!.text)
    assert.ok(m, 'link in the e-mail')
    return decodeURIComponent(m[1]!)
  }

  it('the same answer for an unknown, a deactivated and an active address — only the active one gets an e-mail', async () => {
    const unknown = await requestPasswordReset(deps(), { email: 'finnes-ikke@aboks.invalid', ip })
    const disabled = await requestPasswordReset(deps(), { email: 'konto@av.invalid', ip })
    assert.equal(sent.length, 0)
    const active = await requestPasswordReset(deps(), { email: 'konto@fjordvik.invalid', ip })
    assert.deepEqual(unknown, active)
    assert.deepEqual(disabled, active)
    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.to, 'konto@fjordvik.invalid')
    assert.ok(sent[0]!.text.includes('https://aboks-git-preview.vercel.app/miljoregistrering/nytt-passord?token='))
    // Only the hash is stored.
    const raw = tokenFromMail()
    assert.equal(row('miljo-accounts', id.accA).resetPasswordToken, hashToken(raw))
  })

  it('a valid link sets the new password, revokes every session, and works only once', async () => {
    const before = await login('konto@fjordvik.invalid')
    await requestPasswordReset(deps(), { email: 'konto@fjordvik.invalid', ip })
    const raw = tokenFromMail()

    const weak = await resetPassword(deps(), { token: raw, password: 'kort', passwordConfirmation: 'kort', ip })
    assert.equal((weak as { status: number }).status, 400)

    const ok = await resetPassword(deps(), { token: raw, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD, ip })
    assert.equal(ok.ok, true, JSON.stringify(ok))
    assert.equal(await currentSession(h.payload, before), null, 'old session revoked')
    assert.equal((await signIn(deps(), { email: 'konto@fjordvik.invalid', password: PASSWORD, ip })).ok, false, 'old password no longer works')
    await login('konto@fjordvik.invalid', NEW_PASSWORD)

    const reuse = await resetPassword(deps(), { token: raw, password: 'Enda-et-passord-1', passwordConfirmation: 'Enda-et-passord-1', ip })
    assert.equal(reuse.ok, false)
    assert.equal((reuse as { code?: string }).code, 'invalid')
    await login('konto@fjordvik.invalid', NEW_PASSWORD)
  })

  it('an expired link is refused', async () => {
    await requestPasswordReset(deps(), { email: 'konto@kystbygg.invalid', ip })
    const raw = tokenFromMail()
    row('miljo-accounts', id.accB).resetPasswordExpiration = new Date(Date.now() - 1000).toISOString()
    const res = await resetPassword(deps(), { token: raw, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD, ip })
    assert.equal(res.ok, false)
    await login('konto@kystbygg.invalid')
  })

  it('a random or malformed token is refused', async () => {
    for (const token of ['x', randomBytes(32).toString('base64url'), null]) {
      const res = await resetPassword(deps(), { token, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD, ip })
      assert.equal(res.ok, false)
    }
  })

  it('Payload’s own forgot/reset endpoints stay closed', async () => {
    const forgot = await h.rest('POST', '/miljo-accounts/forgot-password', { body: { email: 'konto@fjordvik.invalid' } })
    assert.equal(forgot.status, 403)
    const reset = await h.rest('POST', '/miljo-accounts/reset-password', { body: { token: 'x', password: NEW_PASSWORD } })
    assert.notEqual(reset.status, 200)
  })
})

/* ------------------------------ change password ------------------------------ */

describe('change password (signed in)', () => {
  it('needs the current password', async () => {
    const s = await session(await login('konto@kystbygg.invalid'))
    const res = await changePassword(deps(), s, { currentPassword: 'Feil-passord-1', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
    assert.equal((res as { field?: string }).field, 'currentPassword')
  })

  it('revokes every session — this browser included — and signs this browser in again', async () => {
    const other = await login('konto@kystbygg.invalid')
    const mine = await login('konto@kystbygg.invalid')
    const res = await changePassword(deps(), await session(mine), { currentPassword: PASSWORD, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD })
    assert.equal(res.ok, true, JSON.stringify(res))
    assert.equal(await currentSession(h.payload, other), null, 'other device signed out')
    assert.equal(await currentSession(h.payload, mine), null, 'the old session of this browser is gone too')
    const fresh = (res as { token: string }).token
    await session(fresh)
    assert.equal((await signIn(deps(), { email: 'konto@kystbygg.invalid', password: PASSWORD, ip })).ok, false, 'old password no longer works')
    // Put the test password back for the other suites.
    const back = await changePassword(deps(), await session(fresh), { currentPassword: NEW_PASSWORD, password: PASSWORD, passwordConfirmation: PASSWORD })
    assert.equal(back.ok, true)
  })
})

/* ------------------------------ Min side, PIN, QR ------------------------------ */

describe('Min side — own organisation only', () => {
  it('shows the own company and a production QR address, even on a preview deployment', async () => {
    const data = await dashboard(await session(await login('konto@kystbygg.invalid')))
    assert.equal(data.officialName, 'Kystbygg AS')
    assert.equal(data.organizationNumber, '923609016')
    assert.equal(data.loginEmail, 'konto@kystbygg.invalid')
    assert.equal(data.accessStatus, 'Aktiv')
    assert.equal(data.publicUrl, 'https://aboks.no/miljo/kystbygg02')
  })

  it('«Vis PIN» returns the own organisation’s active PIN — never another one', async () => {
    const a = await revealPin(deps(), await session(await login('konto@fjordvik.invalid', NEW_PASSWORD)))
    const b = await revealPin(deps(), await session(await login('konto@kystbygg.invalid')))
    assert.deepEqual(a, { ok: true, pin: PIN.a })
    assert.deepEqual(b, { ok: true, pin: PIN.b })
  })

  it('no PIN to show → a clear refusal, nothing invented', async () => {
    const res = await revealPin(deps(), await session(await login('konto@utenpin.invalid')))
    assert.equal(res.ok, false)
    assert.equal((res as { code?: string }).code, 'unavailable')
    assert.equal(row('environmental-organizations', id.orgNoPin).pinHash, undefined, 'no PIN created by viewing')
  })

  it('without the vault key the PIN cannot be shown', async () => {
    const key = process.env[PIN_KEY_ENV]
    delete process.env[PIN_KEY_ENV]
    try {
      const res = await revealPin(deps(), await session(await login('konto@kystbygg.invalid')))
      assert.equal(res.ok, false)
    } finally {
      process.env[PIN_KEY_ENV] = key
    }
  })

  it('the PIN is rate-limited per account', async () => {
    const s = await session(await login('konto@kystbygg.invalid'))
    for (let i = 0; i < ACCOUNT_RATE_LIMITS.pinPerAccount.limit; i++) rate.hit(`acct:pin:${String(id.accB)}`, 60)
    const res = await revealPin(deps(), s)
    assert.equal((res as { status: number }).status, 429)
  })
})

describe('QR files', () => {
  const url = 'https://aboks.no/miljo/kystbygg02'

  it('PNG: a valid image whose pixels are exactly the QR modules of the production URL', () => {
    const png = qrPng(url)
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const width = png.readUInt32BE(16)
    assert.ok(width >= 1500, `print resolution (${width}px)`)
    // Collect IDAT, inflate, sample the centre of every module.
    let off = 8
    const idat: Buffer[] = []
    while (off < png.length) {
      const len = png.readUInt32BE(off)
      const type = png.subarray(off + 4, off + 8).toString('ascii')
      if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len))
      off += 12 + len
    }
    const raw = inflateSync(Buffer.concat(idat))
    const qr = qrFor(url)
    const scale = width / (qr.size + 8)
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        const py = Math.floor((y + 4 + 0.5) * scale)
        const px = Math.floor((x + 4 + 0.5) * scale)
        const value = raw[py * (width + 1) + 1 + px]
        assert.equal(value === 0, qr.modules[y]![x], `module ${x},${y}`)
      }
    }
  })

  it('PDF: A4 with the name, the instruction and the address — and no PIN', async () => {
    const bytes = Buffer.from(await qrPdf({ organizationName: 'Kystbygg AS', publicUrl: url }))
    const text = bytes.toString('latin1')
    assert.ok(text.startsWith('%PDF-'))
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(bytes)
    assert.equal(doc.getPageCount(), 1)
    const { width, height } = doc.getPage(0).getSize()
    assert.deepEqual([Math.round(width), Math.round(height)], [595, 842], 'A4')
    // The content stream is Flate-compressed; text is drawn as hex strings.
    const content = [...text.matchAll(/stream\r?\n([\s\S]*?)endstream/g)]
      .map((m) => {
        try {
          return inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1')
        } catch {
          return ''
        }
      })
      .join(' ')
    const hex = (v: string) => Buffer.from(v, 'latin1').toString('hex').toUpperCase()
    for (const shown of ['Kystbygg AS', QR_CAPTION, url]) assert.ok(content.includes(hex(shown)), shown)
    for (const pin of Object.values(PIN)) {
      assert.ok(!text.includes(pin) && !content.includes(pin) && !content.includes(hex(pin)), 'no PIN in the file')
    }
  })

  it('error correction at least Q (robust print on a box)', () => {
    assert.ok(['Q', 'H'].includes(qrFor(url).errorCorrectionLevel))
  })
})

/* ------------------------------ HTTP edge ------------------------------ */

describe('HTTP edge — CSRF', () => {
  const origin = [...buildCsrfOrigins(SITE_URL)][0]!
  const post = (headers: Record<string, string>, body = '{}') => new Request('http://localhost:3000/api/miljo/konto/logg-inn', { method: 'POST', headers, body })

  it('a POST without Origin, or from another site, is refused', async () => {
    const none = await parsePost(post({ 'Content-Type': 'application/json' }))
    assert.ok(none instanceof Response && none.status === 403)
    const evil = await parsePost(post({ 'Content-Type': 'application/json', Origin: 'https://evil.example' }))
    assert.ok(evil instanceof Response && evil.status === 403)
  })

  it('a same-site JSON POST is accepted and carries only the Miljø cookie', async () => {
    const ok = await parsePost(post({ 'Content-Type': 'application/json', Origin: origin, Cookie: `payload-token=admin.jwt.value-xxxxxxxxxxxx; ${MILJO_SESSION_COOKIE}=miljo.jwt.value-xxxxxxxxxxxx` }, '{"email":"x"}'))
    assert.ok(!(ok instanceof Response))
    assert.equal(ok.token, 'miljo.jwt.value-xxxxxxxxxxxx')
    assert.equal(ok.body.email, 'x')
  })

  it('a non-JSON body is refused (no form-encoded cross-site posts)', async () => {
    const res = await parsePost(post({ 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin }, 'email=x'))
    assert.ok(res instanceof Response && res.status === 415)
  })
})
