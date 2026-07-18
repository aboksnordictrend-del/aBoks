// Money + percent formatting for the analytics dashboard.
//
// The store keeps money as decimal NOK (kroner) — see Orders.unitPrice / total etc.
// We keep every calculation in kroner as JS numbers and round only for display, so
// there is no øre/krone mixing. Rounding uses a single `round2` helper to keep
// floating-point drift out of running sums.

/** Round to 2 decimals, avoiding the classic 0.1 + 0.2 drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Non-breaking-space thousands separator, matching src/lib/format.ts (nb-NO). */
function groupThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Format a kroner amount as `12 490 kr` (suffix form used across the dashboard).
 * Whole kroner by default — øre are not shown for aggregate figures.
 */
export function formatNOK(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0
  const neg = safe < 0
  const fixed = Math.abs(safe).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const grouped = groupThousands(intPart)
  const body = decPart ? `${grouped},${decPart}` : grouped
  return `${neg ? '−' : ''}${body} kr`
}

/** Format a ratio-as-percent value (already in percent units) as `73,7 %`. */
export function formatPercent(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${safe.toFixed(decimals).replace('.', ',')} %`
}

/** Signed percent for period-over-period deltas: `+28,6 %` / `−12,0 %`. */
export function formatSignedPercent(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0
  const sign = safe > 0 ? '+' : safe < 0 ? '−' : ''
  return `${sign}${Math.abs(safe).toFixed(decimals).replace('.', ',')} %`
}

/** Plain integer with grouped thousands: `1 284`. */
export function formatInt(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0
  const neg = safe < 0
  return `${neg ? '−' : ''}${groupThousands(String(Math.abs(safe)))}`
}

/** Decimal number with grouped thousands and nb-NO comma: `2,3` (for e.g. units/order). */
export function formatDecimal(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0
  const neg = safe < 0
  const fixed = Math.abs(safe).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const grouped = groupThousands(intPart)
  return `${neg ? '−' : ''}${decPart ? `${grouped},${decPart}` : grouped}`
}

/**
 * Percentage change from `previous` to `current`, in percent units.
 * Returns null when there is no meaningful baseline (previous = 0), so the UI can
 * render "—" instead of Infinity/NaN.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
