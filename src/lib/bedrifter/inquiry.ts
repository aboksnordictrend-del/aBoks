/**
 * Server-side validation and normalisation for the B2B inquiry form on /bedrifter.
 *
 * Pure, isomorphic and unit-tested — deliberately free of node:crypto, Payload and anything
 * else server-only, because the client form imports the very same limits, messages and
 * validator. One rule set, one spelling of every Norwegian message, no drift between what
 * the browser flags and what the endpoint refuses.
 *
 * Mirrors @/lib/reviewValidation in shape (no schema library exists in this project) and
 * reuses its whitespace helpers rather than restating them. HTML is NOT stripped here: the
 * e-mail templates escape every value with `escapeHtml`, and silently deleting a fragment
 * like "<10 bokser" from a customer's message would be worse than rendering it verbatim.
 */

import { normalizeMultiline, normalizeWhitespace } from '@/lib/reviewValidation'

/** The dropdown's options. The select is the only way to set `interest`, so the server
 *  accepts exactly these — an unknown value is a hand-rolled POST, not a customer. */
export const INTEREST_OPTIONS = [
  'Produkter til egen bedrift',
  'aBoks Special',
  'aBoks Office',
  'Større bestilling',
  'Forhandlersamarbeid',
  'Dropshipping',
  'Annet',
] as const

export type InterestOption = (typeof INTEREST_OPTIONS)[number]

/** Maximum accepted lengths, checked after normalisation. */
export const INQUIRY_LIMITS = {
  companyMax: 120,
  orgNumberMax: 40,
  contactPersonMax: 120,
  /** RFC 5321 maximum length of an email address. */
  emailMax: 254,
  phoneMax: 40,
  interestMax: 120,
  quantityMax: 40,
  messageMax: 3000,
} as const

/**
 * Field order, used for three things at once: the tab order of the form, which field gets
 * focus after a failed submit, and the order rows appear in both e-mails.
 */
export const INQUIRY_FIELDS = [
  'company',
  'orgNumber',
  'contactPerson',
  'email',
  'phone',
  'interest',
  'quantity',
  'message',
] as const

export type InquiryFieldKey = (typeof INQUIRY_FIELDS)[number]

/** Norwegian labels, shared by the two e-mail templates so they can never disagree. */
export const INQUIRY_LABELS: Record<InquiryFieldKey, string> = {
  company: 'Firmanavn',
  orgNumber: 'Organisasjonsnummer',
  contactPerson: 'Kontaktperson',
  email: 'E-post',
  phone: 'Telefonnummer',
  interest: 'Hva er dere interessert i?',
  quantity: 'Omtrent antall produkter',
  message: 'Melding',
}

/**
 * Same expression the form has always used. Deliberately permissive — the address is not
 * verified by us, it is verified by the confirmation e-mail arriving.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Every message the form and the endpoint can show, in one place. */
export const INQUIRY_MESSAGES = {
  companyRequired: 'Fyll inn bedriftsnavn.',
  companyTooLong: `Bedriftsnavnet kan være maks ${INQUIRY_LIMITS.companyMax} tegn.`,
  orgNumberInvalid: 'Organisasjonsnummer består av 9 siffer.',
  contactPersonRequired: 'Fyll inn navnet på kontaktpersonen.',
  contactPersonTooLong: `Navnet kan være maks ${INQUIRY_LIMITS.contactPersonMax} tegn.`,
  emailRequired: 'Fyll inn e-postadressen.',
  emailInvalid: 'Skriv en gyldig e-postadresse.',
  phoneInvalid: 'Skriv et gyldig telefonnummer.',
  interestRequired: 'Velg hva dere er interessert i.',
  quantityInvalid: 'Oppgi antall som et tall.',
  messageRequired: 'Skriv en kort melding om behovet.',
  messageTooLong: `Meldingen kan være maks ${INQUIRY_LIMITS.messageMax} tegn.`,
} as const

export type RawInquiryInput = Partial<Record<InquiryFieldKey, unknown>>

/**
 * A validated inquiry. Every string is trimmed and whitespace-normalised; every optional
 * field is either a non-empty string or absent — never `''`, so the templates can branch on
 * presence alone.
 */
export interface CleanInquiry {
  company: string
  orgNumber?: string
  contactPerson: string
  email: string
  phone?: string
  interest: string
  quantity?: string
  message: string
}

