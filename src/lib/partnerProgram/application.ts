/**
 * Validation and normalisation for the Salgspartner application form on /bli-partner.
 *
 * Pure and isomorphic, like `@/lib/bedrifter/inquiry`, which it mirrors: the client form and
 * the endpoint import the same limits, messages and validator, so the browser and the server
 * can never disagree about what is valid.
 *
 * The form deliberately asks for nothing sensitive — no national identity number, no bank
 * account, no financial information. Those belong in the partner agreement, after approval,
 * not in a public form.
 */

import { normalizeMultiline, normalizeWhitespace } from '@/lib/reviewValidation'
import { EMAIL_RE } from '@/lib/bedrifter/inquiry'

export const APPLICANT_TYPES = ['privatperson', 'enk', 'bedrift'] as const
export type ApplicantType = (typeof APPLICANT_TYPES)[number]

export const APPLICANT_TYPE_LABELS: Record<ApplicantType, string> = {
  privatperson: 'Privatperson',
  enk: 'Enkeltpersonforetak (ENK)',
  bedrift: 'Bedrift',
}

/** Applicant types that have a business name and organisation number. */
export const isBusinessApplicant = (type: string): boolean => type === 'enk' || type === 'bedrift'

export const APPLICATION_LIMITS = {
  fullNameMax: 120,
  companyNameMax: 120,
  orgNumberMax: 40,
  emailMax: 254,
  phoneMax: 40,
  websiteMax: 300,
  promotionPlanMin: 20,
  promotionPlanMax: 3000,
} as const

/** Field order: tab order, focus-after-error order and the order rows appear in the e-mails. */
export const APPLICATION_FIELDS = [
  'applicantType',
  'fullName',
  'companyName',
  'orgNumber',
  'email',
  'phone',
  'website',
  'promotionPlan',
  'privacyAccepted',
  'approvalAcknowledged',
] as const

export type ApplicationFieldKey = (typeof APPLICATION_FIELDS)[number]

export const APPLICATION_LABELS: Record<ApplicationFieldKey, string> = {
  applicantType: 'Søker som',
  fullName: 'Fullt navn',
  companyName: 'Firmanavn',
  orgNumber: 'Organisasjonsnummer',
  email: 'E-post',
  phone: 'Telefonnummer',
  website: 'Nettside eller profil i sosiale medier',
  promotionPlan: 'Hvordan ønsker du å gjøre aBoks kjent?',
  privacyAccepted: 'Personvern',
  approvalAcknowledged: 'Godkjenning',
}

export const APPLICATION_MESSAGES = {
  applicantTypeRequired: 'Velg om du søker som privatperson, ENK eller bedrift.',
  fullNameRequired: 'Fyll inn fullt navn.',
  fullNameTooLong: `Navnet kan være maks ${APPLICATION_LIMITS.fullNameMax} tegn.`,
  companyNameRequired: 'Fyll inn firmanavnet.',
  companyNameTooLong: `Firmanavnet kan være maks ${APPLICATION_LIMITS.companyNameMax} tegn.`,
  orgNumberRequired: 'Fyll inn organisasjonsnummeret.',
  orgNumberInvalid: 'Organisasjonsnummer består av 9 siffer.',
  emailRequired: 'Fyll inn e-postadressen.',
  emailInvalid: 'Skriv en gyldig e-postadresse.',
  phoneInvalid: 'Skriv et gyldig telefonnummer.',
  websiteTooLong: `Lenken kan være maks ${APPLICATION_LIMITS.websiteMax} tegn.`,
  promotionPlanRequired: 'Fortell kort hvordan du ønsker å markedsføre aBoks.',
  promotionPlanTooShort: `Skriv litt mer – minst ${APPLICATION_LIMITS.promotionPlanMin} tegn.`,
  promotionPlanTooLong: `Teksten kan være maks ${APPLICATION_LIMITS.promotionPlanMax} tegn.`,
  privacyRequired: 'Du må bekrefte at du har lest personvernerklæringen.',
  approvalRequired: 'Du må bekrefte at søknaden ikke innebærer automatisk godkjenning.',
} as const

export type RawApplicationInput = Partial<Record<ApplicationFieldKey, unknown>>

export interface CleanApplication {
  applicantType: ApplicantType
  fullName: string
  /** Only for ENK / bedrift. */
  companyName?: string
  /** Only for ENK / bedrift; nine digits, no spaces. */
  orgNumber?: string
  email: string
  phone?: string
  website?: string
  promotionPlan: string
  privacyAccepted: true
  approvalAcknowledged: true
}

export type ApplicationErrors = Partial<Record<ApplicationFieldKey, string>>

