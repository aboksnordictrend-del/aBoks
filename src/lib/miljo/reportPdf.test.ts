import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildReportModel, footerText, formatNumberNo, headerLayout, renderReportPdf, winAnsiSafe, wrap, HEADER_GAP, LOGO_WIDTH, METHOD_TEXT, REGISTERED_HEADING, DELIVERED_HEADING } from './reportPdf'
import { buildCsvExport, buildPdfExport } from './exports'
import { resolveMiljoPeriod } from './period'
import type { DeliveryRecord, RegistrationRecord } from './stats'

const NOW = new Date('2026-10-31T13:05:00Z')
const period = resolveMiljoPeriod({ preset: 'thisYear' }, NOW)

const regs: RegistrationRecord[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  organizationId: 1,
  organizationName: 'Hitra kommune',
  registeredAt: `2026-${String((i % 10) + 1).padStart(2, '0')}-15T10:00:00Z`,
  status: 'registered',
  lines: [{ category: 'aa', quantity: 3 }, { category: 'aaa', quantity: 2 }],
  submittedTotal: 5,
  flags: [],
  reviewState: 'none',
}))

const dels: DeliveryRecord[] = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  organizationId: 1,
  organizationName: 'Hitra kommune',
  deliveryDate: `2026-${String((i % 10) + 1).padStart(2, '0')}-0${(i % 9) + 1}`,
  quantity: i % 2 ? 12.5 : 300,
  unit: i % 2 ? 'kg' : 'stk',
  operator: i % 3 ? 'Retura Trøndelag' : 'Batteriretur — «Øst» 🚛',
  documentationStatus: i % 4 ? 'reported' : 'documented',
  status: 'registered',
  registeredAt: '2026-10-01T10:00:00Z',
}))

const input = {
  organizationName: 'Hitra kommune',
  period,
  categories: [{ value: 'aa' as const, label: 'AA' }, { value: 'aaa' as const, label: 'AAA' }],
  registrations: regs,
  deliveries: dels,
  now: NOW,
}

describe('environmental report model', () => {
  it('keeps registrations and deliveries apart, per unit', () => {
    const m = buildReportModel(input)
    assert.equal(m.registered.total, '200')
    assert.equal(m.registered.registrations, '40')
    assert.deepEqual(m.registered.categories, [
      { label: 'AA', quantity: '120', share: '60 %' },
      { label: 'AAA', quantity: '80', share: '40 %' },
    ])
    assert.deepEqual(m.delivered.totals, [
      { label: 'Levert, registrert i kilo', value: '375 kg (30 leveranser)' },
      { label: 'Levert, registrert i antall', value: '9 000 stk. (30 leveranser)' },
    ])
    assert.equal(m.delivered.documented, '15')
    assert.equal(m.delivered.reported, '45')
    assert.equal(m.delivered.rows.length, 60)
    assert.equal(m.periodLabel, '01.01.2026–31.10.2026')
    assert.equal(m.generatedLabel, '31.10.2026 kl. 14:05')
    assert.equal(m.registered.trend.length, 10, 'monthly buckets for the year so far')
  })

  it('makes no unsupported environmental claims', () => {
    const text = JSON.stringify(buildReportModel(input)).toLowerCase() + METHOD_TEXT.join(' ').toLowerCase()
    for (const banned of ['tonn co2', 'kg co2', 'co2-besparelse', 'verifisert gjenvinning', 'sertifisert', 'resirkulert av']) {
      assert.ok(!text.includes(banned), banned)
    }
    assert.match(METHOD_TEXT.join(' '), /ikke en bekreftelse på gjenvinning eller på Miljøfyrtårn-sertifisering/)
    assert.match(METHOD_TEXT.join(' '), /regnes aldri om/)
    assert.equal(REGISTERED_HEADING, 'Registrerte batterier (egenrapportert)')
    assert.equal(DELIVERED_HEADING, 'Leverte batterier (oppgitt eller dokumentert)')
  })

  it('handles an empty period', () => {
    const m = buildReportModel({ ...input, registrations: [], deliveries: [] })
    assert.equal(m.delivered.empty, true)
    assert.equal(m.registered.categories[0]!.share, '–')
  })

  it('formats numbers with plain spaces only', () => {
    assert.equal(formatNumberNo(1234567.891, 2), '1 234 567,89')
    assert.equal(winAnsiSafe('CO₂ «Øst» — 🚛'), 'CO2 «Øst» — ?')
  })
})

