// Admin-only, on-demand refresh of the cached Vercel Blob folder listings, registered as
// POST /api/admin/blob-images/revalidate.
//
// Security boundary, identical to the marketing endpoints (see pinterestStatus.ts): an
// authenticated Payload user whose role is 'admin'. There is no public surface here — an
// anonymous caller gets 401 before anything else happens, and a non-admin gets 403 before the
// revalidator is even resolved. It is a POST because it mutates server state (it purges a
// cache), so it can never be triggered by a stray link, prefetch or crawler.
//
// What it does NOT do: read Blob, read the database, or return any content. It purges one
// cache tag. The next storefront request that needs a folder listing pays for the single
// `list()` that repopulates it, which is the whole point — one Advanced Operation on demand
// instead of one per hour forever.

import type { Endpoint, PayloadRequest } from 'payload'
import { BLOB_IMAGES_FOLDERS, BLOB_IMAGES_TAG } from '@/lib/blobImagesCache'

/** Injectable so tests never reach into Next's cache internals. */
export type TagRevalidator = (tag: string) => void | Promise<void>

/**
 * The real revalidator. `next/cache` is imported lazily, matching the collection hooks
 * (src/collections/Products.ts): payload.config.ts imports this module, and the config is
 * also loaded by `payload generate:types` / `generate:importmap` outside any Next runtime,
 * where a top-level `next/cache` import is dead weight at best.
 */
async function revalidateWithNext(tag: string): Promise<void> {
  const { revalidateTag } = await import('next/cache')
  revalidateTag(tag)
}

/**
 * The handler body, with the revalidator injected.
 *
 * Deliberately not wrapped in `safeRevalidate`: that helper exists to stop a failed
 * revalidation from rolling back a database write it is attached to, and it does so by
 * swallowing the error. Here the revalidation *is* the whole request, so swallowing it would
 * report success for something that did not happen. A failure is logged and returned as a 500
 * with a Norwegian message, so the admin knows to press the button again.
 */
export async function handleBlobImagesRevalidate(
  req: PayloadRequest,
  revalidate: TagRevalidator = revalidateWithNext,
): Promise<Response> {
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((req.user as { role?: string }).role !== 'admin') {
    return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
  }

  try {
    await revalidate(BLOB_IMAGES_TAG)
  } catch (err) {
    req.payload?.logger?.error(
      `[blob-images] revalidation failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return Response.json(
      { ok: false, error: 'Kunne ikke oppdatere bildelistene. Prøv igjen.' },
      { status: 500 },
    )
  }

  return Response.json(
    {
      ok: true,
      tag: BLOB_IMAGES_TAG,
      folders: [...BLOB_IMAGES_FOLDERS],
      revalidatedAt: new Date().toISOString(),
    },
    { status: 200 },
  )
}

export const blobImagesRevalidateEndpoint: Endpoint = {
  path: '/admin/blob-images/revalidate',
  method: 'post',
  handler: (req: PayloadRequest): Promise<Response> => handleBlobImagesRevalidate(req),
}
