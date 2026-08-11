import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSummaryRows,
  buildValidationRequest,
  cartSignature,
  initialPromoState,
  interpretResponse,
  networkOutcome,
  promoCheckKey,
  promoReducer,
  restoredPromoState,
  shouldSubmitOnKey,
  type PromoEvent,
  type PromoState,
  type PromoTotals,
} from './cartPromo'

/** A full success body as the endpoint returns it. */
const SUCCESS_BODY = {
  valid: true,
  code: 'WELCOME10',
  discountType: 'percentage',
  discountValue: 10,
  eligibleSubtotal: 449,
  discountAmount: 44.9,
  subtotalBeforeDiscount: 449,
  subtotalAfterDiscount: 404.1,
  shipping: 69,
  totalBeforeDiscount: 518,
  totalAfterDiscount: 473.1,
  oere: {
    eligibleSubtotal: 44_900,
    discountAmount: 4_490,
    subtotalBeforeDiscount: 44_900,
    subtotalAfterDiscount: 40_410,
    shipping: 6_900,
    totalBeforeDiscount: 51_800,
    totalAfterDiscount: 47_310,
  },
}

const TOTALS: PromoTotals = {
  code: 'WELCOME10',
  discountType: 'percentage',
  discountValue: 10,
  eligibleSubtotal: 449,
  discountAmount: 44.9,
  subtotalBeforeDiscount: 449,
  subtotalAfterDiscount: 404.1,
  shipping: 69,
  totalBeforeDiscount: 518,
  totalAfterDiscount: 473.1,
}

/** Runs a sequence of events from a starting state. */
const reduceAll = (start: PromoState, ...events: PromoEvent[]): PromoState =>
  events.reduce(promoReducer, start)

/* ------------------------------ request payload ------------------------------ */

describe('buildValidationRequest', () => {
  it('sends identifiers and quantities only', () => {
    // A full store CartItem, with everything the client knows about the product.
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
      {
        variantId: '20',
        qty: 1,
        price: 299,
        productSlug: 'aboks-mini',
        colorName: 'Creme',
        colorHex: '#e8e0cd',
        colorImage: '/creme.jpg',
      },
    ]

    const body = buildValidationRequest('  welcome10 ', items)

    assert.deepEqual(body, {
      code: 'welcome10',
      items: [
        { variantId: '10', quantity: 2 },
        { variantId: '20', quantity: 1 },
      ],
    })

    // Nothing price-shaped survives.
    const serialised = JSON.stringify(body)
    for (const leak of ['449', '299', 'price', 'colorName', 'Mørk blå', 'colorImage', 'slug']) {
      assert.ok(!serialised.includes(leak), `payload must not contain ${leak}`)
    }
  })

  it('includes an email only when one is genuinely available', () => {
    const items = [{ variantId: '10', qty: 1 }]
    assert.equal(buildValidationRequest('X', items).email, undefined)
    assert.equal(buildValidationRequest('X', items, '   ').email, undefined)
    assert.equal(buildValidationRequest('X', items, ' Kari@x.no ').email, 'Kari@x.no')
  })
})

describe('cartSignature', () => {
  it('changes with quantity and with membership, but not with order', () => {
    const a = [
      { variantId: '10', qty: 1 },
      { variantId: '20', qty: 2 },
    ]
    const reordered = [
      { variantId: '20', qty: 2 },
      { variantId: '10', qty: 1 },
    ]
    const moreQty = [
      { variantId: '10', qty: 2 },
      { variantId: '20', qty: 2 },
    ]
    const removed = [{ variantId: '10', qty: 1 }]

    assert.equal(cartSignature(a), cartSignature(reordered))
    assert.notEqual(cartSignature(a), cartSignature(moreQty))
    assert.notEqual(cartSignature(a), cartSignature(removed))
    assert.equal(cartSignature([]), '')
  })
})

/* ------------------------------ response interpretation ------------------------------ */

