import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { MILJO_REGISTRATIONS_SLUG } from '@/lib/miljo/registration/constants'

/**
 * An order that a Miljøregistrering self-registration was verified with cannot be deleted.
 *
 * The database already refuses it — `miljo_registrations.order_id` is ON DELETE RESTRICT (migration
 * 20261103_180000), because the registration is the record of how a company was activated. This
 * hook answers first, with a Norwegian message (HTTP 409), instead of the raw foreign-key error.
 * Any registration counts, whatever its status: a pending one still refers to the order, and a
 * confirmed one is history.
 */

export const ORDER_USED_FOR_REGISTRATION_MESSAGE =
  'Ordren kan ikke slettes fordi den er brukt til å bekrefte en registrering i aBoks Miljøregistrering. Sett status til «Kansellert» i stedet.'

export const guardOrderDeleteForMiljoRegistration: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const registrations = await req.payload.count({
    collection: MILJO_REGISTRATIONS_SLUG,
    where: { order: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (registrations.totalDocs > 0) throw new APIError(ORDER_USED_FOR_REGISTRATION_MESSAGE, 409, undefined, true)
}
