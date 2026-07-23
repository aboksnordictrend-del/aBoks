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
      label: 'Markedsføring',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'metaAdsVatRate',
          type: 'number',
          label: 'Meta Ads MVA-sats (%)',
          min: 0,
          max: 100,
          // Default 25 mirrors the existing manual default (MarketingExpenses.vatRate),
          // so importing Meta spend keeps the same net/ex-VAT logic that manual entries
          // already use — nothing about the current analytics changes on day one.
          defaultValue: 25,
          admin: {
            description:
              'MVA-sats som brukes når Meta Ads-kostnader importeres automatisk. Sett til 0 dersom bedriften ikke er MVA-registrert eller fakturaen er uten MVA (reverse charge).',
          },
        },
        // Google Ads has deliberately NO MVA setting: Google invoices Norwegian businesses
        // for advertising under reverse charge, so the imported cost is already net and is
        // counted in full (vatRate 0, fixed in src/lib/google/sync.ts). Adding a rate here
        // would only let the analytics layer divide a net figure by 1.25.
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
