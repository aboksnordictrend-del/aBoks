const BASE_URL = 'https://api.kustom.co'

export interface KustomAddress {
  given_name?: string
  family_name?: string
  email?: string
  street_address?: string
  postal_code?: string
  city?: string
  phone?: string
  country?: string
}

export interface KustomOrderLine {
  type: 'physical' | 'shipping_fee' | 'sales_tax' | 'digital' | 'gift_card' | 'store_credit' | 'surcharge'
  reference: string
  name: string
  quantity: number
  quantity_unit: string
  unit_price: number
  tax_rate: number
  total_amount: number
  total_discount_amount: number
  total_tax_amount: number
}

export interface KustomMerchantUrls {
  terms: string
  checkout: string
  confirmation: string
  push: string
}

export interface KustomCreateOrderPayload {
  purchase_country: string
  purchase_currency: string
  locale: string
  order_amount: number
  order_tax_amount: number
  order_lines: KustomOrderLine[]
  merchant_urls: KustomMerchantUrls
  merchant_reference?: string
  billing_countries?: string[]
  shipping_countries?: string[]
}

export interface KustomOrder {
  order_id: string
  status: string
  html_snippet?: string
  purchase_country: string
  purchase_currency: string
  locale: string
  order_amount: number
  order_tax_amount: number
  order_lines: KustomOrderLine[]
  billing_address?: KustomAddress
  shipping_address?: KustomAddress
  billing_countries?: string[]
  shipping_countries?: string[]
  merchant_data?: string
  merchant_reference?: string
  started_at?: string
  completed_at?: string
  last_modified_at?: string
  external_payment_methods?: unknown[]
  external_checkouts?: unknown[]
}

function authHeader(): string {
  const apiKey = process.env.KUSTOM_API_KEY
  const apiSecret = process.env.KUSTOM_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('Kustom credentials not configured')
  return 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
}

export async function createKustomOrder(payload: KustomCreateOrderPayload): Promise<KustomOrder> {
  // Safe log: merchant_urls and amounts only — no auth credentials
  console.log('[kustom] createKustomOrder', {
    order_amount: payload.order_amount,
    merchant_urls: payload.merchant_urls,
  })

  const res = await fetch(`${BASE_URL}/checkout/v3/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[kustom] createKustomOrder failed: status=%d body=%s', res.status, text)
    throw new Error(`Kustom create order failed (${res.status}): ${text}`)
  }

  const order = (await res.json()) as KustomOrder
  console.log('[kustom] createKustomOrder response: status=%d order=%s html_snippet=%s ext_payment_methods=%d ext_checkouts=%d billing_countries=%s shipping_countries=%s merchant_data=%s',
    res.status,
    order.order_id,
    order.html_snippet,
    order.external_payment_methods?.length ?? 0,
    order.external_checkouts?.length ?? 0,
    order.billing_countries,
    order.shipping_countries,
    order.merchant_data,
  )
  return order
}

export async function getKustomOrder(orderId: string): Promise<KustomOrder> {
  const res = await fetch(`${BASE_URL}/checkout/v3/orders/${orderId}`, {
    headers: {
      Authorization: authHeader(),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Kustom get order failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<KustomOrder>
}
