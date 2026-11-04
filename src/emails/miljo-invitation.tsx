import type { EmailTemplate } from './types'
import { emailHtml, escapeHtml } from './types'

/**
 * Invitation from aBoks to a Miljøregistrering account (Stage 2.5). Sent only when an administrator
 * chooses «E-postinvitasjon»; the link opens a page where the recipient chooses their own password
 * (nothing changes by merely opening it). The link works once and expires; a new invitation from
 * aBoks makes any earlier link stop working.
 */
export interface MiljoInvitationData {
  recipientName: string
  organizationName: string
  activateUrl: string
  expiresAt: Date
}

function formatExpiry(date: Date): string {
  return date.toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function createMiljoInvitationEmail(data: MiljoInvitationData): EmailTemplate {
  const { recipientName, organizationName, activateUrl, expiresAt } = data
  const expiry = formatExpiry(expiresAt)
  const greeting = recipientName.trim() ? `Hei ${recipientName.trim()},` : 'Hei,'

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Du er invitert til aBoks Miljøregistrering</h1>
    <p style="margin:0 0 12px;font-size:15px;color:#555;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      aBoks har opprettet en brukerkonto for <strong style="color:#1a1d17;">${escapeHtml(organizationName)}</strong>.
      Med kontoen kan du se miljøstatistikken, laste ned rapporter og hente QR-koden og PIN-koden for leveranser.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(activateUrl)}"
         style="display:inline-block;padding:14px 28px;background:#1a1d17;color:#faf6ee;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;">
        Velg passord og aktiver kontoen
      </a>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Lenken kan brukes én gang og gjelder til ${escapeHtml(expiry)}. Fungerer ikke knappen, kan du lime inn denne adressen i nettleseren:<br>
      <span style="word-break:break-all;color:#1a1d17;">${escapeHtml(activateUrl)}</span>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Har du ikke ventet denne e-posten? Da kan du se bort fra den. Kontoen aktiveres ikke uten at lenken brukes.
    </p>
    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Med vennlig hilsen<br>aBoks</p>
  `

  const text = `Du er invitert til aBoks Miljøregistrering

${greeting}

aBoks har opprettet en brukerkonto for ${organizationName}. Med kontoen kan du se miljøstatistikken, laste ned rapporter og hente QR-koden og PIN-koden for leveranser.

Velg passord og aktiver kontoen her:

${activateUrl}

Lenken kan brukes én gang og gjelder til ${expiry}.

Har du ikke ventet denne e-posten? Da kan du se bort fra den. Kontoen aktiveres ikke uten at lenken brukes.

Med vennlig hilsen
aBoks`

  return { subject: 'Invitasjon til aBoks Miljøregistrering', html: emailHtml(body), text }
}
