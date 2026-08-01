import type { AdminReviewData, EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'

/** "★★★★☆" for a rating, clamped to the 1–5 the collection allows. */
function stars(rating: number): string {
  const safe = Math.min(5, Math.max(0, Math.round(Number.isFinite(rating) ? rating : 0)))
  return '★'.repeat(safe) + '☆'.repeat(5 - safe)
}

/**
 * Internal notification that a customer has submitted a new review.
 *
 * Sent to the same store address as the admin order e-mail, and built on the shared
 * `emailHtml` layout so the chrome is identical to every other e-mail. Purely
 * informational — moderation still happens in the admin panel, which is what the link
 * at the bottom goes to.
 */
export function createAdminReviewEmail(data: AdminReviewData): EmailTemplate {
  const { customerName, rating, text, productName, photoCount, adminUrl } = data

  const photosLabel = photoCount > 0 ? `Ja (${photoCount})` : 'Nei'

  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#555;width:140px;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:14px;color:#1a1d17;">${escapeHtml(value)}</td>
      </tr>`

  const infoCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 24px;border-collapse:collapse;background:#f9f6f0;border-radius:8px;">
      <tr><td style="padding:8px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${row('Kunde', customerName)}
          ${row('Vurdering', `${stars(rating)} (${rating} av 5)`)}
          ${row('Produkt', productName)}
          ${row('Bilder', photosLabel)}
        </table>
      </td></tr>
    </table>`

  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:bold;color:#1a1d17;">Ny anmeldelse mottatt</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      En kunde har sendt inn en anmeldelse. Den ligger til gjennomgang og publiseres først når den godkjennes.
    </p>

    ${infoCard}

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Anmeldelse</h2>
    <p style="margin:0 0 28px;font-size:15px;color:#1a1d17;line-height:1.6;white-space:pre-wrap;">${escapeHtml(text)}</p>

    <p style="margin:0;font-size:15px;">
      <a href="${escapeHtml(adminUrl)}" style="color:#1a1d17;font-weight:600;">Åpne anmeldelsen i admin-panelet</a>
    </p>
  `

  const text_ = `NY ANMELDELSE MOTTATT

Kunde: ${customerName}
Vurdering: ${stars(rating)} (${rating} av 5)
Produkt: ${productName}
Bilder: ${photosLabel}

ANMELDELSE
${text}

Åpne anmeldelsen i admin-panelet: ${adminUrl}`

  return {
    subject: 'Ny anmeldelse på aBoks',
    html: emailHtml(body),
    text: text_,
  }
}
