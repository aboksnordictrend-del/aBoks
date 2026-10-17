import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { promoCodeIdOf } from './PromoCodeCell'

/**
 * The payout list cell for `promoCode`. Every shape Payload may hand a relationship cell must
 * come out as the bare id, which Payload's own relationship cell can label.
 */
describe('PromoCodeCell — promoCodeIdOf', () => {
  it('keeps a bare id', () => {
    assert.equal(promoCodeIdOf(6), 6)
    assert.equal(promoCodeIdOf('6'), '6')
  })

  it('reads the id off a populated promo-code document (the join-list case)', () => {
    assert.equal(promoCodeIdOf({ id: 6, code: 'VERIFYPARTNER2', discountValue: 10 }), 6)
  })

  it('reads a { relationTo, value } pair, raw or populated', () => {
    assert.equal(promoCodeIdOf({ relationTo: 'promo-codes', value: 6 }), 6)
    assert.equal(promoCodeIdOf({ relationTo: 'promo-codes', value: { id: 6, code: 'X' } }), 6)
  })

  it('returns null for an empty or unreadable value', () => {
    for (const value of [null, undefined, '', {}, { id: null }, { value: null }, true]) {
      assert.equal(promoCodeIdOf(value), null, JSON.stringify(value))
    }
  })
})

describe('PromoCodeCell — a referral payout has no promo code', () => {
  it('renders a dash instead of «<No Rabattkode>»', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { default: PromoCodeCell } = await import('./PromoCodeCell')
    const html = renderToStaticMarkup(<PromoCodeCell {...({ cellData: null } as unknown as Parameters<typeof PromoCodeCell>[0])} />)
    assert.equal(html, '<span>—</span>')
  })
})

describe('PayoutSourceCell', () => {
  it('labels legacy NULL rows as Promokode and referral rows as Henvisningsprovisjon', async () => {
    const { payoutSourceLabel } = await import('./PayoutSourceCell')
    assert.equal(payoutSourceLabel(null), 'Promokode')
    assert.equal(payoutSourceLabel(undefined), 'Promokode')
    assert.equal(payoutSourceLabel('promoCode'), 'Promokode')
    assert.equal(payoutSourceLabel('referral'), 'Henvisningsprovisjon')
  })
})
