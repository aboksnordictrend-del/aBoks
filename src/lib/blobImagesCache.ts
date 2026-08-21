/**
 * Cache identity for the Vercel Blob folder listings the storefront reads.
 *
 * Deliberately its own module, and deliberately free of any `next/cache` import: the reader
 * (server-only), the revalidation endpoint (server-only) and the admin button (client) must
 * all agree on the same tag, and the button must be able to name it without dragging Next's
 * cache internals into a client bundle.
 *
 * Why a full day rather than an hour: every miss on this cache is one Vercel Blob `list()`,
 * which bills as an Advanced Operation. Exactly two folders are listed site-wide — `Video/`
 * for the product-page video posters and `aboks-vegg/` for the homepage carousel — so an
 * hourly window cost 2 × 24 × 30 ≈ 1 440 Advanced Operations a month, which was the entire
 * Blob bill. A daily window brings that to ~60. The case the short window really served —
 * "I have just dropped a file into the folder" — is covered far better by the admin action
 * below, which refreshes both folders the moment it is pressed.
 */

/** The cache tag every Blob folder listing is stored under. */
export const BLOB_IMAGES_TAG = 'blob-images'

/** How long a folder listing is reused before Blob is asked again. 24 hours. */
export const BLOB_IMAGES_REVALIDATE_SECONDS = 86_400

/** Admin-only endpoint that purges {@link BLOB_IMAGES_TAG} on demand. */
export const BLOB_IMAGES_REVALIDATE_API = '/api/admin/blob-images/revalidate'

/** The admin view that offers the manual refresh. */
export const BLOB_IMAGES_ADMIN_ROUTE = '/admin/blob-bilder'

/**
 * The Blob folders covered by the tag, for the admin view's own copy. Listing them is
 * documentation, not configuration — the prefixes themselves are owned by their callers
 * (src/app/(frontend)/page.tsx and src/lib/videoPosterServer.ts).
 */
export const BLOB_IMAGES_FOLDERS = ['Video/', 'aboks-vegg/'] as const
