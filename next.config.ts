import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // The review form (/anmeldelse/[token]) submits up to 5 photos through a Server Action
    // as multipart/form-data. The Next.js default of 1 MB is too small, but the ceiling that
    // actually matters is Vercel's: it rejects any request body over ~4.5 MB with
    // 413 FUNCTION_PAYLOAD_TOO_LARGE at the proxy, before this function is ever invoked, and
    // that limit is not configurable. Anything above it here is a lie that only turns a
    // clear error into a mystery — this used to say 45 MB, which is how mobile uploads
    // silently 413'd. 4 MB keeps the app limit under the platform limit.
    //
    // The real budget is enforced in UPLOAD_LIMITS (@/lib/reviewValidation): the browser
    // resizes every photo to ≤1.5 MB, ≤3.5 MB total, and both the form and the Server
    // Action verify it. This value is only the transport backstop.
    serverActions: {
      bodySizeLimit: '4mb',
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
