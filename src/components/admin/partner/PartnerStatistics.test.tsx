import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PartnerStatistics } from '@/lib/partner/statistics'
import { EMPTY_PARTNER_BALANCE } from '@/lib/partner/balance'
import PartnerSummaryCards from './PartnerSummaryCards'
import PartnerSalesTable, { STATUS_LABEL } from './PartnerSalesTable'
import PartnerPayoutTable from './PartnerPayoutTable'

/**
 * Rendering tests for the read-only partner panel. These render the real components with
 * react-dom/server, so what is asserted is the actual markup an admin would see — not a
 * description of it.
 */

const render = (node: React.ReactElement): string => renderToStaticMarkup(node)

/** Markup with tags stripped, for asserting on visible text. */
const text = (node: React.ReactElement): string =>
  render(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stats = (overrides: Partial<PartnerStatistics> = {}): PartnerStatistics => ({
  balance: { ...EMPTY_PARTNER_BALANCE },
  revenue: 0,
  counts: { valid: 0, excluded: 0, cancelled: 0, missingOrder: 0, legacy: 0 },
  sales: [],
  payouts: [],
  ...overrides,
})

const salesRow = (overrides: Partial<PartnerStatistics['sales'][number]> = {}) => ({
  usageId: '1',
  usedAt: '2026-07-20T10:00:00.000Z',
  orderNumber: 'AB-028412',
  orderAmountBeforeDiscount: 449,
  discountAmount: 44.9,
  commissionBasis: 404.1,
  commissionAmount: 40.41,
  status: 'delivered' as const,
  counted: true,
  ...overrides,
})

/* ------------------------------ summary cards ------------------------------ */

describe('PartnerSummaryCards', () => {
  it('shows the four titles in the agreed order', () => {
    const html = text(
      <PartnerSummaryCards
        stats={stats({
          counts: { valid: 28, excluded: 0, cancelled: 0, missingOrder: 0, legacy: 0 },
        })}
      />,
    )

    const order = ['Bruk', 'Omsetning', 'Opptjent provisjon', 'Til utbetaling']
    const positions = order.map((t) => html.indexOf(t))
    assert.ok(positions.every((p) => p >= 0), `missing a card: ${html}`)
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'cards are out of order')
  })

  it('renders the values it is given, formatted as Norwegian kroner', () => {
    const html = text(
      <PartnerSummaryCards
        stats={stats({
          revenue: 12430,
          balance: { ...EMPTY_PARTNER_BALANCE, earnedCommission: 1243, availableToPay: 540 },
          counts: { valid: 28, excluded: 0, cancelled: 0, missingOrder: 0, legacy: 0 },
        })}
      />,
    )

    assert.ok(html.includes('28'), 'use count')
    assert.ok(html.includes('12 430,00 kr'), `revenue — got: ${html}`)
    assert.ok(html.includes('1 243,00 kr'), 'earned commission')
    assert.ok(html.includes('540,00 kr'), 'outstanding balance')
  })

  it('shows the Norwegian helper text under each card', () => {
    const html = text(<PartnerSummaryCards stats={stats()} />)

    for (const help of ['Gyldige partnerkjøp', 'Gyldig omsetning', 'Totalt opptjent']) {
      assert.ok(html.includes(help), help)
    }
  })

  it('renders zeroes rather than blanks when there is no history', () => {
    const html = text(<PartnerSummaryCards stats={stats()} />)

    assert.ok(html.includes('0'), 'zero use count')
    assert.equal((html.match(/0,00 kr/g) ?? []).length, 3, 'three zeroed money cards')
  })

  it('marks only the outstanding-balance card as highlighted', () => {
    const html = render(<PartnerSummaryCards stats={stats()} />)
    assert.equal((html.match(/cardHighlight/g) ?? []).length, 1)
  })

  it('lays the cards out in a responsive grid container', () => {
    // The 4 / 2x2 / stacked behaviour is media-query driven in the stylesheet; what the
    // markup must guarantee is that all four cards live in the one grid container.
    const html = render(<PartnerSummaryCards stats={stats()} />)
    assert.equal((html.match(/class="cards"/g) ?? []).length, 1, 'one grid container')
    assert.equal((html.match(/class="card[ "]/g) ?? []).length, 4, 'all four cards inside it')
  })
})

/* ------------------------------ sales table ------------------------------ */

