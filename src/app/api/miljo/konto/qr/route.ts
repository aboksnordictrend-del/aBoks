import { accountDeps, json, requireSession } from '@/lib/miljo/account/endpoint'
import { qrPdf, qrPng } from '@/lib/miljo/account/qrFiles'
import { readSessionToken } from '@/lib/miljo/account/session'
import { dashboard } from '@/lib/miljo/account/service'

// GET /api/miljo/konto/qr?format=png|pdf — the signed-in account's OWN QR code as a download.
// Encodes https://aboks.no/miljo/<code> only; no PIN or account data in the file.
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const format = new URL(request.url).searchParams.get('format')
  if (format !== 'png' && format !== 'pdf') return json(400, { ok: false, message: 'Ugyldig format.' })
  const deps = await accountDeps()
  const session = await requireSession(deps, readSessionToken(request.headers.get('cookie')))
  if (session instanceof Response) return session
  const data = await dashboard(session)
  if (!data.publicUrl || !data.publicCode) return json(404, { ok: false, message: 'Organisasjonen har ingen QR-kode ennå. Kontakt aBoks.' })

  const filename = `aboks-miljo-qr-${data.publicCode}.${format}`
  const bytes = format === 'png' ? qrPng(data.publicUrl) : await qrPdf({ organizationName: data.officialName, publicUrl: data.publicUrl })
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': format === 'png' ? 'image/png' : 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
