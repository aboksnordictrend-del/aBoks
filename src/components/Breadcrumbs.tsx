import Link from 'next/link'
import { absoluteUrl } from '@/lib/site'

export type Crumb = { label: string; href?: string }

/**
 * Visual breadcrumb trail + matching BreadcrumbList JSON-LD.
 * The last crumb is the current page and must not carry an href.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  }

  return (
    <>
      <nav
        aria-label="Brødsmulesti"
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
        {items.map((item, i) => (
          <span key={item.label} style={{ display: 'contents' }}>
            {i > 0 && <span style={{ opacity: 0.5 }} aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} style={{ color: '#6b6f63', textDecoration: 'none' }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: '#1a1d17', fontWeight: 600 }} aria-current="page">
                {item.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
