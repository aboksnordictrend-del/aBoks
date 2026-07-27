import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@/payload-types'
import { createOrderConfirmationEmail } from './order-confirmation'
import { createAdminOrderEmail } from './admin-order'
import { buildOrderEmail } from '@/lib/orderEmails'
import { buildReceiptModel } from '@/lib/receiptPdf'

/**
 * Presentation-level tests for the three order documents (customer e-mail, admin e-mail, PDF
 * receipt). They assert what a customer actually reads, and — crucially — that a document is
 * built from the stored order alone: no catalogue lookup, no promo validation, no live
 * service is reachable from any of these functions.
 */

const ITEMS = [{ displayName: 'aBoks Vegg – Mørk blå', quantity: 1, unitPrice: 449, lineTotal: 449 }]
const ADDRESS = { address: 'Storgata 1', postalCode: '0155', city: 'Oslo' }

const base = {
  customerName: 'Kari Nordmann',
  customerEmail: 'kari@example.no',
  orderNumber: 'AB-028412',
  items: ITEMS,
  shippingAddress: ADDRESS,
}

const PLAIN = { ...base, subtotal: 449, shipping: 69, total: 518 }
const DISCOUNTED = {
  ...base,
  subtotal: 449,
  shipping: 69,
  total: 473.1,
  discount: { code: 'WELCOME10', discountAmount: 44.9 },
}

/** A stored order document, as Payload holds it. */
function orderDoc(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNumber: 'AB-028412',
    items: [
      {
        displayName: 'aBoks Vegg – Mørk blå',
        variantName: 'Mørk blå',
        quantity: 1,
        unitPrice: 449,
        lineTotal: 449,
      },
    ],
    subtotal: 449,
    shipping: 69,
    total: 518,
    status: 'confirmed',
    customerInfo: {
      email: 'kari@example.no',
      firstName: 'Kari',
      lastName: 'Nordmann',
      address: 'Storgata 1',
      postalCode: '0155',
      city: 'Oslo',
    },
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
    ...overrides,
  } as unknown as Order
}

const DISCOUNT_GROUP = {
  code: 'WELCOME10',
  discountType: 'percentage' as const,
  discountValue: 10,
  discountAmount: 44.9,
  subtotalBeforeDiscount: 449,
  subtotalAfterDiscount: 404.1,
  totalBeforeDiscount: 518,
  totalAfterDiscount: 473.1,
}

/* ------------------------------ customer e-mail ------------------------------ */

describe('customer confirmation e-mail', () => {
  it('shows no discount row for an ordinary order', () => {
    const email = createOrderConfirmationEmail(PLAIN)
    assert.ok(!email.html.includes('Rabatt'))
    assert.ok(!email.text.includes('Rabatt'))
    // The three familiar rows are still there.
    for (const label of ['Delsum', 'Frakt', 'Totalt']) {
      assert.ok(email.html.includes(label), label)
      assert.ok(email.text.includes(label), label)
    }
    assert.ok(email.text.includes('Totalt: kr 518,-'))
  })

  it('shows Rabatt (CODE) with the stored amount for a discounted order', () => {
    const email = createOrderConfirmationEmail(DISCOUNTED)
    assert.ok(email.html.includes('Rabatt (WELCOME10)'))
    assert.ok(email.text.includes('Rabatt (WELCOME10): −kr 44,90'))
    assert.ok(email.text.includes('Delsum: kr 449,-'), 'subtotal stays pre-discount')
    assert.ok(email.text.includes('Totalt: kr 473,10'))
  })

  it('renders a fixed-amount promo', () => {
    const email = createOrderConfirmationEmail({
      ...base,
      subtotal: 449,
      shipping: 69,
      total: 418,
      discount: { code: 'ABOKS100', discountAmount: 100 },
    })
    assert.ok(email.html.includes('Rabatt (ABOKS100)'))
    assert.ok(email.text.includes('Totalt: kr 418,-'))
  })

  it('keeps free shipping rendering as Gratis alongside a discount', () => {
    const email = createOrderConfirmationEmail({
      ...base,
      subtotal: 700,
      shipping: 0,
      total: 600,
      discount: { code: 'SOMMER100', discountAmount: 100 },
    })
    assert.ok(email.html.includes('Gratis'))
    assert.ok(email.text.includes('Frakt: Gratis'))
    assert.ok(email.text.includes('Rabatt (SOMMER100)'))
  })

  it('does not touch the line items', () => {
    const email = createOrderConfirmationEmail(DISCOUNTED)
    // The unit/line price stays the catalogue price stored on the order — the discount is
    // never divided across units.
    assert.ok(email.html.includes('aBoks Vegg – Mørk blå'))
    assert.ok(email.html.includes('kr 449,-'))
    assert.ok(!email.html.includes('kr 404,10'), 'no invented discounted line price')
  })
})

