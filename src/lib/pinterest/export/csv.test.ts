import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PINTEREST_CSV_HEADERS,
  csvCell,
  pinterestCsv,
  pinterestCsvFilename,
  pinterestCsvRow,
} from './csv'
import { PIN_PARAM, appendPinParam, pinParamValue } from './urls'
import { DESCRIPTION_MAX, TITLE_MAX, guardFormula, normalizeText, truncate } from './text'
import type { PinterestExportItem } from './types'

/**
 * The first line of Pinterest's official sample file (pinterest-bulk-upload-sample.csv),
 * byte for byte. Every assertion about headers and column order is anchored to this constant
 * rather than to the implementation, so a rename in csv.ts fails the test instead of passing.
 */
const OFFICIAL_HEADER =
  'Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords'

/**
 * Minimal RFC 4180 reader used to verify the writer from the outside: it must be possible to
 * get the original values back out, which is the only assertion that really matters.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function item(overrides: Partial<PinterestExportItem> = {}): PinterestExportItem {
  return {
    sourceType: 'product',
    sourceId: '1',
    title: 'aBoks batteriboks',
    description: 'Fast plass til batteriene.',
    mediaUrl: 'https://cdn.example.com/aboks.webp',
    destinationUrl: 'https://aboks.no/produkter/aboks',
    keywords: '',
    ...overrides,
  }
}

describe('Pinterest CSV — official header row', () => {
  it('matches the official sample header exactly', () => {
    assert.equal(PINTEREST_CSV_HEADERS.join(','), OFFICIAL_HEADER)
  })

  it('emits that header as the first line of the document', () => {
    const csv = pinterestCsv([], 'Tavle')
    assert.equal(csv.split('\r\n')[0], OFFICIAL_HEADER)
  })

  it('keeps the official column order', () => {
    assert.deepEqual(
      [...PINTEREST_CSV_HEADERS],
      ['Title', 'Media URL', 'Pinterest board', 'Thumbnail', 'Description', 'Link', 'Publish date', 'Keywords'],
    )
  })

  it('has no UTF-8 BOM — Pinterest matches columns by header name', () => {
    const csv = pinterestCsv([item()], 'Tavle')
    assert.ok(!csv.startsWith('﻿'))
    assert.ok(csv.startsWith('Title,'))
  })
})

describe('Pinterest CSV — column mapping', () => {
  it('places every value in its official column, Thumbnail and Publish date empty', () => {
    const row = pinterestCsvRow(
      item({ title: 'T', description: 'D', keywords: 'k1, k2' }),
      'Min tavle/Seksjon',
    )
    assert.equal(row.length, PINTEREST_CSV_HEADERS.length)
    assert.deepEqual(row, [
      'T',
      'https://cdn.example.com/aboks.webp',
      'Min tavle/Seksjon',
      '', // Thumbnail — video only
      'D',
      // Link carries the per-row uniqueness parameter; its own value is asserted concretely
      // in the "unique Link per row" suite below.
      `https://aboks.no/produkter/aboks?pin=${pinParamValue('product', '1')}`,
      '', // Publish date — publish immediately
      'k1, k2',
    ])
  })

  it('writes the same board into every row', () => {
    const csv = pinterestCsv([item({ sourceId: '1' }), item({ sourceId: '2' })], 'Batterier')
    const lines = csv.trimEnd().split('\r\n').slice(1)
    assert.equal(lines.length, 2)
    for (const line of lines) assert.ok(line.includes(',Batterier,'))
  })
})

describe('Pinterest CSV — RFC 4180 escaping', () => {
  it('leaves a plain value unquoted, like the official sample', () => {
    assert.equal(csvCell('Hello World'), 'Hello World')
  })

  it('quotes a value containing a comma, like the official sample', () => {
    assert.equal(csvCell('Hello World, again'), '"Hello World, again"')
  })

  it('a comma in the description does not create an extra column', () => {
    const csv = pinterestCsv([item({ description: 'Ett, to, tre' })], 'Tavle')
    const [header, row] = parseCsv(csv)
    assert.deepEqual(header, [...PINTEREST_CSV_HEADERS])
    assert.equal(row.length, PINTEREST_CSV_HEADERS.length)
    assert.equal(row[4], 'Ett, to, tre')
  })

  it('a quoted, comma-bearing keyword list survives a round trip', () => {
    const csv = pinterestCsv([item({ keywords: 'world, earth' })], 'Tavle')
    const [, row] = parseCsv(csv)
    assert.equal(row[7], 'world, earth')
  })

  it('an embedded newline round-trips as one field', () => {
    const csv = pinterestCsv([item({ description: 'linje1\nlinje2' })], 'Tavle')
    const rows = parseCsv(csv)
    assert.equal(rows.length, 2, 'the newline must not split the record')
    assert.equal(rows[1][4], 'linje1\nlinje2')
  })

  it('doubles an embedded double quote', () => {
    assert.equal(csvCell('aBoks "Vegg"'), '"aBoks ""Vegg"""')
  })

  it('keeps an embedded newline inside one quoted field', () => {
    const cell = csvCell('linje1\nlinje2')
    assert.equal(cell, '"linje1\nlinje2"')
  })

  it('quotes a value with leading or trailing whitespace', () => {
    assert.equal(csvCell(' padded '), '" padded "')
  })

  it('terminates every record with CRLF', () => {
    const csv = pinterestCsv([item()], 'Tavle')
    assert.ok(csv.endsWith('\r\n'))
    assert.equal(csv.split('\r\n').filter(Boolean).length, 2) // header + 1 row
    assert.ok(!/[^\r]\n/.test(csv), 'no bare LF line ending')
  })
})

describe('Pinterest CSV — Norwegian characters', () => {
  it('round-trips æ ø å Æ Ø Å through UTF-8 unchanged', () => {
    const title = 'Rødgrønn blåbærsyltetøy — ÆØÅ æøå'
    const csv = pinterestCsv([item({ title })], 'Bærekraft')
    const bytes = new TextEncoder().encode(csv)
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    assert.equal(decoded, csv)
    assert.ok(decoded.includes(title))
    assert.ok(decoded.includes('Bærekraft'))
  })

  it('does not percent-encode or escape Norwegian characters', () => {
    const csv = pinterestCsv([item({ description: 'Orden i skuffen på soverommet' })], 'Tavle')
    assert.ok(csv.includes('på soverommet'))
    assert.ok(!csv.includes('%C3%A5'))
  })
})

describe('Pinterest CSV — spreadsheet formula injection', () => {
  for (const prefix of ['=', '+', '-', '@']) {
    it(`neutralizes a leading "${prefix}"`, () => {
      const payload = `${prefix}cmd|'/c calc'!A1`
      assert.equal(guardFormula(payload), `'${payload}`)
      assert.ok(pinterestCsv([item({ title: payload })], 'Tavle').includes(`'${prefix}`))
    })
  }

  it('neutralizes a leading tab and a leading carriage return', () => {
    assert.equal(guardFormula('\t=1+1'), "'\t=1+1")
    assert.equal(guardFormula('\r=1+1'), "'\r=1+1")
  })

  it('leaves ordinary Norwegian copy untouched, including the en dash', () => {
    assert.equal(guardFormula('– aBoks Vegg'), '– aBoks Vegg')
    assert.equal(guardFormula('aBoks – smart oppbevaring'), 'aBoks – smart oppbevaring')
  })

  it('guards the board column too', () => {
    const csv = pinterestCsv([item()], '=HYPERLINK("http://evil")')
    assert.ok(csv.includes("'=HYPERLINK"))
  })
})

describe('Pinterest CSV — text limits', () => {
  it('Pinterest documents Title 100 and Description 500', () => {
    assert.equal(TITLE_MAX, 100)
    assert.equal(DESCRIPTION_MAX, 500)
  })

  it('truncates a long title to the limit, ellipsis included', () => {
    const long = 'a'.repeat(140)
    const out = truncate(long, TITLE_MAX)
    assert.equal(Array.from(out).length, TITLE_MAX)
    assert.ok(out.endsWith('…'))
  })

  it('truncates a long description to the limit', () => {
    const out = normalizeText('b'.repeat(900), DESCRIPTION_MAX)
    assert.equal(Array.from(out).length, DESCRIPTION_MAX)
  })

  it('leaves a value at or under the limit untouched', () => {
    assert.equal(truncate('kort', TITLE_MAX), 'kort')
    assert.equal(truncate('x'.repeat(100), 100), 'x'.repeat(100))
  })

  it('counts Norwegian characters as one each', () => {
    const value = 'ø'.repeat(120)
    assert.equal(Array.from(truncate(value, TITLE_MAX)).length, TITLE_MAX)
  })
})

describe('Pinterest CSV — HTML stripping and whitespace', () => {
  it('strips tags before measuring the limit', () => {
    const out = normalizeText('<p>Fast plass til <strong>batteriene</strong>.</p>', DESCRIPTION_MAX)
    assert.equal(out, 'Fast plass til batteriene.')
  })

  it('collapses newlines so a cell stays on one line', () => {
    const out = normalizeText('linje1\n\nlinje2\t linje3', DESCRIPTION_MAX)
    assert.equal(out, 'linje1 linje2 linje3')
  })

  it('returns an empty string for null/undefined', () => {
    assert.equal(normalizeText(null, TITLE_MAX), '')
    assert.equal(normalizeText(undefined, TITLE_MAX), '')
  })
})

/**
 * Pinterest's bulk importer keeps only the FIRST row carrying a given Link value and silently
 * drops every later row that repeats it. Confirmed by three controlled uploads:
 *   3 rows / 1 distinct Link  → 1 imported
 *   5 rows / 5 distinct Links → 5 imported
 *   5 rows / 1 base URL differing only by ?pin=1…5 → 5 imported
 * The last one is why a query parameter is sufficient.
 */
