import type { Access, CollectionConfig, FieldAccess } from 'payload'
import {
  CATEGORY_OPTIONS,
  DEFAULT_ALLOWED_CATEGORIES,
  ENV_ORGANIZATIONS_SLUG,
  MILJO_ADMIN_GROUP,
  ORGANIZATION_LIMITS,
  ORGANIZATION_STATUS_OPTIONS,
  REGISTRATION_LIMITS,
} from '@/lib/miljo/constants'
import { ORGANIZATION_TYPE_OPTIONS } from '@/lib/pilot/constants'
import { enforceOrganizationRules, guardOrganizationDelete } from './hooks/miljo'
import { miljoOrganizationEndpoints } from './endpoints/miljo'

/**
 * Organisations in aBoks Miljøregistrering («Organisasjoner»). Each has ONE permanent public code —
 * the QR sticker on every aBoks XL it owns opens /miljo/<publicCode> — and an optional delivery
 * PIN for its responsible person.
 *
 * Administrator-only in every direction. The public page reads an organisation server-side and
 * receives only its name and registration policy (see @/lib/miljo/service) — contacts, notes, the
 * PIN hash and the attempt counter never leave the server. The PIN fields additionally deny every
 * read and write at field level, so even an administrator's REST response does not contain them.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
const never: FieldAccess = () => false

export const EnvironmentalOrganizations: CollectionConfig = {
  slug: ENV_ORGANIZATIONS_SLUG,
  labels: { singular: 'Organisasjon', plural: 'Organisasjoner' },
  admin: {
    useAsTitle: 'name',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['name', 'status', 'organizationType', 'publicCode', 'startDate'],
    description:
      'Organisasjoner med aBoks XL. Hver organisasjon har én permanent QR-kode som deles av alle beholderne. Se Miljøregistrering-oversikten for statistikk.',
    listSearchableFields: ['name', 'organizationNumber', 'publicCode'],
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  endpoints: miljoOrganizationEndpoints,
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Organisasjon',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Navn',
              required: true,
              maxLength: ORGANIZATION_LIMITS.nameMax,
              admin: { description: 'Vises på den offentlige siden og i miljørapporten. Endring påvirker ikke QR-koden.' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'organizationType',
                  type: 'select',
                  label: 'Type',
                  options: ORGANIZATION_TYPE_OPTIONS,
                  admin: { width: '50%' },
                },
                {
                  name: 'organizationNumber',
                  type: 'text',
                  label: 'Organisasjonsnummer',
                  maxLength: 20,
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'contactPerson', type: 'text', label: 'Kontaktperson (internt)', maxLength: 120, admin: { width: '50%' } },
                { name: 'contactEmail', type: 'email', label: 'E-post (internt)', admin: { width: '50%' } },
              ],
            },
            { name: 'address', type: 'textarea', label: 'Adresse (internt)', maxLength: 300 },
            {
              type: 'row',
              fields: [
                {
                  name: 'containerCount',
                  type: 'number',
                  label: 'Antall aBoks XL',
                  min: 0,
                  max: 10_000,
                  admin: { width: '50%', description: 'Kun til informasjon — alle beholderne bruker samme QR-kode.' },
                },
                {
                  name: 'startDate',
                  type: 'date',
                  label: 'Startdato',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
                },
              ],
            },
            { name: 'internalNotes', type: 'textarea', label: 'Interne notater', maxLength: 2000 },
          ],
        },
        {
          label: 'Registrering',
          fields: [
            {
              name: 'allowedCategories',
              type: 'select',
              label: 'Batterityper i skjemaet',
              hasMany: true,
              required: true,
              options: CATEGORY_OPTIONS,
              defaultValue: DEFAULT_ALLOWED_CATEGORIES,
              admin: {
                description:
                  'aBoks XL tar ikke imot 9V- eller litiumbatterier, og de kan ikke velges. «Andre» vises bare når beskrivelsen under er fylt ut.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'otherCategoryLabel',
                  type: 'text',
                  label: 'Navn på «Andre» (valgfritt)',
                  maxLength: ORGANIZATION_LIMITS.otherLabelMax,
                  admin: { width: '40%' },
                },
                {
                  name: 'otherCategoryDescription',
                  type: 'textarea',
                  label: 'Hvilke batterier «Andre» omfatter',
                  maxLength: ORGANIZATION_LIMITS.otherDescriptionMax,
                  admin: {
                    width: '60%',
                    description:
                      'Påkrevd for «Andre». Beskriv bare typer som beholderens godkjente instruksjoner tillater. Vises for de ansatte.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'maxPerCategory',
                  type: 'number',
                  label: 'Maks per batteritype',
                  min: 1,
                  max: REGISTRATION_LIMITS.maxPerCategory,
                  defaultValue: REGISTRATION_LIMITS.maxPerCategory,
                  admin: { width: '25%' },
                },
                {
                  name: 'maxPerSubmission',
                  type: 'number',
                  label: 'Maks per registrering',
                  min: 1,
                  max: REGISTRATION_LIMITS.maxPerSubmission,
                  defaultValue: REGISTRATION_LIMITS.maxPerSubmission,
                  admin: { width: '25%' },
                },
                {
                  name: 'confirmAbove',
                  type: 'number',
                  label: 'Bekreftelse over',
                  min: 1,
                  max: REGISTRATION_LIMITS.maxPerSubmission,
                  defaultValue: REGISTRATION_LIMITS.confirmAbove,
                  admin: { width: '25%' },
                },
                {
                  name: 'dailyFlagThreshold',
                  type: 'number',
                  label: 'Merk dager over',
                  min: 1,
                  defaultValue: REGISTRATION_LIMITS.dailyFlagThreshold,
                  admin: { width: '25%', description: 'Totalt per dag før registreringer merkes for gjennomgang.' },
                },
              ],
            },
          ],
        },
      ],
    },
    // ── Sidebar ──
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'active',
      options: ORGANIZATION_STATUS_OPTIONS,
      admin: { position: 'sidebar', description: 'Inaktiv: QR-siden tar ikke imot registreringer og viser ingen statistikk.' },
    },
    {
      name: 'miljoPanel',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/miljo/OrganizationPanel#default' },
      },
    },
    {
      name: 'publicCode',
      type: 'text',
      label: 'Offentlig kode',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Lages automatisk og endres aldri ved navnebytte.' },
    },
    {
      name: 'codeHistory',
      type: 'array',
      label: 'Tidligere koder',
      admin: {
        position: 'sidebar',
        readOnly: true,
        condition: (data) => Array.isArray(data?.codeHistory) && data.codeHistory.length > 0,
        description: 'Utskrevne QR-koder med disse kodene virker ikke lenger.',
      },
      fields: [
        { name: 'code', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'retiredAt', type: 'date', admin: { readOnly: true } },
        { name: 'reason', type: 'text', admin: { readOnly: true } },
      ],
    },
    // PIN state. Never readable or writable through any API; changed only by the PIN endpoint
    // (hash + encrypted copy) and the atomic SQL in @/lib/miljo/pinAttempts (counter).
    { name: 'pinHash', type: 'text', access: { read: never, create: never, update: never }, admin: { hidden: true } },
    { name: 'pinSetAt', type: 'date', access: { read: never, create: never, update: never }, admin: { hidden: true } },
    // AES-256-GCM copy of the active PIN for the admin-only «Vis PIN» (see @/lib/miljo/pinVault).
    // Never used for verification; unreadable without MILJO_PIN_ENCRYPTION_KEY, which is not in
    // the database. Same closed field access as the hash.
    { name: 'pinEncrypted', type: 'text', access: { read: never, create: never, update: never }, admin: { hidden: true } },
    {
      name: 'pinAttemptCount',
      type: 'number',
      defaultValue: 0,
      access: { read: never, create: never, update: never },
      admin: { hidden: true },
    },
    {
      name: 'pinAttemptWindowStart',
      type: 'date',
      access: { read: never, create: never, update: never },
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeChange: [enforceOrganizationRules],
    beforeDelete: [guardOrganizationDelete],
  },
  timestamps: true,
}
