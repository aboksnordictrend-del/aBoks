import { Gutter } from '@payloadcms/ui'
import PinterestExportClient from './PinterestExportClient'

// Custom collection view at /admin/collections/marketing-expenses/pinterest-eksport.
// Payload wraps custom collection views in the standard admin chrome automatically, so this
// only supplies the page body. All data comes from the admin-only export endpoints; the
// collection itself is admin-only, so editors never reach this route.
export default function PinterestExportView() {
  return (
    <Gutter>
      <PinterestExportClient />
    </Gutter>
  )
}
