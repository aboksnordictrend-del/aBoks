import type { CollectionConfig, TextFieldSingleValidation, Where } from 'payload'
import {
  REFERRAL_CATEGORY_DESCRIPTION,
  REFERRAL_CATEGORY_OPTIONS,
  REFERRED_CUSTOMER_STATUS_OPTIONS,
  REGISTRATION_NUMBER_MAX,
  validateCountryCode,
  validateRegistrationNumber,
} from '@/lib/partner/referral'
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE } from '@/lib/partner/countries'
import { trimText } from '@/lib/partner/address'
import { enforceReferredCustomerRules, guardReferredCustomerDelete } from './hooks/referredCustomer'

/**
 * Referred customers (`Henviste kunder`) — a company or a PHYSICAL store that a regular partner
 * introduced to ABOKS AS, recorded by hand by an administrator.
 *
 * ── What this is, and what it is not ──
 *
 *   • Bedriftssalg — a company, institution or other business customer.
 *   • Forhandlersalg — a physical brick-and-mortar store, ONLY. An online store is a partner of
 *     its own («Nettbutikk / Forhandler») and is never recorded here; nothing here creates or
 *     changes a partner record.
 *
 * The customer is the anchor for its manually registered sales (`referral-sales`, listed below as «Salg»),
 * where the commission is calculated. Nothing on this record is money.
 *
 * ── Rules (see `./hooks/referredCustomer`) ──
 *
 * Only an ACTIVE, REGULAR partner can be assigned. Partner and category can be corrected until the
 * first sale exists, then they are locked. The same company or store cannot be open (pending or
 * approved) twice: the same registration number is refused outright, the same name needs an
 * explicit «Bekreft: ikke duplikat» with a reason, tied to that exact name and registration. Moving a customer to another partner is
 * never a silent edit once sales exist: the old record is set to «Inaktiv» and a new one created.
 *
 * Version history is kept for every change, for audit.
 */

/** Non-empty after trimming. */
const validateName: TextFieldSingleValidation = (value) =>
  typeof value === 'string' && value.trim() !== '' ? true : 'Kundenavn / firmanavn må fylles ut.'

