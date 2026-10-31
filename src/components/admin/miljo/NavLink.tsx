'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export const MILJO_ADMIN_ROUTE = '/admin/miljoregistrering'

// Added to the admin nav via admin.components.afterNavLinks, alongside Analyse and Pilotanalyse.
// Same markup and Payload nav classes so the sidebar stays uniform.
export default function MiljoNavLink() {
  const pathname = usePathname()
  const active = pathname === MILJO_ADMIN_ROUTE

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <Link
        href={MILJO_ADMIN_ROUTE}
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
        <span aria-hidden>♻️</span>
        Miljøregistrering
      </Link>
    </div>
  )
}
