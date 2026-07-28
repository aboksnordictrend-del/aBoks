import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { registerPartnerPayout } from './registerPartnerPayout'

/**
 * End-to-end tests for the payout endpoint against a stubbed Payload, following the pattern in
 * `@/lib/promo/usageRegistration.test.ts`.
 *
 * The point of these is the money: that the balance is recalculated from the database on every
 * request, that nothing financial is taken from the body, and that every rejection path
 * actually rejects.
 */

/* ------------------------------ harness ------------------------------ */

const PARTNER_PROMO = {
  id: 7,
  code: 'WELCOME10',
  isPartnerCode: true,
  partnerName: 'Ola Nordmann',
}

/** One valid Stage 3 partner usage on a delivered order. */
const validUsage = (id: number, commission: number, orderId: number = id) => ({
  id,
  isPartnerUsage: true,
  commissionAmount: commission,
  commissionBaseSnapshot: 'orderAfterDiscount',
  orderAmountAfterDiscount: 404.1,
  order: orderId,
})

interface Harness {
  req: PayloadRequest
  payouts: Record<string, unknown>[]
  errors: string[]
  /** Every message handed to payload.sendEmail. */
  emails: Record<string, unknown>[]
}

function harness(
  opts: {
    user?: unknown
    body?: unknown
    promo?: Record<string, unknown> | null
    usages?: Record<string, unknown>[]
    orders?: Record<string, unknown>[]
    payouts?: Record<string, unknown>[]
    createThrows?: boolean
    findThrows?: boolean
    bodyThrows?: boolean
    /** Simulates an SMTP failure on the partner confirmation e-mail. */
    sendEmailThrows?: boolean
  } = {},
): Harness {
  const payouts = [...(opts.payouts ?? [])]
  const errors: string[] = []
  const emails: Record<string, unknown>[] = []
  const orders = opts.orders ?? [{ id: 1, status: 'delivered' }]

  const payload = {
    findByID: async ({ collection }: { collection: string }) => {
      if (collection !== 'promo-codes') return null
      return opts.promo === undefined ? PARTNER_PROMO : opts.promo
    },
    find: async ({ collection }: { collection: string }) => {
      if (opts.findThrows) throw new Error('connection terminated')
      if (collection === 'promo-code-usages') {
        const docs = opts.usages ?? [validUsage(1, 100)]
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'orders') return { docs: orders, totalDocs: orders.length }
      if (collection === 'partner-payouts') return { docs: payouts, totalDocs: payouts.length }
      return { docs: [], totalDocs: 0 }
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection !== 'partner-payouts') throw new Error(`unexpected write to ${collection}`)
      if (opts.createThrows) throw new Error('insert failed')
      const row = { id: payouts.length + 100, ...data }
      payouts.push(row)
      return row
    },
    sendEmail: async (message: Record<string, unknown>) => {
      if (opts.sendEmailThrows) throw new Error('smtp unavailable')
      emails.push(message)
      return { messageId: 'stub' }
    },
  }

  const req = {
    user: opts.user === undefined ? { id: 1, role: 'admin' } : opts.user,
    payload,
    json: async () => {
      if (opts.bodyThrows) throw new SyntaxError('bad json')
      return opts.body === undefined ? {} : opts.body
    },
  } as unknown as PayloadRequest

  // Silence the endpoint's error logging while capturing it.
  const originalError = console.error
  console.error = (...args: unknown[]) => errors.push(String(args[0]))
  process.nextTick(() => {
    console.error = originalError
  })

  return { req, payouts, errors, emails }
}

const VALID_BODY = {
  promoCodeId: 7,
  amount: 40,
  paymentMethod: 'bankTransfer',
}

async function call(opts: Parameters<typeof harness>[0] = {}) {
  const h = harness(opts)
  const res = await registerPartnerPayout.handler(h.req)
  const body = (await res.json()) as Record<string, unknown>
  return { res, body, payouts: h.payouts, emails: h.emails }
}

