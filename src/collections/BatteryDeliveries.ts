import type { Access, CollectionConfig } from 'payload'
import {
  BATTERY_DELIVERIES_SLUG,
  BATTERY_DELIVERY_DOCUMENTS_SLUG,
  DELIVERY_UNIT_OPTIONS,
  DOCUMENTATION_OPTIONS,
  ENV_ORGANIZATIONS_SLUG,
  MILJO_ADMIN_GROUP,
  RECORD_STATUS_OPTIONS,
} from '@/lib/miljo/constants'
import { enforceDeliveryRules, refuseDelete } from './hooks/miljo'
import { miljoDeliveryEndpoints } from './endpoints/miljo'

/**
 * Actual deliveries to a collection operator («Leverte batterier»), recorded on the public QR page
 * by the organisation's responsible person with the organisation's PIN — on every submission.
 *
 * Kept strictly apart from employee registrations:
 *   • the quantity is stored in the unit it was given in (kg or stk.) and is never converted;
 *   • `documentationStatus` is «Oppgitt av ansvarlig» unless a receipt/document is attached
 *     («Dokumentert med kvittering»). Neither means aBoks or an operator has verified anything.
 *
 * `submittedValues` freezes what the responsible person entered. Administrators correct or
 * invalidate through POST /api/battery-deliveries/:id/{correct,invalidate,restore}; each change
 * writes an append-only battery-delivery-audit row in the same transaction. The REST API offers
 * no create, update or delete to anyone.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
const nobody: Access = () => false

export const BatteryDeliveries: CollectionConfig = {
  slug: BATTERY_DELIVERIES_SLUG,
  labels: { singular: 'Levering', plural: 'Leveringer' },
  admin: {
    useAsTitle: 'organizationName',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['organizationName', 'deliveryDate', 'quantity', 'unit', 'operator', 'documentationStatus', 'status'],
    description:
      'Faktiske leveranser registrert av organisasjonens ansvarlige med PIN. Kan ikke redigeres direkte — bruk Korriger / Ugyldiggjør i sidepanelet.',
    pagination: { defaultLimit: 50 },
  },
  access: { read: adminOnly, create: nobody, update: nobody, delete: nobody },
  defaultSort: '-deliveryDate',
  indexes: [{ fields: ['organization', 'deliveryDate'] }],
  endpoints: miljoDeliveryEndpoints,
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
      type: 'row',
      fields: [
        {
          // Oslo calendar day, YYYY-MM-DD. A date-only value: no time zone can shift it.
          name: 'deliveryDate',
          type: 'text',
          label: 'Dato for levering',
          required: true,
          index: true,
          admin: { readOnly: true, width: '34%' },
        },
        { name: 'quantity', type: 'number', label: 'Levert mengde', required: true, admin: { readOnly: true, width: '33%' } },
        { name: 'unit', type: 'select', label: 'Enhet', required: true, options: DELIVERY_UNIT_OPTIONS, admin: { readOnly: true, width: '33%' } },
      ],
    },
    { name: 'operator', type: 'text', label: 'Mottak / avfallsselskap', required: true, admin: { readOnly: true } },
    { name: 'reference', type: 'text', label: 'Kvittering / referanse', admin: { readOnly: true } },
    {
      name: 'document',
      type: 'upload',
      relationTo: BATTERY_DELIVERY_DOCUMENTS_SLUG,
      label: 'Vedlegg',
      admin: { readOnly: true },
    },
    {
      name: 'submittedValues',
      type: 'json',
      label: 'Opprinnelig registrert',
      admin: { readOnly: true, description: 'Verdiene den ansvarlige sendte inn. Endres aldri.' },
    },
    // ── Sidebar ──
    {
      name: 'correctionPanel',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '@/components/admin/miljo/DeliveryPanel#default' } },
    },
    {
      name: 'documentationStatus',
      type: 'select',
      label: 'Dokumentasjon',
      required: true,
      defaultValue: 'reported',
      options: DOCUMENTATION_OPTIONS,
      admin: { position: 'sidebar', readOnly: true },
    },
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
      name: 'registeredAt',
      type: 'date',
      label: 'Registrert',
      required: true,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy HH:mm' } },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Kilde',
      defaultValue: 'pin-form',
      options: [{ label: 'QR-side med PIN', value: 'pin-form' }],
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'submissionKey', type: 'text', unique: true, index: true, admin: { hidden: true } },
  ],
  hooks: {
    beforeChange: [enforceDeliveryRules],
    beforeDelete: [refuseDelete('Leveranser kan ikke slettes. Ugyldiggjør leveransen i stedet.')],
  },
  timestamps: true,
}
