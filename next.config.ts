import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // The review form (/anmeldelse/[token]) submits up to 5 photos through a Server Action.
    // The default Server Actions body limit is 1 MB, which rejects the multipart POST with
    // a 413 before the action ever runs. 45 MB = 5 files × 8 MB (the per-file cap enforced
    // in the action and client) plus multipart overhead. The per-file 8 MB limit and the
    // 5-photo cap are still enforced separately — this only raises the transport ceiling.
    serverActions: {
      bodySizeLimit: '45mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/produkt/:slug*',
        destination: '/produkter/:slug*',
        permanent: true,
      },
      {
        source: '/vilkar',
        destination: '/kjopsvilkar',
        permanent: true,
      },
      {
        source: '/angrerett',
        destination: '/frakt-og-retur',
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
