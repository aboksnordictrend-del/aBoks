import type { TermIcon } from './content'
import { PARTNER_COMMISSION_PERCENT, PARTNER_DISCOUNT_PERCENT } from './calculator'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
} from './methodCalculator'

/**
 * The three earning methods of the ONE aBoks partner programme, as typed data.
 *
 * These are not three programmes: every approved partner signs one partner agreement and may
 * use any method, combine them, or none. The method cards and the tab section on /bli-partner
 * both render this list, so a method's copy lives here and nowhere else.
 *
 * The rates are imported from the calculator modules rather than typed into the copy, so a
 * headline figure can never disagree with the arithmetic beneath it.
 *
 * What is stated, and what deliberately is not:
 *   - Promokode is the implemented programme: the code, the discount and the commission are
 *     tracked automatically by checkout and the commission engine.
 *   - Bedriftssalg and Forhandlersalg have no automated tracking. The copy says that ABOKS AS
 *     registers the customer or retailer on the partner, and never implies a code does it.
 *   - Bedriftssalg promises commission on the order the partner brought in, and nothing about
 *     later orders — those terms are not final.
 *   - Forhandlersalg's commission on later orders is stated for as long as the partner
 *     agreement is in force. Nothing is said about commission after the agreement ends.
 *
 * Public, marketing-facing data only; nothing here is read by checkout.
 */

export type PartnerMethodId = 'promokode' | 'bedriftssalg' | 'forhandlersalg'

export interface MethodFigure {
  /** Short figure or keyword shown large, e.g. «10 %». */
  value: string
  label: string
}

export interface MethodStep {
  title: string
  text: string
}

export interface PartnerMethod {
  id: PartnerMethodId
  /** Card number, «01». */
  number: string
  name: string
  /** The partner's commission, in percent. */
  rate: number
  /** What the rate is a share of — completes «15 % …». */
  rateLabel: string
  icon: TermIcon
  /** One line for the card. */
  tagline: string
  /** Two or three sentences for the tab. */
  summary: string
  figures: MethodFigure[]
  steps: MethodStep[]
  /** Heading for the buyer's side: «For kunden», «For forhandleren» … */
  buyerLabel: string
  buyerBenefits: string[]
  partnerBenefits: string[]
  /** The limits, always shown beside the benefits. */
  conditions: string[]
}

const pct = (n: number) => `${n} %`

