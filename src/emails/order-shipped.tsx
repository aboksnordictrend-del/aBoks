import type { OrderShippedData, EmailTemplate } from './types'
import { kr, emailHtml, itemsTableHtml, itemsTextList } from './types'

export function createOrderShippedEmail(data: OrderShippedData): EmailTemplate {
  const { customerName, orderNumber, trackingNumber, items, total } = data

  const trackingBlock = trackingNumber
    ? `<div style="margin:24px 0;padding:16px 20px;background:#f9f6f0;border-left:3px solid #1a1d17;border-radius:0 4px 4px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Sporingsnummer</p>
        <p style="margin:0;font-size:16px;font-weight:bold;color:#1a1d17;">${trackingNumber}</p>
      </div>`
    : `<p style="margin:0 0 24px;font-size:14px;color:#555;">
        Sporingsinformasjon vil bli tilgjengelig hos fraktselskapet.
      </p>`

  const trackingTextBlock = trackingNumber
    ? `Sporingsnummer: ${trackingNumber}`
    : 'Sporingsinformasjon blir tilgjengelig hos fraktselskapet.'

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Bestillingen din er på vei, ${customerName}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Vi har sendt din ordre og gleder oss til at du får aBoks i hendene.
    </p>

    <p style="margin:0 0 4px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Ordrenummer</p>
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#1a1d17;">#${orderNumber}</p>

    ${trackingBlock}

    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Sendte produkter</h2>
    ${itemsTableHtml(items)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-collapse:collapse;">
      <tr style="border-top:2px solid #1a1d17;">
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;">Totalt betalt</td>
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;text-align:right;">${kr(total)}</td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Spørsmål om leveringen? Ta kontakt med oss på
      <a href="mailto:post@aboks.no" style="color:#1a1d17;">post@aboks.no</a>
    </p>
  `

  const text = `Bestillingen din er på vei, ${customerName}!

Vi har sendt din ordre og gleder oss til at du får aBoks i hendene.

Ordrenummer: #${orderNumber}

${trackingTextBlock}

SENDTE PRODUKTER
${itemsTextList(items)}

Totalt betalt: ${kr(total)}

Spørsmål om leveringen? Kontakt oss på post@aboks.no

Med vennlig hilsen,
aBoks`

  return {
    subject: `Bestillingen din er sendt – Ordre #${orderNumber}`,
    html: emailHtml(body),
    text,
  }
}
