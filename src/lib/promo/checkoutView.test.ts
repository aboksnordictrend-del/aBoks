import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CheckoutResult, CheckoutTotals } from './checkoutFlow'
import {
  checkoutStateFromResult,
  displayTotalsFor,
  shouldRenderWidget,
  toCheckoutRequest,
} from './checkoutView'

const SERVER_TOTALS: CheckoutTotals = { subtotal: 449, discount: 44.9, shipping: 69, total: 473.1 }
const LOCAL_TOTALS: CheckoutTotals = { subtotal: 449, discount: 0, shipping: 69, total: 518 }

const okResult: CheckoutResult = {
  ok: true,
  kustomOrderId: 'kustom-abc-123',
  htmlSnippet: '<div id="kustom"></div>',
  totals: SERVER_TOTALS,
  lines: [
    { variantId: '10', displayName: 'aBoks Vegg – Mørk blå', quantity: 1, lineTotal: 449, discountAmount: 44.9 },
  ],
  promo: { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, discountAmount: 44.9 },
}

describe('toCheckoutRequest', () => {
  it('sends identifiers, quantities and the code — nothing else', () => {
    const items = [
      {
        variantId: '10',
        qty: 2,
        price: 449,
        productSlug: 'aboks',
        colorName: 'Mørk blå',
        colorHex: '#2b3a5b',
        colorImage: '/blue.jpg',
      },
      { variantId: '20', qty: 1, price: 299, productSlug: 'mini', colorName: 'Creme', colorHex: '#eee', colorImage: '/c.jpg' },
    ]

    const body = toCheckoutRequest(items, 'WELCOME10')

    assert.deepEqual(body, {
      items: [
        { variantId: '10', quantity: 2 },
        { variantId: '20', quantity: 1 },
      ],
      promoCode: 'WELCOME10',
    })

    const serialised = JSON.stringify(body)
    for (const leak of ['449', '299', 'price', 'colorName', 'Mørk blå', 'colorImage', 'aboks']) {
      assert.ok(!serialised.includes(leak), `request must not contain ${leak}`)
    }
    assert.deepEqual(Object.keys(body.items[0]).sort(), ['quantity', 'variantId'])
  })

  it('omits the promo code entirely when there is none', () => {
    const items = [{ variantId: '10', qty: 1 }]
    assert.deepEqual(toCheckoutRequest(items, null), { items: [{ variantId: '10', quantity: 1 }] })
    assert.deepEqual(toCheckoutRequest(items, '   '), { items: [{ variantId: '10', quantity: 1 }] })
    assert.equal(toCheckoutRequest(items, undefined).promoCode, undefined)
  })

  it('trims the code', () => {
    assert.equal(toCheckoutRequest([{ variantId: '10', qty: 1 }], '  WELCOME10 ').promoCode, 'WELCOME10')
  })

  it('never sends a discount amount, only the code', () => {
    const body = toCheckoutRequest([{ variantId: '10', qty: 1 }], 'WELCOME10')
    assert.ok(!JSON.stringify(body).includes('discount'))
  })
})

describe('checkoutStateFromResult', () => {
  it('maps a successful checkout to the ready state', () => {
    const state = checkoutStateFromResult(okResult)
    assert.equal(state.phase, 'ready')
    if (state.phase !== 'ready') throw new Error('unreachable')
    assert.equal(state.kustomOrderId, 'kustom-abc-123')
    assert.deepEqual(state.totals, SERVER_TOTALS)
    assert.equal(state.promoCode, 'WELCOME10')
    assert.equal(state.lines.length, 1)
  })

  it('maps a rejected promo to its own state, carrying the undiscounted totals', () => {
    const state = checkoutStateFromResult({
      ok: false,
      type: 'promo_invalid',
      reason: 'expired',
      message: 'Denne rabattkoden er utløpt.',
      trustedTotals: LOCAL_TOTALS,
    })
    assert.equal(state.phase, 'promo_rejected')
    if (state.phase !== 'promo_rejected') throw new Error('unreachable')
    assert.equal(state.message, 'Denne rabattkoden er utløpt.')
    assert.deepEqual(state.totals, LOCAL_TOTALS)
  })

  it('maps a stale cart to its own state', () => {
    const state = checkoutStateFromResult({
      ok: false,
      type: 'cart_invalid',
      reason: 'product_unavailable',
      message: 'Et produkt i handlekurven er ikke tilgjengelig lenger.',
    })
    assert.equal(state.phase, 'cart_invalid')
  })

  it('maps every retryable failure to the generic error state', () => {
    const retryable: CheckoutResult[] = [
      { ok: false, type: 'promo_unavailable', message: 'a' },
      { ok: false, type: 'payment_unavailable', message: 'b' },
      { ok: false, type: 'server_error', message: 'c' },
    ]
    for (const result of retryable) {
      assert.equal(checkoutStateFromResult(result).phase, 'error')
    }
  })
})