describe('Pinterest CSV — unique Link per row', () => {
  /** The Link column, parsed back out of a real document rather than read off the item. */
  function links(items: PinterestExportItem[]): string[] {
    return parseCsv(pinterestCsv(items, 'Tavle'))
      .slice(1)
      .map((row) => row[5])
  }

  it('gives two rows on the same base destination different Link values', () => {
    const [a, b] = links([
      item({ sourceType: 'product', sourceId: 'product:1:image:10' }),
      item({ sourceType: 'product', sourceId: 'product:1:image:11' }),
    ])
    assert.notEqual(a, b, 'two rows sharing a destination must not share a Link')
    assert.ok(a.startsWith('https://aboks.no/produkter/aboks?pin='))
    assert.ok(b.startsWith('https://aboks.no/produkter/aboks?pin='))
  })

  it('gives the same row the same Link on a repeated export', () => {
    const row = item({ sourceType: 'blob', sourceId: 'blob:Pinterest/aBoks-olive-ny.webp' })
    assert.equal(links([row])[0], links([row])[0])
    // …and across separately constructed items with the same identity.
    const again = item({ sourceType: 'blob', sourceId: 'blob:Pinterest/aBoks-olive-ny.webp' })
    assert.equal(links([row])[0], links([again])[0])
  })

  it('is stable regardless of the row’s position in the file', () => {
    const a = item({ sourceType: 'variant', sourceId: '7' })
    const b = item({ sourceType: 'variant', sourceId: '8' })
    assert.equal(links([a, b])[0], links([b, a])[1])
  })

  it('appends with ? when the destination has no query', () => {
    const [link] = links([item({ destinationUrl: 'https://aboks.no/produkter' })])
    assert.match(link, /^https:\/\/aboks\.no\/produkter\?pin=[a-z0-9-]+$/)
  })

  it('appends with & when the destination already has a query', () => {
    const [link] = links([
      item({
        sourceType: 'variant',
        sourceId: '3',
        destinationUrl: 'https://aboks.no/produkter/aboks?variant=ABOKS-OLIVE-001',
      }),
    ])
    assert.ok(link.includes('&pin='), 'must not create a second ?')
    assert.equal(link.split('?').length, 2, 'exactly one ? in the URL')
  })

  it('preserves an existing variant parameter untouched', () => {
    const [link] = links([
      item({
        sourceType: 'variant',
        sourceId: '3',
        destinationUrl: 'https://aboks.no/produkter/aboks?variant=ABOKS-OLIVE-001',
      }),
    ])
    assert.ok(link.startsWith('https://aboks.no/produkter/aboks?variant=ABOKS-OLIVE-001&'))
    assert.equal(new URL(link).searchParams.get('variant'), 'ABOKS-OLIVE-001')
  })

  it('preserves a percent-encoded variant parameter byte for byte', () => {
    const encoded = 'https://aboks.no/produkter/aboks?variant=A%20B%2FC'
    const [link] = links([item({ sourceType: 'variant', sourceId: '4', destinationUrl: encoded })])
    assert.ok(link.startsWith(`${encoded}&pin=`), 'the query must not be re-serialized')
  })

  it('produces URL-safe values from ids carrying colons, slashes, dots and Norwegian letters', () => {
    const value = pinParamValue('blob', 'blob:Pinterest/aboks-hvit-i-marmor-kjøkken.webp')
    assert.match(value, /^[a-z0-9-]+$/, 'only unreserved URL characters')
    assert.equal(value, encodeURIComponent(value), 'nothing that would need escaping')
  })

  it('does not repeat the source type when the id already carries it', () => {
    assert.ok(pinParamValue('product', 'product:4:image:66').startsWith('product-4-image-66-'))
    assert.ok(pinParamValue('variant', '16').startsWith('variant-16-'))
    assert.ok(pinParamValue('homepage', 'hero').startsWith('homepage-hero-'))
  })

  it('bounds the readable slug but keeps distinguishing very long ids', () => {
    const long = (suffix: string) => `blob:Pinterest/${'a'.repeat(200)}-${suffix}.webp`
    const a = pinParamValue('blob', long('one'))
    const b = pinParamValue('blob', long('two'))
    assert.ok(a.length < 80, `slug must stay bounded, got ${a.length}`)
    assert.notEqual(a, b, 'truncation must not collapse two distinct ids')
  })

  it('uses the documented parameter name', () => {
    assert.equal(PIN_PARAM, 'pin')
    assert.equal(appendPinParam('https://aboks.no/x', 'variant', '1'), `https://aboks.no/x?pin=${pinParamValue('variant', '1')}`)
  })

  it('keeps every Link distinct across a production-shaped export', () => {
    // Mirrors the real 60-row export: 44 rows collapsed onto 6 destinations (20 of them on
    // /produkter/aboks alone) plus 16 variant rows that already carry a unique ?variant=.
    const rows: PinterestExportItem[] = []
    const shared: [string, number][] = [
      ['https://aboks.no/produkter/aboks', 20],
      ['https://aboks.no/produkter/aboks-nano', 5],
      ['https://aboks.no/produkter/aboks-mini', 5],
      ['https://aboks.no/produkter', 5],
      ['https://aboks.no/slik-fungerer-det', 5],
      ['https://aboks.no/produkter/aboks-vegg', 4],
    ]
    let n = 0
    for (const [destinationUrl, count] of shared) {
      for (let i = 0; i < count; i++) {
        rows.push(
          item({ sourceType: 'product', sourceId: `product:${n}:image:${i}`, destinationUrl }),
        )
        n++
      }
    }
    for (let i = 0; i < 16; i++) {
      rows.push(
        item({
          sourceType: 'variant',
          sourceId: String(i),
          destinationUrl: `https://aboks.no/produkter/aboks?variant=SKU-${i}`,
        }),
      )
    }
    assert.equal(rows.length, 60)

    const before = new Set(rows.map((r) => r.destinationUrl))
    const after = new Set(links(rows))
    assert.equal(before.size, 22, 'the export really does collapse onto 22 destinations')
    assert.equal(after.size, 60, 'every exported row must carry a distinct Link')
  })
})

describe('Pinterest CSV — filename', () => {
  it('is pinterest-export-YYYY-MM-DD.csv', () => {
    assert.equal(
      pinterestCsvFilename(new Date('2026-07-30T22:15:00.000Z')),
      'pinterest-export-2026-07-30.csv',
    )
    assert.match(pinterestCsvFilename(), /^pinterest-export-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
