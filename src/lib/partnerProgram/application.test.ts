import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { RateLimitResult } from '@/lib/rateLimit'
import { APPLICATION_MESSAGES, validateApplicationInput, firstInvalidApplicationField } from './application'
import {
  APPLICATION_RESPONSE_MESSAGES,
  HONEYPOT_FIELD,
  MAX_BODY_BYTES,
  handlePartnerApplication,
  resetApplicationDuplicateGuard,
  type ApplicationEndpointDeps,
  type OutgoingEmail,
} from './applicationEndpoint'
import { submitApplication } from './submitApplication'

const VALID = {
  applicantType: 'bedrift',
  fullName: 'Kari Nordmann',
  companyName: 'Nordisk Kontor AS',
  orgNumber: '123 456 789',
  email: 'kari@nordiskkontor.no',
  phone: '+47 900 12 345',
  website: 'https://nordiskkontor.no',
  promotionPlan: 'Jeg vil anbefale aBoks til kundene våre innen kontordrift og facility.',
  privacyAccepted: true,
  approvalAcknowledged: true,
}

describe('validateApplicationInput', () => {
  it('accepts a complete company application and normalises it', () => {
    const result = validateApplicationInput(VALID)
    assert.ok(result.ok)
    assert.equal(result.value.orgNumber, '123456789')
    assert.equal(result.value.companyName, 'Nordisk Kontor AS')
  })

  it('a private person needs neither company name nor org.nr — and they are dropped if sent', () => {
    const result = validateApplicationInput({
      ...VALID,
      applicantType: 'privatperson',
      companyName: 'Should be ignored',
      orgNumber: 'not checked',
    })
    assert.ok(result.ok)
    assert.equal(result.value.companyName, undefined)
    assert.equal(result.value.orgNumber, undefined)
  })

  it('a company must give company name and org.nr; an ENK may leave both out', () => {
    const company = validateApplicationInput({ ...VALID, companyName: ' ', orgNumber: '' })
    assert.ok(!company.ok)
    assert.equal(company.errors.companyName, APPLICATION_MESSAGES.companyNameRequired)
    assert.equal(company.errors.orgNumber, APPLICATION_MESSAGES.orgNumberRequired)

    const enk = validateApplicationInput({ ...VALID, applicantType: 'enk', companyName: '', orgNumber: '' })
    assert.ok(enk.ok)
  })

  it('rejects a malformed org.nr', () => {
    const result = validateApplicationInput({ ...VALID, orgNumber: '12345' })
    assert.ok(!result.ok)
    assert.equal(result.errors.orgNumber, APPLICATION_MESSAGES.orgNumberInvalid)
  })

  it('requires both confirmations to be literally true', () => {
    const result = validateApplicationInput({ ...VALID, privacyAccepted: 'true', approvalAcknowledged: 1 })
    assert.ok(!result.ok)
    assert.equal(result.errors.privacyAccepted, APPLICATION_MESSAGES.privacyRequired)
    assert.equal(result.errors.approvalAcknowledged, APPLICATION_MESSAGES.approvalRequired)
  })

  it('flags missing required fields and focuses them in form order', () => {
    const result = validateApplicationInput({})
    assert.ok(!result.ok)
    assert.equal(firstInvalidApplicationField(result.errors), 'applicantType')
    for (const key of ['fullName', 'email', 'promotionPlan', 'privacyAccepted', 'approvalAcknowledged']) {
      assert.ok(key in result.errors, key)
    }
  })

  it('validates email, phone and the promotion-plan length', () => {
    const result = validateApplicationInput({
      ...VALID,
      email: 'not-an-email',
      phone: '123',
      promotionPlan: 'For kort',
    })
    assert.ok(!result.ok)
    assert.equal(result.errors.email, APPLICATION_MESSAGES.emailInvalid)
    assert.equal(result.errors.phone, APPLICATION_MESSAGES.phoneInvalid)
    assert.equal(result.errors.promotionPlan, APPLICATION_MESSAGES.promotionPlanTooShort)
  })

  it('an unknown applicant type is refused', () => {
    const result = validateApplicationInput({ ...VALID, applicantType: 'admin' })
    assert.ok(!result.ok)
    assert.equal(result.errors.applicantType, APPLICATION_MESSAGES.applicantTypeRequired)
  })
})

/* ------------------------------ endpoint ------------------------------ */

function mailbox(failOn?: 'admin' | 'confirmation') {
  const sent: OutgoingEmail[] = []
  return {
    sent,
    sendEmail: async (message: OutgoingEmail) => {
      const isAdmin = message.to === 'post@aboks.no'
      if ((failOn === 'admin' && isAdmin) || (failOn === 'confirmation' && !isAdmin)) {
        throw new Error('SMTP down')
      }
      sent.push(message)
      return {}
    },
  }
}

const allow = async (): Promise<RateLimitResult> => ({ ok: true, remaining: 4, resetMs: 1000 })
const deny = async (): Promise<RateLimitResult> => ({ ok: false, remaining: 0, resetMs: 90_000 })

