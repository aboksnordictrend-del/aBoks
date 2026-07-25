import type { ReviewInvitationData, EmailTemplate } from './types'
import { emailHtml } from './types'

/**
 * Personal invitation to leave a review, sent from the order page when status is
 * "levert" (delivered). Uses the shared aBoks email layout (same header, logo, footer).
 *
 * The link is personal, one-time and valid for 30 days — the raw token lives only in this
 * URL and is never logged.
 */
export function createReviewInvitationEmail(data: ReviewInvitationData): EmailTemplate {
  const { firstName, reviewUrl } = data
  const greetingName = firstName?.trim() || 'der'

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Hei ${greetingName},</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Vi håper du er fornøyd med din aBoks.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Din tilbakemelding hjelper oss med å forbedre produktene våre og gjør det enklere for
      andre kunder å velge riktig løsning.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
      Det tar bare et par minutter å legge igjen en anmeldelse.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="border-radius:8px;background:#39402c;">
          <a href="${reviewUrl}"
             style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#faf6ee;text-decoration:none;border-radius:8px;">
            Gi en anmeldelse
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
      Du kan også legge ved bilder av hvordan du bruker aBoks hjemme.
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#8a8d80;line-height:1.6;">
      Lenken er personlig og kan bare brukes én gang. Den er gyldig i 30 dager.
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Med vennlig hilsen<br>aBoks
    </p>
  `

  const text = `Hei ${greetingName},

Vi håper du er fornøyd med din aBoks.

Din tilbakemelding hjelper oss med å forbedre produktene våre og gjør det enklere for andre kunder å velge riktig løsning.

Det tar bare et par minutter å legge igjen en anmeldelse:
${reviewUrl}

Du kan også legge ved bilder av hvordan du bruker aBoks hjemme.

Lenken er personlig og kan bare brukes én gang. Den er gyldig i 30 dager.

Med vennlig hilsen
aBoks`

  return {
    subject: 'Hvordan liker du din aBoks?',
    html: emailHtml(body),
    text,
  }
}
