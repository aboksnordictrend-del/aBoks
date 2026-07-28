import type { CollectionConfig } from 'payload'
import { PROMO_CURRENCY } from '@/lib/promo/constants'
import { COMMISSION_BASE_OPTIONS, COMMISSION_SCOPE_DESCRIPTION } from '@/lib/partner/constants'

/**
 * Successful promo-code uses (`Bruk av promokoder`) — the source of truth for whether a code
 * has been consumed, and by whom.
 *
 * One row is written only after a payment has been confirmed through the Kustom flow;
 * opening checkout never creates one. Every value is a snapshot taken at that moment, so a
 * usage record stays historically correct even if the promo code is later edited, disabled
 * or deleted (the relationship is ON DELETE SET NULL — the row survives, the link does not).
 *
 * Never created or edited by hand: the two key columns below have to be derived exactly, and
 * a hand-typed one would either block a legitimate use or wave through a duplicate. The
 * server writes these rows with `overrideAccess`, which bypasses the closed create/update
 * access below.
 */
export const PromoCodeUsages: CollectionConfig = {
  slug: 'promo-code-usages',
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Butikk',
    defaultColumns: ['orderNumber', 'promoCode', 'email', 'discountAmount', 'usedAt'],
    listSearchableFields: ['orderNumber', 'email'],
    description: 'Registrerte, betalte bruk av rabattkoder. Skrives automatisk.',
  },
  access: {
    // Nothing public, in any direction.
    read: ({ req }) => !!req.user,
    // System-written only (see the file header). Server writes use overrideAccess.
    create: () => false,
    update: () => false,
    // An admin may still remove a record — e.g. after refunding an order.
    delete: ({ req }) => !!req.user,
  },
  defaultSort: '-usedAt',
  fields: [
    {
      name: 'promoCode',
      type: 'relationship',
      relationTo: 'promo-codes',
      label: 'Rabattkode',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      label: 'Ordre',
      index: true,
      admin: { readOnly: true },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'orderNumber',
          type: 'text',
          label: 'Ordrenummer',
          index: true,
          admin: { width: '50%', readOnly: true },
        },
        {
          name: 'email',
          type: 'text',
          label: 'E-post (normalisert)',
          index: true,
          admin: {
            width: '50%',
            readOnly: true,
            description: 'Alltid små bokstaver — grunnlaget for «én gang per kunde».',
          },
        },
      ],
    },
    {
      // The frozen financial picture of the order this code was used on.
      //
      // Written once, by the usage writer, from the promo snapshot that was cross-checked
      // against the amounts Kustom actually charged. Nothing here is ever recomputed: editing
      // the promo code, renaming the partner, changing the rate or cancelling the order leaves
      // every value below exactly as it was at the moment the payment was confirmed.
      //
      // Rows written before this section existed carry NULL in the new fields. They are not
      // backfilled — see the file header — because the amounts could only be guessed.
      type: 'collapsible',
      label: 'Økonomisk øyeblikksbilde',
      admin: {
        description:
          'Frosset da betalingen ble bekreftet. Endres aldri, heller ikke om rabattkoden redigeres senere. Tomme felter betyr en eldre registrering uten beløpsdata.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'orderAmountBeforeDiscount',
              type: 'number',
              label: 'Varesum før rabatt',
              admin: {
                width: '50%',
                readOnly: true,
                description: 'Varer inkl. MVA, uten frakt.',
              },
            },
            {
              name: 'discountAmount',
              type: 'number',
              label: 'Rabattbeløp',
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'orderAmountAfterDiscount',
              type: 'number',
              label: 'Varesum etter rabatt',
              admin: {
                width: '50%',
                readOnly: true,
                description: 'Varesum før rabatt minus rabatten. Fortsatt uten frakt.',
              },
            },
            {
              name: 'shippingAmount',
              type: 'number',
              label: 'Frakt',
              admin: {
                width: '50%',
                readOnly: true,
                description: 'Kun for regnskap og rapportering. Inngår aldri i provisjonen.',
              },
            },
          ],
        },
        {
          name: 'currency',
          type: 'text',
          label: 'Valuta',
          defaultValue: PROMO_CURRENCY,
          admin: { readOnly: true },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'isPartnerUsage',
              type: 'checkbox',
              label: 'Partnerkode',
              admin: {
                width: '50%',
                readOnly: true,
                description: 'Var koden en partnerkode da bruken ble registrert?',
              },
            },
            {
              name: 'partnerNameSnapshot',
              type: 'text',
              label: 'Partner / eier',
              admin: {
                width: '50%',
                readOnly: true,
                description: 'Navnet slik det var på betalingstidspunktet.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'commissionRateSnapshot',
              type: 'number',
              label: 'Provisjonssats (%)',
              admin: {
                width: '50%',
                readOnly: true,
                description: 'Satsen som faktisk ble brukt. 0 for vanlige rabattkoder.',
              },
            },
            {
              name: 'commissionBaseSnapshot',
              type: 'select',
              label: 'Beregnet fra',
              options: COMMISSION_BASE_OPTIONS,
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
        {
          name: 'commissionAmount',
          type: 'number',
          label: 'Provisjon',
          admin: {
            readOnly: true,
            description: COMMISSION_SCOPE_DESCRIPTION,
          },
        },
      ],
    },
    {
      name: 'usedAt',
      type: 'date',
      label: 'Registrert',
      index: true,
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Tidspunktet betalingen ble bekreftet.',
      },
    },
    {
      name: 'kustomOrderId',
      type: 'text',
      label: 'Kustom Order ID',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'collapsible',
      label: 'Tekniske nøkler',
      admin: {
        initCollapsed: true,
        description:
          'Databasenøkler som hindrer dobbeltregistrering. Genereres automatisk og skal ikke endres.',
      },
      fields: [
        {
          // UNIQUE. `order:<promoCodeId>:<orderId>` — a replayed Kustom webhook cannot
          // register the same code twice for the same order.
          name: 'orderKey',
          type: 'text',
          label: 'Ordrenøkkel',
          unique: true,
          index: true,
          admin: { readOnly: true },
        },
        {
          // UNIQUE, nullable. `global:<id>` for a one-time code, `email:<id>:<email>` for a
          // once-per-customer code, NULL otherwise — see usageUniquenessKey().
          name: 'uniquenessKey',
          type: 'text',
          label: 'Begrensningsnøkkel',
          unique: true,
          index: true,
          admin: { readOnly: true },
        },
      ],
    },
  ],
  timestamps: true,
}
