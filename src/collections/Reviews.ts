import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { safeRevalidate } from '@/lib/safeRevalidate'
import { notifyAdminNewReview } from './hooks/notifyAdminNewReview'

/**
 * Customer reviews. Content is created ONLY by the server-side review handler (after a
 * valid one-time invitation token), never through the public API — so `create` is closed
 * and the handler uses overrideAccess. Public read is limited to approved reviews.
 *
 * Moderation lives entirely in the admin panel: status drives visibility, approvedAt is
 * stamped automatically on approval, and verifiedPurchase is server-owned.
 */

/**
 * Refresh the cached public reviews after any change. Wrapped in safeRevalidate because
 * reviews are created from a public Server Action where revalidateTag/revalidatePath can
 * throw `Invariant: static generation store missing`; that must never abort the write
 * (see src/lib/safeRevalidate.ts).
 */
async function revalidateReviews() {
  await safeRevalidate(async () => {
    const { revalidatePath, revalidateTag } = await import('next/cache')
    revalidateTag('reviews')
    revalidatePath('/anmeldelser', 'page')
  }, 'reviews-revalidate')
}

/** Stamps approvedAt the first time a review is approved. */
const stampApprovedAt: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.status === 'approved' && !data.approvedAt && !originalDoc?.approvedAt) {
    data.approvedAt = new Date().toISOString()
  }
  return data
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    group: 'Anmeldelser',
    defaultColumns: [
      'rating',
      'customerName',
      'product',
      'variantName',
      'status',
      'verifiedPurchase',
      'submittedAt',
    ],
    listSearchableFields: ['customerName', 'title', 'text'],
    description: 'Kundeanmeldelser. Godkjenn, avvis eller skjul før publisering.',
    pagination: { defaultLimit: 25 },
  },
  access: {
    // Public may read only approved reviews; admins read everything.
    read: ({ req }) => (req.user ? true : { status: { equals: 'approved' } }),
    // Never created via the public API — only through the server review handler
    // (overrideAccess). Admins may still create manually if ever needed.
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  defaultSort: '-submittedAt',
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'rating',
          type: 'number',
          label: 'Vurdering (1–5)',
          required: true,
          min: 1,
          max: 5,
          admin: { width: '30%' },
        },
        {
          name: 'status',
          type: 'select',
          label: 'Status',
          required: true,
          defaultValue: 'pending',
          options: [
            { label: 'Til gjennomgang', value: 'pending' },
            { label: 'Godkjent', value: 'approved' },
            { label: 'Avvist', value: 'rejected' },
            { label: 'Skjult', value: 'hidden' },
          ],
          admin: { width: '35%' },
        },
        {
          name: 'verifiedPurchase',
          type: 'checkbox',
          label: 'Verifisert kjøp',
          defaultValue: false,
          admin: {
            width: '35%',
            readOnly: true,
            description: 'Settes automatisk av serveren fra tilknyttet ordre.',
          },
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      label: 'Tittel',
      maxLength: 100,
    },
    {
      name: 'text',
      type: 'textarea',
      label: 'Anmeldelse',
      required: true,
    },
    {
      name: 'photos',
      type: 'upload',
      relationTo: 'review-photos',
      hasMany: true,
      maxRows: 5,
      label: 'Bilder',
    },
    {
      type: 'collapsible',
      label: 'Kunde og produkt',
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'customerName', type: 'text', label: 'Visningsnavn', required: true, admin: { width: '50%' } },
            { name: 'customerCity', type: 'text', label: 'Sted', admin: { width: '50%' } },
          ],
        },
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          label: 'Produkt',
          required: true,
        },
        {
          name: 'variantName',
          type: 'text',
          label: 'Variant / farge',
        },
        {
          name: 'productSnapshot',
          type: 'group',
          label: 'Produkt-øyeblikksbilde',
          admin: { description: 'Lagret ved innsending, uendret om produktet endres senere.' },
          fields: [
            { name: 'title', type: 'text', label: 'Tittel' },
            { name: 'variantName', type: 'text', label: 'Variant' },
            { name: 'color', type: 'text', label: 'Farge' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Samtykke',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'consentToPublishName',
              type: 'checkbox',
              label: 'Samtykke: publiser navn',
              defaultValue: false,
              admin: { width: '50%' },
            },
            {
              name: 'consentToPublishPhotos',
              type: 'checkbox',
              label: 'Samtykke: publiser bilder',
              defaultValue: false,
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },
    {
      name: 'moderationNote',
      type: 'textarea',
      label: 'Moderasjonsnotat (intern)',
      admin: { description: 'Vises aldri offentlig.' },
    },
    // ── Sidebar / server-owned metadata ──
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      label: 'Ordre',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: 'Kunde',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'invitation',
      type: 'relationship',
      relationTo: 'review-invitations',
      label: 'Invitasjon',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'submittedAt',
      type: 'date',
      label: 'Innsendt',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'approvedAt',
      type: 'date',
      label: 'Godkjent',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'helpfulCount',
      type: 'number',
      label: 'Nyttig-stemmer',
      defaultValue: 0,
      min: 0,
      admin: { position: 'sidebar' },
    },
  ],
  hooks: {
    beforeChange: [stampApprovedAt],
    afterChange: [
      async () => {
        await revalidateReviews()
      },
      notifyAdminNewReview,
    ],
    afterDelete: [
      async () => {
        await revalidateReviews()
      },
    ],
  },
  timestamps: true,
}
