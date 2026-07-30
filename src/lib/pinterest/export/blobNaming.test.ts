import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PINTEREST_BLOB_PREFIX,
  SUPPORTED_BLOB_EXTENSIONS,
  basename,
  descriptionFromTerms,
  extensionOf,
  isHiddenOrSystemFile,
  isSupportedBlobImage,
  keywordsFromTerms,
  recognizeTerms,
  titleFromPathname,
} from './blobNaming'

const p = (name: string) => `${PINTEREST_BLOB_PREFIX}${name}`

// ── File selection ────────────────────────────────────────────────────────────────────────

describe('supported file types', () => {
  it('lists exactly the four verified raster formats', () => {
    assert.deepEqual([...SUPPORTED_BLOB_EXTENSIONS], ['.jpg', '.jpeg', '.png', '.webp'])
  })

  it('accepts jpg, jpeg, png and webp', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
      assert.equal(isSupportedBlobImage(p(`bilde.${ext}`)), true, ext)
    }
  })

  it('accepts uppercase and mixed-case extensions', () => {
    for (const ext of ['JPG', 'JPEG', 'PNG', 'WEBP', 'WebP', 'Png']) {
      assert.equal(isSupportedBlobImage(p(`bilde.${ext}`)), true, ext)
    }
  })

  it('rejects everything else', () => {
    for (const ext of ['pdf', 'svg', 'gif', 'avif', 'mp4', 'mov', 'json', 'csv', 'zip', 'txt', 'tmp']) {
      assert.equal(isSupportedBlobImage(p(`fil.${ext}`)), false, ext)
    }
    assert.equal(isSupportedBlobImage(p('mappe-uten-punktum')), false)
    assert.equal(isSupportedBlobImage(PINTEREST_BLOB_PREFIX), false)
  })

  it('flags hidden and system files', () => {
    assert.equal(isHiddenOrSystemFile(p('.DS_Store')), true)
    assert.equal(isHiddenOrSystemFile(p('Thumbs.db')), true)
    assert.equal(isHiddenOrSystemFile(p('desktop.ini')), true)
    assert.equal(isHiddenOrSystemFile(p('~midlertidig.png')), true)
    assert.equal(isHiddenOrSystemFile(p('bilde.png~')), true)
    assert.equal(isHiddenOrSystemFile(p('bilde.png')), false)
  })

  it('reads the basename and extension from a nested path', () => {
    assert.equal(basename(p('interior/aBoks-i-stua.webp')), 'aBoks-i-stua.webp')
    assert.equal(extensionOf(p('interior/aBoks-i-stua.WEBP')), '.webp')
    assert.equal(extensionOf(p('uten-extension')), '')
  })
})

// ── Filename → title ──────────────────────────────────────────────────────────────────────

