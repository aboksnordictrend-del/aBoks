import type { CollectionConfig } from 'payload'
import { ADJUSTMENT_REASON_OPTIONS, REFERRAL_CATEGORY_OPTIONS } from '@/lib/partner/referral'
import { guardAdjustmentChanges } from './hooks/referralAdjustment'

/**
 * Commission adjustments (`Provisjonsjusteringer`) — negative amounts owed back to ABOKS AS
 * because a referral sale was refunded or cancelled AFTER its commission had been paid out.
 *
 * Created automatically when such a sale is saved, one per sale, and deducted whole from the
 * partner's next referral payout. The original sale and payout are never changed. See
 * `./hooks/referralAdjustment` for the rules. Promo-code payouts never read this collection.
 */

const readOnly = { readOnly: true } as const

export const ReferralCommissionAdjustments: CollectionConfig = {
  slug: 'referral-commission-adjustments',
  labels: {
    singular: 'Provisjonsjustering',
    plural: 'Provisjonsjusteringer',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Partnere',
    defaultColumns: ['title', 'partner', 'amount', 'reason', 'settledByPayout', 'createdAt'],
    description:
      'Opprettes automatisk når et salg refunderes eller kanselleres etter at provisjonen er utbetalt. Trekkes fra neste utbetaling av henvisningsprovisjon.',
  },
  access: {
    read: ({ req }) => !!req.user,
    // System-written only, through the sale's afterChange hook with overrideAccess.
    create: () => false,
    // Allowed, but `guardAdjustmentChanges` narrows it to the note.
    update: ({ req }) => !!req.user,
    // Accounting history. Never deleted.
    delete: () => false,
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'title', type: 'text', label: 'Justering', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        {
          name: 'sale',
          type: 'relationship',
          relationTo: 'referral-sales',
          label: 'Salg',
          required: true,
          // One adjustment per sale: the database refuses a second one.
          unique: true,
          index: true,
          admin: { ...readOnly, width: '50%' },
        },
        {
          name: 'partner',
          type: 'relationship',
          relationTo: 'partners',
          label: 'Partner',
          index: true,
          admin: { ...readOnly, width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'amount',
          type: 'number',
          label: 'Beløp (kr)',
          required: true,
          max: 0,
          admin: { ...readOnly, width: '33%', description: 'Negativt: trekkes fra neste utbetaling.' },
        },
        {
          name: 'reason',
          type: 'select',
          label: 'Årsak',
          options: ADJUSTMENT_REASON_OPTIONS,
          admin: { ...readOnly, width: '33%' },
        },
        {
          name: 'category',
          type: 'select',
          label: 'Kategori',
          options: REFERRAL_CATEGORY_OPTIONS,
          admin: { ...readOnly, width: '34%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'originalPayout',
          type: 'relationship',
          relationTo: 'partner-payouts',
          label: 'Opprinnelig utbetaling',
          admin: { ...readOnly, width: '50%', description: 'Utbetalingen som betalte provisjonen. Endres ikke.' },
        },
        {
          name: 'settledByPayout',
          type: 'relationship',
          relationTo: 'partner-payouts',
          label: 'Trukket i utbetaling',
          index: true,
          admin: { ...readOnly, width: '50%', description: 'Tom = utestående, trekkes fra neste utbetaling.' },
        },
      ],
    },
    {
      name: 'settledAt',
      type: 'date',
      label: 'Trukket',
      admin: { ...readOnly, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Notat',
      admin: { description: 'Internt notat. Kan endres.' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Registrert av',
      admin: { ...readOnly, position: 'sidebar' },
    },
  ],
  hooks: {
    beforeChange: [guardAdjustmentChanges],
  },
  timestamps: true,
}
