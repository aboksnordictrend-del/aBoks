import type { CollectionConfig, CollectionBeforeChangeHook, Access } from 'payload'
import { round2 } from '@/lib/analytics/money'
import { MARKETING_CHANNELS } from '@/lib/marketingChannels'

// Admin-only: financial records must never be exposed to editors or the public API.
const adminOnly: Access = ({ req }) => req.user?.role === 'admin'

/**
 * Derive amountExVat from the entered gross amount + VAT rate on every write.
 * The user enters the actually-paid amount (incl. MVA); amountExVat is what the analytics
 * layer uses (comparable to ex-VAT revenue). Server-computed only — a client value is
 * ignored.
 */
export const computeMarketingExVat: CollectionBeforeChangeHook = ({ data }) => {
  if (!data) return data
  const amount = typeof data.amount === 'number' ? data.amount : 0
  const vatRate = typeof data.vatRate === 'number' ? data.vatRate : 0
  data.amountExVat = round2(amount / (1 + vatRate / 100))
  return data
}

export const MarketingExpenses: CollectionConfig = {
  slug: 'marketing-expenses',
  labels: {
    singular: 'Markedsføringskostnad',
    plural: 'Markedsføringskostnader',
  },
  admin: {
    // Show the channel label (Meta Ads, Google Ads …) as the record title instead of the
    // record id. Payload resolves the select value to its option label for the title.
    useAsTitle: 'channel',
    group: 'Økonomi',
    defaultColumns: ['date', 'channel', 'amount', 'amountExVat', 'source', 'description'],
    description: 'Rapporterte markedsføringskostnader. Fordeles på valgt periode i analysen — aldri på enkeltordre.',
    listSearchableFields: ['description', 'externalReference'],
    components: {
      views: {
        // Replace the default table with a channel catalog at the collection root.
        list: { Component: '@/components/admin/marketing/MarketingChannelsView#default' },
        // Per-channel detail pages + the full CRUD list, as custom collection routes.
        meta: {
          Component: '@/components/admin/marketing/meta/MetaMarketingView#default',
          path: '/meta',
        },
        all: {
          Component: '@/components/admin/marketing/AllExpensesView#default',
          path: '/all',
        },
      },
    },
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeChange: [computeMarketingExVat],
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      label: 'Dato',
      required: true,
      admin: {
        description: 'Kostnadsdato. Uten periode nedenfor teller hele beløpet på denne datoen.',
      },
    },
    {
      name: 'channel',
      type: 'select',
      label: 'Kanal',
      required: true,
      options: MARKETING_CHANNELS.map((c) => ({ label: c.label, value: c.value })),
    },
    {
      name: 'amount',
      type: 'number',
      label: 'Betalt beløp (inkl. MVA)',
      required: true,
      min: 0,
      admin: {
        step: 0.5,
        description: 'Beløpet du faktisk betalte, inkludert MVA.',
      },
    },
    {
      name: 'vatRate',
      type: 'number',
      label: 'MVA-sats (%)',
      defaultValue: 25,
      min: 0,
      max: 100,
      admin: {
        description: 'Endres kun dersom fakturaen har en annen MVA-sats.',
      },
    },
    {
      name: 'amountExVat',
      type: 'number',
      label: 'Beløp eks. MVA',
      admin: {
        readOnly: true,
        description: 'Beregnes automatisk og brukes i analysen. Du trenger ikke fylle inn noe her.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Beskrivelse',
      admin: {
        placeholder: 'F.eks. Meta Ads juli 2026',
      },
    },
    {
      name: 'externalReference',
      type: 'text',
      label: 'Referanse (valgfritt)',
      admin: {
        description: 'F.eks. fakturanummer eller kampanje-ID.',
      },
    },
    {
      name: 'periodFrom',
      type: 'date',
      label: 'Periode fra',
      admin: {
        description: 'Valgfritt. Sammen med «Periode til» fordeles beløpet jevnt over dagene i perioden.',
      },
    },
    {
      name: 'periodTo',
      type: 'date',
      label: 'Periode til',
      validate: (value: unknown, { siblingData }: { siblingData: { periodFrom?: unknown } }) => {
        const from = siblingData?.periodFrom
        if (value && from && typeof value === 'string' && typeof from === 'string' && value < from) {
          return 'Periode til kan ikke være før periode fra.'
        }
        return true
      },
    },
    // --- Synkronisering (teknisk) -------------------------------------------------
    // Populated only by the Meta sync. Manual records leave these empty and are always
    // treated as `source: 'manual'`. Kept read-only + collapsed so manual entry stays
    // uncluttered. Never overwritten for a manual record. See src/lib/meta/sync.ts.
    {
      name: 'source',
      type: 'select',
      label: 'Kilde',
      defaultValue: 'manual',
      options: [
        { label: 'Manuell', value: 'manual' },
        { label: 'Meta API', value: 'meta-api' },
      ],
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Manuell med mindre den er importert automatisk fra Meta.',
      },
    },
    {
      type: 'collapsible',
      label: 'Synkronisering (automatisk)',
      admin: {
        initCollapsed: true,
        condition: (data) => data?.source === 'meta-api',
      },
      fields: [
        {
          name: 'externalKey',
          type: 'text',
          label: 'Ekstern nøkkel',
          unique: true,
          index: true,
          admin: {
            readOnly: true,
            description: 'Deterministisk nøkkel for idempotent import, f.eks. meta:act_123:2026-07-11.',
          },
        },
        {
          name: 'externalAccountId',
          type: 'text',
          label: 'Ekstern konto-ID',
          admin: { readOnly: true },
        },
        {
          name: 'externalDate',
          type: 'text',
          label: 'Ekstern dato (YYYY-MM-DD)',
          admin: { readOnly: true },
        },
        {
          name: 'lastSyncedAt',
          type: 'date',
          label: 'Sist synkronisert',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'syncMetadata',
          type: 'json',
          label: 'Synk-metadata',
          admin: {
            readOnly: true,
            description: 'Teknisk metadata fra siste import. Inneholder aldri tilgangstoken.',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
