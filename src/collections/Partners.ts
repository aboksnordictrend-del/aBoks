import type {
  CollectionConfig,
  NumberField,
  NumberFieldSingleValidation,
  TextFieldSingleValidation,
} from 'payload'
import {
  MAX_PARTNERSHIP_PERCENT,
  MIN_PARTNERSHIP_PERCENT,
  NO_STACKING_DESCRIPTION,
  PARTNERSHIP_DEFAULT_PERCENT,
  PARTNERSHIP_DESCRIPTIONS,
  PARTNERSHIP_TYPE_OPTIONS,
  PARTNER_ENTITY_TYPE_OPTIONS,
  PARTNER_STATUS_OPTIONS,
  REFERRAL_RATE_DESCRIPTION,
  hasPartnershipType,
  validatePartnershipPercent,
  type ConfigurablePartnershipType,
} from '@/lib/partner/partnerships'
import {
  guardPartnerDelete,
  guardPromoModelRemoval,
  propagatePartnerName,
} from './hooks/partnerLinks'

/**
 * Partners (`Partnere`) — one document per person or company ABOKS AS has a partner agreement
 * with, whichever partnership models (`Samarbeidsformer`) that agreement covers.
 *
 * ── What links here, and what does not change ──
 *
 *   • Promo codes point at a partner (`promo-codes.partner`, many codes per partner). The
 *     partner's name is copied into the code's existing `partnerName`, which is what checkout's
 *     usage snapshot and the payout endpoint already read. `promo-codes.commissionRate` remains
 *     the one rate the commission engine uses — a partner stores no promo-code rate at all.
 *   • Payouts record the partner the code belonged to (`partner-payouts.partner`). The balance is
 *     still calculated per promo code; nothing here sums money across codes.
 *   • No order is priced or credited from the rates and discounts below.
 *
 * See `@/lib/partner/partnerships` for the five models and why Forhandlersalg and
 * Forhandlerinnkjøp are kept apart, and `./hooks/partnerLinks` for the integrity rules.
 *
 * ── Why the models are one multi-select, not five checkboxes ──
 *
 * `partnershipTypes` is the single answer to "which models is this partner in". Each model's
 * percentage sits in its own field that is shown, and required, only while that model is
 * selected. A per-model "enabled" flag next to the select would be a second answer that could
 * disagree with the first.
 */

/** The percentage field for one configurable model. */
function partnershipPercentField(
  name: string,
  type: ConfigurablePartnershipType,
  label: string,
  description: string,
): NumberField {
  const validate: NumberFieldSingleValidation = (value, { data }) =>
    validatePartnershipPercent(value, { selected: hasPartnershipType(data, type), label })

  return {
    name,
    type: 'number',
    label: `${label} (%)`,
    defaultValue: PARTNERSHIP_DEFAULT_PERCENT[type],
    min: MIN_PARTNERSHIP_PERCENT,
    max: MAX_PARTNERSHIP_PERCENT,
    admin: {
      condition: (data) => hasPartnershipType(data, type),
      description,
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
    defaultColumns: ['name', 'partnershipTypes', 'status', 'email', 'phone', 'updatedAt'],
    listSearchableFields: ['name', 'email', 'organizationNumber', 'contactPerson'],
    description:
      'Samarbeidspartnere og avtalte vilkår. Provisjon på promokoder settes fortsatt på hver rabattkode.',
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
      name: 'partnershipTypes',
      type: 'select',
      label: 'Samarbeidsformer',
      hasMany: true,
      options: PARTNERSHIP_TYPE_OPTIONS,
      admin: {
        description:
          'Velg alle samarbeidsformene partneren deltar i. «Forhandlersalg» er provisjon for å introdusere en forhandler; «Forhandlerinnkjøp» er når partneren selv kjøper inn som forhandler.',
      },
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
      type: 'collapsible',
      label: 'Avtalte vilkår',
      admin: {
        // Promokode has no field here on purpose: its rate is set on each promo code, and a
        // second rate on the partner would compete with it. The description says where it is.
        description: `Vises for samarbeidsformene som er valgt over. Ingen av satsene brukes automatisk i kassen eller på ordre ennå. Promokode: ${PARTNERSHIP_DESCRIPTIONS.promoCode}`,
      },
      fields: [
        {
          type: 'row',
          fields: [
            partnershipPercentField(
              'businessSaleCommissionPercent',
              'businessSale',
              'Bedriftssalg – provisjon',
              `${PARTNERSHIP_DESCRIPTIONS.businessSale} ${REFERRAL_RATE_DESCRIPTION}`,
            ),
            partnershipPercentField(
              'retailerReferralCommissionPercent',
              'retailerReferral',
              'Forhandlersalg – provisjon',
              `${PARTNERSHIP_DESCRIPTIONS.retailerReferral} ${REFERRAL_RATE_DESCRIPTION}`,
            ),
          ],
        },
        {
          type: 'row',
          fields: [
            partnershipPercentField(
              'dropshippingDiscountPercent',
              'dropshipping',
              'Dropshipping – rabatt',
              `${PARTNERSHIP_DESCRIPTIONS.dropshipping} ${NO_STACKING_DESCRIPTION}`,
            ),
            partnershipPercentField(
              'wholesaleDiscountPercent',
              'wholesale',
              'Forhandlerinnkjøp – rabatt',
              `${PARTNERSHIP_DESCRIPTIONS.wholesale} ${NO_STACKING_DESCRIPTION}`,
            ),
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
  ],
  hooks: {
    beforeChange: [guardPromoModelRemoval],
    beforeDelete: [guardPartnerDelete],
    afterChange: [propagatePartnerName],
  },
  timestamps: true,
}
