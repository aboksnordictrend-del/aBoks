'use client'

import { useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'

/**
 * «Last inn standard spørreskjema» at the top of the Spørreskjema tab. A new project already starts
 * with the default questions, so the button only acts on a saved project: it replaces the questions,
 * introduction and closing message with a fresh copy of the template (server-side, through the
 * normal update rules) and reloads the page. Submitted evaluations keep their own snapshot.
 */
export default function LoadDefaultQuestionnaireButton() {
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const box: React.CSSProperties = {
    marginBottom: '1.5rem',
    padding: '0.9rem 1rem',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: '6px',
    background: 'var(--theme-elevation-50)',
    fontSize: '0.85rem',
  }

  if (!id) {
    return (
      <div style={box}>
        Nye prosjekter starter med en kopi av standard spørreskjema. Tilpass spørsmålene under, og lagre.
      </div>
    )
  }

  const load = async () => {
    const ok = window.confirm(
      'Erstatte alle spørsmål, introduksjonen og avslutningsmeldingen med standard spørreskjema?\n\nUlagrede endringer går tapt. Evalueringer som allerede er sendt inn påvirkes ikke.',
    )
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/pilot-projects/${id}/load-default-questionnaire`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error || 'Kunne ikke laste inn standard spørreskjema.')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste inn standard spørreskjema.')
      setBusy(false)
    }
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ flex: '1 1 260px' }}>
          Spørsmålene tilhører bare dette prosjektet. Vil du starte på nytt fra malen?
        </span>
        <Button buttonStyle="secondary" size="small" disabled={busy} onClick={load}>
          {busy ? 'Laster inn …' : 'Last inn standard spørreskjema'}
        </Button>
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--theme-error-500)', margin: '0.5rem 0 0' }}>
          {error}
        </p>
      )}
    </div>
  )
}
