import { buildOrderSummaryRows, type OrderSummaryInput } from '@/lib/orders/renderOrderSummary'

export interface OrderItem {
  /**
   * The finished product name for this line, exactly as snapshotted on the order
   * ("aBoks Vegg – Mørk blå"). Templates print it verbatim — they must never compose a
   * name from a product title and a colour, because an e-mail has no way of knowing which
   * product a colour belongs to. Resolve it with `orderLineDisplayName()`.
   */
  displayName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ShippingAddress {
  address: string
  postalCode: string
  city: string
}

/**
 * The promo snapshot as stored on the order. Present only for a discounted order; every
 * value is printed verbatim and never recomputed.
 */
export interface OrderDiscount {
  code?: string | null
  discountAmount?: number | null
}

export interface OrderConfirmationData {
  customerName: string
  customerEmail: string
  orderNumber: string
  items: OrderItem[]
  subtotal: number
  shipping: number
  total: number
  discount?: OrderDiscount | null
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
  discount?: OrderDiscount | null
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

export interface ReviewInvitationData {
  /** First name for the greeting ("Hei [FORNAVN]"), falling back to a neutral word. */
  firstName: string
  /** Absolute, production URL of the personal one-time review link. */
  reviewUrl: string
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

/**
 * The e-mail money format. The space after "kr" is a non-breaking space, as it always has
 * been, so an amount never wraps across a line.
 *
 * A whole number keeps the established `kr 518,-` form ("and no øre"), so every existing
 * e-mail renders exactly as before. A percentage discount is the first amount here that can
 * carry øre, and `kr 44.9,-` would be wrong twice over — a decimal point, and a suffix
 * claiming there are no øre — so a fractional amount prints as `kr 44,90` instead.
 *
 * Deliberately still the only formatter in the e-mail layer.
 */
export const kr = (n: number): string => {
  const safe = Number.isFinite(n) ? n : 0
  const rounded = Math.round(safe * 100) / 100
  if (Number.isInteger(rounded)) return `kr ${rounded},-`
  return `kr ${rounded.toFixed(2).replace('.', ',')}`
}

/**
 * Escapes text before it is interpolated into e-mail HTML.
 *
 * These templates are string-built, not React-rendered, so nothing escapes for us. Most of
 * the values are customer-controlled — the name, address, phone and e-mail all come from the
 * address the buyer typed into Kustom — and they land in the customer's own confirmation and
 * in the admin notification. Unescaped, a name containing markup breaks the layout of both
 * and can inject links into the shop owner's mailbox.
 *
 * Covers the five characters that matter in both element content and quoted attributes, so
 * the same helper is safe for `mailto:` hrefs. Plain-text bodies are deliberately NOT escaped
 * — entities there would be shown literally. JSX values elsewhere in the project already
 * escape themselves and must not be passed through this.
 */
export function escapeHtml(value: unknown): string {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
      return `<tr>
          <td style="padding:10px 8px;font-size:14px;border-bottom:1px solid #eee;">${escapeHtml(item.displayName)}</td>
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
    .map((item) => `  - ${item.displayName} x${item.quantity}  ${kr(item.lineTotal)}`)
    .join('\n')
}

/**
 * The Delsum / Frakt / Rabatt / Totalt block, shared by the confirmation and admin emails so
 * the two can never disagree. Rows come from the single presentation helper; nothing here
 * decides what an order is worth.
 *
 * The markup is unchanged from what both templates already emitted — an order with no
 * discount renders byte-for-byte as before.
 */
export function summaryTableHtml(order: OrderSummaryInput, marginBottom = '24px'): string {
  const rows = buildOrderSummaryRows(order)
    .map((row) => {
      if (row.strong) {
        return `<tr style="border-top:2px solid #1a1d17;">
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;">${escapeHtml(row.label)}</td>
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;text-align:right;">${kr(row.amount)}</td>
      </tr>`
      }
      if (row.free) {
        return `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;">${escapeHtml(row.label)}</td>
        <td style="padding:6px 0;font-size:14px;text-align:right;color:#4a7c59;">Gratis</td>
      </tr>`
      }
      const value = row.amount < 0 ? `−${kr(Math.abs(row.amount))}` : kr(row.amount)
      const color = row.key === 'discount' ? '#4a7c59' : undefined
      return `<tr>
        <td style="padding:6px 0;font-size:14px;color:#555;">${escapeHtml(row.label)}</td>
        <td style="padding:6px 0;font-size:14px;text-align:right;${color ? `color:${color};` : ''}">${value}</td>
      </tr>`
    })
    .join('\n      ')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 ${marginBottom};border-collapse:collapse;">
      ${rows}
    </table>`
}

/** Plain-text equivalent of `summaryTableHtml`, one `Label: beløp` line per row. */
export function summaryTextLines(order: OrderSummaryInput): string {
  return buildOrderSummaryRows(order)
    .map((row) => {
      if (row.free) return `${row.label}: Gratis`
      const value = row.amount < 0 ? `−${kr(Math.abs(row.amount))}` : kr(row.amount)
      return `${row.label}: ${value}`
    })
    .join('\n')
}
