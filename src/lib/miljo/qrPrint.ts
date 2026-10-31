// Printable QR sheets for Miljøregistrering. Pure: builds a standalone HTML document from an
// already generated QR SVG, which the admin opens in a new window and prints (same approach as the
// pilot sheets, whose HTML escaping is reused).

import { escapeHtml } from '../pilot/qrPrint'
import { MILJO_ROUTE_PREFIX, PUBLIC_MILJO_ORIGIN } from './constants'

export type MiljoPrintLayout = 'poster' | 'stickers'

/** Stickers per A4 sheet (2 × 3, about 95 × 90 mm — one per aBoks XL). */
export const STICKERS_PER_SHEET = 6

export const miljoPath = (code: string): string => `${MILJO_ROUTE_PREFIX}/${encodeURIComponent(code)}`

/** What the QR code encodes: always the production origin, so no sticker points at a preview host. */
export const miljoPublicUrl = (code: string, origin: string = PUBLIC_MILJO_ORIGIN): string =>
  `${origin.replace(/\/+$/, '')}${miljoPath(code)}`

export function buildMiljoPrintHtml(opts: { organizationName: string; url: string; svg: string; layout: MiljoPrintLayout }): string {
  const name = escapeHtml(opts.organizationName)
  const url = escapeHtml(opts.url)

  const poster = `
    <main class="poster">
      <p class="brand">aBoks</p>
      <h1>Registrer brukte batterier</h1>
      <p class="org">${name}</p>
      <div class="qr">${opts.svg}</div>
      <p class="cta">Skann QR-koden og registrer batteriene du legger i beholderen.</p>
      <p class="sub">Anonymt · ingen innlogging · tar 10 sekunder</p>
      <p class="warn">aBoks XL tar ikke imot 9V-batterier eller litiumbatterier. Følg merkingen på beholderen.</p>
      <p class="url">${url}</p>
    </main>`

  const sticker = `
      <div class="sticker">
        <p class="s-brand">aBoks</p>
        <div class="qr">${opts.svg}</div>
        <p class="s-cta">Skann og registrer batteriene</p>
        <p class="s-name">${name}</p>
      </div>`
  const stickers = `<main class="stickers">${sticker.repeat(STICKERS_PER_SHEET)}</main>`

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<title>QR-kode – ${name}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Manrope, Arial, Helvetica, sans-serif; color: #1a1d17; background: #fff; }
  .qr svg { display: block; width: 100%; height: auto; }
  .poster { text-align: center; padding: 14mm 12mm; }
  .poster .brand { font-size: 18pt; font-weight: 800; letter-spacing: 0.04em; margin: 0 0 4mm; color: #5e6a48; }
  .poster h1 { font-size: 30pt; margin: 0 0 3mm; line-height: 1.1; }
  .poster .org { font-size: 16pt; margin: 0 0 8mm; color: #4a4e41; }
  .poster .qr { width: 105mm; margin: 0 auto; }
  .poster .cta { font-size: 16pt; font-weight: 700; margin: 8mm 0 2mm; }
  .poster .sub { font-size: 12pt; color: #4a4e41; margin: 0 0 8mm; }
  .poster .warn { font-size: 11pt; margin: 0 auto 4mm; max-width: 150mm; padding: 3mm 4mm; border: 0.3mm solid #c9b48a; border-radius: 3mm; }
  .poster .url { font-size: 10pt; color: #4a4e41; word-break: break-all; margin: 0; }
  .stickers { display: grid; grid-template-columns: repeat(2, 1fr); grid-auto-rows: 90mm; }
  .sticker { border: 0.2mm dashed #bbb; padding: 5mm; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; break-inside: avoid; }
  .sticker .s-brand { font-size: 11pt; font-weight: 800; color: #5e6a48; margin: 0 0 2mm; }
  .sticker .qr { width: 52mm; }
  .sticker .s-cta { font-size: 11pt; font-weight: 700; margin: 2.5mm 0 1mm; }
  .sticker .s-name { font-size: 8.5pt; color: #4a4e41; margin: 0; }
  @media screen { body { padding: 10mm; background: #f4f1ea; } main { background: #fff; max-width: 210mm; margin: 0 auto; } }
</style>
</head>
<body>${opts.layout === 'poster' ? poster : stickers}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });</script>
</body>
</html>`
}
