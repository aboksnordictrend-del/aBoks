import type { CollectionConfig, TextFieldSingleValidation } from 'payload'
import { DISCOUNT_TYPE_OPTIONS } from '@/lib/promo/constants'
import { claimOrderEmails, sendOrderEmails } from './hooks/sendOrderEmails'
import { snapshotOrderCosts } from './hooks/orderSnapshot'
import { assignOrderNumber } from './hooks/orderNumber'
import { resendShippingEmail } from './endpoints/resendShippingEmail'
import { sendReviewInvitation } from './endpoints/sendReviewInvitation'

/**
 * The admin's Ordrenummer input is read-only and submits nothing, so an empty value on
 * create is expected: `assignOrderNumber` (beforeValidate) allocates the number
 * server-side before validation runs on a real create. The default `required` check would
 * instead reject the form in the admin's form-state pass, where no collection hooks run.
 * Requiredness still holds where it matters: NOT NULL + a unique index in Postgres, and an
 * update can never blank an existing number.
 */
const validateOrderNumber: TextFieldSingleValidation = (value, { operation }) => {
  if (operation === 'create') return true
  return typeof value === 'string' && value.trim() !== '' ? true : 'Ordrenummer mangler.'
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    group: 'Butikk',
    defaultColumns: ['orderNumber', 'customer', 'total', 'status', 'createdAt'],
    description: 'Alle bestillinger fra nettbutikken.',
  },
  access: {
  read: ({ req }) => !!req.user,
  create: () => true,
  update: ({ req }) => !!req.user,
  delete: ({ req }) => !!req.user,
},
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      label: 'Ordrenummer',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'Genereres automatisk når ordren lagres.',
      },
      validate: validateOrderNumber,
    },
    {
      name: 'kustomOrderId',
      type: 'text',
      label: 'Kustom Order ID',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: 'Kunde',
    },
    {
      name: 'customerInfo',
      type: 'group',
      label: 'Kundeinformasjon',
      fields: [
        {
          name: 'email',
          type: 'email',
          label: 'E-post',
        },
        {
          name: 'firstName',
          type: 'text',
          label: 'Fornavn',
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Etternavn',
        },
        {
          name: 'address',
          type: 'text',
          label: 'Adresse',
        },
        {
          name: 'postalCode',
          type: 'text',
          label: 'Postnummer',
        },
        {
          name: 'city',
          type: 'text',
          label: 'Sted',
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Telefon',
        },
      ],
    },
    {
      name: 'items',
      type: 'array',
      label: 'Produkter',
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          label: 'Produkt',
        },
        {
          name: 'variant',
          type: 'relationship',
          relationTo: 'product-variants',
          label: 'Variant',
        },
        {
          // Historical name snapshot. Written server-side on creation from the variant's
          // own Visningsnavn, so e-mails and the PDF receipt print the same string the
          // admin panel shows ("aBoks Vegg – Mørk blå") and never re-derive it from the
          // catalogue. Read-only: a later product rename must not rewrite past orders.
          name: 'displayName',
          type: 'text',
          label: 'Produktnavn (som vist til kunden)',
          admin: {
            readOnly: true,
            description:
              'Lagres automatisk fra variantens visningsnavn da ordren ble opprettet. Brukes ordrett i e-post og kvittering.',
          },
        },
        {
          name: 'variantName',
          type: 'text',
          label: 'Fargenavn',
        },
        {
          name: 'quantity',
          type: 'number',
          label: 'Antall',
          required: true,
          min: 1,
        },
        {
          name: 'unitPrice',
          type: 'number',
          label: 'Enhetspris (kr)',
          required: true,
        },
        {
          name: 'lineTotal',
          type: 'number',
          label: 'Linjesum (kr)',
          required: true,
        },
        {
          // This line's share of the order's promo-code discount, in kroner. `unitPrice` and
          // `lineTotal` stay at the full purchase price — the discount is recorded next to
          // them, never folded into them — so the catalogue price the customer saw is still
          // readable on the order. The per-line split exists so revenue and profit can be
          // attributed to the right product/variant instead of only to the order as a whole.
          // Null/0 on every order without a promo code, which is every existing order.
          name: 'discountAmount',
          type: 'number',
          label: 'Rabatt på linjen (kr)',
          min: 0,
          admin: {
            readOnly: true,
            description: 'Andel av rabattkoden som er fordelt på denne linjen.',
          },
        },
        // --- Historical financial snapshot (written server-side on order creation) ---
        // unitCost / vatRate are captured once at creation so later changes to a product's
        // Kostpris or the VAT rate never rewrite historical analytics. unitCost stays
        // editable so an admin can correct a mistake on a specific order line.
        {
          name: 'unitCost',
          type: 'number',
          label: 'Historisk kostpris per enhet',
          min: 0,
          admin: {
            description:
              'Kostpris per enhet på bestillingstidspunktet (uten MVA). Fylles automatisk fra produkt/variant. Kan rettes manuelt.',
          },
        },
        {
          name: 'vatRate',
          type: 'number',
          label: 'MVA-sats (%)',
          min: 0,
          admin: {
            description: 'MVA-sats lagret da ordren ble opprettet. Brukes til å regne omsetning uten MVA.',
          },
        },
        {
          name: 'lineCost',
          type: 'number',
          label: 'Linjekostnad',
          admin: {
            readOnly: true,
            description: 'Beregnes automatisk: kostpris × antall.',
          },
        },
        {
          name: 'lineProfit',
          type: 'number',
          label: 'Linjefortjeneste',
          admin: {
            readOnly: true,
            description: 'Beregnes automatisk: linjesum uten MVA − linjekostnad.',
          },
        },
      ],
    },
    {
      name: 'subtotal',
      type: 'number',
      label: 'Delsum (kr)',
      required: true,
    },
    {
      name: 'shipping',
      type: 'number',
      label: 'Frakt (kr)',
      defaultValue: 0,
    },
    {
      name: 'total',
      type: 'number',
      label: 'Totalt (kr)',
      required: true,
    },
    // --- Promo-code snapshot (written server-side when the order is created) ---
    //
    // A frozen copy of the discount as it was applied, so the order stays correct after the
    // promo code is edited, deactivated or deleted. The relationship is only a pointer for
    // convenience — every figure needed to reproduce the order is stored as plain text and
    // numbers alongside it.
    //
    // How it fits the existing money fields, which keep their current meaning:
    //   subtotal = goods BEFORE discount   ·   shipping = as charged   ·   total = actually paid
    //   → subtotal + shipping − total === discount.discountAmount
    // That identity is what the PDF receipt already relies on to print its "Rabatt" row.
    //
    // Read-only: these must keep matching what the customer was actually charged through
    // Kustom. Correcting an order means correcting it at the source, not editing the snapshot.
    {
      name: 'discount',
      type: 'group',
      label: 'Rabatt',
      admin: {
        description: 'Rabattkode brukt på ordren. Tom for ordre uten rabattkode.',
      },
      fields: [
        {
          name: 'promoCode',
          type: 'relationship',
          relationTo: 'promo-codes',
          label: 'Promokode (referanse)',
          admin: {
            readOnly: true,
            description: 'Kan bli tom hvis koden slettes senere — feltene under består.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'code',
              type: 'text',
              label: 'Rabattkode',
              admin: { width: '34%', readOnly: true },
            },
            {
              name: 'discountType',
              type: 'select',
              label: 'Rabattype',
              options: DISCOUNT_TYPE_OPTIONS,
              admin: { width: '33%', readOnly: true },
            },
            {
              name: 'discountValue',
              type: 'number',
              label: 'Rabattverdi',
              admin: { width: '33%', readOnly: true },
            },
          ],
        },
        {
          name: 'discountAmount',
          type: 'number',
          label: 'Rabattbeløp (kr)',
          min: 0,
          admin: {
            readOnly: true,
            description: 'Faktisk rabatt i kroner. Gjelder aldri frakt.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'subtotalBeforeDiscount',
              type: 'number',
              label: 'Varesum før rabatt (kr)',
              admin: { width: '50%', readOnly: true },
            },
            {
              name: 'subtotalAfterDiscount',
              type: 'number',
              label: 'Varesum etter rabatt (kr)',
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'totalBeforeDiscount',
              type: 'number',
              label: 'Totalt før rabatt (kr)',
              admin: { width: '50%', readOnly: true },
            },
            {
              name: 'totalAfterDiscount',
              type: 'number',
              label: 'Totalt etter rabatt (kr)',
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
      ],
    },
    // --- Variable-cost fields, filled in manually by an admin after fulfilment ---
    // All optional; the dashboard treats a missing value as 0 and keeps working.
    {
      name: 'actualShippingCost',
      type: 'number',
      label: 'Faktisk fraktkostnad (kr)',
      min: 0,
      admin: {
        description: 'Bedriftens reelle fraktkostnad for denne ordren. Kan skille seg fra frakten kunden betalte.',
      },
    },
    {
      name: 'paymentFee',
      type: 'number',
      label: 'Betalingsgebyr (kr)',
      min: 0,
      admin: {
        description: 'Gebyr til betalingsleverandøren for denne ordren. Beregnes automatisk ved opprettelse hvis aktivert i Økonomiinnstillinger; kan overstyres manuelt.',
      },
    },
    {
      // Provenance for paymentFee: 'auto' when the snapshot hook computed it at creation,
      // 'manual' once an admin edits the value. Never recomputed on update.
      name: 'paymentFeeSource',
      type: 'select',
      label: 'Kilde for gebyr',
      options: [
        { label: 'Automatisk', value: 'auto' },
        { label: 'Manuelt', value: 'manual' },
      ],
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Settes automatisk. «Manuelt» når gebyret er endret for hånd.',
      },
    },
    {
      name: 'extraCosts',
      type: 'number',
      label: 'Ekstra variable kostnader (kr)',
      min: 0,
      admin: {
        description: 'Andre variable kostnader knyttet til ordren (emballasje, retur o.l.).',
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Venter', value: 'pending' },
        { label: 'Bekreftet', value: 'confirmed' },
        { label: 'Sendt', value: 'shipped' },
        { label: 'Levert', value: 'delivered' },
        { label: 'Kansellert', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      label: 'Betalt dato',
      admin: {
        position: 'sidebar',
        description: 'Settes automatisk når betalingen bekreftes. Brukes som salgsdato i analysen.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notater',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'resendShippingEmail',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/ResendShippingEmail#default',
        },
      },
    },
    {
      name: 'sendReviewInvitation',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/SendReviewInvitation#default',
        },
      },
    },
    // Email sentinels. Written by the order-email hooks as an atomic claim in the
    // same UPDATE as the status change — that is what keeps sends idempotent.
    // Hidden in the admin UI, but plain columns in the database.
    {
      name: 'confirmationEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'adminEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'shippedEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'shippedEmailMessageId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'shippedEmailError',
      type: 'textarea',
      admin: { hidden: true },
    },
    // Receipt (Kvittering) email, sent once on the transition into 'delivered'.
    // receiptEmailSentAt is the idempotency sentinel — set atomically with the status
    // change, cleared again only if the send fails, so it is safe to keep read-only.
    {
      name: 'receiptEmailSentAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'receiptEmailMessageId',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'receiptEmailError',
      type: 'textarea',
      admin: { hidden: true },
    },
    // --- Meta Conversions API ---
    //
    // Grouped rather than six loose top-level fields: they are one concern, they are written
    // by two different steps of the same flow, and the group name gives them the `meta_*`
    // column prefix without repeating it in every field name.
    //
    // The four attribution fields are captured in the checkout server action — the only
    // request that is genuinely the customer's browser — and read back by the Kustom push
    // webhook, whose own headers and cookies belong to api.kustom.co. See
    // @/lib/meta/capi/attribution.
    //
    // Hidden from the admin UI and never returned to a customer: the collection's `read`
    // access already requires an authenticated user, and the confirmation server action
    // returns a hand-built object rather than the document. They are ordinary nullable
    // columns in Postgres, exactly like the e-mail sentinels above.
    {
      name: 'meta',
      type: 'group',
      admin: { hidden: true },
      access: { read: ({ req }) => !!req.user },
      fields: [
        { name: 'fbp', type: 'text' },
        { name: 'fbc', type: 'text' },
        { name: 'clientIpAddress', type: 'text' },
        { name: 'clientUserAgent', type: 'text' },
        // The claim (see @/lib/meta/capi/claim): stamped before the call so a re-delivered
        // webhook cannot send a second time, cleared again if the call fails.
        { name: 'purchaseSentAt', type: 'date' },
        // The receipt: written only after Meta accepted the event. This — not the timestamp
        // — is the answer to "did this order's Purchase reach Meta".
        { name: 'purchaseEventId', type: 'text' },
      ],
    },
  ],
  hooks: {
    beforeValidate: [assignOrderNumber],
    beforeChange: [claimOrderEmails, snapshotOrderCosts],
    afterChange: [sendOrderEmails],
  },
  endpoints: [resendShippingEmail, sendReviewInvitation],
  timestamps: true,
}
