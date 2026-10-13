import type { EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'
import { formatInquiryTimestamp } from './admin-business-inquiry'
import {
  APPLICANT_TYPE_LABELS,
  APPLICATION_LABELS,
  type CleanApplication,
} from '@/lib/partnerProgram/application'

export interface AdminPartnerApplicationData extends CleanApplication {
  /** ISO timestamp of when the submission was accepted. */
  submittedAt: string
  /** Page the application came from, e.g. "/bli-partner". */
  source: string
}

/**
 * Internal notification of a Salgspartner application from /bli-partner.
 *
 * This e-mail is the only record of the application — no collection is written — so every
 * submitted field is printed, with «Ikke oppgitt» for an optional field left empty. It
 * states plainly that nothing has been approved or created: approving the applicant,
 * signing the agreement and creating the partner code all happen by hand in Payload.
 *
 * Every value is applicant-typed and escaped, including those inside `href` attributes.
 */
export function createAdminPartnerApplicationEmail(data: AdminPartnerApplicationData): EmailTemplate {
  const {
    applicantType,
    fullName,
    companyName,
    orgNumber,
    email,
    phone,
    website,
    promotionPlan,
    submittedAt,
    source,
  } = data
  const NOT_GIVEN = 'Ikke oppgitt'
  const typeLabel = APPLICANT_TYPE_LABELS[applicantType]
  const timestamp = formatInquiryTimestamp(submittedAt)
  // tel: cannot contain spaces; keep digits and a leading +.
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : ''
  const showBusiness = applicantType !== 'privatperson'

  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#555;width:200px;">${escapeHtml(label)}</td>
        <td style="padding:6px 0;font-size:14px;color:#1a1d17;">${value}</td>
      </tr>`

  const rows = [
    row(APPLICATION_LABELS.applicantType, escapeHtml(typeLabel)),
    row(APPLICATION_LABELS.fullName, escapeHtml(fullName)),
    showBusiness
      ? row(APPLICATION_LABELS.companyName, companyName ? escapeHtml(companyName) : NOT_GIVEN)
      : '',
    showBusiness
      ? row(APPLICATION_LABELS.orgNumber, orgNumber ? escapeHtml(orgNumber) : NOT_GIVEN)
      : '',
    row(
      APPLICATION_LABELS.email,
      `<a href="mailto:${escapeHtml(email)}" style="color:#1a1d17;">${escapeHtml(email)}</a>`,
    ),
    row(
      APPLICATION_LABELS.phone,
      phone
        ? `<a href="${escapeHtml(telHref)}" style="color:#1a1d17;">${escapeHtml(phone)}</a>`
        : NOT_GIVEN,
    ),
    row(APPLICATION_LABELS.website, website ? escapeHtml(website) : NOT_GIVEN),
  ].join('')

  const h2 = (title: string) =>
    `<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1a1d17;border-bottom:2px solid #1a1d17;padding-bottom:8px;">${escapeHtml(title)}</h2>`

  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:bold;color:#1a1d17;">Ny søknad: aBoks-salgspartner</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;">
      <strong>${escapeHtml(fullName)}</strong> (${escapeHtml(typeLabel)}) har sendt inn søknadsskjemaet på ${escapeHtml(source)}.
    </p>

    ${h2('Søker')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
      ${rows}
    </table>

    ${h2(APPLICATION_LABELS.promotionPlan)}
    <p style="margin:0 0 24px;font-size:15px;color:#1a1d17;line-height:1.6;white-space:pre-wrap;">${escapeHtml(promotionPlan)}</p>

    ${h2('Bekreftelser og innsending')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
      ${row('Personvern', 'Har lest personvernerklæringen')}
      ${row('Godkjenning', 'Forstår at søknaden ikke er automatisk godkjent')}
      ${row('Mottatt', escapeHtml(timestamp))}
      ${row('Kilde', escapeHtml(source))}
    </table>

    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Ingenting er godkjent eller opprettet automatisk. Ved godkjenning: inngå partneravtale og opprett partnerkoden manuelt under Rabattkoder i Payload.
    </p>

    <p style="margin:0;font-size:15px;">
      <a href="mailto:${escapeHtml(email)}" style="color:#1a1d17;font-weight:600;">Svar ${escapeHtml(fullName)}</a>
    </p>
  `

  const textRows = [
    `${APPLICATION_LABELS.applicantType}: ${typeLabel}`,
    `${APPLICATION_LABELS.fullName}: ${fullName}`,
    showBusiness ? `${APPLICATION_LABELS.companyName}: ${companyName || NOT_GIVEN}` : '',
    showBusiness ? `${APPLICATION_LABELS.orgNumber}: ${orgNumber || NOT_GIVEN}` : '',
    `${APPLICATION_LABELS.email}: ${email}`,
    `${APPLICATION_LABELS.phone}: ${phone || NOT_GIVEN}`,
    `${APPLICATION_LABELS.website}: ${website || NOT_GIVEN}`,
  ]
    .filter(Boolean)
    .join('\n')

  const text = `NY SØKNAD: ABOKS-SALGSPARTNER

${fullName} (${typeLabel}) har sendt inn søknadsskjemaet på ${source}.

SØKER
${textRows}

${APPLICATION_LABELS.promotionPlan.toUpperCase()}
${promotionPlan}

Mottatt: ${timestamp}
Kilde: ${source}

Ingenting er godkjent eller opprettet automatisk. Ved godkjenning: inngå partneravtale og opprett partnerkoden manuelt under Rabattkoder i Payload.`

  return {
    subject: `Ny partnersøknad – ${fullName}`,
    html: emailHtml(body),
    text,
  }
}
