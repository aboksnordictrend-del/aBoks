import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pbkdf2Sync } from 'node:crypto'
import { createMiljoRegistrationConfirmationEmail } from '@/emails'
import { memoryRateLimitStore, withinLimits, hashRateKey } from '@/lib/security/dbRateLimit'
import { BRREG_ENHET_URL, BRREG_MESSAGES, lookupOrganization } from './brreg'
import { PASSWORD_MESSAGES, hashPasswordForPayload, validateNewPassword } from './password'
import { PURCHASE_MESSAGES, decidePurchase, normalizeEmail, normalizeOrderNumber } from './purchase'
import { maskEmail } from './service'

describe('purchase — normalisation', () => {
  it('order numbers are normalised to AB-xxxxxx', () => {
    for (const v of ['AB-037697', 'ab-037697', ' AB037697 ', 'ab 037697']) assert.equal(normalizeOrderNumber(v), 'AB-037697', v)
    assert.equal(normalizeOrderNumber('XY-1'), 'XY-1')
    assert.equal(normalizeOrderNumber(null), '')
  })

  it('e-mails compare without case and surrounding spaces', () => {
    assert.equal(normalizeEmail('  Ola@Firma.NO '), 'ola@firma.no')
  })
})

describe('purchase — decision', () => {
  const sections = new Map<string, unknown>([['1', 'products'], ['2', 'accessories']])
  const order = (over: Record<string, unknown> = {}) => ({
    id: 10,
    status: 'confirmed',
    customerInfo: { email: 'kjoper@firma.no' },
    items: [{ product: 1 }],
    businessCustomer: null,
    ...over,
  })
  const decide = (o: unknown, email = 'kjoper@firma.no', linkedCustomerHasAccount = false) =>
    decidePurchase({ order: o as never, email, productSections: sections, linkedCustomerHasAccount })

  it('a confirmed, shipped or delivered order with an aBoks model qualifies', () => {
    for (const status of ['confirmed', 'shipped', 'delivered']) assert.deepEqual(decide(order({ status })), { ok: true })
    assert.deepEqual(decide(order(), ' KJOPER@firma.no '), { ok: true })
  })

  it('missing order, wrong e-mail and an order without e-mail are the SAME generic refusal', () => {
    for (const d of [decide(null), decide(order(), 'annen@firma.no'), decide(order({ customerInfo: {} }), '')]) {
      assert.deepEqual(d, { ok: false, reason: 'not_found' })
    }
  })

  it('pending and cancelled orders do not qualify', () => {
    for (const status of ['pending', 'cancelled', 'refunded', undefined]) assert.deepEqual(decide(order({ status })), { ok: false, reason: 'not_eligible_status' })
  })

  it('an order with accessories only does not qualify', () => {
    assert.deepEqual(decide(order({ items: [{ product: 2 }] })), { ok: false, reason: 'no_aboks_product' })
    assert.deepEqual(decide(order({ items: [] })), { ok: false, reason: 'no_aboks_product' })
    assert.deepEqual(decide(order({ items: [{ product: 2 }, { product: { id: 1 } }] })), { ok: true })
  })

  it('an order already linked to a company with an account is used', () => {
    assert.deepEqual(decide(order({ businessCustomer: 5 }), undefined, true), { ok: false, reason: 'linked_elsewhere' })
    assert.deepEqual(decide(order({ businessCustomer: 5 }), undefined, false), { ok: true }, 'admin-linked, no account yet')
  })

  it('messages are Norwegian and the generic one reveals nothing', () => {
    assert.match(PURCHASE_MESSAGES.not_found, /Vi kunne ikke bekrefte kjøpet/)
    assert.doesNotMatch(PURCHASE_MESSAGES.not_found, /finnes ikke|ukjent ordre|feil e-post/i)
  })
})

