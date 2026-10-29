/**
 * Content and data for the /batteriboks landing page.
 *
 * The copy for the six models is written for this page, but everything that can change in
 * the CMS — the product title, slug, photo, price, sale window and stock — is read from
 * Payload (see ./batteriboksModels). A model that is unpublished or missing is left out of the grid rather than
 * rendered with an invented price or a broken link.
 */

import type { SaleInfo } from '@/lib/pricing'
import { productStock, variantStock } from '@/lib/stock'
import { absoluteUrl } from '@/lib/site'

export const BATTERIBOKS_PATH = '/batteriboks'

export const BATTERIBOKS_TITLE = 'Batteriboks for AA og AAA – Smart oppbevaring | aBoks'

export const BATTERIBOKS_DESCRIPTION =
  'Oppdag aBoks – en smart batteriboks med egne rom for AA, AAA og brukte batterier. Hold orden på batteriene med praktisk norsk design.'

/**
 * The page's own copy for each model, in the order the grid and the comparison table show
 * them. The battery counts themselves are not written here: the table reads them from each
 * product's `capacity` in the CMS. `aaaInAaRoom` marks a model with no AAA room of its own
 * whose room for new AA also takes AAA (stated on the product's own FAQ).
 */
export const BATTERIBOKS_MODELS: {
  slug: string
  name: string
  copy: string
  tag: string
  aaaInAaRoom?: boolean
}[] = [
  {
    slug: 'aboks',
    name: 'aBoks',
    tag: 'AA · AAA · brukte',
    copy: 'Plass til 20 AA- og 36 AAA-batterier, med et eget rom for brukte. Nye batterier ligger sortert og klare når du trenger dem.',
  },
  {
    slug: 'aboks-mini',
    name: 'aBoks Mini',
    tag: 'AA · brukte',
    copy: 'Plass til opptil 20 AA-batterier og et eget rom for brukte. For deg som bruker mest AA og ikke trenger plass til AAA.',
  },
  {
    slug: 'aboks-nano',
    name: 'aBoks Nano',
    tag: 'AAA · brukte',
    copy: 'Plass til opptil 36 AAA-batterier og et eget rom for brukte. For deg som bruker mest AAA.',
  },
  {
    slug: 'aboks-vegg',
    name: 'aBoks Vegg',
    tag: 'AA · AAA · vegg',
    copy: 'Plass til 20 AA- og 36 AAA-batterier, pluss et eget rom for brukte. Kan monteres på veggen eller stå på en hylle.',
  },
  {
    slug: 'aboks-office',
    name: 'aBoks Office',
    tag: 'Kontor',
    copy: 'Et rom for nye AA-batterier, der du også kan legge AAA, og et eget rom for brukte. I tillegg har Office plass til småting du vil ha lett tilgjengelig på skrivebordet.',
    aaaInAaRoom: true,
  },
  {
    slug: 'aboks-spesial',
    name: 'aBoks Spesial',
    tag: 'Kun brukte',
    copy: 'En liten boks kun for brukte batterier. Kan stå på en hylle eller festes på veggen, uten å ta mye plass.',
  },
  {
    slug: 'aboks-xl',
    name: 'aBoks XL',
    tag: 'Arbeidsplass',
    copy: 'En veggmontert boks kun for brukte batterier. Beregnet for fellesområder, kontorer og andre steder der flere bruker samme innsamlingspunkt.',
  },
]

export const BATTERIBOKS_FAQS: { id: string; question: string; answer: string }[] = [
  {
    id: 'hva-er',
    question: 'Hva er en batteriboks?',
    answer:
      'En batteriboks er en beholder som brukes til å organisere og oppbevare batterier. Noen modeller er laget for nye batterier, andre for brukte batterier. aBoks kombinerer begge funksjonene i én praktisk løsning.',
  },
  {
    id: 'aa-aaa',
    question: 'Kan jeg oppbevare både AA- og AAA-batterier i aBoks?',
    answer:
      'Ja. Standardmodellen har separate rom for 20 nye AA- og 36 nye AAA-batterier, samt et eget rom for brukte. aBoks Vegg har samme inndeling. I aBoks Office kan AAA legges i rommet for nye AA-batterier.',
  },
  {
    id: 'bare-aa-aaa',
    question: 'Hvilken batteriboks passer hvis jeg bare bruker AA eller AAA?',
    answer:
      'aBoks Mini har plass til opptil 20 nye AA-batterier, mens aBoks Nano har plass til opptil 36 nye AAA-batterier. Begge har et eget rom for brukte batterier.',
  },
  {
    id: 'nye-brukte',
    question: 'Kan nye og brukte batterier oppbevares sammen?',
    answer:
      'Nye og brukte batterier bør holdes adskilt. aBoks har separate rom som gjør dette enkelt.',
  },
  {
    id: 'kun-brukte',
    question: 'Finnes det en boks bare for brukte batterier?',
    answer:
      'Ja. aBoks Spesial er en liten boks for brukte batterier som kan stå på en hylle eller festes på veggen. aBoks XL er en større, veggmontert modell for fellesområder og arbeidsplasser.',
  },
  {
    id: 'litium',
    question: 'Kan jeg legge litiumbatterier i aBoks?',
    answer:
      'Nei. aBoks er ikke beregnet for litiumbatterier. Dette gjelder også litiumbatterier i AA- eller AAA-format.',
  },
  {
    id: 'levere',
    question: 'Hvor kan jeg levere brukte batterier?',
    answer:
      'Brukte husholdningsbatterier kan leveres til butikker som tar imot batterier eller til godkjente gjenvinningsstasjoner.',
  },
  {
    id: 'bedrift',
    question: 'Finnes det batteribokser for kontorer og bedrifter?',
    answer:
      'Ja. aBoks tilbyr blant annet aBoks Office og aBoks XL, som kan brukes til å organisere batterier og etablere praktiske innsamlingspunkter på arbeidsplasser.',
  },
]

