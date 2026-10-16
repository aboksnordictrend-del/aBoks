import {
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type RelationshipFieldSingleValidation,
} from 'payload'
import { relationship as defaultRelationshipValidation } from 'payload/shared'

export const PARTNER_WITHOUT_PROMO_MODEL_MESSAGE =
  'Partneren kan ikke knyttes til rabattkoden fordi den ikke har samarbeidsformen «Promokode». Legg til «Promokode» på partneren først, eller velg en annen partner.'

/**
 * Validation for `promo-codes.partner`: Payload's own relationship validation, in Norwegian.
 *
 * Payload's validator is kept — it is what re-runs the field's `filterOptions` (partners with the
 * Promokode model only) on the server and checks the id exists. Its refusal is an English
 * «This field has the following invalid selections: 7». That message is replaced with one that
 * says why; every other result passes through unchanged.
 */
export const validatePartnerLink: RelationshipFieldSingleValidation = async (value, options) => {
  const result = await defaultRelationshipValidation(value, options)
  if (result === true) return true
  const invalidSelections = options.req?.t?.('validation:invalidSelections')
  if (typeof result === 'string' && invalidSelections && result.startsWith(invalidSelections)) {
    return PARTNER_WITHOUT_PROMO_MODEL_MESSAGE
  }
  return result
}

/**
 * The link between a promo code and its partner (`promo-codes.partner` → `partners`).
 *
 * ── Why `partnerName` is copied rather than replaced ──
 *
 * Everything that already works off a promo code keeps reading `partnerName` off the SAME
 * document it already loads: the paid-order usage writer (`@/lib/promo/usageRegistration`)
 * snapshots it into `promo-code-usages.partnerNameSnapshot`, the payout endpoint copies it into
 * `partner-payouts.partnerNameSnapshot`, and the list view shows it as a column. Copying the
 * selected partner's name into that field means none of those paths — checkout least of all —
 * needs a second query or a single changed line. The partner is the source; `partnerName` is
 * its denormalised copy. A rename on the partner is pushed to its codes by the `partners`
 * collection (see `propagatePartnerName` in `../Partners.ts`).
 *
 * Commission is NOT touched here. `commissionRate` and `commissionBase` stay on the promo code
 * and remain the only inputs to the commission engine.
 */

/** Relationship value → id string. Handles a raw id and a populated document. */
export const relationshipId = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

type PromoPartnerData = {
  isPartnerCode?: boolean | null
  partner?: unknown
  partnerName?: string | null
}

/**
 * Fills `partnerName` from the selected partner, before validation.
 *
 * It runs in `beforeValidate` — not `beforeChange` — because `partnerName` is validated as
 * required on a partner code, and validation runs between the two. On a partial update the
 * flag and the link are read from the stored document when the request does not carry them.
 *
 * A partner that cannot be found is left alone: Payload's own relationship validation then
 * refuses the save with a proper field error, which is the right place for that message.
 */
export const syncPartnerName: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const incoming = data as PromoPartnerData
  const stored = (originalDoc ?? {}) as PromoPartnerData

  const isPartnerCode =
    'isPartnerCode' in incoming ? incoming.isPartnerCode === true : stored.isPartnerCode === true
  if (!isPartnerCode) return data

  const partnerId = relationshipId('partner' in incoming ? incoming.partner : stored.partner)
  if (!partnerId) return data

  const partner = (await req.payload.findByID({
    collection: 'partners',
    id: partnerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as { name?: unknown } | null

  const name = typeof partner?.name === 'string' ? partner.name.trim() : ''
  if (name) incoming.partnerName = name
  return data
}

export const PARTNER_LOCKED_MESSAGE =
  'Partneren kan ikke endres eller fjernes etter at rabattkoden er brukt. Historiske kjøp, provisjon og utbetalinger hører til den opprinnelige partneren. Opprett en ny rabattkode for den nye partneren.'

/**
 * Refuses to move a used promo code to another partner, or to unlink it.
 *
 * Statistics and payouts are joined through the code, so re-pointing a code that already has
 * paid usages would silently hand that history to a different partner. Linking a code for the
 * FIRST time (no partner → a partner) stays allowed even after use: that is how an existing
 * partner code is attached to its partner record, and it attributes nothing to anyone new — the
 * usages were already that code's.
 *
 * Only a value that is present in the request AND different from the stored one is checked;
 * the admin form resubmits the whole document on every save.
 */
export const guardPartnerChange: CollectionBeforeChangeHook = async ({
  operation,
  data,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !originalDoc || !data || !('partner' in data)) return data

  const current = relationshipId((originalDoc as PromoPartnerData).partner)
  const next = relationshipId((data as PromoPartnerData).partner)
  if (current === null || current === next) return data

  const { totalDocs } = await req.payload.count({
    collection: 'promo-code-usages',
    where: { promoCode: { equals: originalDoc.id } },
    overrideAccess: true,
    req,
  })

  if (totalDocs > 0) {
    // A field error, so the admin highlights «Partner» rather than showing a bare toast.
    throw new ValidationError({
      collection: 'promo-codes',
      id: originalDoc.id,
      errors: [{ path: 'partner', message: PARTNER_LOCKED_MESSAGE }],
      req,
    })
  }
  return data
}
