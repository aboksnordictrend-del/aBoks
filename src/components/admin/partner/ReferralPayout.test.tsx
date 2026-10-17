import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Payload } from 'payload'
import ReferralPayoutModalBody, { referralPayoutFigures, type ReferralPayoutModalBodyProps } from './ReferralPayoutModalBody'
import { ReferralAdjustmentTable, ReferralPayoutTable } from './ReferralHistoryTables'
import { loadReferralPayoutState, type AdjustmentRow, type PayableSaleRow } from '@/lib/partner/referralPayoutState'

/**
 * Rendering tests for the referral payout dialog and history, and the loader behind them.
 */

const text = (node: React.ReactElement): string =>
  renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const SALES: PayableSaleRow[] = [
  { id: '11', title: 'Sport 1 Lillestrøm – 01.10.2026', category: 'retailStore', saleDate: '2026-10-01T10:00:00.000Z', commissionAmount: 1_830 },
  { id: '12', title: 'Bedrift AS – 05.10.2026', category: 'businessSale', saleDate: '2026-10-05T10:00:00.000Z', commissionAmount: 250 },
]

const ADJ: AdjustmentRow = {
  id: '1',
  title: 'Tilbakeføring – Sport 1 – 01.09.2026',
  saleId: '9',
  amount: -300,
  reason: 'refundedAfterPayout',
  createdAt: '2026-10-10T10:00:00.000Z',
  settledByPayoutId: null,
  settledAt: null,
}

const noop = () => {}
const props = (overrides: Partial<ReferralPayoutModalBodyProps> = {}): ReferralPayoutModalBodyProps => ({
  partnerName: 'Ola Nordmann',
  bankAccount: '1234.56.78901',
  sales: SALES,
  adjustments: [],
  selected: new Set(['11', '12']),
  payoutDate: '2026-10-17',
  method: 'bankTransfer',
  reference: '',
  note: '',
  busy: false,
  error: '',
  onToggle: noop,
  onToggleAll: noop,
  onPayoutDateChange: noop,
  onMethodChange: noop,
  onReferenceChange: noop,
  onNoteChange: noop,
  onCancel: noop,
  onSubmit: noop,
  ...overrides,
})

const submitDisabled = (html: string) => /<button[^>]*disabled=""[^>]*>Registrer utbetaling<\/button>/.test(html)

describe('referralPayoutFigures', () => {
  it('sums the selection and deducts every adjustment, in exact øre', () => {
    assert.deepEqual(referralPayoutFigures(SALES, new Set(['11', '12']), [ADJ]), { grossOere: 208_000, deductedOere: 30_000, netOere: 178_000 })
    assert.deepEqual(referralPayoutFigures(SALES, new Set(['12']), [ADJ]), { grossOere: 25_000, deductedOere: 30_000, netOere: -5_000 })
  })
})

describe('ReferralPayoutModalBody', () => {
  it('lists the earned sales, the partner and the amount to pay, in Norwegian', () => {
    const t = text(<ReferralPayoutModalBody {...props()} />)
    for (const expected of ['Ola Nordmann', '1234.56.78901', 'Sport 1 Lillestrøm', 'Forhandlersalg – fysisk butikk', 'Bedriftssalg', 'Beløp som utbetales', '2 080,00', 'Promokode-provisjon utbetales separat']) {
      assert.ok(t.includes(expected), `missing «${expected}» in: ${t}`)
    }
  })

  it('shows every outstanding adjustment as a deduction, with no way to untick it', () => {
    const html = renderToStaticMarkup(<ReferralPayoutModalBody {...props({ adjustments: [ADJ] })} />)
    const t = text(<ReferralPayoutModalBody {...props({ adjustments: [ADJ] })} />)
    assert.ok(t.includes('Justeringer som trekkes'))
    assert.ok(t.includes('Tilbakeføring – Sport 1'))
    assert.ok(t.includes('1 780,00'), t)
    // Checkboxes exist only for sales (2) and «select all» (1).
    assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3)
  })

  it('disables the button and explains when adjustments exceed the selection', () => {
    const p = props({ adjustments: [ADJ], selected: new Set(['12']) })
    const html = renderToStaticMarkup(<ReferralPayoutModalBody {...p} />)
    assert.ok(submitDisabled(html))
    assert.ok(text(<ReferralPayoutModalBody {...p} />).includes('Velg flere salg'))
  })

  it('disables the button with nothing selected, and while busy', () => {
    assert.ok(submitDisabled(renderToStaticMarkup(<ReferralPayoutModalBody {...props({ selected: new Set() })} />)))
    assert.ok(text(<ReferralPayoutModalBody {...props({ busy: true })} />).includes('Registrerer …'))
    assert.ok(!submitDisabled(renderToStaticMarkup(<ReferralPayoutModalBody {...props()} />)))
  })

  it('shows the server error', () => {
    assert.ok(text(<ReferralPayoutModalBody {...props({ error: 'Beløpet har endret seg' })} />).includes('Beløpet har endret seg'))
  })
})