export const PARTNER_METHODS: readonly PartnerMethod[] = [
  {
    id: 'promokode',
    number: '01',
    name: 'Promokode',
    rate: PARTNER_COMMISSION_PERCENT,
    rateLabel: 'av betalt vareverdi',
    icon: 'code',
    tagline: `Del din personlige kode. Kunden får ${pct(PARTNER_DISCOUNT_PERCENT)} rabatt på aboks.no.`,
    summary: `Del din personlige promokode med nettverket ditt. Kunden får ${pct(PARTNER_DISCOUNT_PERCENT)} rabatt i nettbutikken, også i tillegg til gjeldende mengderabatt, og du tjener ${pct(PARTNER_COMMISSION_PERCENT)} av det kunden faktisk betaler for varene. Handler kunden igjen med koden, gir også det nye kjøpet provisjon.`,
    figures: [
      { value: pct(PARTNER_DISCOUNT_PERCENT), label: 'rabatt til kunden med koden' },
      { value: pct(PARTNER_COMMISSION_PERCENT), label: 'av det kunden betaler for varene' },
      { value: 'Gjenkjøp', label: 'gir også provisjon når koden brukes' },
    ],
    steps: [
      {
        title: 'Del koden din',
        text: 'Del den personlige koden i egne kanaler, i nettverket ditt eller med bedrifter du kjenner.',
      },
      {
        title: 'Kunden handler på aboks.no',
        text: `Kunden skriver inn koden i handlekurven og får ${pct(PARTNER_DISCOUNT_PERCENT)} rabatt – også i tillegg til mengderabatt.`,
      },
      {
        title: 'Kjøpet registreres på koden',
        text: 'Når ordren er betalt, blir den automatisk knyttet til koden din.',
      },
      {
        title: 'Du får provisjon',
        text: `${pct(PARTNER_COMMISSION_PERCENT)} av det kunden betaler for varene etter alle rabatter, gjort opp månedlig.`,
      },
    ],
    buyerLabel: 'For kunden',
    buyerBenefits: [
      `${pct(PARTNER_DISCOUNT_PERCENT)} ekstra rabatt med promokoden`,
      'Rabatten kommer i tillegg til gjeldende mengderabatt',
      'Bestilling direkte på aboks.no',
      'Produktene leveres av ABOKS AS',
    ],
    partnerBenefits: [
      `${pct(PARTNER_COMMISSION_PERCENT)} provisjon på kvalifiserte salg`,
      'Provisjon også når kunden handler igjen med koden',
      'Salgene registreres automatisk på koden din',
      'Egne kjøp med koden teller, med forbehold om skattemessig behandling',
    ],
    conditions: [
      'Provisjonen knyttes til koden som brukes i kassen, ikke til kunden som person.',
      'Kansellerte og refunderte ordrer gir ikke provisjon. Ved delvis refusjon justeres provisjonen forholdsmessig.',
    ],
  },
  {
    id: 'bedriftssalg',
    number: '02',
    name: 'Bedriftssalg',
    rate: BUSINESS_SALE_COMMISSION_PERCENT,
    rateLabel: 'av endelig betalt vareverdi',
    icon: 'contract',
    tagline: 'Formidle en bestilling til en bedrift, skole, kommune eller organisasjon.',
    summary: `Du finner kunden og forhandler frem bestillingen – for eksempel med en bedrift, en skole, en kommune eller en organisasjon. Kunden får gjeldende mengderabatt, og du tjener ${pct(BUSINESS_SALE_COMMISSION_PERCENT)} av den endelige betalte vareverdien. ABOKS AS bekrefter ordren, fakturerer kunden og produserer og sender varene.`,
    figures: [
      { value: pct(BUSINESS_SALE_COMMISSION_PERCENT), label: 'av endelig betalt vareverdi' },
      { value: 'Mengderabatt', label: 'etter gjeldende priser, når kunden kvalifiserer' },
      { value: 'ABOKS AS', label: 'bekrefter, fakturerer og leverer' },
    ],
    steps: [
      {
        title: 'Finn kunden',
        text: 'Du introduserer aBoks for en virksomhet og avklarer behov, antall og modeller.',
      },
      {
        title: 'Meld inn bestillingen',
        text: 'Du sender kunden og bestillingen til ABOKS AS, som registrerer salget på deg.',
      },
      {
        title: 'ABOKS AS bekrefter og fakturerer',
        text: 'Vi bekrefter ordren, fakturerer kunden direkte og produserer og sender varene.',
      },
      {
        title: 'Du får provisjon',
        text: `Når kunden har betalt, får du ${pct(BUSINESS_SALE_COMMISSION_PERCENT)} av den endelige betalte vareverdien.`,
      },
    ],
    buyerLabel: 'For bedriftskunden',
    buyerBenefits: [
      'Gjeldende mengderabatt ved større antall',
      'Faktura direkte fra ABOKS AS',
      'Ferdige løsninger for kontor, skole og fellesarealer',
      'Produksjon og levering fra ABOKS AS',
    ],
    partnerBenefits: [
      `${pct(BUSINESS_SALE_COMMISSION_PERCENT)} av den endelige betalte vareverdien`,
      'Du håndterer verken betaling, faktura eller varelager',
      'Du kan konsentrere deg om dialogen med kunden',
      'Passer godt for deg med nettverk i næringsliv eller offentlig sektor',
    ],
    conditions: [
      'Promokodens kunderabatt gis ikke i tillegg ved bedriftssalg.',
      'Salget må meldes inn til og bekreftes av ABOKS AS for å bli knyttet til deg. Det registreres ikke automatisk.',
      'Provisjonen gjelder ordren du har formidlet, og beregnes av det kunden faktisk betaler for varene.',
    ],
  },
  {
    id: 'forhandlersalg',
    number: '03',
    name: 'Forhandlersalg',
    rate: RETAILER_COMMISSION_PERCENT,
    rateLabel: 'av forhandlerens betalte innkjøp',
    icon: 'repeat',
    tagline: 'Rekrutter butikker som vil selge aBoks videre til sine kunder.',
    summary: `Du rekrutterer butikker som vil selge aBoks videre. Forhandleren får ${pct(RETAILER_DISCOUNT_PERCENT)} rabatt på ordinær veiledende utsalgspris, og du tjener ${pct(RETAILER_COMMISSION_PERCENT)} av hver betalte innkjøpsordre. Det gjelder også alle senere betalte bestillinger fra forhandleren, inkludert bestillinger den gjør direkte hos ABOKS AS, så lenge partneravtalen din gjelder.`,
    figures: [
      { value: pct(RETAILER_DISCOUNT_PERCENT), label: 'forhandlerrabatt på ordinær veiledende utsalgspris' },
      { value: pct(RETAILER_COMMISSION_PERCENT), label: 'av forhandlerens betalte innkjøp' },
      { value: 'Løpende', label: 'på alle senere betalte bestillinger mens avtalen gjelder' },
    ],
    steps: [
      {
        title: 'Finn butikken',
        text: 'Du introduserer aBoks for en butikk som ønsker å selge produktene videre.',
      },
      {
        title: 'Forhandleren registreres på deg',
        text: 'ABOKS AS registrerer forhandleren og knytter den til deg som partner.',
      },
      {
        title: 'ABOKS AS fakturerer og leverer',
        text: `Forhandleren bestiller med ${pct(RETAILER_DISCOUNT_PERCENT)} rabatt. Vi fakturerer og leverer varene.`,
      },
      {
        title: 'Provisjon på hver betalt ordre',
        text: `Du får ${pct(RETAILER_COMMISSION_PERCENT)} av hver betalte ordre fra forhandleren – også når den bestiller direkte fra ABOKS AS – så lenge partneravtalen gjelder.`,
      },
    ],
    buyerLabel: 'For forhandleren',
    buyerBenefits: [
      `${pct(RETAILER_DISCOUNT_PERCENT)} rabatt på ordinær veiledende utsalgspris`,
      'Fakturering og levering fra ABOKS AS',
      'Kan bestille direkte fra ABOKS AS ved senere innkjøp',
    ],
    partnerBenefits: [
      `${pct(RETAILER_COMMISSION_PERCENT)} av hver betalte innkjøpsordre`,
      'Provisjon på alle senere betalte bestillinger fra forhandleren, så lenge partneravtalen gjelder',
      'Gjelder også bestillinger forhandleren gjør direkte hos ABOKS AS',
      'Ingen lager, fakturering eller levering for deg',
    ],
    conditions: [
      'Rabatten beregnes av ordinær veiledende utsalgspris, ikke av kampanje- eller tilbudspriser, og kan ikke kombineres med mengderabatt eller andre rabatter.',
      'Forhandleren må være registrert hos ABOKS AS og knyttet til deg. Det skjer ikke automatisk via promokoden.',
      'Provisjonen beregnes av det forhandleren faktisk betaler for varene.',
    ],
  },
]

export const methodById = (id: PartnerMethodId): PartnerMethod =>
  PARTNER_METHODS.find((m) => m.id === id) ?? PARTNER_METHODS[0]

export const isPartnerMethodId = (value: unknown): value is PartnerMethodId =>
  PARTNER_METHODS.some((m) => m.id === value)
