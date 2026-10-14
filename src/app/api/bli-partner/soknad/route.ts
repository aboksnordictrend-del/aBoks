import { type NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { clientIpFromHeaders } from '@/lib/rateLimit'
import { handlePartnerApplication } from '@/lib/partnerProgram/applicationEndpoint'

/**
 * POST /api/bli-partner/soknad — the partner application form on /bli-partner.
 *
 * A thin adapter, exactly like `/api/bedrifter/foresporsel`: everything that decides
 * anything lives in `handlePartnerApplication`. The Payload client is built lazily inside the
 * send callback, so a rejected or rate-limited request never boots the CMS. Only e-mail is
 * sent; nothing is written to the database and no partner code is created.
 *
 * Only POST is exported, so Next.js answers any other method with 405.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text().catch(() => '')

  const { status, body, headers } = await handlePartnerApplication(
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