export type InquiryValidationResult =
  | { ok: true; value: CleanInquiry }
  | { ok: false; errors: Partial<Record<InquiryFieldKey, string>> }

/** A non-string (number, object, null) is treated as "not filled in". */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Validates and normalises one submission. Whitespace-only input is indistinguishable from
 * empty input by design — normalisation happens before every required/length check, so
 * `"   "` fails as missing rather than passing as a one-character value.
 */
export function validateInquiryInput(raw: RawInquiryInput): InquiryValidationResult {
  const errors: Partial<Record<InquiryFieldKey, string>> = {}

  // ── company ──
  const company = normalizeWhitespace(asText(raw.company))
  if (!company) errors.company = INQUIRY_MESSAGES.companyRequired
  else if (company.length > INQUIRY_LIMITS.companyMax) {
    errors.company = INQUIRY_MESSAGES.companyTooLong
  }

  // ── org.nr (optional) — 9 digits, spaces allowed while typing ──
  let orgNumber: string | undefined
  const rawOrgNumber = normalizeWhitespace(asText(raw.orgNumber))
  if (rawOrgNumber) {
    const digits = rawOrgNumber.replace(/\s/g, '')
    if (rawOrgNumber.length > INQUIRY_LIMITS.orgNumberMax || !/^\d{9}$/.test(digits)) {
      errors.orgNumber = INQUIRY_MESSAGES.orgNumberInvalid
    } else {
      orgNumber = digits
    }
  }

  // ── contact person ──
  const contactPerson = normalizeWhitespace(asText(raw.contactPerson))
  if (!contactPerson) errors.contactPerson = INQUIRY_MESSAGES.contactPersonRequired
  else if (contactPerson.length > INQUIRY_LIMITS.contactPersonMax) {
    errors.contactPerson = INQUIRY_MESSAGES.contactPersonTooLong
  }

  // ── email ──
  const email = normalizeWhitespace(asText(raw.email))
  if (!email) errors.email = INQUIRY_MESSAGES.emailRequired
  else if (email.length > INQUIRY_LIMITS.emailMax || !EMAIL_RE.test(email)) {
    errors.email = INQUIRY_MESSAGES.emailInvalid
  }

  // ── phone (optional) ──
  let phone: string | undefined
  const rawPhone = normalizeWhitespace(asText(raw.phone))
  if (rawPhone) {
    if (rawPhone.length > INQUIRY_LIMITS.phoneMax || rawPhone.replace(/\D/g, '').length < 8) {
      errors.phone = INQUIRY_MESSAGES.phoneInvalid
    } else {
      phone = rawPhone
    }
  }

  // ── interest ──
  const interest = normalizeWhitespace(asText(raw.interest))
  if (
    !interest ||
    interest.length > INQUIRY_LIMITS.interestMax ||
    !(INTEREST_OPTIONS as readonly string[]).includes(interest)
  ) {
    errors.interest = INQUIRY_MESSAGES.interestRequired
  }

  // ── quantity (optional) ──
  let quantity: string | undefined
  const rawQuantity = normalizeWhitespace(asText(raw.quantity))
  if (rawQuantity) {
    if (rawQuantity.length > INQUIRY_LIMITS.quantityMax || !/^\d+$/.test(rawQuantity)) {
      errors.quantity = INQUIRY_MESSAGES.quantityInvalid
    } else {
      quantity = rawQuantity
    }
  }

  // ── message — paragraph breaks are kept, runs of blank lines are not ──
  const message = normalizeMultiline(asText(raw.message))
  if (!message) errors.message = INQUIRY_MESSAGES.messageRequired
  else if (message.length > INQUIRY_LIMITS.messageMax) {
    errors.message = INQUIRY_MESSAGES.messageTooLong
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      company,
      ...(orgNumber ? { orgNumber } : {}),
      contactPerson,
      email,
      ...(phone ? { phone } : {}),
      interest,
      ...(quantity ? { quantity } : {}),
      message,
    },
  }
}

/** First field with an error, in form order — what gets focus after a failed submit. */
export function firstInvalidField(
  errors: Partial<Record<InquiryFieldKey, string>>,
): InquiryFieldKey | undefined {
  return INQUIRY_FIELDS.find((key) => errors[key])
}
