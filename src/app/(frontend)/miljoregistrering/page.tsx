import type { Metadata } from 'next'

/**
 * Placeholder for the aBoks Miljøregistrering information page, linked from /bedrifter.
 *
 * Kept out of search (and out of the sitemap) until the full landing page is ready. This is
 * a marketing page only — the registration app lives under /miljo/[code].
 */
export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) — the title already carries it
  title: { absolute: 'aBoks Miljøregistrering | aBoks' },
  description: 'Informasjon om aBoks Miljøregistrering kommer snart.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function MiljoregistreringPage() {
  return (
    <main
      className="flex items-center justify-center px-[clamp(20px,5vw,48px)]"
      style={{
        background: '#faf6ee',
        minHeight: '100vh',
        paddingTop: 'clamp(96px,12vh,132px)',
        paddingBottom: 'clamp(72px,9vw,120px)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '640px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(36px,5vw,64px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.07,
            color: '#1a1d17',
            margin: 0,
          }}
        >
          aBoks Miljøregistrering
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '22px 0 0',
          }}
        >
          Under behandling
        </p>
      </div>
    </main>
  )
}
