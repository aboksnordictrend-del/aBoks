import type {
  CollectionConfig,
  DateField,
  SelectFieldSingleValidation,
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
import { checkPromoLaunchSupport } from '@/lib/promo/supportPolicy'
import {
  COMMISSION_BASE_DESCRIPTION,
  COMMISSION_BASE_OPTIONS,
  COMMISSION_SCOPE_DESCRIPTION,
  DEFAULT_COMMISSION_BASE,
  MAX_COMMISSION_RATE,
  MIN_COMMISSION_RATE,
} from '@/lib/partner/constants'
import { validateCommissionRate } from '@/lib/partner/commission'

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

/** Fields whose value is only meaningful together with another field on the document. */
type PromoSiblingData = {
  discountType?: DiscountType | null
  usageMode?: UsageMode | null
  maxUses?: number | null
  startsAt?: string | null
  isPartnerCode?: boolean | null
}

/**
 * True for a code marked as belonging to a partner.
 *
 * The partner fields sit inside a top-level `collapsible`, which is presentational only — its
 * children are ordinary siblings of `isPartnerCode` in the document data, exactly as the
 * `row` fields above are. So both the conditions and the validators read the flag the same way
 * `validateMaxUses` reads `usageMode`.
 */
const isPartnerCode = (data: unknown): boolean =>
  (data as PromoSiblingData | undefined)?.isPartnerCode === true

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

/**
 * Blocks saving a configuration the customer-facing system cannot honour.
 *
 * The select above already hides the unsupported modes, but that is only the form: a value
 * could still arrive through the REST/GraphQL API, a seed script, or an older row being
 * re-saved. This runs on every write. It is a convenience guard — the real enforcement is in
 * `validatePromoCode`, which refuses an unsupported code no matter how it got into the table.
 */
const validateUsageMode: SelectFieldSingleValidation = (value, { siblingData }) => {
  const { maxUses } = (siblingData ?? {}) as PromoSiblingData
  const decision = checkPromoLaunchSupport({
    usageMode: typeof value === 'string' ? value : null,
    maxUses: typeof maxUses === 'number' ? maxUses : null,
  })
  if (decision.supported) return true
  return 'Foreløpig støttes bare gjenbrukbare rabattkoder uten bruksgrense. Velg «Ubegrenset», og fjern eventuelt «Maks antall bruk».'
}

/**
 * Required — and non-empty — only on a partner code.
 *
 * The name is what identifies who gets paid, so a partner code without one would produce
 * commission with no payee. An ordinary code may leave it blank, which is the normal case.
 */
const validatePartnerName: TextFieldSingleValidation = (value, { siblingData }) => {
  if (!isPartnerCode(siblingData)) return true
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Partner / eier må fylles ut for en partnerkode.'
  }
  return true
}

/**
 * Delegates to the shared partner module — the same function the commission calculation is
 * built around, so the form can never accept a rate the arithmetic would refuse. Nothing about
 * ranges or messages is restated here; only the requiredness, which depends on this document.
 */