describe('interpretResponse', () => {
  it('reads a valid result as trusted totals', () => {
    const outcome = interpretResponse(200, SUCCESS_BODY)
    assert.equal(outcome.kind, 'valid')
    if (outcome.kind !== 'valid') throw new Error('unreachable')
    assert.deepEqual(outcome.totals, TOTALS)
  })

  it('copies the server figures through without recomputing them', () => {
    // A deliberately inconsistent body: 10 % of 449 is not 300. The client must show what
    // the server said, because the server is the only thing that gets to decide.
    const odd = { ...SUCCESS_BODY, discountAmount: 300, subtotalAfterDiscount: 149, totalAfterDiscount: 218 }
    const outcome = interpretResponse(200, odd)
    assert.equal(outcome.kind, 'valid')
    if (outcome.kind !== 'valid') throw new Error('unreachable')
    assert.equal(outcome.totals.discountAmount, 300)
    assert.equal(outcome.totals.totalAfterDiscount, 218)
  })

  it('treats a business failure as final, showing the validator message', () => {
    const outcome = interpretResponse(200, {
      valid: false,
      reason: 'expired',
      message: 'Denne rabattkoden er utløpt.',
    })
    assert.equal(outcome.kind, 'invalid')
    if (outcome.kind !== 'invalid') throw new Error('unreachable')
    assert.equal(outcome.message, 'Denne rabattkoden er utløpt.')
  })

  it('treats a stale-cart conflict as final too', () => {
    const outcome = interpretResponse(409, {
      valid: false,
      reason: 'product_unavailable',
      message: 'Et produkt i handlekurven er ikke tilgjengelig lenger.',
    })
    assert.equal(outcome.kind, 'invalid')
  })

  it('treats a malformed request answer as final', () => {
    const outcome = interpretResponse(400, {
      valid: false,
      reason: 'invalid_request',
      message: 'Ugyldig forespørsel.',
    })
    assert.equal(outcome.kind, 'invalid')
  })

  it('treats 429 as unverified and reports the wait', () => {
    const outcome = interpretResponse(429, {
      valid: false,
      reason: 'rate_limited',
      message: 'For mange forsøk.',
      retryAfter: 90,
    })
    assert.equal(outcome.kind, 'unverified')
    if (outcome.kind !== 'unverified') throw new Error('unreachable')
    assert.equal(outcome.retryAfter, 90)
    assert.match(outcome.message, /90 sekunder/)
  })

  it('treats 429 without Retry-After as unverified with a generic wait message', () => {
    const outcome = interpretResponse(429, { valid: false, reason: 'rate_limited', message: 'x' })
    assert.equal(outcome.kind, 'unverified')
    if (outcome.kind !== 'unverified') throw new Error('unreachable')
    assert.match(outcome.message, /For mange forsøk/)
  })

  it('treats 503, 500 and 403 as unverified — never as the code being wrong', () => {
    for (const status of [500, 502, 503, 403]) {
      const outcome = interpretResponse(status, { valid: false, reason: 'server_error', message: 'x' })
      assert.equal(outcome.kind, 'unverified', `status ${status}`)
    }
  })

  it('never shows a raw server error', () => {
    const outcome = interpretResponse(500, {
      error: 'PostgresError: relation "promo_codes" does not exist',
      stack: 'at Object.<anonymous>',
    })
    assert.equal(outcome.kind, 'unverified')
    if (outcome.kind !== 'unverified') throw new Error('unreachable')
    assert.ok(!outcome.message.includes('promo_codes'))
    assert.ok(!outcome.message.includes('Postgres'))
  })

  it('treats an unexpected or incomplete body as unverified', () => {
    const cases: unknown[] = [
      null,
      'html error page',
      [],
      { valid: true }, // no figures
      { ...SUCCESS_BODY, discountAmount: 'gratis' },
      { ...SUCCESS_BODY, totalAfterDiscount: null },
      { ...SUCCESS_BODY, discountType: 'bogus' },
      { ...SUCCESS_BODY, code: 42 },
      { something: 'else' },
    ]
    for (const body of cases) {
      assert.equal(
        interpretResponse(200, body).kind,
        'unverified',
        `should not trust ${JSON.stringify(body)}`,
      )
    }
  })

  it('falls back to a fixed message when the server sends none', () => {
    const outcome = interpretResponse(200, { valid: false, reason: 'not_found' })
    assert.equal(outcome.kind, 'invalid')
    if (outcome.kind !== 'invalid') throw new Error('unreachable')
    assert.ok(outcome.message.length > 0)
  })

  it('reports a network failure as unverified', () => {
    assert.equal(networkOutcome().kind, 'unverified')
  })
})

