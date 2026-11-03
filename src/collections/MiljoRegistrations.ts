import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { ENV_ORGANIZATIONS_SLUG, MILJO_ADMIN_GROUP } from '@/lib/miljo/constants'
import { BUSINESS_CUSTOMERS_SLUG, MILJO_ACCOUNTS_SLUG } from '@/lib/miljo/business'
import { MILJO_REGISTRATIONS_SLUG, REGISTRATION_STATUS_OPTIONS } from '@/lib/miljo/registration/constants'
import { adminOnly } from '@/lib/security/staffAccess'

/**
 * Self-registrations for Miljøregistrering Bedrift («Selvregistreringer») — Stage 2.2a.
 *
 * One row per submitted registration, from the verified purchase until the e-mail link is used:
 * the order it was verified with, the company (number + OFFICIAL name from Enhetsregisteret), the
 * contact person, the login e-mail, and the secrets needed to finish — a Payload-compatible
 * password hash and the SHA-256 hashes of the confirmation token and the resend key. Nothing
 * secret is ever stored in clear, and those fields are closed to every API, administrators
 * included.
 *
 * Written ONLY by the registration service (@/lib/miljo/registration/service) through the Local
 * API — create/update/delete are closed to every request. Administrators may read it (support).
 *
 * The database allows at most one «Venter» registration per order (partial unique index); a new
 * attempt for the same order supersedes the previous one in the same transaction.
 */

const never: Access = () => false
const neverField: FieldAccess = () => false
const secret = { access: { read: neverField, create: neverField, update: neverField }, admin: { hidden: true } } as const

export const MiljoRegistrations: CollectionConfig = {
  slug: MILJO_REGISTRATIONS_SLUG,
  labels: { singular: 'Selvregistrering', plural: 'Selvregistreringer' },
  admin: {
    useAsTitle: 'officialName',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['officialName', 'organizationNumber', 'status', 'loginEmail', 'orderNumber', 'createdAt'],
    listSearchableFields: ['officialName', 'organizationNumber', 'loginEmail', 'orderNumber'],
    description: 'Registreringer bedrifter har gjort selv. Opprettes og oppdateres bare av registreringsflyten.',
  },
  access: { read: adminOnly, create: never, update: never, delete: never },
  defaultSort: '-createdAt',
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'status', type: 'select', required: true, defaultValue: 'pending', index: true, options: REGISTRATION_STATUS_OPTIONS, admin: { width: '34%', readOnly: true } },
        { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true, label: 'Ordre', admin: { width: '33%', readOnly: true } },
        { name: 'orderNumber', type: 'text', label: 'Ordrenummer', admin: { width: '33%', readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'organizationNumber', type: 'text', required: true, index: true, label: 'Organisasjonsnummer', admin: { width: '34%', readOnly: true } },
        { name: 'officialName', type: 'text', required: true, label: 'Navn (Enhetsregisteret)', admin: { width: '66%', readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'contactName', type: 'text', required: true, label: 'Kontaktperson', admin: { width: '50%', readOnly: true } },
        { name: 'loginEmail', type: 'email', required: true, index: true, label: 'E-post for innlogging', admin: { width: '50%', readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'tokenExpiresAt', type: 'date', label: 'Lenken utløper', admin: { width: '34%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'sendCount', type: 'number', defaultValue: 0, label: 'Sendt (antall)', admin: { width: '33%', readOnly: true } },
        { name: 'lastSentAt', type: 'date', label: 'Sist sendt', admin: { width: '33%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Resultat',
      fields: [
        { name: 'confirmedAt', type: 'date', label: 'Bekreftet', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        {
          type: 'row',
          fields: [
            { name: 'businessCustomer', type: 'relationship', relationTo: BUSINESS_CUSTOMERS_SLUG, label: 'Bedriftskunde', admin: { width: '34%', readOnly: true } },
            { name: 'account', type: 'relationship', relationTo: MILJO_ACCOUNTS_SLUG, label: 'Miljøkonto', admin: { width: '33%', readOnly: true } },
            { name: 'environmentalOrganization', type: 'relationship', relationTo: ENV_ORGANIZATIONS_SLUG, label: 'Miljøorganisasjon', admin: { width: '33%', readOnly: true } },
          ],
        },
      ],
    },
    // ── Secrets: hashes only, closed to every API ──
    { name: 'passwordSalt', type: 'text', ...secret },
    { name: 'passwordHash', type: 'text', ...secret },
    { name: 'tokenHash', type: 'text', unique: true, index: true, ...secret },
    { name: 'resendKeyHash', type: 'text', unique: true, index: true, ...secret },
  ],
  timestamps: true,
}
