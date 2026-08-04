import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createBusinessInquiryConfirmationEmail } from './business-inquiry-confirmation'
import { createAdminBusinessInquiryEmail, formatInquiryTimestamp } from './admin-business-inquiry'
import { createOrderDeliveredEmail } from './order-delivered'
import type { AdminBusinessInquiryData, BusinessInquiryData } from './types'

/**
 * The two e-mails one inquiry produces. Both must look like they came from the same system as
 * every other aBoks e-mail, so several of these assert shared chrome rather than describing a
 * new design — and both must escape everything, because every value in them was typed by a
 * stranger into a public form.
 */

const INQUIRY: BusinessInquiryData = {
  company: 'Nordisk Verksted AS',
  orgNumber: '123456789',
  contactPerson: 'Kari Nordmann',
  email: 'kari@nordiskverksted.no',
  phone: '+47 900 12 345',
  interest: 'aBoks Office',
  quantity: '25',
  message: 'Vi trenger batteriinnsamling på tre avdelinger.\n\nKan dere sende et tilbud?',
}

const ADMIN: AdminBusinessInquiryData = {
  ...INQUIRY,
  submittedAt: '2026-08-04T12:32:00.000Z',
  source: '/bedrifter',
}

const confirmation = (overrides: Partial<BusinessInquiryData> = {}) =>
  createBusinessInquiryConfirmationEmail({ ...INQUIRY, ...overrides })

const admin = (overrides: Partial<AdminBusinessInquiryData> = {}) =>
  createAdminBusinessInquiryEmail({ ...ADMIN, ...overrides })

/** The pieces that make an e-mail recognisably ours, taken from an existing template. */
const CHROME = [
  'logo-wf-new.png',
  'aBoks – Smart batteriorganisering',
  'mailto:post@aboks.no',
  'background:#f2ede4',
]

describe('createBusinessInquiryConfirmationEmail — subject and copy', () => {
  it('uses the agreed subject', () => {
    assert.equal(confirmation().subject, 'Vi har mottatt forespørselen din')
  })

  it('renders the agreed heading, greeting, intro and closing', () => {
    const { html, text } = confirmation()

    for (const part of [
      'Takk for forespørselen!',
      'Hei Kari Nordmann,',
      'Vi har mottatt forespørselen din og tar kontakt så snart som mulig.',
      'Nedenfor finner du en oppsummering av opplysningene du sendte inn.',
      'Forespørselen er uforpliktende.',
      'Med vennlig hilsen',
      'aBoks',
    ]) {
      assert.ok(html.includes(part), `html: ${part}`)
      assert.ok(text.includes(part), `text: ${part}`)
    }
  })

  it('reuses the shared aBoks layout — same header, logo and footer as other e-mails', () => {
    const html = confirmation().html
    const delivered = createOrderDeliveredEmail({
      firstName: 'Kari',
      customerEmail: 'a@b.no',
      orderNumber: 'AB-1',
    }).html

    for (const chrome of CHROME) {
      assert.ok(html.includes(chrome), `missing chrome: ${chrome}`)
      assert.ok(delivered.includes(chrome), `chrome not shared: ${chrome}`)
    }
  })

  it('produces a plain-text body alongside the HTML one', () => {
    const { html, text } = confirmation()
    assert.ok(text.length > 100)
    assert.ok(!text.includes('<'), 'plain text must not carry markup')
    assert.ok(html.startsWith('<!DOCTYPE html>'))
  })
})

describe('createBusinessInquiryConfirmationEmail — the summary', () => {
  it('renders every submitted field in both bodies', () => {
    const { html, text } = confirmation()

    for (const [label, value] of [
      ['Firmanavn', 'Nordisk Verksted AS'],
      ['Kontaktperson', 'Kari Nordmann'],
      ['E-post', 'kari@nordiskverksted.no'],
      ['Telefonnummer', '+47 900 12 345'],
      ['Omtrent antall produkter', '25'],
      ['Hva er dere interessert i?', 'aBoks Office'],
    ] as const) {
      assert.ok(html.includes(value), `html value: ${value}`)
      assert.ok(text.includes(`${label}: ${value}`), `text row: ${label}`)
    }

    assert.ok(html.includes('Vi trenger batteriinnsamling på tre avdelinger.'))
    assert.ok(text.includes('Vi trenger batteriinnsamling på tre avdelinger.'))
  })

  it('includes the organisation number when it was given', () => {
    assert.ok(confirmation().text.includes('Organisasjonsnummer: 123456789'))
  })

  it('omits optional fields cleanly when they were left blank', () => {
    const { html, text } = confirmation({
      phone: undefined,
      quantity: undefined,
      orgNumber: undefined,
    })

    for (const label of ['Telefonnummer', 'Omtrent antall produkter', 'Organisasjonsnummer']) {
      assert.ok(!html.includes(label), `html should not mention ${label}`)
      assert.ok(!text.includes(label), `text should not mention ${label}`)
    }
    // The rows that remain are untouched.
    assert.ok(html.includes('Nordisk Verksted AS'))
    assert.ok(text.includes('Firmanavn: Nordisk Verksted AS'))
  })

  it('keeps the customer’s line breaks readable', () => {
    assert.ok(confirmation().html.includes('white-space:pre-wrap'))
  })

  it('carries no internal metadata', () => {
    const { html, text } = confirmation()
    for (const leak of ['referansekode', 'turnstile', 'IP', 'user-agent', 'rate']) {
      assert.ok(!html.toLowerCase().includes(leak.toLowerCase()), `html leaks: ${leak}`)
      assert.ok(!text.toLowerCase().includes(leak.toLowerCase()), `text leaks: ${leak}`)
    }
  })
})

