import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MetaError } from '../errors'
import type { MetaCapiConfig } from './config'
import {
  buildBrowserEventPayload,
  handleBrowserCapiEvent,
  parseBrowserCapiRequest,
  sanitizeEventSourceUrl,
  type BrowserEventEndpointDeps,
  type MetaBrowserEventPayload,
} from './browserEndpoint'

const config: MetaCapiConfig = {
  pixelId: '1234567890',
  accessToken: 'capi-token',
  graphApiVersion: 'v24.0',
  eventsUrl: 'https://graph.facebook.com/v24.0/1234567890/events',
}

const addToCartBody = {
  eventName: 'AddToCart',
  eventId: 'addtocart_9f2c1a90bb',
  value: 449,
  contents: [{ id: '12', quantity: 1, itemPrice: 449 }],
}

const checkoutBody = {
  eventName: 'InitiateCheckout',
  eventId: 'initiatecheckout_9f2c1a90bb',
  value: 963,
  contents: [
    { id: '12', quantity: 2, itemPrice: 449 },
    { id: 'product-34', quantity: 1, itemPrice: 65 },
  ],
  numItems: 3,
}

/** Records what was handed to Meta, and answers however the test asks it to. */
function recordingSend(behaviour: 'ok' | Error = 'ok') {
  const calls: MetaBrowserEventPayload[] = []
  const send = async (_cfg: MetaCapiConfig, payload: MetaBrowserEventPayload) => {
    calls.push(payload)
    if (behaviour !== 'ok') throw behaviour
    return { eventsReceived: 1, fbTraceId: 'AbC' }
  }
  return { calls, send }
}

function deps(overrides: Partial<BrowserEventEndpointDeps> = {}): BrowserEventEndpointDeps & {
  lines: Record<string, unknown>[]
} {
  const lines: Record<string, unknown>[] = []
  return {
    config,
    rateLimit: async () => ({ ok: true, remaining: 59, resetMs: 1000 }),
    originAllowed: () => true,
    log: (fields) => lines.push(fields),
    now: () => 1_785_000_000_000,
    lines,
    ...overrides,
  }
}

const input = (body: unknown, extra: Record<string, string> = {}) => ({
  origin: 'https://aboks.no',
  ip: '203.0.113.7',
  rawBody: typeof body === 'string' ? body : JSON.stringify(body),
  getCookie: (name: string) => extra[`cookie:${name}`] ?? null,
  getHeader: (name: string) => extra[name] ?? null,
})

/* ------------------------------ parsing ------------------------------ */

