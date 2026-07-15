import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Order } from '@/payload-types'

/**
 * PDF receipt (Kvittering) for a delivered order.
 *
 * Deliberately MVA-free: aBoks is not registered in Merverdiavgiftsregisteret, so the
 * document must never mention MVA, an MVA rate, an MVA amount, "inkl./eks. MVA" or the
 * word "Faktura". It is a *receipt* built entirely from the amounts stored on the order —
 * never recomputed from the current catalogue prices, which may have changed since the
 * purchase.
 *
 * Two layers, split so the content is unit-testable without rendering a PDF:
 *   • buildReceiptModel(order) — pure: the labelled rows exactly as they will appear.
 *   • renderReceiptPdf(model, logo) — draws the model with pdf-lib (pure JS, Vercel-safe).
 */

// Seller (legal entity) identity — the single place to change when the selling company
// changes. ABOKS AS is not yet registered, so sales currently run through LUKOCIUS
// NORDICTREND. Once ABOKS AS is registered, either set the COMPANY_NAME / COMPANY_ORG_NR
// env vars or update these two defaults — nothing else in the receipt logic depends on it.
// The aBoks brand (logo), email and website are separate and stay the same regardless.
const DEFAULT_SELLER_NAME = 'LUKOCIUS NORDICTREND'
const DEFAULT_SELLER_ORG_NR = '937 172 877'

export const SELLER_EMAIL = 'post@aboks.no'
export const SELLER_WEBSITE = 'aboks.no'

// Env is read lazily (per call) so it stays configurable and testable, matching
// mailTransport's getEmailSendTimeoutMs.
const sellerName = (): string => process.env.COMPANY_NAME || DEFAULT_SELLER_NAME
const sellerOrgNr = (): string => (process.env.COMPANY_ORG_NR || DEFAULT_SELLER_ORG_NR).trim()

// Logo URL default; an empty RECEIPT_LOGO_URL (e.g. in tests) disables the network fetch
// and forces the text fallback, so PDF generation is deterministic and never depends on a
// reachable blob URL.
const DEFAULT_LOGO_URL = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/logo-wf-new.png'
const logoUrl = (): string => process.env.RECEIPT_LOGO_URL ?? DEFAULT_LOGO_URL
const logoFetchTimeoutMs = (): number => Number(process.env.RECEIPT_LOGO_FETCH_TIMEOUT_MS ?? 4_000)

/** Norwegian money format: 1299 → "1 299,00 kr", 499.5 → "499,50 kr". */
export function formatNok(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const sign = value < 0 ? '-' : ''
  return `${sign}${grouped},${decPart} kr`
}