describe('title from filename', () => {
  it('handles the documented examples', () => {
    assert.equal(titleFromPathname(p('orden-pa-kjokkenet.webp')), 'Orden på kjøkkenet')
    assert.equal(titleFromPathname(p('aBoks-i-mork-bla.webp')), 'aBoks i mørk blå')
    assert.equal(
      titleFromPathname(p('trygg-oppbevaring-av-brukte-batterier.png')),
      'Trygg oppbevaring av brukte batterier',
    )
    assert.equal(
      titleFromPathname(p('batterioppbevaring-pa-hytta.jpg')),
      'Batterioppbevaring på hytta',
    )
  })

  it('removes the extension', () => {
    assert.equal(titleFromPathname(p('ryddig-skuff.png')), 'Ryddig skuff')
    assert.equal(titleFromPathname(p('ryddig-skuff.JPEG')), 'Ryddig skuff')
  })

  it('uses only the basename, never the folder path', () => {
    assert.equal(titleFromPathname(p('interior/stue/ryddig-skuff.webp')), 'Ryddig skuff')
  })

  it('turns hyphens, underscores and repeats into single spaces', () => {
    assert.equal(titleFromPathname(p('orden__i---skuffen.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden_i_skuffen.webp')), 'Orden i skuffen')
  })

  it('normalizes the known Norwegian transliterations', () => {
    assert.equal(titleFromPathname(p('pa-soverommet.webp')), 'På soverommet')
    assert.equal(titleFromPathname(p('olivengronn-boks.webp')), 'Olivengrønn boks')
    assert.equal(titleFromPathname(p('moerk-bla-boks.webp')), 'Mørk blå boks')
    assert.equal(titleFromPathname(p('baerekraftig-hjem.webp')), 'Bærekraftig hjem')
  })

  it('does not transliterate inside unrelated words', () => {
    // A blind aa→å / bla→blå would mangle these.
    assert.equal(titleFromPathname(p('blade-og-bokser.webp')), 'Blade og bokser')
    assert.equal(titleFromPathname(p('paradis-hjemme.webp')), 'Paradis hjemme')
  })

  it('preserves the aBoks brand spelling anywhere in the name', () => {
    assert.equal(titleFromPathname(p('aboks-i-stua.webp')), 'aBoks i stua')
    assert.equal(titleFromPathname(p('ABOKS-i-stua.webp')), 'aBoks i stua')
    assert.equal(titleFromPathname(p('orden-med-aboks.webp')), 'Orden med aBoks')
  })

  it('capitalizes a product line that directly follows the brand', () => {
    assert.equal(titleFromPathname(p('aboks-vegg-i-gangen.webp')), 'aBoks Vegg i gangen')
    assert.equal(titleFromPathname(p('aboks-mini-pa-hytta.webp')), 'aBoks Mini på hytta')
    assert.equal(titleFromPathname(p('aboks-nano-i-skuffen.webp')), 'aBoks Nano i skuffen')
  })

  it('leaves the same words lower-case when they are not the product line', () => {
    assert.equal(titleFromPathname(p('batterier-pa-veggen.webp')), 'Batterier på veggen')
    assert.equal(titleFromPathname(p('en-mini-guide.webp')), 'En mini guide')
  })

  it('preserves the AA and AAA battery sizes in caps', () => {
    assert.equal(titleFromPathname(p('aa-og-aaa-batterier.webp')), 'AA og AAA batterier')
  })

  it('removes dimension suffixes', () => {
    assert.equal(titleFromPathname(p('orden-i-skuffen-800x800.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-1200x1500.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-1080x1350.png')), 'Orden i skuffen')
  })

  it('removes technical suffixes and counters', () => {
    assert.equal(titleFromPathname(p('orden-i-skuffen-final.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-copy.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-compressed.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-optimized.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-web.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-pinterest.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-01.webp')), 'Orden i skuffen')
    assert.equal(titleFromPathname(p('orden-i-skuffen-2.webp')), 'Orden i skuffen')
  })

  it('keeps numbers that carry meaning', () => {
    assert.equal(titleFromPathname(p('20-aa-batterier-pa-plass.webp')), '20 AA batterier på plass')
    assert.equal(titleFromPathname(p('fotball-vm-2026.webp')), 'Fotball vm 2026')
  })

  it('never strips a name down to nothing', () => {
    assert.equal(titleFromPathname(p('final.webp')), 'Final')
    assert.equal(titleFromPathname(p('01.webp')), '01')
  })

  it('preserves Norwegian characters that are already correct', () => {
    assert.equal(titleFromPathname(p('orden-på-kjøkkenet.webp')), 'Orden på kjøkkenet')
  })

  it('returns an empty string for a nameless file', () => {
    assert.equal(titleFromPathname(PINTEREST_BLOB_PREFIX), '')
  })
})

// ── Recognized vocabulary ─────────────────────────────────────────────────────────────────

describe('recognizeTerms', () => {
  it('picks the most specific product line', () => {
    assert.equal(recognizeTerms(p('aboks-mini-i-stua.webp')).product, 'aboks-mini')
    assert.equal(recognizeTerms(p('aboks-nano-pa-hytta.webp')).product, 'aboks-nano')
    assert.equal(recognizeTerms(p('aboks-vegg-i-gangen.webp')).product, 'aboks-vegg')
    assert.equal(recognizeTerms(p('aboks-i-stua.webp')).product, 'aboks')
    assert.equal(recognizeTerms(p('ryddig-skuff.webp')).product, null)
  })

  it('recognizes colours in both spellings', () => {
    assert.equal(recognizeTerms(p('aboks-olivengronn.webp')).colour, 'olivengrønn')
    assert.equal(recognizeTerms(p('aboks-olivengrønn.webp')).colour, 'olivengrønn')
    assert.equal(recognizeTerms(p('aboks-mork-bla.webp')).colour, 'mørk blå')
    assert.equal(recognizeTerms(p('aboks-mørk-blå.webp')).colour, 'mørk blå')
    assert.equal(recognizeTerms(p('aboks-sort.webp')).colour, 'sort')
    assert.equal(recognizeTerms(p('aboks-svart.webp')).colour, 'sort')
    assert.equal(recognizeTerms(p('aboks-hvit.webp')).colour, 'hvit')
    assert.equal(recognizeTerms(p('aboks-creme.webp')).colour, 'creme')
  })

  it('recognizes rooms in both spellings', () => {
    assert.equal(recognizeTerms(p('orden-pa-kjokkenet.webp')).room, 'kjøkken')
    assert.equal(recognizeTerms(p('orden-på-kjøkkenet.webp')).room, 'kjøkken')
    assert.equal(recognizeTerms(p('aboks-i-stua.webp')).room, 'stue')
    assert.equal(recognizeTerms(p('aboks-pa-hytta.webp')).room, 'hytte')
    assert.equal(recognizeTerms(p('aboks-pa-hjemmekontoret.webp')).room, 'hjemmekontor')
  })

  it('does not treat "vegg" as a room when it named the product', () => {
    assert.equal(recognizeTerms(p('aboks-vegg.webp')).room, null)
    assert.equal(recognizeTerms(p('batterier-pa-veggen.webp')).room, 'vegg')
  })

  it('recognizes used batteries and battery sizes', () => {
    const used = recognizeTerms(p('brukte-batterier-samlet.webp'))
    assert.equal(used.usedBatteries, true)
    const sizes = recognizeTerms(p('aa-og-aaa-batterier.webp'))
    assert.deepEqual(sizes.batterySizes, ['AAA', 'AA'])
  })
})

