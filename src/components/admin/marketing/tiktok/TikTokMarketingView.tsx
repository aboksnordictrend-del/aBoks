import { Gutter } from '@payloadcms/ui'
import TikTokMarketingClient from './TikTokMarketingClient'

// Custom collection view at /admin/collections/marketing-expenses/tiktok. Payload wraps
// custom collection views in the standard admin chrome (DefaultTemplate) automatically, so
// we only supply the page body. Data comes from admin-only endpoints; the collection itself
// is admin-only, so editors never reach this route.
export default function TikTokMarketingView() {
  return (
    <Gutter>
      <TikTokMarketingClient />
    </Gutter>
  )
}
