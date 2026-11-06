// The branded 49 × 49 mm QR label for one organisation, as a one-page PDF. Pure (pdf-lib only, no
// server code), so the admin panel builds it in the browser and nothing leaves the machine.
//
// Everything is vector. The QR modules sit on the 203 dpi dot grid of the TSC DA210 this label is
// printed on, so at 100 % scale every module is a whole number of dots wide.

import { LineCapStyle, PDFDocument, PrintScaling, rgb, type PDFPage } from 'pdf-lib'
import { encodeQr, type QrCode } from '@/lib/qr/qrcode'
import { slugify } from '@/lib/pilot/slug'
import { LABEL_ART, type LabelTextArt } from './labelArt'

export const LABEL_SIDE_MM = 49
export const QUIET_ZONE_MODULES = 4

const PT_PER_MM = 72 / 25.4
const MM_PER_DOT = 25.4 / 203
const pt = (mm: number) => mm * PT_PER_MM
const LABEL_SIDE_PT = pt(LABEL_SIDE_MM)

const GREEN = rgb(0x60 / 255, 0x7d / 255, 0x20 / 255)
const BLACK = rgb(0, 0, 0)

/** Dots available for the symbol: 33 modules (every /miljo/<code> URL) of 7 dots ≈ 28.9 mm. */
const QR_SPAN_DOTS = 231
const QR_TOP_DOTS = 82

/** Shares of the symbol's width: the radius cleared for the logo, and the logo's height. */
const KNOCKOUT_RADIUS = 5 / 33
const MARK_HEIGHT = 8.3 / 33

/**
 * Always level H: the cleared centre has to be recoverable. An organisation URL fits version 4-H,
 * which is also what the panel's encodeQr(url, 'Q') upgrades to, so this is the very same symbol
 * as on the PNG and the sticker sheet.
 */
export const labelQr = (url: string): QrCode => encodeQr(url, 'H')

/**
 * Whether a module is cleared for the logo: its square touches a pointy-top hexagon around the
 * symbol's centre. At 33 modules this clears 83 modules (7.6 %), at worst 5 of the 8 codewords
 * each Reed–Solomon block can correct, and no finder, timing or alignment pattern.
 */
export function isKnockedOut(x: number, y: number, size: number): boolean {
  const r = size * KNOCKOUT_RADIUS
  const flat = (r * Math.sqrt(3)) / 2
  const inside = (px: number, py: number) => {
    const dx = Math.abs(px - size / 2)
    const dy = Math.abs(py - size / 2)
    return dy <= r && dx <= flat && dx / 2 + (dy * Math.sqrt(3)) / 2 <= flat
  }
  return inside(x, y) || inside(x + 1, y) || inside(x, y + 1) || inside(x + 1, y + 1)
}

/** One path (not one per module), so that no renderer can show hairlines between modules. */
export function labelQrPath(qr: QrCode): string {
  const dark = (x: number, y: number) => qr.modules[y]![x]! && !isKnockedOut(x, y, qr.size)
  let d = ''
  for (let y = 0; y < qr.size; y++) {
    let x = 0
    while (x < qr.size) {
      if (!dark(x, y)) {
        x++
        continue
      }
      let end = x
      while (end < qr.size && dark(end, y)) end++
      d += `M${x} ${y}h${end - x}v1h${x - end}z`
      x = end
    }
  }
  return d
}

/** Where the symbol goes, in millimetres from the label's top-left corner. */
export function labelQrPlacement(qr: QrCode): { left: number; top: number; moduleMm: number; side: number } {
  const moduleDots = Math.floor(QR_SPAN_DOTS / qr.size)
  const sideDots = moduleDots * qr.size
  const labelDots = LABEL_SIDE_MM / MM_PER_DOT
  return {
    left: Math.round((labelDots - sideDots) / 2) * MM_PER_DOT,
    top: (QR_TOP_DOTS + Math.floor((QR_SPAN_DOTS - sideDots) / 2)) * MM_PER_DOT,
    moduleMm: moduleDots * MM_PER_DOT,
    side: sideDots * MM_PER_DOT,
  }
}

export type LabelBox = { name: string; left: number; top: number; right: number; bottom: number }
type Art = { path: string; x: number; y: number; scale: number; color: typeof GREEN; stroke?: number }
type Icon = { width: number; height: number; strokeWidth: number; stroke: string; fill: string }

