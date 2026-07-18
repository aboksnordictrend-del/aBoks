import type { GlobalConfig, Access } from 'payload'

// Admin-only economy configuration: payment-provider fee automation and default shipping
// cost. Read at order-creation time to snapshot paymentFee / actualShippingCost, and by the
// analytics layer for data-quality warnings. Rounding (2 decimals) and currency (NOK) are
// fixed constants in code — not user settings — so they are deliberately not exposed here.
const adminOnly: Access = ({ req }) => req.user?.role === 'admin'

export const EconomySettings: GlobalConfig = {
  slug: 'economy-settings',
  label: 'Økonomiinnstillinger',
  admin: {
    group: 'Økonomi',
    description: 'Automatisering av gebyr og fraktkostnad, samt MVA-forutsetninger for markedsføring.',
  },
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Kustom (betaling)',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'kustomEnabled',
          type: 'checkbox',
          label: 'Beregn gebyr automatisk',
          defaultValue: false,
          admin: {
            description: 'Når på: nye ordre får automatisk beregnet betalingsgebyr ved opprettelse.',
          },
        },
        {
          name: 'paymentProvider',
          type: 'text',
          label: 'Betalingsleverandør',
          defaultValue: 'Kustom',
        },
        {
          name: 'fixedFee',
          type: 'number',
          label: 'Fast gebyr per ordre (kr)',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'percentageFee',
          type: 'number',
          label: 'Prosentgebyr (%)',
          min: 0,
          max: 100,
          defaultValue: 0,
        },
        {
          name: 'feeVatRate',
          type: 'number',
          label: 'MVA på gebyr (%)',
          min: 0,
          max: 100,
          defaultValue: 25,
          admin: {
            description: 'Kun til MVA-/netto-splitt av gebyret i analysen. Legges IKKE oppå det beregnede gebyret.',
          },
        },
        {
          name: 'calculateFrom',
          type: 'select',
          label: 'Beregn gebyr fra',
          defaultValue: 'orderTotalInclShipping',
          options: [
            { label: 'Ordretotal inkl. frakt', value: 'orderTotalInclShipping' },
            { label: 'Kun produktsum', value: 'productTotalOnly' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Frakt',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'applyDefaultShippingCost',
          type: 'checkbox',
          label: 'Bruk standard faktisk fraktkostnad',
          defaultValue: false,
          admin: {
            description: 'Når på: nye ordre får standard faktisk fraktkostnad ved opprettelse (kan overstyres manuelt).',
          },
        },
        {
          name: 'defaultShippingCost',
          type: 'number',
          label: 'Standard faktisk fraktkostnad (kr)',
          min: 0,
        },
        {
          name: 'freeShippingStillHasCost',
          type: 'checkbox',
          label: 'Gratis frakt til kunde har likevel en kostnad',
          defaultValue: true,
          admin: {
            description: 'Fri frakt for kunden betyr ikke null reell fraktkostnad for bedriften.',
          },
        },
      ],
    },
  ],
}
