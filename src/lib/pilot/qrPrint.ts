// Printable QR sheets for pilot projects. Pure: builds a standalone HTML document from an already
// generated QR SVG, which the admin opens in a new window and prints.

export type QrPrintLayout = 'single' | 'labels'

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Labels per A4 sheet in the «labels» layout (3 × 4, about 63 × 68 mm each). */
export const LABELS_PER_SHEET = 12

/**
 * `single`: one large code with project name, call to action and the written-out URL.
 * `labels`: a full A4 sheet of small codes to cut out and attach to the products under test.
 */
export function buildQrPrintHtml(opts: { projectName: string; url: string; svg: string; layout: QrPrintLayout }): string {
  const name = escapeHtml(opts.projectName)
  const url = escapeHtml(opts.url)
  const cta = 'Skann og gi oss din tilbakemelding på aBoks'

  const single = `
    <main class="single">
      <p class="brand">aBoks</p>
      <h1>${name}</h1>
      <div class="qr">${opts.svg}</div>
      <p class="cta">${cta}</p>
      <p class="url">${url}</p>
    </main>`

  const label = `
      <div class="label">
        <div class="qr">${opts.svg}</div>
        <p class="cta">Skann og evaluer aBoks</p>
        <p class="name">${name}</p>
      </div>`
  const labels = `<main class="labels">${label.repeat(LABELS_PER_SHEET)}</main>`

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
  .single { text-align: center; padding: 18mm 10mm; }
  .single .brand { font-size: 16pt; font-weight: 700; letter-spacing: 0.04em; margin: 0 0 6mm; color: #5e6a48; }
  .single h1 { font-size: 22pt; margin: 0 0 10mm; }
  .single .qr { width: 110mm; margin: 0 auto; }
  .single .cta { font-size: 15pt; margin: 8mm 0 3mm; }
  .single .url { font-size: 11pt; color: #4a4e41; word-break: break-all; margin: 0; }
  .labels { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 68mm; gap: 0; }
  .label { border: 0.2mm dashed #bbb; padding: 4mm; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; break-inside: avoid; }
  .label .qr { width: 42mm; }
  .label .cta { font-size: 9pt; font-weight: 700; margin: 2mm 0 0.5mm; }
  .label .name { font-size: 7.5pt; color: #4a4e41; margin: 0; }
  @media screen { body { padding: 10mm; background: #f4f1ea; } main { background: #fff; max-width: 210mm; margin: 0 auto; } }
</style>
</head>
<body>${opts.layout === 'single' ? single : labels}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });</script>
</body>
</html>`
}
