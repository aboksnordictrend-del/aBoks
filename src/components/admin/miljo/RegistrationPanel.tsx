'use client'

import { useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import { BATTERY_CATEGORIES, CATEGORY_LABELS, REGISTRATION_LIMITS, type BatteryCategory } from '@/lib/miljo/constants'
import AuditHistory from './AuditHistory'
import { box, danger, heading, input, muted, postJson, rule, warn } from './adminUi'

type Line = { category?: string; quantity?: number }

/**
 * Sidebar panel on a registration: correct the current quantities, invalidate, restore or mark as
 * reviewed — each with a required reason, each written with an audit row in one transaction by
 * POST /api/battery-registrations/:id/… The original submission is shown above in the form and
 * never changes. Reloads the document after a change so every field shows the stored state.
 */
export default function RegistrationPanel() {
  const { id, savedDocumentData } = useDocumentInfo()
  const lines = ((savedDocumentData?.lines as Line[] | undefined) ?? []).filter((l) => l.category)
  const status = savedDocumentData?.status as string | undefined
  const reviewState = savedDocumentData?.reviewState as string | undefined

  const initial = Object.fromEntries(BATTERY_CATEGORIES.map((c) => [c, String(lines.find((l) => l.category === c)?.quantity ?? 0)])) as Record<BatteryCategory, string>
  const [values, setValues] = useState(initial)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  if (!id) return null

  const act = async (action: 'correct' | 'invalidate' | 'restore' | 'review', confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    const body =
      action === 'correct'
        ? { reason, lines: Object.fromEntries(BATTERY_CATEGORIES.map((c) => [c, Number(values[c] || 0)])) }
        : { reason }
    const { res, data } = await postJson(`/api/battery-registrations/${id}/${action}`, body)
    setBusy(false)
    if (!res.ok) return setError(String(data.error ?? 'Noe gikk galt.'))
    setVersion((v) => v + 1)
    window.location.reload()
  }

  const invalidated = status === 'invalidated'
  const reasonOk = reason.trim().length >= 3

  return (
    <div style={box}>
      <p style={heading}>Korriger registrering</p>
      {invalidated && <p style={{ ...warn, marginTop: 0 }}>Ugyldiggjort — telles ikke i statistikken.</p>}
      {reviewState === 'pending' && <p style={{ ...warn, marginTop: 0 }}>Merket for gjennomgang.</p>}

      {!invalidated && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginTop: '0.4rem' }}>
          {BATTERY_CATEGORIES.map((c) => (
            <label key={c} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{CATEGORY_LABELS[c]}</span>
              <input
                inputMode="numeric"
                value={values[c]}
                onChange={(e) => setValues({ ...values, [c]: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                style={input}
                aria-label={`Antall ${CATEGORY_LABELS[c]}`}
              />
            </label>
          ))}
        </div>
      )}
      <label style={{ display: 'block', marginTop: '0.6rem' }}>
        <span>Begrunnelse (påkrevd)</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} style={{ ...input, marginTop: 2 }} />
      </label>

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
            onClick={() => void act('invalidate', 'Ugyldiggjøre registreringen? Den tas ut av all statistikk, men beholdes i historikken.')}
          >
            Ugyldiggjør
          </Button>
        )}
        {invalidated && (
          <Button buttonStyle="secondary" size="small" margin={false} disabled={busy || !reasonOk} onClick={() => void act('restore')}>
            Gjenopprett
          </Button>
        )}
        {reviewState === 'pending' && (
          <Button buttonStyle="secondary" size="small" margin={false} disabled={busy} onClick={() => void act('review')}>
            Merk som gjennomgått
          </Button>
        )}
      </div>
      <p style={muted}>Maks {REGISTRATION_LIMITS.maxPerCategory} per type. Opprinnelig innsendte verdier endres aldri.</p>
      {error && <p style={danger}>{error}</p>}

      <hr style={rule} />
      <AuditHistory collection="battery-registration-audit" field="registration" id={id} version={version} />
    </div>
  )
}
