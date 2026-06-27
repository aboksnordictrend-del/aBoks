import type { AdminOrderData, EmailTemplate } from './types'
import { kr, emailHtml, itemsTableHtml, itemsTextList } from './types'

export function createAdminOrderEmail(data: AdminOrderData): EmailTemplate {
  const {
    customerName,
    customerEmail,
    customerPhone,
    orderNumber,
    items,
    subtotal,
    shipping,
    total,
    shippingAddress,
  } = data

  const phoneRow = customerPhone
    ? `<tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">Telefon</td>
        <td style="padding:4px 0;font-size:14px;">${customerPhone}</td>
      </tr>`
    : ''

  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:bold;color:#1a1d17;">Ny bestilling innkommet</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      Ordre <strong>#${orderNumber}</strong> er registrert og venter på behandling.
    </p>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Kundeinformasjon</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;width:120px;">Navn</td>
        <td style="padding:4px 0;font-size:14px;">${customerName}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">E-post</td>
        <td style="padding:4px 0;font-size:14px;">
          <a href="mailto:${customerEmail}" style="color:#1a1d17;">${customerEmail}</a>
        </td>
      </tr>
      ${phoneRow}
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">Adresse</td>
        <td style="padding:4px 0;font-size:14px;">
          ${shippingAddress.address}, ${shippingAddress.postalCode} ${shippingAddress.city}
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Produkter</h2>
    ${itemsTableHtml(items)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;">Delsum</td>
        <td style="padding:6px 0;font-size:14px;text-align:right;">${kr(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;">Frakt</td>
        <td style="padding:6px 0;font-size:14px;text-align:right;">${shipping > 0 ? kr(shipping) : 'Gratis'}</td>
      </tr>
      <tr style="border-top:2px solid #1a1d17;">
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;">Totalt</td>
        <td style="padding:10px 0 4px;font-size:16px;font-weight:bold;text-align:right;">${kr(total)}</td>
      </tr>
    </table>
  `

  const phoneLine = customerPhone ? `Telefon: ${customerPhone}` : ''

  const text = `NY BESTILLING – #${orderNumber}

KUNDEINFORMASJON
Navn: ${customerName}
E-post: ${customerEmail}
${phoneLine}
Adresse: ${shippingAddress.address}, ${shippingAddress.postalCode} ${shippingAddress.city}

PRODUKTER
${itemsTextList(items)}

Delsum: ${kr(subtotal)}
Frakt: ${shipping > 0 ? kr(shipping) : 'Gratis'}
Totalt: ${kr(total)}

Logg inn i admin-panelet for å behandle ordren.`

  return {
    subject: `Ny bestilling #${orderNumber} – ${customerName}`,
    html: emailHtml(body),
    text,
  }
}
