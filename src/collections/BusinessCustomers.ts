import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { ENV_ORGANIZATIONS_SLUG, MILJO_ADMIN_GROUP } from '@/lib/miljo/constants'
import {
  BUSINESS_CUSTOMERS_SLUG,
  BUSINESS_CUSTOMER_ACCESS_BASIS_OPTIONS,
  BUSINESS_CUSTOMER_STATUS_OPTIONS,
  MILJO_ACCOUNTS_SLUG,
} from '@/lib/miljo/business'
import { resolveAuthorizedBusinessCustomerId } from '@/lib/miljo/businessAccess'
import { adminOnly, isAdminUser } from '@/lib/security/staffAccess'
import { enforceBusinessCustomerRules, guardBusinessCustomerDelete } from './hooks/businessCustomer'

/**
 * Business customers («Bedriftskunder») — companies that may use aBoks Miljøregistrering, with a
 * permanent internal id that is independent of any single order. Stage 1 foundation: records are
 * created and managed by an administrator; the self-service registration flow comes later.
 *
 * Its orders are linked on the order (`orders.businessCustomer`, one company per order) and listed
 * here through a read-only join — one source of truth, see ./hooks/orderBusinessCustomer.
 *
 * Deliberately separate from `referred-customers` (partner referrals, which require a partner and
 * drive commission) and from `customers` (private webshop buyers). See @/lib/miljo/business.
 *
 * ── Access ──
 *
 *   • Administrators: everything (`users` collection, role admin — editors have no access, like the
 *     rest of Miljøregistrering).
 *   • A Miljø account (active, e-mail verified, its business customer «Aktiv» — re-checked on every
 *     request, see @/lib/miljo/businessAccess): reads its OWN business customer only. The filter is
 *     the id on the account, never anything the request supplies. Internal fields (orders, note)
 *     are hidden from it. It can change nothing.
 *   • Everyone else: nothing — no public listing.
 *
 * Rules on every write: see `./hooks/businessCustomer`.
 */

const adminOrOwnCustomer: Access = async ({ req }) => {
  if (isAdminUser(req.user)) return true
  const id = await resolveAuthorizedBusinessCustomerId(req)
  return id == null ? false : { id: { equals: id } }
}

const adminOnlyField: FieldAccess = ({ req }) => isAdminUser(req.user)
/** System-written (hook or trusted server code with overrideAccess); never through the API. */
const systemOnly: FieldAccess = () => false

export const BusinessCustomers: CollectionConfig = {
  slug: BUSINESS_CUSTOMERS_SLUG,
  labels: { singular: 'Bedriftskunde', plural: 'Bedriftskunder' },
  admin: {
    useAsTitle: 'name',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['name', 'organizationNumber', 'status', 'contactEmail', 'environmentalOrganization'],
    listSearchableFields: ['name', 'organizationNumber', 'contactEmail'],
    description:
      'Bedrifter som kan bruke aBoks Miljøregistrering. Ett organisasjonsnummer per bedrift. Brukerkontoer opprettes fra organisasjonen (Miljøregistrering → Organisasjoner → «Opprett brukerkonto»).',
  },
  access: {
    read: adminOrOwnCustomer,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  defaultSort: 'name',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Bedriftsnavn',
          required: true,
          maxLength: 200,
          index: true,
          admin: { width: '60%' },
          hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)] },
        },
        {
          name: 'organizationNumber',
          type: 'text',
          label: 'Organisasjonsnummer',
          required: true,
          unique: true,
          index: true,
          admin: { width: '40%', description: 'Norsk, 9 sifre. Lagres uten mellomrom.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          label: 'Status',
          required: true,
          defaultValue: 'pending',
          index: true,
          options: BUSINESS_CUSTOMER_STATUS_OPTIONS,
          admin: {
            width: '50%',
            description:
              'Bare «Aktiv» gir tilgang. «Sperret» (og «Venter») stenger alle bedriftens Miljøkontoer ved neste forespørsel – innlogging, fornyelse og data.',
          },
        },
        {
          name: 'activatedAt',
          type: 'date',
          label: 'Aktivert',
          access: { create: systemOnly, update: systemOnly },
          admin: {
            width: '50%',
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Settes automatisk første gang status blir «Aktiv».',
          },
        },
      ],
    },
    {
      name: 'accessBasis',
      type: 'select',
      label: 'Grunnlag for tilgang',
      required: true,
      defaultValue: 'purchase',
      options: BUSINESS_CUSTOMER_ACCESS_BASIS_OPTIONS,
      access: { read: adminOnlyField },
      admin: {
        description:
          '«Kjøp»: bedriften har tilgang så lenge minst én koblet ordre er bekreftet, sendt eller levert. «Avtale»: aBoks har gitt tilgang uten nettordre (f.eks. kommune eller pilot). Status må uansett være «Aktiv».',
      },
    },
    {
      type: 'collapsible',
      label: 'Kontakt',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'contactName', type: 'text', label: 'Kontaktperson', maxLength: 120, admin: { width: '50%' } },
            {
              name: 'contactEmail',
              type: 'email',
              label: 'Kontakt-e-post',
              required: true,
              index: true,
              admin: { width: '50%', description: 'Adressen eierskapet bekreftes mot.' },
            },
          ],
        },
        {
          name: 'contactEmailVerifiedAt',
          type: 'date',
          label: 'E-post bekreftet',
          access: { create: systemOnly, update: systemOnly },
          admin: {
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Settes av bekreftelsesflyten (kommer senere). Kan ikke endres manuelt.',
          },
        },
      ],
    },
    {
      // Read-only view of the ONE authoritative link, `orders.businessCustomer` (see
      // ./hooks/orderBusinessCustomer). Linked and unlinked on the order itself.
      name: 'orders',
      type: 'join',
      collection: 'orders',
      on: 'businessCustomer',
      label: 'Ordrer',
      defaultSort: '-createdAt',
      access: { read: adminOnlyField },
      admin: {
        defaultColumns: ['orderNumber', 'status', 'total', 'createdAt'],
        description:
          'AB-ordrer knyttet til bedriften. Koble en ordre ved å velge «Bedriftskunde» på ordren. Bare bekreftede, sendte og leverte ordrer gir tilgang til Miljøregistrering.',
      },
    },
    {
      name: 'environmentalOrganization',
      type: 'relationship',
      relationTo: ENV_ORGANIZATIONS_SLUG,
      label: 'Miljøorganisasjon',
      unique: true,
      index: true,
      admin: { description: 'Organisasjonen (QR-kode og statistikk) bedriften administrerer. Én bedrift per organisasjon.' },
    },
    {
      name: 'accounts',
      type: 'join',
      collection: MILJO_ACCOUNTS_SLUG,
      on: 'businessCustomer',
      label: 'Miljøkontoer',
      admin: { defaultColumns: ['email', 'fullName', 'status', 'emailVerifiedAt'] },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      label: 'Internt notat',
      access: { read: adminOnlyField },
      admin: { description: 'Vises aldri for bedriften.' },
    },
  ],
  hooks: {
    beforeChange: [enforceBusinessCustomerRules],
    beforeDelete: [guardBusinessCustomerDelete],
  },
  timestamps: true,
}
