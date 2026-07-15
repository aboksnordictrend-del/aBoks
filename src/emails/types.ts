export interface OrderItem {
  productName?: string
  variantName?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ShippingAddress {
  address: string
  postalCode: string
  city: string
}

export interface OrderConfirmationData {
  customerName: string
  customerEmail: string
  orderNumber: string
  items: OrderItem[]
  subtotal: number
  shipping: number
  total: number
  shippingAddress: ShippingAddress
}

export interface AdminOrderData {
  customerName: string
  customerEmail: string
  customerPhone?: string
  orderNumber: string
  items: OrderItem[]
  subtotal: number
  shipping: number
  total: number
  shippingAddress: ShippingAddress
}

export interface OrderShippedData {
  customerName: string
  customerEmail: string
  orderNumber: string
  trackingNumber?: string
  items: OrderItem[]
  total: number
}

export interface OrderDeliveredData {
  /** First name for the greeting ("Hei [FORNAVN]"), falling back to the full name. */
  firstName: string
  customerEmail: string
  orderNumber: string
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export const kr = (n: number): string => `kr ${n},-`

export function emailHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f2ede4;font-family:Arial,Helvetica,sans-serif;color:#1a1d17;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede4;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#faf6ee;padding:20px 32px;text-align:center;border-bottom:1px solid #e8e0d4;">
              <img src="https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/logo-wf-new.png" alt="aBoks" width="90" style="max-width:90px;height:auto;display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9f6f0;padding:20px 32px;text-align:center;border-top:1px solid #e8e0d4;">
              <p style="margin:0 0 4px;color:#999;font-size:12px;">aBoks – Smart batteriorganisering</p>
              <p style="margin:0;color:#999;font-size:12px;">Spørsmål? Send oss en e-post: <a href="mailto:post@aboks.no" style="color:#999;">post@aboks.no</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function itemsTableHtml(items: OrderItem[]): string {
  const rows = items
    .map((item) => {
      const name = [item.productName || 'aBoks', item.variantName].filter(Boolean).join(' – ')
      return `<tr>
          <td style="padding:10px 8px;font-size:14px;border-bottom:1px solid #eee;">${name}</td>
          <td style="padding:10px 8px;font-size:14px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 8px;font-size:14px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${kr(item.lineTotal)}</td>
        </tr>`
    })
    .join('\n')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;">
      <tr style="background:#f9f6f0;">
        <th style="padding:8px;font-size:13px;color:#666;font-weight:600;text-align:left;">Produkt</th>
        <th style="padding:8px;font-size:13px;color:#666;font-weight:600;text-align:center;">Antall</th>
        <th style="padding:8px;font-size:13px;color:#666;font-weight:600;text-align:right;">Pris</th>
      </tr>
      ${rows}
    </table>`
}

export function itemsTextList(items: OrderItem[]): string {
  return items
    .map((item) => {
      const name = [item.productName || 'aBoks', item.variantName].filter(Boolean).join(' - ')
      return `  - ${name} x${item.quantity}  ${kr(item.lineTotal)}`
    })
    .join('\n')
}
