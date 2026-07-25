'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

type Status = { tone: 'idle' | 'ok' | 'error'; message: string }

type Invitation = {
  status: 'active' | 'used' | 'expired' | 'revoked'
  sentAt?: string | null
  expiresAt?: string | null
  usedAt?: string | null
}

const STATUS_LABEL: Record<Invitation['status'], string> = {
  active: 'Aktiv',
  used: 'Brukt',
  expired: 'Utløpt',
  revoked: 'Tilbakekalt',
}

/**
 * Sidebar action on the order page: send (or resend) a review invitation. Only enabled
 * when the order status is "levert" (delivered). Shows the latest invitation status and
 * last-sent date. Resend is an explicit, confirmed action that revokes the previous link.
 */
export default function SendReviewInvitation() {
  const { id } = useDocumentInfo()
  const orderStatus = useFormFields(([fields]) => fields?.status?.value as string | undefined)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>({ tone: 'idle', message: '' })
  const [latest, setLatest] = useState<Invitation | null>(null)

  const loadLatest = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(
        `/api/review-invitations?where[order][equals]=${id}&sort=-createdAt&limit=1&depth=0`,
        { credentials: 'include' },
      )
      const body = await res.json().catch(() => ({}))
      setLatest(body?.docs?.[0] ?? null)
    } catch {
      /* non-critical */
    }
  }, [id])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  if (!id) return null

  const hasActiveOrUsed = latest?.status === 'active' || latest?.status === 'used'

  const send = async (resend: boolean) => {
    if (resend && !confirm('Sende en ny invitasjon? Den forrige lenken vil slutte å virke.')) return

    setBusy(true)
    setStatus({ tone: 'idle', message: '' })
    try {
      const res = await fetch(
        `/api/orders/${id}/send-review-invitation${resend ? '?resend=true' : ''}`,
        { method: 'POST', credentials: 'include' },
      )
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus({ tone: 'ok', message: 'Anmeldelsesinvitasjon sendt.' })
      } else {
        setStatus({ tone: 'error', message: body?.error ?? `Feilet (${res.status})` })
      }
    } catch (err) {
      setStatus({ tone: 'error', message: err instanceof Error ? err.message : 'Nettverksfeil' })
    } finally {
      setBusy(false)
      void loadLatest()
    }
  }

  const disabled = busy || orderStatus !== 'delivered'

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>
        Anmeldelsesinvitasjon
      </div>

      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        disabled={disabled}
        onClick={() => send(hasActiveOrUsed)}
        style={{ margin: 0 }}
      >
        {busy
          ? 'Sender…'
          : hasActiveOrUsed
            ? 'Send anmeldelsesinvitasjon på nytt'
            : 'Send anmeldelsesinvitasjon'}
      </button>

      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
        {orderStatus !== 'delivered' && (
          <div style={{ opacity: 0.6 }}>Tilgjengelig når status er «Levert».</div>
        )}
        {latest && (
          <div style={{ opacity: 0.7 }}>
            Status: {STATUS_LABEL[latest.status]}
            {latest.sentAt && <> · sist sendt {new Date(latest.sentAt).toLocaleString('nb-NO')}</>}
          </div>
        )}
        {status.message && (
          <div
            style={{
              color: status.tone === 'error' ? '#e11d48' : '#15803d',
              marginTop: '0.25rem',
            }}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}
