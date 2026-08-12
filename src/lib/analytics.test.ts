import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The one property these tests exist for: **the browser Pixel and the server event carry the
 * same id.** Everything else Meta does with them depends on it — two ids mean two conversions,
 * and an inflated AddToCart or InitiateCheckout count is worse than none at all.
 *
 * The dataLayer push is the browser half (GTM's Meta tag reads `event_id` from it) and the
 * POST to /api/meta/event is the server half, so both are captured here and compared.
 *
 * A minimal `window` is installed before the module is imported, exactly as the cart store's
 * tests do for `localStorage`.
 */

interface DataLayerEntry {
  event?: string
  event_id?: string | null
  ecommerce?: Record<string, unknown> | null
}

const dataLayer: DataLayerEntry[] = []
const sent: { url: string; body: Record<string, unknown> }[] = []
const storage = new Map<string, string>()

;(globalThis as { window?: unknown }).window = {
  dataLayer,
  location: {
    href: 'https://aboks.no/produkter/aboks?utm_source=meta&fbclid=AbC_123',
    search: '?utm_source=meta&fbclid=AbC_123',
  },
}
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
}
;(globalThis as { fetch?: unknown }).fetch = async (url: string, init: { body: string }) => {
  sent.push({ url, body: JSON.parse(init.body) })
  return { ok: true }
}

const { trackAddToCart, trackBeginCheckout, trackPurchase } = await import('./analytics')

/** The event push, skipping the `{ ecommerce: null }` reset that precedes each one. */
const pushed = (event: string) => dataLayer.find((entry) => entry.event === event)

beforeEach(() => {
  dataLayer.length = 0
  sent.length = 0
  storage.clear()
})

describe('trackAddToCart', () => {
  const params = {
    variantId: '12',
    variantName: 'Salvie',
    productTitle: 'aBoks',
    price: 449,
    quantity: 2,
  }

  it('gives the browser Pixel and the server event one and the same id', () => {
    trackAddToCart(params)

    const browserId = pushed('add_to_cart')?.event_id
    const serverId = sent[0]?.body.eventId

    assert.match(String(browserId), /^addtocart_[a-z0-9]{10,64}$/)
    assert.equal(serverId, browserId)
  })

  it('sends one server event per add, named AddToCart', () => {
    trackAddToCart(params)

    assert.equal(sent.length, 1)
    assert.equal(sent[0]!.url, '/api/meta/event')
    assert.equal(sent[0]!.body.eventName, 'AddToCart')
  })

  it('reports the same value and line the Pixel reports', () => {
    trackAddToCart(params)

    const ecommerce = pushed('add_to_cart')!.ecommerce as {
      currency: string
      value: number
      items: { item_id: string }[]
    }
    assert.equal(ecommerce.currency, 'NOK')
    assert.equal(ecommerce.value, 898)

    assert.equal(sent[0]!.body.value, 898)
    assert.deepEqual(sent[0]!.body.contents, [{ id: '12', quantity: 2, itemPrice: 449 }])
    // The identifier must be the one the Pixel uses, or the two events describe different things.
    assert.equal((sent[0]!.body.contents as { id: string }[])[0]!.id, ecommerce.items[0]!.item_id)
  })

  it('reports the page the add happened on, and the click id if there is one', () => {
    trackAddToCart(params)
    assert.equal(
      sent[0]!.body.eventSourceUrl,
      'https://aboks.no/produkter/aboks?utm_source=meta&fbclid=AbC_123',
    )
    assert.equal(sent[0]!.body.fbclid, 'AbC_123')
  })

  it('mints a fresh id for a second, genuinely separate add', () => {
    trackAddToCart(params)
    trackAddToCart(params)

    assert.equal(sent.length, 2)
    assert.notEqual(sent[0]!.body.eventId, sent[1]!.body.eventId)
  })
})

describe('trackBeginCheckout', () => {
  const items = [
    { variantId: '12', colorName: 'Salvie', price: 449, qty: 2 },
    { productId: '34', colorName: '', price: 65, qty: 1 },
  ]

  it('gives the browser Pixel and the server event one and the same id', () => {
    trackBeginCheckout(items, 963)

    const browserId = pushed('begin_checkout')?.event_id
    assert.match(String(browserId), /^initiatecheckout_[a-z0-9]{10,64}$/)
    assert.equal(sent[0]?.body.eventId, browserId)
    assert.equal(sent[0]?.body.eventName, 'InitiateCheckout')
  })

  it('sends exactly the value the Pixel sends — no second calculation', () => {
    trackBeginCheckout(items, 963)

    const ecommerce = pushed('begin_checkout')!.ecommerce as { value: number; currency: string }
    assert.equal(ecommerce.value, 963)
    assert.equal(ecommerce.currency, 'NOK')
    assert.equal(sent[0]!.body.value, 963)
  })

  it('reports each line with its real quantity, and the total unit count', () => {
    trackBeginCheckout(items, 963)

    assert.deepEqual(sent[0]!.body.contents, [
      { id: '12', quantity: 2, itemPrice: 449 },
      // A product with no variants is identified by its line reference, as everywhere else.
      { id: 'product-34', quantity: 1, itemPrice: 65 },
    ])
    assert.equal(sent[0]!.body.numItems, 3)
  })

  it('sends one server event per click', () => {
    trackBeginCheckout(items, 963)
    assert.equal(sent.length, 1)
  })
})

describe('trackPurchase', () => {
  const params = {
    kustomOrderId: '7f3c1a90',
    transactionId: 'AB-000123',
    value: 748,
    shipping: 0,
    items: [],
  }

  it('still derives its event id from the Kustom order id', () => {
    trackPurchase(params)
    assert.equal(pushed('purchase')?.event_id, 'purchase_7f3c1a90')
  })

  it('does not go through the browser event route — the webhook owns the server Purchase', () => {
    trackPurchase(params)
    assert.equal(sent.length, 0)
  })

  it('still fires only once per order, however many times the page renders', () => {
    trackPurchase(params)
    trackPurchase(params)
    assert.equal(dataLayer.filter((entry) => entry.event === 'purchase').length, 1)
  })
})

describe('dataLayer hygiene', () => {
  it('clears event_id before each event, so no tag inherits the previous one', () => {
    trackAddToCart({
      variantId: '12',
      variantName: 'Salvie',
      productTitle: 'aBoks',
      price: 449,
      quantity: 1,
    })

    const reset = dataLayer[0]!
    assert.equal(reset.event, undefined)
    assert.equal(reset.ecommerce, null)
    assert.equal(reset.event_id, null)
  })
})
