import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BATTERIBOKS_DESCRIPTION,
  BATTERIBOKS_FAQS,
  BATTERIBOKS_MODELS,
  BATTERIBOKS_PATH,
  buildFaqJsonLd,
  buildWebPageJsonLd,
  comparisonNote,
  comparisonRow,
  isModelSoldOut,
} from './batteriboks'
import { absoluteUrl } from './site'

describe('/batteriboks content', () => {
  it('lists each model once, with a unique slug', () => {
    const slugs = BATTERIBOKS_MODELS.map((m) => m.slug)
    assert.equal(new Set(slugs).size, slugs.length)
    assert.deepEqual(slugs, [
      'aboks',
      'aboks-mini',
      'aboks-nano',
      'aboks-vegg',
      'aboks-office',
      'aboks-spesial',
      'aboks-xl',
    ])
  })

  it('marks only Office as taking AAA in its AA room', () => {
    assert.deepEqual(
      BATTERIBOKS_MODELS.filter((m) => m.aaaInAaRoom).map((m) => m.slug),
      ['aboks-office'],
    )
  })

  it('answers the AA-only / AAA-only and used-only questions in the FAQ', () => {
    const ids = BATTERIBOKS_FAQS.map((f) => f.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.includes('bare-aa-aaa'))
    assert.ok(ids.includes('kun-brukte'))
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

/** The CMS capacity of each model as published on 2026-10-29. */
const CMS_CAPACITY: Record<string, { aa: number; aaa: number; usedCompartments: number }> = {
  aboks: { aa: 20, aaa: 36, usedCompartments: 1 },
  'aboks-mini': { aa: 20, aaa: 0, usedCompartments: 1 },
  'aboks-nano': { aa: 0, aaa: 36, usedCompartments: 1 },
  'aboks-vegg': { aa: 20, aaa: 36, usedCompartments: 1 },
  'aboks-office': { aa: 20, aaa: 0, usedCompartments: 1 },
  'aboks-spesial': { aa: 0, aaa: 0, usedCompartments: 1 },
  'aboks-xl': { aa: 0, aaa: 0, usedCompartments: 1 },
}

function rowsFor(slugs: string[]) {
  return BATTERIBOKS_MODELS.filter((m) => slugs.includes(m.slug)).map((m) =>
    comparisonRow({ ...m, capacity: CMS_CAPACITY[m.slug], aaaInAaRoom: m.aaaInAaRoom ?? false }),
  )
}

describe('/batteriboks comparison table', () => {
  it('prints the approved cells for every model', () => {
    const rows = rowsFor(Object.keys(CMS_CAPACITY))
    assert.deepEqual(
      rows.map((r) => [r.name, r.aa, r.aaa, r.used]),
      [
        ['aBoks', '20', '36', 'Eget rom'],
        ['aBoks Mini', '20', '–', 'Eget rom'],
        ['aBoks Nano', '–', '36', 'Eget rom'],
        ['aBoks Vegg', '20', '36', 'Eget rom'],
        ['aBoks Office', '20', 'Kan legges sammen med AA', 'Eget rom'],
        ['aBoks Spesial', '–', '–', 'Kun brukte'],
        ['aBoks XL', '–', '–', 'Kun brukte'],
      ],
    )
  })

  it('writes the approved note when Office, Spesial and XL are all shown', () => {
    assert.equal(
      comparisonNote(rowsFor(Object.keys(CMS_CAPACITY))),
      'I aBoks Office kan du legge AAA-batterier i rommet for nye AA-batterier, men modellen har ikke et eget AAA-rom. aBoks Spesial og XL er beregnet kun for brukte batterier.',
    )
  })

  it('only mentions models the table shows', () => {
    assert.equal(comparisonNote(rowsFor(['aboks', 'aboks-xl'])), 'aBoks XL er beregnet kun for brukte batterier.')
    assert.equal(comparisonNote(rowsFor(['aboks', 'aboks-mini'])), '')
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
