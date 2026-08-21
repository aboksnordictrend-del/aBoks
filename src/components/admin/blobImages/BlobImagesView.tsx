import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import BlobImagesClient from './BlobImagesClient'

// Custom admin view mounted at /admin/blob-bilder (config key `blobBilder`). Mirrors
// analytics/DashboardView.tsx: Payload's DefaultTemplate supplies the standard nav and
// auth-aware chrome, and this component refuses to render the action for a guest.
//
// The real security boundary is POST /api/admin/blob-images/revalidate, which independently
// requires an admin user — a guest who reaches this route sees nothing to press, and a
// non-admin who calls the endpoint by hand is refused there.
export default function BlobImagesView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult

  if (!req.user) {
    return (
      <Gutter>
        <h1>Ikke tilgang</h1>
        <p>Du må være innlogget som administrator for å oppdatere bildelistene.</p>
      </Gutter>
    )
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <BlobImagesClient />
      </Gutter>
    </DefaultTemplate>
  )
}
