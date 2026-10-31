// aBoks Miljøregistrering — shared constants. Pure; safe in client, server and admin bundles.
//
// The two quantities this module deals in are never interchangeable:
//
//   • «Registrerte batterier» — battery COUNTS self-reported by employees through the QR page
//     (battery-registrations). Anonymous and unverified.
//   • «Leverte batterier» — actual deliveries to a collection operator, recorded by the
//     organisation's responsible person with a PIN (battery-deliveries). Kept in their original
//     unit (kg or stk.); never converted, never summed with registrations.

export const MILJO_ADMIN_GROUP = 'Miljøregistrering'

export const ENV_ORGANIZATIONS_SLUG = 'environmental-organizations' as const
export const BATTERY_REGISTRATIONS_SLUG = 'battery-registrations' as const
export const BATTERY_REGISTRATION_AUDIT_SLUG = 'battery-registration-audit' as const
export const BATTERY_DELIVERIES_SLUG = 'battery-deliveries' as const
export const BATTERY_DELIVERY_AUDIT_SLUG = 'battery-delivery-audit' as const
export const BATTERY_DELIVERY_DOCUMENTS_SLUG = 'battery-delivery-documents' as const

export const MILJO_ROUTE_PREFIX = '/miljo'
/** Canonical public origin (as src/lib/pilot/urls.ts); the admin bundle needs no env for it. */
export const PUBLIC_MILJO_ORIGIN = 'https://aboks.no'

// ── Battery categories ──
//
// The single source of truth for what the public form may offer. The current aBoks XL does NOT
// accept 9V or lithium batteries, so neither exists here — not even as a hidden option. «Andre»
// is never enabled by default: an organisation offers it only when an administrator has both
// selected it and described exactly which types the container's approved instructions permit
// (see `allowedCategoriesFor`). Adding a category later is a code change plus an enum migration,
// so nothing new can switch itself on.

export const BATTERY_CATEGORIES = ['aa', 'aaa', 'other'] as const
export type BatteryCategory = (typeof BATTERY_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<BatteryCategory, string> = {
  aa: 'AA',
  aaa: 'AAA',
  other: 'Andre',
}

export const CATEGORY_OPTIONS = BATTERY_CATEGORIES.map((value) => ({ label: CATEGORY_LABELS[value], value }))

/** Categories a new organisation starts with. «Andre» is deliberately absent. */
export const DEFAULT_ALLOWED_CATEGORIES: BatteryCategory[] = ['aa', 'aaa']

export function isBatteryCategory(value: unknown): value is BatteryCategory {
  return typeof value === 'string' && (BATTERY_CATEGORIES as readonly string[]).includes(value)
}

// ── Registration limits ──

/** Hard ceilings. Per-organisation limits may be lower, never higher. */
export const REGISTRATION_LIMITS = {
  maxPerCategory: 200,
  maxPerSubmission: 500,
  /** Above this total the public form asks for an explicit confirmation. */
  confirmAbove: 50,
  /** Organisation total per Oslo day above which a registration is flagged «burst». */
  dailyFlagThreshold: 1000,
  /** Window in which an identical registration from the same network counts as a likely repeat. */
  duplicateWindowMs: 2 * 60 * 1000,
} as const

// ── Registration methods ──
//
// Battery-registrations are COUNTS. `manual` is the only method in v1; `barcode` is reserved for
// a future scan-assisted flow that still ends in a user-confirmed count. Weight and sensor
// readings are not counts and will get their own collection (see docs in
// src/collections/BatteryRegistrations.ts) — they must never be written into count lines.

export const REGISTRATION_METHODS = ['manual', 'barcode'] as const
export type RegistrationMethod = (typeof REGISTRATION_METHODS)[number]
export const REGISTRATION_METHOD_OPTIONS: { label: string; value: RegistrationMethod }[] = [
  { label: 'Manuell', value: 'manual' },
  { label: 'Strekkode (fremtidig)', value: 'barcode' },
]

/** Every measurement source the architecture anticipates; only `manual` is implemented. */
export const MEASUREMENT_SOURCES = ['manual', 'barcode', 'weight', 'sensor'] as const

// ── Record status ──

export const RECORD_STATUSES = ['registered', 'corrected', 'invalidated'] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]
export const RECORD_STATUS_OPTIONS: { label: string; value: RecordStatus }[] = [
  { label: 'Registrert', value: 'registered' },
  { label: 'Korrigert', value: 'corrected' },
  { label: 'Ugyldiggjort', value: 'invalidated' },
]

