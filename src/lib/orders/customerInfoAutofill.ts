// «Kundeinformasjon» on a manual order, filled from the chosen Kunde and/or Bedriftskunde.
// Pure, so the admin component and the tests share it.
//
// Only data that EXISTS is used — nothing is invented:
//
//   customers.email / firstName / lastName / phone     → same fields
//   customers.address.street / postalCode / city       → address / postalCode / city
//   business-customers.contactEmail                    → email
//
// A business customer stores its contact person as one free-text name and has no address or
// phone, and the order has no company-name or organisation-number field — so those are shown,
// never split or copied into person fields.
//
// When both are chosen the Bedriftskunde wins for the fields it provides (e-mail); the Kunde fills
// the rest. A value the administrator already has in the form is never replaced without asking:
// `planAutofill` separates fields that can be filled silently (empty now) from those that would
// overwrite something different.

export const CUSTOMER_INFO_FIELDS = ['email', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'phone'] as const
export type CustomerInfoField = (typeof CUSTOMER_INFO_FIELDS)[number]
export type CustomerInfo = Partial<Record<CustomerInfoField, string>>

export const CUSTOMER_INFO_LABELS: Record<CustomerInfoField, string> = {
  email: 'E-post',
  firstName: 'Fornavn',
  lastName: 'Etternavn',
  address: 'Adresse',
  postalCode: 'Postnummer',
  city: 'Sted',
  phone: 'Telefon',
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

function compact(entries: [CustomerInfoField, unknown][]): CustomerInfo {
  const out: CustomerInfo = {}
  for (const [key, value] of entries) {
    const t = text(value)
    if (t != null) out[key] = t
  }
  return out
}

export interface CustomerDoc {
  email?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  address?: { street?: unknown; postalCode?: unknown; city?: unknown } | null
}

export interface BusinessCustomerDoc {
  name?: unknown
  organizationNumber?: unknown
  contactName?: unknown
  contactEmail?: unknown
}

export function customerInfoFromCustomer(doc: CustomerDoc | null | undefined): CustomerInfo {
  if (!doc) return {}
  return compact([
    ['email', doc.email],
    ['firstName', doc.firstName],
    ['lastName', doc.lastName],
    ['address', doc.address?.street],
    ['postalCode', doc.address?.postalCode],
    ['city', doc.address?.city],
    ['phone', doc.phone],
  ])
}

export function customerInfoFromBusinessCustomer(doc: BusinessCustomerDoc | null | undefined): CustomerInfo {
  if (!doc) return {}
  return compact([['email', doc.contactEmail]])
}

/** The values to propose: the Kunde's, with the Bedriftskunde's on top where it has one. */
export function mergeProposal(customer: CustomerInfo, business: CustomerInfo): CustomerInfo {
  return { ...customer, ...business }
}

export interface AutofillPlan {
  /** Fields that are empty in the form now — filled without asking. */
  fill: CustomerInfo
  /** Fields that already hold a DIFFERENT value — replaced only after confirmation. */
  conflicts: { field: CustomerInfoField; current: string; proposed: string }[]
}

export function planAutofill(current: Partial<Record<CustomerInfoField, unknown>>, proposal: CustomerInfo): AutofillPlan {
  const fill: CustomerInfo = {}
  const conflicts: AutofillPlan['conflicts'] = []
  for (const field of CUSTOMER_INFO_FIELDS) {
    const proposed = proposal[field]
    if (proposed == null) continue
    const now = text(current[field])
    if (now == null) fill[field] = proposed
    else if (now !== proposed) conflicts.push({ field, current: now, proposed })
  }
  return { fill, conflicts }
}
