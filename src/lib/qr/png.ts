// Browser-only: renders a QR code onto a canvas (white background, black modules) and downloads
// it as PNG. Generic over @/lib/qr/qrcode — nothing leaves the browser.

import type { QrCode } from './qrcode'

export function downloadQrPng(qr: QrCode, filename: string, opts: { quietZone?: number; size?: number } = {}): void {
  const quiet = opts.quietZone ?? 4
  const modules = qr.size + quiet * 2
  const scale = Math.max(1, Math.floor((opts.size ?? 1200) / modules))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = modules * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y]![x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale)
    }
  }
  canvas.toBlob((blob) => {
    if (!blob) return
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }, 'image/png')
}
