// Input validation for Miljøregistrering. Pure; the server runs every check again regardless of
// what the browser did.

import {
  AUDIT_REASON_MAX,
  BATTERY_CATEGORIES,
  DELIVERY_LIMITS,
  isBatteryCategory,
  isDeliveryUnit,
  type BatteryCategory,
  type DeliveryUnit,
  type RegistrationFlag,
} from './constants'
import type { RegistrationPolicy } from './policy'

export interface RegistrationLine {
  category: BatteryCategory
  quantity: number
}

// ── Registrations ──

/** Form field holding the quantity of a category. */
export const quantityFieldName = (category: BatteryCategory): string => `antall_${category}`

/** '' and missing → 0; anything but plain digits → NaN. */
export function parseQuantity(raw: unknown): number {
  if (raw == null) return 0
  const text = String(raw).trim()
  if (text === '') return 0
  if (!/^\d{1,7}$/.test(text)) return Number.NaN
  return Number(text)
}

export type RegistrationValidation =
  | { ok: true; lines: RegistrationLine[]; total: number; flags: RegistrationFlag[] }
  | {
      ok: false
      reason: 'invalid' | 'needs-confirmation'
      message: string
      errors: Partial<Record<BatteryCategory | 'total', string>>
    }

/**
 * Validates one public registration against the organisation's policy. Quantities for categories
 * the organisation does not offer are refused rather than silently dropped, so a stale or
 * tampered form can never store a disabled category. Above the confirmation threshold the user
 * must tick «Jeg bekrefter antallet»; such registrations are flagged for review, not refused.
 */
export function validateRegistration(
  raw: Partial<Record<BatteryCategory, unknown>>,
  confirmed: boolean,
  policy: RegistrationPolicy,
): RegistrationValidation {
  const allowed = new Set(policy.categories.map((c) => c.value))
  const errors: Partial<Record<BatteryCategory | 'total', string>> = {}
  const lines: RegistrationLine[] = []

  for (const category of BATTERY_CATEGORIES) {
    const quantity = parseQuantity(raw[category])
    if (Number.isNaN(quantity)) {
      errors[category] = 'Skriv inn et helt tall.'
      continue
    }
    if (quantity === 0) continue
    if (!allowed.has(category)) {
      errors[category] = 'Denne batteritypen kan ikke registreres her.'
      continue
    }
    if (quantity > policy.maxPerCategory) {
      errors[category] = `Maks ${policy.maxPerCategory} per batteritype.`
      continue
    }
    lines.push({ category, quantity })
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, reason: 'invalid', message: 'Kontroller antallene som er markert.', errors }
  }

  const total = lines.reduce((sum, l) => sum + l.quantity, 0)
  if (total < 1) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Legg inn minst ett batteri før du registrerer.',
      errors: { total: 'Legg inn minst ett batteri.' },
    }
  }
  if (total > policy.maxPerSubmission) {
    return {
      ok: false,
      reason: 'invalid',
      message: `Du kan registrere maks ${policy.maxPerSubmission} batterier om gangen.`,
      errors: { total: `Maks ${policy.maxPerSubmission} per registrering.` },
    }
  }
  const high = total > policy.confirmAbove
  if (high && !confirmed) {
    return {
      ok: false,
      reason: 'needs-confirmation',
      message: `Du registrerer ${total} batterier. Bekreft at antallet er riktig.`,
      errors: { total: 'Bekreft antallet.' },
    }
  }
  return { ok: true, lines, total, flags: high ? ['high-quantity'] : [] }
}

/**
 * Admin correction of a registration's quantities. Any known category is accepted (an
 * administrator may correct a line into a category the organisation has since disabled), within
 * the hard per-category ceiling; at least one battery must remain — invalidate instead of
 * correcting to zero.
 */
export function validateCorrectedLines(
  raw: unknown,
  maxPerCategory: number,
): { ok: true; lines: RegistrationLine[]; total: number } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, message: 'Ugyldige antall.' }
  const lines: RegistrationLine[] = []
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isBatteryCategory(key)) return { ok: false, message: `Ukjent batteritype: ${key}.` }
    const quantity = typeof value === 'number' ? value : parseQuantity(value)
    if (!Number.isInteger(quantity) || quantity < 0) return { ok: false, message: 'Antall må være hele tall fra 0.' }
    if (quantity > maxPerCategory) return { ok: false, message: `Maks ${maxPerCategory} per batteritype.` }
    if (quantity > 0) lines.push({ category: key, quantity })
  }
  lines.sort((a, b) => BATTERY_CATEGORIES.indexOf(a.category) - BATTERY_CATEGORIES.indexOf(b.category))
  const total = lines.reduce((s, l) => s + l.quantity, 0)
  if (total < 1) return { ok: false, message: 'Minst ett batteri må stå igjen. Ugyldiggjør registreringen i stedet.' }
  return { ok: true, lines, total }
}

