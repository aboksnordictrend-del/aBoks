/**
 * Applicant-facing copy for the application endpoint's responses.
 *
 * Its own module so the client form can show the same success text the server sends,
 * without importing the endpoint (which uses node:crypto).
 */
export const APPLICATION_RESPONSE_MESSAGES = {
  success:
    'Takk for interessen! Vi har mottatt søknaden din og vil ta kontakt etter at den er vurdert.',
  invalidRequest: 'Noe gikk galt. Prøv igjen senere.',
  forbiddenOrigin: 'Søknaden ble avvist.',
  rateLimited: 'For mange forsøk. Prøv igjen om en liten stund.',
  turnstileFailed: 'Kunne ikke bekrefte at du er et menneske. Last siden på nytt og prøv igjen.',
  validationFailed: 'Søknaden ble ikke sendt. Sjekk feltene som er markert med rødt.',
  serverError: 'Prøv igjen om litt, eller kontakt oss på post@aboks.no.',
} as const
