import type { GlobalConfig, Access, FieldAccess } from 'payload'

// Storage for the Pinterest Ads authorization obtained through "Koble til".
//
// Why a global: the OAuth flow *produces* tokens at runtime, and a Vercel serverless function
// cannot write an env var — so something durable has to hold them, and continuous refresh means
// the refresh token is replaced on every renewal. A global reuses Payload's own storage: one
// table, no new collection, no bespoke credential system. Same shape as TikTokConnection.
//
// Everything except the two token fields is non-secret operational metadata (expiry instants,
// granted scope, connection state) that the status endpoint returns as-is.

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'

/**
 * A field whose `read` access is false is stripped by Payload from *every* response — the REST
 * and GraphQL APIs and the admin panel alike. Server code that genuinely needs the value passes
 * `overrideAccess: true`, which only src/lib/pinterest/oauth/store.ts does.
 */
const neverReadable: FieldAccess = () => false

export const PINTEREST_CONNECTION_GLOBAL = 'pinterest-connection'

/** The three states the Pinterest Ads card renders. */
export const PINTEREST_CONNECTION_STATUSES = [
  'disconnected',
  'connected',
  'reauthorization_required',
] as const

export const PinterestConnection: GlobalConfig = {
  slug: PINTEREST_CONNECTION_GLOBAL,
  label: 'Pinterest-tilkobling',
  admin: {
    group: 'Økonomi',
    // No editing surface: the connection is created and replaced by the OAuth callback and the
    // refresh path, and shown (without secrets) on the Pinterest card under
    // Markedsføringskanaler. Hiding it keeps a credential store out of the navigation entirely.
    hidden: true,
    description:
      'Teknisk lagring for Pinterest Ads-autorisasjonen. Opprettes automatisk av «Koble til».',
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
      access: { read: neverReadable },
      admin: {
        readOnly: true,
        description: 'AES-256-GCM-kryptert. Vises aldri, verken i admin eller i API-svar.',
      },
    },
    {
      name: 'refreshTokenEncrypted',
      type: 'text',
      label: 'Fornyelsestoken (kryptert)',
      access: { read: neverReadable },
      admin: {
        readOnly: true,
        description:
          'AES-256-GCM-kryptert. Roteres av Pinterest ved hver fornyelse og erstattes atomisk.',
      },
    },
    {
      name: 'accessTokenExpiresAt',
      type: 'date',
      label: 'Tilgangstoken utløper',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'refreshTokenExpiresAt',
      type: 'date',
      label: 'Fornyelsestoken utløper',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'scope',
      type: 'text',
      label: 'Tildelt tilgangsnivå',
      admin: { readOnly: true, description: 'Tilgangsnivået Pinterest faktisk innvilget.' },
    },
    {
      name: 'tokenType',
      type: 'text',
      label: 'Tokentype',
      admin: { readOnly: true },
    },
    {
      name: 'connectedAt',
      type: 'date',
      label: 'Koblet til',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'lastRefreshedAt',
      type: 'date',
      label: 'Sist fornyet',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'connectionStatus',
      type: 'select',
      label: 'Tilkoblingsstatus',
      options: [
        { label: 'Ikke tilkoblet', value: 'disconnected' },
        { label: 'Tilkoblet', value: 'connected' },
        { label: 'Må kobles til på nytt', value: 'reauthorization_required' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'lastOAuthError',
      type: 'text',
      label: 'Siste autoriseringsfeil',
      admin: {
        readOnly: true,
        description:
          'Kun en kort, intern feilkode (f.eks. invalid_grant). Aldri Pinterests rå svar og aldri et token.',
      },
    },
    {
      name: 'tokenVersion',
      type: 'number',
      label: 'Tokenversjon',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description:
          'Økes ved hver rotasjon. Brukes som compare-and-swap slik at to samtidige synkroniseringer ikke kan fornye med det samme gamle fornyelsestokenet.',
      },
    },
    {
      name: 'refreshLockExpiresAt',
      type: 'date',
      label: 'Fornyelseslås utløper',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Settes mens en fornyelse pågår, og utløper av seg selv slik at en avbrutt prosess ikke låser integrasjonen permanent.',
      },
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
    // --- Pending OAuth state (CSRF). Cleared the moment the callback consumes it. ---
    {
      name: 'pendingStateHash',
      type: 'text',
      label: 'Ventende state (hash)',
      access: { read: neverReadable },
      admin: {
        readOnly: true,
        description: 'SHA-256 av state-verdien. Selve verdien lagres aldri.',
      },
    },
    {
      name: 'pendingStateExpiresAt',
      type: 'date',
      label: 'Ventende state utløper',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'pendingStateUserId',
      type: 'text',
      label: 'Ventende state — administrator',
      access: { read: neverReadable },
      admin: { readOnly: true },
    },
  ],
}
