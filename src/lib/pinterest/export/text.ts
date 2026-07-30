// Text normalization for Pinterest cells.
//
// Limits come from Pinterest's own bulk-upload documentation: Title "100 characters maximum",
// Description "500 characters maximum". Counting is done in code points rather than UTF-16
// units so a Norwegian æ/ø/å — and an emoji — each count as one, matching how a human reads
// the limit.

/** Pinterest: "Title … 100 characters maximum". */
export const TITLE_MAX = 100
/** Pinterest: "Description … 500 characters maximum". */
export const DESCRIPTION_MAX = 500

/**
 * Characters that make a spreadsheet treat a cell as a formula when the file is opened in
 * Excel / Google Sheets / LibreOffice. Tab and CR are included because both can be used to
 * shift a payload into formula position.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/**
 * Strip HTML tags. `product.description` is a plain textarea, but pasted markup does occur,
 * and Pinterest renders the description as literal text — a stray `<p>` would be visible on
 * the Pin. The `<[^>]*>` form mishandles a `>` inside an attribute value; acceptable for
 * admin-authored copy, and the same trade-off the Google Merchant feed already makes.
 */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

/** Newlines and runs of whitespace collapse to single spaces — a CSV cell is one line of copy. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Hard-limit to `max` code points, ending with an ellipsis when anything was cut. The
 * ellipsis costs one code point, so the result is never longer than `max`.
 */
export function truncate(value: string, max: number): string {
  const chars = Array.from(value)
  if (chars.length <= max) return value
  if (max <= 1) return chars.slice(0, max).join('')
  return chars.slice(0, max - 1).join('').trimEnd() + '…'
}

/** stripHtml → collapseWhitespace → truncate, the pipeline every free-text cell goes through. */
export function normalizeText(value: string | null | undefined, max: number): string {
  if (typeof value !== 'string') return ''
  return truncate(collapseWhitespace(stripHtml(value)), max)
}

/**
 * Neutralize spreadsheet formula injection by prefixing a single quote, the conventional
 * mitigation: Excel and Sheets both render `'=SUM(1)` as the literal text `=SUM(1)`.
 *
 * Applied to every cell, not just the ones we think are risky. The false-positive cost is a
 * leading apostrophe on copy that genuinely starts with `-` or `+`; note this is hyphen-minus
 * only — the en dash (–) used throughout aBoks copy is not a trigger.
 */
export function guardFormula(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value
}