describe('parseBrowserCapiRequest', () => {
  it('accepts the two allowed events', () => {
    for (const body of [addToCartBody, checkoutBody]) {
      const parsed = parseBrowserCapiRequest(body)
      assert.equal(parsed.ok, true)
    }
  })

  it('refuses any event name outside the allowlist — including Purchase', () => {
    for (const eventName of ['Purchase', 'Lead', 'CompleteRegistration', 'addtocart', '']) {
      const parsed = parseBrowserCapiRequest({ ...addToCartBody, eventName })
      assert.equal(parsed.ok, false)
      assert.equal(parsed.ok === false && parsed.reason, 'unknown_event')
    }
  })

  it('refuses an event id that does not belong to the event', () => {
    const cases = [
      'purchase_7f3c1a90',
      'initiatecheckout_9f2c1a90bb',
      'addtocart_short',
      'addtocart_UPPERCASE00',
      'addtocart_../../etc',
      '',
    ]
    for (const eventId of cases) {
      const parsed = parseBrowserCapiRequest({ ...addToCartBody, eventId })
      assert.equal(parsed.ok, false, eventId)
      assert.equal(parsed.ok === false && parsed.reason, 'event_id_mismatch')
    }
  })

  it('refuses a value that is not usable money', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, 2_000_000, '449', null]) {
      const parsed = parseBrowserCapiRequest({ ...addToCartBody, value })
      assert.equal(parsed.ok, false)
      assert.equal(parsed.ok === false && parsed.reason, 'invalid_value')
    }
  })

  it('refuses malformed contents', () => {
    const bad = [
      { contents: 'nope' },
      { contents: [{ id: '', quantity: 1, itemPrice: 449 }] },
      { contents: [{ id: '12', quantity: 0, itemPrice: 449 }] },
      { contents: [{ id: '12', quantity: 1.5, itemPrice: 449 }] },
      { contents: [{ id: '12', quantity: 1000, itemPrice: 449 }] },
      { contents: [{ id: '12', quantity: 1, itemPrice: -5 }] },
      { contents: Array.from({ length: 51 }, () => ({ id: '12', quantity: 1, itemPrice: 1 })) },
    ]
    for (const patch of bad) {
      const parsed = parseBrowserCapiRequest({ ...addToCartBody, ...patch })
      assert.equal(parsed.ok, false)
      assert.equal(parsed.ok === false && parsed.reason, 'invalid_contents')
    }
  })

  it('keeps only the fields the endpoint understands', () => {
    const parsed = parseBrowserCapiRequest({
      ...addToCartBody,
      // Everything a hostile client might hope to control.
      accessToken: 'stolen',
      pixelId: '999',
      test_event_code: 'TEST99999',
      userData: { em: 'plaintext@example.no' },
      email: 'ola@example.no',
      eventTime: 1,
      action_source: 'app',
      currency: 'USD',
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.deepEqual(Object.keys(parsed.value).sort(), [
      'contents',
      'eventId',
      'eventName',
      'value',
    ])
  })
})

describe('sanitizeEventSourceUrl', () => {
  const allowed = new Set(['https://aboks.no'])

  it('keeps origin and path from a trusted URL', () => {
    assert.equal(
      sanitizeEventSourceUrl('https://aboks.no/produkter/aboks', allowed),
      'https://aboks.no/produkter/aboks',
    )
  })

  it('drops the query string and fragment, where personal data would hide', () => {
    assert.equal(
      sanitizeEventSourceUrl('https://aboks.no/handlekurv?email=ola%40example.no#top', allowed),
      'https://aboks.no/handlekurv',
    )
  })

  it('drops a URL from anywhere but this shop', () => {
    for (const url of [
      'https://evil.example/aboks',
      'javascript:alert(1)',
      'not a url',
      '',
      `https://aboks.no/${'x'.repeat(3000)}`,
    ]) {
      assert.equal(sanitizeEventSourceUrl(url, allowed), undefined)
    }
  })
})

/* ------------------------------ payload ------------------------------ */

