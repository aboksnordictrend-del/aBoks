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
  const { reviewUrl } = data

  const body = `
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:bold;color:#1a1d17;">Hei!</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Tusen takk for at du valgte aBoks. Vi håper den allerede har fått en naturlig plass
      hjemme hos deg.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Vi er et lite norsk selskap, og hver eneste anmeldelse betyr mye for oss. Din erfaring
      hjelper ikke bare oss med å lage enda bedre produkter, men gjør det også enklere for
      andre å finne aBoks.
    </p>
    <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
      Har du et par minutter? Vi blir veldig glade hvis du vil dele din opplevelse ved å
      bruke lenken nedenfor.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="border-radius:8px;background:#39402c;">
          <a href="${reviewUrl}"
             style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#faf6ee;text-decoration:none;border-radius:8px;">
            ⭐ Skriv en anmeldelse
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:13px;color:#8a8d80;line-height:1.6;">
      Lenken er personlig, kan bare brukes én gang og er gyldig i 30 dager.
    </p>

    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Som en liten takk for at du tok deg tid til å dele din erfaring, kan du bruke
      rabattkoden <strong>TAKK15</strong> og få <strong>15 % rabatt</strong> på ditt neste
      kjøp hos aBoks.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Takk for støtten – den betyr mer enn du kanskje tror.
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Med vennlig hilsen,<br>aBoks
    </p>
  `

  const text = `Hei!

Tusen takk for at du valgte aBoks. Vi håper den allerede har fått en naturlig plass hjemme hos deg.

Vi er et lite norsk selskap, og hver eneste anmeldelse betyr mye for oss. Din erfaring hjelper ikke bare oss med å lage enda bedre produkter, men gjør det også enklere for andre å finne aBoks.

Har du et par minutter? Vi blir veldig glade hvis du vil dele din opplevelse ved å bruke lenken nedenfor.

⭐ Skriv en anmeldelse:
${reviewUrl}

Lenken er personlig, kan bare brukes én gang og er gyldig i 30 dager.

Som en liten takk for at du tok deg tid til å dele din erfaring, kan du bruke rabattkoden TAKK15 og få 15 % rabatt på ditt neste kjøp hos aBoks.

Takk for støtten – den betyr mer enn du kanskje tror.

Med vennlig hilsen,
aBoks`

  return {
    subject: 'Takk for at du valgte aBoks!',
    html: emailHtml(body),
    text,
  }
}
