// Demo PDF and CSV for /miljoregistrering — built in the browser from the demo's fictional state
// by the same pure builders the real export endpoint uses (src/lib/miljo/csv.ts, reportPdf.ts),
// then marked «DEMO – EKSEMPELDATA» so a file can never pass for real documentation.
//
// Loaded with import() on the first click only: pdf-lib is far too heavy for the page itself.

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { csvCell } from '@/lib/pilot/csv'
import { deliveriesCsv, registrationsCsv, summaryCsv, type CsvType } from '@/lib/miljo/csv'
import { METHOD_TEXT, buildReportModel, renderReportPdf, winAnsiSafe } from '@/lib/miljo/reportPdf'
import { deliveryTrend, registrationTrend } from '@/lib/miljo/stats'
import { DEMO_CATEGORIES, DEMO_LABEL, DEMO_ORG_NAME, demoPeriod, type DemoState } from './demoModel'

const BOM = String.fromCharCode(0xfeff)

export const DEMO_DISCLAIMER =
  'Denne filen er laget av fiktive eksempeldata i demoen på aboks.no/miljoregistrering. Den viser ingen faktiske registreringer eller leveranser og kan ikke brukes som miljødokumentasjon.'

const demoTitle = `${DEMO_ORG_NAME} (${DEMO_LABEL})`

function inPeriod(state: DemoState, now: Date) {
  const period = demoPeriod(now)
  return {
    period,
    registrations: state.registrations.filter((r) => r.registeredAt >= period.from && r.registeredAt < period.to),
    deliveries: state.deliveries.filter((d) => d.deliveryDate >= period.fromKey && d.deliveryDate <= period.toKey),
  }
}

/** Public-audience CSV, exactly as the real «Last ned statistikk (CSV)», with a DEMO first line. */
export function demoCsv(state: DemoState, type: CsvType, now: Date = new Date()): { body: string; filename: string } {
  const { period, registrations, deliveries } = inPeriod(state, now)
  const ctx = { audience: 'public' as const, title: demoTitle, period, categories: DEMO_CATEGORIES.map((c) => c.value) }
  const csv =
    type === 'registreringer'
      ? registrationsCsv(registrations, ctx)
      : type === 'leveranser'
        ? deliveriesCsv(deliveries, ctx)
        : summaryCsv(registrationTrend(registrations, period), deliveryTrend(deliveries, period), ctx)
  // The builders start with a BOM; the banner goes right after it, before anything else.
  const banner = [DEMO_LABEL, DEMO_DISCLAIMER].map(csvCell).join(';')
  const body = `${BOM}${banner}\r\n\r\n${csv.startsWith(BOM) ? csv.slice(1) : csv}`
  return { body, filename: `DEMO-miljo-${type}-${period.fromKey}-${period.toKey}.csv` }
}

/**
 * The real «Miljørapport», rendered from demo data, with three marks no one can miss: «DEMO» in
 * the title and organisation line, a disclaimer as the first method paragraph, and a banner
 * plus a diagonal watermark on every page.
 */
export async function demoPdf(state: DemoState, logo: Uint8Array | null, now: Date = new Date()): Promise<{ body: Uint8Array; filename: string }> {
  const { period, registrations, deliveries } = inPeriod(state, now)
  const model = buildReportModel({
    organizationName: demoTitle,
    period,
    categories: DEMO_CATEGORIES,
    registrations,
    deliveries,
    now,
  })
  model.title = 'Miljørapport – DEMO'
  model.issuer = 'Demo på aboks.no – ikke en ekte rapport'
  model.method = [DEMO_DISCLAIMER, ...METHOD_TEXT]

  const pdf = await PDFDocument.load(await renderReportPdf(model, logo))
  pdf.setTitle(winAnsiSafe(`${DEMO_LABEL} – Miljørapport – ${DEMO_ORG_NAME}`))
  pdf.setKeywords(['DEMO', 'EKSEMPELDATA'])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mark = winAnsiSafe(DEMO_LABEL)
  const banner = winAnsiSafe(`${DEMO_LABEL} · Fiktive tall – ikke ekte miljødokumentasjon`)
  const red = rgb(0.7, 0.15, 0.12)

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize()
    const size = 58
    const w = bold.widthOfTextAtSize(mark, size)
    // Centred on the page, rotated 35°: start half the text's length back along the slope.
    const a = (35 * Math.PI) / 180
    page.drawText(mark, {
      x: width / 2 - (w / 2) * Math.cos(a),
      y: height / 2 - (w / 2) * Math.sin(a),
      size,
      font: bold,
      color: red,
      opacity: 0.12,
      rotate: degrees(35),
    })
    page.drawRectangle({ x: 0, y: height - 22, width, height: 22, color: red })
    const bw = bold.widthOfTextAtSize(banner, 9)
    page.drawText(banner, { x: (width - bw) / 2, y: height - 15, size: 9, font: bold, color: rgb(1, 1, 1) })
  }

  return { body: await pdf.save(), filename: `DEMO-miljorapport-${period.fromKey}-${period.toKey}.pdf` }
}
