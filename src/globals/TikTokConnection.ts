import type { GlobalConfig, Access, FieldAccess } from 'payload'

// Storage for the TikTok Ads authorization obtained through "Koble til TikTok".
//
// Why a global and not env vars: Meta, Google Ads and Pinterest all read their credentials
// from env, and TIKTOK_ACCESS_TOKEN is honoured for exactly that reason. But the OAuth flow
// *produces* a token at runtime and a Vercel serverless function cannot write an env var, so
// something durable has to hold it. A global reuses Payload's own storage — one table, no new
// collection, no bespoke credential system. See src/lib/tiktok/tokenStore.ts.
//
// Everything here except the token is non-secret account metadata (advertiser id, name,
// currency, reporting time zone) that the status endpoint returns in masked form.

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'

/**
 * The token field is unreadable through *any* API path, including the admin panel: Payload
 * strips a field whose `read` access is false from every response. Server code that genuinely
 * needs the ciphertext passes `overrideAccess: true`, which only tokenStore.ts does.
 */
const neverReadable: FieldAccess = () => false

export const TikTokConnection: GlobalConfig = {
  slug: 'tiktok-connection',
  label: 'TikTok-tilkobling',
  admin: {
    group: 'Økonomi',
    // No editing surface: the connection is created and replaced by the OAuth callback, and
    // shown (masked) on the TikTok card under Markedsføringskanaler. Hiding it keeps a
    // credential store out of the navigation entirely.
    hidden: true,
    description:
      'Teknisk lagring for TikTok Ads-autorisasjonen. Opprettes automatisk av «Koble til TikTok».',
  },
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      name: 'accessTokenEncrypted',
      type: 'text',
      label: 'Tilgangstoken (kryptert)',
      access: {
        // Never leaves the server: not in the admin UI, not in the REST/GraphQL API.
        read: neverReadable,
      },
      admin: {
        readOnly: true,
        description: 'AES-256-GCM-kryptert. Vises aldri, verken i admin eller i API-svar.',
      },
    },
    {
      name: 'advertiserId',
      type: 'text',
      label: 'Annonsekonto-ID',
      admin: { readOnly: true },
    },
    {
      name: 'advertiserName',
      type: 'text',
      label: 'Annonsekontonavn',
      admin: { readOnly: true },
    },
    {
      name: 'currency',
      type: 'text',
      label: 'Valuta',
      admin: { readOnly: true },
    },
    {
      name: 'timezone',
      type: 'text',
      label: 'Tidssone for rapportering',
      admin: { readOnly: true },
    },
    {
      name: 'connectedAt',
      type: 'date',
      label: 'Koblet til',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'connectionVersion',
      type: 'number',
      label: 'Tilkoblingsversjon',
      admin: {
        readOnly: true,
        description:
          'Formatet autorisasjonen ble lagret med. En eldre versjon ignoreres, slik at administratoren må koble til på nytt.',
      },
    },
    {
      name: 'metadataAvailable',
      type: 'checkbox',
      label: 'Kontodetaljer tilgjengelig',
      admin: {
        readOnly: true,
        description:
          'Av når /advertiser/info/ ble avvist — appen har Reporting, men ikke Ad Account Management. Valuta og tidssone må da oppgis via TIKTOK_ADVERTISER_CURRENCY.',
      },
    },
    {
      name: 'reportingOk',
      type: 'checkbox',
      label: 'Rapporteringstilgang bekreftet',
      admin: {
        readOnly: true,
        description: 'Resultatet av én dags testrapport da tilkoblingen ble opprettet.',
      },
    },
  ],
}