/** Norwegian date, e.g. "16.07.2026". Returns '' for a missing/invalid input. */
export function formatDateNo(input?: string | null): string {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

export type ReceiptLine = {
  name: string
  quantity: number
  unitPrice: string
  lineTotal: string
}

export type ReceiptTotalRow = { label: string; value: string; strong?: boolean }

export type ReceiptModel = {
  title: string
  seller: string
  sellerOrgNr?: string
  sellerEmail: string
  sellerWebsite: string
  orderNumber: string
  orderDate: string
  paidDate?: string
  customerName: string
  customerAddress: string[]
  customerEmail: string
  lines: ReceiptLine[]
  totals: ReceiptTotalRow[]
  paymentMethod?: string
  paymentStatus: string
}

function customerNameOf(order: Order): string {
  return (
    [order.customerInfo?.firstName, order.customerInfo?.lastName].filter(Boolean).join(' ') ||
    'Kunde'
  )
}

function customerAddressOf(order: Order): string[] {
  const info = order.customerInfo ?? {}
  const cityLine = [info.postalCode, info.city].filter(Boolean).join(' ')
  return [info.address, cityLine].map((s) => (s ?? '').trim()).filter(Boolean)
}

function lineNameOf(item: NonNullable<Order['items']>[number]): string {
  return ['aBoks', item.variantName].filter(Boolean).join(' – ')
}

/**
 * Builds the exact labelled content of the receipt from the stored order. Pure and
 * deterministic — no MVA anywhere. Discount is inferred only from the stored amounts
 * (subtotal + frakt − total) so a purchase-time discount still shows without recomputing
 * anything from the catalogue.
 */
export function buildReceiptModel(order: Order): ReceiptModel {
  const items = order.items ?? []
  const lines: ReceiptLine[] = items.map((item) => ({
    name: lineNameOf(item),
    quantity: item.quantity,
    unitPrice: formatNok(item.unitPrice),
    lineTotal: formatNok(item.lineTotal),
  }))

  const shipping = order.shipping ?? 0
  const discount = order.subtotal + shipping - order.total

  const totals: ReceiptTotalRow[] = [{ label: 'Delsum', value: formatNok(order.subtotal) }]
  totals.push({
    label: 'Frakt',
    value: shipping > 0 ? formatNok(shipping) : 'Gratis',
  })
  if (discount > 0.005) {
    totals.push({ label: 'Rabatt', value: `-${formatNok(discount)}` })
  }
  totals.push({ label: 'Totalt betalt', value: formatNok(order.total), strong: true })

  const model: ReceiptModel = {
    title: 'KVITTERING',
    seller: sellerName(),
    sellerEmail: SELLER_EMAIL,
    sellerWebsite: SELLER_WEBSITE,
    orderNumber: order.orderNumber,
    orderDate: formatDateNo(order.createdAt),
    customerName: customerNameOf(order),
    customerAddress: customerAddressOf(order),
    customerEmail: order.customerInfo?.email ?? '',
    lines,
    totals,
    paymentStatus: 'Betalt',
  }

  const orgNr = sellerOrgNr()
  if (orgNr) model.sellerOrgNr = orgNr

  return model
}

// ── Rendering ────────────────────────────────────────────────────────────────

const INK = rgb(0.102, 0.114, 0.09) // #1a1d17
const MUTED = rgb(0.5, 0.5, 0.5)
const HAIRLINE = rgb(0.878, 0.878, 0.878)

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 48

/**
 * WinAnsi (the encoding of pdf-lib's standard Helvetica) covers Norwegian æ/ø/å and
 * common CP1252 punctuation, but throws on anything outside it (emoji, non-Latin). We
 * map the few smart-punctuation characters we emit and replace anything else with '?'
 * so an unusual product name or address can never crash receipt generation.
 */
function winAnsiSafe(text: string): string {
  return text
    .replace(/–|—/g, '-') // – — → -
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ | /g, ' ')
    .replace(/[^\x09\x0a\x0d\x20-\x7e¡-ÿ€]/g, '?')
}

type Ctx = {
  page: PDFPage
  font: PDFFont
  bold: PDFFont
  y: number
}

