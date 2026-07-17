// Single source of truth for the checkout VAT rate.
//
// Kustom expects the rate in basis points (2500 = 25 %). The same value, expressed as
// a percent, is snapshotted onto each new order line so the analytics dashboard can
// compute net (ex-VAT) revenue from the historical rate rather than assuming one.
// Change the rate here only — checkout and order snapshots both read from this module.

/** VAT rate in Kustom basis points (2500 = 25 %). */
export const VAT_RATE_BASIS_POINTS = 2500

/** VAT rate as a percent (e.g. 25). */
export const VAT_RATE_PERCENT = VAT_RATE_BASIS_POINTS / 100
