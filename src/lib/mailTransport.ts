import nodemailer, { type Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

// Zoho EU SMTP. Without explicit timeouts nodemailer falls back to its defaults
// (connection 2 min, socket 10 min), which is long enough for a single stalled
// send to run a Vercel function into FUNCTION_INVOCATION_TIMEOUT.
export const SMTP_CONNECTION_TIMEOUT_MS = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 8_000)
export const SMTP_GREETING_TIMEOUT_MS = Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 6_000)
export const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 10_000)

/**
 * Backstop around payload.sendEmail(), in case the transport itself never settles.
 * Read per call rather than at module load so it stays configurable (and testable).
 */
export function getEmailSendTimeoutMs(): number {
  return Number(process.env.EMAIL_SEND_TIMEOUT_MS ?? 12_000)
}

export const smtpConfigured = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM,
)

let transporter: Transporter | null = null

export function getMailTransport(): Transporter | null {
  if (!smtpConfigured) return null
  if (transporter) return transporter

  const host = process.env.SMTP_HOST!
  const port = Number(process.env.SMTP_PORT)

  // No `pool`: in serverless every invocation is a fresh process, so a pool buys
  // nothing and only risks sockets outliving the response. One connection per send.
  const options: SMTPTransport.Options = {
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    dnsTimeout: 5_000,
    tls: {
      minVersion: 'TLSv1.2',
      servername: host,
    },
  }

  transporter = nodemailer.createTransport(options)

  return transporter
}

let verifyPromise: Promise<boolean> | null = null

/**
 * Lazily verifies the SMTP connection once per process. Never throws and never
 * blocks a send — callers may ignore the result; it exists for diagnostics.
 *
 * Off by default: verify() opens its own connection, and on a serverless cold start
 * that would run alongside the real send and eat into Zoho's concurrent-connection
 * limit. Set SMTP_VERIFY=true when diagnosing transport problems.
 */
export function verifyMailTransport(): Promise<boolean> {
  if (verifyPromise) return verifyPromise

  if (process.env.SMTP_VERIFY !== 'true') {
    verifyPromise = Promise.resolve(smtpConfigured)
    return verifyPromise
  }

  const transport = getMailTransport()
  if (!transport) {
    console.warn('[mail] SMTP not configured — emails are disabled')
    verifyPromise = Promise.resolve(false)
    return verifyPromise
  }

  const startedAt = Date.now()
  verifyPromise = transport
    .verify()
    .then(() => {
      console.log(
        '[mail] transport verified host=%s port=%s durationMs=%d',
        process.env.SMTP_HOST,
        process.env.SMTP_PORT,
        Date.now() - startedAt,
      )
      return true
    })
    .catch((err: unknown) => {
      console.error(
        '[mail] transport verification failed host=%s port=%s durationMs=%d error=%s',
        process.env.SMTP_HOST,
        process.env.SMTP_PORT,
        Date.now() - startedAt,
        err instanceof Error ? err.message : String(err),
      )
      return false
    })

  return verifyPromise
}