describe('Referral history tables', () => {
  it('shows payouts with gross, deduction, net and a link', () => {
    const html = renderToStaticMarkup(
      <ReferralPayoutTable
        rows={[{ id: '500', payoutDate: '2026-10-17T00:00:00.000Z', amount: 1_780, grossAmount: 2_080, deductedAmount: 300, saleCount: 2, paymentMethod: 'vipps', reference: 'V-1' }]}
      />,
    )
    assert.match(html, /href="\/admin\/collections\/partner-payouts\/500"/)
    const t = html.replace(/<[^>]+>/g, ' ').replace(/[\s  ]+/g, ' ')
    // formatNOK uses a real minus sign (U+2212) for the deduction.
    for (const expected of ['17.10.2026', '2 080,00', '−300,00', '1 780,00', 'Vipps', 'V-1']) {
      assert.ok(t.includes(expected), `missing ${expected}: ${t}`)
    }
    assert.ok(text(<ReferralPayoutTable rows={[]} />).includes('Ingen utbetalinger av henvisningsprovisjon registrert.'))
  })

  it('marks adjustments as outstanding or deducted, linking each', () => {
    const outstanding = text(<ReferralAdjustmentTable rows={[ADJ]} />)
    assert.ok(outstanding.includes('Utestående – trekkes fra neste utbetaling'))
    assert.ok(outstanding.includes('Refundert etter utbetaling'))
    const settledHtml = renderToStaticMarkup(
      <ReferralAdjustmentTable rows={[{ ...ADJ, settledByPayoutId: '500', settledAt: '2026-10-17T00:00:00.000Z' }]} />,
    )
    assert.match(settledHtml, /Trukket 17\.10\.2026/)
    assert.match(settledHtml, /href="\/admin\/collections\/partner-payouts\/500"/)
    assert.match(settledHtml, /href="\/admin\/collections\/referral-commission-adjustments\/1"/)
  })
})

describe('loadReferralPayoutState', () => {
  it('builds the panel from three queries, excluding promo payouts', async () => {
    const queries: { collection: string; where: unknown }[] = []
    const payload = {
      find: async ({ collection, where }: { collection: string; where: unknown }) => {
        queries.push({ collection, where })
        if (collection === 'referral-sales') {
          return {
            docs: [
              { id: 11, title: 'A', category: 'retailStore', commissionStatus: 'earned', commissionAmount: 1_830, payout: null },
              { id: 12, title: 'B', category: 'businessSale', commissionStatus: 'paid', commissionAmount: 250, payout: 500 },
              { id: 13, title: 'C', category: 'businessSale', commissionStatus: 'earned', commissionAmount: 0, payout: null },
              { id: 14, title: 'D', category: 'retailStore', commissionStatus: 'pending', commissionAmount: 100, payout: null },
            ],
          }
        }
        if (collection === 'referral-commission-adjustments') {
          return { docs: [{ id: 1, title: 'J', amount: -300, settledByPayout: null }, { id: 2, title: 'K', amount: -50, settledByPayout: 500 }] }
        }
        return { docs: [{ id: 500, amount: 250, referralGrossAmount: 250, referralDeductedAmount: 0, referralSales: [12], paymentMethod: 'vipps' }] }
      },
    } as unknown as Payload

    const state = await loadReferralPayoutState(payload, 3)
    assert.equal(queries.length, 3)
    assert.deepEqual(queries[2].where, { and: [{ partner: { equals: 3 } }, { source: { equals: 'referral' } }] })
    assert.deepEqual(state.payableSales.map((s) => s.id), ['11'])
    assert.deepEqual(state.outstandingAdjustments.map((a) => a.id), ['1'])
    assert.equal(state.adjustments.length, 2)
    assert.equal(state.totals.payableOere, 153_000)
    assert.equal(state.totals.paidOutOere, 25_000)
    assert.equal(state.payouts[0].saleCount, 1)
  })
})
