import { notFound } from 'next/navigation'
import {
  createOrderConfirmationEmail,
  createAdminOrderEmail,
  createOrderShippedEmail,
} from '@/emails'
import type { OrderConfirmationData, AdminOrderData, OrderShippedData } from '@/emails'

export const dynamic = 'force-dynamic'

const MOCK_ITEMS = [
  { productName: 'aBoks', variantName: 'Olivengrønn', quantity: 1, unitPrice: 399, lineTotal: 399 },
  { productName: 'aBoks Mini', variantName: 'Sort', quantity: 1, unitPrice: 299, lineTotal: 299 },
]

const MOCK_ADDRESS = { address: 'Eksempelveien 12', postalCode: '7246', city: 'Sandstad' }

const MOCK_ORDER: OrderConfirmationData = {
  customerName: 'Sergej',
  customerEmail: 'post@aboks.no',
  orderNumber: '1001',
  items: MOCK_ITEMS,
  subtotal: 698,
  shipping: 0,
  total: 698,
  shippingAddress: MOCK_ADDRESS,
}

const MOCK_ADMIN: AdminOrderData = {
  ...MOCK_ORDER,
  customerPhone: '+47 900 00 000',
}

const MOCK_SHIPPED: OrderShippedData = {
  customerName: MOCK_ORDER.customerName,
  customerEmail: MOCK_ORDER.customerEmail,
  orderNumber: MOCK_ORDER.orderNumber,
  trackingNumber: '370123456789012345',
  items: MOCK_ITEMS,
  total: MOCK_ORDER.total,
}

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') return notFound()

  const templates = [
    { id: 'order-confirmation', label: 'Order Confirmation', email: createOrderConfirmationEmail(MOCK_ORDER) },
    { id: 'admin-order', label: 'Admin Order', email: createAdminOrderEmail(MOCK_ADMIN) },
    { id: 'order-shipped', label: 'Order Shipped', email: createOrderShippedEmail(MOCK_SHIPPED) },
  ]

  return (
    <div className="min-h-screen bg-[#f0ece4] px-6 py-10">
      <div className="mx-auto max-w-4xl">

        <div className="mb-10">
          <span className="mb-3 inline-block rounded bg-[#1a1d17] px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[#faf6ee]">
            Dev only
          </span>
          <h1 className="text-3xl font-bold text-[#1a1d17]">Email Preview</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Lokalt forhåndsvisning av e-postmaler. Ikke tilgjengelig i produksjon.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          {templates.map(({ id, label, email }) => (
            <div key={id} className="overflow-hidden rounded-xl bg-white shadow-sm">

              <div className="flex items-baseline gap-4 border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-bold text-[#1a1d17]">{label}</h2>
                <span className="text-sm text-gray-400">
                  Subject: <strong className="text-[#1a1d17]">{email.subject}</strong>
                </span>
              </div>

              <div className="px-6 pt-4 pb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">HTML</p>
              </div>
              <iframe
                srcDoc={email.html}
                title={`${label} HTML preview`}
                className="block h-[560px] w-full border-0 border-b border-gray-100"
              />

              <div className="px-6 pb-6">
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Plain text
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[#f7f5f0] p-4 text-[13px] leading-relaxed text-gray-700">
                  {email.text}
                </pre>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
