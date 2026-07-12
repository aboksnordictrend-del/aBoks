import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import { FAQS } from '@/lib/content'

export const metadata: Metadata = {
  title: {
    absolute: 'Vanlige spørsmål om aBoks | FAQ',
  },
  description:
    'Svar på vanlige spørsmål om aBoks: hvilke batterier som passer, kapasitet, materiale, plassering, frakt, retur og levering av brukte batterier til gjenvinning.',
  alternates: {
    canonical: '/vanlige-sporsmal',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/vanlige-sporsmal',
    title: 'Vanlige spørsmål om aBoks | FAQ',
    description:
      'Alt du lurer på om aBoks – batterityper, kapasitet, materiale, frakt og retur. Samlet på ett sted.',
  },
}

const textLink: React.CSSProperties = {
  color: '#39402c',
  fontFamily: 'var(--font-manrope)',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

// Answers are rendered as plain, always-visible text (not the collapsible
// Accordion) so the full FAQ copy is present in the server-rendered HTML.
export default function VanligeSporsmalPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  }

  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Vanlige spørsmål' }]} />

        {/* Page heading */}
        <div style={{ marginBottom: 'clamp(48px,6vw,72px)', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '0 0 14px',
          }}>
            Ofte stilte spørsmål
          </p>
          <h1 style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(38px,5vw,68px)',
            letterSpacing: '-0.024em',
            lineHeight: 1.0,
            color: '#1a1d17',
            margin: '0 0 18px',
          }}>
            Vanlige spørsmål om aBoks
          </h1>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: 'clamp(15px,1.2vw,17px)',
            lineHeight: 1.6,
            color: '#6b6f63',
            margin: '0 auto',
            maxWidth: '520px',
          }}>
            Her finner du svar på det kundene våre spør oss om oftest – fra batterityper og
            kapasitet til frakt, retur og gjenvinning.
          </p>
        </div>

        {/* Q&A */}
        <div style={{ maxWidth: '840px', margin: '0 auto clamp(56px,7vw,80px)' }}>
          {FAQS.map((faq) => (
            <section key={faq.id} style={{ padding: '28px 0', borderBottom: '1px solid #e7e2d4' }}>
              <h2 style={{
                fontFamily: 'var(--font-manrope)',
                fontWeight: 600,
                fontSize: '18px',
                lineHeight: 1.4,
                color: '#1a1d17',
                margin: '0 0 10px',
              }}>
                {faq.question}
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '16px',
                lineHeight: 1.6,
                color: '#3a3f33',
                margin: 0,
                maxWidth: '680px',
              }}>
                {faq.answer}
              </p>
            </section>
          ))}
        </div>

        {/* Interne lenker */}
        <section style={{ maxWidth: '840px', margin: '0 auto clamp(80px,10vw,128px)', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: '16px',
            lineHeight: 1.7,
            color: '#4a4e41',
            margin: '0 0 28px',
          }}>
            Fant du ikke svaret? Se <Link href="/slik-fungerer-det" style={textLink}>slik fungerer aBoks</Link>,
            utforsk <Link href="/produkter" style={textLink}>alle produkter</Link>, les mer under{' '}
            <Link href="/inspirasjon" style={textLink}>Inspirasjon</Link> – eller{' '}
            <Link href="/kontakt" style={textLink}>kontakt oss</Link>, så hjelper vi deg. Tilbake til{' '}
            <Link href="/" style={textLink}>forsiden</Link>.
          </p>
          <Link
            href="/produkter"
            data-btn
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '17px 36px',
              borderRadius: '999px',
              background: '#39402c',
              color: '#faf6ee',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            Se alle produkter
          </Link>
        </section>

      </div>
    </main>
  )
}
