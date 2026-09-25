import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BUSINESS_SOLUTIONS, findSolution } from '@/lib/bedrifterSolutions'
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
 * Placeholder route for one business solution — `/bedrifter/kontorpakke` and the three
 * others. It exists so the "Se løsningen" buttons on /bedrifter lead somewhere real while
 * the full pages (hero, floor plan, placement, benefits, product sheets, offer) are still
 * being written. Everything it shows comes from `lib/bedrifterSolutions.ts`.
 *
 * `dynamicParams = false` keeps this to the four known slugs: anything else is a 404
 * rather than an empty solution page.
 */
export const dynamicParams = false
export const revalidate = 3600

export function generateStaticParams() {
  return BUSINESS_SOLUTIONS.map((solution) => ({ losning: solution.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ losning: string }>
}): Promise<Metadata> {
  const { losning } = await params
  const solution = findSolution(losning)
  if (!solution) return {}

  return {
    title: { absolute: `${solution.name} | aBoks` },
    description: solution.description,
    alternates: { canonical: `/bedrifter/${solution.slug}` },
    // The page has no content of its own yet — it should not be indexed before it does.
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      locale: 'nb_NO',
      siteName: 'aBoks',
      url: `/bedrifter/${solution.slug}`,
      title: `${solution.name} | aBoks`,
      description: solution.description,
    },
  }
}

export default async function SolutionPage({ params }: { params: Promise<{ losning: string }> }) {
  const { losning } = await params
  const solution = findSolution(losning)
  if (!solution) notFound()

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
