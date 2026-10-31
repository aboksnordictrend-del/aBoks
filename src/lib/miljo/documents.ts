// Supporting documents for deliveries (receipts). Server-only (sharp via @/lib/reviewPhotos).
//
// The type is decided by the file's real signature, never by its name or the browser's MIME
// type. Accepted:
//   • PDF — stored as is (it is the receipt itself), within the size limit;
//   • JPEG / PNG / WebP photos — re-encoded to WebP by the review-photo pipeline, which strips
//     all metadata (EXIF/GPS) and downscales.
// Everything else — SVG, HTML, Office files, executables — is refused. The stored name is random.

import { randomBytes } from 'node:crypto'
import { detectImageType, processReviewPhoto } from '../reviewPhotos'
import { DELIVERY_LIMITS } from './constants'

export type DocumentKind = 'pdf' | 'image'

export function detectDocumentKind(buf: Uint8Array): DocumentKind | null {
  if (buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) {
    return 'pdf' // %PDF-
  }
  return detectImageType(Buffer.from(buf.buffer, buf.byteOffset, Math.min(buf.byteLength, 64))) ? 'image' : null
}

export const DOCUMENT_MESSAGES = {
  type: 'Vedlegget må være en PDF eller et bilde (JPG, PNG eller WebP).',
  size: 'Vedlegget er for stort. Maks 3,5 MB.',
  failed: 'Vedlegget kunne ikke leses. Prøv en annen fil.',
} as const

/**
 * A complete PDF ends with its cross-reference marker and %%EOF — the same structural check
 * Payload's upload validation applies, run here first so a truncated file gets a clear message.
 */
export function looksLikeCompletePdf(buf: Uint8Array): boolean {
  const tail = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).subarray(Math.max(0, buf.byteLength - 1024)).toString('latin1')
  return tail.includes('%%EOF') && tail.includes('xref')
}

/** Cheap check before the PIN is verified: size, signature and PDF completeness. */
export function precheckDocument(buf: Uint8Array): { ok: true; kind: DocumentKind } | { ok: false; message: string } {
  if (buf.byteLength > DELIVERY_LIMITS.documentMaxBytes) return { ok: false, message: DOCUMENT_MESSAGES.size }
  const kind = detectDocumentKind(buf)
  if (!kind) return { ok: false, message: DOCUMENT_MESSAGES.type }
  if (kind === 'pdf' && !looksLikeCompletePdf(buf)) return { ok: false, message: DOCUMENT_MESSAGES.failed }
  return { ok: true, kind }
}

export interface PreparedDocument {
  data: Buffer
  mimetype: 'application/pdf' | 'image/webp'
  name: string
  size: number
}

export async function prepareDocument(buf: Uint8Array): Promise<{ ok: true; file: PreparedDocument } | { ok: false; message: string }> {
  const check = precheckDocument(buf)
  if (!check.ok) return check
  const stem = `levering-${randomBytes(12).toString('hex')}`
  if (check.kind === 'pdf') {
    const data = Buffer.from(buf)
    return { ok: true, file: { data, mimetype: 'application/pdf', name: `${stem}.pdf`, size: data.byteLength } }
  }
  const processed = await processReviewPhoto(Buffer.from(buf))
  if (!processed.ok) return { ok: false, message: DOCUMENT_MESSAGES.failed }
  const data = processed.photo.buffer
  return { ok: true, file: { data, mimetype: 'image/webp', name: `${stem}.webp`, size: data.byteLength } }
}
