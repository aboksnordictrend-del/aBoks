/**
 * Browser-side image optimisation for the review form (spec §10 "Фотографии", client half).
 *
 * Why this exists at all: Vercel rejects request bodies over ~4.5 MB with
 * 413 FUNCTION_PAYLOAD_TOO_LARGE at the proxy, before the Server Action is invoked. A single
 * modern phone photo is 3–6 MB, so two of them killed the submission and the server-side
 * sharp pipeline never got to run. Shrinking in the browser is the only fix that works.
 *
 * What this module does NOT do: replace @/lib/reviewPhotos. That stays the authoritative
 * second layer — magic-byte type detection, metadata stripping, re-encode. This is purely
 * about getting the bytes through the door.
 *
 * Orientation: canvas output has no EXIF, so the rotation must be baked into the pixels here.
 * `createImageBitmap(blob, { imageOrientation: 'from-image' })` does exactly that and is the
 * primary path. The `<img>` fallback relies on the CSS default `image-orientation: from-image`,
 * which every browser that can run this form already applies (Safari 13.1+, Chrome 81+,
 * Firefox 77+) — so iPhone portrait shots stay upright on both paths. Downstream,
 * `sharp().rotate()` becomes a no-op on our EXIF-free output, so nothing is rotated twice.
 */

import { UPLOAD_LIMITS } from '@/lib/reviewValidation'

export interface Dimensions {
  width: number
  height: number
}

export interface CompressionAttempt {
  maxDimension: number
  quality: number
}

/**
 * Attempt ladder, tried in order until the result fits `perPhotoBytes`. Two steps only: the
 * normal case succeeds on the first, and a second pass rescues the rare oversized panorama
 * without turning submission into an unbounded re-encode loop.
 */
export const COMPRESSION_ATTEMPTS: readonly CompressionAttempt[] = [
  { maxDimension: UPLOAD_LIMITS.maxDimension, quality: UPLOAD_LIMITS.quality },
  { maxDimension: UPLOAD_LIMITS.retryMaxDimension, quality: UPLOAD_LIMITS.retryQuality },
] as const

/**
 * Scales `source` to fit inside a `maxDimension` square, preserving aspect ratio.
 * Never upscales: an image already smaller than the box is returned untouched.
 */
export function scaleToFit(source: Dimensions, maxDimension: number): Dimensions {
  const longest = Math.max(source.width, source.height)
  if (longest <= maxDimension || longest === 0) {
    return { width: source.width, height: source.height }
  }
  const ratio = maxDimension / longest
  return {
    width: Math.max(1, Math.round(source.width * ratio)),
    height: Math.max(1, Math.round(source.height * ratio)),
  }
}

/** Swaps the extension to match the encoded type, so the stored name never lies. */
export function outputFilename(originalName: string, mimeType: string): string {
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
  const base = originalName.replace(/\.[^./\\]+$/, '') || 'bilde'
  return `${base}.${ext}`
}

export type EncodeFn = (attempt: CompressionAttempt & Dimensions) => Promise<Blob>

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
  /** How many encode passes ran. 2 means the retry ladder was needed. */
  attempts: number
}

/**
 * Runs the attempt ladder against an injected encoder and returns the first result within
 * `limitBytes`. The encoder is a parameter so the retry policy is testable without a canvas.
 *
 * If every attempt is still over budget, the smallest result is returned anyway — this
 * function does not throw. Deciding what to tell the user is validatePhotoUpload's job, and
 * it runs on the real bytes either way.
 */
export async function compressWithAttempts(
  source: Dimensions,
  encode: EncodeFn,
  limitBytes: number = UPLOAD_LIMITS.perPhotoBytes,
  ladder: readonly CompressionAttempt[] = COMPRESSION_ATTEMPTS,
): Promise<CompressionResult> {
  let best: CompressionResult | null = null

  for (const [index, attempt] of ladder.entries()) {
    const target = scaleToFit(source, attempt.maxDimension)
    const blob = await encode({ ...attempt, ...target })
    const result: CompressionResult = { blob, ...target, attempts: index + 1 }

    if (blob.size <= limitBytes) return result
    // Keep whichever pass produced the fewest bytes — a lower quality does not *guarantee*
    // a smaller file for every encoder, so compare rather than assume.
    if (!best || blob.size < best.blob.size) best = { ...result, attempts: index + 1 }
  }

  return { ...best!, attempts: ladder.length }
}

/**
 * Decodes `file` into a canvas-drawable source with EXIF orientation already applied.
 * Returns the drawable plus a `release` to free it (bitmaps and object URLs both leak).
 */
async function loadOrientedImage(file: File): Promise<{
  source: CanvasImageSource & Dimensions
  release: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, release: () => bitmap.close() }
    } catch {
      // Older Safari rejects the options overload — fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    // naturalWidth/Height are already orientation-corrected by the browser.
    const source = Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight })
    return { source, release: () => URL.revokeObjectURL(url) }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/** Promise wrapper around canvas.toBlob. Resolves null when the encoder refuses the type. */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality))
}

/**
 * Encodes to WebP, falling back to JPEG. Safari below 16.4 silently ignores the requested
 * type and hands back a PNG — which is *larger* than the input and would defeat the whole
 * exercise — so the returned blob's own type is what decides, not feature detection.
 */
async function encodeBest(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return webp

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (jpeg) return jpeg

  throw new Error('canvas encoding failed')
}

export interface OptimizedImage {
  file: File
  originalBytes: number
  optimizedBytes: number
  width: number
  height: number
  attempts: number
}

/**
 * Resizes and re-encodes one picked file in the browser, ready to append to the FormData.
 *
 * Returns the *smaller* of the optimised and original bytes as a File — re-encoding a photo
 * that is already small can grow it, and shipping the bigger one would be silly. Note the
 * original is only preferred when it is also within budget, so the caller's size checks stay
 * meaningful.
 */
export async function optimizeImage(file: File): Promise<OptimizedImage> {
  const { source, release } = await loadOrientedImage(file)

  try {
    const canvas = document.createElement('canvas')
    const encode: EncodeFn = async ({ width, height, quality }) => {
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d canvas context unavailable')
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(source, 0, 0, width, height)
      return encodeBest(canvas, quality)
    }

    const result = await compressWithAttempts({ width: source.width, height: source.height }, encode)

    // An already-tiny original that survived a round trip larger than it started: keep it.
    if (file.size <= result.blob.size && file.size <= UPLOAD_LIMITS.perPhotoBytes) {
      return {
        file,
        originalBytes: file.size,
        optimizedBytes: file.size,
        width: result.width,
        height: result.height,
        attempts: result.attempts,
      }
    }

    const optimized = new File([result.blob], outputFilename(file.name, result.blob.type), {
      type: result.blob.type,
      lastModified: Date.now(),
    })

    return {
      file: optimized,
      originalBytes: file.size,
      optimizedBytes: optimized.size,
      width: result.width,
      height: result.height,
      attempts: result.attempts,
    }
  } finally {
    release()
  }
}
