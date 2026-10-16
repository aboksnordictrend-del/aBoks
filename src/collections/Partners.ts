import type {
  CheckboxField,
  CollectionConfig,
  Field,
  FieldAccess,
  NumberField,
  NumberFieldSingleValidation,
  TextFieldSingleValidation,
} from 'payload'
import {
  LEGACY_PARTNERSHIP_TYPE_OPTIONS,
  MAX_AGREEMENT_PERCENT,
  MIN_AGREEMENT_PERCENT,
  NO_STACKING_DESCRIPTION,
  OPTIONAL_AGREEMENTS,
  PARTNER_ENTITY_TYPE_OPTIONS,
  PARTNER_STATUS_OPTIONS,
  PARTNER_TYPE_DESCRIPTION,
  PARTNER_TYPE_OPTIONS,
  PARTNER_TYPE_REQUIRED_MESSAGE,
  hasTickedAgreement,
  isPartnerType,
  isAgreementEnabled,
  validateAgreementPercent,
  type OptionalAgreement,
} from '@/lib/partner/partnerships'
import {
  ADDRESS_LINE_MAX,
  CITY_MAX,
  COUNTRY_MAX,
  DEFAULT_PARTNER_COUNTRY,
  trimText,
  validateOptionalText,
  validatePostalCode,
} from '@/lib/partner/address'
import { guardPartnerDelete, propagatePartnerName } from './hooks/partnerLinks'
import { enforcePartnerType } from './hooks/partnerType'

/**
 * Partners (`Partnere`) — one document per person or company in ABOKS AS's partner programme.
 *
 * ── Two partner types, one collection ──
 *
 * `partnerType` is chosen once and is permanent (see `./hooks/partnerType`):
 *
 *   • «Vanlig partner» (`regular`) — the referral programme. Has the three standard earning methods
 *     — Promokode, Bedriftssalg and Forhandlersalg — automatically, shown as information
 *     («Standard partnerfordeler»), never selected. Never has a retailer agreement.
 *   • «Nettbutikk / Forhandler» (`retailer`) — an online store dealing directly with ABOKS AS.
 *     Only «Samarbeidsavtaler»: Dropshipping and Forhandlerinnkjøp, enabled independently.
 *
 * Partners created before the type existed are unclassified (NULL) until an administrator picks a
 * type, once. Shared fields — identity, contact, payment, notes, linked history — are the same for
 * both. See `@/lib/partner/partnerships` for the terms.
 *
 * ── What links here, and what does not change ──
 *
 *   • Promo codes point at a partner (`promo-codes.partner`, many codes per partner). The
 *     partner's name is copied into the code's existing `partnerName`, which is what checkout's
 *     usage snapshot and the payout endpoint already read. `promo-codes.commissionRate` remains
 *     the one rate the commission engine uses — a partner stores no promo-code rate at all.
 *   • Payouts record the partner the code belonged to (`partner-payouts.partner`). The balance is
 *     still calculated per promo code; nothing here sums money across codes.
 *   • No order is priced or credited from the discounts below.
 *
 * ── Legacy fields ──
 *
 * The first release had a five-option selector and editable per-partner Bedriftssalg and
 * Forhandlersalg rates. Those three fields stay in the config — hidden, and closed to writes —
 * purely so their columns and table keep matching the database and their stored values survive.
 * Nothing reads them. See `legacyField` below.
 */

/** Frozen: kept readable for history, never written again through Payload. */
const frozen: FieldAccess = () => false

/**
 * Hides a superseded field and freezes it. Its column and stored values are kept.
 *
 * Two layers, because they cover different callers: field access closes the admin and the REST
 * API, and the `beforeChange` hook — which runs even for local-API calls with `overrideAccess`
 * — puts the stored value back on every update. A new partner gets the field's default, exactly
 * as the database column would.
 */
