import type { SolutionPageContent } from './types'

/**
 * aBoks Borettslagspakke — two products, one private and one shared.
 *
 * Copy only. The configurator names `aboks` and `aboks-xl` by slug and reads their prices,
 * colours and stock from Payload.
 *
 * What the wording has to carry: aBoks belongs to the resident and keeps used batteries in
 * its own compartment until it suits them to walk down with a handful — never one battery at
 * a time, never on a schedule. aBoks XL is the shared point, and how many there are follows
 * the property: one entrance, one per oppgang, or several spread across a larger development.
 */
export const BORETTSLAGSPAKKE: SolutionPageContent = {
  slug: 'borettslagspakke',
  eyebrow: 'Borettslag · Sameier · Boligselskaper',
  title: 'aBoks Borettslagspakke',
  headline: 'Fra leiligheten til felles innsamling',
  ingress:
    'En helhetlig løsning for borettslag, sameier og boligselskaper. Hver leilighet kan få sin egen aBoks for oppbevaring av nye og brukte batterier, mens aBoks XL fungerer som et felles innsamlingspunkt i bygget eller boligområdet.',

  steps: {
    eyebrow: 'Oppbevar · Samle · Lever videre',
    heading: 'Slik fungerer aBoks Borettslagspakke',
    intro:
      'Fra batterier i den enkelte leiligheten til en felles innsamlingsløsning for hele bygget eller boligområdet.',
    items: [
      {
        number: '01',
        title: 'Oppbevar hjemme',
        text: 'aBoks gir batteriene en fast plass i leiligheten, med egne rom for nye AA- og AAA-batterier og et separat rom for brukte batterier.',
      },
      {
        number: '02',
        title: 'Samle i aBoks',
        text: 'Brukte batterier kan legges i det separate rommet i aBoks og samles der til det passer å ta dem med til fellespunktet.',
      },
      {
        number: '03',
        title: 'Samle felles',
        text: 'Når det passer, tas de brukte batteriene med til aBoks XL – borettslagets eller sameiets felles innsamlingspunkt.',
      },
      {
        number: '04',
        title: 'Lever videre',
        text: 'Når aBoks XL skal tømmes, leveres batteriene samlet videre til et godkjent mottak etter borettslagets eller sameiets rutiner.',
      },
    ],
  },

  placement: {
    heading: 'Riktig løsning på riktig sted',
    intro:
      'Den ene enheten er beboerens egen, den andre er felles. Sammen gjør de veien fra batteriet i leiligheten til et samlet innsamlingspunkt kort og forutsigbar.',
    roles: [
      {
        product: 'aBoks',
        label: 'I leiligheten',
        text: 'En personlig batteristasjon i hver leilighet. Nye AA- og AAA-batterier oppbevares ryddig, mens brukte batterier kan samles separat til beboeren ønsker å ta dem med til fellespunktet.',
        locations: ['Leilighet', 'Kjøkken', 'Bod', 'Hjemmekontor'],
      },
      {
        product: 'aBoks XL',
        label: 'Felles innsamlingspunkt',
        text: 'aBoks XL plasseres på et naturlig og tilgjengelig fellespunkt for beboerne. Antall og plassering tilpasses byggets eller boligområdets struktur.',
        locations: [
          'Oppgang',
          'Fellesområde',
          'Inngangsparti',
          'Miljørom',
          'Felles bod',
          'Rekkehusområde',
        ],
      },
    ],
    note: 'Har bygget flere oppganger, kan hver oppgang få sitt eget innsamlingspunkt. I rekkehus og større boligområder kan flere aBoks XL fordeles mellom naturlige boliggrupper.',
  },

  configurator: {
    heading: 'Tilpass løsningen til borettslaget',
    intro:
      'Velg antall aBoks til leilighetene og antall aBoks XL til fellesområdene. Løsningen kan tilpasses alt fra mindre bygg til borettslag med flere oppganger og større rekkehusområder.',
    note: 'Et naturlig utgangspunkt er én aBoks per leilighet som skal omfattes av løsningen. Antall aBoks XL vurderes ut fra antall oppganger, bygg og naturlige fellespunkter.',
    productSlugs: ['aboks', 'aboks-xl'],
    defaultQuantities: { aboks: 0, 'aboks-xl': 0 },
    summaryHeading: 'Din Borettslagspakke',
    quoteHeading: 'Skal løsningen dekke mange boliger?',
    quoteText:
      'Har borettslaget flere bygg, mange oppganger eller et større rekkehusområde, hjelper vi dere med å sette sammen en løsning som passer eiendommen.',
  },

  benefits: {
    heading: 'Derfor fungerer den i boligselskapet',
    items: [
      {
        title: 'Enklere for beboerne',
        text: 'Batteriene får en fast plass hjemme og kan leveres til et nærliggende fellespunkt når det passer.',
      },
      {
        title: 'Samlet innsamling',
        text: 'Brukte batterier samles fra mange leiligheter i ett system i stedet for å bli liggende spredt.',
      },
      {
        title: 'Tilpasses boligområdet',
        text: 'Løsningen kan skaleres etter antall leiligheter, oppganger, bygg eller grupper av rekkehus.',
      },
      {
        title: 'Kort vei til fellespunktet',
        text: 'Flere XL-enheter kan brukes når boligområdet er stort eller delt opp, slik at innsamlingspunktet blir praktisk tilgjengelig.',
      },
      {
        title: 'Ryddig batterihåndtering hjemme',
        text: 'aBoks holder nye AA- og AAA-batterier organisert og brukte batterier separat.',
      },
      {
        title: 'En tydelig felles løsning',
        text: 'Borettslaget eller sameiet får et synlig og forståelig system for batteriinnsamling.',
      },
    ],
  },

  inquiry: {
    heading: 'Be om tilbud på Borettslagspakken',
    intro:
      'Fortell oss kort om eiendommen – antall leiligheter, oppganger eller boliggrupper, og hvor fellespunktene kan stå – så setter vi sammen et forslag og et uforpliktende tilbud.',
    interestOption: 'aBoks Borettslagspakke',
    message:
      'Hei, vi ønsker et tilbud på aBoks Borettslagspakke til vårt borettslag/sameie.',
  },

  // Reviewed and approved 2026-09-26.
  indexable: true,
}
