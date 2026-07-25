import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Storage for customer review photos. Kept separate from `media` (which is world-writable)
 * so uploads are access-controlled and only ever created by the server-side review handler
 * after the buffer has been validated, EXIF-stripped and re-encoded to WebP
 * (see src/lib/reviewPhotos.ts).
 *
 * Public read is intentionally NOT open at the API level — the public pages surface photo
 * URLs only for approved, consented reviews via a server-side query with overrideAccess.
 * Blob keys are random and unguessable, matching how product media already works.
 */
export const ReviewPhotos: CollectionConfig = {
  slug: 'review-photos',
  admin: {
    useAsTitle: 'filename',
    group: 'Anmeldelser',
    hidden: true,
    description: 'Kundebilder lastet opp med anmeldelser.',
  },
  access: {
    // Only logged-in admins can read/list through the API. The public site reads what it
    // needs server-side with overrideAccess and only emits approved photo URLs.
    read: ({ req }) => !!req.user,
    // Never created through the public API — only via the review server action, which uses
    // overrideAccess after processing the file. Admins may also add/remove in the panel.
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../public/review-photos'),
    mimeTypes: ['image/webp'],
    // We store a single pre-optimised WebP; no derived sizes needed.
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt-tekst',
    },
  ],
  timestamps: true,
}
