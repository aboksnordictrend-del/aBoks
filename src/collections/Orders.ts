import type { CollectionConfig } from 'payload'
import { claimOrderEmails, sendOrderEmails } from './hooks/sendOrderEmails'
import { snapshotOrderCosts } from './hooks/orderSnapshot'
import { resendShippingEmail } from './endpoints/resendShippingEmail'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Butikk',
    defaultColumns: ['orderNumber', 'customer', 'total', 'status', 'createdAt'],
    description: 'Alle bestillinger fra nettbutikken.',
  },
  access: {
  read: ({ req }) => !!req.user,
  create: () => true,
  update: ({ req }) => !!req.user,
  delete: ({ req }) => !!req.user,
},
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      label: 'Ordrenummer',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'kustomOrderId',
      type: 'text',
      label: 'Kustom Order ID',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: 'Kunde',
    },
    {
      name: 'customerInfo',
      type: 'group',
      label: 'Kundeinformasjon',
      fields: [
        {
          name: 'email',
          type: 'email',
          label: 'E-post',
        },
        {
          name: 'firstName',
          type: 'text',
          label: 'Fornavn',
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Etternavn',
        },
        {
          name: 'address',
          type: 'text',
          label: 'Adresse',
        },
        {
          name: 'postalCode',
          type: 'text',
          label: 'Postnummer',
        },
        {
          name: 'city',
          type: 'text',
          label: 'Sted',
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Telefon',
        },
      ],
    },
    {
      name: 'items',
      type: 'array',
      label: 'Produkter',
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          label: 'Produkt',
        },
        {
          name: 'variant',
          type: 'relationship',
          relationTo: 'product-variants',
          label: 'Variant',
        },
        {
          name: 'variantName',
          type: 'text',
          label: 'Fargenavn',
        },
        {
          name: 'quantity',
          type: 'number',
          label: 'Antall',
          required: true,
          min: 1,
        },
        {
          name: 'unitPrice',
          type: 'number',
          label: 'Enhetspris (kr)',
          required: true,
        },
        {
          name: 'lineTotal',
          type: 'number',
          label: 'Linjesum (kr)',
          required: true,
        },
        // --- Historical financial snapshot (written server-side on order creation) ---
        // unitCost / vatRate are captured once at creation so later changes to a product's
        // Kostpris or the VAT rate never rewrite historical analytics. unitCost stays
        // editable so an admin can correct a mistake on a specific order line.
        {
          name: 'unitCost',
          type: 'number',
          label: 'Historisk kostpris per enhet',
          min: 0,
          admin: {
            description:
              'Kostpris per enhet på bestillingstidspunktet (uten MVA). Fylles automatisk fra produkt/variant. Kan rettes manuelt.',
          },
        },
        {
          name: 'vatRate',
          type: 'number',
          label: 'MVA-sats (%)',
          min: 0,
          admin: {
            description: 'MVA-sats lagret da ordren ble opprettet. Brukes til å regne omsetning uten MVA.',
          },
        },
        {
          name: 'lineCost',
          type: 'number',
          label: 'Linjekostnad',
          admin: {
            readOnly: true,
            description: 'Beregnes automatisk: kostpris × antall.',
          },
        },
        {
          name: 'lineProfit',
          type: 'number',
          label: 'Linjefortjeneste',
          admin: {
            readOnly: true,
            description: 'Beregnes automatisk: linjesum uten MVA − linjekostnad.',
          },
        },
      ],
    },
    {
      name: 'subtotal',
      type: 'number',
      label: 'Delsum (kr)',
      required: true,
    },
    {
      name: 'shipping',
      type: 'number',
      label: 'Frakt (kr)',
      defaultValue: 0,
    },
    {
      name: 'total',
      type: 'number',
      label: 'Totalt (kr)',
      required: true,
    },
    // --- Variable-cost fields, filled in manually by an admin after fulfilment ---
    // All optional; the dashboard treats a missing value as 0 and keeps working.
    {
      name: 'actualShippingCost',
      type: 'number',
      label: 'Faktisk fraktkostnad (kr)',
      min: 0,
      admin: {
        description: 'Bedriftens reelle fraktkostnad for denne ordren. Kan skille seg fra frakten kunden betalte.',
      },
    },
    {
      name: 'paymentFee',
      type: 'number',
      label: 'Betalingsgebyr (kr)',
      min: 0,
      admin: {
        description: 'Gebyr til betalingsleverandøren for denne ordren.',
      },
    },
    {
      name: 'extraCosts',
      type: 'number',
      label: 'Ekstra variable kostnader (kr)',
      min: 0,
      admin: {
        description: 'Andre variable kostnader knyttet til ordren (emballasje, retur o.l.).',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Venter', value: 'pending' },
        { label: 'Bekreftet', value: 'confirmed' },
        { label: 'Sendt', value: 'shipped' },
        { label: 'Levert', value: 'delivered' },
        { label: 'Kansellert', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: 'Betalt dato',
      admin: {
        position: 'sidebar',
        description: 'Settes automatisk når betalingen bekreftes. Brukes som salgsdato i analysen.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notater',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'resendShippingEmail',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/ResendShippingEmail#default',
        },
      },
    },
    // Email sentinels. Written by the order-email hooks as an atomic claim in the
    // same UPDATE as the status change — that is what keeps sends idempotent.
    // Hidden in the admin UI, but plain columns in the database.
    {
      name: 'confirmationEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'adminEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'shippedEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'shippedEmailMessageId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'shippedEmailError',
      type: 'textarea',
      admin: { hidden: true },
    },
    // Receipt (Kvittering) email, sent once on the transition into 'delivered'.
    // receiptEmailSentAt is the idempotency sentinel — set atomically with the status
    // change, cleared again only if the send fails, so it is safe to keep read-only.
    {
      name: 'receiptEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'receiptEmailMessageId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'receiptEmailError',
      type: 'textarea',
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeChange: [claimOrderEmails, snapshotOrderCosts],
    afterChange: [sendOrderEmails],
  },
  endpoints: [resendShippingEmail],
  timestamps: true,
}
