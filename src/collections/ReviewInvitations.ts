import type { CollectionConfig } from 'payload'

/**
 * One-time invitation tokens tied to a delivered order. Fully admin-only: the public can
 * neither read, create, update nor delete. Tokens are created by the server invitation
 * handler; only the SHA-256 hash is ever stored (see src/lib/reviewToken.ts).
 *
 * Chosen as a separate collection (rather than draft rows in `reviews`) so the token
 * lifecycle — active → used / expired / revoked, resend counting — stays isolated from
 * published content and never risks leaking into a public review query.
 */
export const ReviewInvitations: CollectionConfig = {
  slug: 'review-invitations',
  admin: {
    useAsTitle: 'email',
    group: 'Anmeldelser',
    defaultColumns: ['email', 'order', 'status', 'sentAt', 'expiresAt', 'usedAt'],
    description: 'Anmeldelsesinvitasjoner (personlige engangslenker).',
  },
  access: {
    // Admin-only across the board. Public access is fully closed.
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'E-post',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      label: 'Ordre',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      label: 'Kunde',
      admin: { readOnly: true },
    },
    {
      name: 'review',
      type: 'relationship',
      relationTo: 'reviews',
      label: 'Anmeldelse',
      admin: { readOnly: true, description: 'Settes når kunden har sendt inn anmeldelsen.' },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Aktiv', value: 'active' },
        { label: 'Brukt', value: 'used' },
        { label: 'Utløpt', value: 'expired' },
        { label: 'Tilbakekalt', value: 'revoked' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'tokenHash',
      type: 'text',
      label: 'Token-hash',
      required: true,
      unique: true,
      admin: {
        // Do not surface the hash prominently in the UI (spec §15).
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Utløper',
      required: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'usedAt',
      type: 'date',
      label: 'Brukt',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'sentAt',
      type: 'date',
      label: 'Sendt',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'resendCount',
      type: 'number',
      label: 'Antall utsendinger',
      defaultValue: 0,
      min: 0,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  timestamps: true,
}