/* ------------------------------ state machine ------------------------------ */

describe('promoReducer', () => {
  it('starts idle, and restores a persisted code without any totals', () => {
    assert.deepEqual(initialPromoState, {
      code: null,
      status: 'idle',
      totals: null,
      message: null,
      requestId: 0,
    })
    const restored = restoredPromoState('WELCOME10')
    assert.equal(restored.code, 'WELCOME10')
    assert.equal(restored.status, 'idle')
    assert.equal(restored.totals, null, 'a restored code carries no trusted discount')
    assert.deepEqual(restoredPromoState(null), initialPromoState)
  })

  it('applies a valid code and exposes the server totals', () => {
    const state = reduceAll(
      initialPromoState,
      { type: 'submit', code: 'welcome10', requestId: 1 },
      { type: 'result', requestId: 1, outcome: { kind: 'valid', totals: TOTALS } },
    )
    assert.equal(state.status, 'applied')
    assert.equal(state.code, 'WELCOME10') // the server's normalised form
    assert.deepEqual(state.totals, TOTALS)
    assert.equal(state.message, null)
  })

  it('shows the Norwegian message and drops the code on an invalid result', () => {
    const state = reduceAll(
      initialPromoState,
      { type: 'submit', code: 'GAMMEL', requestId: 1 },
      {
        type: 'result',
        requestId: 1,
        outcome: { kind: 'invalid', message: 'Denne rabattkoden er utløpt.' },
      },
    )
    assert.equal(state.status, 'error')
    assert.equal(state.code, null)
    assert.equal(state.totals, null)
    assert.equal(state.message, 'Denne rabattkoden er utløpt.')
  })

  it('blocks a duplicate submission while a check is in flight', () => {
    const checking = promoReducer(initialPromoState, { type: 'submit', code: 'A', requestId: 1 })
    const again = promoReducer(checking, { type: 'submit', code: 'B', requestId: 2 })
    assert.equal(again, checking, 'the second submit is ignored entirely')
    assert.equal(again.requestId, 1)
  })

  it('ignores a submission with nothing typed', () => {
    assert.equal(promoReducer(initialPromoState, { type: 'submit', code: '   ', requestId: 1 }), initialPromoState)
  })

  it('removes an applied code and its totals', () => {
    const applied = reduceAll(
      initialPromoState,
      { type: 'submit', code: 'WELCOME10', requestId: 1 },
      { type: 'result', requestId: 1, outcome: { kind: 'valid', totals: TOTALS } },
    )
    const removed = promoReducer(applied, { type: 'remove' })
    assert.equal(removed.code, null)
    assert.equal(removed.totals, null)
    assert.equal(removed.status, 'idle')
    assert.equal(removed.message, null)
    assert.ok(removed.requestId > applied.requestId, 'an in-flight result is invalidated')
  })

  it('clears everything when the cart empties', () => {
    const applied = reduceAll(
      initialPromoState,
      { type: 'submit', code: 'WELCOME10', requestId: 1 },
      { type: 'result', requestId: 1, outcome: { kind: 'valid', totals: TOTALS } },
    )
    const emptied = promoReducer(applied, { type: 'cartEmptied' })
    assert.equal(emptied.code, null)
    assert.equal(emptied.totals, null)
    assert.equal(emptied.status, 'idle')
  })
})

