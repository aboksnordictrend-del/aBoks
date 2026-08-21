import type { OrderShippedData, EmailTemplate } from './types'
import { kr, emailHtml, escapeHtml, itemsTableHtml, itemsTextList } from './types'
import { carrierNameOf, normalizeTrackingNumber, trackingUrlFor } from '@/lib/orders/shipment'

/**
 * Sent once, on the transition into "sendt" (shipped), and again by the admin's explicit
 * «Send sporingsmail på nytt». Both paths build this same template — there is no second
 * shipping e-mail anywhere in the project.
 *
 * The carrier name and the «Spor pakken» URL are resolved here from the carrier *key*
 * (@/lib/orders/shipment), never passed in. An order whose carrier is missing or
 * unrecognised renders the pre-existing "kommer hos fraktselskapet" fallback instead of a
 * button, which is what makes this safe to send for a historical order that has neither
 * field.
 */
export function createOrderShippedEmail(data: OrderShippedData): EmailTemplate {
  const { customerName, orderNumber, items, total } = data

  const carrierName = carrierNameOf(data.shippingCarrier)
  const trackingUrl = trackingUrlFor(data.shippingCarrier)
  const trackingNumber = normalizeTrackingNumber(data.trackingNumber)

  // Every interpolated value below is customer- or operator-supplied, so every one is
  // escaped. The carrier name and URL are the only exceptions, and they are literals from
  // our own map rather than input.
  const safeName = escapeHtml(customerName)
  const safeTrackingNumber = trackingNumber ? escapeHtml(trackingNumber) : null

  const carrierLine = carrierName
    ? `<p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
        Pakken er sendt med <strong style="color:#1a1d17;">${carrierName}</strong>.
      </p>`
    : ''

  const trackingNumberBlock = safeTrackingNumber
    ? `<div style="margin:0 0 24px;padding:16px 20px;background:#f9f6f0;border-left:3px solid #1a1d17;border-radius:0 4px 4px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Sendingsnummer</p>
        <p style="margin:0;font-size:16px;font-weight:bold;color:#1a1d17;">${safeTrackingNumber}</p>
      </div>`
    : ''

  // Same button treatment as the review invitation, so every aBoks CTA looks alike.
  const trackingButton = trackingUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="border-radius:8px;background:#39402c;">
            <a href="${trackingUrl}"
               style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#faf6ee;text-decoration:none;border-radius:8px;">
              Spor pakken
            </a>
          </td>
        </tr>
      </table>`
    : ''

  const shipmentBlock =
    carrierLine || trackingNumberBlock || trackingButton
      ? `${carrierLine}${trackingNumberBlock}${trackingButton}`
      : `<p style="margin:0 0 24px;font-size:14px;color:#555;">
          Sporingsinformasjon vil bli tilgjengelig hos fraktselskapet.
        </p>`

  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#1a1d17;">Bestillingen din er sendt!</h1>

    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">Hei ${safeName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Gode nyheter – bestillingen din er nå sendt, og vi gleder oss til at du får aBoks i hendene.
    </p>

    <p style="margin:0 0 4px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Ordrenummer</p>
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#1a1d17;">#${escapeHtml(orderNumber)}</p>

    ${shipmentBlock}

    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Sendte produkter</h2>
    ${itemsTableHtml(items)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-collapse:collapse;">
      <tr style="border-top:2px solid #1a1d17;">
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;">Totalt betalt</td>
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;text-align:right;">${kr(total)}</td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
      Takk for at du handler hos aBoks!
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Spørsmål om leveringen? Ta kontakt med oss på
      <a href="mailto:post@aboks.no" style="color:#1a1d17;">post@aboks.no</a>
    </p>
  `

  // Plain-text bodies are deliberately not escaped — entities would show up literally.
  const shipmentTextLines = [
    carrierName ? `Pakken er sendt med ${carrierName}.` : null,
    trackingNumber ? `Sendingsnummer: ${trackingNumber}` : null,
    trackingUrl ? `Spor pakken: ${trackingUrl}` : null,
  ].filter(Boolean)

  const shipmentText =
    shipmentTextLines.length > 0
      ? shipmentTextLines.join('\n')
      : 'Sporingsinformasjon blir tilgjengelig hos fraktselskapet.'

  const text = `Bestillingen din er sendt!

Hei ${customerName},

Gode nyheter – bestillingen din er nå sendt, og vi gleder oss til at du får aBoks i hendene.

Ordrenummer: #${orderNumber}

${shipmentText}

SENDTE PRODUKTER
${itemsTextList(items)}

Totalt betalt: ${kr(total)}

Takk for at du handler hos aBoks!

Spørsmål om leveringen? Kontakt oss på post@aboks.no

Med vennlig hilsen,
aBoks`

  return {
    subject: `Bestillingen din er sendt – Ordre #${orderNumber}`,
    html: emailHtml(body),
    text,
  }
}
