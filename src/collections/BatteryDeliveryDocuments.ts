import type { Access, CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import { BATTERY_DELIVERY_DOCUMENTS_SLUG, ENV_ORGANIZATIONS_SLUG, MILJO_ADMIN_GROUP } from '@/lib/miljo/constants'
import { refuseDelete } from './hooks/miljo'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Receipts and other supporting documents attached to a delivery («Vedlegg»).
 *
 * Created only by the PIN-checked delivery action, after the file has been verified by its real
 * signature (PDF, or an image that is re-encoded to WebP with all metadata/GPS stripped — see
 * @/lib/miljo/documents) and given a random name. Readable by administrators only: unlike
 * product media, this collection keeps Payload's access control on the file route
 * (/api/battery-delivery-documents/file/…), so a document is never publicly reachable through
 * the site. Locally the files live outside /public.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
const nobody: Access = () => false

export const BatteryDeliveryDocuments: CollectionConfig = {
  slug: BATTERY_DELIVERY_DOCUMENTS_SLUG,
  labels: { singular: 'Leveringsvedlegg', plural: 'Leveringsvedlegg' },
  admin: {
    group: MILJO_ADMIN_GROUP,
    hidden: true,
    useAsTitle: 'filename',
  },
  access: { read: adminOnly, create: nobody, update: nobody, delete: nobody },
  upload: {
    staticDir: path.resolve(dirname, '../../uploads/battery-delivery-documents'),
    mimeTypes: ['application/pdf', 'image/webp'],
  },
  fields: [
    {
      name: 'organization',
      type: 'relationship',
      relationTo: ENV_ORGANIZATIONS_SLUG,
      label: 'Organisasjon',
      index: true,
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeDelete: [refuseDelete('Vedlegg til leveranser kan ikke slettes.')],
  },
  timestamps: true,
}
