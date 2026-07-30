// Unique-title generation for the Pinterest export.
//
// Pinterest rejects a bulk-upload file that contains the same Title twice, so a product with
// ten gallery images cannot simply repeat its name ten times. This produces natural Norwegian
// variations instead of "Bilde 2" / "Photo 3" numbering.
//
// The first Pin of any source keeps its own best copy (SEO title, variant display name, or the
// curated homepage title). Only the rows that would collide reach for a template, and only
// rows that still collide reach for a qualifier.

import { TITLE_MAX, normalizeText } from './text'

/** Brand name used when a source carries no product of its own (the curated homepage list). */
export const DEFAULT_PRODUCT_NAME = 'aBoks'

export interface TitleContext {
  /** The row's own preferred title — SEO title, variant display name, curated title. */
  base: string
  /** Product name used to fill the templates, e.g. 'aBoks' (not the SEO sentence). */
  productName: string
  /** Variant colour, when the row has one. Feeds the "i olivengrønn" qualifier. */
  colour?: string | null
}

/**
 * Natural phrasings of the same message. Two deliberately omit the product name so they still
 * read well, and so two different products never run out of distinct stems at the same rate.
 */
const TEMPLATES: ((name: string) => string)[] = [
  (n) => `${n} – smart batterioppbevaring for AA- og AAA-batterier`,
  (n) => `Hold orden på batteriene med ${n}`,
  (n) => `Praktisk batterioppbevaring med ${n}`,
  (n) => `${n} – fast plass til batteriene`,
  (n) => `Oppbevar batteriene ryddig med ${n}`,
  () => 'Smart oppbevaring av AA- og AAA-batterier',
  (n) => `Ryddigere hjem med ${n}`,
  () => 'Batterioppbevaring som passer inn overalt',
  (n) => `${n} – orden i skuffen`,
  () => 'En smartere måte å oppbevare batterier på',
]

/** Room context and storage wording. Appended only when a stem alone is already taken. */
const QUALIFIERS = [
  'for AA- og AAA-batterier',
  'til hjemmet',
  'for kjøkkenet',
  'til stua',
  'for hjemmekontoret',
  'på soverommet',
  'til hytta',
  'i gangen',
]

/** Append a qualifier, unless the title already says it — no "… for kjøkkenet for kjøkkenet". */
function withQualifier(title: string, qualifier: string): string {
  return title.toLowerCase().includes(qualifier.toLowerCase()) ? title : `${title} ${qualifier}`
}

/**
 * Every phrasing this row may use, best first.
 *
 * Size: (1 base + 10 templates) × (1 + Q + Q×(Q−1)) with Q ≥ 8 qualifiers ≈ 700 distinct
 * phrasings per product name — comfortably more than the 200 rows a single export can hold,
 * which is what makes the uniqueness guarantee terminate without numeric suffixes.
 */
export function* titleCandidates(ctx: TitleContext): Generator<string> {
  const stems = [ctx.base, ...TEMPLATES.map((t) => t(ctx.productName))]
  const colour = ctx.colour?.trim()
  const qualifiers = colour ? [`i ${colour.toLowerCase()}`, ...QUALIFIERS] : QUALIFIERS

  for (const stem of stems) yield stem
  for (const stem of stems) {
    for (const q of qualifiers) yield withQualifier(stem, q)
  }
  // Last resort: two qualifiers. Still natural Norwegian, still no numbering.
  for (const stem of stems) {
    for (const first of qualifiers) {
      for (const second of qualifiers) {
        if (first === second) continue
        yield withQualifier(withQualifier(stem, first), second)
      }
    }
  }
}

/**
 * The first candidate not already in `used`, normalized and truncated to Pinterest's 100-char
 * limit. Comparison is case-folded, and happens AFTER truncation — two long phrasings that cut
 * down to the same 100 characters are still a collision as far as Pinterest is concerned.
 *
 * Mutates `used`, so a caller can share one set across the whole export and get uniqueness
 * across products and sources, not merely within one gallery.
 */
export function pickUniqueTitle(ctx: TitleContext, used: Set<string>): string {
  for (const candidate of titleCandidates(ctx)) {
    const title = normalizeText(candidate, TITLE_MAX)
    if (!title) continue
    const folded = title.toLowerCase()
    if (used.has(folded)) continue
    used.add(folded)
    return title
  }

  // Unreachable for any export Pinterest would accept — see the size note above. Keeping the
  // row with its base title is still better than dropping it.
  const fallback = normalizeText(ctx.base, TITLE_MAX)
  used.add(fallback.toLowerCase())
  return fallback
}
