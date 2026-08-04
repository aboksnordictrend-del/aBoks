import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FIELD_SUMMARY,
  INQUIRY_ENDPOINT,
  clearsForm,
  pickFieldErrors,
  submitInquiry,
  type SubmitInquiryOutcome,
} from './submitInquiry'
import { INQUIRY_MESSAGES } from './inquiry'

/**
 * What the browser does with the form, minus the markup. The strict rule under test: the form
 * may show a thank-you, and may clear itself, for exactly one response — a 2xx carrying
 * `{ ok: true }`, which the server sends only once both e-mails are away.
 */

const VALUES = {
  company: 'Nordisk Verksted AS',
  orgNumber: '123 456 789',
  contactPerson: 'Kari Nordmann',
  email: 'kari@nordiskverksted.no',
  phone: '+47 900 12 345',
  interest: 'aBoks Office',
  quantity: '25',
  message: 'Vi trenger batteriinnsamling på tre avdelinger.',
}

type Call = { url: string; init: RequestInit }

/** A fetch stand-in that records the call and answers with a fixed status + JSON body. */
function stubFetch(status: number, body: unknown) {
  const calls: Call[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response
  }) as unknown as typeof fetch

  return { calls, impl }
}

const bodyOf = (call: Call) => JSON.parse(String(call.init.body)) as Record<string, unknown>

describe('submitInquiry — the request', () => {
  it('posts JSON to the inquiry endpoint', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    await submitInquiry(VALUES, {}, impl)

    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.url, INQUIRY_ENDPOINT)
    assert.equal(calls[0]!.init.method, 'POST')
    assert.deepEqual(calls[0]!.init.headers, { 'Content-Type': 'application/json' })
  })

  it('sends the normalised values rather than the raw ones', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    await submitInquiry({ ...VALUES, company: '  Nordisk   Verksted AS  ' }, {}, impl)

    const body = bodyOf(calls[0]!)
    assert.equal(body.company, 'Nordisk Verksted AS')
    assert.equal(body.orgNumber, '123456789')
  })

  it('includes the Turnstile token and the honeypot when the browser has them', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    await submitInquiry(VALUES, { turnstileToken: 'tok', honeypot: 'x' }, impl)

    const body = bodyOf(calls[0]!)
    assert.equal(body.turnstileToken, 'tok')
    assert.equal(body.referansekode, 'x')
  })

  it('omits them entirely when they are empty', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    await submitInquiry(VALUES, {}, impl)

    const body = bodyOf(calls[0]!)
    assert.ok(!('turnstileToken' in body))
    assert.ok(!('referansekode' in body))
  })

  it('never opens a mail client — the only outbound call is the fetch', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    await submitInquiry(VALUES, {}, impl)

    assert.equal(calls.length, 1)
    assert.ok(!calls[0]!.url.startsWith('mailto:'))
  })
})

describe('submitInquiry — outcomes', () => {
  it('reports success for a 200 with ok: true', async () => {
    const { impl } = stubFetch(200, { ok: true, message: 'Vi har mottatt …' })
    assert.deepEqual(await submitInquiry(VALUES, {}, impl), { kind: 'success' })
  })

  it('does NOT report success for a 200 without ok: true', async () => {
    const { impl } = stubFetch(200, { message: 'noe rart' })
    const outcome = await submitInquiry(VALUES, {}, impl)
    assert.equal(outcome.kind, 'error')
  })

  it('does NOT report success for a 500, whatever the body says', async () => {
    const { impl } = stubFetch(500, { ok: true })
    const outcome = await submitInquiry(VALUES, {}, impl)
    assert.equal(outcome.kind, 'error')
  })

  it('surfaces the server’s message on a server error', async () => {
    const { impl } = stubFetch(500, {
      ok: false,
      message: 'Prøv igjen om litt, eller kontakt oss på post@aboks.no.',
    })
    const outcome = await submitInquiry(VALUES, {}, impl)

    assert.equal(outcome.kind, 'error')
    assert.equal(
      outcome.kind === 'error' && outcome.message,
      'Prøv igjen om litt, eller kontakt oss på post@aboks.no.',
    )
  })

  it('turns the server’s field errors into a field-error outcome', async () => {
    const { impl } = stubFetch(400, {
      ok: false,
      message: FIELD_SUMMARY,
      errors: { email: 'Skriv en gyldig e-postadresse.' },
    })
    const outcome = await submitInquiry(VALUES, {}, impl)

    assert.equal(outcome.kind, 'field-errors')
    assert.deepEqual(
      outcome.kind === 'field-errors' ? outcome.errors : null,
      { email: 'Skriv en gyldig e-postadresse.' },
    )
  })

  it('treats a rate-limit or Turnstile rejection as a plain error with its message', async () => {
    const { impl } = stubFetch(429, {
      ok: false,
      reason: 'rate_limited',
      message: 'For mange forsøk. Prøv igjen om en liten stund.',
    })
    const outcome = await submitInquiry(VALUES, {}, impl)

    assert.equal(outcome.kind, 'error')
    assert.match(outcome.kind === 'error' ? outcome.message : '', /For mange forsøk/)
  })

  it('reports an error, not a success, when the network fails', async () => {
    const impl = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    assert.deepEqual(await submitInquiry(VALUES, {}, impl), { kind: 'error', message: '' })
  })

  it('reports an error when the response is not JSON at all', async () => {
    const impl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      }) as unknown as Response) as unknown as typeof fetch

    assert.equal((await submitInquiry(VALUES, {}, impl)).kind, 'error')
  })
})

describe('submitInquiry — client-side validation', () => {
  it('never reaches the network when a required field is missing', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    const outcome = await submitInquiry({ ...VALUES, company: '' }, {}, impl)

    assert.equal(calls.length, 0)
    assert.equal(outcome.kind, 'field-errors')
    assert.equal(
      outcome.kind === 'field-errors' ? outcome.errors.company : '',
      INQUIRY_MESSAGES.companyRequired,
    )
  })

  it('flags an invalid address before sending anything', async () => {
    const { calls, impl } = stubFetch(200, { ok: true })
    const outcome = await submitInquiry({ ...VALUES, email: 'kari' }, {}, impl)

    assert.equal(calls.length, 0)
    assert.equal(
      outcome.kind === 'field-errors' ? outcome.errors.email : '',
      INQUIRY_MESSAGES.emailInvalid,
    )
  })
})

describe('clearsForm — the form is emptied only once the inquiry is away', () => {
  const cases: [SubmitInquiryOutcome, boolean][] = [
    [{ kind: 'success' }, true],
    [{ kind: 'error', message: 'noe gikk galt' }, false],
    [{ kind: 'field-errors', errors: { email: 'x' }, summary: FIELD_SUMMARY }, false],
  ]

  for (const [outcome, expected] of cases) {
    it(`${expected ? 'clears' : 'preserves'} what was typed on "${outcome.kind}"`, () => {
      assert.equal(clearsForm(outcome), expected)
    })
  }
})

describe('pickFieldErrors', () => {
  it('keeps only keys the form has fields for', () => {
    const errors = pickFieldErrors({
      email: 'Skriv en gyldig e-postadresse.',
      __proto__: 'nope',
      unknownField: 'ignored',
    })
    assert.deepEqual(errors, { email: 'Skriv en gyldig e-postadresse.' })
  })

  it('ignores empty strings and non-strings', () => {
    assert.deepEqual(pickFieldErrors({ email: '', company: 42, message: null }), {})
  })

  it('survives a response with no errors object', () => {
    assert.deepEqual(pickFieldErrors(undefined), {})
    assert.deepEqual(pickFieldErrors('nope'), {})
  })
})
