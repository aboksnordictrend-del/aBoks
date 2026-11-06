'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import { DECISION_NOTE_MAX, INTERNAL_NOTES_MAX, REGISTRATION_AUDIT_ACTION_OPTIONS, REGISTRATION_STATUS_OPTIONS, VERIFICATION_METHOD_OPTIONS } from '@/lib/miljo/registration/constants'
import type { RegistrationReview } from '@/lib/miljo/registration/approval'
import AuditHistory from './AuditHistory'
import { box, danger, heading, input, linkStyle, muted, osloDateTime, postJson, rule, warn } from './adminUi'

const label: CSSProperties = { display: 'block', fontWeight: 600, margin: '0.6rem 0 0.25rem' }
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }
const facts: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.35rem 1.5rem', margin: 0 }

const statusLabel = (s: string) => REGISTRATION_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s
const methodLabel = (m: string | null) => VERIFICATION_METHOD_OPTIONS.find((o) => o.value === m)?.label ?? ''
const ORDER_STATUS: Record<string, string> = { pending: 'Venter', confirmed: 'Bekreftet', shipped: 'Sendt', delivered: 'Levert', cancelled: 'Kansellert' }

/**
 * Top of a «Selvregistrering»: the administrator's decision. Everything goes through the admin-only
 * /api/miljo-registrations/:id endpoints, which check the role and the registration's state on the
 * server; this panel only collects the input. The registration's own fields stay read-only below.
 */
