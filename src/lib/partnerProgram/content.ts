/**
 * Copy for /bli-partner that is not tied to one programme card: the hero, the Salgspartner
 * terms, the process, the benefits, the marketing toolkit and the FAQ.
 *
 * Every statement here describes the programme terms ABOKS AS has set. Where something is
 * decided case by case or in the partner agreement, the copy says so rather than inventing a
 * rule. Nothing here promises income, employment, automated payouts or a partner dashboard.
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
  headline: 'Voks sammen med aBoks',
  subheadline:
    'Anbefal smartere batterihåndtering. Gi kundene gode fordeler. Tjen provisjon på salgene du skaper.',
  primaryCta: 'Bli salgspartner',
  secondaryCta: 'Se hvordan det fungerer',
} as const

/* ────────────────────────────── Salgspartner ────────────────────────────── */

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

export const SALGSPARTNER_TERMS: readonly ProgramTerm[] = [
  {
    icon: 'free',
    title: 'Gratis å søke og delta',
    text: 'Ingen innmeldingsavgift, ingen kjøpsplikt og ingen krav til salgsvolum.',
  },
  {
    icon: 'approval',
    title: 'Godkjenning fra ABOKS AS',
    text: 'Alle søknader vurderes individuelt. Søknaden i seg selv gir ikke partnerstatus.',
  },
  {
    icon: 'contract',
    title: 'Signert partneravtale',
    text: 'Samarbeidet starter når partneravtalen er signert av begge parter.',
  },
  {
    icon: 'code',
    title: 'Personlig partnerkode',
    text: 'Hver godkjente partner får sin egen kode, som knytter salgene til deg.',
  },
  {
    icon: 'discount',
    title: '10 % ekstra rabatt til kunden',
    text: 'Kunden får 10 % rabatt med koden – også i tillegg til gjeldende mengderabatt.',
  },
  {
    icon: 'commission',
    title: '15 % provisjon',
    text: 'Av det kunden faktisk betaler for varene etter alle rabatter. Frakt regnes ikke med.',
  },
  {
    icon: 'repeat',
    title: 'Også på gjenkjøp',
    text: 'Når kunden bruker koden din igjen, gir også det nye kjøpet provisjon.',
  },
  {
    icon: 'self',
    title: 'Egne kjøp teller',
    text: 'Du kan bruke din egen kode og få provisjon etter samme beregning, med forbehold om skattemessig behandling.',
  },
  {
    icon: 'map',
    title: 'Hele Norge',
    text: 'Du kan markedsføre aBoks i hele landet. Det gis ingen geografisk eksklusivitet.',
  },
  {
    icon: 'noStock',
    title: 'Ingen lager eller frakt',
    text: 'Ingen innkjøp, ingen varelager og ikke noe ansvar for forsendelser.',
  },
  {
    icon: 'service',
    title: 'Vi tar oss av resten',
    text: 'ABOKS AS håndterer kasse, betaling, produksjon, levering, returer og kundeservice.',
  },
  {
    icon: 'calendar',
    title: 'Månedlig oppgjør',
    text: 'Provisjon gjøres opp månedlig for ferdigbehandlede og kvalifiserte ordrer.',
  },
]

/** The limits stated next to the terms, so the good news never stands without them. */
export const SALGSPARTNER_CONDITIONS = [
  'Kansellerte og refunderte ordrer gir ikke provisjon. Ved delvis refusjon justeres provisjonen forholdsmessig.',
  'Provisjon opptjenes bare på kvalifiserte salg. Ingen inntekt er garantert.',
  'Frakt inngår aldri i provisjonsgrunnlaget.',
] as const

/* ────────────────────────────── process ────────────────────────────── */

export interface ProcessStep {
  title: string
  text: string
}

export const PROCESS_STEPS: readonly ProcessStep[] = [
  {
    title: 'Send inn søknad',
    text: 'Fyll ut søknadsskjemaet og fortell kort hvordan du ønsker å gjøre aBoks kjent.',
  },
  {
    title: 'Signer partneravtalen',
    text: 'Blir søknaden godkjent, inngår du en partneravtale med ABOKS AS.',
  },
  {
    title: 'Få din personlige partnerkode',
    text: 'Du får en unik kode som kundene dine bruker når de handler.',
  },
  {
    title: 'Del og anbefal aBoks',
    text: 'Anbefal produktene i nettverket ditt, i digitale kanaler eller til forretningskontakter.',
  },
  {
    title: 'Kundene handler på aboks.no',
    text: 'Kunden får rabatten, mens ABOKS AS tar seg av kjøpet og leveringen.',
  },
  {
    title: 'Motta provisjon',
    text: 'Du tjener provisjon på kvalifiserte salg – også når kunden handler igjen med koden.',
  },
]

