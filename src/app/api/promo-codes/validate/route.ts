import { type NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { clientIpFromHeaders } from '@/lib/rateLimit'
import { handlePromoValidation } from '@/lib/promo/validateEndpoint'

/**
 * POST /api/promo-codes/validate — the customer-facing promo-code check.
 *
 * Deliberately a thin adapter: it reads the Origin, the client IP and the raw body, then
 * hands everything to `handlePromoValidation`, which owns the security checks, the parsing
 * and the (delegated) pricing and validation. No money logic lives here.
 *
 * Read-only. Only POST is exported, so Next.js answers any other method with 405.
 */
export async function POST(req: NextRequest) {
  // A body that cannot even be read as text is treated as an empty one; the handler then
  // reports it as a malformed request like any other unparseable body.
  const rawBody = await req.text().catch(() => '')

  const { status, body, headers } = await handlePromoValidation(
    { getPayload: getPayloadClient },
    {
      origin: req.headers.get('origin'),
      ip: clientIpFromHeaders(req.headers),
      rawBody,
    },
  )

  return NextResponse.json(body, { status, ...(headers ? { headers } : {}) })
}
