import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@/payload-types'
import { buildReceiptModel, formatNok, formatDateNo, generateReceiptPdf } from './receiptPdf'
import { sendOrderEmail } from './orderEmails'

process.env.EMAIL_SEND_TIMEOUT_MS = '150'
// Offline: never hit the blob URL during tests — forces the text-logo fallback.
process.env.RECEIPT_LOGO_URL = ''

beforeEach(() => {
  mock.method(console, 'log', () => {})
  mock.method(console, 'error', () => {})
})

afterEach(() => {
  delete process.env.COMPANY_ORG_NR
  delete process.env.COMPANY_NAME
})

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 7,
    orderNumber: 'AB-1042',
    status: 'delivered',
    customerInfo: {
      email: 'kari@example.com',
      firstName: 'Kari',
      lastName: 'Nordmann',
      address: 'Storgata 1',
      postalCode: '0155',
      city: 'Oslo',
    },
    items: [
      { variantName: 'Sort', quantity: 2, unitPrice: 499, lineTotal: 998 },
      { variantName: 'Blå ørken', quantity: 1, unitPrice: 301, lineTotal: 301 },
    ],
    subtotal: 1299,
    shipping: 0,
    total: 1299,
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-16T09:00:00.000Z',
    ...overrides,
  }) as unknown as Order

/** Every string the receipt model puts on the page, for content assertions. */
function allText(model: ReturnType<typeof buildReceiptModel>): string {
  return JSON.stringify(model)
}

describe('formatNok', () => {
  it('uses the Norwegian format with a space separator and comma decimals', () => {
    assert.equal(formatNok(1299), '1 299,00 kr')
    assert.equal(formatNok(499.5), '499,50 kr')
    assert.equal(formatNok(1234567), '1 234 567,00 kr')
    assert.equal(formatNok(0), '0,00 kr')
    assert.equal(formatNok(-50), '-50,00 kr')
  })
})

describe('formatDateNo', () => {
  it('formats to dd.mm.yyyy and tolerates missing input', () => {
    assert.equal(formatDateNo('2026-07-10T09:00:00.000Z'), '10.07.2026')
    assert.equal(formatDateNo(null), '')
    assert.equal(formatDateNo('not-a-date'), '')
  })
})

