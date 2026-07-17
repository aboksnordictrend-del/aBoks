'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

// Added to the admin nav via admin.components.afterNavLinks. Links to the custom
// analytics view. Uses Payload's own nav-group/link classes so it matches the sidebar.
export default function AnalyticsNavLink() {
  const pathname = usePathname()
  const href = '/admin/dashboard'
  const active = pathname === href

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <Link
        href={href}
        className="nav__link"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0',
          fontWeight: active ? 700 : 500,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <span aria-hidden>📊</span>
        Analyse
      </Link>
    </div>
  )
}
