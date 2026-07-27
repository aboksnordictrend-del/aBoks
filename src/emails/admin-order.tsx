import type { AdminOrderData, EmailTemplate } from './types'
import { emailHtml, escapeHtml, itemsTableHtml, itemsTextList, summaryTableHtml, summaryTextLines } from './types'

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
    discount,
    shippingAddress,
  } = data

  // Same stored-snapshot summary the customer receives, so admin and customer never see
  // different numbers for the same order.
  const summary = { subtotal, shipping, total, discount }

  const phoneRow = customerPhone
    ? `<tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">Telefon</td>
        <td style="padding:4px 0;font-size:14px;">${escapeHtml(customerPhone)}</td>
      </tr>`
    : ''

  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:bold;color:#1a1d17;">Ny bestilling innkommet</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      Ordre <strong>#${escapeHtml(orderNumber)}</strong> er registrert og venter på behandling.
    </p>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Kundeinformasjon</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;width:120px;">Navn</td>
        <td style="padding:4px 0;font-size:14px;">${escapeHtml(customerName)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">E-post</td>
        <td style="padding:4px 0;font-size:14px;">
          <a href="mailto:${escapeHtml(customerEmail)}" style="color:#1a1d17;">${escapeHtml(customerEmail)}</a>
        </td>
      </tr>
      ${phoneRow}
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">Adresse</td>
        <td style="padding:4px 0;font-size:14px;">
          ${escapeHtml(shippingAddress.address)}, ${escapeHtml(shippingAddress.postalCode)} ${escapeHtml(shippingAddress.city)}
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Produkter</h2>
    ${itemsTableHtml(items)}

    ${summaryTableHtml(summary, '0')}
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

${summaryTextLines(summary)}

Logg inn i admin-panelet for å behandle ordren.`

  return {
    subject: `Ny bestilling #${orderNumber} – ${customerName}`,
    html: emailHtml(body),
    text,
  }
}