/* ────────────────────────────── benefits ────────────────────────────── */

export const CUSTOMER_BENEFITS = [
  '10 % ekstra rabatt med partnerkoden',
  'Rabatten gjelder vanlige kjøp og kommer i tillegg til gjeldende mengderabatt for bedrifter',
  'Bestilling direkte på aboks.no',
  'Produktene leveres av ABOKS AS',
  'Ingen mellomledd i kjøpet',
] as const

export const PARTNER_BENEFITS = [
  '15 % provisjon på kvalifiserte salg',
  'Provisjon også ved gjenkjøp med koden',
  'Ingen varelager og ingen forsendelser',
  'Ingen påkrevd investering',
  'Fleksibel markedsføring, i egne kanaler og eget tempo',
  'Mulighet til å introdusere bedriftskunder',
] as const

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
  { title: 'Din partnerkode', text: 'Din personlige kode, klar til å deles.' },
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
      'Salgspartnerprogrammet er åpent for privatpersoner, enkeltpersonforetak og bedrifter. Alle søknader vurderes individuelt av ABOKS AS, og et partnerskap forutsetter at søknaden er godkjent og at partneravtalen er signert.',
  },
  {
    id: 'kostnad',
    question: 'Koster det noe å bli partner?',
    answer:
      'Nei. Det er gratis å søke og gratis å delta. Det er ingen innmeldingsavgift, ingen kjøpsplikt, ingen krav til salgsvolum og ingen krav om å holde varelager.',
  },
  {
    id: 'kode',
    question: 'Hvordan fungerer partnerkoden?',
    answer:
      'Som godkjent partner får du en personlig kode. Kunden skriver inn koden i handlekurven på aboks.no og får 10 % ekstra rabatt på kvalifiserte varer. Når ordren er betalt, registreres kjøpet på koden din, slik at salget knyttes til deg.',
  },
  {
    id: 'bedrift',
    question: 'Får kunden 10 % rabatt også på bedriftsbestillinger?',
    answer:
      'Ja. Partnerrabatten gjelder også bestillinger med mengderabatt, og den beregnes av prisen etter mengderabatten. Eksempel: en bestilling på 50 000 kr med 20 % bedriftsrabatt koster 40 000 kr – med partnerkoden blir prisen 36 000 kr. I nettbutikken trekkes partnerrabatten fra den rabatterte mengdeprisen. For bedriftstilbud som avtales direkte med oss, må partnerkoden og rabatten være med i det avtalte tilbudet eller bekreftes av ABOKS AS.',
  },
  {
    id: 'provisjon',
    question: 'Hvordan beregnes provisjonen?',
    answer:
      'Provisjonen er 15 % av det kunden faktisk betaler for varene etter alle gjeldende rabatter. Frakt regnes ikke med. Eksempel: en ordre på 1 000 kr får 10 % partnerrabatt, og kunden betaler 900 kr for varene. Provisjonen blir 135 kr. På en bedriftsbestilling på 50 000 kr med 20 % bedriftsrabatt betaler kunden 36 000 kr, og provisjonen blir 5 400 kr.',
  },
  {
    id: 'gjenkjop',
    question: 'Får jeg provisjon når kunden handler igjen?',
    answer:
      'Ja, så lenge kunden bruker partnerkoden din også ved det nye kjøpet. Provisjonen knyttes til koden som brukes i kassen, ikke til kunden som person.',
  },
  {
    id: 'egen-kode',
    question: 'Kan jeg bruke min egen partnerkode?',
    answer:
      'Ja. Du får den samme rabatten som kundene dine, og provisjonen beregnes på samme måte som for andre kvalifiserte salg. Vær oppmerksom på at fordeler fra egne kjøp kan ha skattemessige konsekvenser.',
  },
  {
    id: 'lager',
    question: 'Må jeg kjøpe eller lagre produkter?',
    answer:
      'Nei. Du kjøper ikke inn varer og har ikke noe lager eller forsendelsesansvar. Kunden handler direkte på aboks.no, og ABOKS AS tar seg av betaling, produksjon, levering, returer og kundeservice.',
  },
  {
    id: 'utbetaling',
    question: 'Når utbetales provisjonen?',
    answer:
      'Provisjonen gjøres opp månedlig for ordrer som er betalt, ferdigbehandlet og kvalifiserte. Utbetalingsmåte og nærmere vilkår for oppgjøret fastsettes i partneravtalen.',
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