const expectError = async (
  opts: NonNullable<Parameters<typeof harness>[0]>,
  code: string,
  status: number,
) => {
  const { res, body, payouts } = await call(opts)
  assert.equal(body.code, code, `expected ${code}, got ${String(body.code)}`)
  assert.equal(res.status, status)
  assert.equal(payouts.length, opts.payouts?.length ?? 0, 'nothing may be written')
  assert.ok(typeof body.error === 'string' && (body.error as string).length > 0)
  return body
}

/* ------------------------------ 8–9. successful payouts ------------------------------ */

describe('registerPartnerPayout — a valid payout', () => {
  it('accepts a partial payout and reports the remaining balance', async () => {
    const { res, body, payouts } = await call({ body: { ...VALID_BODY, amount: 40 } })

    assert.equal(res.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.amount, 40)
    assert.equal(body.earnedCommission, 100)
    assert.equal(body.paidAmount, 40)
    assert.equal(body.availableToPay, 60)
    assert.equal(payouts.length, 1)
  })

  it('accepts a full payout, leaving nothing available', async () => {
    const { body } = await call({ body: { ...VALID_BODY, amount: 100 } })

    assert.equal(body.ok, true)
    assert.equal(body.availableToPay, 0)
  })

  it('accepts a payout that exactly clears a partially-paid balance', async () => {
    const { body } = await call({
      body: { ...VALID_BODY, amount: 60 },
      payouts: [{ id: 1, amount: 40 }],
    })

    assert.equal(body.paidAmount, 100)
    assert.equal(body.availableToPay, 0)
  })

  it('stores the normalised values and the server-derived partner name', async () => {
    const { payouts } = await call({
      body: {
        ...VALID_BODY,
        amount: '40.00',
        paymentMethod: 'vipps',
        reference: '  VIPPS-9  ',
        note: '  Utbetalt  ',
        payoutDate: '2026-07-20',
      },
    })

    const row = payouts[0]
    assert.equal(row.promoCode, 7)
    assert.equal(row.partnerNameSnapshot, 'Ola Nordmann')
    assert.equal(row.amount, 40)
    assert.equal(row.paymentMethod, 'vipps')
    assert.equal(row.reference, 'VIPPS-9', 'trimmed')
    assert.equal(row.note, 'Utbetalt', 'trimmed')
    assert.equal(row.createdBy, 1, 'copied from req.user')
    assert.equal(String(row.payoutDate).slice(0, 10), '2026-07-20')
  })

  it('defaults the payout date to today when none is given', async () => {
    const { payouts } = await call({ body: VALID_BODY })

    const stored = new Date(String(payouts[0].payoutDate)).getTime()
    assert.ok(Math.abs(Date.now() - stored) < 60_000)
  })

  it('stores null for omitted reference and note', async () => {
    const { payouts } = await call({ body: VALID_BODY })

    assert.equal(payouts[0].reference, null)
    assert.equal(payouts[0].note, null)
  })
})

/* ------------------------------ 16. the client cannot dictate money ------------------------------ */

describe('registerPartnerPayout — client-supplied financial values are never read', () => {
  it('ignores a client-submitted partner name', async () => {
    const { payouts } = await call({
      body: { ...VALID_BODY, partnerNameSnapshot: 'Svindel AS' },
    })

    assert.equal(payouts[0].partnerNameSnapshot, 'Ola Nordmann')
  })

  it('ignores a client-submitted balance and still enforces the real one', async () => {
    await expectError(
      {
        body: {
          ...VALID_BODY,
          amount: 5_000,
          availableToPay: 5_000,
          earnedCommission: 5_000,
          paidAmount: 0,
        },
      },
      'amount_exceeds_balance',
      409,
    )
  })

  it('ignores a client-submitted commission rate', async () => {
    const { body } = await call({ body: { ...VALID_BODY, commissionRate: 90 } })

    assert.equal(body.earnedCommission, 100, 'derived from usage snapshots only')
  })

  it('does not leak partner contact details in the response', async () => {
    const { body } = await call({
      body: VALID_BODY,
      promo: { ...PARTNER_PROMO, partnerEmail: 'ola@example.no', partnerPhone: '99887766' },
    })

    const serialized = JSON.stringify(body)
    assert.equal(serialized.includes('example.no'), false)
    assert.equal(serialized.includes('99887766'), false)
  })
})

