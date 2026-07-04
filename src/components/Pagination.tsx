import Link from 'next/link'

type PaginationProps = {
  currentPage: number
  totalPages: number
  getHref: (page: number) => string
}

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '40px',
  height: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  fontFamily: 'var(--font-manrope)',
  fontWeight: 600,
  fontSize: '14px',
  textDecoration: 'none',
  border: '1px solid #ddd8ce',
}

export default function Pagination({ currentPage, totalPages, getHref }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <nav
      aria-label="Sidenavigasjon"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        margin: '0 0 clamp(64px,8vw,96px)',
      }}
    >
      {currentPage > 1 && (
        <Link
          href={getHref(currentPage - 1)}
          style={{ ...pillBase, color: '#39402c', background: '#f3ede2' }}
        >
          Forrige
        </Link>
      )}

      {pages.map((page) => {
        const isActive = page === currentPage
        return (
          <Link
            key={page}
            href={getHref(page)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              ...pillBase,
              color: isActive ? '#faf6ee' : '#39402c',
              background: isActive ? '#39402c' : '#f3ede2',
              borderColor: isActive ? '#39402c' : '#ddd8ce',
            }}
          >
            {page}
          </Link>
        )
      })}

      {currentPage < totalPages && (
        <Link
          href={getHref(currentPage + 1)}
          style={{ ...pillBase, color: '#39402c', background: '#f3ede2' }}
        >
          Neste
        </Link>
      )}
    </nav>
  )
}
