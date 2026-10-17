import type { CollectionConfig, Where } from 'payload'
import {
  COMMISSION_ELIGIBILITY_DESCRIPTION,
  COMMISSION_ELIGIBILITY_OPTIONS,
  REFERRAL_BASE_DESCRIPTION,
  REFERRAL_CATEGORY_OPTIONS,
  REFERRAL_COMMISSION_STATUS_OPTIONS,
  SALE_PAYMENT_STATUS_OPTIONS,
  VAT_TREATMENT_DESCRIPTION,
  VAT_TREATMENT_OPTIONS,
} from '@/lib/partner/referral'
import { enforceReferralSaleRules, guardReferralSaleDelete } from './hooks/referralSale'
import { createClawbackAdjustment } from './hooks/referralAdjustment'

/**
 * Referral sales (`Henvisningssalg`) — one row per purchase by a referred company or physical
 * store, registered by hand by an ABOKS administrator, with its commission.
 *
 * ── How a sale earns commission ──
 *
 *   1. The administrator enters the amounts exactly as invoiced: total, shipping, other charges
 *      invoiced on top, and the VAT treatment (with the VAT amount for a VAT invoice).
 *   2. On save, the server calculates the base (total − shipping − other − VAT) and the commission
 *      at the sale's rate — 25 % Bedriftssalg, 15 % Forhandlersalg by default — and freezes both.
 *   3. The commission is «Opptjent» only once the administrator sets «Betalt». Cancelling or
 *      refunding reverses it («Tilbakeført»).
 *   4. A registered payout (Stage 4) makes it «Utbetalt».
 *
 * A physical store can have any number of sales; each paid one earns while the store is approved.
 * A Bedriftssalg sale earns only when the administrator explicitly picks «Gir provisjon».
 *
 * ── History ──
 *
 * Once paid, cancelled or refunded the financial fields are locked; corrections are new sales
 * pointing at the original. Version history keeps every save. See `./hooks/referralSale` for every
 * rule, including the double-commission checks against promo-code orders.
 *
 * Promo-code commission is separate and untouched: it is calculated automatically on
 * `promo-code-usages` and never reads this collection.
 */

/** Read-only in the admin; written only by `enforceReferralSaleRules`. */
const derived = { readOnly: true } as const

