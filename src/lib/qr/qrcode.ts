// Minimal QR Code encoder (ISO/IEC 18004, model 2). Pure TypeScript, no dependencies and no
// network: the pilot QR codes are generated in-process, never by a third-party service.
//
// Scope: byte mode (UTF-8), versions 1–40, all four error-correction levels, automatic mask
// selection by the standard penalty rules. That covers any URL. The structure follows the
// well-known reference implementation by Project Nayuki (MIT), condensed to what is used here.

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

const ECL_ORDER: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']
const ECL_INDEX: Record<ErrorCorrectionLevel, number> = { L: 0, M: 1, Q: 2, H: 3 }
const ECL_FORMAT_BITS: Record<ErrorCorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 }

// Index [ecl][version]; index 0 unused.
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
]
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
]

export interface QrCode {
  version: number
  size: number
  errorCorrectionLevel: ErrorCorrectionLevel
  mask: number
  /** modules[y][x] — true is a dark module. */
  modules: boolean[][]
}

const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function numDataCodewords(ver: number, ecl: ErrorCorrectionLevel): number {
  const e = ECL_INDEX[ecl]
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e]![ver]! * NUM_ERROR_CORRECTION_BLOCKS[e]![ver]!
}

/** Character-count field width for byte mode. */
const byteCountBits = (ver: number): number => (ver <= 9 ? 8 : 16)

// ── Reed–Solomon over GF(2^8) with polynomial 0x11D ──

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j]!, root)
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ result.shift()!
    result.push(0)
    divisor.forEach((coef, i) => {
      result[i]! ^= gfMultiply(coef, factor)
    })
  }
  return result
}

function addEccAndInterleave(data: number[], ver: number, ecl: ErrorCorrectionLevel): number[] {
  const e = ECL_INDEX[ecl]
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![ver]!
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![ver]!
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)

  const blocks: number[][] = []
  const divisor = rsDivisor(blockEccLen)
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShortBlocks) dat.push(0)
    blocks.push(dat.concat(ecc))
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]!)
    })
  }
  return result
}

// ── Matrix construction ──

class Matrix {
  readonly size: number
  readonly modules: boolean[][]
  readonly isFunction: boolean[][]

  constructor(readonly version: number, readonly ecl: ErrorCorrectionLevel) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }

  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark
    this.isFunction[y]![x] = true
  }

  alignmentPositions(): number[] {
    if (this.version === 1) return []
    const numAlign = Math.floor(this.version / 7) + 2
    const step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2
    const result = [6]
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos)
    return result
  }

  drawFunctionPatterns() {
    for (let i = 0; i < this.size; i++) {
      this.setFunction(6, i, i % 2 === 0)
      this.setFunction(i, 6, i % 2 === 0)
    }
    this.drawFinder(3, 3)
    this.drawFinder(this.size - 4, 3)
    this.drawFinder(3, this.size - 4)

    const pos = this.alignmentPositions()
    const n = pos.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue
        this.drawAlignment(pos[i]!, pos[j]!)
      }
    }
    this.drawFormatBits(0) // placeholder, overwritten once the mask is chosen
    this.drawVersion()
  }

  drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunction(xx, yy, dist !== 2 && dist !== 4)
        }
      }
    }
  }

  drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }

  drawFormatBits(mask: number) {
    const data = (ECL_FORMAT_BITS[this.ecl] << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412

    for (let i = 0; i <= 5; i++) this.setFunction(8, i, getBit(bits, i))
    this.setFunction(8, 7, getBit(bits, 6))
    this.setFunction(8, 8, getBit(bits, 7))
    this.setFunction(7, 8, getBit(bits, 8))
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i))

    for (let i = 0; i < 8; i++) this.setFunction(this.size - 1 - i, 8, getBit(bits, i))
    for (let i = 8; i < 15; i++) this.setFunction(8, this.size - 15 + i, getBit(bits, i))
    this.setFunction(8, this.size - 8, true) // the always-dark module
  }

  drawVersion() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i)
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.setFunction(a, b, bit)
      this.setFunction(b, a, bit)
    }
  }

  drawCodewords(data: number[]) {
    let i = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? this.size - 1 - vert : vert
          if (!this.isFunction[y]![x] && i < data.length * 8) {
            this.modules[y]![x] = getBit(data[i >>> 3]!, 7 - (i & 7))
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: throw new Error('Invalid mask')
        }
        if (!this.isFunction[y]![x] && invert) this.modules[y]![x] = !this.modules[y]![x]
      }
    }
  }

  /** Standard penalty score (rules N1–N4). Lower is better. */
  penalty(): number {
    const n = this.size
    const m = this.modules
    let result = 0

    const line = (get: (i: number) => boolean) => {
      let score = 0
      let runColor = get(0)
      let runLen = 1
      for (let i = 1; i < n; i++) {
        const c = get(i)
        if (c === runColor) {
          runLen++
        } else {
          if (runLen >= 5) score += 3 + (runLen - 5)
          runColor = c
          runLen = 1
        }
      }
      if (runLen >= 5) score += 3 + (runLen - 5)
      // N3: 1:1:3:1:1 finder-like pattern with four light modules on either side.
      for (let i = 0; i + 10 < n; i++) {
        const p = [get(i), get(i + 1), get(i + 2), get(i + 3), get(i + 4), get(i + 5), get(i + 6), get(i + 7), get(i + 8), get(i + 9), get(i + 10)]
        const a = p[0] && !p[1] && p[2] && p[3] && p[4] && !p[5] && p[6] && !p[7] && !p[8] && !p[9] && !p[10]
        const b = !p[0] && !p[1] && !p[2] && !p[3] && p[4] && !p[5] && p[6] && p[7] && p[8] && !p[9] && p[10]
        if (a) score += 40
        if (b) score += 40
      }
      return score
    }

    for (let y = 0; y < n; y++) result += line((i) => m[y]![i]!)
    for (let x = 0; x < n; x++) result += line((i) => m[i]![x]!)

    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = m[y]![x]
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) result += 3
      }
    }

    let dark = 0
    for (const row of m) for (const c of row) if (c) dark++
    const total = n * n
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    result += k * 10
    return result
  }
}

