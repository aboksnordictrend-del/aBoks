import type { CollectionConfig } from 'payload'
import { PROMO_CURRENCY } from '@/lib/promo/constants'

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
      type: 'row',
      fields: [
        {
          name: 'discountAmount',
          type: 'number',
          label: 'Rabattbeløp',
          admin: { width: '50%', readOnly: true },
        },
        {
          name: 'currency',
          type: 'text',
          label: 'Valuta',
          defaultValue: PROMO_CURRENCY,
          admin: { width: '50%', readOnly: true },
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