/* ------------------------------ 10–13. rejected amounts ------------------------------ */

describe('registerPartnerPayout — amount validation', () => {
  it('rejects a zero payout', async () => {
    await expectError({ body: { ...VALID_BODY, amount: 0 } }, 'invalid_amount', 400)
  })

  it('rejects a negative payout', async () => {
    await expectError({ body: { ...VALID_BODY, amount: -50 } }, 'invalid_amount', 400)
  })

  it('rejects a missing amount', async () => {
    await expectError({ body: { promoCodeId: 7, paymentMethod: 'vipps' } }, 'invalid_amount', 400)
  })

  it('rejects an unparseable amount', async () => {
    for (const amount of ['abc', '', true, {}, Number.NaN, '1e5']) {
      await expectError({ body: { ...VALID_BODY, amount } }, 'invalid_amount', 400)
    }
  })

  it('rejects an overpayment, even by one øre', async () => {
    const body = await expectError(
      { body: { ...VALID_BODY, amount: 100.01 } },
      'amount_exceeds_balance',
      409,
    )
    assert.match(body.error as string, /100,00 kr/)
  })

  it('rejects any payout when nothing has been earned', async () => {
    await expectError({ body: VALID_BODY, usages: [] }, 'no_available_balance', 409)
  })

  it('rejects a payout when the balance is already fully paid', async () => {
    await expectError(
      { body: VALID_BODY, payouts: [{ id: 1, amount: 100 }] },
      'no_available_balance',
      409,
    )
  })

  it('rejects when every usage is excluded by its order status', async () => {
    await expectError(
      { body: VALID_BODY, orders: [{ id: 1, status: 'cancelled' }] },
      'no_available_balance',
      409,
    )
  })
})

/* ------------------------------ 20. repeated requests ------------------------------ */

describe('registerPartnerPayout — a repeated request cannot pay twice', () => {
  it('rejects a second payout built on the pre-payout balance', async () => {
    // Both requests were prepared while the UI showed 100 kr available.
    const h = harness({ body: { ...VALID_BODY, amount: 100 } })

    const first = await registerPartnerPayout.handler(h.req)
    assert.equal(first.status, 200)

    // The stub's payout list now contains the first row, so the recalculation sees it.
    const second = await registerPartnerPayout.handler(h.req)
    const body = (await second.json()) as Record<string, unknown>

    assert.equal(second.status, 409)
    assert.equal(body.code, 'no_available_balance')
    assert.equal(h.payouts.length, 1, 'exactly one payout exists')
  })

  it('allows a second payout only up to what genuinely remains', async () => {
    const h = harness({ body: { ...VALID_BODY, amount: 60 } })

    await registerPartnerPayout.handler(h.req)
    const second = await registerPartnerPayout.handler(h.req)
    const body = (await second.json()) as Record<string, unknown>

    // 60 paid, 40 left — the second request for another 60 is refused.
    assert.equal(body.code, 'amount_exceeds_balance')
    assert.equal(h.payouts.length, 1)
  })
})

/* ------------------------------ 14–15. promo code validation ------------------------------ */

describe('registerPartnerPayout — the promo code must be a partner code', () => {
  it('rejects an ordinary promo code', async () => {
    await expectError(
      { body: VALID_BODY, promo: { id: 7, code: 'WELCOME10', isPartnerCode: false } },
      'not_partner_code',
      409,
    )
  })

  it('rejects a code with no partner flag at all', async () => {
    await expectError({ body: VALID_BODY, promo: { id: 7, code: 'WELCOME10' } }, 'not_partner_code', 409)
  })

  it('rejects a partner code with a missing or blank partner name', async () => {
    for (const partnerName of [null, '', '   ', undefined]) {
      await expectError(
        { body: VALID_BODY, promo: { ...PARTNER_PROMO, partnerName } },
        'partner_name_missing',
        409,
      )
    }
  })

  it('rejects a promo code that does not exist', async () => {
    await expectError({ body: VALID_BODY, promo: null }, 'promo_not_found', 404)
  })

  it('rejects a missing promo code id', async () => {
    for (const promoCodeId of [undefined, null, '', '   ', {}, []]) {
      await expectError({ body: { ...VALID_BODY, promoCodeId } }, 'invalid_body', 400)
    }
  })
})