function post(
  deps: Partial<ApplicationEndpointDeps> & { sendEmail: ApplicationEndpointDeps['sendEmail'] },
  body: unknown,
  input: { origin?: string | null; contentType?: string | null } = {},
) {
  return handlePartnerApplication(
    {
      rateLimit: allow,
      originAllowed: () => true,
      verifyTurnstile: async () => true,
      log: () => {},
      now: () => new Date('2026-10-13T10:00:00.000Z'),
      sendTimeoutMs: 1_000,
      ...deps,
    },
    {
      origin: input.origin === undefined ? 'https://aboks.no' : input.origin,
      contentType: input.contentType === undefined ? 'application/json' : input.contentType,
      ip: '203.0.113.7',
      rawBody: typeof body === 'string' ? body : JSON.stringify(body),
    },
  )
}

describe('handlePartnerApplication', () => {
  beforeEach(() => resetApplicationDuplicateGuard())

  it('sends the admin notification first, then the receipt, and reports success', async () => {
    const box = mailbox()
    const result = await post(box, VALID)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { ok: true, message: APPLICATION_RESPONSE_MESSAGES.success })
    assert.equal(box.sent.length, 2)
    assert.equal(box.sent[0].to, 'post@aboks.no')
    assert.equal(box.sent[1].to, VALID.email)
    assert.match(box.sent[0].text, /Ingenting er godkjent eller opprettet automatisk/)
    assert.match(box.sent[1].text, /ikke er en godkjenning eller en avtale/)
  })

  it('the success message is the agreed copy', () => {
    assert.equal(
      APPLICATION_RESPONSE_MESSAGES.success,
      'Takk for interessen! Vi har mottatt søknaden din og vil ta kontakt etter at den er vurdert.',
    )
  })

  it('escapes applicant-typed HTML in both e-mails', async () => {
    const box = mailbox()
    await post(box, { ...VALID, fullName: '<script>x</script>' })
    for (const mail of box.sent) assert.ok(!mail.html.includes('<script>x</script>'))
  })

  it('is not successful when either send fails', async () => {
    for (const stage of ['admin', 'confirmation'] as const) {
      resetApplicationDuplicateGuard()
      const result = await post(mailbox(stage), VALID)
      assert.equal(result.status, 500)
      assert.equal(result.body.ok, false)
    }
  })

  it('returns field errors for an invalid body and sends nothing', async () => {
    const box = mailbox()
    const result = await post(box, { ...VALID, email: '' })
    assert.equal(result.status, 400)
    assert.ok(!result.body.ok && result.body.errors?.email)
    assert.equal(box.sent.length, 0)
  })

  it('refuses honeypot, wrong origin, wrong content type, oversize and malformed bodies', async () => {
    const box = mailbox()
    assert.equal((await post(box, { ...VALID, [HONEYPOT_FIELD]: 'bot' })).status, 400)
    assert.equal((await post({ ...box, originAllowed: () => false }, VALID)).status, 403)
    assert.equal((await post(box, VALID, { contentType: 'text/plain' })).status, 415)
    assert.equal((await post(box, 'x'.repeat(MAX_BODY_BYTES + 1))).status, 413)
    assert.equal((await post(box, '{nope')).status, 400)
    assert.equal(box.sent.length, 0)
  })

  it('rate-limits and fails Turnstile without sending', async () => {
    const box = mailbox()
    const limited = await post({ ...box, rateLimit: deny }, VALID)
    assert.equal(limited.status, 429)
    assert.equal(limited.headers?.['Retry-After'], '90')
    const bot = await post({ ...box, verifyTurnstile: async () => false }, VALID)
    assert.equal(bot.status, 400)
    assert.equal(box.sent.length, 0)
  })

  it('a repeated identical application is answered from the guard, not re-sent', async () => {
    const box = mailbox()
    await post(box, VALID)
    const again = await post(box, VALID)
    assert.equal(again.status, 200)
    assert.equal(box.sent.length, 2)
  })

  it('two overlapping identical submissions send once', async () => {
    const box = mailbox()
    const [a, b] = await Promise.all([post(box, VALID), post(box, VALID)])
    assert.equal(a.status, 200)
    assert.equal(b.status, 200)
    assert.equal(box.sent.length, 2)
  })
})

describe('submitApplication', () => {
  it('does not call the network when the form is invalid', async () => {
    let called = false
    const outcome = await submitApplication({}, {}, (async () => {
      called = true
      return new Response('{}')
    }) as typeof fetch)
    assert.equal(outcome.kind, 'field-errors')
    assert.equal(called, false)
  })

  it('reports success only for { ok: true } on a 2xx', async () => {
    const ok = await submitApplication(VALID, {}, (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch)
    assert.equal(ok.kind, 'success')
    const odd = await submitApplication(VALID, {}, (async () =>
      new Response(JSON.stringify({ ok: false, message: 'Nei' }), { status: 200 })) as typeof fetch)
    assert.deepEqual(odd, { kind: 'error', message: 'Nei' })
    const offline = await submitApplication(VALID, {}, (async () => {
      throw new TypeError('offline')
    }) as typeof fetch)
    assert.equal(offline.kind, 'error')
  })
})