describe('promoReducer — revalidation', () => {
  const applied = reduceAll(
    initialPromoState,
    { type: 'submit', code: 'WELCOME10', requestId: 1 },
    { type: 'result', requestId: 1, outcome: { kind: 'valid', totals: TOTALS } },
  )

  it('re-checks on a cart change, keeping the old totals on screen meanwhile', () => {
    const checking = promoReducer(applied, { type: 'revalidate', requestId: 2 })
    assert.equal(checking.status, 'checking')
    assert.equal(checking.code, 'WELCOME10')
    assert.deepEqual(checking.totals, TOTALS, 'no flicker while re-checking')
  })

  it('updates to the new totals when the code is still valid', () => {
    const bigger: PromoTotals = {
      ...TOTALS,
      eligibleSubtotal: 898,
      discountAmount: 89.8,
      subtotalBeforeDiscount: 898,
      subtotalAfterDiscount: 808.2,
      shipping: 0,
      totalBeforeDiscount: 898,
      totalAfterDiscount: 808.2,
    }
    const state = reduceAll(
      applied,
      { type: 'revalidate', requestId: 2 },
      { type: 'result', requestId: 2, outcome: { kind: 'valid', totals: bigger } },
    )
    assert.equal(state.status, 'applied')
    assert.equal(state.totals?.discountAmount, 89.8)
    assert.equal(state.totals?.shipping, 0)
  })

  it('drops the code when a cart change makes it invalid, and explains why', () => {
    const state = reduceAll(
      applied,
      { type: 'revalidate', requestId: 2 },
      {
        type: 'result',
        requestId: 2,
        outcome: {
          kind: 'invalid',
          message: 'Rabattkoden krever en varesum på minst kr 500.',
        },
      },
    )
    assert.equal(state.code, null)
    assert.equal(state.totals, null)
    assert.equal(state.status, 'error')
    assert.equal(state.message, 'Rabattkoden krever en varesum på minst kr 500.')
  })

  it('revalidation is allowed even while a check is running — the cart really did change', () => {
    const checking = promoReducer(applied, { type: 'revalidate', requestId: 2 })
    const again = promoReducer(checking, { type: 'revalidate', requestId: 3 })
    assert.equal(again.requestId, 3)
  })

  it('does nothing when there is no applied code', () => {
    assert.equal(promoReducer(initialPromoState, { type: 'revalidate', requestId: 5 }), initialPromoState)
  })
})

describe('promoReducer — temporary failures and stale responses', () => {
  const applied = reduceAll(
    initialPromoState,
    { type: 'submit', code: 'WELCOME10', requestId: 1 },
    { type: 'result', requestId: 1, outcome: { kind: 'valid', totals: TOTALS } },
  )

  it('keeps the code but shows no discount when it cannot be verified', () => {
    for (const message of ['Vi fikk ikke bekreftet rabattkoden akkurat nå. Prøv igjen om litt.', 'For mange forsøk. Prøv igjen om 90 sekunder.']) {
      const state = reduceAll(
        applied,
        { type: 'revalidate', requestId: 2 },
        { type: 'result', requestId: 2, outcome: { kind: 'unverified', message } },
      )
      assert.equal(state.code, 'WELCOME10', 'a transient failure must not cost the customer the code')
      assert.equal(state.status, 'unverified')
      assert.equal(state.totals, null, 'no untrusted discount stays on screen')
      assert.equal(state.message, message)
    }
  })

  it('a code entered fresh survives a network failure', () => {
    const state = reduceAll(
      initialPromoState,
      { type: 'submit', code: 'WELCOME10', requestId: 1 },
      { type: 'result', requestId: 1, outcome: networkOutcome() },
    )
    assert.equal(state.status, 'unverified')
    assert.equal(state.totals, null)
  })

  it('a slow answer for an older cart cannot overwrite the newer one', () => {
    const superseded: PromoTotals = { ...TOTALS, discountAmount: 44.9, totalAfterDiscount: 473.1 }
    const current: PromoTotals = { ...TOTALS, discountAmount: 89.8, totalAfterDiscount: 808.2, shipping: 0 }

    const state = reduceAll(
      applied,
      // Cart changed twice in quick succession.
      { type: 'revalidate', requestId: 2 },
      { type: 'revalidate', requestId: 3 },
      // The newest answer lands first…
      { type: 'result', requestId: 3, outcome: { kind: 'valid', totals: current } },
      // …and the older one arrives afterwards.
      { type: 'result', requestId: 2, outcome: { kind: 'valid', totals: superseded } },
    )

    assert.equal(state.totals?.discountAmount, 89.8, 'the stale answer must be discarded')
    assert.equal(state.totals?.totalAfterDiscount, 808.2)
  })

  it('a stale invalid answer cannot clear a code the newer answer accepted', () => {
    const state = reduceAll(
      applied,
      { type: 'revalidate', requestId: 2 },
      { type: 'revalidate', requestId: 3 },
      { type: 'result', requestId: 3, outcome: { kind: 'valid', totals: TOTALS } },
      { type: 'result', requestId: 2, outcome: { kind: 'invalid', message: 'Ukjent rabattkode.' } },
    )
    assert.equal(state.status, 'applied')
    assert.equal(state.code, 'WELCOME10')
  })

  it('an answer arriving after removal is ignored', () => {
    const state = reduceAll(
      applied,
      { type: 'revalidate', requestId: 2 },
      { type: 'remove' },
      { type: 'result', requestId: 2, outcome: { kind: 'valid', totals: TOTALS } },
    )
    assert.equal(state.code, null)
    assert.equal(state.totals, null)
    assert.equal(state.status, 'idle')
  })
})

