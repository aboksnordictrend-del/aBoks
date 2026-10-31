// Copy and images for the /miljoregistrering landing page. Marketing only — the registration app
// itself lives under /miljo/[code].

import type { IconName } from './icons'

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Miljoregistrering'

export const IMAGES = {
  heroDesktop: { src: `${BLOB}/Miljoregistrering-Hero-Desktop.webp`, width: 1658, height: 949 },
  heroMobile: { src: `${BLOB}/Miljoregistrering-Hero-Mobile.webp`, width: 982, height: 1602 },
  heroAlt: 'En ansatt legger brukte batterier i en veggmontert aBoks i et åpent kontorlandskap.',
  qrBox: {
    src: `${BLOB}/Miljoregistrering-aBoks-4x5.webp`,
    alt: 'aBoks med QR-kode for registrering av brukte batterier på et kontorskrivebord. En mobiltelefon skanner QR-koden.',
  },
  qrOffice: {
    src: `${BLOB}/Miljoregistrering-aBoks-Office-4x5.webp`,
    alt: 'aBoks Office med QR-kode og batterirom på et skrivebord med utsikt over fjorden. En mobiltelefon skanner QR-koden.',
  },
} as const

export const HERO = {
  eyebrow: 'aBoks Miljøregistrering',
  headline: 'Fra batteriinnsamling',
  headlineAccent: 'til dokumentert miljøarbeid',
  text: 'Registrer brukte batterier, følg utviklingen og dokumenter leveranser – enkelt og oversiktlig med aBoks Miljøregistrering.',
  primaryCta: 'Prøv demoen',
  secondaryCta: 'Slik fungerer det',
}

export const INTRO = {
  title: 'Gjør batteriinnsamling til et dokumenterbart miljøtiltak',
  paragraphs: [
    'aBoks Miljøregistrering gjør det enklere for virksomheter å registrere brukte batterier, følge utviklingen over tid og dokumentere faktiske leveranser til godkjente mottak.',
    'Ansatte registrerer batterier med en QR-kode, uten innlogging. En ansvarlig medarbeider registrerer leveranser med PIN-kode. Virksomheten får oversikt, statistikk og rapporter som kan brukes i miljøarbeidet.',
  ],
  benefits: [
    { icon: 'qr', title: 'Enkel registrering', text: 'Ansatte skanner QR-koden på aBoks. Ingen konto eller innlogging.' },
    { icon: 'chart', title: 'Oversikt og statistikk', text: 'Registreringer og faktiske leveranser følges hver for seg.' },
    { icon: 'document', title: 'Dokumentasjon', text: 'Hent ut rapporter i PDF og CSV for en valgt periode.' },
  ] satisfies { icon: IconName; title: string; text: string }[],
}

export const STEPS = {
  title: 'Slik fungerer aBoks Miljøregistrering',
  items: [
    {
      icon: 'qr',
      title: 'Registrer batterier',
      text: 'Ansatte skanner QR-koden og registrerer batteriene de legger i beholderen. Ingen konto eller innlogging er nødvendig.',
    },
    {
      icon: 'lock',
      title: 'Registrer levering',
      text: 'Når batteriene leveres videre, registrerer en ansvarlig medarbeider leveransen med PIN-kode.',
    },
    {
      icon: 'chart',
      title: 'Følg resultatene',
      text: 'Virksomheten kan følge registreringer og leveranser over tid og hente ut dokumentasjon i PDF- og CSV-format.',
    },
  ] satisfies { icon: IconName; title: string; text: string }[],
}

export const DOCUMENTATION = {
  title: 'Et konkret miljøtiltak som kan dokumenteres',
  text: 'aBoks Miljøregistrering hjelper virksomheten med å dokumentere registrering og viderelevering av brukte batterier. Oversikten og rapportene kan brukes som støttedokumentasjon i miljøarbeidet, blant annet i forbindelse med Miljøfyrtårn.',
  points: [
    { icon: 'clipboard', text: 'Dokumenter rutiner for batteriinnsamling' },
    { icon: 'chart', text: 'Følg utviklingen over tid' },
    { icon: 'folder', text: 'Samle rapporter og leveranseopplysninger' },
  ] satisfies { icon: IconName; text: string }[],
  disclaimer:
    'aBoks Miljøregistrering er et hjelpemiddel for miljøarbeid og dokumentasjon. Systemet gir ikke i seg selv Miljøfyrtårn-sertifisering eller garanti for at alle krav er oppfylt.',
}

export const AUDIENCES = {
  title: 'En løsning for ulike virksomheter',
  items: [
    { icon: 'building', title: 'Bedrifter', text: 'Gjør batteriinnsamling til en enkel del av arbeidsplassens miljøarbeid.' },
    { icon: 'landmark', title: 'Kommuner', text: 'Samle registrering og dokumentasjon fra kommunale arbeidsplasser.' },
    { icon: 'school', title: 'Skoler', text: 'Gjør batteriinnsamling til et praktisk og lærerikt miljøtiltak.' },
    { icon: 'home', title: 'Borettslag', text: 'Gi beboerne en enkel måte å registrere brukte batterier på.' },
  ] satisfies { icon: IconName; title: string; text: string }[],
}

export const FAQ = [
  {
    id: 'konto',
    question: 'Må ansatte opprette en konto?',
    answer: 'Nei. Ansatte kan registrere batterier ved å skanne virksomhetens QR-kode, uten å opprette konto eller logge inn.',
  },
  {
    id: 'leveranser',
    question: 'Hvordan registreres faktiske leveranser?',
    answer: 'En ansvarlig medarbeider bruker en egen PIN-kode for å registrere når batterier leveres videre.',
  },
  {
    id: 'forskjell',
    question: 'Hva er forskjellen på registrerte og leverte batterier?',
    answer:
      'Registrerte batterier er opplysninger ansatte selv legger inn. Leverte batterier er faktiske leveranser som registreres av en ansvarlig medarbeider. Tallene vises separat.',
  },
  {
    id: 'rapporter',
    question: 'Kan vi hente ut rapporter?',
    answer: 'Ja. Virksomheten kan hente ut rapporter i PDF- og CSV-format.',
  },
  {
    id: 'miljofyrtarn',
    question: 'Kan systemet brukes i Miljøfyrtårn-arbeidet?',
    answer:
      'Ja. Rapportene kan brukes som støttedokumentasjon i miljøarbeidet, men systemet erstatter ikke sertifiseringskravene eller virksomhetens eget ansvar.',
  },
  {
    id: 'pris',
    question: 'Hva koster aBoks Miljøregistrering?',
    answer: 'aBoks Miljøregistrering tilbys foreløpig uten abonnementsavgift til virksomheter som deltar i ordningen.',
  },
  {
    id: 'demo',
    question: 'Er registreringene i demoen ekte?',
    answer: 'Nei. Demoen bruker kun fiktive eksempeldata. Ingenting registreres i det virkelige systemet.',
  },
]

export const FINAL_CTA = {
  title: 'Gjør batteriinnsamling til et dokumenterbart miljøtiltak',
  text: 'Vil dere bruke aBoks Miljøregistrering i virksomheten? Ta kontakt med oss for å komme i gang.',
  primary: { label: 'Kontakt oss', href: '/kontakt' },
  secondary: { label: 'Se løsninger for bedrifter', href: '/bedrifter' },
}
