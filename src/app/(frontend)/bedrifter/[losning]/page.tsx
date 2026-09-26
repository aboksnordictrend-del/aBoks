import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BUSINESS_SOLUTIONS, findSolution } from '@/lib/bedrifterSolutions'
import { solutionPageContent } from '@/lib/solutions'
import type { ConfigurableProduct, SolutionPageContent } from '@/lib/solutions/types'
import { getProductBySlug, getVariantsForProduct } from '@/lib/payload'
import { parseQuantityParam } from '@/lib/solutions/quantity'
import SolutionPageView from '../solution/SolutionPageView'
import {
  BORDER_WARM,
  CREAM,
  INK,
  MUTED,
  SAGE,
  SANS,
  SERIF,
  SOFT,
  eyebrowStyle,
  primaryButton,
  secondaryButton,
} from '../theme'

/**
 * One business solution — `/bedrifter/kontorpakke` and the three others.
 *
 * A solution whose page has been written renders it from its content module in
 * `lib/solutions`; one that has not keeps the "Mer informasjon kommer" placeholder, so the
 * "Se løsningen" buttons on /bedrifter always lead somewhere real. Publishing the next
 * package is a content module and nothing on this route.
 *
 * `dynamicParams = false` keeps this to the four known slugs: anything else is a 404
 * rather than an empty solution page.
 */
export const dynamicParams = false
export const revalidate = 3600

export function generateStaticParams() {
  return BUSINESS_SOLUTIONS.map((solution) => ({ losning: solution.slug }))
}

/** Payload upload fields arrive either as an id string or as a populated media doc. */
function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val)
    return String((val as { url?: string }).url ?? '')
  return ''
}

/** What a URL can carry into the page. Next hands repeated parameters over as an array. */
type SolutionSearchParams = Record<string, string | string[] | undefined>

/**
 * The configurator's products, read from the catalogue by the slugs the content module
 * names — through the very same helpers the product pages use, so there is one source for
 * the price, the colours and the stock.
 *
 * A slug that does not resolve is skipped rather than fatal: a page that explains the
 * solution and takes an inquiry is better than a 500 because one product is unpublished.
 *
 * `query` is how the calculator on /bedrifter hands a recommendation over: one parameter per
 * product, named by that product's own slug. It is read generically — the solution already
 * knows which products it has, so nothing here knows about any particular one — and a
 * parameter that is not a plain quantity is ignored, leaving the solution's own default.
 * Unknown parameters are never looked at.
 */
async function getConfigurableProducts(
  content: SolutionPageContent,
  query: SolutionSearchParams,
): Promise<ConfigurableProduct[]> {
  const resolved = await Promise.all(
    content.configurator.productSlugs.map(async (slug): Promise<ConfigurableProduct | null> => {
      try {
        const doc = await getProductBySlug(slug)
        if (!doc) return null

        const variants = await getVariantsForProduct(String(doc.id))
        const firstImage = (doc.images as { image?: unknown; alt?: string }[] | undefined)?.[0]

        return {
          id: String(doc.id),
          slug: String(doc.slug ?? slug),
          title: doc.title,
          tagline: doc.tagline ?? '',
          price: doc.price ?? 0,
          sale: {
            salePrice: doc.salePrice ?? null,
            saleStartDate: doc.saleStartDate ?? null,
            saleEndDate: doc.saleEndDate ?? null,
          },
          image: firstImage ? mediaUrl(firstImage.image) : '',
          imageAlt: firstImage?.alt ?? doc.title,
          // The URL wins over the solution's default, and only when it says something
          // usable. Resolved on the server, so the configurator's first paint already shows
          // the recommended quantity rather than counting up from 0 after hydration.
          defaultQuantity:
            parseQuantityParam(query[slug]) ?? content.configurator.defaultQuantities?.[slug] ?? 0,
          variants: variants.map((variant) => ({
            id: String(variant.id),
            name: variant.name ?? '',
            colorHex: variant.colorHex ?? '#000000',
            image: mediaUrl((variant as { image?: unknown }).image),
            inventory: variant.inventory ?? 0,
          })),
        }
      } catch (err) {
        console.error(
          `[SOLUTION] Failed to read product "${slug}" for /bedrifter/${content.slug}:`,
          err instanceof Error ? err.message : String(err),
        )
        return null
      }
    }),
  )

  return resolved.filter((product): product is ConfigurableProduct => product !== null)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ losning: string }>
}): Promise<Metadata> {
  const { losning } = await params
  const solution = findSolution(losning)
  if (!solution) return {}

  const content = solutionPageContent(losning)
  const title = `${solution.name} | aBoks`
  const description = content?.ingress ?? solution.description

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/bedrifter/${solution.slug}` },
    // A placeholder has nothing to index; a written page is indexed only once its content
    // module says it has been reviewed.
    ...(content?.indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      locale: 'nb_NO',
      siteName: 'aBoks',
      url: `/bedrifter/${solution.slug}`,
      title,
      description,
    },
  }
}

export default async function SolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ losning: string }>
  searchParams: Promise<SolutionSearchParams>
}) {
  const { losning } = await params
  const solution = findSolution(losning)
  if (!solution) notFound()

  const content = solutionPageContent(losning)
  if (content) {
    const products = await getConfigurableProducts(content, await searchParams)
    return <SolutionPageView solution={solution} content={content} products={products} />
  }

  return (
    // The fixed header is solid on this route (HERO_TOP_ROUTES in Header.tsx covers
    // /bedrifter itself, not its children), so the page clears it the way the other
    // non-hero pages do.
    <main style={{ background: CREAM, minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <section style={{ padding: 'clamp(32px,5vw,64px) 0 clamp(80px,10vw,128px)' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div style={{ maxWidth: '760px' }}>
            <p style={eyebrowStyle}>{solution.category}</p>
            <h1
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 'clamp(34px,4.4vw,56px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.06,
                color: INK,
                margin: 0,
              }}
            >
              {solution.name}
            </h1>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(16px,1.4vw,18px)',
                lineHeight: 1.7,
                color: SOFT,
                margin: '22px 0 0',
                maxWidth: '62ch',
              }}
            >
              {solution.description}
            </p>

            <div
              style={{
                margin: 'clamp(36px,4.5vw,56px) 0 0',
                padding: 'clamp(28px,3.4vw,44px)',
                borderRadius: '24px',
                border: `1px dashed ${BORDER_WARM}`,
                background: '#f4f0e6',
              }}
            >
              <p
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: '11.5px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: SAGE,
                  margin: '0 0 12px',
                }}
              >
                Mer informasjon kommer
              </p>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: '15.5px',
                  lineHeight: 1.7,
                  color: MUTED,
                  margin: 0,
                  maxWidth: '54ch',
                }}
              >
                Vi jobber med en fullstendig presentasjon av denne løsningen. Ta gjerne kontakt
                allerede nå, så hjelper vi dere med å finne riktig antall og kombinasjon av
                aBoks-enheter.
              </p>
            </div>

            <div className="mt-[clamp(32px,4vw,48px)] flex flex-wrap gap-3">
              <Link
                href="/bedrifter#foresporsel"
                data-btn
                className="w-full justify-center px-9 sm:w-auto"
                style={primaryButton}
              >
                Be om tilbud
              </Link>
              <Link
                href="/bedrifter#bedriftslosninger"
                data-btn
                className="w-full justify-center px-8 sm:w-auto"
                style={secondaryButton}
              >
                Alle bedriftsløsninger
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