/* ------------------------------ auth, method, body ------------------------------ */

describe('registerPartnerPayout — request-level rejections', () => {
  it('requires authentication', async () => {
    await expectError({ user: null, body: VALID_BODY }, 'unauthorized', 401)
  })

  it('rejects an invalid payment method', async () => {
    for (const paymentMethod of [undefined, null, '', 'paypal', 'BANKTRANSFER', 1]) {
      await expectError({ body: { ...VALID_BODY, paymentMethod } }, 'invalid_payment_method', 400)
    }
  })

  it('accepts each of the three configured methods', async () => {
    for (const paymentMethod of ['bankTransfer', 'vipps', 'other']) {
      const { body } = await call({ body: { ...VALID_BODY, paymentMethod } })
      assert.equal(body.ok, true, paymentMethod)
    }
  })

  it('rejects an invalid payout date', async () => {
    for (const payoutDate of ['ikke en dato', '2026-13-45', {}, []]) {
      await expectError({ body: { ...VALID_BODY, payoutDate } }, 'invalid_payout_date', 400)
    }
  })

  it('rejects a malformed or non-object body', async () => {
    await expectError({ bodyThrows: true }, 'invalid_body', 400)
    await expectError({ body: [] }, 'invalid_body', 400)
    await expectError({ body: 'nope' }, 'invalid_body', 400)
  })
})

/* ------------------------------ failure handling ------------------------------ */

describe('registerPartnerPayout — server failures stay opaque', () => {
  it('reports a balance lookup failure as retryable, without database detail', async () => {
    const body = await expectError({ body: VALID_BODY, findThrows: true }, 'balance_lookup_failed', 503)

    assert.equal(body.error, 'Kunne ikke beregne saldoen akkurat nå. Prøv igjen.')
    assert.equal(JSON.stringify(body).includes('connection terminated'), false)
  })

  it('reports a failed insert without leaking the error', async () => {
    const { res, body } = await call({ body: VALID_BODY, createThrows: true })

    assert.equal(res.status, 500)
    assert.equal(body.code, 'create_failed')
    assert.equal(JSON.stringify(body).includes('insert failed'), false)
  })

  it('refuses to register anything while a stored payout is unreadable', async () => {
    await expectError(
      { body: VALID_BODY, payouts: [{ id: 1, amount: null }] },
      'unreadable_payout_history',
      409,
    )
  })
})

/* ------------------------------ excluded usages ------------------------------ */

describe('registerPartnerPayout — the balance honours every exclusion rule', () => {
  it('counts only usages whose order is confirmed, shipped or delivered', async () => {
    const { body } = await call({
      body: { ...VALID_BODY, amount: 1 },
      usages: [validUsage(1, 100, 1), validUsage(2, 50, 2), validUsage(3, 25, 3)],
      orders: [
        { id: 1, status: 'delivered' },
        { id: 2, status: 'cancelled' },
        { id: 3, status: 'pending' },
      ],
    })

    assert.equal(body.earnedCommission, 100)
  })

  it('ignores legacy rows without a snapshot', async () => {
    const { body } = await call({
      body: { ...VALID_BODY, amount: 1 },
      usages: [
        validUsage(1, 100, 1),
        { id: 2, isPartnerUsage: true, commissionAmount: 999, order: 1 },
      ],
    })

    assert.equal(body.earnedCommission, 100)
  })

  it('ignores usages whose order was deleted', async () => {
    await expectError(
      { body: VALID_BODY, usages: [validUsage(1, 100, 999)] },
      'no_available_balance',
      409,
    )
  })

  it('ignores non-partner usages', async () => {
    await expectError(
      { body: VALID_BODY, usages: [{ ...validUsage(1, 100), isPartnerUsage: false }] },
      'no_available_balance',
      409,
    )
  })
})

/* ========================================================================== */
/*  Stage 6 — full-balance settlement and the partner confirmation e-mail       */
/* ========================================================================== */

/** The partner code with a usable address, so the e-mail path is exercised. */
const PROMO_WITH_EMAIL = { ...PARTNER_PROMO, partnerEmail: 'ola@example.no' }