const validateCommissionRateField: NumberFieldSingleValidation = (value, { siblingData }) => {
  const result = validateCommissionRate(value, { required: isPartnerCode(siblingData) })
  return result.ok ? true : result.message
}

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
    // Real columns only. Aggregates (uses, earned commission, outstanding balance) live on the
    // edit page instead — as list columns they would cost one query per row.
    defaultColumns: [
      'code',
      'discountType',
      'discountValue',
      'usageMode',
      'partnerName',
      'commissionRate',
      'active',
      'expiresAt',
    ],
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
          // Only the modes the current launch actually supports are offered. The other
          // values remain in the database enum (and in USAGE_MODE_OPTIONS) so existing rows
          // stay readable and the feature can be switched on later without a migration —
          // see @/lib/promo/supportPolicy.
          options: USAGE_MODE_OPTIONS.filter(
            (option) => checkPromoLaunchSupport({ usageMode: option.value }).supported,
          ),
          admin: {
            width: '50%',
            description:
              'Foreløpig støttes bare gjenbrukbare koder uten bruksgrense. Engangskoder, «kun X ganger» og «én gang per kunde» kommer senere.',
          },
          validate: validateUsageMode,
        },
        {
          name: 'maxUses',
          type: 'number',
          label: 'Maks antall bruk',
          min: 1,
          admin: {
            width: '50%',
            // Never shown while `limited` cannot be selected; kept so the stored value on any
            // pre-existing row is preserved rather than blanked on the next save.
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
      // Partner / influencer settings. Everything below is configuration only: it decides what
      // a FUTURE paid usage will earn. Nothing here is retroactive — a usage record snapshots
      // the rate and base that applied at the moment it was written, so editing these values
      // never changes what has already been earned.
      //
      // An ordinary promo code leaves the checkbox off and is completely unaffected: every
      // field is optional at the schema level, the conditions hide them, and the validators
      // below only bite once `isPartnerCode` is true.
      type: 'collapsible',
      label: 'Partner og provisjon',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'isPartnerCode',
          type: 'checkbox',
          label: 'Partnerkode',
          defaultValue: false,
          admin: {
            description:
              'Aktiver dersom rabattkoden tilhører en samarbeidspartner eller influencer.',
          },
        },
        {
          name: 'partnerName',
          type: 'text',
          label: 'Partner / eier',
          admin: {
            condition: isPartnerCode,
            description: 'Navnet provisjonen føres på. Vises kun i admin.',
            placeholder: 'Ola Nordmann',
          },
          validate: validatePartnerName,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'partnerEmail',
              type: 'email',
              label: 'E-post',
              admin: { width: '50%', condition: isPartnerCode },
            },
            {
              name: 'partnerPhone',
              type: 'text',
              label: 'Telefon',
              admin: { width: '50%', condition: isPartnerCode },
            },
          ],
        },
        // Payment details for the manual transfer, recorded for the administrator's
        // convenience. Reference only: nothing here is read by the commission calculation,
        // the statistics, the payout endpoint, the payout snapshot or the partner e-mail.
        // Stored exactly as typed — no validation, formatting, masking or normalisation, so
        // a foreign account number or an unusual format is never mangled.
        {
          name: 'partnerBankAccount',
          type: 'text',
          label: 'Kontonummer',
          admin: {
            condition: isPartnerCode,
            description: 'Partnerens kontonummer for manuelle utbetalinger.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'partnerAccountOwner',
              type: 'text',
              label: 'Kontoeier',
              admin: {
                width: '50%',
                condition: isPartnerCode,
                description: 'Navnet på kontoeieren dersom det avviker fra partnernavnet.',
              },
            },
            {
              name: 'partnerOrganizationNumber',
              type: 'text',
              label: 'Organisasjonsnummer',
              admin: {
                width: '50%',
                condition: isPartnerCode,
                description: 'Valgfritt organisasjonsnummer dersom partneren er et firma.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'commissionRate',
              type: 'number',
              label: 'Provisjon (%)',
              min: MIN_COMMISSION_RATE,
              max: MAX_COMMISSION_RATE,
              admin: {
                width: '50%',
                condition: isPartnerCode,
                description: COMMISSION_SCOPE_DESCRIPTION,
              },
              validate: validateCommissionRateField,
            },
            {
              name: 'commissionBase',
              type: 'select',
              label: 'Beregn provisjon fra',
              defaultValue: DEFAULT_COMMISSION_BASE,
              options: COMMISSION_BASE_OPTIONS,
              admin: {
                width: '50%',
                condition: isPartnerCode,
                description: COMMISSION_BASE_DESCRIPTION,
              },
            },
          ],
        },
        {
          name: 'partnerNote',
          type: 'textarea',
          label: 'Internt notat',
          admin: {
            condition: isPartnerCode,
            description: 'Avtalevilkår, kontaktinfo o.l. Vises aldri for kunden.',
          },
        },
      ],
    },
    {
      // «Partnerstatistikk» — read-only, and rendered by a SERVER component, so the figures
      // are loaded during the page render instead of from the browser. That is what keeps
      // this feature free of any new API route. Derived entirely from promo-code-usages and
      // partner-payouts; nothing is stored on this document.
      name: 'partnerStatistics',
      type: 'ui',
      admin: {
        // The component also returns null for an ordinary code — this condition just hides
        // the section immediately when the checkbox is toggled, without a save.
        condition: isPartnerCode,
        components: {
          Field: '@/components/admin/partner/PartnerStatistics#default',
        },
      },
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