export const ReferredCustomers: CollectionConfig = {
  slug: 'referred-customers',
  labels: {
    singular: 'Henvist kunde',
    plural: 'Henviste kunder',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Partnere',
    defaultColumns: ['name', 'category', 'partner', 'status', 'referralDate'],
    listSearchableFields: ['name', 'organizationNumber', 'contactPerson', 'email'],
    description:
      'Bedrifter og fysiske butikker som en vanlig partner har henvist. Registreres manuelt av ABOKS AS. Nettbutikker registreres som partner, ikke her.',
  },
  access: {
    // Admin-only in every direction, like the partner data it belongs to.
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    // Ending a referral is «Inaktiv»; deleting is an admin decision, and refused once sales exist.
    delete: ({ req }) => req.user?.role === 'admin',
  },
  defaultSort: '-referralDate',
  versions: { drafts: false, maxPerDoc: 100 },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Kundenavn / firmanavn',
          required: true,
          index: true,
          admin: { width: '50%' },
          hooks: { beforeValidate: [({ value }) => trimText(value)] },
          validate: validateName,
        },
        {
          name: 'status',
          type: 'select',
          label: 'Status',
          required: true,
          defaultValue: 'pending',
          index: true,
          options: REFERRED_CUSTOMER_STATUS_OPTIONS,
          admin: {
            width: '50%',
            description: 'Kun godkjente kunder kan få registrert salg. Sett til «Inaktiv» når henvisningsavtalen opphører.',
          },
        },
      ],
    },
    {
      name: 'category',
      type: 'radio',
      label: 'Kategori',
      required: true,
      index: true,
      options: REFERRAL_CATEGORY_OPTIONS,
      admin: {
        layout: 'horizontal',
        description: `${REFERRAL_CATEGORY_DESCRIPTION} Kan endres til første salg er registrert.`,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'partner',
          type: 'relationship',
          relationTo: 'partners',
          label: 'Partner',
          required: true,
          index: true,
          // Convenience only — `enforceReferredCustomerRules` is the authority. The current value
          // is kept selectable so a record whose partner was later paused stays editable.
          filterOptions: ({ data }) => {
            const eligible: Where = { and: [{ partnerType: { equals: 'regular' } }, { status: { equals: 'active' } }] }
            const current = (data as { partner?: unknown } | undefined)?.partner
            const currentId = current && typeof current === 'object' ? (current as { id?: unknown }).id : current
            return typeof currentId === 'number' || typeof currentId === 'string'
              ? { or: [eligible, { id: { equals: currentId } }] }
              : eligible
          },
          admin: {
            width: '50%',
            description: 'Kun aktive vanlige partnere. Kan endres til første salg er registrert.',
          },
        },
        {
          name: 'referralDate',
          type: 'date',
          label: 'Henvist dato',
          required: true,
          index: true,
          defaultValue: () => new Date().toISOString(),
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Registrering',
      fields: [
        {
          type: 'row',
          fields: [
            {
              // ISO 3166-1 alpha-2, picked from a searchable list showing Norwegian names, so
              // alternative spellings cannot split one country in two for duplicate detection.
              name: 'country',
              type: 'select',
              label: 'Land',
              required: true,
              defaultValue: DEFAULT_COUNTRY_CODE,
              options: COUNTRY_OPTIONS,
              admin: {
                width: '33%',
                isClearable: false,
                description: 'Norge gir streng kontroll av organisasjonsnummeret.',
              },
              validate: (value: unknown) => validateCountryCode(value),
            },
            {
              name: 'organizationNumber',
              type: 'text',
              label: 'Organisasjonsnummer / registreringsnummer',
              admin: {
                width: '67%',
                description: `Valgfritt, men brukes til å oppdage duplikater. Norsk: 9 sifre. Utenlandsk: slik det er registrert (maks ${REGISTRATION_NUMBER_MAX} tegn).`,
              },
              hooks: { beforeValidate: [({ value }) => trimText(value)] },
              validate: (value: unknown, { data }: { data?: unknown }) =>
                validateRegistrationNumber(value, (data as { country?: unknown } | undefined)?.country),
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Kontaktinformasjon',
      fields: [
        {
          name: 'contactPerson',
          type: 'text',
          label: 'Kontaktperson',
          hooks: { beforeValidate: [({ value }) => trimText(value)] },
        },
        {
          type: 'row',
          fields: [
            { name: 'email', type: 'email', label: 'E-post', admin: { width: '50%' } },
            {
              name: 'phone',
              type: 'text',
              label: 'Telefon',
              admin: { width: '50%' },
              hooks: { beforeValidate: [({ value }) => trimText(value)] },
            },
          ],
        },
      ],
    },
    {
      // Needed only when a customer with the same name is already open. The error appears here.
      type: 'collapsible',
      label: 'Duplikatkontroll',
      admin: { initCollapsed: true },
      fields: [
        {
          // An action for one save, never stored as ticked — see `enforceReferredCustomerRules`.
          name: 'duplicateConfirmed',
          type: 'checkbox',
          label: 'Bekreft: ikke duplikat',
          defaultValue: false,
          admin: {
            description:
              'Kryss av bare når lagringen stoppes fordi en annen kunde har samme navn, og du har kontrollert at det er en annen kunde. Bekreftelsen gjelder dette navnet og registreringsnummeret – endres de, må du bekrefte på nytt.',
          },
        },
        {
          name: 'duplicateReason',
          type: 'textarea',
          label: 'Begrunnelse',
          admin: {
            condition: (data) => {
              const d = data as { duplicateConfirmed?: unknown; duplicateReason?: unknown } | undefined
              return d?.duplicateConfirmed === true || (typeof d?.duplicateReason === 'string' && d.duplicateReason !== '')
            },
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'duplicateConfirmedAt',
              type: 'date',
              label: 'Bekreftet',
              admin: {
                width: '50%',
                readOnly: true,
                date: { pickerAppearance: 'dayAndTime' },
                condition: (data) => Boolean((data as { duplicateConfirmedAt?: unknown } | undefined)?.duplicateConfirmedAt),
              },
            },
            {
              name: 'duplicateConfirmedBy',
              type: 'relationship',
              relationTo: 'users',
              label: 'Bekreftet av',
              admin: {
                width: '50%',
                readOnly: true,
                condition: (data) => Boolean((data as { duplicateConfirmedAt?: unknown } | undefined)?.duplicateConfirmedAt),
              },
            },
          ],
        },
      ],
    },
    {
      // Every registered purchase. «Legg til» creates a sale with this customer filled in; a
      // physical store can have any number of them.
      name: 'sales',
      type: 'join',
      collection: 'referral-sales',
      on: 'referredCustomer',
      label: 'Salg',
      defaultSort: '-saleDate',
      admin: {
        defaultColumns: ['saleDate', 'externalReference', 'invoicedTotal', 'commissionAmount', 'paymentStatus', 'commissionStatus'],
        description: 'Registrerte kjøp. Salg kan bare registreres når kunden er «Godkjent».',
      },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      label: 'Internt notat',
      admin: { description: 'Avtalevilkår, historikk o.l. Vises aldri for partneren eller kunden.' },
    },
    // ── Derived (hidden) ──
    //
    // Recomputed on every save by `enforceReferredCustomerRules`; never trusted from a client.
    {
      name: 'registrationKey',
      type: 'text',
      index: true,
      admin: { hidden: true },
    },
    {
      name: 'nameKey',
      type: 'text',
      index: true,
      admin: { hidden: true },
    },
    {
      // `<nameKey>|<registrationKey>` the duplicate-name confirmation was given for.
      name: 'duplicateConfirmedFor',
      type: 'text',
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeChange: [enforceReferredCustomerRules],
    beforeDelete: [guardReferredCustomerDelete],
  },
  timestamps: true,
}