describe('Enhetsregisteret lookup', () => {
  const fakeFetch = (status: number, body: unknown = null, onUrl?: (u: string) => void) => async (url: string) => {
    onUrl?.(url)
    return { status, ok: status >= 200 && status < 300, json: async () => body }
  }

  it('returns the official name for an active company', async () => {
    let called = ''
    const r = await lookupOrganization('834 012 952', fakeFetch(200, { organisasjonsnummer: '834012952', navn: 'ABOKS AS' }, (u) => (called = u)))
    assert.deepEqual(r, { ok: true, organizationNumber: '834012952', officialName: 'ABOKS AS' })
    assert.equal(called, `${BRREG_ENHET_URL}834012952`)
  })

  it('an invalid number is refused without calling the register', async () => {
    let calls = 0
    const r = await lookupOrganization('834012953', async () => {
      calls++
      return { status: 200, ok: true, json: async () => ({}) }
    })
    assert.equal(r.ok, false)
    assert.equal(calls, 0)
  })

  it('not found, deleted, bankrupt/in liquidation', async () => {
    assert.deepEqual(await lookupOrganization('834012952', fakeFetch(404)), { ok: false, reason: 'not_found', message: BRREG_MESSAGES.not_found })
    const deleted = await lookupOrganization('834012952', fakeFetch(410))
    assert.equal(deleted.ok ? '' : deleted.reason, 'deleted')
    for (const flag of ['konkurs', 'underAvvikling', 'underTvangsavviklingEllerTvangsopplosning']) {
      const r = await lookupOrganization('834012952', fakeFetch(200, { organisasjonsnummer: '834012952', navn: 'X AS', [flag]: true }))
      assert.equal(r.ok ? '' : r.reason, 'inactive', flag)
    }
  })

  it('register down, a network error or a timeout → «try again later», never a guess', async () => {
    assert.equal(((await lookupOrganization('834012952', fakeFetch(503))) as { reason: string }).reason, 'unavailable')
    const r = await lookupOrganization('834012952', async () => {
      throw new Error('network')
    })
    assert.deepEqual(r, { ok: false, reason: 'unavailable', message: BRREG_MESSAGES.unavailable })
    const slow = await lookupOrganization(
      '834012952',
      (_u, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      20,
    )
    assert.equal((slow as { reason: string }).reason, 'unavailable')
  })
})

describe('password', () => {
  it('policy: length, letters and digits, matching confirmation', () => {
    assert.equal(validateNewPassword('Bokstav123', 'Bokstav123'), null)
    assert.equal(validateNewPassword('kort1', 'kort1'), PASSWORD_MESSAGES.length)
    assert.equal(validateNewPassword('bareBokstaver', 'bareBokstaver'), PASSWORD_MESSAGES.composition)
    assert.equal(validateNewPassword('1234567890', '1234567890'), PASSWORD_MESSAGES.composition)
    assert.equal(validateNewPassword('Bokstav123', 'Bokstav124'), PASSWORD_MESSAGES.mismatch)
    assert.equal(validateNewPassword('x'.repeat(129) + '1', 'x'.repeat(129) + '1'), PASSWORD_MESSAGES.length)
  })

  it('the hash is exactly Payload’s format (PBKDF2-SHA256, 25 000 rounds, 512 bytes, hex) and never the password', async () => {
    const { salt, hash } = await hashPasswordForPayload('Bokstav123')
    assert.match(salt, /^[0-9a-f]{64}$/)
    assert.equal(hash, pbkdf2Sync('Bokstav123', salt, 25000, 512, 'sha256').toString('hex'))
    assert.doesNotMatch(hash + salt, /Bokstav123/)
    assert.notEqual((await hashPasswordForPayload('Bokstav123')).salt, salt, 'fresh salt each time')
  })
})

describe('rate limiting', () => {
  it('counts per key within a window and resets after it', async () => {
    let t = 0
    const store = memoryRateLimitStore(() => t)
    const rule = { key: 'k', limit: 2, windowSeconds: 60 }
    assert.equal(await withinLimits(store, [rule]), true)
    assert.equal(await withinLimits(store, [rule]), true)
    assert.equal(await withinLimits(store, [rule]), false)
    t = 61_000
    assert.equal(await withinLimits(store, [rule]), true)
  })

  it('fails closed when the store fails; keys are stored hashed', async () => {
    assert.equal(await withinLimits({ hit: async () => Promise.reject(new Error('db')) }, [{ key: 'k', limit: 9, windowSeconds: 9 }]), false)
    assert.match(hashRateKey('reg:verify:ip:1.2.3.4'), /^[0-9a-f]{64}$/)
    assert.doesNotMatch(hashRateKey('reg:verify:ip:1.2.3.4'), /1\.2\.3\.4/)
  })
})

describe('confirmation e-mail', () => {
  const mail = createMiljoRegistrationConfirmationEmail({
    organizationName: 'Fjord <script>alert(1)</script> AS',
    organizationNumber: '834012952',
    contactName: 'Kari & Co',
    confirmUrl: 'https://aboks.no/miljoregistrering/bekreft?token=abc',
    expiresAt: new Date('2026-11-04T10:00:00Z'),
  })

  it('names aBoks, explains, links once, states the expiry and what to do if you did not register', () => {
    assert.match(mail.subject, /aBoks Miljøregistrering/)
    for (const part of [mail.html, mail.text]) {
      assert.match(part, /bekreft\?token=abc/)
      assert.match(part, /gjelder til/)
      assert.match(part, /ikke registrert deg/)
    }
  })

  it('escapes every registrant-typed value in the HTML', () => {
    assert.doesNotMatch(mail.html, /<script>/)
    assert.match(mail.html, /&lt;script&gt;/)
    assert.match(mail.html, /Kari &amp; Co/)
  })
})

describe('maskEmail', () => {
  it('shows enough to recognise the address', () => {
    assert.equal(maskEmail('kari@firma.no'), 'k***@firma.no')
    assert.equal(maskEmail('a@b.no'), 'a*@b.no')
    assert.equal(maskEmail('ugyldig'), '')
  })
})
