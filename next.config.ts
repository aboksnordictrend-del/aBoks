import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/produkt/:slug*',
        destination: '/produkter/:slug*',
        permanent: true,
      },
    ]
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // payload/internal exports server-only utilities (undici, fs, etc.)
      // that get pulled in by the blob handler barrel import in dev (no tree-shaking).
      // These are never called in the browser, so stub them out in client bundles.
      config.resolve.alias = {
        ...config.resolve.alias,
        'payload/internal': false,
      }
    }
    return config
  },
}

export default withPayload(nextConfig)