describe('buildBrowserEventPayload', () => {
  it('reports NOK, the value, the contents and the ids Meta expects', () => {
    const payload = buildBrowserEventPayload({
      eventName: 'InitiateCheckout',
      eventId: 'initiatecheckout_9f2c1a90bb',
      value: 963,
      contents: [
        { id: '12', quantity: 2, itemPrice: 449 },
        { id: 'product-34', quantity: 1, itemPrice: 65 },
      ],
      numItems: 3,
      eventSourceUrl: 'https://aboks.no/handlekurv',
      eventTimeMs: 1_785_000_000_000,
    })

    const event = payload.data[0]
    assert.equal(event.event_name, 'InitiateCheckout')
    assert.equal(event.event_id, 'initiatecheckout_9f2c1a90bb')
    assert.equal(event.event_time, 1_785_000_000)
    assert.equal(event.action_source, 'website')
    assert.equal(event.event_source_url, 'https://aboks.no/handlekurv')
    assert.equal(event.custom_data.currency, 'NOK')
    assert.equal(event.custom_data.value, 963)
    assert.equal(event.custom_data.content_type, 'product')
    assert.deepEqual(event.custom_data.content_ids, ['12', 'product-34'])
    assert.deepEqual(event.custom_data.contents, [
      { id: '12', quantity: 2, item_price: 449 },
      { id: 'product-34', quantity: 1, item_price: 65 },
    ])
    assert.equal(event.custom_data.num_items, 3)
  })

  it('carries fbp, fbc, IP and user agent unhashed, and no email or phone', () => {
    const payload = buildBrowserEventPayload({
      eventName: 'AddToCart',
      eventId: 'addtocart_9f2c1a90bb',
      value: 449,
      contents: [{ id: '12', quantity: 1, itemPrice: 449 }],
      attribution: {
        fbp: 'fb.1.1700000000000.1234567890',
        fbc: 'fb.1.1700000000000.AbCdEf',
        clientIpAddress: '203.0.113.7',
        clientUserAgent: 'Mozilla/5.0',
      },
    })

    const userData = payload.data[0].user_data
    assert.equal(userData.fbp, 'fb.1.1700000000000.1234567890')
    assert.equal(userData.fbc, 'fb.1.1700000000000.AbCdEf')
    assert.equal(userData.client_ip_address, '203.0.113.7')
    assert.equal(userData.client_user_agent, 'Mozilla/5.0')
    assert.equal(userData.em, undefined)
    assert.equal(userData.ph, undefined)
  })

  it('omits contents entirely rather than claiming an empty cart', () => {
    const payload = buildBrowserEventPayload({
      eventName: 'InitiateCheckout',
      eventId: 'initiatecheckout_9f2c1a90bb',
      value: 0,
      contents: [],
    })
    assert.equal(payload.data[0].custom_data.contents, undefined)
    assert.equal(payload.data[0].custom_data.content_ids, undefined)
  })

  it('only carries a test event code when one was configured', () => {
    const withoutCode = buildBrowserEventPayload({
      eventName: 'AddToCart',
      eventId: 'addtocart_9f2c1a90bb',
      value: 449,
      contents: [],
    })
    assert.equal('test_event_code' in withoutCode, false)

    const withCode = buildBrowserEventPayload({
      eventName: 'AddToCart',
      eventId: 'addtocart_9f2c1a90bb',
      value: 449,
      contents: [],
      testEventCode: 'TEST12345',
    })
    assert.equal(withCode.test_event_code, 'TEST12345')
  })
})

/* ------------------------------ handler ------------------------------ */

