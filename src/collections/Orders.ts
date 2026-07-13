import type { CollectionConfig } from 'payload'
import { claimOrderEmails, sendOrderEmails } from './hooks/sendOrderEmails'
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
  ],
  hooks: {
    beforeChange: [claimOrderEmails],
    afterChange: [sendOrderEmails],
  },
  endpoints: [resendShippingEmail],
  timestamps: true,
}
