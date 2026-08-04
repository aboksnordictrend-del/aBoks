import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import InquiryForm from './InquiryForm'
import {
  INQUIRY_SUBMIT_LABELS,
  InquirySubmitButton,
  inquirySubmitLabel,
} from './InquirySubmitButton'
import { INQUIRY_FEEDBACK, InquiryFeedbackPanel } from './InquiryFeedback'

/**
 * What the visitor can actually see and press. The submission logic itself lives in
 * @/lib/bedrifter/submitInquiry and is covered there; these assert the surface — including
 * the two things this change had to remove: the "not sent yet" notice and the prefilled
 * mailto that used to stand in for a backend.
 */

const noop = () => {}

const form = (interest = ''): string =>
  renderToStaticMarkup(<InquiryForm interest={interest} onInterestChange={noop} />)

const button = (pending: boolean): string =>
  renderToStaticMarkup(<InquirySubmitButton pending={pending} />)

describe('inquiry submit button', () => {
  it('invites submission when idle', () => {
    const html = button(false)
    assert.ok(html.includes('>Send forespørsel</button>'))
    assert.ok(!html.includes('disabled'))
    assert.match(html, /aria-busy="false"/)
  })

  it('is natively disabled while the request is in flight', () => {
    const html = button(true)
    assert.match(html, /disabled/)
    assert.match(html, /aria-busy="true"/)
  })

  it('says "Sender…" while sending', () => {
    assert.ok(button(true).includes('>Sender…</button>'))
    assert.equal(INQUIRY_SUBMIT_LABELS.pending, 'Sender…')
    assert.equal(inquirySubmitLabel(true), INQUIRY_SUBMIT_LABELS.pending)
    assert.equal(inquirySubmitLabel(false), INQUIRY_SUBMIT_LABELS.idle)
  })

  it('is a real submit button, so Enter in a text field still works', () => {
    assert.match(button(false), /type="submit"/)
  })

  it('keeps the olive pill styling the page already used', () => {
    const html = button(false)
    assert.match(html, /border-radius:999px/)
    assert.match(html, /background:#39402c/)
    assert.match(html, /data-btn/)
  })
})

describe('submission feedback', () => {
  it('shows the agreed success confirmation', () => {
    const html = renderToStaticMarkup(<InquiryFeedbackPanel kind="success" />)
    assert.ok(html.includes('Takk for forespørselen!'))
    assert.ok(html.includes('sendt en bekreftelse til e-postadressen du oppga'))
    assert.ok(html.includes('Vi tar kontakt så snart som mulig.'))
  })

  it('shows the agreed server-error state', () => {
    const html = renderToStaticMarkup(<InquiryFeedbackPanel kind="error" />)
    assert.ok(html.includes('Forespørselen kunne ikke sendes'))
    assert.ok(html.includes('Prøv igjen om litt, eller kontakt oss på post@aboks.no.'))
  })

  it('prefers the server’s own message when it sent one', () => {
    const html = renderToStaticMarkup(
      <InquiryFeedbackPanel kind="error" message="For mange forsøk. Prøv igjen om en liten stund." />,
    )
    assert.ok(html.includes('For mange forsøk.'))
    assert.ok(!html.includes(INQUIRY_FEEDBACK.error.body))
  })

  it('never tells the customer to send the inquiry themselves', () => {
    for (const kind of ['success', 'error'] as const) {
      const html = renderToStaticMarkup(<InquiryFeedbackPanel kind={kind} />)
      assert.ok(!html.includes('e-postprogram'))
      assert.ok(!html.includes('Send som e-post'))
    }
  })
})

describe('the inquiry form itself', () => {
  it('renders idle, with an enabled submit button', () => {
    const html = form()
    assert.ok(html.includes('>Send forespørsel</button>'))
    assert.ok(!html.includes('disabled'))
  })

  it('shows neither the success nor the error panel before anything is submitted', () => {
    const html = form()
    assert.ok(!html.includes('Takk for forespørselen!'))
    assert.ok(!html.includes('Forespørselen kunne ikke sendes'))
  })

  it('no longer claims the inquiry has not been sent', () => {
    const html = form()
    assert.ok(!html.includes('Forespørselen er ikke sendt ennå'))
    assert.ok(!html.includes('automatisk innsending er ikke koblet på'))
  })

  it('has no "Send som e-post" button', () => {
    assert.ok(!form().includes('Send som e-post'))
  })

  it('generates no prefilled mailto — no subject, no body, no form data in a link', () => {
    const html = form()
    assert.ok(!html.includes('mailto:post@aboks.no?'))
    assert.ok(!html.includes('subject='))
    assert.ok(!html.includes('body='))
  })

  it('keeps the plain contact address as a fallback, which is not a submission mechanism', () => {
    const html = form()
    assert.ok(html.includes('href="mailto:post@aboks.no"'))
  })

  it('keeps every field, label and the responsive layout', () => {
    const html = form()

    for (const label of [
      'Bedriftsnavn',
      'Organisasjonsnummer',
      'Kontaktperson',
      'E-post',
      'Telefonnummer',
      'Omtrent antall produkter',
      'Hva er dere interessert i?',
      'Melding',
    ]) {
      assert.ok(html.includes(label), `missing label: ${label}`)
    }

    assert.ok(html.includes('grid grid-cols-1 sm:grid-cols-2'))
    assert.ok(html.includes('Forespørselen er uforpliktende.'))
  })

  it('keeps the preselected interest from the "Meld interesse" buttons', () => {
    const html = form('aBoks Office')
    assert.match(html, /<option selected="" value="aBoks Office">|value="aBoks Office" selected/)
  })

  it('carries a hidden honeypot that no real user can see or tab to', () => {
    const html = form()
    assert.ok(html.includes('name="referansekode"'))
    assert.ok(html.includes('left:-9999px'))
    assert.ok(html.includes('tabindex="-1"'))
  })

  it('announces submission progress through a live region', () => {
    const html = form()
    assert.ok(html.includes('role="status"'))
    assert.ok(html.includes('aria-live="polite"'))
  })
})