function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  size: number,
  opts: { font?: PDFFont; color?: ReturnType<typeof rgb> } = {},
): void {
  ctx.page.drawText(winAnsiSafe(text), {
    x,
    y: ctx.y,
    size,
    font: opts.font ?? ctx.font,
    color: opts.color ?? INK,
  })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = winAnsiSafe(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

async function fetchLogo(): Promise<Uint8Array | null> {
  const url = logoUrl()
  if (!url) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), logoFetchTimeoutMs())
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    // Never let an unreachable logo fail receipt generation — the caller renders the
    // "aBoks" text fallback instead.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Draws the receipt model onto a single-page A4 PDF and returns the bytes. */
export async function renderReceiptPdf(
  model: ReceiptModel,
  logo: Uint8Array | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([A4.width, A4.height])

  const ctx: Ctx = { page, font, bold, y: A4.height - MARGIN }
  const rightX = A4.width - MARGIN
  const contentWidth = A4.width - MARGIN * 2

  // ── Header: logo (or text fallback) left, seller details right ──
  const headerTop = ctx.y
  let logoDrawn = false
  if (logo) {
    try {
      const img = await pdf.embedPng(logo)
      const w = 90
      const h = (img.height / img.width) * w
      page.drawImage(img, { x: MARGIN, y: headerTop - h + 8, width: w, height: h })
      logoDrawn = true
    } catch {
      logoDrawn = false
    }
  }
  if (!logoDrawn) {
    page.drawText('aBoks', { x: MARGIN, y: headerTop - 14, size: 22, font: bold, color: INK })
  }

  // Seller block, right-aligned, under a "Selger:" label. The seller is the legal entity
  // (currently LUKOCIUS NORDICTREND); the aBoks logo above is the brand — the two are
  // deliberately distinct.
  const sellerLines = [
    model.seller,
    ...(model.sellerOrgNr ? [`Org.nr. ${model.sellerOrgNr}`] : []),
    model.sellerEmail,
    model.sellerWebsite,
  ]
  let sy = headerTop
  const labelW = font.widthOfTextAtSize('Selger:', 8)
  page.drawText('Selger:', { x: rightX - labelW, y: sy, size: 8, font, color: MUTED })
  sy -= 14
  sellerLines.forEach((line, i) => {
    const size = i === 0 ? 11 : 9
    const f = i === 0 ? bold : font
    const safe = winAnsiSafe(line)
    const w = f.widthOfTextAtSize(safe, size)
    page.drawText(safe, { x: rightX - w, y: sy, size, font: f, color: i === 0 ? INK : MUTED })
    sy -= i === 0 ? 15 : 12
  })

  ctx.y = Math.min(headerTop - 84, sy) - 16

  // ── Title ──
  drawText(ctx, model.title, MARGIN, 26, { font: bold })
  ctx.y -= 14
  page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: rightX, y: ctx.y },
    thickness: 2,
    color: INK,
  })
  ctx.y -= 26

  // ── Meta: order info (left) + customer (right) ──
  const metaTop = ctx.y
  const colRightX = MARGIN + contentWidth / 2 + 10

  // Left column — order details.
  const orderMeta: Array<[string, string]> = [
    ['Ordrenummer', `#${model.orderNumber}`],
    ['Ordredato', model.orderDate],
  ]
  if (model.paidDate) orderMeta.push(['Betalingsdato', model.paidDate])
  if (model.paymentMethod) orderMeta.push(['Betalingsmåte', model.paymentMethod])
  orderMeta.push(['Betalingsstatus', model.paymentStatus])

  let ly = metaTop
  for (const [label, value] of orderMeta) {
    page.drawText(winAnsiSafe(label), { x: MARGIN, y: ly, size: 8, font, color: MUTED })
    ly -= 12
    page.drawText(winAnsiSafe(value), { x: MARGIN, y: ly, size: 11, font: bold, color: INK })
    ly -= 18
  }

  // Right column — customer.
  const custWidth = rightX - colRightX
  let ry = metaTop
  page.drawText('KUNDE', { x: colRightX, y: ry, size: 8, font, color: MUTED })
  ry -= 15
  const custBlock = [model.customerName, ...model.customerAddress, model.customerEmail].filter(
    Boolean,
  )
  for (const raw of custBlock) {
    for (const wrapped of wrapText(raw, font, 10, custWidth)) {
      page.drawText(wrapped, { x: colRightX, y: ry, size: 10, font, color: INK })
      ry -= 14
    }
  }

  ctx.y = Math.min(ly, ry) - 12

  // ── Items table ──
  const colQty = rightX - 210
  const colUnit = rightX - 130
  const colSum = rightX

  const headerY = ctx.y
  const headerRight = (label: string, x: number) => {
    const w = font.widthOfTextAtSize(label, 8)
    page.drawText(label, { x: x - w, y: headerY, size: 8, font, color: MUTED })
  }
  page.drawText('PRODUKT', { x: MARGIN, y: headerY, size: 8, font, color: MUTED })
  headerRight('ANTALL', colQty)
  headerRight('PRIS', colUnit)
  headerRight('SUM', colSum)

  // Header underline; the row loop then leaves a clear gap before the first product.
  const headerLineY = headerY - 10
  page.drawLine({
    start: { x: MARGIN, y: headerLineY },
    end: { x: rightX, y: headerLineY },
    thickness: 1,
    color: HAIRLINE,
  })

  // Row geometry. Each row occupies a band from rowTop down to rowBottom; the text
  // baselines sit inside it with padding, and the separator is drawn at rowBottom only.
  // Because rowTop, textY and rowBottom are distinct, a separator can never be drawn
  // through the next row's text — the spacing is stable for any number of lines.
  const TEXT_SIZE = 10
  const LINE_H = 14 // baseline-to-baseline for a wrapped (multi-line) product name
  const ROW_TOP_GAP = 16 // rowTop → first text baseline
  const ROW_BOTTOM_GAP = 12 // last text baseline → rowBottom (the separator)

  const nameWidth = colQty - 40 - MARGIN
  const drawRightAt = (text: string, x: number, y: number, size: number, f: PDFFont) => {
    const safe = winAnsiSafe(text)
    const w = f.widthOfTextAtSize(safe, size)
    page.drawText(safe, { x: x - w, y, size, font: f, color: INK })
  }

  ctx.y = headerLineY
  for (const line of model.lines) {
    const nameLines = wrapText(line.name, font, TEXT_SIZE, nameWidth)
    const rowTop = ctx.y
    const textY = rowTop - ROW_TOP_GAP // first baseline, ~centred in the band
    nameLines.forEach((nl, i) => {
      page.drawText(nl, { x: MARGIN, y: textY - i * LINE_H, size: TEXT_SIZE, font, color: INK })
    })
    // Amounts align to the first baseline; right-alignment of the columns is unchanged.
    drawRightAt(String(line.quantity), colQty, textY, TEXT_SIZE, font)
    drawRightAt(line.unitPrice, colUnit, textY, TEXT_SIZE, font)
    drawRightAt(line.lineTotal, colSum, textY, TEXT_SIZE, font)

    const lastBaselineY = textY - (nameLines.length - 1) * LINE_H
    const rowBottom = lastBaselineY - ROW_BOTTOM_GAP
    page.drawLine({
      start: { x: MARGIN, y: rowBottom },
      end: { x: rightX, y: rowBottom },
      thickness: 0.5,
      color: HAIRLINE,
    })
    ctx.y = rowBottom
  }

  // ── Totals (right-aligned block) ──
  const totalsLabelX = rightX - 200
  const TOTALS_STEP = 20 // uniform baseline-to-baseline for Delsum / Frakt / Rabatt
  const TOTAL_TOP_GAP = 20 // extra space above Totalt betalt, holding the divider line

  ctx.y -= 16 // extra gap after the last product, before the totals block

  for (const row of model.totals) {
    const size = row.strong ? 13 : 10
    const f = row.strong ? bold : font

    if (row.strong) {
      // Divider sits midway in the gap between the previous row and the total — clear of
      // both baselines, never touching text.
      ctx.y -= TOTAL_TOP_GAP
      const lineY = ctx.y + TOTAL_TOP_GAP
      page.drawLine({
        start: { x: totalsLabelX, y: lineY },
        end: { x: rightX, y: lineY },
        thickness: 1.5,
        color: INK,
      })
    }

    page.drawText(winAnsiSafe(row.label), {
      x: totalsLabelX,
      y: ctx.y,
      size,
      font: f,
      color: row.strong ? INK : MUTED,
    })
    const valW = f.widthOfTextAtSize(winAnsiSafe(row.value), size)
    page.drawText(winAnsiSafe(row.value), {
      x: rightX - valW,
      y: ctx.y,
      size,
      font: f,
      color: INK,
    })

    ctx.y -= TOTALS_STEP
  }

  // ── Footer ──
  const footerY = MARGIN + 6
  page.drawLine({
    start: { x: MARGIN, y: footerY + 22 },
    end: { x: rightX, y: footerY + 22 },
    thickness: 0.5,
    color: HAIRLINE,
  })
  const footer = `${model.seller} · ${model.sellerEmail} · ${model.sellerWebsite}`
  const safeFooter = winAnsiSafe(footer)
  const fW = font.widthOfTextAtSize(safeFooter, 8)
  page.drawText(safeFooter, {
    x: (A4.width - fW) / 2,
    y: footerY,
    size: 8,
    font,
    color: MUTED,
  })

  return pdf.save()
}

/**
 * End-to-end: builds the model from the stored order, fetches the logo (with a graceful
 * text fallback), and renders the PDF bytes. Throws only on a genuine rendering failure —
 * the caller treats a throw as "receipt not produced" and must not mark the email sent.
 */
export async function generateReceiptPdf(order: Order): Promise<Uint8Array> {
  const model = buildReceiptModel(order)
  const logo = await fetchLogo()
  return renderReceiptPdf(model, logo)
}
