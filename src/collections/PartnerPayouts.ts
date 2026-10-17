import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import {
  PAYOUT_METHOD_OPTIONS,
  PAYOUT_REGISTER_DESCRIPTION,
  PAYOUT_SOURCE_OPTIONS,
} from '@/lib/partner/constants'
import { registerPartnerPayout } from './endpoints/registerPartnerPayout'
import { registerReferralPayout } from './endpoints/registerReferralPayout'
import { assignPayoutSource, reverseReferralPayoutOnDelete } from './hooks/referralPayout'

/**
 * Registered partner payouts (`Partnerutbetalinger`) — an accounting ledger.
 *
 * Each row records a payment a human ALREADY made, by bank transfer, Vipps or otherwise.
 * Nothing here moves money: this system has no payment credentials and never contacts a bank.
 *
 * ── Why rows are created through an endpoint, not the admin form ──
 *
 * The amount has to be checked against a balance that only the server can compute, from the
 * commission snapshots on `promo-code-usages` and the payouts already registered. A form
 * submission cannot be trusted with any of that, so `create` is closed outright and
 * `POST /api/partner-payouts/register` is the only way in — the same shape
 * `promo-code-usages` uses, for the same reason.
 *
 * ── Why the fields are immutable ──
 *
 * A payout is a historical fact. Editing the amount of a transfer that already happened would
 * silently change what the partner is still owed, with no trace. Everything that defines the
 * payment is therefore frozen after creation and enforced in `guardImmutableFields` below —
 * `admin.readOnly` alone would only style the input, and the REST API would sail straight
 * past it. Only `reference` and `note` — the two purely descriptive fields — stay editable.
 *
 * Deletion exists for the one case immutability cannot cover: a payout registered by mistake
 * or twice. It is restricted to `role === 'admin'`, and the balance simply recomputes from the
 * rows that remain. No soft delete, no reversal record.
 *
 * ── Two sources, one ledger ──
 *
 *   • `promoCode` (and every row written before referral payouts existed, where `source` is
 *     NULL) — paid against ONE promo code's balance by `POST /api/partner-payouts/register`.
 *     That endpoint, the balance and the statistics all select payouts by `promoCode`, so they
 *     never see a referral payout. Unchanged.
 *   • `referral` — Bedriftssalg / Forhandlersalg commission, written only by
 *     `POST /api/partner-payouts/register-referral`. It has no promo code; it names the sales it
 *     paid (`referralSales`) and the negative adjustments it deducted (`referralAdjustments`).
 *     `amount` is what was transferred: gross commission minus deductions.
 *
 * Deleting a referral payout puts its sales and adjustments back as unpaid / outstanding in the
 * same transaction (`reverseReferralPayoutOnDelete`), and is refused once a sale it paid has
 * since been refunded — that clawback would otherwise stand against a payout that no longer
 * exists.
 */

/** Frozen after creation. Everything that defines what was paid, to whom, when and how. */
const IMMUTABLE_FIELDS = [
  'promoCode',
  'partner',
  'partnerNameSnapshot',
  'amount',
  'payoutDate',
  'paymentMethod',
  'createdBy',
  'source',
  'referralSales',
  'referralAdjustments',
  'referralGrossAmount',
  'referralDeductedAmount',
] as const

type ImmutableField = (typeof IMMUTABLE_FIELDS)[number]

/** Relationship value → comparable id. Handles both a raw id and a populated document. */
const relationshipId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

