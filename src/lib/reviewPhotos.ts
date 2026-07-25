import sharp from 'sharp'

/**
 * Server-side processing for customer review photos (spec §10 "Фотографии").
 *
 * Accepts JPEG / PNG / WebP only, verified by real file signature (magic bytes) — never
 * by the client-provided extension or MIME type. Then, with sharp:
 *   • strips all metadata (EXIF/GPS) — sharp drops metadata unless withMetadata() is
 *     called, which we never do, so no client location data survives;
 *   • auto-rotates using the EXIF orientation before it is discarded;
 *   • downscales anything larger than MAX_DIMENSION;
 *   • re-encodes to WebP (optimised, consistent output).
 * SVG and any executable/other type are rejected.
 */

export const PHOTO_LIMITS = {
  /** Max accepted file size before processing (bytes). */
  maxBytes: 8 * 1024 * 1024,
  maxPhotos: 5,
  maxDimension: 1600,
  webpQuality: 82,
} as const

export type DetectedType = 'jpeg' | 'png' | 'webp'

export interface ProcessedPhoto {
  buffer: Buffer
  width: number
  height: number
  mimeType: 'image/webp'
  ext: 'webp'
}

/** Detects the true image type from magic bytes. Returns null for anything unsupported. */
export function detectImageType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png'
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp'
  }
  return null
}

export type PhotoError =
  | { code: 'too-large' }
  | { code: 'unsupported-type' }
  | { code: 'decode-failed' }

export type PhotoProcessResult =
  | { ok: true; photo: ProcessedPhoto }
  | { ok: false; error: PhotoError }

/** Validates and processes a single uploaded photo buffer into an optimised WebP. */
export async function processReviewPhoto(input: Buffer): Promise<PhotoProcessResult> {
  if (input.length > PHOTO_LIMITS.maxBytes) return { ok: false, error: { code: 'too-large' } }

  const detected = detectImageType(input)
  if (!detected) return { ok: false, error: { code: 'unsupported-type' } }

  try {
    const pipeline = sharp(input, { failOn: 'error' })
      // Honour EXIF orientation, then discard metadata by never calling withMetadata().
      .rotate()
      .resize({
        width: PHOTO_LIMITS.maxDimension,
        height: PHOTO_LIMITS.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: PHOTO_LIMITS.webpQuality })

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

    return {
      ok: true,
      photo: {
        buffer: data,
        width: info.width,
        height: info.height,
        mimeType: 'image/webp',
        ext: 'webp',
      },
    }
  } catch {
    return { ok: false, error: { code: 'decode-failed' } }
  }
}

/** Random, collision-resistant, non-guessable filename for a stored review photo. */
export function safePhotoFilename(): string {
  const rand = (globalThis.crypto ?? require('crypto').webcrypto).getRandomValues(new Uint8Array(12))
  const hex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('')
  return `review-${Date.now().toString(36)}-${hex}.webp`
}
