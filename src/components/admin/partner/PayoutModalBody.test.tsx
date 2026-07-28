import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import PayoutModalBody, {
  PayoutTriggerRow,
  canRegisterPayout,
  type PayoutModalBodyProps,
  type PayoutSummary,
} from './PayoutModalBody'

/**
 * The payout action's visible surface, rendered with react-dom/server.
 *
 * `RegisterPayoutButton` holds the drawer, the request and the toast; those depend on
 * Payload's client providers and are covered by the endpoint tests and the browser smoke
 * test. Everything an admin can SEE and every state it can be in is asserted here.
 */

const summary = (overrides: Partial<PayoutSummary> = {}): PayoutSummary => ({
  promoCode: 'OLA10',
  partnerName: 'Ola Nordmann',
  validUsageCount: 28,
  revenueAfterDiscount: 12430,
  earnedCommission: 1243,
  availableToPay: 540,
  ...overrides,
})

const noop = () => {}

const body = (overrides: Partial<PayoutModalBodyProps> = {}): string =>
  renderToStaticMarkup(
    <PayoutModalBody
      summary={summary()}
      method="bankTransfer"
      reference=""
      note=""
      busy={false}
      error=""
      onMethodChange={noop}
      onReferenceChange={noop}
      onNoteChange={noop}
      onCancel={noop}
      onSubmit={noop}
      {...overrides}
    />,
  )

const trigger = (availableToPay: number): string =>
  renderToStaticMarkup(<PayoutTriggerRow availableToPay={availableToPay} onOpen={noop} />)

const text = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

/* ------------------------------ button state ------------------------------ */

describe('PayoutTriggerRow — button state', () => {
  it('renders the primary action with the agreed label', () => {
    assert.ok(text(trigger(540)).includes('Registrer utbetaling'))
  })

  it('is enabled when there is a balance to pay', () => {
    const html = trigger(540)
    assert.equal(html.includes('disabled'), false, html)
    assert.equal(text(html).includes('Ingen provisjon tilgjengelig.'), false)
  })

  it('is disabled at a zero balance, with the Norwegian caption', () => {
    const html = trigger(0)
    assert.ok(html.includes('disabled'), html)
    assert.ok(text(html).includes('Ingen provisjon tilgjengelig.'))
  })

  it('treats a negative or unusable balance as nothing to pay', () => {
    for (const value of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.ok(trigger(value).includes('disabled'), String(value))
    }
  })

  it('exposes the same predicate the modal uses', () => {
    assert.equal(canRegisterPayout(0.01), true)
    assert.equal(canRegisterPayout(0), false)
    assert.equal(canRegisterPayout(-1), false)
    assert.equal(canRegisterPayout(Number.NaN), false)
  })
})

/* ------------------------------ read-only summary ------------------------------ */

describe('PayoutModalBody — read-only summary', () => {
  it('shows every figure the admin needs to confirm', () => {
    const html = text(body())

    for (const label of [
      'Partner',
      'Rabattkode',
      'Gyldige kjøp',
      'Omsetning etter rabatt',
      'Opptjent provisjon',
      'Til utbetaling',
    ]) {
      assert.ok(html.includes(label), label)
    }

    assert.ok(html.includes('Ola Nordmann'))
    assert.ok(html.includes('OLA10'))
    assert.ok(html.includes('28'))
    assert.ok(html.includes('12 430,00 kr'))
    assert.ok(html.includes('1 243,00 kr'))
  })

  it('renders a dash rather than an empty cell for a missing name or code', () => {
    assert.ok(text(body({ summary: summary({ partnerName: '', promoCode: '' }) })).includes('—'))
  })

  it('makes clear it records an already-completed transfer', () => {
    const html = text(body())
    assert.ok(html.includes('allerede er utført'))
    assert.ok(html.includes('Systemet sender aldri penger selv.'))
  })
})

/* ------------------------------ the amount is not editable ------------------------------ */

