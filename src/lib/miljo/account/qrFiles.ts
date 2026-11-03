import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { encodeQr, type QrCode } from '@/lib/qr/qrcode'
import { qrPngBuffer } from '@/lib/qr/pngServer'
import { winAnsiSafe } from '@/lib/miljo/reportPdf'

/**
 * The organisation's QR code as files for Min side (Stage 2.2b): a print-quality PNG and an A4 PDF.
 *
 * The code always encodes the production address (`https://aboks.no/miljo/<code>`, from
 * miljoPublicUrl) — never a preview deployment's — at error-correction level Q, like the admin
 * panel. Nothing else goes in: no PIN, no account data. The PDF adds only the organisation's name,
 * one instruction and the address in plain text.
 */

export const QR_LEVEL = 'Q' as const
export const QR_CAPTION = 'Skann for å registrere brukte batterier'

export const qrFor = (publicUrl: string): QrCode => encodeQr(publicUrl, QR_LEVEL)

export function qrPng(publicUrl: string): Buffer {
  return qrPngBuffer(qrFor(publicUrl), { size: 2000 })
}

const A4: [number, number] = [595.28, 841.89]
const INK = rgb(0.1, 0.11, 0.09)
const MUTED = rgb(0.36, 0.36, 0.33)

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function qrPdf(input: { organizationName: string; publicUrl: string }): Promise<Uint8Array> {
  const qr = qrFor(input.publicUrl)
  const pdf = await PDFDocument.create()
  pdf.setTitle(winAnsiSafe(`QR-kode – ${input.organizationName}`))
  pdf.setProducer('aBoks Miljøregistrering')
  pdf.setCreator('aBoks Miljøregistrering')
  const page = pdf.addPage(A4)
  const [width, height] = A4
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const centre = (text: string, font: PDFFont, size: number, y: number, color = INK) =>
    page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color })

  // Organisation name (wrapped, at most three lines).
  let y = height - 110
  for (const line of wrap(winAnsiSafe(input.organizationName), bold, 26, width - 120).slice(0, 3)) {
    centre(line, bold, 26, y)
    y -= 34
  }

  // The QR code: 380 pt square (≈ 13.4 cm), modules drawn as horizontal runs.
  const side = 380
  const quiet = 4
  const unit = side / (qr.size + quiet * 2)
  const left = (width - side) / 2
  const top = y - 20
  page.drawRectangle({ x: left, y: top - side, width: side, height: side, color: rgb(1, 1, 1) })
  for (let r = 0; r < qr.size; r++) {
    let c = 0
    while (c < qr.size) {
      if (!qr.modules[r]![c]) {
        c++
        continue
      }
      let end = c
      while (end < qr.size && qr.modules[r]![end]) end++
      page.drawRectangle({ x: left + (c + quiet) * unit, y: top - (r + quiet + 1) * unit, width: (end - c) * unit, height: unit, color: rgb(0, 0, 0) })
      c = end
    }
  }

  y = top - side - 44
  centre(winAnsiSafe(QR_CAPTION), bold, 22, y)
  y -= 30
  centre(winAnsiSafe(input.publicUrl), regular, 13, y, MUTED)
  centre(winAnsiSafe('aBoks Miljøregistrering'), regular, 11, 48, MUTED)

  return pdf.save()
}
