import { Gutter } from '@payloadcms/ui'
import GoogleMarketingClient from './GoogleMarketingClient'

// Custom collection view at /admin/collections/marketing-expenses/google. Payload wraps
// custom collection views in the standard admin chrome (DefaultTemplate) automatically, so
// we only supply the page body. Data comes from admin-only endpoints; the collection itself
// is admin-only, so editors never reach this route.
export default function GoogleMarketingView() {
  return (
    <Gutter>
      <GoogleMarketingClient />
    </Gutter>
  )
}
