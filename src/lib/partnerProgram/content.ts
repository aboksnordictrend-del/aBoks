/**
 * Copy for /bli-partner that is shared by all three earning methods: the hero, the terms every
 * partner has in common, the process, the marketing toolkit and the FAQ. Method-specific copy
 * lives in `./methods`.
 *
 * Every statement here describes the programme terms ABOKS AS has set. Where something is
 * decided case by case or in the partner agreement, the copy says so rather than inventing a
 * rule. Nothing here promises income, employment, automated payouts, a partner dashboard or
 * automated tracking of business or retailer sales.
 */

/* ────────────────────────────── hero ────────────────────────────── */

/**
 * Hero background images (Vercel Blob, folder «Bli-Partner»).
 *
 * To replace them, change these two URLs — nothing else references the files. Leave a value
 * as an empty string to fall back to the gradient hero instead of a broken image.
 */
export const PARTNER_HERO_IMAGE = {
  desktop:
    'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bli-Partner/Bli-Partner-Hero-Desktop.webp',
  mobile:
    'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bli-Partner/Bli-Partner-Hero-Mobile.webp',
  alt: '',
} as const

export const PARTNER_HERO = {
  eyebrow: 'ABOKS AS · PARTNERPROGRAM',
  /** Rendered on two lines; the second is set in the accent style. */
  headline: 'Én partneravtale.',
  headlineAccent: 'Tre måter å tjene på.',
  subheadline:
    'Del din personlige promokode, formidle salg til bedrifter eller rekrutter forhandlere. Bruk én metode eller kombiner alle tre – i ditt eget tempo.',
  primaryCta: 'Søk om partnerskap',
  secondaryCta: 'Se de tre metodene',
  points: ['Gratis å søke', 'Ingen salgskrav', 'Ingen varelager'],
} as const

/* ────────────────────────────── shared terms ────────────────────────────── */

export const OPEN_TO = ['Privatpersoner', 'Enkeltpersonforetak', 'Bedrifter'] as const

export type TermIcon =
  | 'free'
  | 'approval'
  | 'contract'
  | 'code'
  | 'discount'
  | 'commission'
  | 'repeat'
  | 'self'
  | 'map'
  | 'noStock'
  | 'service'
  | 'calendar'

export interface ProgramTerm {
  icon: TermIcon
  title: string
  text: string
}

/** What every partner gets and agrees to, whichever methods they use. */
export const SHARED_TERMS: readonly ProgramTerm[] = [
  {
    icon: 'contract',
    title: 'Én partneravtale',
    text: 'Én signert avtale gir tilgang til alle tre metodene. Du søker bare én gang.',
  },
  {
    icon: 'free',
    title: 'Gratis å søke og delta',
    text: 'Ingen innmeldingsavgift, ingen kjøpsplikt og ingen oppstartskostnader.',
  },
  {
    icon: 'self',
    title: 'Ingen salgs- eller aktivitetskrav',
    text: 'Du velger selv om, når og hvordan du er aktiv. Det finnes ingen minstekrav til salg.',
  },
  {
    icon: 'approval',
    title: 'Godkjenning fra ABOKS AS',
    text: 'Alle søknader vurderes individuelt. Søknaden i seg selv gir ikke partnerstatus.',
  },
  {
    icon: 'code',
    title: 'Personlig promokode',
    text: 'Alle godkjente partnere får sin egen kode – også om du mest jobber med bedrifter eller butikker.',
  },
  {
    icon: 'map',
    title: 'Hele Norge',
    text: 'Du kan markedsføre aBoks i hele landet. Det gis ingen geografisk eksklusivitet.',
  },
  {
    icon: 'noStock',
    title: 'Ingen lager eller frakt',
    text: 'Ingen innkjøp, ingen varelager og ikke noe ansvar for betaling eller forsendelser.',
  },
  {
    icon: 'service',
    title: 'Vi tar oss av resten',
    text: 'ABOKS AS håndterer betaling, fakturering, produksjon, levering, returer og kundeservice.',
  },
]

