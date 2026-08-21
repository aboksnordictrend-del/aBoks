// Pinterest bulk-upload CSV writer.
//
// The format is taken verbatim from Pinterest's official sample file
// (pinterest-bulk-upload-sample.csv), whose first line is exactly:
//
//   Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords
//
// Deliberate differences from src/lib/analytics/csv.ts — that writer targets Excel nb-NO and
// must not be reused here:
//   • comma delimiter, not semicolon;
//   • NO UTF-8 BOM. Pinterest matches columns by header name, and a BOM would turn the first
//     header into "﻿Title";
//   • minimal quoting (quote only when the value needs it), which is what the official sample
//     does — `Hello World` is bare, `"Hello World, again"` is quoted.
//
// Thumbnail is always empty: it is required for video Pins only, and every aBoks source is an
// image. Publish date is always empty, which Pinterest documents as "publish immediately".
//
// Link carries a per-row `pin` parameter appended here, at the single point every source's rows
// pass through. Pinterest imports only the first row of any repeated Link value and drops the
// rest silently — see the note above appendPinParam in ./urls.

import { guardFormula } from './text'
import type { PinterestExportItem } from './types'
import { appendPinParam } from './urls'

/**
 * The official header row, in the official order. Verified against Pinterest's sample CSV.
 * Frozen — an accidental reorder or rename silently breaks every upload, and the third-party
 * `board_name,title,description,link,image_url,published_at` schema that dominates search
 * results is NOT Pinterest's.
 */
export const PINTEREST_CSV_HEADERS = [
  'Title',
  'Media URL',
  'Pinterest board',
  'Thumbnail',
  'Description',
  'Link',
  'Publish date',
  'Keywords',
] as const

/** RFC 4180 record separator. */
const CRLF = '\r\n'

/** A value needs quoting if it contains the delimiter, a quote, a line break, or edge spaces. */
function needsQuoting(value: string): boolean {
  return /[",\r\n]/.test(value) || value !== value.trim()
}

/** Escape one cell: formula guard first, then RFC 4180 quoting with doubled inner quotes. */
export function csvCell(value: string): string {
  const guarded = guardFormula(value)
  return needsQuoting(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/** Serialize one row of already-stringified values. */
function csvRow(values: readonly string[]): string {
  return values.map(csvCell).join(',')
}

/**
 * One export item as the eight official columns, in order.
 * `board` is shared by every row — Pinterest has no board-id column, only the board title.
 *
 * This is the only place the `pin` parameter is added. `item.destinationUrl` stays clean
 * everywhere else — in the preview, in the destination allowlist and in the POST handler's
 * membership check — so the security boundary keeps validating the URL the server produced,
 * not the one written to the file.
 */
export function pinterestCsvRow(item: PinterestExportItem, board: string): string[] {
  return [
    item.title,
    item.mediaUrl,
    board,
    '', // Thumbnail — video Pins only.
    item.description,
    appendPinParam(item.destinationUrl, item.sourceType, item.sourceId),
    '', // Publish date — empty means publish immediately.
    item.keywords,
  ]
}

/**
 * The complete CSV document: header row + one row per item, CRLF-terminated, UTF-8, no BOM.
 * Norwegian characters are emitted as-is and survive as plain UTF-8.
 */
export function pinterestCsv(items: readonly PinterestExportItem[], board: string): string {
  const lines = [PINTEREST_CSV_HEADERS.join(',')]
  for (const item of items) lines.push(csvRow(pinterestCsvRow(item, board)))
  return lines.join(CRLF) + CRLF
}

/** `pinterest-export-YYYY-MM-DD.csv`, dated in UTC so a filename never depends on the server TZ. */
export function pinterestCsvFilename(now: Date = new Date()): string {
  return `pinterest-export-${now.toISOString().slice(0, 10)}.csv`
}
