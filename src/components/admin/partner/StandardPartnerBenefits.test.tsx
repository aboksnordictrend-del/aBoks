import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import StandardPartnerBenefits from './StandardPartnerBenefits'

/** «Standard partnerfordeler»: information only, the three programme methods and their rates. */

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('StandardPartnerBenefits', () => {
  const html = renderToStaticMarkup(<StandardPartnerBenefits />)
  const t = text(html)

  it('lists the three standard methods with the programme rates', () => {
    assert.ok(t.includes('Standard partnerfordeler'))
    assert.ok(t.includes('Promokode — 15 % provisjon'))
    assert.ok(t.includes('Bedriftssalg — 25 % provisjon'))
    assert.ok(t.includes('Forhandlersalg — 15 % provisjon'))
  })

  it('says the Promokode rate and base live on each promo code', () => {
    assert.ok(t.includes('Faktisk provisjonssats og beregningsgrunnlag settes på hver enkelt rabattkode.'))
  })

  it('uses the agreed Bedriftssalg wording', () => {
    assert.ok(t.includes('Partneren får 25 % provisjon av endelig betalt ordrebeløp.'))
  })

  it('is information only: no inputs, checkboxes or buttons', () => {
    assert.doesNotMatch(html, /<(input|select|button|textarea)\b/)
  })
})
