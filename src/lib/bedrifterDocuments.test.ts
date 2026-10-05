import assert from 'node:assert/strict'
import test from 'node:test'
import { bedrifterDocuments, bedrifterProductKey } from './bedrifterDocuments'

/**
 * The Produktark URL a product's document rows resolve to, with Blob's `?download=1` flag
 * stripped — that flag is the row's download behaviour, not part of the document's address.
 */
function produktarkUrl(slug: string): string {
  const key = bedrifterProductKey(slug)
  assert.ok(key, `no document key for "${slug}"`)
  const row = bedrifterDocuments(key).find((document) => document.label === 'Produktark')
  assert.ok(row, `no Produktark row for "${slug}"`)
  assert.equal(row.files.length, 1)
  assert.equal(row.files[0].type, 'PDF')
  return row.files[0].url.replace('?download=1', '')
}

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'

// The two sheets that were replaced by a newer file. Both live in the `Bedrifter` folder
// alongside the rest of the catalogue, and the plain aBoks file is the one that does not
// follow the `-v2` naming of the others.
test('aBoks Office points at the Office product sheet', () => {
  assert.equal(
    produktarkUrl('aboks-office'),
    `${BLOB}/Bedrifter/aBoks-Office-produktark-v2.pdf`,
  )
})

test('the original aBoks points at the aBoks product sheet', () => {
  assert.equal(produktarkUrl('aboks'), `${BLOB}/Bedrifter/aBoks-produktark_3.pdf`)
})

// Guards the mapping above against the two products being swapped, and every other model
// against being given one of their sheets.
test('no other model shares a product sheet with Office or aBoks', () => {
  const others = ['aboks-xl', 'aboks-spesial', 'aboks-vegg', 'aboks-mini', 'aboks-nano']
  const taken = new Set([produktarkUrl('aboks-office'), produktarkUrl('aboks')])
  for (const slug of others) {
    assert.ok(!taken.has(produktarkUrl(slug)), `${slug} reuses an Office/aBoks sheet`)
  }
})

// The sheets this change must leave alone, spelled out so a later edit to the table cannot
// silently move them.
test('the other models keep their existing product sheets', () => {
  assert.equal(produktarkUrl('aboks-xl'), `${BLOB}/Bedrifter/aBoks-XL-produktark-v3.pdf`)
  assert.equal(
    produktarkUrl('aboks-spesial'),
    `${BLOB}/Bedrifter/aBoks-Spesial-produktark-v3.pdf`,
  )
  assert.equal(produktarkUrl('aboks-vegg'), `${BLOB}/Bedrifter/aBoks-Vegg-Produktark.pdf`)
  assert.equal(produktarkUrl('aboks-mini'), `${BLOB}/Bedrifter/aBoks-Mini-Produktark.pdf`)
  assert.equal(produktarkUrl('aboks-nano'), `${BLOB}/Bedrifter/aBoks-Nano-Produktark.pdf`)
})

// The Tilbudsmal rows are built by the same helper as Produktark, so this pins that an edit
// to a Produktark filename cannot disturb how the other rows resolve.
test('the Tilbudsmal rows still resolve inside the Bedrifter folder', () => {
  const rows = bedrifterDocuments('aboks')
  const tilbudsmal = rows.find((document) => document.label === 'Tilbudsmal')
  assert.ok(tilbudsmal)
  assert.equal(
    tilbudsmal.files[0].url,
    `${BLOB}/Bedrifter/aBoks-Tilbudsmal.pdf?download=1`,
  )
})
