import type { EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'

/**
 * Confirmation of a Miljøregistrering Bedrift self-registration, sent to the LOGIN e-mail the
 * registrant chose. The single link activates the account (it opens a page with a button, so a
 * mail scanner that follows links cannot activate anything by itself).
 *
 * Every registrant-typed value is escaped; the plain-text body is not (entities would show).
 */
export interface MiljoRegistrationConfirmationData {
  organizationName: string
  organizationNumber: string
  contactName: string
  confirmUrl: string
  expiresAt: Date
}

function formatExpiry(date: Date): string {
  return date.toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function createMiljoRegistrationConfirmationEmail(data: MiljoRegistrationConfirmationData): EmailTemplate {
  const { organizationName, organizationNumber, contactName, confirmUrl, expiresAt } = data
  const expiry = formatExpiry(expiresAt)

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Bekreft registreringen i aBoks Miljøregistrering</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Hei ${escapeHtml(contactName)},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Du har registrert <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong>
      (org.nr. ${escapeHtml(organizationNumber)}) i aBoks Miljøregistrering. Bekreft e-postadressen for å aktivere kontoen.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(confirmUrl)}"
         style="display:inline-block;padding:14px 28px;background:#1a1d17;color:#faf6ee;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">
        Bekreft og aktiver
      </a>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Lenken kan brukes én gang og gjelder til ${escapeHtml(expiry)}. Fungerer ikke knappen, kan du lime inn denne adressen i nettleseren:<br>
      <span style="word-break:break-all;color:#1a1d17;">${escapeHtml(confirmUrl)}</span>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Har du ikke registrert deg? Da kan du se bort fra denne e-posten. Ingen konto blir aktivert uten at lenken brukes.
    </p>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Med vennlig hilsen<br>aBoks</p>
  `

  const text = `Bekreft registreringen i aBoks Miljøregistrering

Hei ${contactName},

Du har registrert ${organizationName} (org.nr. ${organizationNumber}) i aBoks Miljøregistrering. Bekreft e-postadressen for å aktivere kontoen:

${confirmUrl}

Lenken kan brukes én gang og gjelder til ${expiry}.

Har du ikke registrert deg? Da kan du se bort fra denne e-posten. Ingen konto blir aktivert uten at lenken brukes.

Med vennlig hilsen
aBoks`

  return { subject: 'Bekreft registreringen i aBoks Miljøregistrering', html: emailHtml(body), text }
}
