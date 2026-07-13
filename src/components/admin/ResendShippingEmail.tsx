'use client'

import { useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

type Status = { tone: 'idle' | 'ok' | 'error'; message: string }

export default function ResendShippingEmail() {
  const { id } = useDocumentInfo()
  const orderStatus = useFormFields(([fields]) => fields?.status?.value as string | undefined)
  const sentAt = useFormFields(
    ([fields]) => fields?.shippedEmailSentAt?.value as string | undefined,
  )

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ tone: 'idle', message: '' })

  if (!id) return null

  const send = async (force: boolean) => {
    if (force && !confirm('Sende sporingsmailen på nytt? Kunden har allerede fått én.')) return

    setBusy(true)
    setStatus({ tone: 'idle', message: '' })

    try {
      const res = await fetch(
        `/api/orders/${id}/resend-shipping-email${force ? '?force=true' : ''}`,
        { method: 'POST', credentials: 'include' },
      )
      const body = await res.json().catch(() => ({}))

      if (res.ok) {
        setStatus({ tone: 'ok', message: 'Sporingsmail sendt.' })
      } else {
        setStatus({ tone: 'error', message: body?.error ?? `Feilet (${res.status})` })
      }
    } catch (err) {
      setStatus({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Nettverksfeil',
      })
    } finally {
      setBusy(false)
    }
  }

  const alreadySent = Boolean(sentAt)
  const disabled = busy || orderStatus !== 'shipped'

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Sporingsmail</div>

      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        disabled={disabled}
        onClick={() => send(alreadySent)}
        style={{ margin: 0 }}
      >
        {busy
          ? 'Sender…'
          : alreadySent
            ? 'Send sporingsmail på nytt'
            : 'Send sporingsmail'}
      </button>

      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
        {orderStatus !== 'shipped' && (
          <div style={{ opacity: 0.6 }}>Tilgjengelig når status er «Sendt».</div>
        )}
        {alreadySent && (
          <div style={{ opacity: 0.6 }}>
            Sendt {new Date(sentAt as string).toLocaleString('nb-NO')}
          </div>
        )}
        {status.message && (
          <div style={{ color: status.tone === 'error' ? '#e11d48' : '#15803d', marginTop: '0.25rem' }}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}
