import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { ENV_ORGANIZATIONS_SLUG, MILJO_ADMIN_GROUP } from '@/lib/miljo/constants'
import { BUSINESS_CUSTOMERS_SLUG, MILJO_ACCOUNTS_SLUG } from '@/lib/miljo/business'
import { MILJO_REGISTRATIONS_SLUG, REGISTRATION_STATUS_OPTIONS, VERIFICATION_METHOD_OPTIONS } from '@/lib/miljo/registration/constants'
import { adminOnly } from '@/lib/security/staffAccess'
import { miljoRegistrationApprovalEndpoints } from './endpoints/miljoRegistrationApproval'

/**
 * Self-registrations for Miljøregistrering Bedrift («Selvregistreringer») — Stage 2.2a, with
 * administrator approval since Stage 2.6.
 *
 * One row per submitted registration, from the verified purchase until an administrator has decided:
 * the order it was verified with, the company (number + OFFICIAL name from Enhetsregisteret), the
 * contact person, the login e-mail, and the secrets needed to finish — a Payload-compatible password
 * hash and the SHA-256 hashes of the confirmation token and the resend key. Nothing secret is ever
 * stored in clear, and those fields are closed to every API, administrators included.
 *
 * Written ONLY by the registration service (@/lib/miljo/registration/service and ./approval) through
 * the Local API — create/update/delete are closed to every request, so a status can never be edited
 * by hand. Administrators read it here and decide through the review panel, which calls the
 * administrator-only endpoints in ./endpoints/miljoRegistrationApproval. Every step is recorded in
 * the append-only «miljo-registration-audit» history.
 *
 * The database allows at most one open registration per order (partial unique index); a new attempt
 * supersedes an unconfirmed one in the same transaction, and is refused while one awaits approval.
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
    defaultColumns: ['officialName', 'organizationNumber', 'status', 'orderNumber', 'contactName', 'loginEmail', 'confirmedAt', 'createdAt'],
    listSearchableFields: ['officialName', 'organizationNumber', 'loginEmail', 'orderNumber', 'orderEmail'],
    description: 'Registreringer bedrifter har gjort selv. En ny organisasjon får tilgang først når en administrator har godkjent registreringen.',
    components: { beforeListTable: ['@/components/admin/miljo/RegistrationQueue#default'] },
  },
  access: { read: adminOnly, create: never, update: never, delete: never },
  endpoints: miljoRegistrationApprovalEndpoints,
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'reviewPanel',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/miljo/RegistrationReviewPanel#default' } },
    },
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
        { name: 'contactName', type: 'text', required: true, label: 'Kontaktperson', admin: { width: '34%', readOnly: true } },
        { name: 'loginEmail', type: 'email', required: true, index: true, label: 'E-post for innlogging', admin: { width: '33%', readOnly: true } },
        { name: 'orderEmail', type: 'text', label: 'E-post på ordren', admin: { width: '33%', readOnly: true, description: 'Kan tilhøre en privatperson. Beviser ikke tilknytning til organisasjonen.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'tokenExpiresAt', type: 'date', label: 'Lenken utløper', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'sendCount', type: 'number', defaultValue: 0, label: 'Sendt (antall)', admin: { width: '25%', readOnly: true } },
        { name: 'lastSentAt', type: 'date', label: 'Sist sendt', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'orderNoticeSentAt', type: 'date', label: 'Varsel til ordre-e-post sendt', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Behandling',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'confirmedAt', type: 'date', label: 'E-post bekreftet', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'decidedAt', type: 'date', label: 'Behandlet', admin: { width: '25%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'decidedBy', type: 'relationship', relationTo: 'users', label: 'Behandlet av', admin: { width: '25%', readOnly: true } },
            { name: 'decidedByLabel', type: 'text', label: 'Behandlet av (ved behandling)', admin: { width: '25%', readOnly: true } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'verificationMethod', type: 'select', label: 'Tilknytning bekreftet ved', options: VERIFICATION_METHOD_OPTIONS, admin: { width: '50%', readOnly: true } },
            { name: 'decisionEmailSentAt', type: 'date', label: 'Svar til søker sendt', admin: { width: '50%', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          ],
        },
        { name: 'decisionNote', type: 'textarea', label: 'Begrunnelse (intern)', admin: { readOnly: true } },
        // Shown and edited in the review panel at the top.
        { name: 'internalNotes', type: 'textarea', label: 'Internt notat', admin: { readOnly: true, hidden: true } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Resultat',
      fields: [
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
