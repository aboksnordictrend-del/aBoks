import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { Users } from './src/collections/Users'
import { Products } from './src/collections/Products'
import { ProductVariants } from './src/collections/ProductVariants'
import { Media } from './src/collections/Media'
import { Orders } from './src/collections/Orders'
import { Customers } from './src/collections/Customers'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
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
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'aboks-secret-key-change-in-production-now',
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
  }),
  upload: {
    limits: {
      fileSize: 10_000_000,
    },
  },
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'],
  sharp,
})