/* ------------------------------ admin e-mail ------------------------------ */

describe('admin new-order e-mail', () => {
  it('shows no discount row for an ordinary order', () => {
    const email = createAdminOrderEmail(PLAIN)
    assert.ok(!email.html.includes('Rabatt'))
    assert.ok(email.text.includes('Totalt: kr 518,-'))
  })

  it('shows the code, the discount and the new total', () => {
    const email = createAdminOrderEmail(DISCOUNTED)
    assert.ok(email.html.includes('Rabatt (WELCOME10)'))
    assert.ok(email.text.includes('Rabatt (WELCOME10): −kr 44,90'))
    assert.ok(email.text.includes('Totalt: kr 473,10'))
  })

  it('shows the customer and the admin exactly the same figures', () => {
    const customer = createOrderConfirmationEmail(DISCOUNTED)
    const admin = createAdminOrderEmail(DISCOUNTED)
    for (const line of ['Delsum: kr 449,-', 'Rabatt (WELCOME10): −kr 44,90', 'Totalt: kr 473,10']) {
      assert.ok(customer.text.includes(line), `customer: ${line}`)
      assert.ok(admin.text.includes(line), `admin: ${line}`)
    }
  })
})

/* ------------------------------ from the stored order ------------------------------ */

describe('buildOrderEmail — reads the stored snapshot only', () => {
  it('passes the stored promo through to the customer e-mail', () => {
    const built = buildOrderEmail('confirmation', orderDoc({ total: 473.1, discount: DISCOUNT_GROUP }))
    assert.ok(built?.template.html.includes('Rabatt (WELCOME10)'))
  })

  it('passes it to the admin e-mail too', () => {
    const built = buildOrderEmail('admin', orderDoc({ total: 473.1, discount: DISCOUNT_GROUP }))
    assert.ok(built?.template.html.includes('Rabatt (WELCOME10)'))
  })

  it('omits the row for an order with no promo', () => {
    const built = buildOrderEmail('confirmation', orderDoc())
    assert.ok(!built?.template.html.includes('Rabatt'))
  })

  it('omits the row when a promo group exists but records no amount', () => {
    const built = buildOrderEmail(
      'confirmation',
      orderDoc({ discount: { ...DISCOUNT_GROUP, discountAmount: 0 } }),
    )
    assert.ok(!built?.template.html.includes('Rabatt'))
  })

  it('still renders a promo the database no longer has', () => {
    // `promoCode` (the relationship) is null because the code was deleted; the snapshot text
    // is what gets printed, so the document is unchanged.
    const built = buildOrderEmail(
      'confirmation',
      orderDoc({ total: 473.1, discount: { ...DISCOUNT_GROUP, promoCode: null } }),
    )
    assert.ok(built?.template.html.includes('Rabatt (WELCOME10)'))
    assert.ok(built?.template.text.includes('Totalt: kr 473,10'))
  })
})

/* ------------------------------ PDF receipt ------------------------------ */

describe('PDF receipt model', () => {
  it('shows Delsum, Frakt and Totalt betalt for an ordinary order — unchanged', () => {
    const model = buildReceiptModel(orderDoc())
    assert.deepEqual(
      model.totals.map((t) => t.label),
      ['Delsum', 'Frakt', 'Totalt betalt'],
    )
    assert.equal(model.totals.at(-1)?.value, '518,00 kr')
    assert.equal(model.totals.at(-1)?.strong, true)
  })

  it('inserts Rabatt (CODE) between Frakt and Totalt betalt', () => {
    const model = buildReceiptModel(orderDoc({ total: 473.1, discount: DISCOUNT_GROUP }))
    assert.deepEqual(
      model.totals.map((t) => t.label),
      ['Delsum', 'Frakt', 'Rabatt (WELCOME10)', 'Totalt betalt'],
    )
    assert.equal(model.totals[2].value, '-44,90 kr')
    assert.equal(model.totals[3].value, '473,10 kr')
  })

  it('stays internally consistent: subtotal − discount + shipping === total', () => {
    const model = buildReceiptModel(orderDoc({ total: 473.1, discount: DISCOUNT_GROUP }))
    const parse = (v: string) => Math.round(Number(v.replace(/[^\d,-]/g, '').replace(',', '.')) * 100)
    const [delsum, frakt, rabatt, totalt] = model.totals.map((t) => parse(t.value))
    assert.equal(delsum + frakt + rabatt, totalt)
  })

  it('keeps free shipping as Gratis', () => {
    const model = buildReceiptModel(
      orderDoc({ subtotal: 700, shipping: 0, total: 600, discount: { ...DISCOUNT_GROUP, discountAmount: 100 } }),
    )
    assert.equal(model.totals[1].value, 'Gratis')
    assert.equal(model.totals[2].label, 'Rabatt (WELCOME10)')
  })

  it('still prints a legacy order whose reduction predates the promo snapshot', () => {
    // No discount group at all, but total < subtotal + shipping — the receipt has always
    // inferred a Rabatt row here, and it still does (without a code).
    const model = buildReceiptModel(orderDoc({ total: 473.1 }))
    assert.deepEqual(
      model.totals.map((t) => t.label),
      ['Delsum', 'Frakt', 'Rabatt', 'Totalt betalt'],
    )
  })

  it('never mentions MVA, even on a discounted order', () => {
    const model = buildReceiptModel(orderDoc({ total: 473.1, discount: DISCOUNT_GROUP }))
    const serialised = JSON.stringify(model)
    for (const forbidden of ['MVA', 'mva', 'Faktura']) {
      assert.ok(!serialised.includes(forbidden), forbidden)
    }
  })

  it('leaves the line rows at their stored prices', () => {
    const model = buildReceiptModel(orderDoc({ total: 473.1, discount: DISCOUNT_GROUP }))
    assert.equal(model.lines[0].unitPrice, '449,00 kr')
    assert.equal(model.lines[0].lineTotal, '449,00 kr')
    assert.equal(model.lines[0].quantity, 1)
  })
})

