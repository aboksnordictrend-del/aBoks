/**
 * The complete aBoks solutions presented on /bedrifter — the packages that combine several
 * products into one system, as opposed to the individual models further down that page.
 *
 * Everything the section renders is derived from this file, so a fifth solution
 * (institusjoner, helse/omsorg, kommunale bygg, hotell …) is a new entry here and nothing
 * else: the cards, the grid and the /bedrifter/<slug> routes all read it.
 *
 * Kept in `lib` rather than beside the components because both the page section and the
 * per-solution routes resolve their content from it.
 */

/** One product that is part of a solution. */
export interface SolutionProduct {
  /**
   * The name shown on the card. Written out here rather than read from the CMS so a card
   * never renders an empty chip while a product is unpublished or renamed.
   */
  name: string
  /**
   * Payload slug, when the product is in the catalogue. Used to link the chip to the
   * product page and to resolve its photo once the cards show product images.
   */
  slug?: string
  /** Where this unit sits in the solution ("i leilighetene", "i fellesområdet"). */
  note?: string
}

/**
 * An extra action on a solution card, beside its "Se løsningen" button. The array is empty
 * for every solution today — the per-solution product sheets and offer PDFs do not exist
 * yet. Adding one later is a single entry:
 *
 *   { kind: 'quote', label: 'Be om tilbud' }
 *   { kind: 'file', label: 'Last ned produktark', href: '<blob url>.pdf', action: 'download' }
 */
export interface SolutionAction {
  /**
   * `quote` presets the inquiry form on /bedrifter and scrolls to it; `file` links to a
   * PDF in Blob; `link` is any other destination.
   */
  kind: 'quote' | 'file' | 'link'
  label: string
  /** Required for `file` and `link`. */
  href?: string
  /** `file` only — `download` saves it, `open` opens it in a new tab. */
  action?: 'download' | 'open'
}

export interface BusinessSolution {
  /** Also the URL segment: `/bedrifter/<slug>`. */
  slug: string
  name: string
  /** "Kontor · Hjemmekontor · Administrasjon" */
  category: string
  /** Short USP line above the description. Only the borettslag solution has one today. */
  headline?: string
  description: string
  /** Extra line under the description, set apart from it. */
  note?: string
  products: SolutionProduct[]
  /**
   * The finished floor-plan illustration, in the Blob `Bedrifter` folder. A solution
   * without one renders a placeholder of exactly the same size instead. The files are
   * 16:9 while the card's area is 16:10, so the card fits the whole drawing inside it
   * rather than cropping into the callout circles near its edges.
   *
   * The borettslag file is spelled `Burettslagspakke.webp` in Blob. That is the name it
   * was uploaded under — it is not a typo to fix here.
   */
  illustration?: {
    src: string
    /** Alt text. Falls back to {@link BusinessSolution.plannedIllustration}. */
    alt?: string
  }
  /**
   * What that illustration is to show. Not rendered — it is the brief for the drawing and
   * the fallback alt text once `illustration.src` arrives.
   */
  plannedIllustration: string
  /** Value the inquiry form's dropdown is preset to. One of `INTEREST_OPTIONS`. */
  interestOption: string
  /** Product sheets, offer PDFs and any other extra button. See {@link SolutionAction}. */
  actions: SolutionAction[]
}

/** `/bedrifter/kontorpakke`, and the same for the three others. */
export function solutionHref(solution: Pick<BusinessSolution, 'slug'>): string {
  return `/bedrifter/${solution.slug}`
}

