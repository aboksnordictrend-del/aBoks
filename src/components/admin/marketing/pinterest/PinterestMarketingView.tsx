import { Gutter } from '@payloadcms/ui'
import PinterestMarketingClient from './PinterestMarketingClient'

// Custom collection view at /admin/collections/marketing-expenses/pinterest. Payload wraps
// custom collection views in the standard admin chrome (DefaultTemplate) automatically, so
// we only supply the page body. Data comes from admin-only endpoints; the collection itself
// is admin-only, so editors never reach this route.
export default function PinterestMarketingView() {
  return (
    <Gutter>
      <PinterestMarketingClient />
    </Gutter>
  )
}
