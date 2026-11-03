import type { EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'

/**
 * «Glemt passord» for a Miljøregistrering account. Sent only to the login e-mail of an account
 * that can sign in; the link opens a page where the new password is chosen (nothing changes by
 * merely opening it). The link works once, for one hour.
 */
export interface MiljoPasswordResetData {
  organizationName: string
  resetUrl: string
  expiresAt: Date
}

function formatExpiry(date: Date): string {
  return date.toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' })
}

export function createMiljoPasswordResetEmail(data: MiljoPasswordResetData): EmailTemplate {
  const { organizationName, resetUrl, expiresAt } = data
  const expiry = formatExpiry(expiresAt)

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Nytt passord for aBoks Miljøregistrering</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Vi har fått en forespørsel om nytt passord for kontoen til <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong>.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(resetUrl)}"
         style="display:inline-block;padding:14px 28px;background:#1a1d17;color:#faf6ee;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">
        Lag nytt passord
      </a>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Lenken kan brukes én gang og gjelder til kl. ${escapeHtml(expiry)}. Fungerer ikke knappen, kan du lime inn denne adressen i nettleseren:<br>
      <span style="word-break:break-all;color:#1a1d17;">${escapeHtml(resetUrl)}</span>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Har du ikke bedt om nytt passord? Da kan du se bort fra denne e-posten. Passordet endres ikke uten at lenken brukes.
    </p>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Med vennlig hilsen<br>aBoks</p>
  `

  const text = `Nytt passord for aBoks Miljøregistrering

Vi har fått en forespørsel om nytt passord for kontoen til ${organizationName}. Lag nytt passord her:

${resetUrl}

Lenken kan brukes én gang og gjelder til kl. ${expiry}.

Har du ikke bedt om nytt passord? Da kan du se bort fra denne e-posten. Passordet endres ikke uten at lenken brukes.

Med vennlig hilsen
aBoks`

  return { subject: 'Nytt passord for aBoks Miljøregistrering', html: emailHtml(body), text }
}
