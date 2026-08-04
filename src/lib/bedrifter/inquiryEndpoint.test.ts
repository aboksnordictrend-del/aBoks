import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { RateLimitResult } from '@/lib/rateLimit'
import {
  DUPLICATE_WINDOW_MS,
  HONEYPOT_FIELD,
  INQUIRY_RESPONSE_MESSAGES,
  MAX_BODY_BYTES,
  RATE_LIMIT,
  handleBusinessInquiry,
  inquiryFingerprint,
  resetInquiryDuplicateGuard,
  type InquiryEndpointDeps,
  type InquiryEndpointResult,
  type OutgoingEmail,
} from './inquiryEndpoint'
import { INQUIRY_MESSAGES } from './inquiry'

/**
 * `POST /api/bedrifter/foresporsel`, end to end apart from the transport.
 *
 * The two things worth guarding hardest: an inquiry is successful only when BOTH e-mails went
 * out, and nothing about why a request was refused ever reaches a bot. Everything the handler
 * touches is injected, so no Payload, no SMTP and no network is involved.
 */

const VALID_BODY = {
  company: 'Nordisk Verksted AS',
  orgNumber: '123456789',
  contactPerson: 'Kari Nordmann',
  email: 'kari@nordiskverksted.no',
  phone: '+47 900 12 345',
  interest: 'aBoks Office',
  quantity: '25',
  message: 'Vi trenger batteriinnsamling på tre avdelinger.',
}

/** Records every send, and can be told to fail at a given stage. */
function mailbox(failOn?: 'admin' | 'confirmation') {
  const sent: OutgoingEmail[] = []
  return {
    sent,
    sendEmail: async (message: OutgoingEmail) => {
      const isAdmin = message.to === 'post@aboks.no'
      if ((failOn === 'admin' && isAdmin) || (failOn === 'confirmation' && !isAdmin)) {
        throw new Error('SMTP 535 authentication failed for user aboks@zoho.eu')
      }
      sent.push(message)
      return { messageId: `<${sent.length}@test>` }
    },
  }
}

const allow = async (): Promise<RateLimitResult> => ({ ok: true, remaining: 4, resetMs: 1000 })
const deny = async (): Promise<RateLimitResult> => ({ ok: false, remaining: 0, resetMs: 90_000 })

function post(
  deps: Partial<InquiryEndpointDeps> & { sendEmail: InquiryEndpointDeps['sendEmail'] },
  body: unknown,
  input: { origin?: string | null; contentType?: string | null; ip?: string } = {},
): Promise<InquiryEndpointResult> {
  const logs: Record<string, unknown>[] = []
  return handleBusinessInquiry(
    {
      rateLimit: allow,
      originAllowed: () => true,
      verifyTurnstile: async () => true,
      log: (line) => logs.push(line),
      now: () => new Date('2026-08-04T12:32:00.000Z'),
      sendTimeoutMs: 1_000,
      ...deps,
    },
    {
      origin: input.origin ?? null,
      contentType: input.contentType === undefined ? 'application/json' : input.contentType,
      ip: input.ip ?? '203.0.113.7',
      rawBody: typeof body === 'string' ? body : JSON.stringify(body),
    },
  )
}

/** Same as `post`, but hands back the log lines too. */
async function postWithLogs(
  deps: Partial<InquiryEndpointDeps> & { sendEmail: InquiryEndpointDeps['sendEmail'] },
  body: unknown,
  input: Parameters<typeof post>[2] = {},
) {
  const logs: Record<string, unknown>[] = []
  const result = await post({ ...deps, log: (line) => logs.push(line) }, body, input)
  return { result, logs }
}

beforeEach(() => resetInquiryDuplicateGuard())

