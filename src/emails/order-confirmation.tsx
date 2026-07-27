import type { OrderConfirmationData, EmailTemplate } from './types'
import { emailHtml, escapeHtml, itemsTableHtml, itemsTextList, summaryTableHtml, summaryTextLines } from './types'

export function createOrderConfirmationEmail(data: OrderConfirmationData): EmailTemplate {
  const { customerName, orderNumber, items, subtotal, shipping, total, discount, shippingAddress } =
    data

  // Delsum / Frakt / Rabatt (CODE) / Totalt — built from the stored order only. An order
  // without a promo produces the same three rows it always has.
  const summary = { subtotal, shipping, total, discount }

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Takk for bestillingen, ${escapeHtml(customerName)}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Vi har mottatt din bestilling og behandler den nå. Du vil få en ny e-post når ordren er sendt.
    </p>

    <p style="margin:0 0 4px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Ordrenummer</p>
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#1a1d17;">#${escapeHtml(orderNumber)}</p>

    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Bestilte produkter</h2>
    ${itemsTableHtml(items)}

    ${summaryTableHtml(summary)}

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Leveringsadresse</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.8;">
      ${escapeHtml(shippingAddress.address)}<br>
      ${escapeHtml(shippingAddress.postalCode)} ${escapeHtml(shippingAddress.city)}
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Har du spørsmål om bestillingen din? Ta kontakt med oss på
      <a href="mailto:post@aboks.no" style="color:#1a1d17;">post@aboks.no</a>
    </p>
  `

  const text = `Takk for bestillingen, ${customerName}!

Vi har mottatt din bestilling og behandler den nå.
Du vil få en ny e-post når ordren er sendt.

Ordrenummer: #${orderNumber}

BESTILTE PRODUKTER
${itemsTextList(items)}

${summaryTextLines(summary)}

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
