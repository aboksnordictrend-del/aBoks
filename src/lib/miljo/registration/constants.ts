// Shared constants of Miljøregistrering self-registration (Stage 2.2a, approval added in Stage 2.6).

export const MILJO_REGISTRATIONS_SLUG = 'miljo-registrations' as const
export const MILJO_REGISTRATION_AUDIT_SLUG = 'miljo-registration-audit' as const

/**
 *   pending            submitted; the login e-mail is not confirmed yet
 *   awaiting_approval  the login e-mail is confirmed; an administrator must decide. No company,
 *                      organisation, PIN or account exists yet
 *   confirmed          approved and activated. Also every registration activated before approval
 *                      existed (those have no `decidedAt`)
 *   rejected           refused by an administrator; nothing was created
 *   superseded         replaced by a newer attempt for the same order before it was confirmed
 */
export const REGISTRATION_STATUSES = ['pending', 'awaiting_approval', 'confirmed', 'rejected', 'superseded'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

export const REGISTRATION_STATUS_OPTIONS: { label: string; value: RegistrationStatus }[] = [
  { label: 'Venter på e-postbekreftelse', value: 'pending' },
  { label: 'Venter på godkjenning', value: 'awaiting_approval' },
  { label: 'Godkjent og aktivert', value: 'confirmed' },
  { label: 'Avvist', value: 'rejected' },
  { label: 'Erstattet av ny registrering', value: 'superseded' },
]

/** How an administrator checked that the applicant may act for the organisation. */
export const VERIFICATION_METHODS = ['phone', 'company-email', 'document', 'known-customer', 'other'] as const
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]

export const VERIFICATION_METHOD_OPTIONS: { label: string; value: VerificationMethod }[] = [
  { label: 'Telefon til bedriftens offentlige nummer', value: 'phone' },
  { label: 'E-post til bedriftens offisielle adresse', value: 'company-email' },
  { label: 'Dokumentasjon (faktura, fullmakt e.l.)', value: 'document' },
  { label: 'Kjent kunde hos aBoks', value: 'known-customer' },
  { label: 'Annet (beskriv i notatet)', value: 'other' },
]

export const REGISTRATION_AUDIT_ACTIONS = ['submitted', 'email-verified', 'approved', 'rejected', 'activated', 'superseded', 'note-updated'] as const
export type RegistrationAuditAction = (typeof REGISTRATION_AUDIT_ACTIONS)[number]

export const REGISTRATION_AUDIT_ACTION_OPTIONS: { label: string; value: RegistrationAuditAction }[] = [
  { label: 'Registrering sendt inn', value: 'submitted' },
  { label: 'E-post bekreftet', value: 'email-verified' },
  { label: 'Godkjent', value: 'approved' },
  { label: 'Avvist', value: 'rejected' },
  { label: 'Konto aktivert', value: 'activated' },
  { label: 'Erstattet av ny registrering', value: 'superseded' },
  { label: 'Internt notat endret', value: 'note-updated' },
]

export const DECISION_NOTE_MAX = 1000
export const INTERNAL_NOTES_MAX = 4000

/** The confirmation link is valid for 24 hours from the last send. */
export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

/** Resend: at most once a minute, and five links per registration in total. */
export const RESEND_MIN_INTERVAL_MS = 60 * 1000
export const RESEND_MAX_SENDS = 5

/**
 * Turnstile actions of the public registration form (`data-action` on its widgets). The organisation
 * lookup shares the second form's widget and therefore its action: both happen on the same form.
 */
export const REGISTRATION_TURNSTILE_ACTIONS = {
  purchase: 'bedrift-kjop',
  registration: 'bedrift-registrering',
} as const

/** Per-client and per-order limits (fixed windows, database-backed). */
export const RATE_LIMITS = {
  verifyPerIp: { limit: 20, windowSeconds: 60 * 60 },
  verifyPerOrder: { limit: 8, windowSeconds: 60 * 60 },
  lookupPerIp: { limit: 40, windowSeconds: 60 * 60 },
  // A customer may mistype the organisation number a few times; this also caps guessing the e-mail
  // of one order through this step, from any number of addresses.
  lookupPerOrder: { limit: 20, windowSeconds: 60 * 60 },
  submitPerIp: { limit: 10, windowSeconds: 60 * 60 },
  submitPerOrder: { limit: 5, windowSeconds: 60 * 60 },
  confirmPerIp: { limit: 30, windowSeconds: 60 * 60 },
  resendPerIp: { limit: 20, windowSeconds: 60 * 60 },
} as const

export const RATE_LIMITED_MESSAGE = 'For mange forsøk. Vent litt og prøv igjen.'
