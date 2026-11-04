// Shared constants of the Miljø account area — sign-in, Min side, password recovery (Stage 2.2b).

/** The Miljø session cookie. Never `payload-token`: that one belongs to administrators. */
export const MILJO_SESSION_COOKIE = 'aboks-miljo-session'

/** Session lifetime = `miljo-accounts.auth.tokenExpiration` (the JWT and its session expire together). */
export const MILJO_SESSION_SECONDS = 2 * 60 * 60

/** A password-reset link is valid for one hour and can be used once. */
export const RESET_TTL_MS = 60 * 60 * 1000

export const MILJO_PATHS = {
  landing: '/miljoregistrering',
  register: '/miljoregistrering/registrer',
  login: '/miljoregistrering/logg-inn',
  dashboard: '/miljoregistrering/min-side',
  forgot: '/miljoregistrering/glemt-passord',
  reset: '/miljoregistrering/nytt-passord',
} as const

/** Fixed windows, database-backed (miljo_rate_limits). Payload's own lockout (5 attempts → 15 min) comes on top. */
export const ACCOUNT_RATE_LIMITS = {
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  loginPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  forgotPerIp: { limit: 10, windowSeconds: 60 * 60 },
  forgotPerEmail: { limit: 3, windowSeconds: 60 * 60 },
  resetPerIp: { limit: 20, windowSeconds: 60 * 60 },
  changePerAccount: { limit: 10, windowSeconds: 60 * 60 },
  pinPerAccount: { limit: 30, windowSeconds: 60 * 60 },
  // Same budgets as the public page's statistics and exports, counted per account.
  statsPerAccount: { limit: 240, windowSeconds: 60 * 60 },
  pdfPerAccount: { limit: 30, windowSeconds: 60 * 60 },
  csvPerAccount: { limit: 60, windowSeconds: 60 * 60 },
} as const

export const ACCOUNT_MESSAGES = {
  loginFailed:
    'Feil e-postadresse eller passord, eller kontoen har ikke tilgang. Etter fem mislykkede forsøk sperres innloggingen i 15 minutter.',
  rateLimited: 'For mange forsøk. Vent litt og prøv igjen.',
  notSignedIn: 'Du er ikke logget inn, eller økten har utløpt. Logg inn på nytt.',
  forgotSent:
    'Hvis e-postadressen tilhører en aktiv konto i aBoks Miljøregistrering, har vi sendt en lenke for å lage nytt passord. Lenken gjelder i én time.',
  resetInvalid: 'Lenken er ugyldig, allerede brukt eller utløpt. Be om en ny lenke.',
  resetDone: 'Passordet er endret. Logg inn med det nye passordet.',
  currentPasswordWrong: 'Nåværende passord er feil.',
  changeDone: 'Passordet er endret. Du er logget ut på alle andre enheter.',
  samePassword: 'Det nye passordet må være forskjellig fra det nåværende.',
  pinUnavailable: 'PIN-koden kan ikke vises akkurat nå. Kontakt aBoks, så hjelper vi dere.',
  failed: 'Noe gikk galt. Prøv igjen om litt.',
} as const
