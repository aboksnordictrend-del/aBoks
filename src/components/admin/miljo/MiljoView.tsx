import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import MiljoClient from './MiljoClient'
import { isAdminUser, isStaffUser } from '@/lib/security/staffAccess'

// Custom admin view at /admin/miljoregistrering (config key `miljoregistrering`). Same shell as the
// sales and pilot analytics views. The security boundary is /api/miljo-analytics, which
// independently requires an administrator; this view also refuses to render for anyone else.
export default function MiljoView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult

  if (!isStaffUser(req.user) || !isAdminUser(req.user)) {
    return (
      <Gutter>
        <h1>Ikke tilgang</h1>
        <p>Du må være innlogget som administrator for å se Miljøregistrering.</p>
      </Gutter>
    )
  }

  const organization = typeof searchParams?.organization === 'string' ? searchParams.organization : undefined

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
        <MiljoClient initialOrganization={organization} />
      </Gutter>
    </DefaultTemplate>
  )
}
