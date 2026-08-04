import { isBedrifterProductKey, tilbudsmalHtmlBlobUrl } from '@/lib/bedrifterDocuments'

/**
 * Serves a product's fillable Tilbudsmal HTML so it opens in the browser.
 *
 * Vercel Blob sends every `.html` with `content-disposition: attachment` and exposes no way
 * to override it, so linking the Blob URL directly would download the template instead of
 * opening it — and the customer has to fill it in and use its own print button. This hands
 * back the exact same bytes with an inline disposition. The file in Blob is never touched.
 *
 * `produkt` is only ever matched against the six known keys; it never builds a URL, so this
 * cannot be turned into an open proxy.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ produkt: string }> },
): Promise<Response> {
  const { produkt } = await params
  if (!isBedrifterProductKey(produkt)) {
    return new Response(null, { status: 404 })
  }

  const upstream = await fetch(tilbudsmalHtmlBlobUrl(produkt), { next: { revalidate: 3600 } })
  if (!upstream.ok) {
    console.error(
      `[BEDRIFTER] Tilbudsmal HTML unavailable for "${produkt}": ${upstream.status} ${upstream.statusText}`,
    )
    return new Response(null, { status: 502 })
  }

  return new Response(await upstream.text(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