export default function RegistrationReviewPanel() {
  const { id } = useDocumentInfo()
  const [review, setReview] = useState<RegistrationReview | null>(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [notes, setNotes] = useState('')
  const [version, setVersion] = useState(0)

  const refresh = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/miljo-registrations/${id}/review`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) {
      setLoadError('Kunne ikke hente registreringen.')
      return
    }
    const data = (await res.json()) as RegistrationReview
    setReview(data)
    setNotes(data.internalNotes)
    setLoadError('')
    setVersion((v) => v + 1)
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!id) return null
  if (loadError) return <div style={box}><p style={danger}>{loadError}</p></div>
  if (!review) return <div style={box}><p style={muted}>Henter …</p></div>

  // A decision reloads the page: the read-only fields below come from the server, and the panel then
  // shows the decision and whether the applicant's e-mail was sent.
  const decide = async (path: string, payload: unknown) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { res, data } = await postJson(`/api/miljo-registrations/${id}/${path}`, payload)
      if (res.ok) {
        window.location.reload()
        return
      }
      setError(String(data.error ?? 'Noe gikk galt.'))
      await refresh()
    } catch {
      setError('Fikk ikke kontakt med serveren. Last siden på nytt for å se om endringen ble lagret.')
    }
    setBusy(false)
  }

  const send = async (path: string, payload: unknown, done: (out: Record<string, unknown>) => string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { res, data } = await postJson(`/api/miljo-registrations/${id}/${path}`, payload)
      if (!res.ok) setError(String(data.error ?? 'Noe gikk galt.'))
      else setNotice(done(data))
      await refresh()
    } catch {
      setError('Fikk ikke kontakt med serveren. Ingenting er bekreftet endret.')
    } finally {
      setBusy(false)
    }
  }

  const order = review.order

  return (
    <div style={box}>
      <p style={heading}>Behandling: {statusLabel(review.status)}</p>

      <dl style={facts}>
        <div><strong>E-post bekreftet:</strong> {review.emailVerifiedAt ? osloDateTime(review.emailVerifiedAt) : 'Ikke bekreftet'}</div>
        <div><strong>E-post på ordren:</strong> {order?.orderEmail || 'Ukjent'}{order?.buyerName ? ` (${order.buyerName})` : ''}</div>
        <div><strong>Ordrestatus:</strong> {order ? `${order.orderNumber} · ${ORDER_STATUS[order.status] ?? order.status}` : 'Fant ikke ordren'}</div>
        <div>
          <strong>Varsel til ordre-e-post:</strong>{' '}
          {review.loginEmailSameAsOrder ? 'Ikke nødvendig (samme adresse som innlogging)' : review.orderNoticeSentAt ? `Sendt ${osloDateTime(review.orderNoticeSentAt)}` : 'Ikke sendt'}
        </div>
        <div>
          <strong>Enhetsregisteret:</strong>{' '}
          <a href={review.brregUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>Slå opp organisasjonen</a>
        </div>
      </dl>

      {review.warnings.map((w) => <p key={w} style={warn}>{w}</p>)}
      {error && <p style={danger} role="alert">{error}</p>}
      {notice && <p style={{ margin: '0.6rem 0 0', fontWeight: 600 }} role="status">{notice}</p>}

      {review.canDecide && !review.ownApplication && (
        <>
          <hr style={rule} />
          <p style={{ margin: 0 }}>
            Ordre, e-postbekreftelse og treff i Enhetsregisteret beviser ikke at søkeren kan representere organisasjonen. Bekreft tilknytningen gjennom en uavhengig kanal, for eksempel bedriftens offentlige telefonnummer, før du godkjenner.
          </p>

          <label htmlFor="miljo-method" style={label}>Hvordan ble tilknytningen bekreftet?</label>
          <select id="miljo-method" value={method} onChange={(e) => setMethod(e.target.value)} style={input}>
            <option value="">Velg …</option>
            {VERIFICATION_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <label htmlFor="miljo-note" style={label}>Notat om bekreftelsen{method === 'other' ? '' : ' (valgfritt)'}</label>
          <textarea id="miljo-note" value={note} maxLength={DECISION_NOTE_MAX} rows={2} onChange={(e) => setNote(e.target.value)} style={input} />

          <div style={row}>
            <Button buttonStyle="primary" size="small" disabled={busy || !method} onClick={() => decide('approve', { verificationMethod: method, note })}>
              Godkjenn og aktiver
            </Button>
            <Button buttonStyle="secondary" size="small" disabled={busy} onClick={() => setRejecting((v) => !v)}>
              Avvis …
            </Button>
          </div>

          {rejecting && (
            <>
              <label htmlFor="miljo-reason" style={label}>Intern begrunnelse (sendes ikke til søkeren)</label>
              <textarea id="miljo-reason" value={reason} maxLength={DECISION_NOTE_MAX} rows={2} onChange={(e) => setReason(e.target.value)} style={input} />
              <div style={row}>
                <Button buttonStyle="error" size="small" disabled={busy || !reason.trim()} onClick={() => decide('reject', { reason })}>
                  Avvis registreringen
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {review.decidedAt && (
        <>
          <hr style={rule} />
          <p style={{ margin: 0 }}>
            <strong>{review.status === 'rejected' ? 'Avvist' : 'Godkjent'}</strong> {osloDateTime(review.decidedAt)} av {review.decidedByLabel}
            {review.verificationMethod ? ` · ${methodLabel(review.verificationMethod)}` : ''}
          </p>
          {review.decisionNote && <p style={{ margin: '0.3rem 0 0' }}>«{review.decisionNote}»</p>}
          {review.decisionEmailSentAt ? <p style={muted}>Svar til søker sendt {osloDateTime(review.decisionEmailSentAt)}.</p> : <p style={warn}>E-posten til søkeren kunne ikke sendes. Gi beskjed på annen måte.</p>}
        </>
      )}
      {review.legacyActivation && <p style={muted}>Aktivert automatisk ved e-postbekreftelse, før godkjenning ble innført.</p>}

      <hr style={rule} />
      <label htmlFor="miljo-notes" style={{ ...label, marginTop: 0 }}>Internt notat (vises aldri for søkeren)</label>
      <textarea id="miljo-notes" value={notes} maxLength={INTERNAL_NOTES_MAX} rows={3} onChange={(e) => setNotes(e.target.value)} style={input} />
      <div style={row}>
        <Button buttonStyle="secondary" size="small" disabled={busy || notes.trim() === review.internalNotes} onClick={() => send('notes', { notes }, () => 'Notatet er lagret.')}>
          Lagre notat
        </Button>
      </div>

      <hr style={rule} />
      <AuditHistory collection="miljo-registration-audit" field="registration" id={id} version={version} options={REGISTRATION_AUDIT_ACTION_OPTIONS} />
    </div>
  )
}