describe('buildReceiptModel', () => {
  it('never mentions MVA, Faktura, or a tax rate anywhere', () => {
    const text = allText(buildReceiptModel(order()))
    assert.doesNotMatch(text, /mva/i)
    assert.doesNotMatch(text, /faktura/i)
    assert.doesNotMatch(text, /inkl\.|eks\./i)
    assert.doesNotMatch(text, /25\s?%|\bavgift/i)
  })

  it('titles the document KVITTERING and marks it Betalt', () => {
    const model = buildReceiptModel(order())
    assert.equal(model.title, 'KVITTERING')
    assert.equal(model.paymentStatus, 'Betalt')
    assert.equal(model.seller, 'LUKOCIUS NORDICTREND')
  })

  it('renders the paid total exactly from the stored order amount', () => {
    const model = buildReceiptModel(order({ total: 1299 }))
    const totalRow = model.totals.find((r) => r.strong)
    assert.ok(totalRow)
    assert.equal(totalRow.label, 'Totalt betalt')
    assert.equal(totalRow.value, formatNok(1299))
    assert.equal(totalRow.value, '1 299,00 kr')
  })

  it('keeps line items, variant names and quantities from the order', () => {
    const model = buildReceiptModel(order())
    assert.equal(model.lines.length, 2)
    assert.equal(model.lines[0].name, 'aBoks – Sort')
    assert.equal(model.lines[0].quantity, 2)
    assert.equal(model.lines[0].unitPrice, '499,00 kr')
    assert.equal(model.lines[0].lineTotal, '998,00 kr')
    assert.equal(model.lines[1].name, 'aBoks – Blå ørken')
  })

  it('shows Gratis frakt when shipping is zero and an amount otherwise', () => {
    const free = buildReceiptModel(order({ shipping: 0 }))
    assert.equal(free.totals.find((r) => r.label === 'Frakt')?.value, 'Gratis')

    const paid = buildReceiptModel(order({ shipping: 79, subtotal: 1299, total: 1378 }))
    assert.equal(paid.totals.find((r) => r.label === 'Frakt')?.value, '79,00 kr')
  })

  it('derives a discount row only from the stored amounts', () => {
    // subtotal 1299 + frakt 0 − total 1099 = 200 discount, computed, not recalculated.
    const model = buildReceiptModel(order({ subtotal: 1299, shipping: 0, total: 1099 }))
    const discount = model.totals.find((r) => r.label === 'Rabatt')
    assert.ok(discount)
    assert.equal(discount.value, '-200,00 kr')

    const noDiscount = buildReceiptModel(order())
    assert.equal(
      noDiscount.totals.find((r) => r.label === 'Rabatt'),
      undefined,
    )
  })

  it('defaults the seller to LUKOCIUS NORDICTREND with its org number', () => {
    delete process.env.COMPANY_NAME
    delete process.env.COMPANY_ORG_NR
    const model = buildReceiptModel(order())
    assert.equal(model.seller, 'LUKOCIUS NORDICTREND')
    assert.equal(model.sellerOrgNr, '937 172 877')
  })

  it('lets COMPANY_NAME / COMPANY_ORG_NR override the seller in one place', () => {
    process.env.COMPANY_NAME = 'ABOKS AS'
    process.env.COMPANY_ORG_NR = '123 456 789'
    const model = buildReceiptModel(order())
    assert.equal(model.seller, 'ABOKS AS')
    assert.equal(model.sellerOrgNr, '123 456 789')
  })
})

describe('generateReceiptPdf', () => {
  it('produces a valid PDF (offline, text-logo fallback)', async () => {
    const bytes = await generateReceiptPdf(order())
    assert.ok(bytes.length > 500, 'a non-trivial PDF was produced')
    // %PDF- magic header.
    assert.deepEqual(Array.from(bytes.slice(0, 5)), [0x25, 0x50, 0x44, 0x46, 0x2d])
  })

  it('handles Norwegian characters and long names without throwing', async () => {
    const bytes = await generateReceiptPdf(
      order({
        customerInfo: {
          email: 'ø@example.no',
          firstName: 'Åse',
          lastName: 'Ørnæsæ',
          address: 'En veldig lang gateadresse som garantert må brytes over flere linjer 12B',
          postalCode: '9999',
          city: 'Båtsfjord',
        },
        items: [{ variantName: 'Grønn ørkenutgave med et ekstra langt navn', quantity: 3, unitPrice: 399, lineTotal: 1197 }],
        subtotal: 1197,
        total: 1197,
      }),
    )
    assert.ok(bytes.length > 500)
  })
})

describe('sendOrderEmail — receipt PDF failure', () => {
  it('returns not-ok and never sends when PDF generation throws', async () => {
    const sent: unknown[] = []
    const payload = {
      sendEmail: async (msg: unknown) => {
        sent.push(msg)
        return { messageId: '<should-not-happen@zoho>' }
      },
    }

    // Fault injection: a corrupt `items` (non-array) makes the model builder — and thus
    // generateReceiptPdf — throw, standing in for any PDF-generation failure.
    const corrupt = order({ items: 5 as unknown as Order['items'] })

    const result = await sendOrderEmail(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload as any,
      'receipt',
      corrupt,
      { orderId: corrupt.id, orderNumber: corrupt.orderNumber },
    )

    assert.equal(result.ok, false)
    assert.equal(sent.length, 0, 'a PDF failure must abort before the send')
    if (!result.ok) assert.match(result.error, /PDF generation failed/)
  })
})
