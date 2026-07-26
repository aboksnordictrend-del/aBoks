import { unstable_cache } from 'next/cache'

/**
 * Reads image files straight out of a Vercel Blob "folder" (a pathname prefix).
 *
 * Uses the Blob REST API over plain fetch — the same no-extra-dependency approach the
 * Google Ads sync takes. @vercel/blob is only present as a transitive dependency of
 * @payloadcms/storage-vercel-blob, so importing it directly would be a phantom import.
 *
 * The point is that dropping a new file into the folder makes it appear on the site
 * without a code change: the listing is re-read whenever the page's ISR window expires.
 */

const BLOB_API = 'https://blob.vercel-storage.com'
// Blob list API version. Kept explicit so a future default bump can't silently change
// the response shape we parse below.
const BLOB_API_VERSION = '7'
const PAGE_LIMIT = 1000
const IMAGE_FILE = /\.(webp|avif|jpe?g|png|gif)$/i

export interface BlobImage {
  /** Public URL, ready for next/image. */
  url: string
  /** Full blob pathname, e.g. `aboks-vegg/aBoks-vegg-olive-1.webp`. */
  pathname: string
}

interface BlobListResponse {
  blobs?: { url?: unknown; pathname?: unknown }[]
  cursor?: unknown
  hasMore?: unknown
}

async function fetchFolder(prefix: string): Promise<BlobImage[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return []

  const found: BlobImage[] = []
  let cursor: string | undefined
  // Guard against an unexpected cursor loop — 10 pages is 10 000 blobs.
  for (let page = 0; page < 10; page++) {
    const url = new URL(BLOB_API)
    url.searchParams.set('prefix', prefix)
    url.searchParams.set('limit', String(PAGE_LIMIT))
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-version': BLOB_API_VERSION,
      },
    })
    if (!res.ok) {
      throw new Error(`Blob list failed for "${prefix}": ${res.status} ${res.statusText}`)
    }

    const json: BlobListResponse = await res.json()
    for (const blob of json.blobs ?? []) {
      // The folder marker itself is a zero-byte blob with no extension — the
      // extension test drops it along with any non-image file.
      if (typeof blob.url !== 'string' || typeof blob.pathname !== 'string') continue
      if (!IMAGE_FILE.test(blob.pathname)) continue
      found.push({ url: blob.url, pathname: blob.pathname })
    }

    if (json.hasMore !== true || typeof json.cursor !== 'string') break
    cursor = json.cursor
  }

  // Byte-wise ascending on the full pathname — the same order Blob Storage lists them in,
  // so the carousel matches what you see in the Vercel dashboard.
  return found.sort((a, b) => (a.pathname < b.pathname ? -1 : a.pathname > b.pathname ? 1 : 0))
}

/**
 * All images in a Blob folder, sorted by filename ascending. Returns `[]` rather than
 * throwing when the token is missing, the folder is empty or the API is unreachable —
 * callers render a fallback instead of taking the page down.
 */
export const listBlobFolderImages = unstable_cache(
  async (prefix: string): Promise<BlobImage[]> => {
    try {
      return await fetchFolder(prefix)
    } catch (err) {
      console.error('[BLOB] Failed to list folder:', err instanceof Error ? err.message : String(err))
      return []
    }
  },
  ['blob-folder-images'],
  { revalidate: 3600, tags: ['blob-images'] },
)