export type ApplicationValidationResult =
  | { ok: true; value: CleanApplication }
  | { ok: false; errors: ApplicationErrors }

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

export function validateApplicationInput(raw: RawApplicationInput): ApplicationValidationResult {
  const errors: ApplicationErrors = {}

  // ── applicant type ──
  const applicantType = normalizeWhitespace(asText(raw.applicantType))
  const knownType = (APPLICANT_TYPES as readonly string[]).includes(applicantType)
  if (!knownType) errors.applicantType = APPLICATION_MESSAGES.applicantTypeRequired
  const business = knownType && isBusinessApplicant(applicantType)

  // ── full name ──
  const fullName = normalizeWhitespace(asText(raw.fullName))
  if (!fullName) errors.fullName = APPLICATION_MESSAGES.fullNameRequired
  else if (fullName.length > APPLICATION_LIMITS.fullNameMax) {
    errors.fullName = APPLICATION_MESSAGES.fullNameTooLong
  }

  // ── company name + org.nr — read only for ENK / bedrift, ignored for a private person ──
  let companyName: string | undefined
  let orgNumber: string | undefined
  if (business) {
    const rawCompany = normalizeWhitespace(asText(raw.companyName))
    if (rawCompany.length > APPLICATION_LIMITS.companyNameMax) {
      errors.companyName = APPLICATION_MESSAGES.companyNameTooLong
    } else if (rawCompany) {
      companyName = rawCompany
    } else if (applicantType === 'bedrift') {
      errors.companyName = APPLICATION_MESSAGES.companyNameRequired
    }

    const rawOrg = normalizeWhitespace(asText(raw.orgNumber))
    if (rawOrg) {
      const digits = rawOrg.replace(/\s/g, '')
      if (rawOrg.length > APPLICATION_LIMITS.orgNumberMax || !/^\d{9}$/.test(digits)) {
        errors.orgNumber = APPLICATION_MESSAGES.orgNumberInvalid
      } else {
        orgNumber = digits
      }
    } else if (applicantType === 'bedrift') {
      errors.orgNumber = APPLICATION_MESSAGES.orgNumberRequired
    }
  }

  // ── email ──
  const email = normalizeWhitespace(asText(raw.email))
  if (!email) errors.email = APPLICATION_MESSAGES.emailRequired
  else if (email.length > APPLICATION_LIMITS.emailMax || !EMAIL_RE.test(email)) {
    errors.email = APPLICATION_MESSAGES.emailInvalid
  }

  // ── phone (optional) ──
  let phone: string | undefined
  const rawPhone = normalizeWhitespace(asText(raw.phone))
  if (rawPhone) {
    if (rawPhone.length > APPLICATION_LIMITS.phoneMax || rawPhone.replace(/\D/g, '').length < 8) {
      errors.phone = APPLICATION_MESSAGES.phoneInvalid
    } else {
      phone = rawPhone
    }
  }

  // ── website / profile (optional, free text: a URL or an @handle) ──
  let website: string | undefined
  const rawWebsite = normalizeWhitespace(asText(raw.website))
  if (rawWebsite) {
    if (rawWebsite.length > APPLICATION_LIMITS.websiteMax) {
      errors.website = APPLICATION_MESSAGES.websiteTooLong
    } else {
      website = rawWebsite
    }
  }

  // ── promotion plan ──
  const promotionPlan = normalizeMultiline(asText(raw.promotionPlan))
  if (!promotionPlan) errors.promotionPlan = APPLICATION_MESSAGES.promotionPlanRequired
  else if (promotionPlan.length < APPLICATION_LIMITS.promotionPlanMin) {
    errors.promotionPlan = APPLICATION_MESSAGES.promotionPlanTooShort
  } else if (promotionPlan.length > APPLICATION_LIMITS.promotionPlanMax) {
    errors.promotionPlan = APPLICATION_MESSAGES.promotionPlanTooLong
  }

  // ── the two confirmations: strictly `true`, never a truthy string ──
  if (raw.privacyAccepted !== true) errors.privacyAccepted = APPLICATION_MESSAGES.privacyRequired
  if (raw.approvalAcknowledged !== true) {
    errors.approvalAcknowledged = APPLICATION_MESSAGES.approvalRequired
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      applicantType: applicantType as ApplicantType,
      fullName,
      ...(companyName ? { companyName } : {}),
      ...(orgNumber ? { orgNumber } : {}),
      email,
      ...(phone ? { phone } : {}),
      ...(website ? { website } : {}),
      promotionPlan,
      privacyAccepted: true,
      approvalAcknowledged: true,
    },
  }
}

export function firstInvalidApplicationField(errors: ApplicationErrors): ApplicationFieldKey | undefined {
  return APPLICATION_FIELDS.find((key) => errors[key])
}
