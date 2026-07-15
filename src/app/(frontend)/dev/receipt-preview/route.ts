import type { Order } from '@/payload-types'
import { buildReceiptModel, renderReceiptPdf } from '@/lib/receiptPdf'

// Dev-only visual preview of the generated PDF receipt (Kvittering). Never touches SMTP,
// the database or a real order — it renders a static mock order straight to bytes. Returns
// 404 in production, mirroring the /dev/email-preview page guard.
export const dynamic = 'force-dynamic'

// Mock order shaped like the real Order, kept consistent with the confirmation mock on the
// /dev/email-preview page (same order number, items and totals) so the previews line up.
const MOCK_ORDER = {
  id: 1001,
  orderNumber: '1001',
  status: 'delivered',
  customerInfo: {
    email: 'post@aboks.no',
    firstName: 'Sergej',
    lastName: 'Eksempel',
    address: 'Eksempelveien 12',
    postalCode: '7246',
    city: 'Sandstad',
    phone: '+47 900 00 000',
  },
  items: [
    { variantName: 'Olivengrønn', quantity: 1, unitPrice: 399, lineTotal: 399 },
    { variantName: 'Sort', quantity: 1, unitPrice: 299, lineTotal: 299 },
  ],
  subtotal: 698,
  shipping: 0,
  total: 698,
  createdAt: '2026-07-10T09:00:00.000Z',
  updatedAt: '2026-07-16T09:00:00.000Z',
} as unknown as Order

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response(null, { status: 404 })
  }

  // Render with no logo bytes → the built-in "aBoks" text fallback, so the dev preview is
  // deterministic and never depends on a reachable blob URL.
  const pdf = await renderReceiptPdf(buildReceiptModel(MOCK_ORDER), null)

  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Kvittering-${MOCK_ORDER.orderNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