/** The limits stated next to the shared terms, so the good news never stands without them. */
export const SHARED_CONDITIONS = [
  'Provisjon opptjenes bare på kvalifiserte, betalte salg. Kansellerte og refunderte ordrer gir ikke provisjon. Ingen inntekt er garantert.',
  'Provisjonen beregnes av betalt vareverdi. Frakt og eventuelle avgifter som faktureres i tillegg, inngår aldri i grunnlaget.',
  'Deltakelsen er frivillig, men partneravtalen inneholder vilkår som gjelder for samarbeidet, blant annet om markedsføring og oppgjør.',
] as const

/* ────────────────────────────── process ────────────────────────────── */

export interface ProcessStep {
  title: string
  text: string
}

export const PROCESS_STEPS: readonly ProcessStep[] = [
  {
    title: 'Send inn én søknad',
    text: 'Fyll ut søknadsskjemaet og fortell kort hvordan du ønsker å gjøre aBoks kjent.',
  },
  {
    title: 'Signer partneravtalen',
    text: 'Blir søknaden godkjent, inngår du én partneravtale med ABOKS AS som dekker alle tre metodene.',
  },
  {
    title: 'Få koden og materiellet',
    text: 'Du får din personlige promokode og tilgang til markedsføringsmateriell.',
  },
  {
    title: 'Velg hvordan du vil jobbe',
    text: 'Del koden, formidle bedriftssalg, rekrutter forhandlere – eller kombiner metodene.',
  },
  {
    title: 'ABOKS AS tar seg av ordren',
    text: 'Vi håndterer betaling, fakturering, produksjon og levering.',
  },
  {
    title: 'Motta provisjon',
    text: 'Du får provisjon på kvalifiserte, betalte salg etter satsen for metoden som er brukt.',
  },
]

/* ────────────────────────────── corporate ────────────────────────────── */

export const CORPORATE_SEGMENTS = [
  'Kontorer og bedrifter',
  'Skoler og utdanningsinstitusjoner',
  'Kommunale virksomheter',
  'Produksjonsanlegg',
  'Borettslag og sameier',
  'Andre organisasjoner',
] as const

/* ────────────────────────────── toolkit ────────────────────────────── */

export const TOOLKIT_ITEMS = [
  { title: 'Produktbilder', text: 'Bilder av produktene til bruk i egne kanaler.' },
  { title: 'Godkjente tekster', text: 'Markedsføringstekster du kan bruke direkte.' },
  { title: 'Produktbeskrivelser', text: 'Fakta om modeller, farger og bruksområder.' },
  { title: 'Digitalt materiell', text: 'Materiell tilpasset sosiale medier og nett.' },
  { title: 'Produktinformasjon', text: 'Veiledning om bruk og plassering av aBoks.' },
  { title: 'Din promokode', text: 'Din personlige kode, klar til å deles.' },
] as const

