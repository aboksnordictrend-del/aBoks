import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Inspirasjon',
  description:
    'Tips, guider og ideer om batterier, organisering, bærekraft og et ryddig hjem – fra aBoks.',
  alternates: {
    canonical: '/inspirasjon',
  },
  openGraph: {
    title: 'Inspirasjon | aBoks',
    description:
      'Tips, guider og ideer om batterier, organisering, bærekraft og et ryddig hjem – fra aBoks.',
  },
}

const placeholderCards = [
  {
    category: 'Bærekraftig hjem',
    title: 'Slik sorterer du batteriene riktig hjemme',
    description:
      'Å sortere batteriene riktig hjemme er et av de enkleste grepene for et tryggere hjem og en renere natur. Her er de praktiske rådene som faktisk fungerer i en travel hverdag – fra teiping av poler til en fast plass for nye og brukte batterier.',
    date: 'Juni 2026',
    slug: '/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Sorterer-batteriene-hjemme.webp',
    imageAlt: 'Sortere batteriene riktig hjemme – aBoks guide',
  },
  {
    category: 'Bærekraft & gjenvinning',
    title: 'Hvorfor det lønner seg å levere inn brukte batterier',
    description:
      'Å levere inn brukte batterier er en av de enkleste miljøhandlingene vi gjør hjemme – og en av dem flest glemmer. Her er hvorfor det lønner seg for både lommeboka, sikkerheten og naturen, og hvordan litt orden hjemme gjør hele forskjellen.',
    date: 'Juni 2026',
    slug: '/inspirasjon/levere-inn-brukte-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvorfor-det-l%C3%B8nner.webp',
    imageAlt: 'Levere inn brukte batterier – aBoks guide',
  },
  {
    category: 'Hjem & Organisering',
    title: 'Orden i skuffen – 5 tips for et ryddigere og tryggere hjem',
    description:
      'Den ene rotskuffen sier ofte mer om hjemmet enn vi liker å innrømme. Med fem enkle grep – fra soneinndeling til smart batterioppbevaring – skaper du orden i skuffen som varer, og et hjem som er tryggere og mer bærekraftig.',
    date: 'Juni 2026',
    slug: '/inspirasjon/orden-i-skuffen',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Orden-i-skuffen.webp',
    imageAlt: 'Orden i skuffen – aBoks guide til hjemorganisering',
  },
  {
    category: 'Hjem & bærekraft',
    title: 'Hvilke batterier passer til hva? Den komplette guiden for hjemmet',
    description:
      'Hvilke batterier passer til hva? Vi gir deg oversikten over alkaliske, litium- og oppladbare AA- og AAA-batterier – hvor de hører hjemme, hvordan du oppbevarer dem trygt, og hvordan du gjenvinner riktig i Norge.',
    date: 'Juni 2026',
    slug: '/inspirasjon/hvilke-batterier-passer-til-hva',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvilke-batterier-passer.webp',
    imageAlt: 'Hvilke batterier passer til hva – aBoks guide',
  },
  {
    category: 'Bærekraftig hjem',
    title: 'aBoks og fremtidens bærekraftige hjem',
    description:
      'aBoks og fremtidens bærekraftige hjem henger tettere sammen enn de fleste tror. Når noe så lite som et batteri får sin faste plass, blir hverdagen ryddigere, tryggere og mer sirkulær. Her er de praktiske grepene som teller.',
    date: 'Juni 2026',
    slug: '/inspirasjon/aboks-fremtidens-baerekraftige-hjem',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/aBoks-fremtid.webp',
    imageAlt: 'aBoks og fremtidens bærekraftige hjem – orden og gjenvinning',
  },
  {
    category: 'Bærekraft & smart hverdag',
    title: 'Slik forlenger du levetiden på batteriene dine',
    description:
      'Med noen enkle grep kan du forlenge levetiden på batteriene dine betydelig – spare penger, redusere avfall og gjøre hjemmet både tryggere og mer bærekraftig. Her er ekspertrådene som faktisk virker.',
    date: 'Juni 2026',
    slug: '/inspirasjon/forleng-levetiden-pa-batteriene',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Levetiden-pa-batteriene.webp',
    imageAlt: 'Slik forlenger du levetiden på batteriene dine – aBoks guide',
  },
]

