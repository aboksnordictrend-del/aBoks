import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { getMailTransport, smtpConfigured } from './src/lib/mailTransport'
import { Users } from './src/collections/Users'
import { Products } from './src/collections/Products'
import { ProductVariants } from './src/collections/ProductVariants'
import { Media } from './src/collections/Media'
import { Orders } from './src/collections/Orders'
import { Customers } from './src/collections/Customers'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// NEXT_PUBLIC_SERVER_URL is the canonical URL (set this in Vercel env vars).
// VERCEL_URL is auto-set by Vercel per deployment (no https:// prefix).
// Without a correct serverURL, Payload's CSRF check rejects all server action
// requests (Origin header mismatch → req.user = null → 500 on list views).
const serverURL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export default buildConfig({
  ...(smtpConfigured
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: process.env.EMAIL_FROM!,
          defaultFromName: process.env.EMAIL_FROM_NAME || 'aBoks',
          transport: getMailTransport()!,
        }),
      }
    : {}),
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: '— aBoks',
      description: 'aBoks Admin Dashboard',
    },
  },
  collections: [Users, Products, ProductVariants, Media, Orders, Customers],
  // Plugin must always be registered so withPayload includes VercelBlobClientUploadHandler
  // in the importMap at build time. BLOB_READ_WRITE_TOKEN is a runtime-only Vercel env var
  // and is not available during `next build`, so a conditional plugins array would produce
  // an empty importMap entry and cause a white screen in production admin.
  plugins: [
    vercelBlobStorage({
      enabled: !!process.env.BLOB_READ_WRITE_TOKEN,
      collections: {
        media: {
          // Required: without this, media.url is built from serverURL (→ localhost in prod)
          disablePayloadAccessControl: true,
        },
      },
      token: process.env.BLOB_READ_WRITE_TOKEN ?? '',
    }),
  ],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'aboks-secret-key-change-in-production-now',
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
    push: false,
  }),
  upload: {
    limits: {
      fileSize: 10_000_000,
    },
  },
  serverURL,
  cors: [serverURL],
  sharp,
})