/* ------------------------------ summary + misc ------------------------------ */

describe('buildSummaryRows', () => {
  it('leaves an ordinary cart exactly as it was', () => {
    assert.deepEqual(buildSummaryRows({ subtotal: 449, shipping: 69, total: 518 }, null), [
      { key: 'subtotal', label: 'Delsum', value: 449 },
      { key: 'shipping', label: 'Frakt', value: 69, free: false },
      { key: 'total', label: 'Totalt', value: 518 },
    ])
  })

  it('marks free shipping on an ordinary cart', () => {
    const rows = buildSummaryRows({ subtotal: 898, shipping: 0, total: 898 }, null)
    assert.equal(rows.find((r) => r.key === 'shipping')?.free, true)
  })

  it('adds a named discount row using only the server figures', () => {
    const rows = buildSummaryRows({ subtotal: 449, shipping: 69, total: 518 }, TOTALS)
    assert.deepEqual(rows, [
      { key: 'subtotal', label: 'Delsum', value: 449 },
      { key: 'discount', label: 'Rabatt WELCOME10', value: -44.9 },
      { key: 'shipping', label: 'Frakt', value: 69, free: false },
      { key: 'total', label: 'Totalt', value: 473.1 },
    ])
  })

  it('prefers the server figures over stale local ones', () => {
    // The local cart still thinks the goods cost 449; the server priced them at 549.
    const serverTotals: PromoTotals = {
      ...TOTALS,
      eligibleSubtotal: 549,
      discountAmount: 54.9,
      subtotalBeforeDiscount: 549,
      subtotalAfterDiscount: 494.1,
      totalBeforeDiscount: 618,
      totalAfterDiscount: 563.1,
    }
    const rows = buildSummaryRows({ subtotal: 449, shipping: 69, total: 518 }, serverTotals)
    assert.equal(rows.find((r) => r.key === 'subtotal')?.value, 549)
    assert.equal(rows.find((r) => r.key === 'total')?.value, 563.1)
  })
})

describe('promoCheckKey', () => {
  it('is null without a code, so no revalidation is ever scheduled', () => {
    assert.equal(promoCheckKey(null, '10:1'), null)
  })

  it('changes when either the code or the cart changes', () => {
    assert.equal(promoCheckKey('A', '10:1'), promoCheckKey('A', '10:1'))
    assert.notEqual(promoCheckKey('A', '10:1'), promoCheckKey('A', '10:2'))
    assert.notEqual(promoCheckKey('A', '10:1'), promoCheckKey('B', '10:1'))
  })
})

describe('shouldSubmitOnKey', () => {
  it('applies the code on Enter only', () => {
    assert.equal(shouldSubmitOnKey('Enter'), true)
    for (const key of ['a', 'Escape', 'Tab', ' ', 'ArrowDown', 'Shift']) {
      assert.equal(shouldSubmitOnKey(key), false, `${key} must not submit`)
    }
  })
})

describe('promo request — a product with no variants', () => {
  it('sends its product id, and keeps prices and colours out as before', () => {
    const body = buildValidationRequest('WELCOME10', [
      { productId: '7', qty: 2, price: 129, colorName: 'x' } as never,
    ])
    assert.deepEqual(body.items, [{ productId: '7', quantity: 2 }])
  })

  it('fingerprints variant-less lines separately from each other', () => {
    // Keying on a missing variant id would make these two carts look identical.
    const a = cartSignature([{ productId: '7', qty: 1 } as never])
    const b = cartSignature([{ productId: '8', qty: 1 } as never])
    assert.notEqual(a, b)
  })

  it('keeps a variant line’s fingerprint exactly as it was', () => {
    assert.equal(cartSignature([{ variantId: '10', qty: 2 } as never]), '10:2')
  })
})