/**
 * Encodes `text` (UTF-8, byte mode) at the smallest version that fits `minLevel`, raising the
 * error-correction level for free when the same version has room for it. Throws when the text
 * does not fit in version 40.
 */
export function encodeQr(text: string, minLevel: ErrorCorrectionLevel = 'M'): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text))

  let version = 0
  let dataBits = 0
  for (let v = 1; v <= 40; v++) {
    const bits = 4 + byteCountBits(v) + bytes.length * 8
    if (bits <= numDataCodewords(v, minLevel) * 8 && bytes.length < 1 << byteCountBits(v)) {
      version = v
      dataBits = bits
      break
    }
  }
  if (version === 0) throw new Error('Teksten er for lang for en QR-kode.')

  let ecl = minLevel
  for (const candidate of ECL_ORDER.slice(ECL_INDEX[minLevel] + 1)) {
    if (dataBits <= numDataCodewords(version, candidate) * 8) ecl = candidate
  }

  // Bit stream: mode indicator 0100 (byte), count, data, terminator, byte padding, pad codewords.
  const bits: number[] = []
  const append = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  append(0b0100, 4)
  append(bytes.length, byteCountBits(version))
  for (const b of bytes) append(b, 8)
  const capacity = numDataCodewords(version, ecl) * 8
  append(0, Math.min(4, capacity - bits.length))
  append(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!
    data.push(byte)
  }

  const matrix = new Matrix(version, ecl)
  matrix.drawFunctionPatterns()
  matrix.drawCodewords(addEccAndInterleave(data, version, ecl))

  let bestMask = 0
  let bestPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    matrix.applyMask(mask)
    matrix.drawFormatBits(mask)
    const p = matrix.penalty()
    if (p < bestPenalty) {
      bestPenalty = p
      bestMask = mask
    }
    matrix.applyMask(mask) // XOR again to undo
  }
  matrix.applyMask(bestMask)
  matrix.drawFormatBits(bestMask)

  return {
    version,
    size: matrix.size,
    errorCorrectionLevel: ecl,
    mask: bestMask,
    modules: matrix.modules.map((row) => [...row]),
  }
}

/**
 * SVG path data for the dark modules (one `h1v1h-1z` square each, offset by the quiet zone).
 * Rendered with `shape-rendering="crispEdges"` it scales to any print size without blur.
 */
export function qrSvgPath(qr: QrCode, quietZone = 4): string {
  let d = ''
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y]![x]) d += `M${x + quietZone} ${y + quietZone}h1v1h-1z`
    }
  }
  return d
}

/** A complete, standalone SVG document (black on white) with the standard 4-module quiet zone. */
export function qrSvg(qr: QrCode, quietZone = 4): string {
  const dim = qr.size + quietZone * 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<path d="${qrSvgPath(qr, quietZone)}" fill="#000000"/></svg>`
  )
}
