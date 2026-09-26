import type { SolutionPageContent } from './types'

/**
 * aBoks Kontorpakke — the first complete solution page, and the reference the three other
 * packages follow. Copy only: the configurator names its products by slug and reads their
 * prices, colours and stock from Payload.
 */
export const KONTORPAKKE: SolutionPageContent = {
  slug: 'kontorpakke',
  eyebrow: 'Kontor · Hjemmekontor · Administrasjon',
  title: 'aBoks Kontorpakke',
  headline: 'En komplett batteriløsning for kontoret',
  ingress:
    'aBoks Office står der batteriene faktisk brukes, med oversikt over batteriene på den enkelte arbeidsplassen. aBoks XL er kontorets felles innsamlingspunkt, der brukte batterier samles før de leveres videre.',

  steps: {
    eyebrow: 'Oppbevar · Bytt · Samle · Lever videre',
    heading: 'Slik fungerer aBoks Kontorpakke',
    intro:
      'Fire enkle trinn, fra arbeidsplassen til et felles punkt for brukte batterier.',
    items: [
      {
        number: '01',
        title: 'Oppbevar',
        text: 'Nye batterier oppbevares lett tilgjengelig i aBoks Office ved arbeidsplassen.',
      },
      {
        number: '02',
        title: 'Bytt og samle',
        text: 'Når et batteri byttes, legges det brukte batteriet i den egne beholderen i aBoks Office.',
      },
      {
        number: '03',
        title: 'Samle felles',
        text: 'Når det passer – for eksempel ved dagens slutt eller når beholderen begynner å fylles – flyttes de brukte batteriene til felles aBoks XL.',
      },
      {
        number: '04',
        title: 'Lever videre',
        text: 'Når aBoks XL skal tømmes, leveres de brukte batteriene samlet til et godkjent mottak.',
      },
    ],
  },

  placement: {
    heading: 'Hvor løsningen passer',
    intro:
      'Antall aBoks Office tilpasses kontoret – hvor mange arbeidsplasser og rom som faktisk bruker batterier. aBoks XL står der alle kommer til.',
    items: [
      'Arbeidsplasser',
      'Kontorlandskap',
      'Møterom',
      'Resepsjon',
      'Fellesområder',
      'Hjemmekontor',
    ],
    note: 'Et lite kontor klarer seg med noen få enheter. Et større kontor kan ha en aBoks Office per arbeidssone og fortsatt bare ett felles innsamlingspunkt.',
  },

  configurator: {
    heading: 'Tilpass Kontorpakken',
    intro:
      'Velg farge og antall for hvert produkt. Sammensetningen er fri – sett antallet til 0 for et produkt dere ikke trenger.',
    productSlugs: ['aboks-office', 'aboks-xl'],
    // Both start at 0: the page builds a solution for this office, and an opening
    // 1 + 1 would read as a fixed bundle rather than a starting point.
    defaultQuantities: { 'aboks-office': 0, 'aboks-xl': 0 },
    summaryHeading: 'Din Kontorpakke',
    quoteHeading: 'Trenger dere et større oppsett?',
    quoteText:
      'Skal løsningen dekke mange arbeidsplasser, flere etasjer eller flere lokasjoner, hjelper vi dere med å sette den sammen og gir et samlet tilbud.',
  },

  benefits: {
    heading: 'Derfor fungerer den på kontoret',
    items: [
      {
        title: 'Batterier der de brukes',
        text: 'aBoks Office står ved arbeidsplassen, så batteriene er tilgjengelige i det de trengs.',
      },
      {
        title: 'Enklere intern organisering',
        text: 'Nye og brukte batterier har hver sin faste plass, og alle på kontoret vet hvor de er.',
      },
      {
        title: 'Ett samlet punkt for brukte batterier',
        text: 'aBoks XL gjør det tydelig hvor brukte batterier skal, i stedet for at de blir liggende.',
      },
      {
        title: 'Skalerer med kontoret',
        text: 'Antall enheter følger antall arbeidsplasser og rom – ikke et fast forhold mellom produktene.',
      },
      {
        title: 'Et system fra oppbevaring til levering',
        text: 'Fra arbeidsplassen til innsamlingspunktet henger delene sammen som én rutine.',
      },
    ],
  },

  inquiry: {
    heading: 'Be om tilbud på Kontorpakken',
    intro:
      'Fortell oss kort om kontoret – antall arbeidsplasser, rom og hvor innsamlingspunktet skal stå – så setter vi sammen et forslag og et uforpliktende tilbud.',
    interestOption: 'aBoks Kontorpakke',
    message: 'Vi ønsker et tilbud på aBoks Kontorpakke.',
  },

  // Turned on once the finished page has been reviewed in the browser.
  indexable: false,
}