/** Required reason for every correction, invalidation and restore. */
export function validateReason(raw: unknown): { ok: true; reason: string } | { ok: false; message: string } {
  const reason = cleanText(raw, AUDIT_REASON_MAX + 1)
  if (reason.length < 3) return { ok: false, message: 'Skriv en begrunnelse (minst 3 tegn).' }
  if (reason.length > AUDIT_REASON_MAX) return { ok: false, message: `Begrunnelsen kan ha maks ${AUDIT_REASON_MAX} tegn.` }
  return { ok: true, reason }
}

// ── Deliveries ──

/** Collapses whitespace and removes control characters. */
export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidDateKey(value: string): boolean {
  const m = DATE_RE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

/**
 * Parses a delivered quantity in its own unit. Kilograms accept up to two decimals (comma or
 * point); pieces are whole numbers. The value is stored exactly as entered — never converted.
 */
export function parseDeliveryQuantity(raw: unknown, unit: DeliveryUnit): number {
  if (raw == null) return Number.NaN
  const text = String(raw).trim().replace(/\s/g, '').replace(',', '.')
  const pattern = unit === 'kg' ? /^\d{1,6}(\.\d{1,2})?$/ : /^\d{1,7}$/
  if (!pattern.test(text)) return Number.NaN
  return Number(text)
}

export interface DeliveryInput {
  deliveryDate: string
  quantity: number
  unit: DeliveryUnit
  operator: string
  reference: string
}

export type DeliveryValidation =
  | { ok: true; value: DeliveryInput }
  | { ok: false; message: string; errors: Partial<Record<keyof DeliveryInput, string>> }

export function validateDelivery(
  raw: { deliveryDate?: unknown; quantity?: unknown; unit?: unknown; operator?: unknown; reference?: unknown },
  todayKey: string,
): DeliveryValidation {
  const errors: Partial<Record<keyof DeliveryInput, string>> = {}

  const deliveryDate = typeof raw.deliveryDate === 'string' ? raw.deliveryDate.trim() : ''
  if (!isValidDateKey(deliveryDate)) errors.deliveryDate = 'Velg en gyldig dato.'
  else if (deliveryDate > todayKey) errors.deliveryDate = 'Datoen kan ikke være frem i tid.'
  else if (deliveryDate < addDays(todayKey, -DELIVERY_LIMITS.maxAgeDays)) errors.deliveryDate = 'Datoen er for langt tilbake i tid.'

  const unit = isDeliveryUnit(raw.unit) ? raw.unit : null
  if (!unit) errors.unit = 'Velg kg eller stk.'

  let quantity = Number.NaN
  if (unit) {
    quantity = parseDeliveryQuantity(raw.quantity, unit)
    const max = unit === 'kg' ? DELIVERY_LIMITS.maxKg : DELIVERY_LIMITS.maxPieces
    if (Number.isNaN(quantity)) {
      errors.quantity = unit === 'kg' ? 'Skriv inn vekt, f.eks. 12,5.' : 'Skriv inn et helt antall.'
    } else if (quantity <= 0) errors.quantity = 'Mengden må være større enn 0.'
    else if (quantity > max) errors.quantity = `Mengden kan ikke være over ${max.toLocaleString('nb-NO')} ${unit === 'kg' ? 'kg' : 'stk.'}`
  }

  const operator = cleanText(raw.operator, DELIVERY_LIMITS.operatorMax + 1)
  if (operator.length < 2) errors.operator = 'Oppgi mottak eller avfallsselskap.'
  else if (operator.length > DELIVERY_LIMITS.operatorMax) errors.operator = `Maks ${DELIVERY_LIMITS.operatorMax} tegn.`

  const reference = cleanText(raw.reference, DELIVERY_LIMITS.referenceMax + 1)
  if (reference.length > DELIVERY_LIMITS.referenceMax) errors.reference = `Maks ${DELIVERY_LIMITS.referenceMax} tegn.`

  if (Object.keys(errors).length > 0 || !unit) {
    return { ok: false, message: 'Kontroller feltene som er markert.', errors }
  }
  return { ok: true, value: { deliveryDate, quantity, unit, operator, reference } }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
