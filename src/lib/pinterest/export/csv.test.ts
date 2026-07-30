import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PINTEREST_CSV_HEADERS,
  csvCell,
  pinterestCsv,
  pinterestCsvFilename,
  pinterestCsvRow,
} from './csv'
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
      'https://aboks.no/produkter/aboks',
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

describe('Pinterest CSV — filename', () => {
  it('is pinterest-export-YYYY-MM-DD.csv', () => {
    assert.equal(
      pinterestCsvFilename(new Date('2026-07-30T22:15:00.000Z')),
      'pinterest-export-2026-07-30.csv',
    )
    assert.match(pinterestCsvFilename(), /^pinterest-export-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
