import type { OrderConfirmationData, EmailTemplate } from './types'
import { kr, emailHtml, itemsTableHtml, itemsTextList } from './types'

export function createOrderConfirmationEmail(data: OrderConfirmationData): EmailTemplate {
  const { customerName, orderNumber, items, subtotal, shipping, total, shippingAddress } = data

  const shippingRow =
    shipping > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:14px;color:#555;">Frakt</td>
          <td style="padding:6px 0;font-size:14px;text-align:right;">${kr(shipping)}</td>
        </tr>`
      : `<tr>
          <td style="padding:6px 0;font-size:14px;color:#555;">Frakt</td>
          <td style="padding:6px 0;font-size:14px;text-align:right;color:#4a7c59;">Gratis</td>
        </tr>`

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Takk for bestillingen, ${customerName}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Vi har mottatt din bestilling og behandler den nå. Du vil få en ny e-post når ordren er sendt.
    </p>

    <p style="margin:0 0 4px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Ordrenummer</p>
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#1a1d17;">#${orderNumber}</p>

    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Bestilte produkter</h2>
    ${itemsTableHtml(items)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;">Delsum</td>
        <td style="padding:6px 0;font-size:14px;text-align:right;">${kr(subtotal)}</td>
      </tr>
      ${shippingRow}
      <tr style="border-top:2px solid #1a1d17;">
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;">Totalt</td>
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;text-align:right;">${kr(total)}</td>
      </tr>
    </table>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Leveringsadresse</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.8;">
      ${shippingAddress.address}<br>
      ${shippingAddress.postalCode} ${shippingAddress.city}
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Har du spørsmål om bestillingen din? Ta kontakt med oss på
      <a href="mailto:post@aboks.no" style="color:#1a1d17;">post@aboks.no</a>
    </p>
  `

  const shippingText = shipping > 0 ? `Frakt: ${kr(shipping)}` : 'Frakt: Gratis'

  const text = `Takk for bestillingen, ${customerName}!

Vi har mottatt din bestilling og behandler den nå.
Du vil få en ny e-post når ordren er sendt.

Ordrenummer: #${orderNumber}

BESTILTE PRODUKTER
${itemsTextList(items)}

Delsum: ${kr(subtotal)}
${shippingText}
Totalt: ${kr(total)}

LEVERINGSADRESSE
${shippingAddress.address}
${shippingAddress.postalCode} ${shippingAddress.city}

Har du spørsmål? Kontakt oss på post@aboks.no

Med vennlig hilsen,
aBoks`

  return {
    subject: `Takk for bestillingen din – Ordre #${orderNumber}`,
    html: emailHtml(body),
    text,
  }
}