describe('shouldRenderWidget', () => {
  it('allows the widget only after a successful checkout', () => {
    assert.equal(shouldRenderWidget(checkoutStateFromResult(okResult)), true)
  })

  it('blocks the widget for a rejected promo code', () => {
    const state = checkoutStateFromResult({
      ok: false,
      type: 'promo_invalid',
      reason: 'expired',
      message: 'Denne rabattkoden er utløpt.',
      trustedTotals: LOCAL_TOTALS,
    })
    assert.equal(shouldRenderWidget(state), false)
  })

  it('blocks the widget for a stale cart and while loading', () => {
    assert.equal(shouldRenderWidget({ phase: 'loading' }), false)
    assert.equal(shouldRenderWidget({ phase: 'cart_invalid', message: 'x' }), false)
    assert.equal(shouldRenderWidget({ phase: 'error', message: 'x' }), false)
  })
})

describe('displayTotalsFor', () => {
  it('shows the cart’s own figures only while the request is in flight', () => {
    assert.deepEqual(displayTotalsFor({ phase: 'loading' }, LOCAL_TOTALS), LOCAL_TOTALS)
  })

  it('switches to the server figures as soon as checkout succeeds', () => {
    const state = checkoutStateFromResult(okResult)
    assert.deepEqual(displayTotalsFor(state, LOCAL_TOTALS), SERVER_TOTALS)
    assert.equal(displayTotalsFor(state, LOCAL_TOTALS).total, 473.1)
  })

  it('uses the server figures for a rejected promo too, so the price shown is the real one', () => {
    const state = checkoutStateFromResult({
      ok: false,
      type: 'promo_invalid',
      reason: 'expired',
      message: 'x',
      trustedTotals: { subtotal: 549, discount: 0, shipping: 69, total: 618 },
    })
    assert.equal(displayTotalsFor(state, LOCAL_TOTALS).total, 618)
  })

  it('an ordinary cart with no promo shows a zero discount and is unchanged', () => {
    const noPromo = checkoutStateFromResult({ ...okResult, totals: LOCAL_TOTALS, promo: null })
    const totals = displayTotalsFor(noPromo, LOCAL_TOTALS)
    assert.equal(totals.discount, 0)
    assert.equal(totals.total, 518)
  })
})

describe('toCheckoutRequest — a product with no variants', () => {
  it('sends its product id instead of a variant id', () => {
    const request = toCheckoutRequest(
      [{ productId: '7', qty: 2 } as never],
      null,
    )
    assert.deepEqual(request.items, [{ productId: '7', quantity: 2 }])
  })

  it('sends one identifier per line in a mixed cart, variant first', () => {
    const request = toCheckoutRequest(
      [
        { variantId: '10', qty: 1 } as never,
        { productId: '7', qty: 2 } as never,
      ],
      null,
    )
    assert.deepEqual(request.items, [
      { variantId: '10', quantity: 1 },
      { productId: '7', quantity: 2 },
    ])
  })

  it('never sends both identifiers for one line', () => {
    const request = toCheckoutRequest([{ variantId: '10', productId: '1', qty: 1 } as never], null)
    assert.deepEqual(request.items, [{ variantId: '10', quantity: 1 }])
  })

  it('drops a line that cannot be identified rather than failing the whole checkout', () => {
    const request = toCheckoutRequest([{ qty: 1 } as never], null)
    assert.deepEqual(request.items, [])
  })
})