const FULL_BODY = {
  promoCodeId: 7,
  amount: 100, // the whole balance in the default fixture
  paymentMethod: 'bankTransfer',
  expectFullBalance: true,
}

describe('Stage 6 — expectFullBalance requires the exact remaining balance', () => {
  it('accepts a payout equal to the full available balance', async () => {
    const { res, body, payouts } = await call({ body: FULL_BODY })

    assert.equal(res.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.amount, 100)
    assert.equal(body.availableToPay, 0, 'nothing left to pay')
    assert.equal(payouts.length, 1)
  })

  it('rejects an amount BELOW the balance — no partial settlement in this flow', async () => {
    await expectError({ body: { ...FULL_BODY, amount: 40 } }, 'balance_changed', 409)
  })

  it('rejects an amount above the balance before it ever reaches the equality check', async () => {
    await expectError({ body: { ...FULL_BODY, amount: 500 } }, 'amount_exceeds_balance', 409)
  })

  it('rejects a stale balance that SHRANK — another payout took 30 meanwhile', async () => {
    // 100 was on screen; only 70 remains. Caught by the existing over-balance guard, which
    // runs first — a stale-high amount is rejected either way.
    const body = await expectError(
      { body: FULL_BODY, payouts: [{ id: 1, amount: 30 }] },
      'amount_exceeds_balance',
      409,
    )
    assert.match(body.error as string, /70,00 kr/, 'tells the admin what is actually available')
  })

  it('rejects a stale balance that GREW — a new paid order landed meanwhile', async () => {
    // 100 was on screen; 200 is now owed. Under the old rule this would quietly under-pay;
    // the equality check refuses it and names the real figure.
    const body = await expectError(
      {
        body: FULL_BODY,
        usages: [validUsage(1, 100, 1), validUsage(2, 100, 2)],
        orders: [
          { id: 1, status: 'delivered' },
          { id: 2, status: 'delivered' },
        ],
      },
      'balance_changed',
      409,
    )
    assert.match(body.error as string, /200,00 kr/)
  })

  it('rejects a duplicate settlement — the second request sees a zero balance', async () => {
    const h = harness({ body: FULL_BODY, promo: PROMO_WITH_EMAIL })

    const first = await registerPartnerPayout.handler(h.req)
    assert.equal(first.status, 200)

    const second = await registerPartnerPayout.handler(h.req)
    const body = (await second.json()) as Record<string, unknown>

    assert.equal(second.status, 409)
    assert.equal(body.code, 'no_available_balance')
    assert.equal(h.payouts.length, 1, 'exactly one payout exists')
    assert.equal(h.emails.length, 1, 'and exactly one e-mail was sent')
  })

  it('leaves the partial-amount contract intact when the flag is absent', async () => {
    // Stage 4 behaviour is unchanged for any caller that does not opt in.
    const { res, body } = await call({ body: { ...VALID_BODY, amount: 40 } })

    assert.equal(res.status, 200)
    assert.equal(body.availableToPay, 60)
  })

  it('ignores a non-true flag rather than treating it as opt-in', async () => {
    for (const expectFullBalance of ['true', 1, {}]) {
      const { res } = await call({ body: { ...VALID_BODY, amount: 40, expectFullBalance } })
      assert.equal(res.status, 200, JSON.stringify(expectFullBalance))
    }
  })
})