/** Everything except the QR symbol: the artwork to draw, plus the box each element occupies (mm). */
function decoration(): { art: Art[]; boxes: LabelBox[] } {
  const art: Art[] = []
  const boxes: LabelBox[] = []
  const { text, globe, recycleBattery } = LABEL_ART

  const textWidth = (t: LabelTextArt, em: number) => ((t.xMax - t.xMin) * em) / 1000
  const placeText = (name: string, t: LabelTextArt, em: number, left: number, baseline: number, color: Art['color']) => {
    const scale = em / 1000
    art.push({ path: t.d, x: left - t.xMin * scale, y: baseline, scale, color })
    boxes.push({ name, left, top: baseline + t.yMin * scale, right: left + textWidth(t, em), bottom: baseline + t.yMax * scale })
  }
  const rectangle = (left: number, top: number, right: number, bottom: number) =>
    art.push({ path: `M${left} ${top}H${right}V${bottom}H${left}Z`, x: 0, y: 0, scale: 1, color: GREEN })

  // Header.
  placeText('aBoks', text.brand, 3, (LABEL_SIDE_MM - textWidth(text.brand, 3)) / 2, 3.5, BLACK)
  // Sized by approval after a print test: only the descenders of j and g reach into the quiet zone.
  placeText('Miljøregistrering', text.heading, 3.312, (LABEL_SIDE_MM - textWidth(text.heading, 3.312)) / 2, 6.68, GREEN)

  // Footer: a rule, then globe | aboks.no | battery + two lines, as one centred row.
  const ruleTop = 42.68
  const ruleBottom = ruleTop + 0.25
  rectangle(1.2, ruleTop, LABEL_SIDE_MM - 1.2, ruleBottom)
  boxes.push({ name: 'rule', left: 1.2, top: ruleTop, right: LABEL_SIDE_MM - 1.2, bottom: ruleBottom })

  const middle = 45.35
  const GLOBE = 4
  const BATTERY_HEIGHT = 4.5
  const BATTERY_WIDTH = (BATTERY_HEIGHT * recycleBattery.width) / recycleBattery.height
  const SITE_EM = 3
  const LINE_EM = 2.05
  const GAP = 1
  const DIVIDER = 0.25
  const siteWidth = textWidth(text.site, SITE_EM)
  const linesWidth = Math.max(textWidth(text.register, LINE_EM), textWidth(text.usedBatteries, LINE_EM))
  let x = (LABEL_SIDE_MM - (GLOBE + GAP + DIVIDER + GAP + siteWidth + GAP + DIVIDER + 0.8 + BATTERY_WIDTH + 0.8 + linesWidth)) / 2

  const icon = (name: string, a: Icon, width: number, height: number) => {
    const scale = width / a.width
    const y = middle - height / 2
    art.push({ path: a.stroke, x, y, scale, color: GREEN, stroke: a.strokeWidth })
    if (a.fill) art.push({ path: a.fill, x, y, scale, color: GREEN })
    boxes.push({ name, left: x, top: y, right: x + width, bottom: y + height })
    x += width
  }
  const divider = () => {
    rectangle(x, middle - 2, x + DIVIDER, middle + 2)
    x += DIVIDER
  }

  icon('globe', globe, GLOBE, GLOBE)
  x += GAP
  divider()
  x += GAP
  placeText('aboks.no', text.site, SITE_EM, x, middle + 1.03, BLACK)
  x += siteWidth + GAP
  divider()
  x += 0.8
  icon('battery', recycleBattery, BATTERY_WIDTH, BATTERY_HEIGHT)
  x += 0.8
  placeText('Registrer', text.register, LINE_EM, x, middle - 0.3, BLACK)
  placeText('brukte batterier', text.usedBatteries, LINE_EM, x, middle + 1.9, BLACK)

  return { art, boxes }
}

/** The boxes of the fixed elements, for checks that nothing leaves the label or enters the quiet zone. */
export const labelBoxes = (): LabelBox[] => decoration().boxes

function drawArt(page: PDFPage, a: Art): void {
  const at = { x: pt(a.x), y: LABEL_SIDE_PT - pt(a.y), scale: pt(a.scale) }
  if (a.stroke) page.drawSvgPath(a.path, { ...at, borderColor: a.color, borderWidth: a.stroke, borderLineCap: LineCapStyle.Round })
  else page.drawSvgPath(a.path, { ...at, color: a.color })
}

/** The finished PDF: one page of exactly 49 × 49 mm, flagged to print at actual size. */
export async function buildMiljoLabelPdf(input: { url: string }): Promise<Uint8Array> {
  const qr = labelQr(input.url)
  const pdf = await PDFDocument.create()
  pdf.setTitle('aBoks Miljøregistrering – etikett 49 × 49 mm')
  pdf.setProducer('aBoks Miljøregistrering')
  pdf.setCreator('aBoks Miljøregistrering')
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)

  const page = pdf.addPage([LABEL_SIDE_PT, LABEL_SIDE_PT])
  for (const a of decoration().art) drawArt(page, a)

  const place = labelQrPlacement(qr)
  drawArt(page, { path: labelQrPath(qr), x: place.left, y: place.top, scale: place.moduleMm, color: BLACK })

  const { mark } = LABEL_ART
  const markHeight = place.side * MARK_HEIGHT
  const markScale = markHeight / mark.height
  const markX = place.left + (place.side - mark.width * markScale) / 2
  const markY = place.top + (place.side - markHeight) / 2
  drawArt(page, { path: mark.green, x: markX, y: markY, scale: markScale, color: GREEN })
  drawArt(page, { path: mark.dark, x: markX, y: markY, scale: markScale, color: BLACK })

  // A plain cross-reference table rather than object streams: the most widely understood form.
  return pdf.save({ useObjectStreams: false })
}

export function miljoLabelFilename(organizationName: string, code: string): string {
  return `aBoks-Miljoregistrering-${slugify(organizationName) || code}-49x49mm.pdf`
}
