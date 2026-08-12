import { type NextRequest, NextResponse } from 'next/server'
import { clientIpFromHeaders } from '@/lib/rateLimit'
import { handleBrowserCapiEvent } from '@/lib/meta/capi/browserEndpoint'

/**
 * POST /api/meta/event — the server half of the browser's AddToCart / InitiateCheckout.
 *
 * A thin adapter, like /api/promo-codes/validate: it reads the Origin, the client IP, the raw
 * body and the two lookups the handler needs to see the customer's own cookies and headers,
 * then hands everything to `handleBrowserCapiEvent`, which owns the allowlist, the validation,
 * the payload and the outbound call.
 *
 * The Conversions API token lives in `META_CAPI_ACCESS_TOKEN` and is read server-side only —
 * it is never accepted from, nor returned to, the browser. The response body is `{ ok }` and
 * nothing else; the client does not read it.
 *
 * Only POST is exported, so Next.js answers any other method with 405.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text().catch(() => '')

  const { status, body } = await handleBrowserCapiEvent(
    {},
    {
      origin: req.headers.get('origin'),
      ip: clientIpFromHeaders(req.headers),
      rawBody,
      getCookie: (name) => req.cookies.get(name)?.value ?? null,
      getHeader: (name) => req.headers.get(name),
    },
  )

  return NextResponse.json(body, { status })
}
