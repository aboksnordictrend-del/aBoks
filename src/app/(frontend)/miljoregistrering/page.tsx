import type { Metadata } from 'next'
import { BEIGE, CREAM } from '../bedrifter/theme'
import { SITE_URL } from '@/lib/site'
import { IMAGES } from './content'
import MiljoHero from './MiljoHero'
import {
  AudienceSection,
  DemoNotice,
  DemoSection,
  DocumentationSection,
  FaqSection,
  FinalCtaSection,
  IntroSection,
  StepsSection,
} from './sections'
import DemoProvider from './demo/DemoProvider'
import RegistrationDemo from './demo/RegistrationDemo'
import DeliveryDemo from './demo/DeliveryDemo'
import StatisticsDemo from './demo/StatisticsDemo'
import ReportDemo from './demo/ReportDemo'

/**
 * aBoks Miljøregistrering — the public landing page, linked from /bedrifter.
 *
 * A server-rendered shell; the only client code is the hero's two scroll links and the demos.
 * The demos run entirely in the browser on fictional data (./demo) and never touch the real
 * registration app under /miljo/[code], its API routes or the database.
 */

const TITLE = 'aBoks Miljøregistrering – Registrering og dokumentasjon av brukte batterier'
const DESCRIPTION =
  'Registrer brukte batterier med QR-kode, følg innsamlingen og dokumenter leveranser med aBoks Miljøregistrering. Prøv den interaktive demoen.'

export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) — the title already carries the brand
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/miljoregistrering' },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/miljoregistrering',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: IMAGES.heroDesktop.src, width: IMAGES.heroDesktop.width, height: IMAGES.heroDesktop.height, alt: IMAGES.heroAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [IMAGES.heroDesktop.src],
  },
  // Indexed and listed in src/app/sitemap.ts.
  robots: { index: true, follow: true },
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Hjem', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Bedrifter', item: `${SITE_URL}/bedrifter` },
    { '@type': 'ListItem', position: 3, name: 'Miljøregistrering', item: `${SITE_URL}/miljoregistrering` },
  ],
}

export default function MiljoregistreringPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <MiljoHero />
      <IntroSection />
      <StepsSection />

      {/* One local demo state shared by registration, delivery, statistics and the report. */}
      <DemoProvider>
        <DemoNotice />
        <DemoSection
          id="prov-demoen"
          eyebrow="Demo 1 · Ansatte"
          title="Prøv å registrere batterier"
          intro="Slik registrerer ansatte brukte batterier med QR-koden på aBoks."
          image={IMAGES.qrBox}
          background={CREAM}
        >
          <RegistrationDemo />
        </DemoSection>
        <DemoSection
          id="demo-levering"
          eyebrow="Demo 2 · Ansvarlig medarbeider"
          title="Prøv å registrere en levering"
          intro="Når innsamlede batterier leveres videre, kan en ansvarlig medarbeider registrere leveransen."
          image={IMAGES.qrOffice}
          reverse
          background={BEIGE}
        >
          <DeliveryDemo />
        </DemoSection>
        <DemoSection
          id="demo-statistikk"
          eyebrow="Demo 3 · Statistikk"
          title="Se hvordan resultatene blir synlige"
          intro="Registreringer og faktiske leveranser vises hver for seg, slik at virksomheten får en tydeligere oversikt over batteriinnsamlingen."
          background={CREAM}
        >
          <StatisticsDemo />
        </DemoSection>
        <DemoSection
          id="rapport"
          eyebrow="Rapportering"
          title="Miljørapport i PDF og CSV"
          intro="Hent ut oversikt over registrerte batterier og dokumenterte leveranser for en valgt periode. Rapportene kan brukes som underlag i virksomhetens miljøarbeid."
          background={BEIGE}
        >
          <ReportDemo />
        </DemoSection>
      </DemoProvider>

      <DocumentationSection />
      <AudienceSection />
      <FaqSection />
      <FinalCtaSection />
    </main>
  )
}
