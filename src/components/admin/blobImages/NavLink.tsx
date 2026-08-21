'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BLOB_IMAGES_ADMIN_ROUTE } from '@/lib/blobImagesCache'

// Added to the admin nav via admin.components.afterNavLinks, alongside the Analyse link.
// Same markup and Payload nav classes as analytics/NavLink.tsx so the sidebar stays uniform.
export default function BlobImagesNavLink() {
  const pathname = usePathname()
  const active = pathname === BLOB_IMAGES_ADMIN_ROUTE

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <Link
        href={BLOB_IMAGES_ADMIN_ROUTE}
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
        <span aria-hidden>🖼️</span>
        Blob-bildelister
      </Link>
    </div>
  )
}
