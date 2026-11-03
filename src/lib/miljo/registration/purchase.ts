// Stage 2.2a — does this order entitle its buyer to register a company in Miljøregistrering?
// Pure: the service loads the documents, this decides.
//
//   1. the order exists and the e-mail matches the purchase e-mail (case and spaces ignored);
//   2. its status is «Bekreftet», «Sendt» or «Levert» (`confirmed` / `shipped` / `delivered` —
//      the project's only statuses; a refund is recorded by an administrator as «Kansellert»);
//   3. it contains at least one aBoks storage product — a product in the «Produkter» section
//      (`products.section = 'products'`), not only accessories (`'accessories'`);
//   4. it is not already linked to another company that has an account.
//
// Until 1 holds, every refusal is the same generic answer, so nobody can learn whether an order
// number or an e-mail exists. Once the caller has shown the order number AND its e-mail, the
// specific reason is safe to show — they own the order.

import { isEligibleOrderStatus, relationshipId } from '@/lib/miljo/business'

export const AB_ORDER_NUMBER = /^AB-\d{6}$/

/** «ab 037697», «AB037697», « AB-037697 » → «AB-037697»; anything else is returned trimmed. */
export function normalizeOrderNumber(value: unknown): string {
  if (typeof value !== 'string') return ''
  const compact = value.trim().toUpperCase().replace(/\s+/g, '')
  const m = /^AB-?(\d{6})$/.exec(compact)
  return m ? `AB-${m[1]}` : compact
}

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export const AB_PRODUCT_SECTION = 'products'

export interface PurchaseOrder {
  id: number | string
  status?: unknown
  customerInfo?: { email?: unknown } | null
  items?: { product?: unknown; variant?: unknown }[] | null
  businessCustomer?: unknown
}

export type PurchaseDecision =
  | { ok: true }
  | {
      ok: false
      /** Shown only once the order number and e-mail matched. */
      reason: 'not_found' | 'not_eligible_status' | 'no_aboks_product' | 'linked_elsewhere'
    }

/**
 * @param productSections section of every product on the order, by product id
 * @param linkedCustomerHasAccount whether the business customer the order is linked to (if any)
 *   already has a Miljø account
 */
export function decidePurchase(args: {
  order: PurchaseOrder | null
  email: string
  productSections: Map<string, unknown>
  linkedCustomerHasAccount: boolean
}): PurchaseDecision {
  const { order, email, productSections, linkedCustomerHasAccount } = args
  const buyer = normalizeEmail(order?.customerInfo?.email)
  if (!order || buyer === '' || buyer !== normalizeEmail(email)) return { ok: false, reason: 'not_found' }
  if (!isEligibleOrderStatus(order.status)) return { ok: false, reason: 'not_eligible_status' }
  const hasAboks = (order.items ?? []).some((line) => {
    const id = relationshipId(line.product)
    return id != null && productSections.get(String(id)) === AB_PRODUCT_SECTION
  })
  if (!hasAboks) return { ok: false, reason: 'no_aboks_product' }
  if (relationshipId(order.businessCustomer) != null && linkedCustomerHasAccount) return { ok: false, reason: 'linked_elsewhere' }
  return { ok: true }
}

export const PURCHASE_MESSAGES: Record<Exclude<PurchaseDecision, { ok: true }>['reason'], string> = {
  not_found: 'Vi kunne ikke bekrefte kjøpet. Kontroller ordrenummeret og e-postadressen du brukte ved bestillingen.',
  not_eligible_status:
    'Ordren er ikke bekreftet ennå, eller den er kansellert. Registreringen kan gjøres når ordren er bekreftet.',
  no_aboks_product: 'Ordren inneholder ingen aBoks-oppbevaringsløsning. Registreringen krever kjøp av en aBoks-modell.',
  linked_elsewhere:
    'Ordren er allerede knyttet til en organisasjon som er registrert i Miljøregistrering. Logg inn med organisasjonens konto, eller kontakt aBoks.',
}
