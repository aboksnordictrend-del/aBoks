import Image from 'next/image'
import Link from 'next/link'
import type { InspirasjonArticle } from '../_data'

export default function ArticleGrid({ articles }: { articles: InspirasjonArticle[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
        gap: 'clamp(24px,3vw,40px)',
        marginBottom: 'clamp(80px,10vw,128px)',
      }}
    >
      {articles.map((card) => {
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
                alt={card.imageAlt ?? card.title}
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
                    color: '#696a62',
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
                      color: '#696a62',
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
  )
}
