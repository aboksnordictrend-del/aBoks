import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import { PAYOUT_METHOD_OPTIONS, PAYOUT_REGISTER_DESCRIPTION } from '@/lib/partner/constants'
import { registerPartnerPayout } from './endpoints/registerPartnerPayout'

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
 */

/** Frozen after creation. Everything that defines what was paid, to whom, when and how. */
const IMMUTABLE_FIELDS = [
  'promoCode',
  'partnerNameSnapshot',
  'amount',
  'payoutDate',
  'paymentMethod',
  'createdBy',
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

/** The comparable form of each immutable field. */
function normalize(field: ImmutableField, value: unknown): unknown {
  switch (field) {
    case 'promoCode':
    case 'createdBy':
      return relationshipId(value)
    case 'payoutDate':
      return dateValue(value)
    case 'amount':
      return moneyValue(value)
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
      required: true,
      index: true,
      // Convenience only — the endpoint independently verifies the code is a partner code,
      // so the system's correctness never rests on this filter.
      filterOptions: () => ({ isPartnerCode: { equals: true } }),
      admin: {
        readOnly: true,
        description: 'Låst etter registrering.',
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
    beforeChange: [guardImmutableFields],
  },
  endpoints: [registerPartnerPayout],
  timestamps: true,
}
