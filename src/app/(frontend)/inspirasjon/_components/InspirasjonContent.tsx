import Breadcrumbs from '@/components/Breadcrumbs'
import Pagination from '@/components/Pagination'
import type { InspirasjonArticle } from '../_data'
import ArticleGrid from './ArticleGrid'

function getInspirasjonPageHref(page: number): string {
  return page <= 1 ? '/inspirasjon' : `/inspirasjon/page/${page}`
}

export default function InspirasjonContent({
  articles,
  currentPage,
  totalPages,
}: {
  articles: InspirasjonArticle[]
  currentPage: number
  totalPages: number
}) {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs
          items={
            currentPage > 1
              ? [
                  { label: 'Hjem', href: '/' },
                  { label: 'Inspirasjon', href: '/inspirasjon' },
                  { label: `Side ${currentPage}` },
                ]
              : [{ label: 'Hjem', href: '/' }, { label: 'Inspirasjon' }]
          }
        />

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

        <ArticleGrid articles={articles} />

        <Pagination currentPage={currentPage} totalPages={totalPages} getHref={getInspirasjonPageHref} />

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
