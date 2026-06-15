import type { CollectionConfig } from 'payload'

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'email',
    group: 'Butikk',
    defaultColumns: ['email', 'firstName', 'lastName', 'createdAt'],
    description: 'Kunder registrert i systemet.',
  },
  access: {
  read: ({ req }) => !!req.user,
  create: () => true,
  update: ({ req }) => !!req.user,
  delete: ({ req }) => !!req.user,
},
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'E-post',
      required: true,
      unique: true,
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
      name: 'phone',
      type: 'text',
      label: 'Telefon',
    },
    {
      name: 'address',
      type: 'group',
      label: 'Adresse',
      fields: [
        {
          name: 'street',
          type: 'text',
          label: 'Gateadresse',
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
      ],
    },
    {
      name: 'orders',
      type: 'relationship',
      relationTo: 'orders',
      hasMany: true,
      label: 'Bestillinger',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      label: 'Samtykke til markedsføring',
      defaultValue: false,
    },
  ],
  timestamps: true,
}
