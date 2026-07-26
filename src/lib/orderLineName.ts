// Single source of truth for "what is this order line called?".
//
// The name is NEVER composed at render time from the live catalogue. It is snapshotted onto
// the order line at creation (see collections/hooks/orderSnapshot.ts) as the variant's own
// `displayName` — exactly the string the admin panel shows, e.g. "aBoks Vegg – Mørk blå".
// Everything that shows an order to a human (e-mails, PDF receipt) reads it through here so
// there is only one possible answer per line.
//
// The fallbacks exist only for rows that predate the snapshot column and could not be
// backfilled (a line with no variant relationship). They print what was stored verbatim —
// they never prepend a product name, because guessing "aBoks" is precisely the bug this
// module exists to prevent.

export type OrderLineNameSource = {
  displayName?: string | null
  variantName?: string | null
}

export function orderLineDisplayName(line: OrderLineNameSource): string {
  return line.displayName?.trim() || line.variantName?.trim() || 'Produkt'
}

/**
 * Splits a Kustom order-line name back into product and colour.
 *
 * Lines are sent as the variant's display name ("aBoks Vegg – Mørk blå"); lines created
 * before that used "aBoks · Mørk blå". Both put the colour after the final separator, so
 * one parser handles old and new orders. When there is no separator the whole string is
 * the product name and there is no colour — nothing is guessed.
 *
 * Only for data that comes back *from Kustom*: a stored order line already carries its own
 * name and colour and must be read with `orderLineDisplayName` instead.
 */
export function splitLineName(name: string): { productName: string; colorName: string } {
  const parts = name.split(/\s+[–·-]\s+/).map((p) => p.trim())
  if (parts.length < 2) return { productName: name.trim(), colorName: '' }
  return {
    colorName: parts[parts.length - 1],
    productName: parts.slice(0, -1).join(' – '),
  }
}

/** Colour segment of a Kustom order-line name, or the whole name if it has no separator. */
export function colorNameFromLineName(name: string): string {
  const { productName, colorName } = splitLineName(name)
  return colorName || productName
}