describe('handleBusinessInquiry — a valid submission', () => {
  it('sends exactly two e-mails and reports success', async () => {
    const box = mailbox()
    const result = await post(box, VALID_BODY)

    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { ok: true, message: INQUIRY_RESPONSE_MESSAGES.success })
    assert.equal(box.sent.length, 2)
  })

  it('sends the internal notification first, then the customer receipt', async () => {
    const box = mailbox()
    await post(box, VALID_BODY)

    assert.equal(box.sent[0]!.to, 'post@aboks.no')
    assert.equal(box.sent[0]!.subject, 'Ny bedriftsforespørsel fra Nordisk Verksted AS')
    assert.equal(box.sent[1]!.to, 'kari@nordiskverksted.no')
    assert.equal(box.sent[1]!.subject, 'Vi har mottatt forespørselen din')
  })

  it('gives both e-mails an HTML and a plain-text body', async () => {
    const box = mailbox()
    await post(box, VALID_BODY)

    for (const message of box.sent) {
      assert.ok(message.html.includes('<!DOCTYPE html>'))
      assert.ok(message.text.length > 50)
    }
  })

  it('sends the normalised values, not the raw ones', async () => {
    const box = mailbox()
    await post(box, { ...VALID_BODY, company: '  Nordisk   Verksted AS ', orgNumber: '123 456 789' })

    assert.ok(box.sent[0]!.text.includes('Firmanavn: Nordisk Verksted AS'))
    assert.ok(box.sent[0]!.text.includes('Organisasjonsnummer: 123456789'))
  })

  it('accepts a submission that fills in only the required fields', async () => {
    const box = mailbox()
    const result = await post(box, {
      company: 'Enkel AS',
      contactPerson: 'Ola',
      email: 'ola@enkel.no',
      interest: 'Annet',
      message: 'Hei, vi vil vite mer.',
    })

    assert.equal(result.status, 200)
    assert.equal(box.sent.length, 2)
    assert.ok(box.sent[0]!.text.includes('Telefonnummer: Ikke oppgitt'))
  })

  it('logs shape and outcome without any of the customer’s details', async () => {
    const { logs } = await postWithLogs(mailbox(), VALID_BODY)
    const serialised = JSON.stringify(logs)

    for (const secret of [
      'kari@nordiskverksted.no',
      'Nordisk Verksted AS',
      'Kari Nordmann',
      '900 12 345',
      'batteriinnsamling',
      '203.0.113.7',
    ]) {
      assert.ok(!serialised.includes(secret), `log leaks: ${secret}`)
    }
    assert.ok(serialised.includes('bedrifter-inquiry'))
  })
})

describe('handleBusinessInquiry — validation', () => {
  it('rejects a missing required field with a field-level message', async () => {
    const box = mailbox()
    const result = await post(box, { ...VALID_BODY, company: '' })

    assert.equal(result.status, 400)
    assert.equal(result.body.ok, false)
    assert.ok(!result.body.ok && result.body.reason === 'validation_failed')
    assert.ok(!result.body.ok && result.body.errors?.company === INQUIRY_MESSAGES.companyRequired)
    assert.equal(box.sent.length, 0)
  })

  it('rejects an invalid email address', async () => {
    const box = mailbox()
    const result = await post(box, { ...VALID_BODY, email: 'kari-at-nordisk' })

    assert.equal(result.status, 400)
    assert.ok(!result.body.ok && result.body.errors?.email === INQUIRY_MESSAGES.emailInvalid)
    assert.equal(box.sent.length, 0)
  })

  it('rejects whitespace-only values', async () => {
    const box = mailbox()
    const result = await post(box, {
      ...VALID_BODY,
      company: '   ',
      contactPerson: '\t',
      message: '\n\n',
    })

    assert.equal(result.status, 400)
    assert.ok(!result.body.ok)
    assert.deepEqual(
      Object.keys(!result.body.ok ? (result.body.errors ?? {}) : {}).sort(),
      ['company', 'contactPerson', 'message'],
    )
    assert.equal(box.sent.length, 0)
  })

  it('rejects an overlong message', async () => {
    const box = mailbox()
    const result = await post(box, { ...VALID_BODY, message: 'a'.repeat(3001) })

    assert.equal(result.status, 400)
    assert.ok(!result.body.ok && result.body.errors?.message === INQUIRY_MESSAGES.messageTooLong)
    assert.equal(box.sent.length, 0)
  })

  it('rejects a body that is not JSON', async () => {
    const box = mailbox()
    const result = await post(box, '{ not json')

    assert.equal(result.status, 400)
    assert.ok(!result.body.ok && result.body.reason === 'invalid_request')
    assert.equal(box.sent.length, 0)
  })

  it('rejects a JSON array or scalar, which cannot carry fields', async () => {
    const box = mailbox()
    assert.equal((await post(box, [1, 2, 3])).status, 400)
    assert.equal((await post(box, '"hei"')).status, 400)
    assert.equal(box.sent.length, 0)
  })

  it('rejects anything that is not application/json', async () => {
    const box = mailbox()
    const result = await post(box, VALID_BODY, {
      contentType: 'application/x-www-form-urlencoded',
    })

    assert.equal(result.status, 415)
    assert.equal(box.sent.length, 0)
  })

  it('rejects an unexpectedly large payload before parsing it', async () => {
    const box = mailbox()
    const huge = JSON.stringify({ ...VALID_BODY, message: 'a'.repeat(MAX_BODY_BYTES) })
    const result = await post(box, huge)

    assert.equal(result.status, 413)
    assert.ok(!result.body.ok && result.body.reason === 'invalid_request')
    assert.equal(box.sent.length, 0)
  })
})