function legacyField<T extends Field>(field: T): T {
  const name = (field as { name: string }).name
  const fallback = (field as { defaultValue?: unknown }).defaultValue ?? null
  return {
    ...field,
    access: { create: frozen, update: frozen },
    hooks: {
      beforeChange: [
        ({ operation, originalDoc }: { operation?: string; originalDoc?: Record<string, unknown> }) =>
          operation === 'update' ? (originalDoc?.[name] ?? null) : fallback,
      ],
    },
    admin: { ...(field as { admin?: object }).admin, hidden: true },
  } as T
}

/** Admin conditions: which type-specific section a partner shows. Unclassified shows neither. */
const isRegular = (data: unknown) => (data as { partnerType?: unknown } | undefined)?.partnerType === 'regular'
const isRetailer = (data: unknown) => (data as { partnerType?: unknown } | undefined)?.partnerType === 'retailer'

/**
 * The retailer agreements are shown for an online retailer — and, whatever the type, for as long as
 * an agreement is still ticked. A regular partner cannot keep one (`enforcePartnerType` refuses the
 * save), so the ticked checkbox has to stay visible for the administrator to switch it off.
 */
const showsAgreements = (data: unknown) => isRetailer(data) || hasTickedAgreement(data)

/** The checkbox that enables one retailer agreement. Online retailers only. */
function agreementCheckbox(agreement: OptionalAgreement): CheckboxField {
  return {
    name: agreement.enabledField,
    type: 'checkbox',
    label: agreement.label,
    defaultValue: false,
    index: true,
    admin: { condition: showsAgreements, description: agreement.description },
  }
}

/** The discount field for one optional agreement: shown, and required, only while it is enabled. */
function agreementPercentField(agreement: OptionalAgreement): NumberField {
  const label = `${agreement.label} – rabatt`
  const validate: NumberFieldSingleValidation = (value, { data }) =>
    validateAgreementPercent(value, { enabled: isAgreementEnabled(data, agreement), label })

  return {
    name: agreement.percentField,
    type: 'number',
    label: `${label} (%)`,
    defaultValue: agreement.defaultDiscountPercent,
    min: MIN_AGREEMENT_PERCENT,
    max: MAX_AGREEMENT_PERCENT,
    admin: {
      condition: (data) => isAgreementEnabled(data, agreement),
      description: `Standard ${agreement.defaultDiscountPercent} %. ${NO_STACKING_DESCRIPTION}`,
    },
    validate,
  }
}

/** Non-empty after trimming — the name is how every later record identifies the partner. */
const validateName: TextFieldSingleValidation = (value) =>
  typeof value === 'string' && value.trim() !== '' ? true : 'Partnernavn må fylles ut.'

