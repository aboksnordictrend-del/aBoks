import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@/payload-types'
import { createOrderShippedEmail } from './order-shipped'
import { buildOrderEmail } from '@/lib/orderEmails'

/**
 * What the customer actually reads in the tracking e-mail, and — crucially — that the
 * «Spor pakken» button's destination is decided by our own carrier map rather than by
 * anything stored on the order.
 *
 * Sibling of `orderDocuments.test.ts`, which covers the confirmation e-mail, the admin
 * e-mail and the PDF receipt.
 */

const ITEMS = [{ displayName: 'aBoks Vegg – Mørk blå', quantity: 1, unitPrice: 449, lineTotal: 449 }]

const BASE = {
  customerName: 'Inge Martin',
  customerEmail: 'inge@example.no',
  orderNumber: 'AB-028412',
  items: ITEMS,
  total: 518,
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
    status: 'shipped',
    customerInfo: {
      email: 'inge@example.no',
      firstName: 'Inge',
      lastName: 'Martin',
      address: 'Storgata 1',
      postalCode: '0155',
      city: 'Oslo',
    },
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  } as unknown as Order
}

/* ------------------------------ carrier + number ------------------------------ */

describe('shipped e-mail — carrier and tracking number', () => {
  it('names PostNord and prints the tracking number', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'postnord',
      trackingNumber: '707123456789',
    })

    assert.ok(email.html.includes('Pakken er sendt med <strong style="color:#1a1d17;">PostNord</strong>.'))
    assert.ok(email.html.includes('Sendingsnummer'))
    assert.ok(email.html.includes('707123456789'))
    assert.ok(email.text.includes('Pakken er sendt med PostNord.'))
    assert.ok(email.text.includes('Sendingsnummer: 707123456789'))
  })

  it('names Posten', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'posten',
      trackingNumber: '707123456789',
    })

    assert.ok(email.html.includes('>Posten</strong>'))
    assert.ok(!email.html.includes('PostNord'), 'the wrong carrier must never appear')
    assert.ok(email.text.includes('Pakken er sendt med Posten.'))
  })

  it('names Helthjem', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'helthjem',
      trackingNumber: 'HJ-99887766',
    })

    assert.ok(email.html.includes('>Helthjem</strong>'))
    assert.ok(email.html.includes('HJ-99887766'))
    assert.ok(email.text.includes('Pakken er sendt med Helthjem.'))
  })

  it('keeps the established subject', () => {
    const email = createOrderShippedEmail({ ...BASE, shippingCarrier: 'posten', trackingNumber: '1' })
    assert.equal(email.subject, 'Bestillingen din er sendt – Ordre #AB-028412')
  })

  it('opens with «Bestillingen din er sendt!» and greets the customer', () => {
    const email = createOrderShippedEmail({ ...BASE, shippingCarrier: 'posten', trackingNumber: '1' })
    assert.ok(email.html.includes('Bestillingen din er sendt!'))
    assert.ok(email.html.includes('Hei Inge Martin,'))
    assert.ok(email.html.includes('Takk for at du handler hos aBoks!'))
  })

  it('keeps the existing order details and branding', () => {
    const email = createOrderShippedEmail({ ...BASE, shippingCarrier: 'posten', trackingNumber: '1' })
    assert.ok(email.html.includes('#AB-028412'), 'order number')
    assert.ok(email.html.includes('Sendte produkter'), 'item table heading')
    assert.ok(email.html.includes('aBoks Vegg – Mørk blå'), 'the snapshotted product name')
    assert.ok(email.html.includes('kr 518,-'), 'total paid — kr() uses a non-breaking space')
    assert.ok(email.html.includes('logo-wf-new.png'), 'the shared aBoks header')
    assert.ok(email.html.includes('post@aboks.no'), 'the shared footer')
  })
})

/* ------------------------------ the CTA button ------------------------------ */

describe('«Spor pakken» button', () => {
  const buttonHrefs = (html: string) =>
    [...html.matchAll(/<a href="([^"]+)"[^>]*>\s*Spor pakken/g)].map((m) => m[1])

  it('links PostNord to postnord.no', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'postnord',
      trackingNumber: '707123456789',
    })

    assert.deepEqual(buttonHrefs(email.html), ['https://www.postnord.no/'])
    assert.ok(email.text.includes('Spor pakken: https://www.postnord.no/'))
  })

  it('links Posten to posten.no', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'posten',
      trackingNumber: '707123456789',
    })

    assert.deepEqual(buttonHrefs(email.html), ['https://www.posten.no/'])
    assert.ok(email.text.includes('Spor pakken: https://www.posten.no/'))
  })

  it('links Helthjem to helthjem.no/sporing', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'helthjem',
      trackingNumber: '707123456789',
    })

    assert.deepEqual(buttonHrefs(email.html), ['https://helthjem.no/sporing'])
    assert.ok(email.text.includes('Spor pakken: https://helthjem.no/sporing'))
  })

  it('renders no button at all for an unrecognised carrier', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      // Only reachable by writing straight to the database — the field and the allow-list
      // both refuse it. It must degrade to no link, never to an arbitrary one.
      shippingCarrier: 'https://evil.example/phish' as never,
      trackingNumber: '707123456789',
    })

    assert.deepEqual(buttonHrefs(email.html), [])
    assert.ok(!email.html.includes('evil.example'))
    assert.ok(!email.text.includes('evil.example'))
  })
})

