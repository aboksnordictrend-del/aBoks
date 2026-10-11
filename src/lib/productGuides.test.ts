import assert from 'node:assert/strict'
import test from 'node:test'
import { productGuide } from './productGuides'

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'

/**
 * The model → PDF mapping, spelled out exactly as the files were uploaded. A model given
 * another model's guide would hand a customer the wrong instructions, so every one is
 * pinned rather than only spot-checked.
 */
const EXPECTED: Record<string, { kind: string; url: string }> = {
  aboks: { kind: 'bruksveiledning', url: `${BLOB}/aBoks-Bruksveiledning.pdf` },
  'aboks-mini': { kind: 'bruksveiledning', url: `${BLOB}/aBoks-Mini-Bruksveiledning.pdf` },
  'aboks-nano': { kind: 'bruksveiledning', url: `${BLOB}/aBoks-Nano-Bruksveiledning.pdf` },
  'aboks-office': { kind: 'bruksveiledning', url: `${BLOB}/aBoks-Office-Bruksveiledning.pdf` },
  'aboks-spesial': {
    kind: 'monteringsveiledning',
    url: `${BLOB}/aBoks-Spesial-Monteringsveiledning.pdf`,
  },
  'aboks-vegg': {
    kind: 'monteringsveiledning',
    url: `${BLOB}/aBoks-Vegg-Monteringsveiledning.pdf`,
  },
  'aboks-xl': { kind: 'monteringsveiledning', url: `${BLOB}/aBoks-XL-Monteringsveiledning.pdf` },
}

test('every model resolves to its own guide', () => {
  for (const [slug, expected] of Object.entries(EXPECTED)) {
    const guide = productGuide(slug)
    assert.ok(guide, `no guide for "${slug}"`)
    assert.equal(guide.kind, expected.kind, `wrong guide kind for "${slug}"`)
    assert.equal(guide.url, expected.url, `wrong guide URL for "${slug}"`)
  }
})

test('no two models share a guide', () => {
  const urls = Object.keys(EXPECTED).map((slug) => productGuide(slug)!.url)
  assert.equal(new Set(urls).size, urls.length)
})

// The link text and the card row label are read straight off the guide, so the two pages
// cannot word the same document differently.
test('the labels follow the guide kind', () => {
  const vegg = productGuide('aboks-vegg')!
  assert.equal(vegg.downloadLabel, 'Last ned monteringsveiledning')
  assert.equal(vegg.cardLabel, 'Monteringsveiledning')

  const mini = productGuide('aboks-mini')!
  assert.equal(mini.downloadLabel, 'Last ned bruksveiledning')
  assert.equal(mini.cardLabel, 'Bruksveiledning')
})

// `aboks-special` is the spelling the Blob `Bedrifter` folder and the Tilbudsmal route use
// for aBoks Spesial; both must find the same file.
test('the Spesial/Special spellings resolve to the same guide', () => {
  assert.deepEqual(productGuide('aboks-special'), productGuide('aboks-spesial'))
})

// Accessories and anything unknown get nothing, so no page links a PDF that is not there.
test('a product without a guide resolves to null', () => {
  assert.equal(productGuide('lokk'), null)
  assert.equal(productGuide('aa-modul'), null)
  assert.equal(productGuide('gp-ultra-plus-aa-10-pakk'), null)
  assert.equal(productGuide(''), null)
})
