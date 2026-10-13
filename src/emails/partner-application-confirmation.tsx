import type { EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'
import {
  APPLICANT_TYPE_LABELS,
  APPLICATION_LABELS,
  type CleanApplication,
} from '@/lib/partnerProgram/application'

/**
 * Receipt for a Salgspartner application, addressed to the applicant.
 *
 * Says that the application has arrived and will be assessed — and, explicitly, that it is
 * neither an approval nor an agreement. No partner code is mentioned as issued, because none
 * is. Every value is applicant-typed and escaped; the plain-text body is not.
 */
export function createPartnerApplicationConfirmationEmail(data: CleanApplication): EmailTemplate {
  const { applicantType, fullName, companyName, orgNumber, email, phone, website, promotionPlan } =
    data

  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#555;width:200px;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:14px;color:#1a1d17;">${escapeHtml(value)}</td>
      </tr>`

  // Optional fields are left out entirely rather than printed empty.
  const pairs: [string, string | undefined][] = [
    [APPLICATION_LABELS.applicantType, APPLICANT_TYPE_LABELS[applicantType]],
    [APPLICATION_LABELS.fullName, fullName],
    [APPLICATION_LABELS.companyName, companyName],
    [APPLICATION_LABELS.orgNumber, orgNumber],
    [APPLICATION_LABELS.email, email],
    [APPLICATION_LABELS.phone, phone],
    [APPLICATION_LABELS.website, website],
  ]
  const present = pairs.filter((pair): pair is [string, string] => Boolean(pair[1]))

  const h2 = (title: string) =>
    `<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">${escapeHtml(title)}</h2>`

  const NOT_AN_AGREEMENT =
    'Merk at søknaden ikke er en godkjenning eller en avtale. Et partnerskap starter først når ABOKS AS har godkjent søknaden og partneravtalen er signert av begge parter.'

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Takk for interessen!</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Hei ${escapeHtml(fullName)},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Vi har mottatt søknaden din om å bli aBoks-salgspartner og vil ta kontakt etter at den er vurdert.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">${escapeHtml(NOT_AN_AGREEMENT)}</p>

    ${h2('Din søknad')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 24px;border-collapse:collapse;background:#f9f6f0;border-radius:8px;">
      <tr><td style="padding:8px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${present.map(([label, value]) => row(label, value)).join('')}
        </table>
      </td></tr>
    </table>

    ${h2(APPLICATION_LABELS.promotionPlan)}
    <p style="margin:0 0 28px;font-size:15px;color:#1a1d17;line-height:1.6;white-space:pre-wrap;">${escapeHtml(promotionPlan)}</p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Med vennlig hilsen<br>ABOKS AS
    </p>
  `

  const text = `Takk for interessen!

Hei ${fullName},

Vi har mottatt søknaden din om å bli aBoks-salgspartner og vil ta kontakt etter at den er vurdert.

${NOT_AN_AGREEMENT}

DIN SØKNAD
${present.map(([label, value]) => `${label}: ${value}`).join('\n')}

${APPLICATION_LABELS.promotionPlan.toUpperCase()}
${promotionPlan}

Med vennlig hilsen
ABOKS AS`

  return {
    subject: 'Vi har mottatt søknaden din',
    html: emailHtml(body),
    text,
  }
}
