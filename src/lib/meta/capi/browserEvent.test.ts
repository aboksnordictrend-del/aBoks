import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// The dispatcher only runs in a browser. A bare object is enough — it reads `window.location`
// through its own helpers, and those are exercised separately below.
;(globalThis as { window?: unknown }).window = { location: { href: '', search: '' } }

const { browserCapiEventId, sendBrowserCapiEvent, META_BROWSER_EVENT_ENDPOINT } = await import(
  './browserEvent'
)

describe('browserCapiEventId', () => {
  it('prefixes the id with the event it belongs to', () => {
    assert.match(browserCapiEventId('AddToCart'), /^addtocart_[a-z0-9]{10,64}$/)
    assert.match(browserCapiEventId('InitiateCheckout'), /^initiatecheckout_[a-z0-9]{10,64}$/)
  })

  it('mints a different id for every action', () => {
    const ids = new Set(Array.from({ length: 200 }, () => browserCapiEventId('AddToCart')))
    assert.equal(ids.size, 200)
  })

  it('falls back to a well-formed id when randomUUID is unavailable', () => {
    // Safari < 15.4 and any non-secure context. The endpoint's validation must still accept it.
    const id = browserCapiEventId('AddToCart', () =>
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`,
    )
    assert.match(id, /^addtocart_[a-z0-9]{10,64}$/)
  })
})

describe('sendBrowserCapiEvent', () => {
  const request = {
    eventName: 'AddToCart' as const,
    eventId: 'addtocart_abc1234567',
    value: 449,
    contents: [{ id: '12', quantity: 1, itemPrice: 449 }],
  }

  it('POSTs the event to our own route, never to Meta', () => {
    let seenUrl = ''
    let seenInit: Record<string, unknown> | undefined

    sendBrowserCapiEvent(request, {
      fetchImpl: async (url, init) => {
        seenUrl = url
        seenInit = init
        return { ok: true }
      },
    })

    assert.equal(seenUrl, META_BROWSER_EVENT_ENDPOINT)
    assert.equal(seenUrl.startsWith('/'), true)
    assert.equal(seenInit?.method, 'POST')
    // Survives the navigation that the InitiateCheckout click itself triggers.
    assert.equal(seenInit?.keepalive, true)
    assert.equal(seenInit?.credentials, 'same-origin')
    assert.deepEqual(JSON.parse(seenInit?.body as string), request)
  })

  it('never throws when the request fails', () => {
    assert.doesNotThrow(() =>
      sendBrowserCapiEvent(request, {
        fetchImpl: async () => {
          throw new Error('network down')
        },
      }),
    )
  })

  it('never throws when fetch itself throws synchronously', () => {
    assert.doesNotThrow(() =>
      sendBrowserCapiEvent(request, {
        fetchImpl: () => {
          throw new TypeError('keepalive not supported')
        },
      }),
    )
  })

  it('leaves no unhandled rejection behind', async () => {
    let unhandled: unknown = null
    const onUnhandled = (err: unknown) => {
      unhandled = err
    }
    process.on('unhandledRejection', onUnhandled)

    sendBrowserCapiEvent(request, { fetchImpl: async () => Promise.reject(new Error('502')) })
    await new Promise((resolve) => setTimeout(resolve, 20))

    process.off('unhandledRejection', onUnhandled)
    assert.equal(unhandled, null)
  })
})
