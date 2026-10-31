import type { Access, CollectionConfig, CollectionSlug, Field } from 'payload'
import {
  AUDIT_ACTION_OPTIONS,
  BATTERY_DELIVERIES_SLUG,
  BATTERY_DELIVERY_AUDIT_SLUG,
  BATTERY_REGISTRATIONS_SLUG,
  BATTERY_REGISTRATION_AUDIT_SLUG,
  ENV_ORGANIZATIONS_SLUG,
  MILJO_ADMIN_GROUP,
} from '@/lib/miljo/constants'
import { appendOnly, refuseDelete } from './hooks/miljo'

/**
 * Append-only change history for registrations and deliveries («Endringslogg»). One row per
 * correction, invalidation, restore or review (and, for deliveries, the PIN-authorised creation).
 * Rows are written only by the server in the same transaction as the change they describe; no
 * one — administrators included — can update or delete them, at the API or in the hooks.
 *
 * `before`/`after` are snapshots of the values that changed. Never shown publicly or exported.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
const nobody: Access = () => false

function auditFields(subject: { name: string; relationTo: CollectionSlug; label: string }): Field[] {
  return [
    {
      name: subject.name,
      type: 'relationship',
      relationTo: subject.relationTo,
      label: subject.label,
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'organization',
      type: 'relationship',
      relationTo: ENV_ORGANIZATIONS_SLUG,
      label: 'Organisasjon',
      index: true,
      admin: { readOnly: true },
    },
    {
      type: 'row',
      fields: [
        { name: 'action', type: 'select', label: 'Handling', required: true, options: AUDIT_ACTION_OPTIONS, admin: { readOnly: true, width: '50%' } },
        {
          name: 'performedAt',
          type: 'date',
          label: 'Tidspunkt',
          required: true,
          index: true,
          admin: { readOnly: true, width: '50%', date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy HH:mm' } },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'performedBy', type: 'relationship', relationTo: 'users', label: 'Utført av', admin: { readOnly: true, width: '50%' } },
        {
          name: 'performedByLabel',
          type: 'text',
          label: 'Utført av (ved endring)',
          admin: { readOnly: true, width: '50%', description: 'E-post for administratorer, «Ansvarlig (PIN)» for leveranser fra QR-siden.' },
        },
      ],
    },
    { name: 'reason', type: 'textarea', label: 'Begrunnelse', admin: { readOnly: true } },
    { name: 'before', type: 'json', label: 'Før', admin: { readOnly: true } },
    { name: 'after', type: 'json', label: 'Etter', admin: { readOnly: true } },
  ]
}

export const BatteryRegistrationAudit: CollectionConfig = {
  slug: BATTERY_REGISTRATION_AUDIT_SLUG,
  labels: { singular: 'Endring (registrering)', plural: 'Endringslogg – registreringer' },
  admin: {
    useAsTitle: 'action',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['action', 'registration', 'performedByLabel', 'reason', 'performedAt'],
    description: 'Uforanderlig logg over korrigeringer, ugyldiggjøringer og gjennomganger.',
    pagination: { defaultLimit: 50 },
  },
  access: { read: adminOnly, create: nobody, update: nobody, delete: nobody },
  defaultSort: '-performedAt',
  fields: auditFields({ name: 'registration', relationTo: BATTERY_REGISTRATIONS_SLUG, label: 'Registrering' }),
  hooks: {
    beforeChange: [appendOnly],
    beforeDelete: [refuseDelete('Endringsloggen kan ikke slettes.')],
  },
  timestamps: true,
}

export const BatteryDeliveryAudit: CollectionConfig = {
  slug: BATTERY_DELIVERY_AUDIT_SLUG,
  labels: { singular: 'Endring (levering)', plural: 'Endringslogg – leveringer' },
  admin: {
    useAsTitle: 'action',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['action', 'delivery', 'performedByLabel', 'reason', 'performedAt'],
    description: 'Uforanderlig logg over registrering, korrigering og ugyldiggjøring av leveranser.',
    pagination: { defaultLimit: 50 },
  },
  access: { read: adminOnly, create: nobody, update: nobody, delete: nobody },
  defaultSort: '-performedAt',
  fields: auditFields({ name: 'delivery', relationTo: BATTERY_DELIVERIES_SLUG, label: 'Levering' }),
  hooks: {
    beforeChange: [appendOnly],
    beforeDelete: [refuseDelete('Endringsloggen kan ikke slettes.')],
  },
  timestamps: true,
}
