// Server-side listing of the approved `Pinterest/` Blob folder.
//
// Scope discipline — this is the only place the export talks to Blob Storage:
//   • exactly one prefix, `Pinterest/`, sent as a query parameter and re-checked on every
//     returned pathname, so a server-side prefix quirk can never widen the scope;
//   • read-only: a single GET. Nothing is written, moved or deleted;
//   • the token is read from server env and never returned, logged or serialized;
//   • only the four fields the export needs leave this module.
//
// Uses the Blob REST API over plain fetch rather than `@vercel/blob`, matching the existing
// src/lib/blobImages.ts: the package is only a transitive dependency of
// @payloadcms/storage-vercel-blob, so importing it directly would be a phantom import.
//
// Deliberately NOT wrapped in unstable_cache (unlike blobImages.ts) — an admin who has just
// uploaded a Pin image expects to see it on the next preview, not an hour later.

const BLOB_API = 'https://blob.vercel-storage.com'
/** Pinned so a future default bump cannot silently change the response shape parsed below. */
const BLOB_API_VERSION = '7'
const PAGE_LIMIT = 1000
/** 10 pages × 1000 = 10 000 objects; also a hard stop against an unexpected cursor loop. */
const MAX_PAGES = 10

/** The only metadata the export needs. No size-less internals, no token, no headers. */
export interface PinterestBlobObject {
  /** Public https URL. */
  url: string
  /** Full pathname, e.g. `Pinterest/interior/aBoks-i-stua.webp`. */
  pathname: string
  /** Bytes; 0 marks the zero-byte placeholder Blob creates for a "folder". */
  size: number
  /** ISO upload timestamp, or null when the API did not supply one. */
  uploadedAt: string | null
}

export interface PinterestBlobListing {
  objects: PinterestBlobObject[]
  /** Norwegian, user-facing. Non-null means the listing failed and the folder is unknown. */
  error: string | null
}

interface RawBlob {
  url?: unknown
  pathname?: unknown
  size?: unknown
  uploadedAt?: unknown
}

interface BlobListResponse {
  blobs?: RawBlob[]
  cursor?: unknown
  hasMore?: unknown
}

function toObject(raw: RawBlob, prefix: string): PinterestBlobObject | null {
  if (typeof raw.url !== 'string' || typeof raw.pathname !== 'string') return null
  // Belt and braces: the prefix is already a query parameter, but a returned pathname that
  // does not actually start with it is discarded. Case-sensitive — Blob pathnames are.
  if (!raw.pathname.startsWith(prefix)) return null
  return {
    url: raw.url,
    pathname: raw.pathname,
    size: typeof raw.size === 'number' ? raw.size : 0,
    uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : null,
  }
}

/**
 * Every object under `prefix`, following the cursor until the API says there is no more.
 *
 * Never throws: a missing token, an HTTP error or an unreachable API all come back as an
 * `error` string with an empty list, so the preview still renders products, variants and
 * homepage rows and merely reports that this one source is unavailable.
 */
export async function listPinterestBlobObjects(
  prefix: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PinterestBlobListing> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return {
      objects: [],
      error: 'Blob-lagring er ikke konfigurert, så Pinterest-mappen kunne ikke leses.',
    }
  }

  const objects: PinterestBlobObject[] = []
  let cursor: string | undefined

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(BLOB_API)
      url.searchParams.set('prefix', prefix)
      url.searchParams.set('limit', String(PAGE_LIMIT))
      if (cursor) url.searchParams.set('cursor', cursor)

      const res = await fetchImpl(url, {
        headers: { authorization: `Bearer ${token}`, 'x-api-version': BLOB_API_VERSION },
      })
      if (!res.ok) {
        // Status only — the response body could echo request details.
        throw new Error(`${res.status} ${res.statusText}`)
      }

      const json = (await res.json()) as BlobListResponse
      for (const raw of json.blobs ?? []) {
        const object = toObject(raw, prefix)
        if (object) objects.push(object)
      }

      if (json.hasMore !== true || typeof json.cursor !== 'string') break
      cursor = json.cursor
    }
  } catch (err) {
    // The message is deliberately generic: it reaches the admin UI, and a Blob error string
    // must never carry the token or the signed request URL.
    console.error(
      '[pinterest-export] Blob listing failed:',
      err instanceof Error ? err.message : String(err),
    )
    return { objects: [], error: 'Kunne ikke hente bilder fra Pinterest-mappen i Blob.' }
  }

  // Stable, byte-wise on the pathname — the same order the Vercel dashboard shows. Recency
  // sorting happens later in the shared pipeline; this only makes the input deterministic.
  objects.sort((a, b) => (a.pathname < b.pathname ? -1 : a.pathname > b.pathname ? 1 : 0))
  return { objects, error: null }
}
