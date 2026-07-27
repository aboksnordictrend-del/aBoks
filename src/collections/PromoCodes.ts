import type {
  CollectionConfig,
  DateField,
  NumberFieldSingleValidation,
  TextFieldSingleValidation,
} from 'payload'
import {
  DISCOUNT_TYPE_OPTIONS,
  USAGE_MODE_OPTIONS,
  normalizePromoCode,
  type DiscountType,
  type UsageMode,
} from '@/lib/promo/constants'

/**
 * Promo / discount codes (`Promokoder`).
 *
 * Admin-only in every direction — a public visitor must not be able to list codes, read a
 * code's configuration or discover which codes exist. The customer-facing flow never reads
 * this collection directly: the server-side validation service looks up one specifically
 * submitted code with `overrideAccess`, and returns only the resulting discount.
 *
 * Usage figures are NOT stored here. `promo-code-usages` is the single source of truth for
 * "has this been used", and the sidebar widget counts rows there — a mutable counter on this
 * document could drift from the usage table and would then be wrong in exactly the situation
 * it matters (deciding whether a one-time code is still available).
 */

/** Fields whose value is only meaningful together with `discountType` / `usageMode`. */
type PromoSiblingData = {
  discountType?: DiscountType | null
  usageMode?: UsageMode | null
  startsAt?: string | null
}

/**
 * Non-empty after normalisation, and not already taken by another document.
 *
 * The duplicate check runs against the *normalised* value (the field's beforeValidate hook
 * has already uppercased it), which is what makes `welcome10` and `WELCOME10` collide
 * instead of creating two codes that differ only by case. The unique index added by
 * `unique: true` is the backstop for a race between two simultaneous saves.
 */
