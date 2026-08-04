import type { AdminBusinessInquiryData, EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'
import { INQUIRY_LABELS } from '@/lib/bedrifter/inquiry'

/** Project timezone, matching @/lib/analytics/period — an inquiry is timestamped in Oslo time. */
const TIMEZONE = 'Europe/Oslo'

/**
 * `04.08.2026 kl. 14:32` — the `dd.MM.yyyy` of `formatDateNo` plus the time, built from
 * `formatToParts` so the output is fixed regardless of how the runtime's locale data spells
 * a combined date-time. An unparseable value is printed verbatim rather than swallowed.
 */
export function formatInquiryTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const parts = new Intl.DateTimeFormat('nb-NO', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('day')}.${get('month')}.${get('year')} kl. ${get('hour')}:${get('minute')}`
}

/**
 * Internal notification that a company has sent an inquiry from /bedrifter.
 *
 * Prints everything that was submitted — nothing is summarised away, because this is the only
 * record of the inquiry (no collection is written). The contact details are live links so the
 * reply is one tap away from a phone.
 *
 * Same shared `emailHtml` chrome and the same `<h2>` section rule as the admin order e-mail,
 * so it is recognisably part of the same system. Every value is customer-typed and escaped,
 * including the two values that end up inside `href` attributes.
 */
export function createAdminBusinessInquiryEmail(data: AdminBusinessInquiryData): EmailTemplate {
  const {
    company,
    orgNumber,
    contactPerson,
    email,
    phone,
    interest,
    quantity,
    message,
    submittedAt,
    source,
  } = data

  const NOT_GIVEN = 'Ikke oppgitt'
  const timestamp = formatInquiryTimestamp(submittedAt)
  // tel: cannot contain spaces; keep digits and a leading +.
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : ''

  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;width:180px;">${escapeHtml(label)}</td>
        <td style="padding:6px 0;font-size:14px;color:#1a1d17;">${value}</td>
      </tr>`

  // Unlike the customer's copy, the internal one lists every field even when it is empty —
  // "Ikke oppgitt" tells us the customer skipped it, which a missing row would not.
  const detailRows = [
    row(INQUIRY_LABELS.company, escapeHtml(company)),
    row(INQUIRY_LABELS.orgNumber, orgNumber ? escapeHtml(orgNumber) : NOT_GIVEN),
    row(INQUIRY_LABELS.contactPerson, escapeHtml(contactPerson)),
    row(
      INQUIRY_LABELS.email,
      `<a href="mailto:${escapeHtml(email)}" style="color:#1a1d17;">${escapeHtml(email)}</a>`,
    ),
    row(
      INQUIRY_LABELS.phone,
      phone
        ? `<a href="${escapeHtml(telHref)}" style="color:#1a1d17;">${escapeHtml(phone)}</a>`
        : NOT_GIVEN,
    ),
    row(INQUIRY_LABELS.quantity, quantity ? escapeHtml(quantity) : NOT_GIVEN),
    row(INQUIRY_LABELS.interest, escapeHtml(interest)),
  ].join('')

  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:bold;color:#1a1d17;">Ny bedriftsforespørsel</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      <strong>${escapeHtml(company)}</strong> har sendt inn skjemaet på ${escapeHtml(source)}.
    </p>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Kontaktopplysninger</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
      ${detailRows}
    </table>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">${escapeHtml(INQUIRY_LABELS.message)}</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#1a1d17;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>

    <h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">Innsending</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
      ${row('Mottatt', escapeHtml(timestamp))}
      ${row('Kilde', escapeHtml(source))}
    </table>

    <p style="margin:0;font-size:15px;">
      <a href="mailto:${escapeHtml(email)}" style="color:#1a1d17;font-weight:600;">Svar ${escapeHtml(contactPerson)}</a>
    </p>
  `

  const text = `NY BEDRIFTSFORESPØRSEL

${company} har sendt inn skjemaet på ${source}.

KONTAKTOPPLYSNINGER
${INQUIRY_LABELS.company}: ${company}
${INQUIRY_LABELS.orgNumber}: ${orgNumber || NOT_GIVEN}
${INQUIRY_LABELS.contactPerson}: ${contactPerson}
${INQUIRY_LABELS.email}: ${email}
${INQUIRY_LABELS.phone}: ${phone || NOT_GIVEN}
${INQUIRY_LABELS.quantity}: ${quantity || NOT_GIVEN}
${INQUIRY_LABELS.interest}: ${interest}

${INQUIRY_LABELS.message.toUpperCase()}
${message}

INNSENDING
Mottatt: ${timestamp}
Kilde: ${source}

Svar kunden på ${email}`

  // A company name is required by the validator, so the fallback only guards a template
  // called directly with an empty one.
  const subject = company ? `Ny bedriftsforespørsel fra ${company}` : 'Ny bedriftsforespørsel'

  return {
    subject,
    html: emailHtml(body),
    text,
  }
}
