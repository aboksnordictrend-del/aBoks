import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { DELIVERY_UNIT_LABELS } from './constants'
import { MILJO_GROUPING_LABELS, formatDayKey, periodLabel, type MiljoPeriod } from './period'
import {
  publicDeliveryRows,
  registrationTrend,
  summarizeDeliveries,
  summarizeRegistrations,
  type DeliveryRecord,
  type RegistrationRecord,
} from './stats'

/**
 * «Miljørapport» — the organisation's environmental report as a PDF, in Norwegian Bokmål.
 *
 * Two layers, as in src/lib/receiptPdf.ts:
 *   • buildReportModel(...) — pure: every text and number exactly as it will be printed, so the
 *     content (and what it must NOT claim) is unit-tested without rendering;
 *   • renderReportPdf(model, logo) — draws the model with pdf-lib's standard fonts (no font files,
 *     Vercel-safe), paginating tables and adding page numbers.
 *
 * The report keeps «Registrerte batterier (egenrapportert)» and «Leverte batterier (oppgitt eller
 * dokumentert)» in separate sections, never adds them up, never converts kilograms to pieces, and
 * makes no claim about verified recycling, CO2 effect or Miljøfyrtårn certification.
 */

export const REPORT_TITLE = 'Miljørapport'
export const REGISTERED_HEADING = 'Registrerte batterier (egenrapportert)'
export const DELIVERED_HEADING = 'Leverte batterier (oppgitt eller dokumentert)'

export const METHOD_TEXT: readonly string[] = [
  'Registrerte batterier er antall batterier som ansatte selv har oppgitt via organisasjonens QR-kode på aBoks XL. Registreringene er anonyme og blir ikke kontrollert. De viser hva som er meldt inn, ikke hva som er levert til gjenvinning.',
  'Leverte batterier er leveranser til et mottak eller avfallsselskap, registrert av organisasjonens ansvarlige person med PIN-kode. «Dokumentert med kvittering» betyr at et vedlegg (for eksempel en kvittering) er lagt ved registreringen. «Oppgitt av ansvarlig» betyr at leveransen er registrert uten vedlegg. aBoks har ikke kontrollert opplysningene, og ingen av statusene er en bekreftelse fra mottaket.',
  'Mengder i kilo og antall stykk vises slik de ble registrert, og regnes aldri om til hverandre. Registrerte og leverte batterier er separate tall som ikke kan legges sammen eller sammenlignes direkte.',
  'Registreringer og leveranser som aBoks har ugyldiggjort, er ikke med. Korrigerte registreringer er tatt med med de korrigerte verdiene.',
  'Rapporten inneholder ingen beregning av klima- eller miljøeffekt (for eksempel CO2), og er ikke en bekreftelse på gjenvinning eller på Miljøfyrtårn-sertifisering. Den kan brukes som underlagsdokumentasjon i organisasjonens eget miljøarbeid.',
]

export interface ReportModel {
  title: string
  organizationName: string
  periodLabel: string
  generatedLabel: string
  issuer: string
  registered: {
    total: string
    registrations: string
    categories: { label: string; quantity: string; share: string }[]
    trendTitle: string
    trend: { label: string; value: number }[]
  }
  delivered: {
    totals: { label: string; value: string }[]
    documented: string
    reported: string
    operators: { name: string; deliveries: string; amounts: string }[]
    rows: { date: string; quantity: string; operator: string; documentation: string }[]
    empty: boolean
  }
  method: readonly string[]
}

const NBSP_NARROW = String.fromCharCode(0x202f)
const NBSP = String.fromCharCode(0xa0)

/** Norwegian number format with plain spaces (the narrow no-break space is not in WinAnsi). */
export function formatNumberNo(value: number, maxDecimals = 0): string {
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: maxDecimals })
    .format(value)
    .split(NBSP_NARROW)
    .join(' ')
    .split(NBSP)
    .join(' ')
    .replace(String.fromCharCode(0x2212), '-')
}

export const formatQuantity = (quantity: number, unit: 'kg' | 'stk'): string =>
  `${formatNumberNo(quantity, unit === 'kg' ? 2 : 0)} ${DELIVERY_UNIT_LABELS[unit]}`

function osloStamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}.${get('month')}.${get('year')} kl. ${get('hour')}:${get('minute')}`
}

export interface ReportInput {
  organizationName: string
  period: MiljoPeriod
  /** Categories to list, with the organisation's labels. */
  categories: { value: 'aa' | 'aaa' | 'other'; label: string }[]
  registrations: RegistrationRecord[]
  deliveries: DeliveryRecord[]
  now?: Date
}

export function buildReportModel(input: ReportInput): ReportModel {
  const reg = summarizeRegistrations(input.registrations)
  const del = summarizeDeliveries(input.deliveries)
  const share = (n: number) => (reg.total > 0 ? `${formatNumberNo((n / reg.total) * 100, 1)} %` : '–')

  const totals: { label: string; value: string }[] = []
  for (const unit of ['kg', 'stk'] as const) {
    const t = del.byUnit[unit]
    if (t.deliveries === 0) continue
    totals.push({
      label: unit === 'kg' ? 'Levert, registrert i kilo' : 'Levert, registrert i antall',
      value: `${formatQuantity(t.quantity, unit)} (${t.deliveries} ${t.deliveries === 1 ? 'leveranse' : 'leveranser'})`,
    })
  }

  return {
    title: REPORT_TITLE,
    organizationName: input.organizationName,
    periodLabel: periodLabel(input.period),
    generatedLabel: osloStamp(input.now ?? new Date()),
    issuer: 'ABOKS AS · aboks.no',
    registered: {
      total: formatNumberNo(reg.total),
      registrations: formatNumberNo(reg.registrations),
      categories: input.categories.map((c) => ({ label: c.label, quantity: formatNumberNo(reg.byCategory[c.value]), share: share(reg.byCategory[c.value]) })),
      trendTitle: `Registrerte batterier per ${MILJO_GROUPING_LABELS[input.period.grouping].toLowerCase()}`,
      trend: registrationTrend(input.registrations, input.period).map((p) => ({ label: p.label, value: p.total })),
    },
    delivered: {
      totals,
      documented: formatNumberNo(del.documented),
      reported: formatNumberNo(del.reported),
      operators: del.operators.map((o) => ({
        name: o.name,
        deliveries: formatNumberNo(o.deliveries),
        amounts: [o.kg > 0 ? formatQuantity(o.kg, 'kg') : '', o.stk > 0 ? formatQuantity(o.stk, 'stk') : ''].filter(Boolean).join(' og '),
      })),
      rows: publicDeliveryRows(input.deliveries)
        .reverse()
        .map((d) => ({ date: formatDayKey(d.deliveryDate), quantity: formatQuantity(d.quantity, d.unit), operator: d.operator, documentation: d.documentation })),
      empty: del.deliveries === 0,
    },
    method: METHOD_TEXT,
  }
}

// ── Rendering ──

const A4 = { width: 595.28, height: 841.89 }
const M = 50
const INK = rgb(0.1, 0.11, 0.09)
const BODY = rgb(0.29, 0.31, 0.25)
const MUTED = rgb(0.42, 0.44, 0.39)
const ACCENT = rgb(0.37, 0.42, 0.28)
const LINE = rgb(0.86, 0.83, 0.77)
const SOFT = rgb(0.95, 0.94, 0.91)

// Windows-1252 code points outside Latin-1 that the standard fonts can draw.
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019,
  0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

/** Replaces anything the standard (WinAnsi) fonts cannot encode — user-typed text included. */
export function winAnsiSafe(text: string): string {
  let out = ''
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c === 0x2082) out += '2'
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.has(c)) out += ch
    else if (c === 0x0a || c === 0x09) out += ' '
    else out += '?'
  }
  return out
}

/** Logo width on the page, in points. The height follows the image's own aspect ratio. */
export const LOGO_WIDTH = 92
/** Space between the bottom of the logo (or text fallback) and the top of the report title. */
export const HEADER_GAP = 18
const FALLBACK_LOGO_HEIGHT = 26

/**
 * Vertical layout of the page-1 header. `advance` is how far the cursor moves down from the top
 * margin before the title is drawn: the logo's full drawn height plus a gap. Pure, so the
 * no-overlap rule is unit-tested for any logo shape.
 */
export function headerLayout(logo: { width: number; height: number } | null): {
  logoWidth: number
  logoHeight: number
  advance: number
} {
  const valid = logo && logo.width > 0 && logo.height > 0
  const logoHeight = valid ? (logo.height / logo.width) * LOGO_WIDTH : FALLBACK_LOGO_HEIGHT
  return { logoWidth: LOGO_WIDTH, logoHeight, advance: logoHeight + HEADER_GAP }
}

interface Ctx {
  pdf: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

/**
 * One-line page footer: «aBoks Miljøregistrering · <organisasjon> · <periode>». When it is too
 * wide, only the organisation name is shortened (with «…»), so the period is always shown.
 */
export function footerText(organizationName: string, period: string, font: PDFFont, size: number, width: number): string {
  const build = (name: string) => winAnsiSafe(`aBoks Miljøregistrering · ${name} · ${period}`)
  const fits = (t: string) => font.widthOfTextAtSize(t, size) <= width
  if (fits(build(organizationName))) return build(organizationName)
  let name = winAnsiSafe(organizationName)
  while (name.length > 1 && !fits(build(`${name.trimEnd()}…`))) name = name.slice(0, -1)
  return build(`${name.trimEnd()}…`)
}

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = winAnsiSafe(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate
    else {
      if (current) lines.push(current)
      // A single word wider than the column is cut rather than overflowing.
      let w = word
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let cut = w.length - 1
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--
        lines.push(w.slice(0, cut))
        w = w.slice(cut)
      }
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.pdf.addPage([A4.width, A4.height])
  ctx.y = A4.height - M
}

function ensure(ctx: Ctx, height: number): void {
  if (ctx.y - height < M + 30) newPage(ctx)
}

function text(ctx: Ctx, value: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}): void {
  const size = opts.size ?? 10
  const font = opts.bold ? ctx.bold : ctx.font
  const x = opts.x ?? M
  const width = opts.width ?? A4.width - M - x
  const lineHeight = size * 1.4
  for (const line of wrap(value, font, size, width)) {
    ensure(ctx, lineHeight)
    ctx.y -= lineHeight
    ctx.page.drawText(line, { x, y: ctx.y + size * 0.3, size, font, color: opts.color ?? BODY })
  }
  ctx.y -= opts.gap ?? 0
}

/** `keepWith`: height of the block that must follow on the same page (no orphaned headings). */
function heading(ctx: Ctx, value: string, keepWith = 0): void {
  ensure(ctx, 60 + keepWith)
  ctx.y -= 14
  text(ctx, value, { size: 14, bold: true, color: INK, gap: 4 })
  ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4.width - M, y: ctx.y }, thickness: 0.8, color: ACCENT })
  ctx.y -= 8
}

function keyValues(ctx: Ctx, rows: { label: string; value: string }[]): void {
  // A summary block is never split across pages.
  ensure(ctx, rows.length * 16 + 6)
  for (const r of rows) {
    ensure(ctx, 18)
    ctx.y -= 16
    ctx.page.drawText(winAnsiSafe(r.label), { x: M, y: ctx.y, size: 10, font: ctx.font, color: MUTED })
    ctx.page.drawText(winAnsiSafe(r.value), { x: M + 230, y: ctx.y, size: 10.5, font: ctx.bold, color: INK })
  }
  ctx.y -= 6
}

function table(ctx: Ctx, columns: { title: string; width: number; align?: 'right' }[], rows: string[][]): void {
  const size = 9
  const pad = 4
  const drawHeader = () => {
    ensure(ctx, 40)
    ctx.page.drawRectangle({ x: M, y: ctx.y - 18, width: A4.width - 2 * M, height: 18, color: SOFT })
    let x = M
    for (const c of columns) {
      const w = ctx.bold.widthOfTextAtSize(c.title, size)
      ctx.page.drawText(c.title, { x: c.align === 'right' ? x + c.width - pad - w : x + pad, y: ctx.y - 12.5, size, font: ctx.bold, color: INK })
      x += c.width
    }
    ctx.y -= 18
  }
  drawHeader()
  for (const row of rows) {
    const cells = row.map((v, i) => wrap(v, ctx.font, size, columns[i]!.width - 2 * pad))
    const height = Math.max(...cells.map((c) => c.length)) * size * 1.35 + 6
    if (ctx.y - height < M + 30) {
      newPage(ctx)
      drawHeader()
    }
    let x = M
    cells.forEach((lines, i) => {
      const col = columns[i]!
      lines.forEach((line, li) => {
        const w = ctx.font.widthOfTextAtSize(line, size)
        ctx.page.drawText(line, {
          x: col.align === 'right' ? x + col.width - pad - w : x + pad,
          y: ctx.y - 11 - li * size * 1.35,
          size,
          font: ctx.font,
          color: BODY,
        })
      })
      x += col.width
    })
    ctx.y -= height
    ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4.width - M, y: ctx.y }, thickness: 0.4, color: LINE })
  }
  ctx.y -= 8
}

function barChart(ctx: Ctx, points: { label: string; value: number }[]): void {
  const height = 130
  ensure(ctx, height + 40)
  const width = A4.width - 2 * M
  const top = ctx.y - 8
  const base = top - height
  const max = Math.max(1, ...points.map((p) => p.value))
  const slot = width / points.length
  const bar = Math.max(2, Math.min(28, slot * 0.7))
  ctx.page.drawLine({ start: { x: M, y: base }, end: { x: M + width, y: base }, thickness: 0.6, color: LINE })
  const labelEvery = Math.ceil(points.length / 12)
  points.forEach((p, i) => {
    const h = (p.value / max) * (height - 16)
    const x = M + i * slot + (slot - bar) / 2
    if (h > 0) ctx.page.drawRectangle({ x, y: base, width: bar, height: h, color: ACCENT })
    if (p.value > 0 && points.length <= 24) {
      const t = formatNumberNo(p.value)
      const w = ctx.font.widthOfTextAtSize(t, 7)
      ctx.page.drawText(t, { x: x + bar / 2 - w / 2, y: base + h + 3, size: 7, font: ctx.font, color: INK })
    }
    if (i % labelEvery === 0) {
      const t = winAnsiSafe(p.label)
      const w = ctx.font.widthOfTextAtSize(t, 7)
      ctx.page.drawText(t, { x: x + bar / 2 - w / 2, y: base - 11, size: 7, font: ctx.font, color: MUTED })
    }
  })
  ctx.y = base - 22
}

export async function renderReportPdf(model: ReportModel, logo: Uint8Array | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(winAnsiSafe(`${model.title} – ${model.organizationName}`))
  pdf.setAuthor('ABOKS AS')
  pdf.setSubject('aBoks Miljøregistrering')
  pdf.setProducer('aBoks Miljøregistrering')
  pdf.setLanguage('nb-NO')
  const ctx: Ctx = {
    pdf,
    page: pdf.addPage([A4.width, A4.height]),
    y: A4.height - M,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }

  // Header: logo (or text fallback) left, report label right.
  let image: PDFImage | null = null
  if (logo) {
    try {
      image = await pdf.embedPng(logo)
    } catch {
      image = null
    }
  }
  const header = headerLayout(image ? { width: image.width, height: image.height } : null)
  if (image) {
    ctx.page.drawImage(image, { x: M, y: ctx.y - header.logoHeight, width: header.logoWidth, height: header.logoHeight })
  } else {
    ctx.page.drawText('aBoks', { x: M, y: ctx.y - 20, size: 22, font: ctx.bold, color: ACCENT })
  }
  const label = 'aBoks Miljøregistrering'
  ctx.page.drawText(winAnsiSafe(label), {
    x: A4.width - M - ctx.font.widthOfTextAtSize(winAnsiSafe(label), 9),
    y: ctx.y - 12,
    size: 9,
    font: ctx.font,
    color: MUTED,
  })
  // Below the logo's real height (not a fixed offset), so the title never overlaps it.
  ctx.y -= header.advance

  text(ctx, `${model.title}`, { size: 24, bold: true, color: INK })
  text(ctx, model.organizationName, { size: 15, bold: true, color: ACCENT, gap: 6 })
  keyValues(ctx, [
    { label: 'Rapportperiode', value: model.periodLabel },
    { label: 'Generert', value: model.generatedLabel },
    { label: 'Utstedt av', value: model.issuer },
  ])

  // Notice box.
  const notice =
    'Rapporten skiller mellom batterier som ansatte selv har registrert, og leveranser som organisasjonens ansvarlige har registrert. Tallene måles på ulike måter og kan ikke legges sammen.'
  const noticeLines = wrap(notice, ctx.font, 9.5, A4.width - 2 * M - 20)
  const boxH = noticeLines.length * 13.3 + 14
  ensure(ctx, boxH + 10)
  ctx.page.drawRectangle({ x: M, y: ctx.y - boxH, width: A4.width - 2 * M, height: boxH, color: SOFT, borderColor: LINE, borderWidth: 0.6 })
  noticeLines.forEach((l, i) => ctx.page.drawText(l, { x: M + 10, y: ctx.y - 17 - i * 13.3, size: 9.5, font: ctx.font, color: BODY }))
  ctx.y -= boxH + 6

  // 1. Registered.
  heading(ctx, `1. ${REGISTERED_HEADING}`, 2 * 16 + 6)
  keyValues(ctx, [
    { label: 'Registrerte batterier totalt', value: model.registered.total },
    { label: 'Antall registreringer', value: model.registered.registrations },
  ])
  table(
    ctx,
    [
      { title: 'Batteritype', width: 255 },
      { title: 'Antall', width: 120, align: 'right' },
      { title: 'Andel', width: 120, align: 'right' },
    ],
    model.registered.categories.map((c) => [c.label, c.quantity, c.share]),
  )
  if (model.registered.trend.length > 1) {
    text(ctx, model.registered.trendTitle, { size: 10.5, bold: true, color: INK, gap: 2 })
    barChart(ctx, model.registered.trend)
  }

  // 2. Delivered.
  heading(ctx, `2. ${DELIVERED_HEADING}`, model.delivered.empty ? 20 : (model.delivered.totals.length + 2) * 16 + 6)
  if (model.delivered.empty) {
    text(ctx, 'Ingen leveranser er registrert i perioden.', { gap: 6 })
  } else {
    keyValues(ctx, [
      ...model.delivered.totals,
      { label: 'Dokumentert med kvittering', value: `${model.delivered.documented} leveranser` },
      { label: 'Oppgitt av ansvarlig', value: `${model.delivered.reported} leveranser` },
    ])
    text(ctx, 'Mottak / avfallsselskap', { size: 10.5, bold: true, color: INK, gap: 2 })
    table(
      ctx,
      [
        { title: 'Mottak', width: 255 },
        { title: 'Leveranser', width: 80, align: 'right' },
        { title: 'Mengde', width: 160, align: 'right' },
      ],
      model.delivered.operators.map((o) => [o.name, o.deliveries, o.amounts]),
    )
    text(ctx, 'Leveranser', { size: 10.5, bold: true, color: INK, gap: 2 })
    table(
      ctx,
      [
        { title: 'Dato for levering', width: 95 },
        { title: 'Levert mengde', width: 95, align: 'right' },
        { title: 'Mottak / avfallsselskap', width: 165 },
        { title: 'Dokumentasjon', width: 140 },
      ],
      model.delivered.rows.map((r) => [r.date, r.quantity, r.operator, r.documentation]),
    )
  }

  // 3. Method.
  heading(ctx, '3. Metode og begrensninger', 3 * 13.3)
  for (const p of model.method) text(ctx, p, { size: 9.5, gap: 6 })

  // Footer with page numbers.
  const pages = pdf.getPages()
  const left = footerText(model.organizationName, model.periodLabel, ctx.font, 7.5, A4.width - 2 * M - 70)
  pages.forEach((page, i) => {
    page.drawLine({ start: { x: M, y: M - 8 }, end: { x: A4.width - M, y: M - 8 }, thickness: 0.4, color: LINE })
    page.drawText(left, { x: M, y: M - 20, size: 7.5, font: ctx.font, color: MUTED })
    const right = `Side ${i + 1} av ${pages.length}`
    page.drawText(right, { x: A4.width - M - ctx.font.widthOfTextAtSize(right, 7.5), y: M - 20, size: 7.5, font: ctx.font, color: MUTED })
  })

  return pdf.save()
}

// ── Logo ──

const DEFAULT_LOGO_URL = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/logo-wf-new.png'

/** Same logo and env switch as the receipt (RECEIPT_LOGO_URL='' disables the fetch). Never throws. */
export async function fetchReportLogo(): Promise<Uint8Array | null> {
  const url = process.env.RECEIPT_LOGO_URL ?? DEFAULT_LOGO_URL
  if (!url) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
