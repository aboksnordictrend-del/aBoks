import type { SolutionPageContent } from './types'

/**
 * aBoks Produksjonspakke — the same page as Kontorpakke, with three products instead of two.
 *
 * Copy only. The configurator names `aboks`, `aboks-spesial` and `aboks-xl` by slug and reads
 * their prices, colours and stock from Payload; nothing about them is restated here.
 *
 * The idea the copy has to carry: a used battery is not walked to aBoks XL the moment it is
 * replaced. It goes into the separate compartment in the nearest aBoks, or into an aBoks
 * Spesial where there is no need to store new ones, and is moved on to aBoks XL when it
 * suits the business.
 */
export const PRODUKSJONSPAKKE: SolutionPageContent = {
  slug: 'produksjonspakke',
  eyebrow: 'Produksjon · Lager · Verksted',
  title: 'aBoks Produksjonspakke',
  headline: 'En komplett batteriløsning for hele arbeidsplassen',
  ingress:
    'En fleksibel løsning for virksomheter med kontorer, produksjonsområder, lager eller verksted. aBoks og aBoks Spesial gir lokale oppbevarings- og innsamlingspunkter der batteriene brukes, mens aBoks XL samler de brukte batteriene på ett felles sted.',

  steps: {
    eyebrow: 'Oppbevar · Samle · Samle felles · Lever videre',
    heading: 'Slik fungerer aBoks Produksjonspakke',
    intro: 'Fra arbeidsplassen til ett felles innsamlingspunkt.',
    items: [
      {
        number: '01',
        title: 'Oppbevar og samle',
        text: 'I kontorer og arbeidsrom gir aBoks fast plass til nye AA- og AAA-batterier, samtidig som brukte batterier kan legges i den separate beholderen.',
      },
      {
        number: '02',
        title: 'Samle der arbeidet skjer',
        text: 'I produksjonsområder, på lager, i verksted og i fellesområder kan aBoks Spesial brukes som et lokalt innsamlingspunkt for brukte batterier.',
      },
      {
        number: '03',
        title: 'Samle felles',
        text: 'Når det passer, flyttes brukte batterier fra aBoks og aBoks Spesial til virksomhetens felles aBoks XL.',
      },
      {
        number: '04',
        title: 'Lever videre',
        text: 'Når aBoks XL skal tømmes, leveres de brukte batteriene samlet til et godkjent mottak.',
      },
    ],
  },

  placement: {
    heading: 'Riktig aBoks på riktig sted',
    intro:
      'Produksjonspakken kan tilpasses hvordan virksomheten faktisk er organisert. Bruk lokale enheter der batteriene brukes, og samle de brukte batteriene videre i én felles aBoks XL.',
    roles: [
      {
        product: 'aBoks',
        label: 'Kontor og arbeidsrom',
        text: 'For områder der ansatte trenger tilgang til nye AA- og AAA-batterier. Brukte batterier kan samtidig legges i den separate beholderen i aBoks.',
        locations: ['Kontorer', 'Arbeidsrom', 'Tekniske rom', 'Faste arbeidsstasjoner'],
      },
      {
        product: 'aBoks Spesial',
        label: 'Produksjon og fellesområder',
        text: 'For steder der det først og fremst er behov for enkel innsamling av brukte batterier.',
        locations: [
          'Produksjonsområder',
          'Lager',
          'Verksted',
          'Korridorer',
          'Felles arbeidsstasjoner',
        ],
      },
      {
        product: 'aBoks XL',
        label: 'Felles innsamlingspunkt',
        text: 'Plasseres sentralt og fungerer som virksomhetens felles punkt for brukte batterier fra de lokale aBoks- og aBoks Spesial-enhetene.',
        locations: ['Sentral korridor', 'Lagerområde', 'Teknisk område', 'Annet fellespunkt'],
      },
    ],
    note: 'Antall enheter av hver type følger lokalene og arbeidsflyten – ikke et fast forhold mellom produktene.',
  },

  configurator: {
    heading: 'Tilpass Produksjonspakken',
    intro:
      'Velg farge og antall for hvert produkt. Sammensetningen er fri – sett antallet til 0 for et produkt dere ikke trenger.',
    productSlugs: ['aboks', 'aboks-spesial', 'aboks-xl'],
    defaultQuantities: { aboks: 0, 'aboks-spesial': 0, 'aboks-xl': 0 },
    summaryHeading: 'Din Produksjonspakke',
    quoteHeading: 'Trenger dere et større oppsett?',
    quoteText:
      'Har virksomheten flere avdelinger, produksjonsområder eller lokasjoner, hjelper vi dere med å sette sammen en løsning som passer behovet.',
  },

  benefits: {
    heading: 'Derfor fungerer den i produksjon og på lager',
    items: [
      {
        title: 'Innsamling der batteriene brukes',
        text: 'Lokale enheter står i arbeidsområdene, så brukte batterier har et sted å gå med én gang.',
      },
      {
        title: 'Nye batterier tilgjengelig',
        text: 'aBoks gir fast plass til nye AA- og AAA-batterier der ansatte trenger dem.',
      },
      {
        title: 'Også for ansatte uten eget kontor',
        text: 'aBoks Spesial gir et enkelt innsamlingspunkt i korridorer, verksted og felles arbeidsstasjoner.',
      },
      {
        title: 'Ett felles punkt',
        text: 'aBoks XL samler det som er samlet opp lokalt, på ett sted i virksomheten.',
      },
      {
        title: 'Antall etter behov',
        text: 'Hvor mange enheter av hver type dere trenger følger arbeidsområdene, ikke en fast pakke.',
      },
      {
        title: 'En tydelig intern flyt',
        text: 'Fra lokal oppsamling til felles punkt og videre levering henger stegene sammen som én rutine.',
      },
    ],
  },

  inquiry: {
    heading: 'Be om tilbud på Produksjonspakken',
    intro:
      'Fortell oss kort om lokalene – arbeidsområder, produksjon, lager og hvor det felles innsamlingspunktet skal stå – så setter vi sammen et forslag og et uforpliktende tilbud.',
    interestOption: 'aBoks Produksjonspakke',
    message: 'Vi ønsker et tilbud på aBoks Produksjonspakke.',
  },

  // Reviewed and approved 2026-09-26.
  indexable: true,
}
