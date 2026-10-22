import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BATTERIBOKS_DESCRIPTION,
  BATTERIBOKS_FAQS,
  BATTERIBOKS_MODELS,
  BATTERIBOKS_PATH,
  buildFaqJsonLd,
  buildWebPageJsonLd,
  isModelSoldOut,
} from './batteriboks'
import { absoluteUrl } from './site'

describe('/batteriboks content', () => {
  it('lists each model once, with a unique slug', () => {
    const slugs = BATTERIBOKS_MODELS.map((m) => m.slug)
    assert.equal(new Set(slugs).size, slugs.length)
    assert.deepEqual(slugs, ['aboks', 'aboks-mini', 'aboks-nano', 'aboks-vegg', 'aboks-office', 'aboks-xl'])
  })

  it('keeps the meta description within the length search engines show', () => {
    assert.ok(BATTERIBOKS_DESCRIPTION.length <= 160, `${BATTERIBOKS_DESCRIPTION.length} characters`)
  })

  it('never claims lithium batteries belong in aBoks', () => {
    const lithium = BATTERIBOKS_FAQS.find((f) => f.id === 'litium')
    assert.ok(lithium?.answer.startsWith('Nei.'))
  })
})

describe('/batteriboks JSON-LD', () => {
  it('builds an FAQPage from exactly the questions the page shows', () => {
    const ld = buildFaqJsonLd()
    assert.equal(ld['@type'], 'FAQPage')
    assert.equal(ld.mainEntity.length, BATTERIBOKS_FAQS.length)
    ld.mainEntity.forEach((q, i) => {
      assert.equal(q['@type'], 'Question')
      assert.equal(q.name, BATTERIBOKS_FAQS[i].question)
      assert.equal(q.acceptedAnswer.text, BATTERIBOKS_FAQS[i].answer)
    })
  })

  it('builds a WebPage with the absolute canonical URL and the site WebSite id', () => {
    const ld = buildWebPageJsonLd('https://aboks.no/images/aboks-olive.webp')
    assert.equal(ld['@type'], 'WebPage')
    assert.equal(ld.url, absoluteUrl(BATTERIBOKS_PATH))
    assert.equal(ld.inLanguage, 'nb-NO')
    assert.match(ld.isPartOf['@id'], /\/#website$/)
  })
})

describe('isModelSoldOut', () => {
  it('reads the product stock when there are no variants', () => {
    assert.equal(isModelSoldOut({ stock: 0 }, []), true)
    assert.equal(isModelSoldOut({ stock: 3 }, []), false)
  })

  it('is sold out only when every variant is', () => {
    assert.equal(isModelSoldOut({ stock: 0 }, [{ inventory: 0 }, { inventory: 2 }]), false)
    assert.equal(isModelSoldOut({ stock: 9 }, [{ inventory: 0 }, { inventory: null }]), true)
  })
})