export const Partners: CollectionConfig = {
  slug: 'partners',
  labels: {
    singular: 'Partner',
    plural: 'Partnere',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Partnere',
    defaultColumns: ['name', 'partnerType', 'status', 'dropshippingEnabled', 'wholesaleEnabled', 'email'],
    listSearchableFields: ['name', 'email', 'organizationNumber', 'contactPerson'],
    description:
      'Partnere i partnerprogrammet. Provisjon på promokoder settes på hver rabattkode.',
  },
  access: {
    // Contact and bank details: admin-only in every direction, like the rest of the partner data.
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    // A partner will later anchor promo codes and payout history; removing one is an admin
    // decision. An agreement that ends is marked «Avsluttet» instead. `role` is nullable, so
    // anything that is not exactly 'admin' is refused.
    delete: ({ req }) => req.user?.role === 'admin',
  },
  defaultSort: 'name',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Partnernavn',
          required: true,
          index: true,
          admin: {
            width: '50%',
            description: 'Navnet på personen eller firmaet avtalen er inngått med.',
          },
          hooks: {
            beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
          },
          validate: validateName,
        },
        {
          name: 'status',
          type: 'select',
          label: 'Status',
          required: true,
          defaultValue: 'active',
          index: true,
          options: PARTNER_STATUS_OPTIONS,
          admin: {
            width: '50%',
            description: 'Sett til «Avsluttet» når avtalen opphører, i stedet for å slette partneren.',
          },
        },
      ],
    },
    {
      // Required on every save, but enforced here rather than as a database NOT NULL: partners
      // created before this field existed stay valid and readable as unclassified (NULL) until an
      // administrator chooses — nothing is classified automatically.
      name: 'partnerType',
      type: 'radio',
      label: 'Partnertype',
      options: PARTNER_TYPE_OPTIONS,
      index: true,
      // Permanent once saved: `enforcePartnerType` refuses a change with a validation error on every
      // path; `PartnerTypeField` only renders it read-only in the admin.
      admin: {
        layout: 'horizontal',
        description: PARTNER_TYPE_DESCRIPTION,
        components: { Field: '@/components/admin/partner/PartnerTypeField#default' },
      },
      validate: (value: unknown) => (isPartnerType(value) ? true : PARTNER_TYPE_REQUIRED_MESSAGE),
    },
    {
      // Information, not a setting: every regular partner has these three methods automatically.
      name: 'standardBenefits',
      type: 'ui',
      admin: {
        condition: isRegular,
        components: {
          Field: '@/components/admin/partner/StandardPartnerBenefits#default',
        },
      },
    },
    {
      type: 'collapsible',
      label: 'Samarbeidsavtaler',
      admin: {
        condition: showsAgreements,
        description:
          'Direkte samarbeidsavtaler for nettbutikker. Kan aktiveres hver for seg eller sammen. Nettbutikker har ikke Promokode, Bedriftssalg eller Forhandlersalg. En vanlig partner kan ikke ha disse avtalene – fjern eventuelle avkrysninger før partneren lagres som «Vanlig partner».',
      },
      fields: OPTIONAL_AGREEMENTS.flatMap((agreement) => [
        agreementCheckbox(agreement),
        agreementPercentField(agreement),
      ]),
    },
    {
      type: 'collapsible',
      label: 'Kontaktinformasjon',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'entityType',
              type: 'select',
              // Legal form only — the business role is `partnerType` above.
              label: 'Privatperson / bedrift',
              options: PARTNER_ENTITY_TYPE_OPTIONS,
              admin: { width: '50%' },
            },
            {
              name: 'organizationNumber',
              type: 'text',
              label: 'Organisasjonsnummer',
              admin: {
                width: '50%',
                description: 'Valgfritt. Lagres slik det skrives.',
              },
            },
          ],
        },
        {
          name: 'contactPerson',
          type: 'text',
          label: 'Kontaktperson',
          admin: { description: 'Dersom partneren er et firma.' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'email',
              type: 'email',
              label: 'E-post',
              index: true,
              admin: { width: '50%' },
            },
            {
              name: 'phone',
              type: 'text',
              label: 'Telefon',
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
    {
      // Optional, for both partner types. `country` is pre-filled with «Norge» on a NEW partner
      // only; partners created before these fields existed keep every address field empty.
      type: 'collapsible',
      label: 'Adresse',
      fields: [
        {
          name: 'addressLine1',
          type: 'text',
          label: 'Adresse',
          hooks: { beforeValidate: [({ value }) => trimText(value)] },
          validate: (value: unknown) => validateOptionalText(value, 'Adresse', ADDRESS_LINE_MAX),
        },
        {
          name: 'addressLine2',
          type: 'text',
          label: 'Adresselinje 2',
          hooks: { beforeValidate: [({ value }) => trimText(value)] },
          validate: (value: unknown) => validateOptionalText(value, 'Adresselinje 2', ADDRESS_LINE_MAX),
        },
        {
          type: 'row',
          fields: [
            {
              name: 'postalCode',
              type: 'text',
              label: 'Postnummer',
              admin: { width: '33%' },
              hooks: { beforeValidate: [({ value }) => trimText(value)] },
              validate: (value: unknown, { data }: { data?: unknown }) =>
                validatePostalCode(value, (data as { country?: unknown } | undefined)?.country),
            },
            {
              name: 'city',
              type: 'text',
              label: 'Poststed',
              admin: { width: '67%' },
              hooks: { beforeValidate: [({ value }) => trimText(value)] },
              validate: (value: unknown) => validateOptionalText(value, 'Poststed', CITY_MAX),
            },
          ],
        },
        {
          name: 'country',
          type: 'text',
          label: 'Land',
          defaultValue: DEFAULT_PARTNER_COUNTRY,
          hooks: { beforeValidate: [({ value }) => trimText(value)] },
          validate: (value: unknown) => validateOptionalText(value, 'Land', COUNTRY_MAX),
        },
      ],
    },
    {
      // Recorded for the administrator doing a manual transfer. Stored exactly as typed — no
      // validation, formatting or masking — the same rule as the promo-code fields it replaces.
      type: 'collapsible',
      label: 'Utbetalingsinformasjon',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'bankAccount',
              type: 'text',
              label: 'Kontonummer',
              admin: { width: '50%' },
            },
            {
              name: 'accountOwner',
              type: 'text',
              label: 'Kontoeier',
              admin: {
                width: '50%',
                description: 'Dersom kontoeieren er en annen enn partneren.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'agreementDate',
      type: 'date',
      label: 'Avtaledato',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'Når partneravtalen ble inngått.',
      },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      label: 'Internt notat',
      admin: { description: 'Avtalevilkår, historikk o.l. Vises aldri for partneren.' },
    },
    // ── Linked records ──
    //
    // Join fields are virtual: no column, nothing stored on the partner. They read the links
    // that live on the other side (`promo-codes.partner`, `partner-payouts.partner`). Per-code
    // statistics and the «Registrer utbetaling» action stay on each promo code, where the
    // per-code balance is calculated.
    {
      name: 'promoCodes',
      type: 'join',
      collection: 'promo-codes',
      on: 'partner',
      label: 'Rabattkoder',
      defaultSort: '-createdAt',
      admin: {
        defaultColumns: ['code', 'active', 'discountValue', 'commissionRate', 'commissionBase'],
        description:
          'Rabattkodene som tilhører partneren. Provisjonssats, statistikk og utbetaling håndteres på hver rabattkode.',
      },
    },
    {
      name: 'payouts',
      type: 'join',
      collection: 'partner-payouts',
      on: 'partner',
      label: 'Utbetalinger',
      defaultSort: '-payoutDate',
      admin: {
        defaultColumns: ['payoutDate', 'promoCode', 'amount', 'paymentMethod', 'reference'],
        description:
          'Registrerte utbetalinger til partneren. Eldre utbetalinger registrert før partneren ble opprettet vises på rabattkoden.',
      },
    },
    // ── Legacy (hidden, frozen) ──
    //
    // Superseded by «Standard partnerfordeler» and «Samarbeidsavtaler». Kept so the
    // `partners_partnership_types` table and the two rate columns stay in step with the schema and
    // their historical values are preserved. Never shown, never written, never read.
    legacyField({
      name: 'partnershipTypes',
      type: 'select',
      label: 'Samarbeidsformer (utgått)',
      hasMany: true,
      options: [...LEGACY_PARTNERSHIP_TYPE_OPTIONS],
    }),
    legacyField({
      name: 'businessSaleCommissionPercent',
      type: 'number',
      label: 'Bedriftssalg – provisjon (utgått)',
      defaultValue: 25,
    }),
    legacyField({
      name: 'retailerReferralCommissionPercent',
      type: 'number',
      label: 'Forhandlersalg – provisjon (utgått)',
      defaultValue: 15,
    }),
  ],
  hooks: {
    beforeChange: [enforcePartnerType],
    beforeDelete: [guardPartnerDelete],
    afterChange: [propagatePartnerName],
  },
  timestamps: true,
}
