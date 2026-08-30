import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createOrderDeliveredEmail } from './order-delivered'
import { ANGRERETTSKJEMA_URL } from '@/lib/returDocuments'

/**
 * The delivered ("levert") e-mail — the one that carries the Kvittering. It must always
 * give the customer a way to reach the Angrerettskjema: attached when the sender got hold
 * of the file, and as a download link either way, so an unreachable Blob only changes the
 * wording.
 */

const DATA = {
  firstName: 'Kari',
  customerEmail: 'kari@example.no',
  orderNumber: 'AB-028412',
}

describe('delivered / receipt email', () => {
  it('still says the kvittering is attached', () => {
    const email = createOrderDeliveredEmail(DATA)
    assert.equal(email.subject, 'Kvittering for ordre #AB-028412')
    assert.ok(email.html.includes('Vedlagt finner du kvitteringen for kjøpet ditt.'))
    assert.ok(email.text.includes('Vedlagt finner du kvitteringen for kjøpet ditt.'))
  })

  it('links the angrerettskjema whether or not it was attached', () => {
    for (const attached of [true, false]) {
      const email = createOrderDeliveredEmail({ ...DATA, angrerettskjemaAttached: attached })
      assert.ok(
        email.html.includes(`href="${ANGRERETTSKJEMA_URL}"`),
        `no angrerettskjema link (attached=${attached})`,
      )
      assert.ok(email.html.includes('Last ned angrerettskjema'))
      assert.ok(email.text.includes(ANGRERETTSKJEMA_URL))
      assert.ok(email.html.includes('14 dagers angrerett'))
    }
  })

  it('says the skjema is enclosed only when it really is', () => {
    const attached = createOrderDeliveredEmail({ ...DATA, angrerettskjemaAttached: true })
    assert.ok(attached.html.includes('Angrerettskjemaet ligger vedlagt'))
    assert.ok(attached.text.includes('Angrerettskjemaet ligger vedlagt'))

    const linkOnly = createOrderDeliveredEmail({ ...DATA, angrerettskjemaAttached: false })
    assert.ok(!linkOnly.html.includes('Angrerettskjemaet ligger vedlagt'))
    assert.ok(linkOnly.html.includes('Angrerettskjemaet kan du laste ned her'))
  })

  it('defaults to the link-only wording when the flag is omitted', () => {
    const email = createOrderDeliveredEmail(DATA)
    assert.ok(!email.html.includes('ligger vedlagt'))
    assert.ok(email.html.includes(`href="${ANGRERETTSKJEMA_URL}"`))
  })
})
