import type { Metadata } from 'next'
import { getBedrifterProducts } from '@/lib/bedrifterProducts'
import { buildPriceTableRows, hasQuantityPricing } from '@/lib/quantityPricing'
import { SITE_URL } from '@/lib/site'
import { PARTNER_HERO_IMAGE } from '@/lib/partnerProgram/content'
import PartnerHero from './PartnerHero'
import ProgramCards from './ProgramCards'
import SalgspartnerSection from './SalgspartnerSection'
import ProcessTimeline from './ProcessTimeline'
import BenefitsPanels from './BenefitsPanels'
import CommissionCalculator from './CommissionCalculator'
import CorporateSection, { type CorporateTierTable } from './CorporateSection'
import ToolkitSection from './ToolkitSection'
import PartnerFaq from './PartnerFaq'
import ApplicationSection from './ApplicationSection'

export const revalidate = 3600

const TITLE = 'Bli aBoks-partner | Tjen 15 % provisjon | ABOKS AS'
const DESCRIPTION =
  'Bli salgspartner hos aBoks. Gi kundene 10 % rabatt og tjen 15 % provisjon på kvalifiserte salg. Gratis å søke for privatpersoner og bedrifter.'
const OG_IMAGE = PARTNER_HERO_IMAGE.desktop || '/images/hero-desktop.webp'

export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) — the title already carries the brand
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/bli-partner' },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/bli-partner',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, alt: 'aBoks partnerprogram' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
}

/** Products whose real price tables the corporate section shows, in this order. */
const TIER_TABLE_SLUGS = ['aboks-office', 'aboks-spesial', 'aboks-xl']

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Hjem', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Bli partner', item: `${SITE_URL}/bli-partner` },
  ],
}

export default async function BliPartnerPage() {
  // The same catalogue /bedrifter reads, priced by the shared quantity-pricing engine. A CMS
  // failure yields an empty list and the section simply omits its price tables.
  const products = await getBedrifterProducts()
  const tiers: CorporateTierTable[] = TIER_TABLE_SLUGS.flatMap((slug) => {
    const product = products.find((p) => p.slug === slug)
    return product && hasQuantityPricing(product) ? [product] : []
  }).map((p) => ({
    title: p.title,
    slug: p.slug,
    rows: buildPriceTableRows({ slug: p.slug, price: p.price, sale: p.sale }),
  }))

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PartnerHero />
      <ProgramCards />
      <SalgspartnerSection />
      <ProcessTimeline />
      <BenefitsPanels />
      <CommissionCalculator />
      <CorporateSection tiers={tiers} />
      <ToolkitSection />
      <PartnerFaq />
      <ApplicationSection />
    </main>
  )
}