const validateCode: TextFieldSingleValidation = async (value, { req, id }) => {
  const code = normalizePromoCode(value)
  if (!code) return 'Rabattkode må fylles ut.'
  if (/\s/.test(code)) return 'Rabattkoden kan ikke inneholde mellomrom.'

  if (!req?.payload) return true

  try {
    const existing = await req.payload.find({
      collection: 'promo-codes',
      where: { code: { equals: code } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const clash = existing.docs.find((doc) => String(doc.id) !== String(id ?? ''))
    if (clash) return `Rabattkoden «${code}» finnes allerede.`
  } catch {
    // A failing lookup must not block the save — the unique index still protects us.
    return true
  }

  return true
}

/** > 0 always; ≤ 100 for a percentage. Zero and negative discounts are never valid. */
const validateDiscountValue: NumberFieldSingleValidation = (value, { siblingData }) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Rabattverdi må fylles ut.'
  if (value <= 0) return 'Rabattverdi må være større enn 0.'

  const { discountType } = (siblingData ?? {}) as PromoSiblingData
  if (discountType === 'percentage' && value > 100) {
    return 'Prosentrabatt kan ikke være høyere enn 100.'
  }
  return true
}

/** Required — and a positive integer — only when the code is of the `limited` kind. */
const validateMaxUses: NumberFieldSingleValidation = (value, { siblingData }) => {
  const { usageMode } = (siblingData ?? {}) as PromoSiblingData
  if (usageMode !== 'limited') return true
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Maks antall bruk må fylles ut når koden er begrenset.'
  }
  if (!Number.isInteger(value) || value < 1) {
    return 'Maks antall bruk må være et positivt heltall.'
  }
  return true
}

// Payload exports no `DateFieldSingleValidation`, so the signature is taken off the field
// type itself — same contract, no hand-written duplicate of it.
type DateValidation = NonNullable<DateField['validate']>

/** When both dates are set, the window must be a real one. */
const validateExpiresAt: DateValidation = (value, { siblingData }) => {
  if (!value) return true
  const { startsAt } = (siblingData ?? {}) as PromoSiblingData
  if (!startsAt) return true

  const start = new Date(startsAt).getTime()
  const end = new Date(String(value)).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return true
  if (end <= start) return 'Utløpsdato må være etter startdato.'
  return true
}

export const PromoCodes: CollectionConfig = {
  slug: 'promo-codes',
  admin: {
    useAsTitle: 'code',
    group: 'Butikk',
    defaultColumns: ['code', 'discountType', 'discountValue', 'usageMode', 'active', 'expiresAt'],
    listSearchableFields: ['code', 'name'],
    description: 'Rabattkoder kunden kan bruke i handlekurven.',
  },
  access: {
    // Admin-only in every direction. Nothing here is public: the customer-facing
    // validation endpoint reads a single submitted code with overrideAccess and never
    // exposes the document itself.
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  defaultSort: '-createdAt',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          type: 'text',
          label: 'Rabattkode',
          required: true,
          unique: true,
          index: true,
          admin: {
            width: '50%',
            description: 'Lagres alltid med STORE BOKSTAVER. Kunden kan skrive den som de vil.',
            placeholder: 'WELCOME10',
          },
          hooks: {
            // Normalise before validation so the duplicate check, the unique index and every
            // later lookup all see the same string.
            beforeValidate: [({ value }) => normalizePromoCode(value)],
          },
          validate: validateCode,
        },
        {
          name: 'active',
          type: 'checkbox',
          label: 'Aktiv',
          defaultValue: true,
          admin: {
            width: '50%',
            description: 'Fjern avkryssingen for å skru av koden uten å slette den.',
          },
        },
      ],
    },
    {
      name: 'name',
      type: 'text',
      label: 'Internt navn / notat',
      admin: {
        description: 'Vises kun her i admin — aldri for kunden.',
        placeholder: 'Velkomstrabatt for nye kunder',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'discountType',
          type: 'select',
          label: 'Rabattype',
          required: true,
          defaultValue: 'percentage',
          options: DISCOUNT_TYPE_OPTIONS,
          admin: { width: '50%' },
        },
        {
          name: 'discountValue',
          type: 'number',
          label: 'Rabattverdi',
          required: true,
          admin: {
            width: '50%',
            description: 'Prosent (1–100) eller et fast beløp i kroner.',
          },
          validate: validateDiscountValue,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'usageMode',
          type: 'select',
          label: 'Bruksbegrensning',
          required: true,
          defaultValue: 'unlimited',
          options: USAGE_MODE_OPTIONS,
          admin: { width: '50%' },
        },
        {
          name: 'maxUses',
          type: 'number',
          label: 'Maks antall bruk',
          min: 1,
          admin: {
            width: '50%',
            condition: (data) => data?.usageMode === 'limited',
            description: 'Antall betalte ordre koden kan brukes på totalt.',
          },
          validate: validateMaxUses,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          label: 'Gyldig fra',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime' },
            description: 'La stå tom for å gjelde umiddelbart.',
          },
        },
        {
          name: 'expiresAt',
          type: 'date',
          label: 'Gyldig til',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime' },
            description: 'La stå tom for at koden aldri utløper.',
          },
          validate: validateExpiresAt,
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Begrensninger',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'minimumOrderAmount',
          type: 'number',
          label: 'Minste ordresum (kr)',
          min: 0,
          admin: {
            description:
              'Måles mot summen av de kvalifiserte varelinjene — før rabatt og uten frakt. For en kode uten produktbegrensning er det hele varesummen. La stå tom for ingen minstesum.',
          },
        },
        {
          name: 'applicableProducts',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          label: 'Gjelder kun disse produktene',
          admin: {
            description:
              'La stå tom for at koden gjelder alle produkter. Velges produkter, gis rabatt bare på ordrelinjer med disse produktene — varianter følger produktet sitt.',
          },
        },
      ],
    },
    {
      // Derived from promo-code-usages, never stored. See the file header.
      name: 'usageStats',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/PromoCodeUsage#default',
        },
      },
    },
  ],
  timestamps: true,
}
