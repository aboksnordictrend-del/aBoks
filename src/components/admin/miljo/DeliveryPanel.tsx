'use client'

import { useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import { DOCUMENTATION_OPTIONS } from '@/lib/miljo/constants'
import AuditHistory from './AuditHistory'
import { box, danger, heading, input, muted, postJson, rule, warn } from './adminUi'

/**
 * Sidebar panel on a delivery: correct date, quantity, unit, operator, reference and
 * documentation status; invalidate or restore. Every change needs a reason and is written with an
 * audit row in one transaction (POST /api/battery-deliveries/:id/…). The values the responsible
 * person submitted stay in «Opprinnelig registrert». The unit is corrected, never converted.
 */
export default function DeliveryPanel() {
  const { id, savedDocumentData: d } = useDocumentInfo()
  const hasDocument = d?.document != null && d?.document !== ''
  const [values, setValues] = useState({
    deliveryDate: String(d?.deliveryDate ?? ''),
    quantity: d?.quantity != null ? String(d.quantity).replace('.', ',') : '',
    unit: String(d?.unit ?? 'kg'),
    operator: String(d?.operator ?? ''),
    reference: String(d?.reference ?? ''),
    documentationStatus: String(d?.documentationStatus ?? 'reported'),
  })
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  if (!id) return null
  const invalidated = d?.status === 'invalidated'
  const reasonOk = reason.trim().length >= 3
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues({ ...values, [k]: e.target.value })

  const act = async (action: 'correct' | 'invalidate' | 'restore', confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    const { res, data } = await postJson(`/api/battery-deliveries/${id}/${action}`, action === 'correct' ? { ...values, reason } : { reason })
    setBusy(false)
    if (!res.ok) return setError(String(data.error ?? 'Noe gikk galt.'))
    setVersion((v) => v + 1)
    window.location.reload()
  }

  const field = (label: string, el: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: '0.4rem' }}>
      <span>{label}</span>
      {el}
    </label>
  )

  return (
    <div style={box}>
      <p style={heading}>Korriger levering</p>
      {invalidated && <p style={{ ...warn, marginTop: 0 }}>Ugyldiggjort — telles ikke i statistikken.</p>}
      {!invalidated && (
        <>
          {field('Dato for levering', <input type="date" value={values.deliveryDate} onChange={set('deliveryDate')} style={input} />)}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.4rem' }}>
            {field('Levert mengde', <input inputMode="decimal" value={values.quantity} onChange={set('quantity')} style={input} />)}
            {field(
              'Enhet',
              <select value={values.unit} onChange={set('unit')} style={input}>
                <option value="kg">kg</option>
                <option value="stk">stk.</option>
              </select>,
            )}
          </div>
          {field('Mottak / avfallsselskap', <input value={values.operator} onChange={set('operator')} style={input} />)}
          {field('Kvittering / referanse', <input value={values.reference} onChange={set('reference')} style={input} />)}
          {field(
            'Dokumentasjon',
            <select value={values.documentationStatus} onChange={set('documentationStatus')} style={input}>
              {DOCUMENTATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={o.value === 'documented' && !hasDocument}>
                  {o.label}
                </option>
              ))}
            </select>,
          )}
          <p style={muted}>«Dokumentert med kvittering» krever et vedlegg på leveransen. Uten vedlegg er den «Oppgitt av ansvarlig».</p>
        </>
      )}
      {field('Begrunnelse (påkrevd)', <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} style={input} />)}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        {!invalidated && (
          <Button buttonStyle="primary" size="small" margin={false} disabled={busy || !reasonOk} onClick={() => void act('correct')}>
            Lagre korrigering
          </Button>
        )}
        {!invalidated && (
          <Button
            buttonStyle="secondary"
            size="small"
            margin={false}
            disabled={busy || !reasonOk}
            onClick={() => void act('invalidate', 'Ugyldiggjøre leveransen? Den tas ut av statistikk og rapporter, men beholdes i historikken.')}
          >
            Ugyldiggjør
          </Button>
        )}
        {invalidated && (
          <Button buttonStyle="secondary" size="small" margin={false} disabled={busy || !reasonOk} onClick={() => void act('restore')}>
            Gjenopprett
          </Button>
        )}
      </div>
      {error && <p style={danger}>{error}</p>}

      <hr style={rule} />
      <AuditHistory collection="battery-delivery-audit" field="delivery" id={id} version={version} />
    </div>
  )
}
