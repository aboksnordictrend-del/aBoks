import type { BusinessInquiryData, EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'
import { INQUIRY_LABELS } from '@/lib/bedrifter/inquiry'

/**
 * Receipt for a B2B inquiry sent from /bedrifter, addressed to whoever filled the form in.
 *
 * Built on the shared `emailHtml` chrome, so the header, logo, footer, palette and type scale
 * are identical to every other aBoks e-mail. It states plainly that we have the inquiry and
 * repeats what was submitted — nothing else. No internal metadata (IP, user agent, honeypot
 * or rate-limit state) appears anywhere in it.
 *
 * Every value is customer-typed and therefore escaped. The plain-text body deliberately is
 * not escaped; entities would be shown literally there.
 */
export function createBusinessInquiryConfirmationEmail(data: BusinessInquiryData): EmailTemplate {
  const { company, orgNumber, contactPerson, email, phone, interest, quantity, message } = data

  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#555;width:180px;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:14px;color:#1a1d17;">${escapeHtml(value)}</td>
      </tr>`

  // Optional fields are omitted entirely rather than printed empty — an inquiry without a
  // phone number must not show a "Telefonnummer" row at all.
  const rows = [
    row(INQUIRY_LABELS.company, company),
    orgNumber ? row(INQUIRY_LABELS.orgNumber, orgNumber) : '',
    row(INQUIRY_LABELS.contactPerson, contactPerson),
    row(INQUIRY_LABELS.email, email),
    phone ? row(INQUIRY_LABELS.phone, phone) : '',
    quantity ? row(INQUIRY_LABELS.quantity, quantity) : '',
    row(INQUIRY_LABELS.interest, interest),
  ]
    .filter(Boolean)
    .join('')

  const summaryCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 24px;border-collapse:collapse;background:#f9f6f0;border-radius:8px;">
      <tr><td style="padding:8px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${rows}
        </table>
      </td></tr>
    </table>`

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Takk for forespørselen!</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Hei ${escapeHtml(contactPerson)},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Vi har mottatt forespørselen din og tar kontakt så snart som mulig.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Nedenfor finner du en oppsummering av opplysningene du sendte inn.
    </p>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Din forespørsel</h2>
    ${summaryCard}

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">${escapeHtml(INQUIRY_LABELS.message)}</h2>
    <p style="margin:0 0 28px;font-size:15px;color:#1a1d17;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>

    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">Forespørselen er uforpliktende.</p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Med vennlig hilsen<br>aBoks
    </p>
  `

  const textRows = [
    `${INQUIRY_LABELS.company}: ${company}`,
    orgNumber ? `${INQUIRY_LABELS.orgNumber}: ${orgNumber}` : '',
    `${INQUIRY_LABELS.contactPerson}: ${contactPerson}`,
    `${INQUIRY_LABELS.email}: ${email}`,
    phone ? `${INQUIRY_LABELS.phone}: ${phone}` : '',
    quantity ? `${INQUIRY_LABELS.quantity}: ${quantity}` : '',
    `${INQUIRY_LABELS.interest}: ${interest}`,
  ]
    .filter(Boolean)
    .join('\n')

  const text = `Takk for forespørselen!

Hei ${contactPerson},

Vi har mottatt forespørselen din og tar kontakt så snart som mulig.

Nedenfor finner du en oppsummering av opplysningene du sendte inn.

DIN FORESPØRSEL
${textRows}

${INQUIRY_LABELS.message.toUpperCase()}
${message}

Forespørselen er uforpliktende.

Med vennlig hilsen
aBoks`

  return {
    subject: 'Vi har mottatt forespørselen din',
    html: emailHtml(body),
    text,
  }
}
