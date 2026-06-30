export function formatPrice(amount: number): string {
  // Deterministic: avoid toLocaleString whose ICU output differs between Node.js and browsers,
  // which causes React hydration mismatches. nb-NO standard uses non-breaking space as thousands separator.
  const s = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return 'kr ' + s
}

export function generateOrderNumber(seed?: number): string {
  const base = seed ?? Math.floor(Math.random() * 9999)
  return 'AB-' + String(28400 + base).padStart(6, '0')
}
