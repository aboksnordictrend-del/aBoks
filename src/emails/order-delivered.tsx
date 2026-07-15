import type { OrderDeliveredData, EmailTemplate } from './types'
import { emailHtml } from './types'

/**
 * Sent once, on the transition into "levert" (delivered). Carries the PDF receipt as an
 * attachment (added by the sender), so the body itself stays short and references it.
 * Uses the shared emailHtml layout — same header, logo and footer as every other order
 * email; nothing is duplicated here.
 */
export function createOrderDeliveredEmail(data: OrderDeliveredData): EmailTemplate {
  const { firstName, orderNumber } = data

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Hei ${firstName},</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Din ordre <strong style="color:#1a1d17;">#${orderNumber}</strong> er nå levert.
    </p>

    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Takk for at du valgte aBoks. Vedlagt finner du kvitteringen for kjøpet ditt.
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Har du spørsmål om bestillingen, kan du svare på denne e-posten eller kontakte oss på
      <a href="mailto:post@aboks.no" style="color:#1a1d17;">post@aboks.no</a>.
    </p>

    <p style="margin:24px 0 0;font-size:14px;color:#555;line-height:1.6;">
      Vennlig hilsen<br>aBoks
    </p>
  `

  const text = `Hei ${firstName},

Din ordre #${orderNumber} er nå levert.

Takk for at du valgte aBoks. Vedlagt finner du kvitteringen for kjøpet ditt.

Har du spørsmål om bestillingen, kan du svare på denne e-posten eller kontakte oss på post@aboks.no.

Vennlig hilsen
aBoks`

  return {
    subject: `Kvittering for ordre #${orderNumber}`,
    html: emailHtml(body),
    text,
  }
}
