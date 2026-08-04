import { type NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { clientIpFromHeaders } from '@/lib/rateLimit'
import { handleBusinessInquiry } from '@/lib/bedrifter/inquiryEndpoint'

/**
 * POST /api/bedrifter/foresporsel — the B2B inquiry form on /bedrifter.
 *
 * Deliberately a thin adapter, like `/api/promo-codes/validate`: it reads the Origin, the
 * content type, the client IP and the raw body, then hands everything to
 * `handleBusinessInquiry`, which owns the spam checks, the validation and the two sends.
 *
 * The Payload client is constructed lazily *inside* the send callback, so a rejected origin,
 * a tripped honeypot or a rate-limited caller never boots the CMS or opens a database
 * connection.
 *
 * Only POST is exported, so Next.js answers any other method with 405.
 */
export async function POST(req: NextRequest) {
  // A body that cannot even be read as text is treated as an empty one; the handler then
  // reports it as a malformed request like any other unparseable body.
  const rawBody = await req.text().catch(() => '')

  const { status, body, headers } = await handleBusinessInquiry(
    {
      sendEmail: async (message) => {
        const payload = await getPayloadClient()
        return payload.sendEmail(message)
      },
    },
    {
      origin: req.headers.get('origin'),
      contentType: req.headers.get('content-type'),
      ip: clientIpFromHeaders(req.headers),
      rawBody,
    },
  )

  return NextResponse.json(body, { status, ...(headers ? { headers } : {}) })
}