export function buildFaqJsonLd(faqs = BATTERIBOKS_FAQS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }
}

export function buildWebPageJsonLd(imageUrl: string) {
  const url = absoluteUrl(BATTERIBOKS_PATH)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: BATTERIBOKS_TITLE,
    description: BATTERIBOKS_DESCRIPTION,
    inLanguage: 'nb-NO',
    isPartOf: { '@id': `${absoluteUrl('/')}#website` },
    primaryImageOfPage: { '@type': 'ImageObject', url: imageUrl },
  }
}

/** One card in the model grid, as the page draws it. */
export interface BatteriboksModel {
  slug: string
  name: string
  tag: string
  copy: string
  href: string
  image: string
  imageAlt: string
  price: number
  sale: SaleInfo
  soldOut: boolean
  /** The product's own capacity numbers from the CMS; 0 means the model has no such room. */
  capacity: { aa: number; aaa: number; usedCompartments: number }
  aaaInAaRoom: boolean
}

/** One row of the "Sammenlign aBoks-modellene" table, as the cells print it. */
export interface ComparisonRow {
  slug: string
  name: string
  aa: string
  aaa: string
  used: string
}

export const AAA_IN_AA_ROOM_LABEL = 'Kan legges sammen med AA'
export const USED_ONLY_LABEL = 'Kun brukte'

/** A model with a used room and no room for new batteries is a used-only box. */
export function comparisonRow(
  model: Pick<BatteriboksModel, 'slug' | 'name' | 'capacity' | 'aaaInAaRoom'>,
): ComparisonRow {
  const { aa, aaa, usedCompartments } = model.capacity
  let used = '–'
  if (usedCompartments > 0) used = aa === 0 && aaa === 0 ? USED_ONLY_LABEL : 'Eget rom'
  return {
    slug: model.slug,
    name: model.name,
    aa: aa > 0 ? String(aa) : '–',
    aaa: aaa > 0 ? String(aaa) : model.aaaInAaRoom && aa > 0 ? AAA_IN_AA_ROOM_LABEL : '–',
    used,
  }
}

/**
 * The note under the table, written only about the models the table actually shows. With
 * Office, Spesial and XL all published it reads exactly as the approved copy.
 */
export function comparisonNote(rows: readonly ComparisonRow[]): string {
  const sentences = rows
    .filter((r) => r.aaa === AAA_IN_AA_ROOM_LABEL)
    .map((r) => `I ${r.name} kan du legge AAA-batterier i rommet for nye AA-batterier, men modellen har ikke et eget AAA-rom.`)
  // "aBoks Spesial og XL": the brand is written once, on the first name.
  const usedOnly = rows
    .filter((r) => r.used === USED_ONLY_LABEL)
    .map((r, i) => (i === 0 ? r.name : r.name.replace(/^aBoks /, '')))
  if (usedOnly.length > 0) {
    const names =
      usedOnly.length === 1 ? usedOnly[0] : `${usedOnly.slice(0, -1).join(', ')} og ${usedOnly[usedOnly.length - 1]}`
    sentences.push(`${names} er beregnet kun for brukte batterier.`)
  }
  return sentences.join(' ')
}

/**
 * Sold out by the shop's one stock rule (see @/lib/stock): a product with variants is sold
 * out when every variant is; a product without variants answers from its own stock.
 */
export function isModelSoldOut(
  product: { stock?: number | null },
  variants: readonly { inventory?: number | null }[],
): boolean {
  if (variants.length === 0) return productStock(product) <= 0
  return variants.every((v) => variantStock(v) <= 0)
}