describe('PayoutModalBody — the amount is stated, never entered', () => {
  it('states the amount to be paid', () => {
    const html = text(body())
    assert.ok(html.includes('Beløp som utbetales'))
    assert.ok(html.includes('540,00 kr'))
    assert.ok(html.includes('Beløpet kan ikke endres'))
  })

  it('offers NO amount input of any kind', () => {
    const html = body()

    assert.equal(html.includes('type="number"'), false, 'no numeric input')
    assert.equal(/id="[^"]*amount[^"]*"/i.test(html), false, 'no amount field')
    // Exactly one text input — the reference.
    assert.equal((html.match(/<input/g) ?? []).length, 1)
    assert.ok(html.includes('partner-payout-reference'))
  })

  it('offers no way to request a partial payout', () => {
    const html = text(body())
    for (const forbidden of ['Delvis', 'Endre beløp', 'Annet beløp']) {
      assert.equal(html.includes(forbidden), false, forbidden)
    }
  })
})

/* ------------------------------ editable fields ------------------------------ */

describe('PayoutModalBody — editable fields', () => {
  it('offers the three payment methods with Norwegian labels', () => {
    const html = body()

    for (const label of ['Bankoverføring', 'Vipps', 'Annet']) {
      assert.ok(html.includes(label), label)
    }
    assert.equal((html.match(/<option/g) ?? []).length, 3)
  })

  it('reflects the selected method', () => {
    assert.ok(body({ method: 'vipps' }).includes('value="vipps"'))
  })

  it('offers optional reference and note fields', () => {
    const html = body()

    assert.ok(html.includes('partner-payout-reference'))
    assert.ok(html.includes('partner-payout-note'))
    assert.equal((html.match(/<textarea/g) ?? []).length, 1)
  })

  it('renders the current reference and note values', () => {
    const html = body({ reference: 'BANK-9911', note: 'Juli-oppgjør' })
    assert.ok(html.includes('BANK-9911'))
    assert.ok(html.includes('Juli-oppgjør'))
  })
})

/* ------------------------------ actions and states ------------------------------ */

describe('PayoutModalBody — actions', () => {
  it('offers exactly the two confirmation actions', () => {
    const html = text(body())

    assert.ok(html.includes('Avbryt'))
    assert.ok(html.includes('Registrer utbetaling'))
    for (const forbidden of ['Slett', 'Rediger']) {
      assert.equal(html.includes(forbidden), false, forbidden)
    }
  })

  it('disables both actions while a request is in flight', () => {
    const html = body({ busy: true })

    assert.equal((html.match(/disabled/g) ?? []).length >= 2, true)
    assert.ok(text(html).includes('Registrerer'))
  })

  it('disables submitting when there is no balance', () => {
    const html = body({ summary: summary({ availableToPay: 0 }) })
    // Cancel stays available; submit does not.
    assert.ok(html.includes('disabled'))
    assert.ok(text(html).includes('Avbryt'))
  })

  it('shows a server error message when one is given', () => {
    const html = text(body({ error: 'Saldoen har endret seg siden skjemaet ble åpnet.' }))
    assert.ok(html.includes('Saldoen har endret seg siden skjemaet ble åpnet.'))
  })

  it('shows no error box in the normal case', () => {
    assert.equal(body().includes('modalError'), false)
  })
})

/* ------------------------------ formatting ------------------------------ */

describe('PayoutModalBody — formatting', () => {
  it('formats every amount as Norwegian kroner with øre', () => {
    const html = text(
      body({
        summary: summary({
          availableToPay: 1234.5,
          earnedCommission: 9876.25,
          revenueAfterDiscount: 100000,
        }),
      }),
    )

    assert.ok(html.includes('1 234,50 kr'))
    assert.ok(html.includes('9 876,25 kr'))
    assert.ok(html.includes('100 000,00 kr'))
  })

  it('renders zero amounts as 0,00 kr rather than blank', () => {
    const html = text(
      body({ summary: summary({ availableToPay: 0, earnedCommission: 0 }) }),
    )
    assert.ok(html.includes('0,00 kr'))
  })
})
