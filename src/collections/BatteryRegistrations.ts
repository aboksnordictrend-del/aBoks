import type { Access, CollectionConfig, Field } from 'payload'
import {
  BATTERY_REGISTRATIONS_SLUG,
  CATEGORY_OPTIONS,
  ENV_ORGANIZATIONS_SLUG,
  MILJO_ADMIN_GROUP,
  RECORD_STATUS_OPTIONS,
  REGISTRATION_FLAG_OPTIONS,
  REGISTRATION_METHOD_OPTIONS,
  REVIEW_STATE_OPTIONS,
} from '@/lib/miljo/constants'
import { enforceRegistrationRules, refuseDelete } from './hooks/miljo'
import { miljoRegistrationEndpoints } from './endpoints/miljo'

/**
 * Employee battery registrations («Registrerte batterier»). One document per anonymous QR-page
 * submission: self-reported COUNTS, not proof of delivery or recycling.
 *
 * ── Immutable original ──
 * `submittedLines`/`submittedTotal` are exactly what was sent and never change (enforced in the
 * beforeChange hook, even for overrideAccess writes). `lines`/`totalQuantity` are the current
 * values: equal to the original at creation, changed only by the admin correction endpoint, which
 * writes an append-only audit row in the same transaction. Invalidated registrations stay in the
 * database and are excluded from every aggregate by default.
 *
 * ── Access ──
 * Created only by the public server action (local API, overrideAccess). REST/GraphQL: read for
 * administrators; create, update and delete closed to everyone — corrections go through
 * POST /api/battery-registrations/:id/{correct,invalidate,restore,review}.
 *
 * ── Privacy ──
 * No name, e-mail, IP address or user agent is stored.
 *
 * ── Future measurement sources ──
 * `method` is `manual` today; `barcode` is reserved for scan-assisted counting that still ends in
 * a user-confirmed count. Weight and sensor readings (a future smart aBoks XL) are NOT counts and
 * must not be written here: they belong in a separate `battery-measurements` collection
 * (organisation, optional container id, device id, measuredAt, weight + unit, source, verification
 * status), reported as its own series next to registrations — never summed with them, so a sensor
 * reading and a manual count of the same batteries cannot be double-counted.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
const nobody: Access = () => false

const lineFields: Field[] = [
  {
    type: 'row',
    fields: [
      { name: 'category', type: 'select', label: 'Batteritype', required: true, options: CATEGORY_OPTIONS, admin: { width: '50%' } },
      { name: 'quantity', type: 'number', label: 'Antall', required: true, min: 0, admin: { width: '50%' } },
    ],
  },
]

export const BatteryRegistrations: CollectionConfig = {
  slug: BATTERY_REGISTRATIONS_SLUG,
  labels: { singular: 'Registrering', plural: 'Registreringer' },
  admin: {
    useAsTitle: 'organizationName',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['organizationName', 'totalQuantity', 'status', 'reviewState', 'registeredAt'],
    description:
      'Anonyme registreringer fra QR-siden (egenrapportert). Kan ikke redigeres direkte — bruk Korriger / Ugyldiggjør i sidepanelet. Opprinnelige verdier bevares.',
    pagination: { defaultLimit: 50 },
  },
  access: { read: adminOnly, create: nobody, update: nobody, delete: nobody },
  defaultSort: '-registeredAt',
  indexes: [{ fields: ['organization', 'registeredAt'] }],
  endpoints: miljoRegistrationEndpoints,
  fields: [
    {
      name: 'organization',
      type: 'relationship',
      relationTo: ENV_ORGANIZATIONS_SLUG,
      label: 'Organisasjon',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: 'organizationName', type: 'text', label: 'Organisasjon (ved registrering)', admin: { readOnly: true } },
    {
      name: 'lines',
      type: 'array',
      label: 'Gjeldende antall',
      admin: { readOnly: true, description: 'Etter eventuelle korrigeringer. Brukes i statistikken.' },
      fields: lineFields,
    },
    {
      name: 'submittedLines',
      type: 'array',
      label: 'Opprinnelig innsendt',
      admin: { readOnly: true, description: 'Nøyaktig det som ble sendt inn. Endres aldri.' },
      fields: lineFields,
    },
    // ── Sidebar ──
    {
      name: 'correctionPanel',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '@/components/admin/miljo/RegistrationPanel#default' } },
    },
    { name: 'totalQuantity', type: 'number', label: 'Totalt (gjeldende)', admin: { position: 'sidebar', readOnly: true } },
    { name: 'submittedTotal', type: 'number', label: 'Totalt (opprinnelig)', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'registered',
      options: RECORD_STATUS_OPTIONS,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'reviewState',
      type: 'select',
      label: 'Gjennomgang',
      defaultValue: 'none',
      options: REVIEW_STATE_OPTIONS,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'flags',
      type: 'select',
      label: 'Merknader',
      hasMany: true,
      options: REGISTRATION_FLAG_OPTIONS,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'registeredAt',
      type: 'date',
      label: 'Registrert',
      required: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy HH:mm' } },
    },
    {
      name: 'method',
      type: 'select',
      label: 'Metode',
      defaultValue: 'manual',
      options: REGISTRATION_METHOD_OPTIONS,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Kilde',
      defaultValue: 'qr-form',
      options: [{ label: 'QR-side', value: 'qr-form' }],
      admin: { position: 'sidebar', readOnly: true },
    },
    // Idempotency key generated by the browser per form instance; a retried or double-tapped
    // submission finds the stored registration instead of creating a second one.
    { name: 'submissionKey', type: 'text', unique: true, index: true, admin: { hidden: true } },
  ],
  hooks: {
    beforeChange: [enforceRegistrationRules],
    beforeDelete: [refuseDelete('Registreringer kan ikke slettes. Ugyldiggjør registreringen i stedet.')],
  },
  timestamps: true,
}
