// Browser helpers shared by the Miljøregistrering forms.

/** RFC 4122 v4 id for idempotent submissions; falls back to getRandomValues on older browsers. */
export function newSubmissionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** A Turnstile token is single-use: reset every widget after each submission attempt. */
export function resetTurnstile(): void {
  const t = (window as unknown as { turnstile?: { reset: (el?: unknown) => void } }).turnstile
  try {
    t?.reset()
  } catch {
    /* widget not rendered */
  }
}

export const formatNo = (n: number, maxDecimals = 0): string =>
  new Intl.NumberFormat('nb-NO', { maximumFractionDigits: maxDecimals }).format(n)
