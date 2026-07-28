import type { PartnerPayoutData, EmailTemplate } from './types'
import { emailHtml, escapeHtml, kr } from './types'
import { formatDateNo } from '@/lib/receiptPdf'

/**
 * Confirmation to a partner that their accumulated commission has been paid out.
 *
 * Sent only after the payout row exists in the ledger, and only when the promo code carries
 * a usable partner e-mail address. Uses the shared `emailHtml` layout — same header, logo,
 * typography and footer as every customer e-mail — so nothing about the chrome is duplicated
 * or redesigned here; only the body differs.
 *
 * Every figure is printed verbatim from what the server computed. This template never
 * calculates anything, and `Referanse` is omitted entirely rather than rendered empty.
 */
export function createPartnerPayoutEmail(data: PartnerPayoutData): EmailTemplate {
  const {
    partnerName,
    promoCode,
    validUsageCount,
    revenueAfterDiscount,
    payoutAmount,
    payoutDate,
    paymentMethod,
    reference,
  } = data

  const formattedDate = formatDateNo(payoutDate)
  const trimmedReference = typeof reference === 'string' ? reference.trim() : ''

  /** One label/value pair in the information card, styled like the order summary rows. */
  const row = (label: string, value: string, strong = false) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#555;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:${strong ? '15px' : '14px'};text-align:right;${
          strong ? 'font-weight:bold;color:#1a1d17;' : 'color:#1a1d17;'
        }white-space:nowrap;">${escapeHtml(value)}</td>
      </tr>`

  const infoCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 28px;border-collapse:collapse;background:#f9f6f0;border-radius:8px;">
      <tr><td style="padding:8px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${row('Rabattkode', promoCode)}
          ${row('Gyldige partnerkjøp', String(validUsageCount))}
          ${row('Omsetning etter rabatt', kr(revenueAfterDiscount))}
          ${row('Utbetalt provisjon', kr(payoutAmount), true)}
          ${row('Utbetalingsdato', formattedDate)}
          ${row('Betalingsmåte', paymentMethod)}
          ${trimmedReference ? row('Referanse', trimmedReference) : ''}
        </table>
      </td></tr>
    </table>`

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1d17;">Partnerutbetaling registrert</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Hei ${escapeHtml(partnerName)},
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
      Vi har registrert en utbetaling av opptjent partnerprovisjon knyttet til din rabattkode.
    </p>

    ${infoCard}

    <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
      Takk for samarbeidet!
    </p>

    <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
      Med vennlig hilsen<br>aBoks
    </p>
  `

  const textRows = [
    `Rabattkode: ${promoCode}`,
    `Gyldige partnerkjøp: ${validUsageCount}`,
    `Omsetning etter rabatt: ${kr(revenueAfterDiscount)}`,
    `Utbetalt provisjon: ${kr(payoutAmount)}`,
    `Utbetalingsdato: ${formattedDate}`,
    `Betalingsmåte: ${paymentMethod}`,
    ...(trimmedReference ? [`Referanse: ${trimmedReference}`] : []),
  ].join('\n')

  const text = `Partnerutbetaling registrert

Hei ${partnerName},

Vi har registrert en utbetaling av opptjent partnerprovisjon knyttet til din rabattkode.

${textRows}

Takk for samarbeidet!

Med vennlig hilsen
aBoks`

  return {
    subject: 'Utbetaling av partnerprovisjon fra aBoks',
    html: emailHtml(body),
    text,
  }
}