describe('PartnerSalesTable', () => {
  it('shows the Norwegian empty state when there are no usages', () => {
    assert.ok(text(<PartnerSalesTable rows={[]} />).includes('Ingen registrerte partnerkjøp ennå.'))
  })

  it('renders the agreed columns', () => {
    const html = text(<PartnerSalesTable rows={[salesRow()]} />)

    for (const col of [
      'Dato',
      'Ordre',
      'Omsetning før rabatt',
      'Rabatt',
      'Grunnlag for provisjon',
      'Provisjon',
      'Status',
    ]) {
      assert.ok(html.includes(col), col)
    }
  })

  it('renders a counted row with formatted money and the order number', () => {
    const html = text(<PartnerSalesTable rows={[salesRow()]} />)

    assert.ok(html.includes('20.07.2026'), `date — got: ${html}`)
    assert.ok(html.includes('AB-028412'), 'order number')
    assert.ok(html.includes('449,00 kr'), 'revenue')
    assert.ok(html.includes('44,90 kr'), 'discount')
    assert.ok(html.includes('404,10 kr'), 'commission basis')
    assert.ok(html.includes('40,41 kr'), 'commission')
    assert.ok(html.includes('Levert'), 'status badge')
  })

  it('shows a cancelled row with its snapshot, marked as not counted', () => {
    const node = <PartnerSalesTable rows={[salesRow({ status: 'cancelled', counted: false })]} />

    // Visible text (formatNOK separates with a non-breaking space, which `text` normalises).
    const visible = text(node)
    assert.ok(visible.includes('Kansellert'))
    assert.ok(visible.includes('40,41 kr'), `the commission snapshot is still shown — ${visible}`)

    // Styling hooks come from the raw markup.
    const html = render(node)
    assert.ok(html.includes('rowMuted'), 'the row reads as secondary')
    assert.ok(html.includes('badgeExcluded'))
  })

  it('shows a legacy row with dashes instead of invented amounts', () => {
    const html = text(
      <PartnerSalesTable
        rows={[
          salesRow({
            status: 'legacy',
            counted: false,
            orderAmountBeforeDiscount: null,
            discountAmount: null,
            commissionBasis: null,
            commissionAmount: null,
          }),
        ]}
      />,
    )

    assert.ok(html.includes('Eldre registrering'))
    assert.equal((html.match(/—/g) ?? []).length, 4, 'four unavailable amounts')
    assert.equal(html.includes('0,00 kr'), false, 'must never show a missing value as zero')
  })

  it('shows a missing-order row', () => {
    const html = text(<PartnerSalesTable rows={[salesRow({ status: 'order_missing', counted: false })]} />)
    assert.ok(html.includes('Manglende ordre'))
  })

  it('renders a dash for a missing order number or date', () => {
    const html = text(<PartnerSalesTable rows={[salesRow({ orderNumber: null, usedAt: null })]} />)
    assert.ok(html.includes('—'))
  })

  it('preserves the order it is given (the server sorts newest first)', () => {
    const html = text(
      <PartnerSalesTable
        rows={[
          salesRow({ usageId: '2', orderNumber: 'AB-000002' }),
          salesRow({ usageId: '1', orderNumber: 'AB-000001' }),
        ]}
      />,
    )
    assert.ok(html.indexOf('AB-000002') < html.indexOf('AB-000001'))
  })

  it('exposes a Norwegian label for every status', () => {
    for (const label of Object.values(STATUS_LABEL)) {
      assert.ok(label.length > 0)
    }
    assert.equal(STATUS_LABEL.confirmed, 'Bekreftet')
    assert.equal(STATUS_LABEL.shipped, 'Sendt')
    assert.equal(STATUS_LABEL.delivered, 'Levert')
    assert.equal(STATUS_LABEL.cancelled, 'Kansellert')
    assert.equal(STATUS_LABEL.order_missing, 'Manglende ordre')
    assert.equal(STATUS_LABEL.legacy, 'Eldre registrering')
  })

  it('leaks no customer data even if a row carried some', () => {
    const html = render(<PartnerSalesTable rows={[salesRow()]} />)
    for (const forbidden of ['@', 'telefon', 'adresse', 'Frakt']) {
      assert.equal(html.includes(forbidden), false, forbidden)
    }
  })

  it('keeps a wide table inside its own scroll container', () => {
    const html = render(<PartnerSalesTable rows={[salesRow()]} />)
    assert.ok(html.includes('tableWrap'), 'the page itself must never scroll sideways')
  })
})

/* ------------------------------ payout table ------------------------------ */

describe('PartnerPayoutTable', () => {
  it('shows the Norwegian empty state when there are no payouts', () => {
    assert.ok(text(<PartnerPayoutTable rows={[]} />).includes('Ingen utbetalinger registrert.'))
  })

  it('renders the agreed columns', () => {
    const html = text(
      <PartnerPayoutTable
        rows={[{ payoutId: '1', payoutDate: '2026-07-20T00:00:00.000Z', amount: 250, paymentMethod: 'bankTransfer', reference: 'B-1' }]}
      />,
    )

    for (const col of ['Dato', 'Beløp', 'Metode', 'Referanse']) {
      assert.ok(html.includes(col), col)
    }
  })

  it('renders a payout with a Norwegian method label and formatted amount', () => {
    const html = text(
      <PartnerPayoutTable
        rows={[{ payoutId: '1', payoutDate: '2026-07-20T00:00:00.000Z', amount: 1250, paymentMethod: 'bankTransfer', reference: 'B-1' }]}
      />,
    )

    assert.ok(html.includes('20.07.2026'))
    assert.ok(html.includes('1 250,00 kr'))
    assert.ok(html.includes('Bankoverføring'), 'method label from the collection options')
    assert.ok(html.includes('B-1'))
  })

  it('labels every payment method', () => {
    for (const [method, label] of [['vipps', 'Vipps'], ['other', 'Annet'], ['bankTransfer', 'Bankoverføring']] as const) {
      const html = text(
        <PartnerPayoutTable rows={[{ payoutId: '1', payoutDate: null, amount: 1, paymentMethod: method, reference: null }]} />,
      )
      assert.ok(html.includes(label), method)
    }
  })

  it('renders dashes for a missing reference or date', () => {
    const html = text(
      <PartnerPayoutTable rows={[{ payoutId: '1', payoutDate: null, amount: 10, paymentMethod: 'other', reference: null }]} />,
    )
    assert.equal((html.match(/—/g) ?? []).length, 2)
  })

  it('contains no edit, delete or action controls', () => {
    const html = render(
      <PartnerPayoutTable
        rows={[{ payoutId: '1', payoutDate: '2026-07-20T00:00:00.000Z', amount: 250, paymentMethod: 'vipps', reference: 'V-1' }]}
      />,
    )

    for (const control of ['<button', '<form', '<input', '<a ', 'Slett', 'Rediger', 'Registrer utbetaling']) {
      assert.equal(html.includes(control), false, `must not render ${control}`)
    }
  })
})
