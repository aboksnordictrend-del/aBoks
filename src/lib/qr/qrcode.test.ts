import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encodeQr, qrSvg } from './qrcode'
import { pilotPath, pilotPublicUrl } from '../pilot/urls'
import { buildQrPrintHtml, LABELS_PER_SHEET } from '../pilot/qrPrint'

/**
 * Structural checks of the encoder. Full decoding was verified separately against an independent
 * decoder (jsQR) for versions 1–36 at all four levels; these tests pin the invariants that make a
 * symbol readable at all, so a regression shows up without that tool.
 */

/** Reads the 15 format bits from the first copy (around the top-left finder). */
function readFormatBits(m: boolean[][]): number {
  let bits = 0
  const set = (i: number, v: boolean) => {
    if (v) bits |= 1 << i
  }
  for (let i = 0; i <= 5; i++) set(i, m[i]![8]!)
  set(6, m[7]![8]!)
  set(7, m[8]![8]!)
  set(8, m[8]![7]!)
  for (let i = 9; i < 15; i++) set(i, m[8]![14 - i]!)
  return bits
}

/** Reads the second copy (top-right row and bottom-left column). */
function readFormatBitsCopy2(m: boolean[][], size: number): number {
  let bits = 0
  for (let i = 0; i < 8; i++) if (m[8]![size - 1 - i]) bits |= 1 << i
  for (let i = 8; i < 15; i++) if (m[size - 15 + i]![8]) bits |= 1 << i
  return bits
}

function finderAt(m: boolean[][], x0: number, y0: number): boolean {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
      if (m[y0 + dy]![x0 + dx] !== (ring !== 2)) return false
    }
  }
  return true
}

describe('encodeQr', () => {
  const url = pilotPublicUrl('hitra-kommune')

  it('picks the smallest version and the requested (or better) level', () => {
    const qr = encodeQr(url, 'Q')
    assert.equal(qr.size, qr.version * 4 + 17)
    assert.ok(qr.version <= 4, `a pilot URL fits in a small symbol (got v${qr.version})`)
    assert.ok(['Q', 'H'].includes(qr.errorCorrectionLevel))
  })

  it('places the three finder patterns and the dark module', () => {
    const { modules: m, size } = encodeQr(url, 'M')
    assert.ok(finderAt(m, 0, 0))
    assert.ok(finderAt(m, size - 7, 0))
    assert.ok(finderAt(m, 0, size - 7))
    assert.equal(m[size - 8]![8], true)
  })

  it('writes identical, BCH-valid format information in both copies', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      const qr = encodeQr(url, level)
      const a = readFormatBits(qr.modules)
      assert.equal(a, readFormatBitsCopy2(qr.modules, qr.size))
      const raw = a ^ 0x5412
      const data = raw >>> 10
      let rem = data
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
      assert.equal(((data << 10) | rem) & 0x7fff, raw, 'BCH(15,5) check')
      assert.equal(data & 7, qr.mask)
      assert.equal(data >>> 3, { L: 1, M: 0, Q: 3, H: 2 }[qr.errorCorrectionLevel])
    }
  })

  it('handles UTF-8 text and long input, and rejects what cannot fit', () => {
    assert.ok(encodeQr('Bø – æøå').version >= 1)
    const big = encodeQr('x'.repeat(1000), 'L')
    assert.ok(big.version >= 7, 'version information area is exercised')
    assert.throws(() => encodeQr('x'.repeat(4000), 'H'))
  })

  it('is deterministic', () => {
    assert.deepEqual(encodeQr(url).modules, encodeQr(url).modules)
  })

  it('renders a standalone SVG with a quiet zone', () => {
    const qr = encodeQr(url)
    const svg = qrSvg(qr)
    assert.match(svg, new RegExp(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`))
    assert.match(svg, /<path d="M/)
  })
})

describe('pilot URLs and print sheets', () => {
  it('builds the public questionnaire URL on the production origin', () => {
    assert.equal(pilotPath('hitra-kommune'), '/pilot/hitra-kommune')
    assert.equal(pilotPublicUrl('hitraskolen'), 'https://aboks.no/pilot/hitraskolen')
    assert.equal(pilotPublicUrl('bedrift-abc', 'http://localhost:3000/'), 'http://localhost:3000/pilot/bedrift-abc')
  })

  it('escapes the project name in printable sheets and repeats labels', () => {
    const svg = qrSvg(encodeQr(pilotPublicUrl('x')))
    const html = buildQrPrintHtml({ projectName: '<script>alert(1)</script>', url: 'https://aboks.no/pilot/x', svg, layout: 'labels' })
    assert.ok(!html.includes('<script>alert(1)'))
    assert.ok(html.includes('&lt;script&gt;'))
    assert.equal(html.split('class="label"').length - 1, LABELS_PER_SHEET)
    const single = buildQrPrintHtml({ projectName: 'Hitra', url: 'https://aboks.no/pilot/x', svg, layout: 'single' })
    assert.ok(single.includes('https://aboks.no/pilot/x'))
  })
})
