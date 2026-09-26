import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUOTE_PARAM,
  QUOTE_TEXT,
  quoteContextFor,
  quoteExplanationFor,
  quoteRequestHref,
  quoteRequestMessage,
  quoteRequestQuantityField,
  readQuoteRequestParams,
} from './quoteRequest'

/**
 * The «Be om tilbud» offer.
 *
 * Two things are being pinned down here: that the offer carries the figures the page actually
 * showed, and that a link into the enquiry form cannot be used to put words into it.
 */

const MINI = { slug: 'aboks-mini', title: 'aBoks Mini', price: 349 }
const XL = { slug: 'aboks-xl', title: 'aBoks XL', price: 849 }

describe('quote context', () => {
  it('prices the context through the shared engine', () => {
    const context = quoteContextFor(MINI, 40)
    assert.equal(context.productSlug, 'aboks-mini')
    assert.equal(context.quantity, 40)
    assert.equal(context.unitPrice, 249)
    assert.equal(context.lineTotal, 9960)
  })

  it('uses aBoks XL’s own price at its own threshold', () => {
    const context = quoteContextFor(XL, 11)
    assert.equal(context.unitPrice, 749)
    assert.equal(context.lineTotal, 8239)
  })

  it('writes a message naming the product, the quantity and the published price', () => {
    const message = quoteRequestMessage(quoteContextFor(MINI, 40))
    assert.match(message, /40 stk\. aBoks Mini/)
    // `formatPrice` separates with a non-breaking space, so the assertions do not insist on
    // which kind of space it is — only that the right figures are in the sentence.
    assert.match(message, /kr\s249 per stk\./)
    assert.match(message, /kr\s9\s960/)
  })

  it('prefills the quantity field with the quantity itself', () => {
    assert.equal(quoteRequestQuantityField(quoteContextFor(MINI, 40)), '40')
  })

  it('explains the offer with the product’s own threshold', () => {
    assert.equal(quoteExplanationFor(MINI), QUOTE_TEXT.explanation(40))
    assert.equal(quoteExplanationFor(XL), QUOTE_TEXT.explanation(11))
  })

  it('makes no offer for a product that has no threshold', () => {
    assert.equal(quoteExplanationFor({ slug: 'aa-modul' }), null)
  })
})

describe('quote links', () => {
  it('points at the existing enquiry form, with the product and quantity', () => {
    const href = quoteRequestHref({ productSlug: 'aboks-mini', quantity: 40 })
    assert.equal(href, `/bedrifter?${QUOTE_PARAM.product}=aboks-mini&${QUOTE_PARAM.quantity}=40#tilbud`)
  })

  it('rounds a quantity down to whole units and never below one', () => {
    assert.match(quoteRequestHref({ productSlug: 'aboks', quantity: 12.9 }), /antall=12/)
    assert.match(quoteRequestHref({ productSlug: 'aboks', quantity: 0 }), /antall=1/)
  })

  it('reads its own link back', () => {
    const href = quoteRequestHref({ productSlug: 'aboks-xl', quantity: 11 })
    const search = href.slice(href.indexOf('?'), href.indexOf('#'))
    assert.deepEqual(readQuoteRequestParams(search), { productSlug: 'aboks-xl', quantity: 11 })
  })

  it('refuses anything that is not a slug and a plain quantity', () => {
    const refused = [
      '',
      '?produkt=aboks-mini',
      '?antall=40',
      '?produkt=aboks-mini&antall=-5',
      '?produkt=aboks-mini&antall=1.5',
      '?produkt=aboks-mini&antall=1e3',
      '?produkt=aboks-mini&antall=mange',
      '?produkt=<script>&antall=40',
      '?produkt=aBoks Mini&antall=40',
      '?produkt=aboks-mini&antall=0',
    ]
    for (const search of refused) {
      assert.equal(readQuoteRequestParams(search), null, search)
    }
  })

  it('carries no free text, so a link cannot dictate the message', () => {
    // Even a crafted URL only ever yields a slug and a number; the sentence is rebuilt from
    // the catalogue at the far end.
    const parsed = readQuoteRequestParams('?produkt=aboks-mini&antall=40&melding=Send%20oss%20penger')
    assert.deepEqual(parsed, { productSlug: 'aboks-mini', quantity: 40 })
  })
})