/* ────────────────────────────── FAQ ────────────────────────────── */

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export const PARTNER_FAQ: readonly FaqItem[] = [
  {
    id: 'hvem',
    question: 'Hvem kan bli aBoks-partner?',
    answer:
      'Partnerprogrammet er åpent for privatpersoner, enkeltpersonforetak og bedrifter. Alle søknader vurderes individuelt av ABOKS AS, og et partnerskap forutsetter at søknaden er godkjent og at partneravtalen er signert.',
  },
  {
    id: 'en-avtale',
    question: 'Må jeg søke om hver metode for seg?',
    answer:
      'Nei. Du sender én søknad og inngår én partneravtale. Som godkjent partner har du tilgang til alle tre metodene – promokode, bedriftssalg og forhandlersalg – og kan bruke én, flere, alle eller ingen av dem. Det finnes ingen obligatoriske salgsmål eller aktivitetskrav.',
  },
  {
    id: 'krav',
    question: 'Må jeg selge et bestemt antall eller være aktiv hele tiden?',
    answer:
      'Nei. Det er frivillig hvilke metoder du bruker og hvor aktiv du er, og programmet har ingen salgsmål, aktivitetskrav eller krav om eksklusivitet. Partneravtalen inneholder likevel vilkår som gjelder for samarbeidet, for eksempel om markedsføring og oppgjør.',
  },
  {
    id: 'kostnad',
    question: 'Koster det noe å bli partner?',
    answer:
      'Nei. Det er gratis å søke og gratis å delta. Det er ingen innmeldingsavgift, ingen kjøpsplikt, ingen krav til salgsvolum og ingen krav om å holde varelager.',
  },
  {
    id: 'provisjon',
    question: 'Hvordan beregnes provisjonen?',
    answer:
      'Provisjonen beregnes alltid av det kunden faktisk betaler for varene etter rabatter. Frakt og eventuelle avgifter som faktureres i tillegg, regnes ikke med. Satsene er 15 % for promokode, 25 % for bedriftssalg og 15 % for forhandlersalg. Eksempel med promokode: en ordre på 1 000 kr får 10 % rabatt, kunden betaler 900 kr for varene, og provisjonen blir 135 kr.',
  },
  {
    id: 'kode',
    question: 'Hvordan fungerer promokoden?',
    answer:
      'Som godkjent partner får du en personlig kode. Kunden skriver inn koden i handlekurven på aboks.no og får 10 % rabatt på kvalifiserte varer. Når ordren er betalt, registreres kjøpet på koden din, slik at salget knyttes til deg.',
  },
  {
    id: 'bedrift',
    question: 'Får kunden 10 % rabatt også på bedriftsbestillinger med promokoden?',
    answer:
      'Ja, når kunden selv bestiller i nettbutikken med koden din. Rabatten beregnes da av prisen etter mengderabatten. Eksempel: en bestilling på 50 000 kr med 20 % bedriftsrabatt koster 40 000 kr – med promokoden blir prisen 36 000 kr. For bedriftstilbud som avtales direkte med oss, må promokoden og rabatten være med i det avtalte tilbudet eller bekreftes av ABOKS AS.',
  },
  {
    id: 'forskjell',
    question: 'Hva er forskjellen på promokode og bedriftssalg?',
    answer:
      'Med promokoden handler kunden selv på aboks.no, får 10 % rabatt i tillegg til gjeldende mengderabatt, og du får 15 % av det kunden betaler for varene. Ved bedriftssalg er det du som finner kunden og forhandler frem bestillingen, mens ABOKS AS bekrefter ordren og fakturerer kunden. Kunden får gjeldende mengderabatt, men ingen ekstra rabatt fra promokoden, og du får 25 % av den endelige betalte vareverdien.',
  },
  {
    id: 'forhandler',
    question: 'Hvordan fungerer forhandlersalg?',
    answer:
      'Du introduserer aBoks for en butikk som vil selge produktene videre. Forhandleren registreres hos ABOKS AS og knyttes til deg. Forhandleren får 35 % rabatt beregnet av ordinær veiledende utsalgspris – aldri av kampanje- eller tilbudspriser. Rabatten kommer i stedet for mengderabatt og andre rabatter, ikke i tillegg. ABOKS AS fakturerer og leverer. Du får 15 % av det forhandleren faktisk betaler for varene, på hver betalte bestilling fra forhandleren – også bestillinger den gjør direkte hos ABOKS AS – så lenge partneravtalen din gjelder.',
  },
  {
    id: 'registrering',
    question: 'Hvordan knyttes bedriftskunder og forhandlere til meg?',
    answer:
      'Salg med promokoden registreres på koden din når ordren er betalt. Bedriftssalg og forhandlere knyttes ikke til deg via koden: Du melder dem inn til ABOKS AS, som registrerer dem på deg. Et salg eller en forhandler som ikke er registrert på deg, gir ikke provisjon.',
  },
  {
    id: 'gjenkjop',
    question: 'Får jeg provisjon når kunden handler igjen?',
    answer:
      'Med promokoden: ja, så lenge kunden bruker koden din også ved det nye kjøpet. For forhandlere du har rekruttert: ja, du får 15 % av hver senere betalte bestilling fra forhandleren som er registrert på deg, også når forhandleren bestiller direkte fra ABOKS AS, så lenge partneravtalen din gjelder. Ved bedriftssalg gjelder provisjonen ordren du har formidlet.',
  },
  {
    id: 'egen-kode',
    question: 'Kan jeg bruke min egen promokode?',
    answer:
      'Ja. Du får den samme rabatten som kundene dine, og provisjonen beregnes på samme måte som for andre kvalifiserte salg. Vær oppmerksom på at fordeler fra egne kjøp kan ha skattemessige konsekvenser.',
  },
  {
    id: 'lager',
    question: 'Må jeg kjøpe, lagre eller sende produkter?',
    answer:
      'Nei. Du kjøper ikke inn varer og har ikke noe lager eller forsendelsesansvar. ABOKS AS tar seg av betaling, fakturering, produksjon, levering, returer og kundeservice – uansett hvilken metode du bruker.',
  },
  {
    id: 'utbetaling',
    question: 'Når utbetales provisjonen?',
    answer:
      'Provisjon fra promokoden gjøres opp månedlig for ordrer som er betalt, ferdigbehandlet og kvalifiserte. Utbetalingsmåte og nærmere vilkår for oppgjøret fastsettes i partneravtalen.',
  },
  {
    id: 'opptjening',
    question: 'Når opptjenes provisjonen ved bedriftssalg og forhandlersalg?',
    answer:
      'Først når ABOKS AS har mottatt betaling fra kunden eller forhandleren. En ordre som ikke er betalt, gir ikke provisjon. Kansellerte og refunderte ordrer gir ikke endelig provisjon, og ved delvis refusjon justeres provisjonen forholdsmessig.',
  },
  {
    id: 'hele-norge',
    question: 'Kan jeg markedsføre aBoks i hele Norge?',
    answer:
      'Ja. Du kan anbefale aBoks i hele landet. Det gis ingen geografisk eksklusivitet, så flere partnere kan være aktive i samme område.',
  },
  {
    id: 'retur',
    question: 'Hvordan håndteres returer og kanselleringer?',
    answer:
      'Kansellerte og refunderte ordrer gir ikke provisjon. Ved delvis refusjon justeres provisjonen forholdsmessig. Dersom en ordre refunderes etter at provisjonen er gjort opp, håndteres det etter vilkårene i partneravtalen.',
  },
  {
    id: 'skatt',
    question: 'Hvordan fungerer skatt og rapportering?',
    answer:
      'Provisjon er normalt skattepliktig inntekt. For bedrifter og enkeltpersonforetak inngår provisjonen i virksomhetens regnskap. For privatpersoner avhenger utbetaling og innrapportering av gjeldende norske skatte- og arbeidsrettslige regler. ABOKS AS rapporterer utbetalinger slik regelverket krever. Vi anbefaler at du avklarer din egen situasjon med Skatteetaten eller en regnskapsfører.',
  },
  {
    id: 'annen-jobb',
    question: 'Kan jeg kombinere partnerskapet med annen jobb?',
    answer:
      'Ja. Programmet stiller ingen krav til tidsbruk eller salgsvolum. Du er selv ansvarlig for å sjekke om arbeidsavtalen din har bestemmelser om bierverv eller lojalitet som kan ha betydning.',
  },
  {
    id: 'ansatt',
    question: 'Er jeg ansatt i ABOKS AS?',
    answer:
      'Nei. Partnerskapet er ikke et ansettelsesforhold, og det gir ikke lønn, feriepenger eller andre ansattgoder. Hvordan samarbeidet behandles rettslig og skattemessig, avhenger av de faktiske forholdene og gjeldende regler, og reguleres nærmere i partneravtalen.',
  },
  {
    id: 'avslutte',
    question: 'Hvordan avslutter jeg partnerskapet?',
    answer:
      'Partnerskapet kan avsluttes etter oppsigelsesvilkårene i partneravtalen. Ta kontakt med oss på post@aboks.no. Provisjon for kvalifiserte salg før avslutningen gjøres opp etter avtalen.',
  },
]

export const CALCULATOR_DISCLAIMER =
  'Eksemplene er illustrasjoner, ikke en garanti for inntekt. Provisjon beregnes av det kunden faktisk betaler for varene etter alle rabatter, ekskl. frakt. Produksjonskostnader og øvrige driftskostnader er ikke trukket fra.'
