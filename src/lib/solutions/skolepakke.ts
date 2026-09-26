import type { SolutionPageContent } from './types'

/**
 * aBoks Skolepakke — three products, the same page as Produksjonspakke, different copy.
 *
 * Copy only. The configurator names `aboks-office`, `aboks-spesial` and `aboks-xl` by slug
 * and reads their prices, colours and stock from Payload.
 *
 * Two things the wording has to get right: a used battery goes into the nearest unit first
 * and is moved on when the school's own routines allow, not immediately and not daily; and
 * the collecting is something the school organises with its staff — nowhere does the copy
 * put pupils in charge of moving batteries between points.
 */
export const SKOLEPAKKE: SolutionPageContent = {
  slug: 'skolepakke',
  eyebrow: 'Skole · Barnehage · Undervisning',
  title: 'aBoks Skolepakke',
  headline: 'En samlet batteriløsning for hele skolen',
  ingress:
    'En fleksibel løsning for skoler og undervisningsmiljøer med flere rom og bruksområder. aBoks Office og aBoks Spesial gir lokale oppbevarings- og innsamlingspunkter, mens aBoks XL samler de brukte batteriene på ett felles sted.',

  steps: {
    eyebrow: 'Oppbevar · Samle · Samle felles · Lever videre',
    heading: 'Slik fungerer aBoks Skolepakke',
    intro: 'Fra rommet der batteriene brukes til et felles innsamlingspunkt.',
    items: [
      {
        number: '01',
        title: 'Oppbevar og samle',
        text: 'I lærerrom, kontorer og arbeidsrom gir aBoks Office fast plass til nye batterier, samtidig som brukte batterier kan legges i den separate beholderen.',
      },
      {
        number: '02',
        title: 'Samle lokalt',
        text: 'I undervisningsrom og fellesområder kan aBoks Spesial brukes som et lokalt innsamlingspunkt for brukte batterier der det er hensiktsmessig.',
      },
      {
        number: '03',
        title: 'Samle felles',
        text: 'Når det passer med skolens rutiner, flyttes brukte batterier fra de lokale enhetene til en felles aBoks XL.',
      },
      {
        number: '04',
        title: 'Lever videre',
        text: 'Når aBoks XL skal tømmes, leveres de brukte batteriene samlet til et godkjent mottak.',
      },
    ],
  },

  placement: {
    heading: 'Riktig løsning på riktig sted',
    intro:
      'Skolepakken kan tilpasses byggets størrelse, antall rom og hvordan batterier brukes i hverdagen. Lokale enheter plasseres der de gjør mest nytte, mens aBoks XL fungerer som et felles innsamlingspunkt.',
    roles: [
      {
        product: 'aBoks Office',
        label: 'Lærerrom og arbeidsområder',
        text: 'For områder der ansatte trenger tilgang til nye batterier og samtidig ønsker et lokalt sted for brukte batterier.',
        locations: ['Lærerrom', 'Administrasjon', 'Kontorer', 'Arbeidsrom', 'Tekniske rom'],
      },
      {
        product: 'aBoks Spesial',
        label: 'Undervisning og fellesområder',
        text: 'For steder der det først og fremst er behov for et enkelt lokalt innsamlingspunkt for brukte batterier.',
        locations: [
          'Undervisningsrom',
          'Korridorer',
          'Fellesområder',
          'Verksted og sløyd',
          'Andre egnede fellespunkter',
        ],
      },
      {
        product: 'aBoks XL',
        label: 'Felles innsamlingspunkt',
        text: 'Plasseres på et egnet fellesområde og samler brukte batterier fra skolens lokale aBoks Office- og aBoks Spesial-enheter.',
        locations: [
          'Sentralt fellesområde',
          'Personalområde',
          'Teknisk område',
          'Annet egnet innsamlingspunkt',
        ],
      },
    ],
    note: 'En liten skole og en stor skole trenger helt ulike antall – sammensetningen følger bygget og hverdagen, ikke en fast pakke.',
  },

  configurator: {
    heading: 'Tilpass Skolepakken',
    intro:
      'Velg farge og antall for hvert produkt. Sammensetningen er fri – sett antallet til 0 for et produkt dere ikke trenger.',
    productSlugs: ['aboks-office', 'aboks-spesial', 'aboks-xl'],
    defaultQuantities: { 'aboks-office': 0, 'aboks-spesial': 0, 'aboks-xl': 0 },
    summaryHeading: 'Din Skolepakke',
    quoteHeading: 'Trenger dere et større oppsett?',
    quoteText:
      'Har skolen flere bygg, etasjer eller mange undervisningsrom, hjelper vi dere med å sette sammen en løsning som passer behovet.',
  },

  benefits: {
    heading: 'Derfor fungerer den på skolen',
    items: [
      {
        title: 'Batterier der ansatte trenger dem',
        text: 'aBoks Office gir nye batterier fast plass på lærerrommet, i administrasjonen og i arbeidsrommene.',
      },
      {
        title: 'Lokale punkter for brukte batterier',
        text: 'Brukte batterier kan legges igjen i rommet de ble byttet i, i stedet for å bli liggende i en skuff.',
      },
      {
        title: 'Færre turer gjennom bygget',
        text: 'Et enkelt batteri trenger ikke bæres til hovedpunktet med én gang – det samles opp lokalt først.',
      },
      {
        title: 'Ett system på tvers av rommene',
        text: 'Lærerrom, undervisningsrom og fellesområder følger den samme rutinen.',
      },
      {
        title: 'Antall etter skolens størrelse',
        text: 'Hvor mange enheter av hver type dere trenger følger antall rom og bruksområder.',
      },
      {
        title: 'En tydelig intern flyt',
        text: 'Fra lokal oppsamling til felles innsamling og videre levering er stegene de samme hver gang.',
      },
    ],
  },

  inquiry: {
    heading: 'Be om tilbud på Skolepakken',
    intro:
      'Fortell oss kort om skolen – antall rom og bruksområder, og hvor det felles innsamlingspunktet skal stå – så setter vi sammen et forslag og et uforpliktende tilbud.',
    interestOption: 'aBoks Skolepakke',
    message: 'Vi ønsker et tilbud på aBoks Skolepakke.',
  },

  // Reviewed and approved 2026-09-26.
  indexable: true,
}
