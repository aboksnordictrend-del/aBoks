import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { encodeQr } from '@/lib/qr/qrcode'
import { buildMiljoLabelPdf, isKnockedOut, LABEL_SIDE_MM, labelBoxes, labelQr, labelQrPath, labelQrPlacement, miljoLabelFilename, QUIET_ZONE_MODULES } from './labelPdf'
import { miljoPublicUrl } from './qrPrint'

const SAMPLE_URL = miljoPublicUrl('9mwt8w9wqx')

describe('49 × 49 mm Miljøregistrering label', () => {
  it('is one page of exactly 49 × 49 mm', async () => {
    const pdf = await PDFDocument.load(await buildMiljoLabelPdf({ url: SAMPLE_URL }))
    assert.equal(pdf.getPageCount(), 1)
    const { width, height } = pdf.getPage(0).getSize()
    assert.ok(Math.abs((width * 25.4) / 72 - 49) < 1e-3)
    assert.ok(Math.abs((height * 25.4) / 72 - 49) < 1e-3)
  })

  it('uses the same symbol as the admin panel, for every organisation code', () => {
    for (const code of ['9mwt8w9wqx', 'abcdefghjk', '2345678923', 'zzzzzzzzzz']) {
      const url = miljoPublicUrl(code)
      const label = labelQr(url)
      assert.deepEqual(label.modules, encodeQr(url, 'Q').modules)
      assert.equal(label.errorCorrectionLevel, 'H')
      assert.equal(label.version, 4)
    }
  })

  it('clears only the centre, never a function pattern', () => {
    const { size } = labelQr(SAMPLE_URL)
    let cleared = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isKnockedOut(x, y, size)) continue
        cleared++
        assert.ok(x !== 6 && y !== 6, 'timing pattern')
        assert.ok(!(x < 9 && y < 9) && !(x >= size - 8 && y < 9) && !(x < 9 && y >= size - 8), 'finder pattern')
        assert.ok(!(Math.abs(x - 26) <= 2 && Math.abs(y - 26) <= 2), 'alignment pattern')
      }
    }
    assert.equal(cleared, 83)
  })

  it('draws every dark module outside the cleared centre, and nothing else', () => {
    const qr = labelQr(SAMPLE_URL)
    const drawn = new Set<string>()
    for (const m of labelQrPath(qr).matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      for (let i = 0; i < Number(m[3]); i++) drawn.add(`${Number(m[1]) + i},${m[2]}`)
    }
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        assert.equal(drawn.has(`${x},${y}`), qr.modules[y]![x]! && !isKnockedOut(x, y, qr.size), `${x},${y}`)
      }
    }
  })

  it('keeps everything on the label and out of the 4-module quiet zone', () => {
    const q = labelQrPlacement(labelQr(SAMPLE_URL))
    const quiet = QUIET_ZONE_MODULES * q.moduleMm
    assert.ok(q.left >= quiet && q.left + q.side + quiet <= LABEL_SIDE_MM)
    const safe = 1.1
    for (const b of labelBoxes()) {
      assert.ok(b.left >= safe && b.top >= safe && b.right <= LABEL_SIDE_MM - safe && b.bottom <= LABEL_SIDE_MM - safe, `${b.name} leaves the safe area`)
      // The heading's j and g descenders may reach this far in (approved after the DA210 print test).
      const allowed = b.name === 'Miljøregistrering' ? 3 * q.moduleMm : quiet
      assert.ok(b.bottom <= q.top - allowed || b.top >= q.top + q.side + quiet, `${b.name} enters the quiet zone`)
    }
  })

  it('keeps the heading centred and clear of the aBoks wordmark', () => {
    const boxes = labelBoxes()
    const brand = boxes.find((b) => b.name === 'aBoks')!
    const heading = boxes.find((b) => b.name === 'Miljøregistrering')!
    assert.ok(Math.abs((heading.left + heading.right) / 2 - LABEL_SIDE_MM / 2) < 1e-9)
    assert.ok(heading.top - brand.bottom >= 0.45)
    assert.ok(heading.left >= 2 && heading.right <= LABEL_SIDE_MM - 2)
  })

  it('names the file from the organisation, safely', () => {
    assert.equal(miljoLabelFilename('Bø kommune', 'x'), 'aBoks-Miljoregistrering-bo-kommune-49x49mm.pdf')
    assert.equal(miljoLabelFilename('Hitra / Frøya: «Skole» ../', 'x'), 'aBoks-Miljoregistrering-hitra-froya-skole-49x49mm.pdf')
    assert.equal(miljoLabelFilename('???', '9mwt8w9wqx'), 'aBoks-Miljoregistrering-9mwt8w9wqx-49x49mm.pdf')
  })
})
