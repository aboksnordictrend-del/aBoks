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
  isAgreementEnabled,
  validateAgreementPercent,
  type OptionalAgreement,
} from '@/lib/partner/partnerships'
import { guardPartnerDelete, propagatePartnerName } from './hooks/partnerLinks'

/**
 * Partners (`Partnere`) — one document per person or company in ABOKS AS's partner programme.
 *
 * ── One programme ──
 *
 * Every partner has the three standard earning methods — Promokode, Bedriftssalg and
 * Forhandlersalg — automatically, under the one partner agreement. They are shown as information
 * («Standard partnerfordeler»), never selected. On top of that, two optional commercial agreements
 * can be enabled per partner, independently: Dropshipping and Forhandlerinnkjøp
 * («Ekstra samarbeidsavtaler»). See `@/lib/partner/partnerships` for the terms.
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

/** The checkbox that enables one optional agreement. */
function agreementCheckbox(agreement: OptionalAgreement): CheckboxField {
  return {
    name: agreement.enabledField,
    type: 'checkbox',
    label: agreement.label,
    defaultValue: false,
    index: true,
    admin: { description: agreement.description },
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
    defaultColumns: ['name', 'status', 'dropshippingEnabled', 'wholesaleEnabled', 'email', 'phone'],
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
      // Information, not a setting: every partner has these three methods automatically.
      name: 'standardBenefits',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/partner/StandardPartnerBenefits#default',
        },
      },
    },
    {
      type: 'collapsible',
      label: 'Ekstra samarbeidsavtaler',
      admin: {
        description:
          'Valgfrie kommersielle avtaler i tillegg til de tre standard opptjeningsmåtene. Kan aktiveres hver for seg eller sammen.',
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
              label: 'Partnertype',
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
    // Superseded by «Standard partnerfordeler» and «Ekstra samarbeidsavtaler». Kept so the
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
    beforeDelete: [guardPartnerDelete],
    afterChange: [propagatePartnerName],
  },
  timestamps: true,
}