describe('handleBrowserCapiEvent', () => {
  it('sends the event the browser reported, with the browser’s own event id', async () => {
    const { calls, send } = recordingSend()
    const result = await handleBrowserCapiEvent(deps({ send }), input(addToCartBody))

    assert.equal(result.status, 202)
    assert.equal(result.outcome, 'sent')
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.data[0].event_id, 'addtocart_9f2c1a90bb')
    assert.equal(calls[0]!.data[0].event_name, 'AddToCart')
    assert.equal(calls[0]!.data[0].custom_data.value, 449)
  })

  it('reads _fbp, _fbc, IP and User-Agent off the customer’s own request', async () => {
    const { calls, send } = recordingSend()
    await handleBrowserCapiEvent(
      deps({ send }),
      input(addToCartBody, {
        'cookie:_fbp': 'fb.1.1700000000000.1234567890',
        'cookie:_fbc': 'fb.1.1700000000000.AbCdEf',
        'x-vercel-forwarded-for': '203.0.113.7',
        'user-agent': 'Mozilla/5.0 (Macintosh)',
      }),
    )

    const userData = calls[0]!.data[0].user_data
    assert.equal(userData.fbp, 'fb.1.1700000000000.1234567890')
    assert.equal(userData.fbc, 'fb.1.1700000000000.AbCdEf')
    assert.equal(userData.client_ip_address, '203.0.113.7')
    assert.equal(userData.client_user_agent, 'Mozilla/5.0 (Macintosh)')
  })

  it('sends no fbc at all when there is no cookie and no click id', async () => {
    const { calls, send } = recordingSend()
    await handleBrowserCapiEvent(deps({ send }), input(addToCartBody))
    assert.equal(calls[0]!.data[0].user_data.fbc, undefined)
    assert.equal(calls[0]!.data[0].user_data.fbp, undefined)
  })

  it('answers 202 when Meta refuses, so the customer’s action is never affected', async () => {
    const { send } = recordingSend(
      new MetaError('nope', { code: 100, message: 'Invalid parameter' }, 400),
    )
    const d = deps({ send })
    const result = await handleBrowserCapiEvent(d, input(addToCartBody))

    assert.equal(result.status, 202)
    assert.equal(result.outcome, 'send_failed')
    assert.equal(result.body.ok, true)

    const line = d.lines.find((l) => l.event === 'send_failed')!
    assert.equal(line.httpStatus, 400)
    assert.equal(line.metaCode, 100)
  })

  it('answers 202 when Meta times out', async () => {
    const { send } = recordingSend(new MetaError('Tidsavbrudd mot Meta Conversions API.'))
    const result = await handleBrowserCapiEvent(deps({ send }), input(addToCartBody))
    assert.equal(result.status, 202)
    assert.equal(result.outcome, 'send_failed')
  })

  it('sends nothing, and still answers 202, when the integration is not configured', async () => {
    const { calls, send } = recordingSend()
    const result = await handleBrowserCapiEvent(deps({ config: null, send }), input(addToCartBody))
    assert.equal(result.status, 202)
    assert.equal(result.outcome, 'not_configured')
    assert.equal(calls.length, 0)
  })

  it('refuses an untrusted origin without calling Meta', async () => {
    const { calls, send } = recordingSend()
    const result = await handleBrowserCapiEvent(
      deps({ send, originAllowed: () => false }),
      input(addToCartBody),
    )
    assert.equal(result.status, 403)
    assert.equal(calls.length, 0)
  })

  it('refuses an arbitrary event name without calling Meta', async () => {
    const { calls, send } = recordingSend()
    const result = await handleBrowserCapiEvent(
      deps({ send }),
      input({ ...addToCartBody, eventName: 'Purchase', eventId: 'purchase_7f3c1a90' }),
    )
    assert.equal(result.status, 400)
    assert.equal(result.outcome, 'rejected')
    assert.equal(calls.length, 0)
  })

  it('refuses an oversized or unparseable body', async () => {
    const { calls, send } = recordingSend()

    const huge = await handleBrowserCapiEvent(deps({ send }), input('x'.repeat(9000)))
    assert.equal(huge.status, 400)

    const broken = await handleBrowserCapiEvent(deps({ send }), input('{ not json'))
    assert.equal(broken.status, 400)

    assert.equal(calls.length, 0)
  })

  it('rate limits, without calling Meta', async () => {
    const { calls, send } = recordingSend()
    const result = await handleBrowserCapiEvent(
      deps({ send, rateLimit: async () => ({ ok: false, remaining: 0, resetMs: 60_000 }) }),
      input(addToCartBody),
    )
    assert.equal(result.status, 429)
    assert.equal(calls.length, 0)
  })

  it('never puts the access token, or any identifier, in the response or the log', async () => {
    const { send } = recordingSend()
    const d = deps({ send })
    const result = await handleBrowserCapiEvent(
      d,
      input(addToCartBody, {
        'cookie:_fbp': 'fb.1.1700000000000.1234567890',
        'x-vercel-forwarded-for': '203.0.113.7',
        'user-agent': 'Mozilla/5.0',
      }),
    )

    const serialized = JSON.stringify({ body: result.body, lines: d.lines })
    for (const secret of ['capi-token', 'fb.1.1700000000000', '203.0.113.7', 'Mozilla/5.0']) {
      assert.equal(serialized.includes(secret), false, secret)
    }
    assert.deepEqual(result.body, { ok: true })
  })

  it('uses the server’s clock, not anything the client sent', async () => {
    const { calls, send } = recordingSend()
    await handleBrowserCapiEvent(
      deps({ send }),
      input({ ...addToCartBody, event_time: 1, eventTime: 1 }),
    )
    assert.equal(calls[0]!.data[0].event_time, 1_785_000_000)
  })
})