describe('createAdminBusinessInquiryEmail — subject and recipient-facing copy', () => {
  it('names the company in the subject', () => {
    assert.equal(admin().subject, 'Ny bedriftsforespørsel fra Nordisk Verksted AS')
  })

  it('falls back to the bare subject when the company name is missing', () => {
    assert.equal(admin({ company: '' }).subject, 'Ny bedriftsforespørsel')
  })

  it('reuses the shared aBoks layout', () => {
    const html = admin().html
    for (const chrome of CHROME) assert.ok(html.includes(chrome), `missing chrome: ${chrome}`)
  })

  it('produces both an HTML and a plain-text body', () => {
    const { html, text } = admin()
    assert.ok(html.startsWith('<!DOCTYPE html>'))
    assert.ok(!text.includes('<'))
  })
})

describe('createAdminBusinessInquiryEmail — the submitted data', () => {
  it('renders every submitted value', () => {
    const { html, text } = admin()

    for (const value of [
      'Nordisk Verksted AS',
      '123456789',
      'Kari Nordmann',
      'kari@nordiskverksted.no',
      '+47 900 12 345',
      '25',
      'aBoks Office',
      'Vi trenger batteriinnsamling på tre avdelinger.',
    ]) {
      assert.ok(html.includes(value), `html: ${value}`)
      assert.ok(text.includes(value), `text: ${value}`)
    }
  })

  it('marks an omitted optional field as "Ikke oppgitt" rather than dropping the row', () => {
    const { html, text } = admin({ phone: undefined, quantity: undefined, orgNumber: undefined })
    assert.ok(html.includes('Telefonnummer'))
    assert.ok(html.includes('Ikke oppgitt'))
    assert.ok(text.includes('Telefonnummer: Ikke oppgitt'))
    assert.ok(text.includes('Omtrent antall produkter: Ikke oppgitt'))
    assert.ok(text.includes('Organisasjonsnummer: Ikke oppgitt'))
  })

  it('makes the customer’s email a mailto link', () => {
    assert.ok(admin().html.includes('href="mailto:kari@nordiskverksted.no"'))
  })

  it('makes a supplied phone number a tel link, with the spaces stripped', () => {
    assert.ok(admin().html.includes('href="tel:+4790012345"'))
  })

  it('renders no tel link when no phone number was given', () => {
    assert.ok(!admin({ phone: undefined }).html.includes('href="tel:'))
  })

  it('records the submission time and the source page', () => {
    const { html, text } = admin()
    assert.ok(html.includes('/bedrifter'))
    assert.ok(text.includes('Kilde: /bedrifter'))
    assert.ok(text.includes('Mottatt: 04.08.2026 kl. 14:32'))
  })

  it('carries no IP address, user agent or honeypot state', () => {
    const { html, text } = admin()
    for (const leak of ['referansekode', 'turnstile', 'user-agent', 'ipHash']) {
      assert.ok(!html.toLowerCase().includes(leak.toLowerCase()), `html leaks: ${leak}`)
      assert.ok(!text.toLowerCase().includes(leak.toLowerCase()), `text leaks: ${leak}`)
    }
  })
})

describe('formatInquiryTimestamp', () => {
  it('formats an instant in Oslo time, matching the dd.MM.yyyy used elsewhere', () => {
    // 12:32 UTC in August is 14:32 in Oslo (CEST).
    assert.equal(formatInquiryTimestamp('2026-08-04T12:32:00.000Z'), '04.08.2026 kl. 14:32')
  })

  it('applies the winter offset too', () => {
    assert.equal(formatInquiryTimestamp('2026-01-04T12:32:00.000Z'), '04.01.2026 kl. 13:32')
  })

  it('prints an unparseable value verbatim rather than swallowing it', () => {
    assert.equal(formatInquiryTimestamp('not-a-date'), 'not-a-date')
  })
})

describe('escaping — every value in both e-mails is customer-typed', () => {
  const HOSTILE: BusinessInquiryData = {
    company: '<script>alert("xss")</script>',
    orgNumber: '123456789',
    contactPerson: 'Kari "K" & <b>Ola</b>',
    email: 'a"b@evil.no',
    phone: '+47 900 12 345',
    interest: 'Annet',
    quantity: '25',
    message: '<img src=x onerror="alert(1)"> & mer',
  }

  it('escapes markup in the customer confirmation', () => {
    const { html } = createBusinessInquiryConfirmationEmail(HOSTILE)
    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'))
    assert.ok(!html.includes('<img src=x'))
    assert.ok(html.includes('&amp; mer'))
  })

  it('escapes markup in the admin notification', () => {
    const { html } = createAdminBusinessInquiryEmail({
      ...HOSTILE,
      submittedAt: ADMIN.submittedAt,
      source: '/bedrifter',
    })
    assert.ok(!html.includes('<script>'))
    assert.ok(!html.includes('<b>Ola</b>'))
    assert.ok(html.includes('&lt;b&gt;Ola&lt;/b&gt;'))
  })

  it('escapes the quote in an address before it reaches a mailto attribute', () => {
    const { html } = createAdminBusinessInquiryEmail({
      ...HOSTILE,
      submittedAt: ADMIN.submittedAt,
      source: '/bedrifter',
    })
    assert.ok(html.includes('href="mailto:a&quot;b@evil.no"'))
    assert.ok(!html.includes('href="mailto:a"b@evil.no"'))
  })

  it('leaves the plain-text bodies unescaped, where entities would be shown literally', () => {
    const { text } = createBusinessInquiryConfirmationEmail(HOSTILE)
    assert.ok(text.includes('& mer'))
    assert.ok(!text.includes('&amp;'))
  })
})
