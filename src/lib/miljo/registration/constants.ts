// Shared constants of Miljøregistrering self-registration (Stage 2.2a).

export const MILJO_REGISTRATIONS_SLUG = 'miljo-registrations' as const

export const REGISTRATION_STATUSES = ['pending', 'confirmed', 'superseded'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

export const REGISTRATION_STATUS_OPTIONS: { label: string; value: RegistrationStatus }[] = [
  { label: 'Venter på bekreftelse', value: 'pending' },
  { label: 'Bekreftet og aktivert', value: 'confirmed' },
  { label: 'Erstattet av ny registrering', value: 'superseded' },
]

/** The confirmation link is valid for 24 hours from the last send. */
export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

/** Resend: at most once a minute, and five links per registration in total. */
export const RESEND_MIN_INTERVAL_MS = 60 * 1000
export const RESEND_MAX_SENDS = 5

/** Per-client and per-order limits (fixed windows, database-backed). */
export const RATE_LIMITS = {
  verifyPerIp: { limit: 20, windowSeconds: 60 * 60 },
  verifyPerOrder: { limit: 8, windowSeconds: 60 * 60 },
  lookupPerIp: { limit: 40, windowSeconds: 60 * 60 },
  submitPerIp: { limit: 10, windowSeconds: 60 * 60 },
  submitPerOrder: { limit: 5, windowSeconds: 60 * 60 },
  confirmPerIp: { limit: 30, windowSeconds: 60 * 60 },
  resendPerIp: { limit: 20, windowSeconds: 60 * 60 },
} as const

export const RATE_LIMITED_MESSAGE = 'For mange forsøk. Vent litt og prøv igjen.'