/* ------------------------------ audit fix 5: HTML escaping ------------------------------ */

const HOSTILE = {
  script: '<script>alert(1)</script>',
  img: '<img src=x onerror=alert(1)>',
  amp: 'Sergej & Pavel',
  quoted: '"quoted" <name>',
}

describe('email HTML escaping', () => {
  it('escapes a customer name carrying markup', () => {
    const email = createOrderConfirmationEmail({ ...PLAIN, customerName: HOSTILE.script })
    assert.ok(!email.html.includes('<script>'), 'no executable markup survives')
    assert.ok(email.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  })

  it('escapes an event-handler injection in the address', () => {
    const email = createOrderConfirmationEmail({
      ...PLAIN,
      shippingAddress: { address: HOSTILE.img, postalCode: '0155', city: HOSTILE.script },
    })
    // The property that matters is that the injected payload never becomes a live tag.
    // (`onerror=alert(1)` survives as literal text between escaped entities, which is inert;
    // and the document legitimately contains the aBoks logo <img>, so a bare '<img' check
    // would be meaningless.)
    assert.ok(!email.html.includes('<img src=x'), 'the injected tag never opens')
    assert.ok(!email.html.includes('onerror=alert(1)>'), 'no attribute can close a tag')
    assert.ok(email.html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  })

  it('escapes ampersands and quotes without mangling the text', () => {
    const email = createOrderConfirmationEmail({ ...PLAIN, customerName: HOSTILE.amp })
    assert.ok(email.html.includes('Sergej &amp; Pavel'))
    // The plain-text body stays human-readable — entities there would be shown literally.
    assert.ok(email.text.includes('Sergej & Pavel'))
  })

  it('escapes every customer field in the admin e-mail, including the mailto href', () => {
    const email = createAdminOrderEmail({
      ...PLAIN,
      customerName: HOSTILE.quoted,
      customerEmail: '"evil"@x.no',
      customerPhone: HOSTILE.img,
      shippingAddress: { address: HOSTILE.script, postalCode: '0155', city: HOSTILE.amp },
    })
    assert.ok(!email.html.includes('<script>'))
    assert.ok(!email.html.includes('<img src=x'))
    assert.ok(email.html.includes('&quot;quoted&quot; &lt;name&gt;'))
    // A quote in the address must not break out of the href attribute.
    assert.ok(!email.html.includes('href="mailto:"evil"@x.no"'))
    assert.ok(email.html.includes('&quot;evil&quot;@x.no'))
    assert.ok(email.html.includes('0155 Sergej &amp; Pavel'))
  })

  it('escapes the product display name', () => {
    const email = createOrderConfirmationEmail({
      ...PLAIN,
      items: [{ displayName: HOSTILE.img, quantity: 1, unitPrice: 449, lineTotal: 449 }],
    })
    assert.ok(!email.html.includes('<img src=x'))
    assert.ok(email.html.includes('&lt;img src=x'))
  })

  it('escapes the promo code in the discount row', () => {
    const email = createOrderConfirmationEmail({
      ...DISCOUNTED,
      discount: { code: HOSTILE.script, discountAmount: 44.9 },
    })
    assert.ok(!email.html.includes('<script>'))
    assert.ok(email.html.includes('Rabatt (&lt;script&gt;'))
  })

  it('leaves an ordinary order byte-identical apart from nothing', () => {
    // No hostile input: escaping must not alter normal output at all.
    const email = createOrderConfirmationEmail(PLAIN)
    assert.ok(email.html.includes('Takk for bestillingen, Kari Nordmann!'))
    assert.ok(email.html.includes('aBoks Vegg – Mørk blå'))
    assert.ok(!email.html.includes('&amp;'), 'nothing was needlessly escaped')
  })
})