export const ReferralSales: CollectionConfig = {
  slug: 'referral-sales',
  labels: {
    singular: 'Henvisningssalg',
    plural: 'Henvisningssalg',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Partnere',
    defaultColumns: ['title', 'partner', 'category', 'invoicedTotal', 'commissionAmount', 'paymentStatus', 'commissionStatus'],
    listSearchableFields: ['title', 'externalReference'],
    description:
      'Manuelt registrerte salg til henviste bedrifter og fysiske butikker. Provisjonen beregnes automatisk og opptjenes først når salget er betalt.',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    // Admin only, and `guardReferralSaleDelete` allows it only for a sale still awaiting payment.
    delete: ({ req }) => req.user?.role === 'admin',
  },
  defaultSort: '-saleDate',
  versions: { drafts: false, maxPerDoc: 100 },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Salg',
      admin: { hidden: true },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'referredCustomer',
          type: 'relationship',
          relationTo: 'referred-customers',
          label: 'Henvist kunde',
          required: true,
          index: true,
          // Convenience only — the hook is the authority. The current value stays selectable.
          filterOptions: ({ data }) => {
            const approved: Where = { status: { equals: 'approved' } }
            const current = (data as { referredCustomer?: unknown } | undefined)?.referredCustomer
            const currentId = current && typeof current === 'object' ? (current as { id?: unknown }).id : current
            return typeof currentId === 'number' || typeof currentId === 'string'
              ? { or: [approved, { id: { equals: currentId } }] }
              : approved
          },
          admin: { width: '50%', description: 'Kun godkjente kunder.' },
        },
        {
          name: 'saleDate',
          type: 'date',
          label: 'Salgsdato',
          required: true,
          index: true,
          defaultValue: () => new Date().toISOString(),
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'partner',
          type: 'relationship',
          relationTo: 'partners',
          label: 'Partner',
          index: true,
          admin: { ...derived, width: '50%', description: 'Hentes fra den henviste kunden.' },
        },
        {
          name: 'category',
          type: 'select',
          label: 'Kategori',
          index: true,
          options: REFERRAL_CATEGORY_OPTIONS,
          admin: { ...derived, width: '50%', description: 'Hentes fra den henviste kunden.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'order',
          type: 'relationship',
          relationTo: 'orders',
          label: 'Ordre (nettbutikk)',
          index: true,
          admin: { width: '50%', description: 'Valgfritt. Velg ordren dersom salget ble gjort i nettbutikken.' },
        },
        {
          name: 'externalReference',
          type: 'text',
          label: 'Faktura- / ordrenummer',
          index: true,
          admin: { width: '50%', description: 'Valgfritt. Fakturanummer eller annen referanse utenfor nettbutikken.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Beløp',
      admin: { description: REFERRAL_BASE_DESCRIPTION },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'invoicedTotal',
              type: 'number',
              label: 'Fakturert beløp (kr)',
              required: true,
              min: 0,
              admin: { width: '50%', step: 0.01, description: 'Totalbeløpet kunden er fakturert / har betalt.' },
            },
            {
              name: 'currency',
              type: 'text',
              label: 'Valuta',
              defaultValue: 'NOK',
              admin: { ...derived, width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'shippingAmount',
              type: 'number',
              label: 'Frakt (kr)',
              min: 0,
              admin: { width: '50%', step: 0.01, description: 'Trekkes fra grunnlaget.' },
            },
            {
              name: 'otherExcludedAmount',
              type: 'number',
              label: 'Andre tillegg (kr)',
              min: 0,
              admin: { width: '50%', step: 0.01, description: 'Gebyrer og avgifter fakturert i tillegg. Trekkes fra grunnlaget.' },
            },
          ],
        },
        {
          name: 'vatTreatment',
          type: 'radio',
          label: 'MVA-behandling',
          required: true,
          options: VAT_TREATMENT_OPTIONS,
          admin: { description: VAT_TREATMENT_DESCRIPTION },
        },
        {
          name: 'vatAmount',
          type: 'number',
          label: 'MVA-beløp (kr)',
          min: 0,
          admin: {
            step: 0.01,
            description: 'MVA-beløpet på fakturaen. Trekkes fra grunnlaget.',
            condition: (data) => (data as { vatTreatment?: unknown } | undefined)?.vatTreatment === 'vatDeducted',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Provisjon',
      fields: [
        {
          // Live preview while typing — the server's own calculation. Display only.
          name: 'commissionPreview',
          type: 'ui',
          admin: { components: { Field: '@/components/admin/partner/ReferralCommissionPreview#default' } },
        },
        {
          name: 'commissionEligibility',
          type: 'radio',
          label: 'Provisjon',
          options: COMMISSION_ELIGIBILITY_OPTIONS,
          admin: { layout: 'horizontal', description: COMMISSION_ELIGIBILITY_DESCRIPTION },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'commissionRate',
              type: 'number',
              label: 'Provisjonssats (%)',
              min: 0,
              max: 100,
              admin: {
                width: '50%',
                step: 0.01,
                description: 'Tom = standard (Bedriftssalg 25 %, Forhandlersalg 15 %). Avvik krever begrunnelse.',
              },
            },
            {
              name: 'rateOverrideReason',
              type: 'textarea',
              label: 'Begrunnelse for avvikende sats',
              admin: { width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'commissionBase',
              type: 'number',
              label: 'Provisjonsgrunnlag (kr)',
              admin: { ...derived, width: '33%', description: 'Beregnes ved lagring.' },
            },
            {
              name: 'commissionAmount',
              type: 'number',
              label: 'Provisjon (kr)',
              admin: { ...derived, width: '33%', description: 'Beregnes ved lagring.' },
            },
            {
              name: 'commissionStatus',
              type: 'select',
              label: 'Provisjonsstatus',
              index: true,
              defaultValue: 'pending',
              options: REFERRAL_COMMISSION_STATUS_OPTIONS,
              admin: { ...derived, width: '34%', description: 'Opptjent først når salget er betalt.' },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Betaling',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'paymentStatus',
              type: 'select',
              label: 'Betalingsstatus',
              required: true,
              defaultValue: 'pending',
              index: true,
              options: SALE_PAYMENT_STATUS_OPTIONS,
              admin: {
                width: '50%',
                description: 'Sett til «Betalt» når ABOKS AS har mottatt betalingen. Da låses beløpene.',
              },
            },
            {
              name: 'paidAt',
              type: 'date',
              label: 'Betalt dato',
              admin: {
                width: '50%',
                date: { pickerAppearance: 'dayOnly' },
                description: 'Settes til i dag dersom feltet er tomt.',
                condition: (data) => (data as { paymentStatus?: unknown } | undefined)?.paymentStatus !== 'pending',
              },
            },
          ],
        },
        {
          name: 'closedAt',
          type: 'date',
          label: 'Kansellert / refundert',
          admin: {
            ...derived,
            date: { pickerAppearance: 'dayAndTime' },
            condition: (data) => Boolean((data as { closedAt?: unknown } | undefined)?.closedAt),
          },
        },
        {
          // Written only by the Stage 4 payout endpoint.
          name: 'payout',
          type: 'relationship',
          relationTo: 'partner-payouts',
          label: 'Utbetaling',
          index: true,
          admin: {
            ...derived,
            description: 'Utbetalingen som dekker provisjonen. Settes automatisk.',
            condition: (data) => Boolean((data as { payout?: unknown } | undefined)?.payout),
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Dobbel provisjon',
      admin: {
        initCollapsed: true,
        description:
          'Gjelder bare når salget er koblet til en nettbutikkordre som allerede har gitt promokode-provisjon.',
      },
      fields: [
        {
          name: 'promoCommissionOnOrder',
          type: 'number',
          label: 'Promokode-provisjon på ordren (kr)',
          admin: {
            ...derived,
            condition: (data) => (data as { promoCommissionOnOrder?: unknown } | undefined)?.promoCommissionOnOrder != null,
          },
        },
        {
          name: 'allowPromoOverlap',
          type: 'checkbox',
          label: 'Tillat provisjon i tillegg til promokode',
          defaultValue: false,
        },
        {
          name: 'promoOverlapReason',
          type: 'textarea',
          label: 'Begrunnelse for dobbel provisjon',
          admin: {
            condition: (data) => (data as { allowPromoOverlap?: unknown } | undefined)?.allowPromoOverlap === true,
          },
        },
      ],
    },
    {
      name: 'correctsSale',
      type: 'relationship',
      relationTo: 'referral-sales',
      label: 'Korrigerer salg',
      index: true,
      admin: {
        description:
          'Brukes ved korreksjon: sett det opprinnelige salget til «Refundert» eller «Kansellert» først, og velg det her.',
      },
    },
    {
      name: 'internalNote',
      type: 'textarea',
      label: 'Internt notat',
      admin: { description: 'Kan alltid endres. Vises aldri for partneren eller kunden.' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Registrert av',
      admin: { ...derived, position: 'sidebar' },
    },
  ],
  hooks: {
    beforeChange: [enforceReferralSaleRules],
    beforeDelete: [guardReferralSaleDelete],
    // A refund or cancellation after payout → exactly one negative adjustment, same transaction.
    afterChange: [createClawbackAdjustment],
  },
  timestamps: true,
}