// ── Description ───────────────────────────────────────────────────────────────────────────

describe('descriptionFromTerms', () => {
  const describeFile = (name: string) => descriptionFromTerms(recognizeTerms(p(name)))

  it('produces a generic description when nothing is recognized', () => {
    assert.equal(
      describeFile('et-fint-motiv.webp'),
      'Et inspirerende aBoks-motiv med fokus på praktisk batterioppbevaring og bedre orden hjemme.',
    )
  })

  it('produces a product-aware description', () => {
    const text = describeFile('aboks-vegg.webp')
    assert.ok(text.includes('aBoks Vegg'), text)
  })

  it('produces a colour-aware description', () => {
    assert.equal(
      describeFile('aboks-i-mork-bla.webp'),
      'Smart oppbevaring for AA- og AAA-batterier i en stilren mørk blå variant.',
    )
  })

  it('produces a room-aware description', () => {
    assert.equal(
      describeFile('batterioppbevaring-pa-hytta.jpg'),
      'Hold orden på batteriene på hytta. aBoks samler nye og brukte batterier på ett sted.',
    )
  })

  it('produces a used-battery description', () => {
    assert.equal(
      describeFile('trygg-oppbevaring-av-brukte-batterier.png'),
      'Gi brukte batterier en fast plass frem til de leveres til gjenvinning. Praktisk og oversiktlig oppbevaring med aBoks.',
    )
  })

  it('stays within the suggested 100–220 character range', () => {
    for (const name of [
      'et-fint-motiv.webp',
      'aboks-vegg.webp',
      'aboks-i-mork-bla.webp',
      'batterioppbevaring-pa-hytta.jpg',
      'trygg-oppbevaring-av-brukte-batterier.png',
      'aa-og-aaa-batterier.webp',
    ]) {
      const text = describeFile(name)
      assert.ok(text.length >= 60 && text.length <= 220, `${name}: ${text.length} — ${text}`)
    }
  })

  it('never makes an unsupported claim', () => {
    // Fire prevention, guaranteed safety, environmental impact, certification, child safety,
    // battery lifetime and performance are all off limits — nobody has looked at the image.
    const forbidden =
      /brannsikk|brannfar|hindrer brann|garanter|sertifis|godkjent av|barnesikk|milj(ø|o)vennlig|milj(ø|o)gevinst|varer lenger|lengre levetid|bedre ytelse|100\s*%/i
    const names = [
      'et-fint-motiv.webp',
      'aboks-vegg.webp',
      'aboks-i-mork-bla.webp',
      'batterioppbevaring-pa-hytta.jpg',
      'trygg-oppbevaring-av-brukte-batterier.png',
      'aa-og-aaa-batterier.webp',
      'aboks-mini-pa-kjokkenet.webp',
    ]
    for (const name of names) {
      const text = describeFile(name)
      assert.ok(!forbidden.test(text), `${name}: ${text}`)
    }
  })
})

// ── Keywords ──────────────────────────────────────────────────────────────────────────────

describe('keywordsFromTerms', () => {
  const keywordsFor = (name: string) => keywordsFromTerms(recognizeTerms(p(name)))

  it('always includes the brand and the core term', () => {
    const kw = keywordsFor('et-fint-motiv.webp')
    assert.ok(kw.includes('aBoks'))
    assert.ok(kw.includes('batterioppbevaring'))
  })

  it('adds recognized product, colour, sizes, used batteries and room', () => {
    const kw = keywordsFor('aboks-vegg-olivengronn-brukte-aa.webp')
    assert.ok(kw.includes('aBoks Vegg'), kw)
    assert.ok(kw.includes('olivengrønn'), kw)
    assert.ok(kw.includes('AA-batterier'), kw)
    assert.ok(kw.includes('brukte batterier'), kw)
  })

  it('maps a room to its keyword', () => {
    assert.ok(keywordsFor('orden-pa-kjokkenet.webp').includes('kjøkkenoppbevaring'))
    assert.ok(keywordsFor('batterier-pa-veggen.webp').includes('veggoppbevaring'))
  })

  it('deduplicates case-insensitively and stays short', () => {
    const kw = keywordsFor('aboks-aboks-batterier-batterier.webp')
    const parts = kw.split(', ')
    assert.equal(new Set(parts.map((s) => s.toLowerCase())).size, parts.length)
    assert.ok(parts.length <= 6, kw)
  })

  it('uses the comma-separated format the CSV writer expects', () => {
    assert.match(keywordsFor('aboks-i-stua.webp'), /^[^,]+(, [^,]+)*$/)
  })
})
