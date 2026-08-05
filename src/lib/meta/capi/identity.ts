// Normalization + hashing of the customer identifiers Meta accepts in `user_data`.
//
// Meta matches on SHA-256 of a *normalized* value, so the normalization is not cosmetic: an
// un-lowercased address or a phone with a `+` hashes to something Meta can never match, and
// the event silently attributes to nobody.
//
// Nothing here logs. The plaintext email and phone exist only as local values on their way
// into a hash, and the caller is expected to keep it that way.

import { createHash } from 'crypto'

/** SHA-256 of a UTF-8 string, lowercase hex — the encoding Meta expects. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/**
 * `  Ola.Nordmann@Example.NO ` → `ola.nordmann@example.no`.
 *
 * Returns null for anything that is not plausibly an address, so a blank Kustom field
 * becomes an omitted `em` rather than a hash of the empty string — which Meta would accept
 * and never match.
 */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email) return null

  const at = email.indexOf('@')
  // Exactly one '@', with something either side, and a dot in the domain.
  if (at <= 0 || at !== email.lastIndexOf('@')) return null
  const domain = email.slice(at + 1)
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return null
  if (/\s/.test(email)) return null

  return email
}

/**
 * A phone number as Meta wants it: digits only, country code included, no `+`.
 *
 * Kustom returns Norwegian numbers in whatever shape the customer typed — `+47 123 45 678`,
 * `(+47) 123-45-678`, `0047 12345678` or a bare `12345678`. All four must end up as the same
 * `4712345678`, otherwise the same customer hashes to four different people.
 *
 *   1. strip everything that is not a digit (spaces, dashes, parentheses, the `+`)
 *   2. drop a leading international `00` prefix
 *   3. an 8-digit number is a bare Norwegian subscriber number → prefix the country code 47
 *
 * Step 3 is deliberately narrow: 8 digits is the exact length of a Norwegian number and the
 * shop only ships to Norway (`shipping_countries: ['NO']`). Numbers that already carry a
 * country code are left alone, so a foreign number is never mislabelled as Norwegian.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null

  let digits = value.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 8) digits = `47${digits}`

  // Shorter than this is not a dialable number — an extension, or a typo.
  if (digits.length < 8) return null

  return digits
}

/** Normalized-then-hashed email, or null when there is nothing usable to hash. */
export function hashedEmail(value: string | null | undefined): string | null {
  const email = normalizeEmail(value)
  return email ? sha256Hex(email) : null
}

/** Normalized-then-hashed phone, or null when there is nothing usable to hash. */
export function hashedPhone(value: string | null | undefined): string | null {
  const phone = normalizePhone(value)
  return phone ? sha256Hex(phone) : null
}
