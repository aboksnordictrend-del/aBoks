import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createOrderDeliveredEmail } from './order-delivered'

/**
 * The delivered ("levert") e-mail — the one that carries the Kvittering and the
 * Angrerettskjema as attachments. The body only thanks the customer and names what is
 * enclosed: no angrerett explainer and no download link, so the return documents live on
 * /frakt-og-retur and in the attachments, not in the e-mail copy.
 */

const DATA = {
  firstName: 'Kari',
  customerEmail: 'kari@example.no',
  orderNumber: 'AB-028412',
}

describe('delivered / receipt email', () => {
  it('keeps the subject and the personalisation', () => {
    const email = createOrderDeliveredEmail(DATA)
    assert.equal(email.subject, 'Kvittering for ordre #AB-028412')
    assert.ok(email.html.includes('Hei Kari,'))
    assert.ok(email.html.includes('#AB-028412'))
    assert.ok(email.text.startsWith('Hei Kari,'))
    assert.ok(email.text.includes('Din ordre #AB-028412 er nå levert.'))
  })

  it('thanks the customer and names both enclosed documents', () => {
    const email = createOrderDeliveredEmail({ ...DATA, angrerettskjemaAttached: true })
    for (const rendering of [email.html, email.text]) {
      assert.ok(rendering.includes('Takk for at du valgte aBoks! Vi håper du blir fornøyd med kjøpet ditt.'))
      assert.ok(rendering.includes('Vedlagt finner du kvittering og angrerettskjema for bestillingen.'))
    }
  })

  it('names the kvittering alone when the skjema could not be attached', () => {
    const email = createOrderDeliveredEmail({ ...DATA, angrerettskjemaAttached: false })
    assert.ok(email.html.includes('Vedlagt finner du kvittering for bestillingen.'))
    assert.ok(!email.html.includes('og angrerettskjema'))
  })

  it('has no angrerett block and no download link', () => {
    for (const attached of [true, false]) {
      const email = createOrderDeliveredEmail({ ...DATA, angrerettskjemaAttached: attached })
      for (const rendering of [email.html, email.text]) {
        assert.ok(!rendering.includes('14 dagers angrerett'), 'the angrerett explainer is gone')
        assert.ok(!rendering.includes('Last ned angrerettskjema'), 'the download link is gone')
        assert.ok(!rendering.includes('Angrerettskjema.pdf'), 'no link to the Blob file')
      }
    }
  })

  it('still points the customer at support', () => {
    const email = createOrderDeliveredEmail(DATA)
    assert.ok(email.html.includes('mailto:post@aboks.no'))
    assert.ok(email.text.includes('post@aboks.no'))
    assert.ok(email.text.trimEnd().endsWith('Vennlig hilsen\naBoks'))
  })
})
