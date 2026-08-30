/**
 * The two return documents aBoks hands out: the statutory Angrerettskjema and aBoks' own
 * Returskjema. Both already exist in the public Vercel Blob store — nothing here uploads,
 * renames or rewrites a file.
 *
 * Shared by /frakt-og-retur (which links them) and by the delivered/receipt e-mail (which
 * attaches the Angrerettskjema), so the page and the e-mail can never point at different
 * files.
 */

/** The public Blob host the rest of the site's assets are already served from. */
const BLOB_BASE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'

export const ANGRERETTSKJEMA_FILENAME = 'Angrerettskjema.pdf'
export const RETURSKJEMA_FILENAME = 'aBoks_returskjema.pdf'

/**
 * Linked without Blob's `?download=1` flag on purpose: Blob serves PDFs inline, so the
 * link opens the document in a new tab where every desktop and mobile browser offers its
 * own save action. Forcing a download instead is what breaks in in-app browsers.
 */
export const ANGRERETTSKJEMA_URL = `${BLOB_BASE}/${ANGRERETTSKJEMA_FILENAME}`
export const RETURSKJEMA_URL = `${BLOB_BASE}/${RETURSKJEMA_FILENAME}`

// Env is read lazily (per call) so it stays configurable and testable, matching
// receiptPdf's logo URL. An empty ANGRERETTSKJEMA_URL disables the network fetch and
// forces the link-only fallback, which keeps e-mail tests deterministic and offline.
const angrerettskjemaFetchUrl = (): string =>
  process.env.ANGRERETTSKJEMA_URL ?? ANGRERETTSKJEMA_URL
const fetchTimeoutMs = (): number =>
  Number(process.env.ANGRERETTSKJEMA_FETCH_TIMEOUT_MS ?? 4_000)

/**
 * The Angrerettskjema bytes, or null when it cannot be fetched.
 *
 * Best-effort by design: unlike the generated Kvittering, an unreachable Blob must never
 * abort the delivered e-mail — the customer still gets the receipt, and the e-mail body
 * always carries the download link as the fallback.
 */
export async function fetchAngrerettskjemaPdf(): Promise<Uint8Array | null> {
  const url = angrerettskjemaFetchUrl()
  if (!url) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMs())
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
