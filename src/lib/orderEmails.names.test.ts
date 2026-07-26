import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@/payload-types'
import { buildOrderEmail } from './orderEmails'

// Regression guard for the bug where every e-mail line was rendered as
// "aBoks – <farge>" because the templates composed the name from a hardcoded literal
// instead of reading the snapshot stored on the order. Covers every template that lists
// products: order confirmation, the admin copy, and "ordren er sendt".

const ITEM_TEMPLATES = ['confirmation', 'admin', 'shipped'] as const

const orderWith = (items: Array<Record<string, unknown>>): Order =>
  ({
    id: 1,
    orderNumber: 'AB-2001',
    status: 'confirmed',
    customerInfo: {
      email: 'kari@example.com',
      firstName: 'Kari',
      lastName: 'Nordmann',
      address: 'Storgata 1',
      postalCode: '0155',
      city: 'Oslo',
    },
    items,
    subtotal: 1000,
    shipping: 0,
    total: 1000,
  }) as unknown as Order

const line = (displayName: string, variantName: string) => ({
  displayName,
  variantName,
  quantity: 1,
  unitPrice: 499,
  lineTotal: 499,
})

describe('order e-mails print the stored line name', () => {
  const names = [
    'aBoks – Mørk blå',
    'aBoks Vegg – Mørk blå',
    'aBoks Mini – Mørk blå',
    'aBoks Nano – Mørk blå',
  ]
  const order = orderWith(names.map((n) => line(n, 'Mørk blå')))

  for (const kind of ITEM_TEMPLATES) {
    it(`${kind}: every product keeps its own name in HTML and plain text`, () => {
      const built = buildOrderEmail(kind, order)
      assert.ok(built)
      for (const name of names) {
        assert.ok(built.template.html.includes(name), `HTML is missing "${name}"`)
        assert.ok(built.template.text.includes(name), `text is missing "${name}"`)
      }
    })

    it(`${kind}: a Vegg line is never rendered as a plain aBoks line`, () => {
      const veggOnly = orderWith([line('aBoks Vegg – Mørk blå', 'Mørk blå')])
      const built = buildOrderEmail(kind, veggOnly)
      assert.ok(built)
      // "aBoks – Mørk blå" must not appear anywhere: that was the reported symptom.
      assert.ok(!built.template.html.includes('aBoks – Mørk blå'))
      assert.ok(!built.template.text.includes('aBoks - Mørk blå'))
      assert.ok(built.template.html.includes('aBoks Vegg – Mørk blå'))
      assert.ok(built.template.text.includes('aBoks Vegg – Mørk blå'))
    })

    it(`${kind}: a legacy line without a snapshot shows the colour, not a guessed product`, () => {
      const legacy = orderWith([
        { variantName: 'Mørk blå', quantity: 1, unitPrice: 499, lineTotal: 499 },
      ])
      const built = buildOrderEmail(kind, legacy)
      assert.ok(built)
      assert.ok(built.template.html.includes('Mørk blå'))
      assert.ok(!built.template.html.includes('aBoks – Mørk blå'))
    })
  }
})
