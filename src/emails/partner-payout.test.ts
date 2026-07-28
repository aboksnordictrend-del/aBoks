import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createPartnerPayoutEmail } from './partner-payout'
import { createOrderDeliveredEmail } from './order-delivered'
import { kr } from './types'
import type { PartnerPayoutData } from './types'

/**
 * The partner payout e-mail must look like it came from the same system as every other aBoks
 * e-mail, so several of these assert that it shares the existing chrome rather than
 * describing a new design.
 */

const DATA: PartnerPayoutData = {
  partnerName: 'Ola Nordmann',
  promoCode: 'OLA10',
  validUsageCount: 28,
  revenueAfterDiscount: 12430,
  payoutAmount: 1243.5,
  payoutDate: '2026-07-28T09:00:00.000Z',
  paymentMethod: 'Bankoverføring',
  reference: 'BANK-9911',
}

const build = (overrides: Partial<PartnerPayoutData> = {}) =>
  createPartnerPayoutEmail({ ...DATA, ...overrides })

describe('createPartnerPayoutEmail — subject and structure', () => {
  it('uses the agreed subject', () => {
    assert.equal(build().subject, 'Utbetaling av partnerprovisjon fra aBoks')
  })

  it('renders the agreed title, greeting, intro and closing', () => {
    const { html, text } = build()

    for (const part of [
      'Partnerutbetaling registrert',
      'Hei Ola Nordmann,',
      'Vi har registrert en utbetaling av opptjent partnerprovisjon knyttet til din rabattkode.',
      'Takk for samarbeidet!',
    ]) {
      assert.ok(html.includes(part), `html: ${part}`)
      assert.ok(text.includes(part), `text: ${part}`)
    }
  })

  it('reuses the shared aBoks layout — same header, logo and footer as other e-mails', () => {
    const partner = build().html
    const delivered = createOrderDeliveredEmail({
      firstName: 'Ola',
      customerEmail: 'a@b.no',
      orderNumber: 'AB-1',
    }).html

    // The pieces that make an aBoks e-mail recognisable, taken from the existing template.
    for (const chrome of [
      'logo-wf-new.png',
      'aBoks – Smart batteriorganisering',
      'mailto:post@aboks.no',
      'background:#f2ede4',
    ]) {
      assert.ok(delivered.includes(chrome), `precondition: ${chrome}`)
      assert.ok(partner.includes(chrome), `partner e-mail must reuse: ${chrome}`)
    }
  })

  it('is a complete HTML document with a Norwegian language tag', () => {
    const html = build().html
    assert.ok(html.startsWith('<!DOCTYPE html>'))
    assert.ok(html.includes('<html lang="nb">'))
  })
})

describe('createPartnerPayoutEmail — information card', () => {
  it('lists every agreed row, in order', () => {
    const html = build().html
    const labels = [
      'Rabattkode',
      'Gyldige partnerkjøp',
      'Omsetning etter rabatt',
      'Utbetalt provisjon',
      'Utbetalingsdato',
      'Betalingsmåte',
    ]
    const positions = labels.map((l) => html.indexOf(l))
    assert.ok(positions.every((p) => p >= 0), 'a row is missing')
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'rows are out of order')
  })

  it('prints the values it is given', () => {
    const html = build().html

    assert.ok(html.includes('OLA10'))
    assert.ok(html.includes('28'))
    assert.ok(html.includes('Bankoverføring'))
    assert.ok(html.includes('28.07.2026'), 'Norwegian date format')
  })

  it('formats money with the existing e-mail formatter, not a new one', () => {
    const html = build().html

    // Asserted through `kr()` itself: it separates with a NON-BREAKING space so an amount
    // never wraps, and a literal here would silently diverge from that.
    assert.ok(html.includes(kr(12430)), 'revenue uses the shared formatter')
    assert.ok(html.includes(kr(1243.5)), 'payout amount keeps its øre')
    assert.ok(kr(1243.5).includes('1243,50'), 'precondition: øre are printed')
  })

  it('includes the reference row when a reference exists', () => {
    const { html, text } = build()
    assert.ok(html.includes('Referanse'))
    assert.ok(html.includes('BANK-9911'))
    assert.ok(text.includes('Referanse: BANK-9911'))
  })

  it('omits the reference row entirely when there is none', () => {
    for (const reference of [null, undefined, '', '   ']) {
      const { html, text } = build({ reference })
      assert.equal(html.includes('Referanse'), false, `html with ${JSON.stringify(reference)}`)
      assert.equal(text.includes('Referanse'), false, `text with ${JSON.stringify(reference)}`)
      // The rest of the card is unaffected.
      assert.ok(html.includes('Betalingsmåte'))
    }
  })
})

describe('createPartnerPayoutEmail — safety and encoding', () => {
  it('escapes a partner name containing markup', () => {
    const html = build({ partnerName: '<script>alert(1)</script>' }).html

    assert.equal(html.includes('<script>alert(1)</script>'), false)
    assert.ok(html.includes('&lt;script&gt;'))
  })

  it('escapes a reference containing markup', () => {
    const html = build({ reference: '"><b>x' }).html
    assert.equal(html.includes('"><b>x'), false)
  })

  it('keeps Norwegian characters intact', () => {
    const { html, text } = build({ partnerName: 'Bjørn Ærlig Ådne' })

    for (const s of [html, text]) {
      assert.ok(s.includes('Bjørn Ærlig Ådne'))
      assert.ok(s.includes('Betalingsmåte'))
      assert.ok(s.includes('partnerkjøp'))
    }
  })

  it('tolerates an unparseable payout date without throwing', () => {
    assert.doesNotThrow(() => build({ payoutDate: 'not a date' }))
  })

  it('produces a plain-text alternative for every e-mail', () => {
    const { text } = build()
    assert.ok(text.length > 100)
    assert.equal(text.includes('<'), false, 'the text part must carry no markup')
  })
})
