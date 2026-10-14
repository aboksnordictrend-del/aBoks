import type { Metadata } from 'next'
import { getBedrifterProducts } from '@/lib/bedrifterProducts'
import { buildPriceTableRows, hasQuantityPricing } from '@/lib/quantityPricing'
import { SITE_URL } from '@/lib/site'
import { PARTNER_HERO_IMAGE } from '@/lib/partnerProgram/content'
import { indexableSolutions } from '@/lib/solutions'
import { methodById } from '@/lib/partnerProgram/methods'
import PartnerHero from './PartnerHero'
import MethodCards from './MethodCards'
import MethodTabs from './MethodTabs'
import MethodPanel from './MethodPanel'
import PromoExample from './PromoExample'
import CommissionCalculator from './CommissionCalculator'
import BusinessSaleDetails, { type CorporateTierTable } from './BusinessSaleDetails'
import { BusinessSaleCalculator, RetailerCalculator, type CalculatorProduct } from './SaleCalculators'
import ProcessTimeline from './ProcessTimeline'
import SharedTermsSection from './SharedTermsSection'
import ToolkitSection from './ToolkitSection'
import PartnerFaq from './PartnerFaq'
import ApplicationSection from './ApplicationSection'

export const revalidate = 3600

const TITLE = 'Bli aBoks-partner | Én avtale, tre måter å tjene på | ABOKS AS'
const DESCRIPTION =
  'Ett partnerprogram med tre metoder: promokode (15 %), bedriftssalg (25 %) og forhandlersalg (15 %). Én søknad og én avtale. Gratis å søke, ingen salgskrav og ingen varelager.'
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

  // The calculators' model list: every box with quantity pricing, at its live CMS price.
  const calculatorProducts: CalculatorProduct[] = products
    .filter((p) => hasQuantityPricing(p))
    .map((p) => ({ slug: p.slug, title: p.title, price: p.price, sale: p.sale }))
  const solutions = indexableSolutions().map((s) => ({ slug: s.slug, title: s.title }))

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PartnerHero />
      <MethodCards />
      <MethodTabs
        panels={{
          promokode: (
            <MethodPanel method={methodById('promokode')}>
              <PromoExample />
              <CommissionCalculator />
            </MethodPanel>
          ),
          bedriftssalg: (
            <MethodPanel method={methodById('bedriftssalg')}>
              <BusinessSaleCalculator products={calculatorProducts} />
              <BusinessSaleDetails tiers={tiers} solutions={solutions} />
            </MethodPanel>
          ),
          forhandlersalg: (
            <MethodPanel method={methodById('forhandlersalg')}>
              <RetailerCalculator products={calculatorProducts} />
            </MethodPanel>
          ),
        }}
      />
      <ProcessTimeline />
      <SharedTermsSection />
      <ToolkitSection />
      <PartnerFaq />
      <ApplicationSection />
    </main>
  )
}
