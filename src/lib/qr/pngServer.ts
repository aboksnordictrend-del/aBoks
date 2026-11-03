// Server-side PNG of a QR code (node:zlib) — black modules on white, 8-bit grayscale, with a
// 300 dpi pHYs chunk so print software sizes it sensibly. The browser twin is ./png.

import { deflateSync } from 'node:zlib'
import type { QrCode } from './qrcode'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const DOTS_PER_METRE_300_DPI = 11811

/** PNG bytes; the image is about `size` pixels square (a whole number of pixels per module). */
export function qrPngBuffer(qr: QrCode, opts: { quietZone?: number; size?: number } = {}): Buffer {
  const quiet = opts.quietZone ?? 4
  const modules = qr.size + quiet * 2
  const scale = Math.max(1, Math.floor((opts.size ?? 2000) / modules))
  const width = modules * scale

  const row = width + 1 // filter byte + one grey byte per pixel
  const raw = Buffer.alloc(row * width, 0xff)
  for (let py = 0; py < width; py++) {
    raw[py * row] = 0 // filter: none
    const y = Math.floor(py / scale) - quiet
    if (y < 0 || y >= qr.size) continue
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y]![x]) continue
      raw.fill(0x00, py * row + 1 + (x + quiet) * scale, py * row + 1 + (x + quiet + 1) * scale)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(width, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // grayscale
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const phys = Buffer.alloc(9)
  phys.writeUInt32BE(DOTS_PER_METRE_300_DPI, 0)
  phys.writeUInt32BE(DOTS_PER_METRE_300_DPI, 4)
  phys[8] = 1 // unit: metre

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('pHYs', phys),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