export const REGISTRATION_FLAGS = ['high-quantity', 'burst', 'possible-duplicate'] as const
export type RegistrationFlag = (typeof REGISTRATION_FLAGS)[number]
export const REGISTRATION_FLAG_OPTIONS: { label: string; value: RegistrationFlag }[] = [
  { label: 'Høyt antall', value: 'high-quantity' },
  { label: 'Uvanlig mange i dag', value: 'burst' },
  { label: 'Mulig duplikat', value: 'possible-duplicate' },
]

export const REVIEW_STATES = ['none', 'pending', 'reviewed'] as const
export type ReviewState = (typeof REVIEW_STATES)[number]
export const REVIEW_STATE_OPTIONS: { label: string; value: ReviewState }[] = [
  { label: 'Ingen merknad', value: 'none' },
  { label: 'Til gjennomgang', value: 'pending' },
  { label: 'Gjennomgått', value: 'reviewed' },
]

// ── Deliveries ──

export const DELIVERY_UNITS = ['kg', 'stk'] as const
export type DeliveryUnit = (typeof DELIVERY_UNITS)[number]
export const DELIVERY_UNIT_LABELS: Record<DeliveryUnit, string> = { kg: 'kg', stk: 'stk.' }
export const DELIVERY_UNIT_OPTIONS = DELIVERY_UNITS.map((value) => ({ label: DELIVERY_UNIT_LABELS[value], value }))

export function isDeliveryUnit(value: unknown): value is DeliveryUnit {
  return value === 'kg' || value === 'stk'
}

export const DOCUMENTATION_STATUSES = ['reported', 'documented'] as const
export type DocumentationStatus = (typeof DOCUMENTATION_STATUSES)[number]
export const DOCUMENTATION_LABELS: Record<DocumentationStatus, string> = {
  reported: 'Oppgitt av ansvarlig',
  documented: 'Dokumentert med kvittering',
}
export const DOCUMENTATION_OPTIONS = DOCUMENTATION_STATUSES.map((value) => ({ label: DOCUMENTATION_LABELS[value], value }))

export const DELIVERY_LIMITS = {
  /** Upper bound per delivery — a sanity ceiling, not a business rule. */
  maxKg: 100_000,
  maxPieces: 1_000_000,
  operatorMax: 160,
  referenceMax: 120,
  /** Oldest accepted delivery date, counted back from today. */
  maxAgeDays: 3 * 366,
  /** A PDF upload must fit under Vercel's ~4.5 MB request limit together with the form. */
  documentMaxBytes: 3_500_000,
} as const

// ── Audit ──

export const AUDIT_ACTIONS = ['create', 'correct', 'invalidate', 'restore', 'review'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
export const AUDIT_ACTION_OPTIONS: { label: string; value: AuditAction }[] = [
  { label: 'Opprettet', value: 'create' },
  { label: 'Korrigert', value: 'correct' },
  { label: 'Ugyldiggjort', value: 'invalidate' },
  { label: 'Gjenopprettet', value: 'restore' },
  { label: 'Merket som gjennomgått', value: 'review' },
]
export const AUDIT_REASON_MAX = 500

// ── Organisations ──

export const ORGANIZATION_STATUSES = ['active', 'inactive'] as const
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number]
export const ORGANIZATION_STATUS_OPTIONS: { label: string; value: OrganizationStatus }[] = [
  { label: 'Aktiv', value: 'active' },
  { label: 'Inaktiv', value: 'inactive' },
]

export const ORGANIZATION_LIMITS = {
  nameMax: 120,
  otherLabelMax: 40,
  otherDescriptionMax: 300,
} as const

// ── PIN ──

export const PIN_POLICY = {
  minLength: 6,
  maxLength: 10,
  /** Generated PINs. */
  generatedLength: 6,
  /** Failed attempts allowed per organisation within `windowMs` before verification stops. */
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
} as const
