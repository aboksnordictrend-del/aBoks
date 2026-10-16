import { APIError, type CollectionAfterChangeHook, type CollectionBeforeDeleteHook } from 'payload'

/**
 * Integrity of the links INTO a partner: promo codes (`promo-codes.partner`) and payouts
 * (`partner-payouts.partner`). The partner itself never writes commission or money; these
 * hooks only keep the links meaningful.
 */

export const PARTNER_IN_USE_MESSAGE =
  'Partneren kan ikke slettes fordi rabattkoder eller utbetalinger er knyttet til den. Sett status til «Avsluttet» i stedet.'

/**
 * Refuses to delete a partner that anchors promo codes or payouts.
 *
 * The database alone would not stop it — both links are ON DELETE SET NULL, as Payload generates
 * them — and that would silently detach accounting history from its partner. An ended agreement
 * is recorded with the status «Avsluttet» instead.
 */
export const guardPartnerDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const [codes, payouts] = await Promise.all([
    req.payload.count({
      collection: 'promo-codes',
      where: { partner: { equals: id } },
      overrideAccess: true,
      req,
    }),
    req.payload.count({
      collection: 'partner-payouts',
      where: { partner: { equals: id } },
      overrideAccess: true,
      req,
    }),
  ])

  if (codes.totalDocs > 0 || payouts.totalDocs > 0) throw new APIError(PARTNER_IN_USE_MESSAGE, 409)
}

/**
 * Pushes a renamed partner to the `partnerName` copy on its promo codes.
 *
 * Written through the database adapter, not `payload.update`: `partnerName` is a denormalised
 * copy, and re-running the full promo-code validation for it could refuse the rename over an
 * unrelated legacy setting on some code. Nothing historical changes — usage rows and payouts keep
 * the name they snapshotted. It runs on the request's transaction, so a failure here rolls the
 * rename back with it rather than leaving the two out of step.
 */
export const propagatePartnerName: CollectionAfterChangeHook = async ({
  operation,
  doc,
  previousDoc,
  req,
}) => {
  if (operation !== 'update') return doc
  const name = typeof doc?.name === 'string' ? doc.name.trim() : ''
  if (!name || name === previousDoc?.name) return doc

  await req.payload.db.updateMany({
    collection: 'promo-codes',
    where: { partner: { equals: doc.id } },
    data: { partnerName: name },
    req,
    returning: false,
  })
  return doc
}
