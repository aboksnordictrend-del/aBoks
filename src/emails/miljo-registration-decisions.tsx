import type { EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'

/**
 * The e-mails around an administrator's review of a Miljøregistrering self-registration (Stage 2.6).
 * None of them contains a password, a token, the delivery PIN or another person's e-mail address, and
 * none of them grants anything: access follows from the administrator's decision in Payload.
 *
 * Every value that comes from a form or the register is escaped in the HTML; the plain-text body is
 * not (entities would show).
 */

const P = 'margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;'
const H1 = 'margin:0 0 16px;font-size:22px;font-weight:bold;color:#1a1d17;'
const CONTACT_HTML = '<a href="mailto:post@aboks.no" style="color:#1a1d17;">post@aboks.no</a>'
const SIGN_OFF_HTML = '<p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Med vennlig hilsen<br>aBoks</p>'
const SIGN_OFF_TEXT = 'Med vennlig hilsen\naBoks'

/* ------------------------------ to the order's e-mail address ------------------------------ */

export interface MiljoRegistrationOrderNoticeData {
  orderNumber: string
  organizationName: string
  organizationNumber: string
}

/** Security notice: this order was used to apply for access. Informational only. */
export function createMiljoRegistrationOrderNoticeEmail(data: MiljoRegistrationOrderNoticeData): EmailTemplate {
  const { orderNumber, organizationName, organizationNumber } = data
  const body = `
    <h1 style="${H1}">Ordren din er brukt i en søknad</h1>
    <p style="${P}">
      Ordre <strong style="color:#1a1d17;">${escapeHtml(orderNumber)}</strong> er brukt til å be om tilgang til aBoks Miljøregistrering for
      <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong> (org.nr. ${escapeHtml(organizationNumber)}).
    </p>
    <p style="${P}">Var dette deg, eller noen du samarbeider med, trenger du ikke å gjøre noe. aBoks gjennomgår søknaden før en konto eventuelt blir aktivert.</p>
    <p style="${P}">Kjenner du ikke igjen dette? Gi oss beskjed på ${CONTACT_HTML} og oppgi ordrenummeret.</p>
    ${SIGN_OFF_HTML}
  `
  const text = `Ordren din er brukt i en søknad

Ordre ${orderNumber} er brukt til å be om tilgang til aBoks Miljøregistrering for ${organizationName} (org.nr. ${organizationNumber}).

Var dette deg, eller noen du samarbeider med, trenger du ikke å gjøre noe. aBoks gjennomgår søknaden før en konto eventuelt blir aktivert.

Kjenner du ikke igjen dette? Gi oss beskjed på post@aboks.no og oppgi ordrenummeret.

${SIGN_OFF_TEXT}`
  return { subject: `Ordre ${orderNumber} er brukt i en søknad til aBoks Miljøregistrering`, html: emailHtml(body), text }
}

/* ------------------------------ to the applicant ------------------------------ */

export function createMiljoRegistrationApprovedEmail(data: { organizationName: string; loginUrl: string }): EmailTemplate {
  const { organizationName, loginUrl } = data
  const body = `
    <h1 style="${H1}">Bedriftskontoen er aktivert</h1>
    <p style="${P}">aBoks har godkjent registreringen av <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong>.</p>
    <p style="${P}">Du kan nå logge inn og ta i bruk aBoks Miljøregistrering. Bruk e-postadressen og passordet du valgte da du registrerte bedriften.</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(loginUrl)}"
         style="display:inline-block;padding:14px 28px;background:#1a1d17;color:#faf6ee;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">
        Logg inn
      </a>
    </p>
    ${SIGN_OFF_HTML}
  `
  const text = `Bedriftskontoen er aktivert

aBoks har godkjent registreringen av ${organizationName}.

Du kan nå logge inn og ta i bruk aBoks Miljøregistrering. Bruk e-postadressen og passordet du valgte da du registrerte bedriften.

Logg inn her: ${loginUrl}

${SIGN_OFF_TEXT}`
  return { subject: 'Bedriftskontoen er aktivert i aBoks Miljøregistrering', html: emailHtml(body), text }
}

/** Neutral on purpose: the administrator's reason is internal and never sent. */
export function createMiljoRegistrationRejectedEmail(data: { organizationName: string }): EmailTemplate {
  const { organizationName } = data
  const body = `
    <h1 style="${H1}">Registreringen ble ikke godkjent</h1>
    <p style="${P}">Vi kunne ikke godkjenne registreringen av <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong> i aBoks Miljøregistrering, og ingen konto er aktivert.</p>
    <p style="${P}">Ta gjerne kontakt på ${CONTACT_HTML} hvis du har spørsmål, eller hvis du mener at dette ikke stemmer.</p>
    ${SIGN_OFF_HTML}
  `
  const text = `Registreringen ble ikke godkjent

Vi kunne ikke godkjenne registreringen av ${organizationName} i aBoks Miljøregistrering, og ingen konto er aktivert.

Ta gjerne kontakt på post@aboks.no hvis du har spørsmål, eller hvis du mener at dette ikke stemmer.

${SIGN_OFF_TEXT}`
  return { subject: 'Registreringen i aBoks Miljøregistrering ble ikke godkjent', html: emailHtml(body), text }
}

/* ------------------------------ to aBoks ------------------------------ */

export interface AdminMiljoApplicationData {
  organizationName: string
  organizationNumber: string
  orderNumber: string
  contactName: string
  loginEmail: string
  reviewUrl: string
}

/** A confirmed application is waiting in Payload. Sent to aBoks only. */
export function createAdminMiljoApplicationEmail(data: AdminMiljoApplicationData): EmailTemplate {
  const { organizationName, organizationNumber, orderNumber, contactName, loginEmail, reviewUrl } = data
  const body = `
    <h1 style="${H1}">Ny søknad venter på godkjenning</h1>
    <p style="${P}">
      <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong> (org.nr. ${escapeHtml(organizationNumber)})<br>
      Ordre: ${escapeHtml(orderNumber)}<br>
      Kontaktperson: ${escapeHtml(contactName)}<br>
      E-post for innlogging: ${escapeHtml(loginEmail)}
    </p>
    <p style="${P}">Søkeren har bekreftet e-postadressen. Det sier ikke noe om tilknytningen til organisasjonen: bekreft den gjennom en uavhengig kanal før du godkjenner.</p>
    <p style="margin:0;">
      <a href="${escapeHtml(reviewUrl)}"
         style="display:inline-block;padding:14px 28px;background:#1a1d17;color:#faf6ee;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">
        Behandle søknaden
      </a>
    </p>
  `
  const text = `Ny søknad venter på godkjenning

${organizationName} (org.nr. ${organizationNumber})
Ordre: ${orderNumber}
Kontaktperson: ${contactName}
E-post for innlogging: ${loginEmail}

Søkeren har bekreftet e-postadressen. Det sier ikke noe om tilknytningen til organisasjonen: bekreft den gjennom en uavhengig kanal før du godkjenner.

Behandle søknaden: ${reviewUrl}`
  return { subject: `Miljøregistrering: ${organizationName} venter på godkjenning`, html: emailHtml(body), text }
}
