/**
 * The partnership programmes shown on /bli-partner, as typed data.
 *
 * The page renders whatever is in `PARTNER_PROGRAMS`, so a programme is added or opened by
 * editing its entry here — never by writing a second page. Only Salgspartner is defined and
 * open today. The other two are deliberately content-free placeholders: no fee, royalty,
 * territory, requirement or term is stated for them anywhere, because none has been decided.
 *
 * To open a programme later:
 *   1. set `status: 'open'`,
 *   2. fill in `highlights` and `cta` (and, if it needs its own section, `sectionId`),
 *   3. if the application form should take applications for it, add a programme field to
 *      `./application` (the form currently applies to Salgspartner only).
 * Nothing else on the page branches on a programme id.
 *
 * Public, marketing-facing data only. The financial source of truth for a live partner — their
 * code, rate, commission and payouts — is the Payload admin (`promo-codes`,
 * `promo-code-usages`, `partner-payouts`); nothing here is read by checkout.
 */

export type PartnerProgramStatus = 'open' | 'coming-soon'

export interface PartnerProgramHighlight {
  /** Short figure or keyword shown large, e.g. «10 %». */
  value: string
  label: string
}

export interface PartnerProgram {
  id: 'salgspartner' | 'lisenspartner' | 'fremtidig'
  name: string
  status: PartnerProgramStatus
  /** One or two sentences. For a coming-soon programme: what it is, never what it pays. */
  summary: string
  /** Shown only for an open programme. */
  highlights: PartnerProgramHighlight[]
  /** Present only for an open programme; a coming-soon card never has an active button. */
  cta?: { label: string; href: string }
  /** The in-page section that explains the programme in depth, when it has one. */
  sectionId?: string
}

export const PARTNER_PROGRAMS: readonly PartnerProgram[] = [
  {
    id: 'salgspartner',
    name: 'Salgspartner',
    status: 'open',
    summary:
      'Anbefal aBoks, gi kundene dine en ekstra rabatt og tjen provisjon på salgene du skaper. For privatpersoner, enkeltpersonforetak og bedrifter.',
    highlights: [
      { value: '10 %', label: 'ekstra rabatt til kunden' },
      { value: '15 %', label: 'provisjon på kvalifiserte salg' },
      { value: '0 kr', label: 'gratis å søke og delta' },
      { value: 'Hele Norge', label: 'ingen geografiske begrensninger' },
    ],
    cta: { label: 'Utforsk programmet', href: '#salgspartner' },
    sectionId: 'salgspartner',
  },
  {
    id: 'lisenspartner',
    name: 'Lisenspartner',
    status: 'coming-soon',
    summary:
      'Et fremtidig samarbeid basert på lisens. Innhold og vilkår er under utarbeidelse og presenteres når programmet er klart.',
    highlights: [],
  },
  {
    id: 'fremtidig',
    name: 'Flere muligheter kommer',
    status: 'coming-soon',
    summary:
      'Vi arbeider med en tredje samarbeidsmodell. Mer informasjon kommer når den er ferdig utviklet.',
    highlights: [],
  },
]

export const isOpenProgram = (program: PartnerProgram): boolean => program.status === 'open'