describe('environmental report PDF', () => {
  it('renders a valid multi-page A4 PDF with Norwegian text and user input', async () => {
    const bytes = await renderReportPdf(buildReportModel(input), null)
    const doc = await PDFDocument.load(bytes)
    assert.ok(doc.getPageCount() >= 2, 'long delivery table paginates')
    const { width, height } = doc.getPage(0).getSize()
    assert.deepEqual([Math.round(width), Math.round(height)], [595, 842])
    assert.equal(doc.getTitle(), 'Miljørapport – Hitra kommune')
    assert.ok(Buffer.from(bytes).subarray(0, 5).toString() === '%PDF-')
  })

  it('builds the public download through the export helper', async () => {
    process.env.RECEIPT_LOGO_URL = ''
    const file = await buildPdfExport({ audience: 'public', organizationName: 'Bø kommune', offered: input.categories, period, registrations: regs, deliveries: dels }, NOW)
    assert.equal(file.contentType, 'application/pdf')
    assert.equal(file.filename, 'miljorapport-bo-kommune-2026-01-01-2026-10-31.pdf')
    const csv = buildCsvExport({ audience: 'public', organizationName: 'Bø kommune', offered: input.categories, period, registrations: regs, deliveries: dels }, 'leveranser')
    assert.equal(csv.filename, 'miljo-leveranser-bo-kommune-2026-01-01-2026-10-31.csv')
    assert.ok(!String(csv.body).includes('Status'))
  })
})

describe('environmental report layout', () => {
  it('starts the title below the full logo height, whatever the logo shape', () => {
    for (const logo of [{ width: 500, height: 515 }, { width: 400, height: 120 }, { width: 300, height: 900 }]) {
      const h = headerLayout(logo)
      assert.equal(h.logoWidth, LOGO_WIDTH)
      assert.ok(Math.abs(h.logoHeight - (logo.height / logo.width) * LOGO_WIDTH) < 1e-9)
      // The title's cap height (≈ 0.72 × 24 pt) sits within its first line box; the gap keeps it clear.
      assert.ok(h.advance >= h.logoHeight + HEADER_GAP, JSON.stringify(h))
    }
    // The old fixed 56 pt offset was shorter than the real aBoks logo (~95 pt tall at 92 pt wide).
    assert.ok(headerLayout({ width: 500, height: 515 }).advance > 56)
    const fallback = headerLayout(null)
    assert.ok(fallback.advance > fallback.logoHeight)
    assert.deepEqual(headerLayout({ width: 0, height: 10 }), fallback)
  })

  it('wraps long organisation names inside the content width', async () => {
    const doc = await PDFDocument.create()
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const width = 595.28 - 2 * 50
    const name = 'DEMO – Fjordvik kommune, Seksjon for teknisk drift og eiendomsforvaltning, rådhuset og tilhørende avdelinger (fiktive demonstrasjonsdata)'
    const lines = wrap(name, bold, 15, width)
    assert.ok(lines.length >= 2)
    for (const l of lines) assert.ok(bold.widthOfTextAtSize(l, 15) <= width, l)
    assert.equal(lines.join(' '), name)
    const word = wrap('X'.repeat(200), bold, 15, width)
    assert.ok(word.length > 1 && word.every((l) => bold.widthOfTextAtSize(l, 15) <= width))
  })

  it('shortens only the organisation name in the footer, keeping the period', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const width = 595.28 - 2 * 50 - 70
    assert.equal(footerText('Hitra kommune', '01.01.2026–31.10.2026', font, 7.5, width), 'aBoks Miljøregistrering · Hitra kommune · 01.01.2026–31.10.2026')
    const long = footerText('DEMO – Fjordvik kommune, Seksjon for teknisk drift og eiendomsforvaltning, rådhuset og tilhørende avdelinger', '01.01.2026–31.10.2026', font, 7.5, width)
    assert.ok(font.widthOfTextAtSize(long, 7.5) <= width)
    assert.ok(long.endsWith('… · 01.01.2026–31.10.2026'), long)
    assert.ok(long.startsWith('aBoks Miljøregistrering · DEMO – Fjordvik'))
  })

  it('renders with a real tall logo and a long name', async () => {
    const sharp = (await import('sharp')).default
    const logo = await sharp({ create: { width: 500, height: 515, channels: 4, background: '#39402c' } }).png().toBuffer()
    const long = { ...input, organizationName: 'DEMO – Fjordvik kommune, Seksjon for teknisk drift og eiendomsforvaltning, rådhuset (fiktive demonstrasjonsdata)' }
    const doc = await PDFDocument.load(await renderReportPdf(buildReportModel(long), new Uint8Array(logo)))
    assert.ok(doc.getPageCount() >= 2)
  })
})
