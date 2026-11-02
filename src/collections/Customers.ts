import type { CollectionConfig, FieldHook } from 'payload'
import { staffOnly } from '@/lib/security/staffAccess'

/**
 * Builds the customer's title from "Fornavn Etternavn", trimmed, and falls back to the
 * email when no name is stored. Runs on every write, so it also fills in for the
 * customer-sync (webhook + backfill) which goes through payload.create/update.
 *
 * On a partial update the incoming `siblingData` may not carry every name field, so each
 * value falls back to the already-stored `originalDoc` before being recomputed.
 */
const buildDisplayName: FieldHook = ({ siblingData, originalDoc }) => {
  const pick = (key: 'firstName' | 'lastName' | 'email') => {
    const incoming = (siblingData as Record<string, unknown> | undefined)?.[key]
    const value = incoming !== undefined ? incoming : originalDoc?.[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  const fullName = [pick('firstName'), pick('lastName')].filter(Boolean).join(' ')
  return fullName || pick('email') || undefined
}

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'displayName',
    group: 'Butikk',
    defaultColumns: ['displayName', 'email', 'firstName', 'lastName', 'createdAt'],
    description: 'Kunder registrert i systemet.',
  },
  // Staff only in every direction. The customer sync (`@/lib/customers`, from the Kustom webhook
  // and the backfill) writes through the Local API with `overrideAccess: true`.
  access: {
  read: staffOnly,
  create: staffOnly,
  update: staffOnly,
  delete: staffOnly,
},
  fields: [
    {
      name: 'displayName',
      type: 'text',
      label: 'Navn',
      admin: {
        readOnly: true,
        description: 'Genereres automatisk fra fornavn og etternavn (e-post som reserve).',
      },
      hooks: {
        beforeChange: [buildDisplayName],
      },
    },
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