describe('Stage 6 — the partner confirmation e-mail', () => {
  it('sends to the address on the promo code, after the payout exists', async () => {
    const { body, emails, payouts } = await call({ body: FULL_BODY, promo: PROMO_WITH_EMAIL })

    assert.equal(payouts.length, 1)
    assert.equal(emails.length, 1)
    assert.equal(emails[0].to, 'ola@example.no')
    assert.equal(emails[0].subject, 'Utbetaling av partnerprovisjon fra aBoks')
    assert.equal(body.emailStatus, 'sent')
  })

  it('carries the server-derived figures, not anything from the body', async () => {
    const { emails } = await call({
      body: {
        ...FULL_BODY,
        reference: 'BANK-77',
        partnerNameSnapshot: 'Svindel AS',
        earnedCommission: 99999,
      },
      promo: PROMO_WITH_EMAIL,
    })

    const html = String(emails[0].html)
    assert.ok(html.includes('Ola Nordmann'), 'the promo record name')
    assert.equal(html.includes('Svindel AS'), false, 'never the submitted name')
    assert.equal(html.includes('99999'), false, 'never a submitted total')
    assert.ok(html.includes('WELCOME10'), 'the promo code')
    assert.ok(html.includes('BANK-77'), 'the reference the admin typed')
    assert.ok(html.includes('Bankoverføring'), 'the Norwegian method label')
  })

  it('omits the reference row when none was given', async () => {
    const { emails } = await call({ body: FULL_BODY, promo: PROMO_WITH_EMAIL })

    assert.equal(String(emails[0].html).includes('Referanse'), false)
  })

  it('skips the e-mail when the promo code has no address', async () => {
    const { body, emails, payouts } = await call({ body: FULL_BODY, promo: PARTNER_PROMO })

    assert.equal(payouts.length, 1, 'the payout is registered regardless')
    assert.equal(emails.length, 0)
    assert.equal(body.emailStatus, 'skipped_no_address')
  })

  it('skips the e-mail when the stored address is not a usable one', async () => {
    for (const partnerEmail of ['', '   ', 'ikke-en-adresse', 'a@b', 'a b@c.no']) {
      const { body, emails, payouts } = await call({
        body: FULL_BODY,
        promo: { ...PARTNER_PROMO, partnerEmail },
      })

      assert.equal(payouts.length, 1, `payout still registered for ${JSON.stringify(partnerEmail)}`)
      assert.equal(emails.length, 0, JSON.stringify(partnerEmail))
      assert.equal(body.emailStatus, 'skipped_no_address')
    }
  })

  it('keeps the payout when SMTP fails — no rollback, no delete, no retry', async () => {
    const { res, body, payouts } = await call({
      body: FULL_BODY,
      promo: PROMO_WITH_EMAIL,
      sendEmailThrows: true,
    })

    assert.equal(res.status, 200, 'the request still succeeds')
    assert.equal(body.ok, true)
    assert.equal(body.emailStatus, 'failed')
    assert.equal(payouts.length, 1, 'the ledger row is authoritative and stands')
  })

  it('never sends when validation fails', async () => {
    const cases: [string, Record<string, unknown>][] = [
      ['zero amount', { ...FULL_BODY, amount: 0 }],
      ['negative amount', { ...FULL_BODY, amount: -5 }],
      ['over balance', { ...FULL_BODY, amount: 999 }],
      ['amount mismatch', { ...FULL_BODY, amount: 40 }],
      ['bad method', { ...FULL_BODY, paymentMethod: 'paypal' }],
    ]

    for (const [label, body] of cases) {
      const { emails, payouts } = await call({ body, promo: PROMO_WITH_EMAIL })
      assert.equal(emails.length, 0, `${label}: no e-mail`)
      assert.equal(payouts.length, 0, `${label}: no payout`)
    }
  })

  it('never sends when the balance is already zero', async () => {
    const { emails } = await call({
      body: FULL_BODY,
      promo: PROMO_WITH_EMAIL,
      payouts: [{ id: 1, amount: 100 }],
    })

    assert.equal(emails.length, 0)
  })

  it('never sends when the payout row could not be created', async () => {
    const { res, emails } = await call({
      body: FULL_BODY,
      promo: PROMO_WITH_EMAIL,
      createThrows: true,
    })

    assert.equal(res.status, 500)
    assert.equal(emails.length, 0, 'the e-mail must follow the row, never precede it')
  })

  it('never sends to an unauthenticated caller', async () => {
    const { emails } = await call({ user: null, body: FULL_BODY, promo: PROMO_WITH_EMAIL })
    assert.equal(emails.length, 0)
  })

  it('sends a plain-text alternative alongside the HTML', async () => {
    const { emails } = await call({ body: FULL_BODY, promo: PROMO_WITH_EMAIL })

    assert.ok(typeof emails[0].text === 'string' && (emails[0].text as string).length > 50)
    assert.ok(String(emails[0].text).includes('Takk for samarbeidet!'))
  })
})
