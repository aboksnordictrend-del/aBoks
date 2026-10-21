import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import PilotAnalyticsClient from './PilotAnalyticsClient'

// Custom admin view at /admin/pilotanalyse (config key `pilotAnalyse`). Same shell as the sales
// analytics view. The security boundary is /api/pilot-analytics, which independently requires an
// administrator; this view also refuses to render for anyone else.
export default function PilotAnalyticsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult

  if (!req.user || (req.user as { role?: string }).role !== 'admin') {
    return (
      <Gutter>
        <h1>Ikke tilgang</h1>
        <p>Du må være innlogget som administrator for å se pilotanalysen.</p>
      </Gutter>
    )
  }

  const project = typeof searchParams?.project === 'string' ? searchParams.project : undefined

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
        <PilotAnalyticsClient initialProject={project} />
      </Gutter>
    </DefaultTemplate>
  )
}