export default function InspirasjonPage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            paddingTop: '18px',
            marginBottom: 'clamp(36px,5vw,56px)',
          }}
        >
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Inspirasjon</span>
        </div>

        {/* Page heading */}
        <div style={{ marginBottom: 'clamp(48px,6vw,72px)', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#5e6a48',
              margin: '0 0 14px',
            }}
          >
            Artikler og guider
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(40px,5vw,72px)',
              letterSpacing: '-0.024em',
              lineHeight: 1.0,
              color: '#1a1d17',
              margin: '0 0 24px',
            }}
          >
            Inspirasjon
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(15px,1.1vw,17px)',
              lineHeight: 1.7,
              color: '#6b6f63',
              margin: '0 auto',
              maxWidth: '520px',
            }}
          >
            Her samler vi nyttige artikler, tips og guider om batterier, organisering,
            gjenvinning og et mer bevisst hverdagsliv. Nytt innhold er på vei.
          </p>
        </div>

        {/* Article grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: 'clamp(24px,3vw,40px)',
            marginBottom: 'clamp(80px,10vw,128px)',
          }}
        >
          {placeholderCards.map((card) => {
            const published = card.slug !== '#'
            const hasImage = 'image' in card && card.image

            const imageInner = (
              <div
                style={{
                  position: 'relative',
                  paddingTop: '56.25%',
                  background: 'linear-gradient(135deg, #e4dfd2 0%, #d6d0c2 100%)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {hasImage ? (
                  <Image
                    src={card.image as string}
                    alt={(card as { imageAlt?: string }).imageAlt ?? card.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#b5b0a4"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>
            )

            return (
              <article
                key={card.title}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  background: '#f3ede2',
                }}
              >
                {/* Image 16:9 */}
                {published ? (
                  <Link
                    href={card.slug}
                    tabIndex={-1}
                    style={{ display: 'block', textDecoration: 'none' }}
                  >
                    {imageInner}
                  </Link>
                ) : (
                  imageInner
                )}

                {/* Card body */}
                <div
                  style={{
                    padding: 'clamp(20px,2vw,28px)',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                  }}
                >
                  {/* Category */}
                  <span
                    style={{
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 700,
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#5e6a48',
                      marginBottom: '10px',
                      display: 'block',
                    }}
                  >
                    {card.category}
                  </span>

                  {/* Title */}
                  <h2
                    style={{
                      fontFamily: 'var(--font-cormorant)',
                      fontWeight: 600,
                      fontSize: 'clamp(20px,1.8vw,24px)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.2,
                      color: '#1a1d17',
                      margin: '0 0 10px',
                    }}
                  >
                    {published ? (
                      <Link href={card.slug} style={{ color: '#1a1d17', textDecoration: 'none' }}>
                        {card.title}
                      </Link>
                    ) : card.title}
                  </h2>

                  {/* Description */}
                  <p
                    style={{
                      fontFamily: 'var(--font-manrope)',
                      fontSize: '14px',
                      lineHeight: 1.65,
                      color: '#6b6f63',
                      margin: '0 0 20px',
                      flex: 1,
                    }}
                  >
                    {card.description}
                  </p>

                  {/* Footer: date + link */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginTop: 'auto',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-manrope)',
                        fontSize: '12px',
                        color: '#9a9a8e',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {card.date}
                    </span>
                    {published ? (
                      <Link
                        href={card.slug}
                        style={{
                          fontFamily: 'var(--font-manrope)',
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#39402c',
                          letterSpacing: '0.04em',
                          textDecoration: 'none',
                        }}
                      >
                        Les mer →
                      </Link>
                    ) : (
                      <span
                        style={{
                          fontFamily: 'var(--font-manrope)',
                          fontWeight: 600,
                          fontSize: '13px',
                          color: '#9a9a8e',
                          letterSpacing: '0.04em',
                          cursor: 'default',
                        }}
                      >
                        Les mer →
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Coming soon banner */}
        <div
          style={{
            textAlign: 'center',
            paddingBottom: 'clamp(64px,8vw,96px)',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              border: '1.5px solid #c9cfc0',
              borderRadius: '16px',
              padding: 'clamp(28px,3vw,44px) clamp(32px,4vw,64px)',
              maxWidth: '480px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 500,
                fontSize: 'clamp(22px,2vw,28px)',
                color: '#1a1d17',
                margin: '0 0 10px',
                letterSpacing: '-0.01em',
              }}
            >
              Mer innhold er på vei
            </p>
            <p
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '14px',
                lineHeight: 1.7,
                color: '#6b6f63',
                margin: 0,
              }}
            >
              Vi jobber med artikler og guider som hjelper deg å bruke,
              oppbevare og resirkulere batterier på best mulig måte.
            </p>
          </div>
        </div>

      </div>
    </main>
  )
}
