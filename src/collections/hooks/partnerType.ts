import { ValidationError, type CollectionBeforeChangeHook } from 'payload'
import {
  OPTIONAL_AGREEMENTS,
  PARTNER_TYPE_LOCKED_MESSAGE,
  regularPartnerAgreementMessage,
} from '@/lib/partner/partnerships'

/**
 * The two server-side rules of `partners.partnerType`.
 *
 * ── 1. Classified once, then permanent ──
 *
 * A partner without a type (created before the field existed) may be classified once; after that
 * the type never changes. `enforcePartnerType` runs on every write — the admin, the REST API and
 * the Local API, with or without `overrideAccess` — and refuses a change to a stored type with a
 * validation error (HTTP 400 over REST). Resubmitting the same type, or an update that does not
 * carry it, passes untouched.
 *
 * Field-level access is deliberately NOT used: Payload would silently drop the field from the
 * request and answer 200, hiding the refusal. The admin shows the field read-only through
 * `PartnerTypeField` instead, which is display only.
 *
 * ── 2. A regular partner never has a retailer agreement ──
 *
 * Dropshipping and Forhandlerinnkjøp belong to online retailers. A save that would leave a
 * `regular` partner with either agreement ticked — taking the stored value for any flag the request
 * does not carry — is REFUSED with a validation error on the ticked checkbox. Nothing is changed
 * silently: no flag is cleared and no percentage is touched; the administrator unticks the
 * agreement explicitly and saves again.
 *
 * The rule lives here rather than in a field validator because Payload skips validation of fields
 * hidden by an admin condition. In the admin the agreement checkboxes stay visible while ticked (see
 * `Partners.ts`), so the error points at a field the administrator can see and fix.
 *
 * This matters for partners created before classification existed: one with a ticked agreement
 * cannot be classified as «Vanlig partner» until that agreement has been switched off.
 */

export const enforcePartnerType: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (!data) return data
  const stored = (originalDoc as { partnerType?: unknown } | undefined)?.partnerType

  if (operation === 'update' && stored && 'partnerType' in data && data.partnerType !== stored) {
    throw new ValidationError({
      collection: 'partners',
      id: (originalDoc as { id?: number | string } | undefined)?.id,
      errors: [{ path: 'partnerType', message: PARTNER_TYPE_LOCKED_MESSAGE }],
      req,
    })
  }

  const effectiveType = 'partnerType' in data ? data.partnerType : stored
  if (effectiveType === 'regular') {
    const ticked = OPTIONAL_AGREEMENTS.filter((agreement) => {
      const value = agreement.enabledField in data
        ? data[agreement.enabledField]
        : (originalDoc as Record<string, unknown> | undefined)?.[agreement.enabledField]
      return value === true
    })
    if (ticked.length > 0) {
      throw new ValidationError({
        collection: 'partners',
        id: (originalDoc as { id?: number | string } | undefined)?.id,
        errors: ticked.map((agreement) => ({
          path: agreement.enabledField,
          message: regularPartnerAgreementMessage(agreement.label),
        })),
        req,
      })
    }
  }
  return data
}