/* --------------------------- backward compatibility --------------------------- */

describe('orders with no shipment data', () => {
  it('renders the original fallback when both are missing', () => {
    const email = createOrderShippedEmail(BASE)

    assert.ok(email.html.includes('Sporingsinformasjon vil bli tilgjengelig hos fraktselskapet.'))
    assert.ok(!email.html.includes('Spor pakken'))
    assert.ok(email.text.includes('Sporingsinformasjon blir tilgjengelig hos fraktselskapet.'))
  })

  it('still renders every other part of the e-mail', () => {
    const email = createOrderShippedEmail(BASE)

    assert.equal(email.subject, 'Bestillingen din er sendt – Ordre #AB-028412')
    assert.ok(email.html.includes('#AB-028412'))
    assert.ok(email.html.includes('aBoks Vegg – Mørk blå'))
    assert.ok(email.html.includes('kr 518,-'))
  })

  it('prints a tracking number even when the carrier is unknown', () => {
    const email = createOrderShippedEmail({ ...BASE, trackingNumber: '707123456789' })

    assert.ok(email.html.includes('707123456789'))
    assert.ok(!email.html.includes('Spor pakken'), 'no carrier means no destination')
  })

  it('treats a blank tracking number as absent', () => {
    const email = createOrderShippedEmail({ ...BASE, trackingNumber: '   ' })
    assert.ok(email.html.includes('Sporingsinformasjon vil bli tilgjengelig hos fraktselskapet.'))
  })
})

/* ------------------------------ buildOrderEmail ------------------------------ */

describe('buildOrderEmail — shipped', () => {
  it('reads the carrier and the tracking number off the stored order', () => {
    const built = buildOrderEmail(
      'shipped',
      orderDoc({ shippingCarrier: 'helthjem', trackingNumber: '707123456789' }),
    )

    assert.ok(built)
    assert.equal(built!.to, 'inge@example.no')
    assert.ok(built!.template.html.includes('Helthjem'))
    assert.ok(built!.template.html.includes('707123456789'))
    assert.ok(built!.template.html.includes('https://helthjem.no/sporing'))
  })

  it('trims a stored tracking number that carries stray whitespace', () => {
    const built = buildOrderEmail(
      'shipped',
      orderDoc({ shippingCarrier: 'posten', trackingNumber: '  707123456789  ' }),
    )

    assert.ok(built!.template.html.includes('>707123456789</p>'))
  })

  it('does not crash on an order that predates the Forsendelse fields', () => {
    // Neither key is present at all — exactly how a row written before the migration reads.
    const built = buildOrderEmail('shipped', orderDoc())

    assert.ok(built)
    assert.ok(built!.template.html.includes('Sporingsinformasjon vil bli tilgjengelig'))
    assert.ok(!built!.template.html.includes('Spor pakken'))
  })

  it('drops a carrier value that is not on the allow-list', () => {
    const built = buildOrderEmail(
      'shipped',
      orderDoc({ shippingCarrier: 'bring' as never, trackingNumber: '707123456789' }),
    )

    assert.ok(!built!.template.html.includes('Spor pakken'))
    assert.ok(!built!.template.html.includes('bring'))
  })
})

/* --------------------------------- escaping --------------------------------- */

describe('escaping', () => {
  it('escapes the tracking number', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'postnord',
      trackingNumber: '<script>alert(1)</script>',
    })

    assert.ok(!email.html.includes('<script>'))
    assert.ok(email.html.includes('&lt;script&gt;'))
  })

  it('escapes the customer name', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      customerName: '<img src=x onerror=alert(1)>',
      shippingCarrier: 'postnord',
      trackingNumber: '707123456789',
    })

    assert.ok(!email.html.includes('<img src=x'))
    assert.ok(email.html.includes('&lt;img src=x'))
  })

  it('leaves an ordinary e-mail unescaped', () => {
    const email = createOrderShippedEmail({
      ...BASE,
      shippingCarrier: 'postnord',
      trackingNumber: '707123456789',
    })

    assert.ok(!email.html.includes('&amp;'), 'nothing was needlessly escaped')
  })
})
