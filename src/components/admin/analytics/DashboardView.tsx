import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import DashboardClient from './DashboardClient'

// Custom admin view mounted at /admin/dashboard (config key `analyse`, path `/dashboard`).
// It reuses Payload's DefaultTemplate so the sidebar/nav and auth-aware chrome are the
// standard admin ones. The real security boundary is the /api/analytics endpoint, which
// independently requires req.user; this component also refuses to render data for guests.
export default function DashboardView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult

  if (!req.user) {
    return (
      <Gutter>
        <h1>Ikke tilgang</h1>
        <p>Du må være innlogget som administrator for å se analysen.</p>
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
        <DashboardClient />
      </Gutter>
    </DefaultTemplate>
  )
}