export const BUSINESS_SOLUTIONS: BusinessSolution[] = [
  {
    slug: 'kontorpakke',
    illustration: {
      src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bedrifter/Kontorpakke.webp',
      alt: 'Illustrasjon av aBoks Kontorpakke for kontormiljø',
    },
    name: 'aBoks Kontorpakke',
    category: 'Kontor · Hjemmekontor · Administrasjon',
    description:
      'En komplett løsning for kontorer der batterier brukes på flere arbeidsplasser. aBoks Office gir enkel oppbevaring lokalt, mens aBoks XL fungerer som et felles innsamlingspunkt for brukte batterier.',
    products: [
      { name: 'aBoks Office', slug: 'aboks-office' },
      { name: 'aBoks XL', slug: 'aboks-xl' },
    ],
    plannedIllustration:
      'Plantegning av et kontor: aBoks Office ved arbeidsplassene og aBoks XL i fellesområdet eller korridoren.',
    interestOption: 'Produkter til egen bedrift',
    actions: [],
  },
  {
    slug: 'produksjonspakke',
    illustration: {
      src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bedrifter/Produksjonpakke.webp',
      alt: 'Illustrasjon av aBoks Produksjonspakke for produksjon og lager',
    },
    name: 'aBoks Produksjonspakke',
    category: 'Produksjon · Lager · Verksted',
    description:
      'En fleksibel løsning for produksjonsområder, lager og verksteder. Mindre aBoks-enheter kan plasseres der batteriene brukes, mens aBoks XL fungerer som sentralt innsamlingspunkt.',
    products: [
      { name: 'aBoks', slug: 'aboks' },
      { name: 'aBoks Spesial', slug: 'aboks-spesial' },
      { name: 'aBoks XL', slug: 'aboks-xl' },
    ],
    plannedIllustration:
      'Plantegning av et produksjonslokale: aBoks og aBoks Spesial ved arbeidsområdene, aBoks XL som felles innsamlingspunkt.',
    interestOption: 'Produkter til egen bedrift',
    actions: [],
  },
  {
    slug: 'skolepakke',
    illustration: {
      src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bedrifter/Skolepakke.webp',
      alt: 'Illustrasjon av aBoks Skolepakke for skole og undervisningsmiljø',
    },
    name: 'aBoks Skolepakke',
    category: 'Skole · Barnehage · Undervisning',
    description:
      'En samlet løsning for skoler og undervisningsmiljøer med flere rom og bruksområder. Lokale aBoks-enheter gjør batterihåndteringen enkel der batteriene brukes, mens aBoks XL samler brukte batterier på ett felles sted.',
    products: [
      { name: 'aBoks Office', slug: 'aboks-office' },
      { name: 'aBoks Spesial', slug: 'aboks-spesial' },
      { name: 'aBoks XL', slug: 'aboks-xl' },
    ],
    plannedIllustration:
      'Plantegning av et skolebygg: aBoks Office på lærerværelset og i administrasjonen, aBoks Spesial i øvrige rom og aBoks XL i fellesområdet.',
    interestOption: 'Produkter til egen bedrift',
    actions: [],
  },
  {
    slug: 'borettslagspakke',
    illustration: {
      src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bedrifter/Burettslagspakke.webp',
      alt: 'Illustrasjon av aBoks Borettslagspakke for leiligheter og fellesområde',
    },
    name: 'aBoks Borettslagspakke',
    category: 'Borettslag · Sameier · Boligselskaper',
    headline: 'Fra leiligheten til felles innsamling',
    description:
      'Hver leilighet kan få sin egen aBoks for oppbevaring av batterier hjemme. Når brukte batterier skal leveres videre, samles de i en felles aBoks XL i bygget.',
    note: 'Antall aBoks-enheter tilpasses antall leiligheter og behovet i borettslaget eller sameiet.',
    products: [
      { name: 'aBoks', slug: 'aboks', note: 'i leilighetene' },
      { name: 'aBoks XL', slug: 'aboks-xl', note: 'i fellesområdet' },
    ],
    plannedIllustration:
      'Prinsippskisse av et boligbygg: flere leiligheter med hver sin aBoks, som samles i én aBoks XL i fellesområdet.',
    interestOption: 'Produkter til egen bedrift',
    actions: [],
  },
]

/** Where a solution's route finds its content. */
export function findSolution(slug: string): BusinessSolution | undefined {
  return BUSINESS_SOLUTIONS.find((solution) => solution.slug === slug)
}

/** The four steps of the system, shown above the cards. */
export const SOLUTION_FLOW = [
  {
    number: '01',
    title: 'Der batteriene brukes',
    text: 'aBoks, aBoks Office eller aBoks Spesial plasseres der batteriene brukes og oppbevares.',
  },
  {
    number: '02',
    title: 'Lokal oppbevaring',
    text: 'Brukte batterier får en fast og oversiktlig plass nær arbeidsområdet.',
  },
  {
    number: '03',
    title: 'Felles innsamlingspunkt',
    text: 'aBoks XL fungerer som virksomhetens sentrale innsamlingspunkt.',
  },
  {
    number: '04',
    title: 'Videre til gjenvinning',
    text: 'Batteriene kan samles og leveres videre til godkjent mottak.',
  },
]
