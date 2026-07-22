import { Gutter } from '@payloadcms/ui'
import MarketingChannelsClient from './MarketingChannelsClient'

// Overrides the default list view of the marketing-expenses collection
// (admin.components.views.list). Payload renders this inside the standard admin chrome
// (DefaultTemplate + list providers), so we only supply the catalog body. The real
// security boundary is the admin-only /api/admin/marketing/channels endpoint; the whole
// collection is already admin-only, so non-admins never reach this route.
export default function MarketingChannelsView() {
  return (
    <Gutter>
      <MarketingChannelsClient />
    </Gutter>
  )
}