/** A date in any of the shapes Payload may hand over → epoch ms, or null. */
const dateValue = (value: unknown): number | null => {
  if (value == null) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/** Money → whole øre, so 250 and 250.0 compare equal and float noise cannot fake an edit. */
const moneyValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null

const textValue = (value: unknown): string | null =>
  value == null ? null : typeof value === 'string' ? value : String(value)

/** A hasMany relationship → its ids, sorted and joined, so order and shape never matter. */
const relationshipIds = (value: unknown): string => {
  if (!Array.isArray(value)) return ''
  return value
    .map(relationshipId)
    .filter((id): id is string => id != null)
    .sort()
    .join(',')
}

/** The comparable form of each immutable field. */
function normalize(field: ImmutableField, value: unknown): unknown {
  switch (field) {
    case 'promoCode':
    case 'partner':
    case 'createdBy':
      return relationshipId(value)
    case 'payoutDate':
      return dateValue(value)
    case 'amount':
    case 'referralGrossAmount':
    case 'referralDeductedAmount':
      return moneyValue(value)
    case 'referralSales':
    case 'referralAdjustments':
      return relationshipIds(value)
    case 'source':
      // A row written before sources existed is a promo payout.
      return value == null || value === '' ? 'promoCode' : textValue(value)
    default:
      return textValue(value)
  }
}

/**
 * Refuses an update that would change any immutable field.
 *
 * Compares VALUES, not presence. Payload sends the whole document on an update — the admin
 * form resubmits every field, readOnly ones included — so rejecting a field merely for being
 * present would make editing a note impossible. A field absent from `data` is untouched and
 * is skipped entirely; only a field that is present AND different is an error.
 */
const guardImmutableFields: CollectionBeforeChangeHook = ({ operation, data, originalDoc }) => {
  if (operation !== 'update' || !originalDoc) return data

  const changed = IMMUTABLE_FIELDS.filter((field) => {
    if (!(field in (data as Record<string, unknown>))) return false
    const next = normalize(field, (data as Record<string, unknown>)[field])
    const current = normalize(field, (originalDoc as Record<string, unknown>)[field])
    return next !== current
  })

  if (changed.length > 0) {
    throw new APIError(
      `Utbetalingen er låst. Feltene kan ikke endres etter registrering: ${changed.join(', ')}. Slett utbetalingen og registrer den på nytt hvis den er feil.`,
      403,
    )
  }

  return data
}

export const PartnerPayouts: CollectionConfig = {
  slug: 'partner-payouts',
  labels: {
    singular: 'Partnerutbetaling',
    plural: 'Partnerutbetalinger',
  },
  admin: {
    useAsTitle: 'partnerNameSnapshot',
    group: 'Butikk',
    defaultColumns: [
      'payoutDate',
      'partnerNameSnapshot',
      'source',
      'promoCode',
      'amount',
      'paymentMethod',
      'reference',
      'createdAt',
    ],
    listSearchableFields: ['partnerNameSnapshot', 'reference'],
    description: PAYOUT_REGISTER_DESCRIPTION,
  },
  access: {
    // Private accounting data. Nothing public, in any direction.
    read: ({ req }) => !!req.user,
    // Closed outright: the balance check lives in the endpoint, which writes with
    // overrideAccess. See the file header.
    create: () => false,
    // Allowed, but `guardImmutableFields` narrows it to reference/note.
    update: ({ req }) => !!req.user,
    // Editors must not be able to erase accounting history. `role` is nullable in the schema,
    // so anything that is not exactly 'admin' — including a missing role — is refused.
    delete: ({ req }) => req.user?.role === 'admin',
  },
  defaultSort: '-payoutDate',
  fields: [
    {
      name: 'promoCode',
      type: 'relationship',
      relationTo: 'promo-codes',
      label: 'Rabattkode',
      // Required for a promo payout; a referral payout has none (see the file header). Enforced
      // here and by `assignPayoutSource`, which runs first.
      validate: (value: unknown, { data }: { data?: unknown }) =>
        (data as { source?: unknown } | undefined)?.source === 'referral' || relationshipId(value) != null
          ? true
          : 'Rabattkode mangler.',
      index: true,
      // Convenience only — the endpoint independently verifies the code is a partner code,
      // so the system's correctness never rests on this filter.
      filterOptions: () => ({ isPartnerCode: { equals: true } }),
      admin: {
        readOnly: true,
        description: 'Låst etter registrering. Tom for utbetaling av henvisningsprovisjon.',
        condition: (data) => (data as { source?: unknown } | undefined)?.source !== 'referral',
        components: {
          // Shows the code in the partner's «Utbetalinger» join list too, where the row arrives
          // with this relationship populated — see the component's header.
          Cell: '@/components/admin/partner/PromoCodeCell#default',
        },
      },
    },
    {
      // NULL on every row written before referral payouts existed: those are promo payouts.
      name: 'source',
      type: 'select',
      label: 'Type',
      index: true,
      options: PAYOUT_SOURCE_OPTIONS,
      admin: {
        readOnly: true,
        description: 'Promokode eller henvisningsprovisjon. Låst.',
        // Labels a legacy NULL as «Promokode» in the list views.
        components: { Cell: '@/components/admin/partner/PayoutSourceCell#default' },
      },
    },
    {
      type: 'collapsible',
      label: 'Henvisningsprovisjon',
      admin: {
        condition: (data) => (data as { source?: unknown } | undefined)?.source === 'referral',
        description: 'Utbetalt beløp = opptjent provisjon på salgene minus trukne justeringer. Låst.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'referralGrossAmount',
              type: 'number',
              label: 'Opptjent provisjon (kr)',
              admin: { readOnly: true, width: '50%' },
            },
            {
              name: 'referralDeductedAmount',
              type: 'number',
              label: 'Trukket for justeringer (kr)',
              admin: { readOnly: true, width: '50%' },
            },
          ],
        },
        {
          name: 'referralSales',
          type: 'relationship',
          relationTo: 'referral-sales',
          hasMany: true,
          label: 'Salg som er utbetalt',
          admin: { readOnly: true },
        },
        {
          name: 'referralAdjustments',
          type: 'relationship',
          relationTo: 'referral-commission-adjustments',
          hasMany: true,
          label: 'Justeringer som er trukket',
          admin: { readOnly: true },
        },
      ],
    },
    {
      // The partner record the code was linked to when the payout was registered. Set by the
      // endpoint from the promo code — never from the request — and frozen with everything
      // else. NULL on payouts registered before partner records existed, and on payouts for a
      // code that is not linked; those keep identifying the payee through `promoCode` and
      // `partnerNameSnapshot`, exactly as before. The balance never reads this field: it is
      // still calculated per promo code.
      name: 'partner',
      type: 'relationship',
      relationTo: 'partners',
      label: 'Partner',
      index: true,
      admin: {
        readOnly: true,
        description: 'Partneren rabattkoden var knyttet til. Tom for eldre utbetalinger. Låst etter registrering.',
      },
    },
    {
      name: 'partnerNameSnapshot',
      type: 'text',
      label: 'Partner / eier',
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Kopiert fra rabattkoden da utbetalingen ble registrert.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'amount',
          type: 'number',
          label: 'Beløp',
          required: true,
          min: 0,
          admin: {
            width: '50%',
            readOnly: true,
            description: 'Utbetalt beløp i kroner. Låst etter registrering.',
          },
        },
        {
          name: 'payoutDate',
          type: 'date',
          label: 'Utbetalingsdato',
          required: true,
          index: true,
          admin: {
            width: '50%',
            readOnly: true,
            date: { pickerAppearance: 'dayOnly' },
          },
        },
      ],
    },
    {
      name: 'paymentMethod',
      type: 'select',
      label: 'Betalingsmåte',
      required: true,
      index: true,
      options: PAYOUT_METHOD_OPTIONS,
      admin: { readOnly: true },
    },
    {
      // The two descriptive fields, and the only two an admin may correct afterwards.
      name: 'reference',
      type: 'text',
      label: 'Referanse',
      admin: {
        description: 'Bankreferanse, Vipps-id e.l. Kan endres senere.',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Notat',
      admin: {
        description: 'Internt notat. Kan endres senere.',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Registrert av',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Settes automatisk fra den innloggede brukeren.',
      },
    },
  ],
  hooks: {
    // `guardImmutableFields` stays first; `assignPayoutSource` labels new rows.
    beforeChange: [guardImmutableFields, assignPayoutSource],
    beforeDelete: [reverseReferralPayoutOnDelete],
  },
  endpoints: [registerPartnerPayout, registerReferralPayout],
  timestamps: true,
}