describe('handleBusinessInquiry — spam protection', () => {
  it('refuses an untrusted origin', async () => {
    const box = mailbox()
    const result = await post({ ...box, originAllowed: () => false }, VALID_BODY, {
      origin: 'https://evil.example',
    })

    assert.equal(result.status, 403)
    assert.ok(!result.body.ok && result.body.reason === 'forbidden_origin')
    assert.equal(box.sent.length, 0)
  })

  it('rejects a filled honeypot and sends nothing', async () => {
    const box = mailbox()
    const result = await post(box, { ...VALID_BODY, [HONEYPOT_FIELD]: 'bot was here' })

    assert.equal(result.body.ok, false)
    assert.equal(box.sent.length, 0)
  })

  it('never tells a bot that it was the honeypot that caught it', async () => {
    const box = mailbox()
    const trapped = await post(box, { ...VALID_BODY, [HONEYPOT_FIELD]: 'bot' })
    const malformed = await post(box, '{ not json')

    assert.deepEqual(trapped.body, malformed.body)
    assert.equal(
      !trapped.body.ok && trapped.body.message,
      INQUIRY_RESPONSE_MESSAGES.invalidRequest,
    )
  })

  it('records the honeypot in the log even though the response is generic', async () => {
    const { logs } = await postWithLogs(mailbox(), { ...VALID_BODY, [HONEYPOT_FIELD]: 'bot' })
    assert.ok(logs.some((line) => line.stage === 'honeypot'))
  })

  it('lets an empty honeypot through, since the field is always submitted', async () => {
    const box = mailbox()
    const result = await post(box, { ...VALID_BODY, [HONEYPOT_FIELD]: '' })

    assert.equal(result.status, 200)
    assert.equal(box.sent.length, 2)
  })

  it('rejects a failed Turnstile check', async () => {
    const box = mailbox()
    const result = await post({ ...box, verifyTurnstile: async () => false }, VALID_BODY)

    assert.equal(result.status, 400)
    assert.ok(!result.body.ok && result.body.reason === 'turnstile_failed')
    assert.equal(
      !result.body.ok && result.body.message,
      INQUIRY_RESPONSE_MESSAGES.turnstileFailed,
    )
    assert.equal(box.sent.length, 0)
  })

  it('passes the token and the caller’s IP to the verifier', async () => {
    const seen: { token?: string; ip?: string }[] = []
    const box = mailbox()
    await post(
      {
        ...box,
        verifyTurnstile: async (token, ip) => {
          seen.push({ token, ip })
          return true
        },
      },
      { ...VALID_BODY, turnstileToken: 'tok-123' },
      { ip: '198.51.100.4' },
    )

    assert.deepEqual(seen, [{ token: 'tok-123', ip: '198.51.100.4' }])
  })

  it('also reads the token under the widget’s own field name', async () => {
    const seen: (string | undefined)[] = []
    const box = mailbox()
    await post(
      {
        ...box,
        verifyTurnstile: async (token) => {
          seen.push(token)
          return true
        },
      },
      { ...VALID_BODY, 'cf-turnstile-response': 'widget-token' },
    )

    assert.deepEqual(seen, ['widget-token'])
  })

  it('rejects a rate-limited caller with a Retry-After header', async () => {
    const box = mailbox()
    const result = await post({ ...box, rateLimit: deny }, VALID_BODY)

    assert.equal(result.status, 429)
    assert.ok(!result.body.ok && result.body.reason === 'rate_limited')
    assert.equal(!result.body.ok && result.body.retryAfter, 90)
    assert.equal(result.headers?.['Retry-After'], '90')
    assert.equal(box.sent.length, 0)
  })

  it('limits by IP, under a hashed key that never carries the address itself', async () => {
    const keys: string[] = []
    const box = mailbox()
    await post(
      {
        ...box,
        rateLimit: async ({ key, limit, windowMs }) => {
          keys.push(key)
          assert.equal(limit, RATE_LIMIT.limit)
          assert.equal(windowMs, RATE_LIMIT.windowMs)
          return { ok: true, remaining: 1, resetMs: 1000 }
        },
      },
      VALID_BODY,
      { ip: '203.0.113.7' },
    )

    assert.equal(keys.length, 1)
    assert.ok(keys[0]!.startsWith('bedrifter-inquiry:'))
    assert.ok(!keys[0]!.includes('203.0.113.7'))
  })

  it('allows five attempts an hour', () => {
    assert.equal(RATE_LIMIT.limit, 5)
    assert.equal(RATE_LIMIT.windowMs, 60 * 60 * 1000)
  })
})

