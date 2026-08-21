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
// Reads are served through a 60-second in-process cache (listPinterestBlobObjectsCached, at the
// bottom of this file). The storefront's hour-long unstable_cache would be wrong here — an admin
// who has just uploaded a Pin image expects to see it on the next preview — but listing on every
// call was wrong too: the export page rebuilds its preview whenever a source checkbox is toggled,
// so four clicks meant four billed `list()` operations for a folder that had not changed. A
// minute is short enough to be invisible to the person uploading and long enough that a burst of
// toggles costs exactly one listing.

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

// ---------------------------------------------------------------------------------------------
// 60-second read cache
// ---------------------------------------------------------------------------------------------

/** How long a successful listing is reused. Deliberately short: see the note at the top. */
export const PINTEREST_BLOB_CACHE_MS = 60_000

interface CacheEntry {
  at: number
  listing: PinterestBlobListing
}

/**
 * Per-prefix cache and in-flight map.
 *
 * In-process rather than `unstable_cache`: this runs inside a Payload endpoint rather than a
 * render, the whole point is a sub-minute window shared by one admin's burst of clicks, and an
 * in-process map needs no framework context to be correct or to be tested.
 */
const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<PinterestBlobListing>>()

/** Drops every cached listing. For tests, and for anything that must force a re-read. */
export function clearPinterestBlobCache(): void {
  cache.clear()
  inFlight.clear()
}

/**
 * {@link listPinterestBlobObjects}, but at most one Blob `list()` per prefix per minute.
 *
 * Two properties beyond the plain TTL, both of which matter for the export page:
 *
 *   • **Failures are never cached.** A missing token or an unreachable API returns its error
 *     straight through and leaves the cache empty, so the next attempt really retries. Pinning a
 *     failure for a minute would turn one blip into a minute of a broken-looking preview.
 *   • **Concurrent callers share one request.** Toggling checkboxes quickly fires overlapping
 *     previews; without this they would each start their own listing. They now await the same
 *     promise, so a burst costs one operation, not one per click.
 */
export async function listPinterestBlobObjectsCached(
  prefix: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<PinterestBlobListing> {
  const fresh = cache.get(prefix)
  if (fresh && now() - fresh.at < PINTEREST_BLOB_CACHE_MS) return fresh.listing

  const pending = inFlight.get(prefix)
  if (pending) return pending

  const request = (async (): Promise<PinterestBlobListing> => {
    const listing = await listPinterestBlobObjects(prefix, fetchImpl)
    // Only a good listing earns a place in the cache; an error must not be pinned.
    if (listing.error === null) cache.set(prefix, { at: now(), listing })
    else cache.delete(prefix)
    return listing
  })()

  inFlight.set(prefix, request)
  try {
    return await request
  } finally {
    inFlight.delete(prefix)
  }
}
