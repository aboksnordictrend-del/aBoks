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

/** The page's own copy for each model, in the order the grid shows them. */
export const BATTERIBOKS_MODELS: { slug: string; name: string; copy: string; tag: string }[] = [
  {
    slug: 'aboks',
    name: 'aBoks',
    tag: 'AA · AAA · brukte',
    copy: 'Den komplette løsningen for hjemmet – med oppbevaring for nye AA- og AAA-batterier og et eget rom for brukte batterier.',
  },
  {
    slug: 'aboks-mini',
    name: 'aBoks Mini',
    tag: 'AA',
    copy: 'En kompakt løsning for deg som hovedsakelig bruker AA-batterier.',
  },
  {
    slug: 'aboks-nano',
    name: 'aBoks Nano',
    tag: 'AAA',
    copy: 'En liten og praktisk modell for AAA-batterier.',
  },
  {
    slug: 'aboks-vegg',
    name: 'aBoks Vegg',
    tag: 'Veggmontert',
    copy: 'En veggmontert løsning som hjelper deg med å holde batteriene organisert uten å bruke plass på bord eller hyller.',
  },
  {
    slug: 'aboks-office',
    name: 'aBoks Office',
    tag: 'Kontor',
    copy: 'En multifunksjonell løsning for kontor og hjemmekontor, med batterioppbevaring, plass til kontorutstyr og integrert telefonstøtte.',
  },
  {
    slug: 'aboks-xl',
    name: 'aBoks XL',
    tag: 'Arbeidsplass',
    copy: 'En større veggmontert løsning for innsamling av brukte batterier, utviklet med tanke på arbeidsplasser og fellesområder.',
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
      'Ja. Standardmodellen aBoks har egne rom for nye AA- og AAA-batterier og et separat rom for brukte batterier.',
  },
  {
    id: 'nye-brukte',
    question: 'Kan nye og brukte batterier oppbevares sammen?',
    answer:
      'Nye og brukte batterier bør holdes adskilt. aBoks har separate rom som gjør dette enkelt.',
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
