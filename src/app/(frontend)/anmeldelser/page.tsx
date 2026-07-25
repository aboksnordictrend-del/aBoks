import type { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import Stars from '@/components/reviews/Stars'
import { getApprovedReviewsData } from '@/lib/reviewServer'
import { formatRating } from '@/lib/reviews'
import ReviewsClient from './ReviewsClient'

export const metadata: Metadata = {
  title: { absolute: 'Anmeldelser fra våre kunder | aBoks' },
  description:
    'Les ekte anmeldelser fra aBoks-kunder. Se hvordan kundene bruker aBoks for å skape bedre orden hjemme, med bilder og verifiserte kjøp.',
  alternates: { canonical: '/anmeldelser' },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/anmeldelser',
    title: 'Anmeldelser fra våre kunder | aBoks',
    description: 'Se hvordan kundene våre bruker aBoks for å skape bedre orden hjemme.',
  },
}

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const MUTED = '#6b6f63'

type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1'

function statLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export default async function AnmeldelserPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; rating?: string; withPhotos?: string }>
}) {
  const sp = await searchParams
  const { reviews, aggregate, products } = await getApprovedReviewsData()

  const initialProduct = sp.product && products.some((p) => p.slug === sp.product) ? sp.product : 'all'
  const initialRating: RatingFilter = ['1', '2', '3', '4', '5'].includes(sp.rating ?? '')
    ? (sp.rating as RatingFilter)
    : 'all'
  const initialWithPhotos = sp.withPhotos === '1'

  const hasReviews = aggregate.count > 0
  const maxBar = Math.max(1, ...([5, 4, 3, 2, 1] as const).map((s) => aggregate.distribution[s]))

  return (
    <main style={{ background: '#f7f2e9', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: 'clamp(96px,12vw,132px) clamp(20px,5vw,48px) clamp(64px,8vw,96px)' }}>
        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Anmeldelser' }]} />

        {/* ── Hero ── */}
        <header style={{ textAlign: 'center', margin: '18px 0 clamp(36px,5vw,56px)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 600,
              fontSize: 'clamp(32px,5vw,52px)',
              letterSpacing: '-0.01em',
              lineHeight: 1.05,
              color: INK,
              margin: '0 0 14px',
            }}
          >
            Anmeldelser fra våre kunder
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 'clamp(15px,1.3vw,17px)', lineHeight: 1.6, color: MUTED, maxWidth: '560px', margin: '0 auto' }}>
            Se hvordan kundene våre bruker aBoks for å skape bedre orden hjemme.
          </p>

          {hasReviews && (
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(20px,4vw,44px)', marginTop: '28px' }}>
              <HeroStat big={formatRating(aggregate.average)} label="gjennomsnitt" extra={<Stars value={aggregate.average} size={16} />} />
              <HeroStat big={String(aggregate.count)} label={statLabel(aggregate.count, 'anmeldelse', 'anmeldelser')} />
              <HeroStat big={String(aggregate.withPhotos)} label={statLabel(aggregate.withPhotos, 'med bilde', 'med bilder')} />
            </div>
          )}
        </header>

        {!hasReviews ? (
          <div style={{ textAlign: 'center', background: '#ffffff', border: '1px solid #e8e0d4', borderRadius: '16px', padding: 'clamp(36px,6vw,64px)' }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(22px,3vw,28px)', color: INK, margin: '0 0 10px' }}>
              Ingen anmeldelser ennå
            </h2>
            <p style={{ fontFamily: FONT, fontSize: '15px', lineHeight: 1.6, color: MUTED, margin: 0 }}>
              De første anmeldelsene fra kundene våre kommer snart. Kom gjerne tilbake.
            </p>
          </div>
        ) : (
          <>
            {/* ── Rating summary ── */}
            <section
              style={{
                background: '#ffffff',
                border: '1px solid #e8e0d4',
                borderRadius: '16px',
                padding: 'clamp(24px,4vw,36px)',
                marginBottom: 'clamp(36px,5vw,52px)',
                display: 'grid',
                gap: 'clamp(24px,4vw,48px)',
                gridTemplateColumns: 'minmax(0,auto) 1fr',
                alignItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(44px,7vw,64px)', lineHeight: 1, color: INK }}>
                  {formatRating(aggregate.average)}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <Stars value={aggregate.average} size={18} />
                </div>
                <div style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, marginTop: '8px' }}>
                  {statLabel(aggregate.count, 'anmeldelse', 'anmeldelser')}
                </div>
                <div style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, marginTop: '2px' }}>
                  {aggregate.positivePercent} % ga 4 eller 5 stjerner
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const n = aggregate.distribution[star]
                  const pct = (n / maxBar) * 100
                  return (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, width: '52px', flexShrink: 0 }}>
                        {star} {star === 1 ? 'stjerne' : 'stjerner'}
                      </span>
                      <span style={{ flex: 1, height: '9px', background: '#efe9dd', borderRadius: '999px', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#e0a92e', borderRadius: '999px' }} />
                      </span>
                      <span style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, width: '28px', textAlign: 'right', flexShrink: 0 }}>{n}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <ReviewsClient
              reviews={reviews}
              products={products}
              initialProduct={initialProduct}
              initialRating={initialRating}
              initialWithPhotos={initialWithPhotos}
            />
          </>
        )}
      </div>
    </main>
  )
}

function HeroStat({ big, label, extra }: { big: string; label: string; extra?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(26px,3.5vw,34px)', color: INK, lineHeight: 1 }}>{big}</span>
        {extra}
      </div>
      <div style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