describe('handleBusinessInquiry — a failing send', () => {
  it('reports a server error when the admin notification cannot be sent', async () => {
    const box = mailbox('admin')
    const result = await post(box, VALID_BODY)

    assert.equal(result.status, 500)
    assert.ok(!result.body.ok && result.body.reason === 'server_error')
    assert.equal(box.sent.length, 0, 'the customer must not be confirmed either')
  })

  it('reports a server error when the customer confirmation cannot be sent', async () => {
    const box = mailbox('confirmation')
    const result = await post(box, VALID_BODY)

    assert.equal(result.status, 500)
    assert.ok(!result.body.ok && result.body.reason === 'server_error')
    assert.equal(box.sent.length, 1, 'the admin notification had already gone out')
  })

  it('never leaks the transport error to the client', async () => {
    const result = await post(mailbox('admin'), VALID_BODY)
    const serialised = JSON.stringify(result.body)

    for (const detail of ['SMTP', '535', 'zoho', 'authentication']) {
      assert.ok(!serialised.toLowerCase().includes(detail.toLowerCase()), `leaks: ${detail}`)
    }
    assert.equal(!result.body.ok && result.body.message, INQUIRY_RESPONSE_MESSAGES.serverError)
  })

  it('logs the stage and the transport error server-side', async () => {
    const { logs } = await postWithLogs(mailbox('confirmation'), VALID_BODY)
    const failure = logs.find((line) => line.event === 'email-failed')

    assert.ok(failure, 'expected an email-failed log line')
    assert.equal(failure!.stage, 'confirmation')
    assert.equal(failure!.adminSent, true)
    assert.match(String(failure!.error), /SMTP 535/)
  })

  it('lets a retry through after a failure, since nothing was recorded', async () => {
    await post(mailbox('admin'), VALID_BODY)

    const box = mailbox()
    const result = await post(box, VALID_BODY)
    assert.equal(result.status, 200)
    assert.equal(box.sent.length, 2)
  })

  it('gives up on a send that never settles', async () => {
    const result = await post(
      { sendEmail: () => new Promise(() => {}), sendTimeoutMs: 20 },
      VALID_BODY,
    )
    assert.equal(result.status, 500)
  })
})

describe('handleBusinessInquiry — duplicate submissions', () => {
  it('sends only one pair of e-mails when two identical requests overlap', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const sent: OutgoingEmail[] = []
    const deps = {
      sendEmail: async (message: OutgoingEmail) => {
        await gate
        sent.push(message)
        return {}
      },
    }

    const first = post(deps, VALID_BODY)
    const second = post(deps, VALID_BODY)
    release()

    const [a, b] = await Promise.all([first, second])
    assert.equal(a.status, 200)
    assert.equal(b.status, 200)
    assert.equal(sent.length, 2, 'one inquiry, two e-mails — not four')
  })

  it('gives an overlapping duplicate the same failure, never a false success', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const deps = {
      sendEmail: async () => {
        await gate
        throw new Error('SMTP 535 authentication failed')
      },
    }

    const first = post(deps, VALID_BODY)
    const second = post(deps, VALID_BODY)
    release()

    const [a, b] = await Promise.all([first, second])
    assert.equal(a.status, 500)
    assert.equal(b.status, 500)
  })

  it('answers an identical resubmission from the guard without sending again', async () => {
    const box = mailbox()
    await post(box, VALID_BODY)
    const again = await post(box, VALID_BODY)

    assert.equal(again.status, 200)
    assert.equal(again.body.ok, true)
    assert.equal(box.sent.length, 2, 'still one inquiry')
  })

  it('records the duplicate in the log, so a real one is still visible', async () => {
    const box = mailbox()
    await post(box, VALID_BODY)
    const { logs } = await postWithLogs(box, VALID_BODY)

    assert.ok(logs.some((line) => line.duplicate === 'recent'))
  })

  it('treats a changed message as a new inquiry', async () => {
    const box = mailbox()
    await post(box, VALID_BODY)
    await post(box, { ...VALID_BODY, message: 'Et helt annet spørsmål.' })

    assert.equal(box.sent.length, 4)
  })

  it('fingerprints on content alone, so the same inquiry from another network still matches', () => {
    const a = inquiryFingerprint({
      company: 'A',
      contactPerson: 'B',
      email: 'c@d.no',
      interest: 'Annet',
      message: 'M',
    })
    const b = inquiryFingerprint({
      company: 'A',
      contactPerson: 'B',
      email: 'C@D.no',
      interest: 'Annet',
      message: 'M',
    })
    assert.equal(a, b, 'the address is compared case-insensitively')
    assert.equal(a.length, 32)
  })

  it('keeps the duplicate window short enough for a genuine follow-up later', () => {
    assert.ok(DUPLICATE_WINDOW_MS <= 60 * 60 * 1000)
  })
})
