/**
 * Partner postal address: optional, shared by both partner types.
 *
 * Dependency-free so the collection and its tests can use it directly. Validation is deliberately
 * light — this is contact information for the administrator, not a shipping address — and every
 * message is Norwegian:
 *
 *   • every field is optional and trimmed;
 *   • a Norwegian postal code is exactly four digits. A partner whose country is «Norge» — or empty,
 *     which is what partners created before the address fields existed have — is treated as
 *     Norwegian;
 *   • a foreign postal code may be letters, digits, spaces and hyphens, up to 12 characters;
 *   • free-text fields are capped so a pasted document cannot end up in an address line.
 */

/** Pre-filled on a NEW partner only. Existing partners are never given a country. */
export const DEFAULT_PARTNER_COUNTRY = 'Norge'

export const ADDRESS_LINE_MAX = 200
export const CITY_MAX = 100
export const COUNTRY_MAX = 100
export const FOREIGN_POSTAL_CODE_MAX = 12

const NORWAY = new Set(['norge', 'norway', 'no', 'nor'])

/** True for «Norge» in its usual spellings — and for an empty country (see the file header). */
export function isNorwegianCountry(country: unknown): boolean {
  if (country == null) return true
  if (typeof country !== 'string') return false
  const c = country.trim().toLowerCase()
  return c === '' || NORWAY.has(c)
}

/** Trims a text value; whitespace-only becomes empty. Non-strings pass through unchanged. */
export const trimText = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value)

/** An optional free-text field: any string up to `max` characters once trimmed. */
export function validateOptionalText(value: unknown, label: string, max: number): true | string {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return `${label} må være tekst.`
  if (value.trim().length > max) return `${label} kan ikke være lengre enn ${max} tegn.`
  return true
}

/** An optional postal code, checked against the partner's country. */
export function validatePostalCode(value: unknown, country: unknown): true | string {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return 'Postnummer må være tekst.'
  const code = value.trim()
  if (code === '') return true
  if (isNorwegianCountry(country)) {
    return /^\d{4}$/.test(code) ? true : 'Norsk postnummer må være fire siffer, for eksempel 0150.'
  }
  if (code.length > FOREIGN_POSTAL_CODE_MAX || !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(code)) {
    return `Postnummer kan bare inneholde bokstaver, tall, mellomrom og bindestrek (maks ${FOREIGN_POSTAL_CODE_MAX} tegn).`
  }
  return true
}
