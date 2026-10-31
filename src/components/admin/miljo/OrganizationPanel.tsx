'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import { encodeQr, qrSvg, qrSvgPath } from '@/lib/qr/qrcode'
import { downloadQrPng } from '@/lib/qr/png'
import { buildMiljoPrintHtml, miljoPath, miljoPublicUrl, type MiljoPrintLayout } from '@/lib/miljo/qrPrint'
import { PIN_POLICY } from '@/lib/miljo/constants'
import { box, danger, heading, linkStyle, muted, postJson, rule, warn } from './adminUi'

const QUIET_ZONE = 4

type Status = {
  hasPin: boolean
  pinSetAt: string | null
  pinLockedUntil: string | null
  pinRevealable: boolean
  pinRevealConfigured: boolean
  registrations: number
  deliveries: number
  pendingReview: number
}

const time = (iso: string) =>
  new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

/**
 * Sidebar panel on an organisation: public link + QR (preview, PNG, A4 poster, sticker sheet),
 * delivery PIN (generate / set / remove / unlock), record counts with shortcuts, and — tucked
 * away — the exceptional code rotation. Always reflects the SAVED document.
 *
 * The QR code is generated in the browser by @/lib/qr/qrcode; nothing is sent to any service. A
 * PIN is held in component state only while it is on screen («Skjul» clears it); «Vis PIN» fetches
 * it on demand from the admin-only reveal endpoint, which decrypts the server-side copy.
 */
export default function OrganizationPanel() {
  const { id, savedDocumentData } = useDocumentInfo()
  const code = typeof savedDocumentData?.publicCode === 'string' ? savedDocumentData.publicCode : ''
  const name = (savedDocumentData?.name as string | undefined) ?? ''
  const active = savedDocumentData?.status === 'active'

  const [status, setStatus] = useState<Status | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [shownPin, setShownPin] = useState('')
  const [pinSource, setPinSource] = useState<'new' | 'revealed'>('new')
  const [pinCopied, setPinCopied] = useState(false)
  const [customPin, setCustomPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rotate, setRotate] = useState({ confirmCode: '', reason: '' })

  const url = code ? miljoPublicUrl(code) : ''
  const qr = useMemo(() => (url ? encodeQr(url, 'Q') : null), [url])

  const refresh = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/environmental-organizations/${id}/miljo-status`, { credentials: 'include', cache: 'no-store' })
    if (res.ok) setStatus((await res.json()) as Status)
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!id || !code || !qr) {
    return (
      <div style={box}>
        <p style={heading}>QR-kode og PIN</p>
        <p style={{ margin: 0 }}>Lagre organisasjonen for å få QR-kode og PIN.</p>
      </div>
    )
  }

  const run = async (path: string, body: unknown, ok: (data: Record<string, unknown>) => void) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { res, data } = await postJson(`/api/environmental-organizations/${id}/${path}`, body)
      if (!res.ok) setError(String(data.error ?? 'Noe gikk galt.'))
      else ok(data)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const generatePin = () => {
    if (status?.hasPin && !window.confirm('Lage ny PIN? Den gamle PIN-koden slutter å virke med en gang.')) return
    void run('pin', { mode: 'generate' }, (d) => {
      setPinSource('new')
      setShownPin(String(d.pin ?? ''))
    })
  }
  const savePin = () => {
    if (status?.hasPin && !window.confirm('Erstatte PIN-koden? Den gamle slutter å virke med en gang.')) return
    void run('pin', { mode: 'set', pin: customPin }, () => {
      setCustomPin('')
      setNotice('PIN-koden er lagret.')
    })
  }
  const removePin = () => {
    if (!window.confirm('Fjerne PIN-koden? Da kan ingen registrere leveranser før en ny PIN er satt.')) return
    void run('pin', { mode: 'clear' }, () => {
      hidePin()
      setNotice('PIN-koden er fjernet.')
    })
  }
  const unlock = () => void run('pin-unlock', {}, () => setNotice('Sperren er opphevet.'))
  const revealPin = () =>
    void run('pin-reveal', {}, (d) => {
      setPinSource('revealed')
      setPinCopied(false)
      setShownPin(String(d.pin ?? ''))
    })
  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(shownPin)
      setPinCopied(true)
      setTimeout(() => setPinCopied(false), 2000)
    } catch {
      setError('Kunne ikke kopiere. Marker PIN-koden og kopier den manuelt.')
    }
  }
  const hidePin = () => {
    setShownPin('')
    setPinCopied(false)
  }
  const rotateCode = () => {
    if (!window.confirm('Bytte QR-kode? ALLE utskrevne QR-koder for denne organisasjonen slutter å virke og må erstattes.')) return
    void run('rotate-code', rotate, () => {
      window.location.reload()
    })
  }

  const openPrint = (layout: MiljoPrintLayout) => {
    const html = buildMiljoPrintHtml({ organizationName: name || code, url, svg: qrSvg(qr, QUIET_ZONE), layout })
    const win = window.open('', '_blank')
    if (!win) return window.alert('Nettleseren blokkerte utskriftsvinduet. Tillat popup-vinduer for admin og prøv igjen.')
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const dim = qr.size + QUIET_ZONE * 2

  return (
    <div style={box}>
      <p style={heading}>QR-kode</p>
      <div style={{ background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-150)', borderRadius: 4, padding: '0.35rem 0.5rem', wordBreak: 'break-all' }}>
        <a href={miljoPath(code)} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {url}
        </a>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <Button
          buttonStyle="secondary"
          size="small"
          margin={false}
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => undefined)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? 'Kopiert!' : 'Kopier lenke'}
        </Button>
      </div>
      {!active && <p style={warn}>Organisasjonen er inaktiv. QR-siden viser «Registreringen er ikke aktiv».</p>}

      <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: 4, marginTop: '0.8rem', maxWidth: 200 }}>
        <svg viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label={`QR-kode til ${url}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
          <rect width={dim} height={dim} fill="#ffffff" />
          <path d={qrSvgPath(qr, QUIET_ZONE)} fill="#000000" />
        </svg>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={() => downloadQrPng(qr, `qr-miljo-${code}.png`)}>
          Last ned PNG
        </Button>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={() => openPrint('poster')}>
          Skriv ut A4
        </Button>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={() => openPrint('stickers')}>
          Skriv ut klistremerker
        </Button>
      </div>
      <p style={muted}>Én kode for alle organisasjonens aBoks XL. Klistremerkearket har seks koder.</p>

      <hr style={rule} />
      <p style={heading}>PIN for leveranser</p>
      {status ? (
        <>
          <p style={{ margin: 0 }}>
            {status.hasPin ? `PIN er satt${status.pinSetAt ? ` (${time(status.pinSetAt)})` : ''}.` : 'Ingen PIN — leveranser kan ikke registreres.'}
          </p>
          {status.pinLockedUntil && (
            <p style={warn}>
              Sperret etter for mange feil forsøk til {time(status.pinLockedUntil)}.{' '}
              <button type="button" onClick={unlock} disabled={busy} style={{ ...linkStyle, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                Opphev sperren
              </button>
            </p>
          )}
        </>
      ) : (
        <p style={muted}>Henter …</p>
      )}
      {status?.hasPin && !status.pinRevealable && !shownPin && (
        <p style={warn}>
          {status.pinRevealConfigured
            ? 'PIN kan ikke vises — opprett ny PIN.'
            : 'PIN kan ikke vises — krypteringsnøkkelen er ikke satt opp på serveren.'}
        </p>
      )}
      {shownPin && (
        <div style={{ marginTop: '0.6rem', padding: '0.7rem', borderRadius: 6, background: 'var(--theme-success-100)', border: '1px solid var(--theme-success-500)' }} role="status">
          <p style={{ margin: 0, fontSize: '0.8rem' }}>{pinSource === 'new' ? 'Ny PIN:' : 'Gjeldende PIN:'}</p>
          <p style={{ margin: '0.2rem 0', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.2em', fontFamily: 'monospace' }}>{shownPin}</p>
          <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem' }}>Gi den til den ansvarlige på en trygg måte. Skjul den når du er ferdig.</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button buttonStyle="secondary" size="small" margin={false} onClick={() => void copyPin()}>
              {pinCopied ? 'Kopiert!' : 'Kopier PIN'}
            </Button>
            <Button buttonStyle="secondary" size="small" margin={false} onClick={hidePin}>
              Skjul PIN
            </Button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={generatePin} disabled={busy}>
          {status?.hasPin ? 'Lag ny PIN' : 'Lag PIN'}
        </Button>
        {status?.hasPin && status.pinRevealable && !shownPin && (
          <Button buttonStyle="secondary" size="small" margin={false} onClick={revealPin} disabled={busy}>
            Vis PIN
          </Button>
        )}
        {status?.hasPin && (
          <Button buttonStyle="secondary" size="small" margin={false} onClick={removePin} disabled={busy}>
            Fjern PIN
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center' }}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          placeholder={`Egen PIN (${PIN_POLICY.minLength}–${PIN_POLICY.maxLength} sifre)`}
          value={customPin}
          onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, ''))}
          aria-label="Egen PIN-kode"
          style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.5rem', border: '1px solid var(--theme-elevation-200)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'var(--theme-text)' }}
        />
        <Button buttonStyle="secondary" size="small" margin={false} onClick={savePin} disabled={busy || customPin.length < PIN_POLICY.minLength}>
          Lagre
        </Button>
      </div>
      <p style={muted}>PIN-koden må oppgis hver gang en leveranse registreres. Etter {PIN_POLICY.maxAttempts} feil forsøk sperres registreringen i 15 minutter.</p>

      {notice && <p style={{ ...muted, color: 'var(--theme-success-600)' }}>{notice}</p>}
      {error && <p style={danger}>{error}</p>}

      <hr style={rule} />
      <p style={heading}>Statistikk og historikk</p>
      {status && (
        <p style={{ margin: '0 0 0.3rem' }}>
          {status.registrations} registreringer · {status.deliveries} leveranser
          {status.pendingReview > 0 && <span style={{ color: 'var(--theme-warning-600)' }}> · {status.pendingReview} til gjennomgang</span>}
        </p>
      )}
      <p style={{ margin: 0, lineHeight: 1.8 }}>
        <a href={`/admin/miljoregistrering?organization=${id}`} style={linkStyle}>
          Miljøregistrering-oversikt
        </a>
        <br />
        <a href={`/admin/collections/battery-registrations?where[organization][equals]=${id}`} style={linkStyle}>
          Registreringer
        </a>
        {' · '}
        <a href={`/admin/collections/battery-deliveries?where[organization][equals]=${id}`} style={linkStyle}>
          Leveranser
        </a>
      </p>

      <hr style={rule} />
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Bytt QR-kode (bare ved misbruk)</summary>
        <p style={warn}>
          Alle utskrevne QR-koder for denne organisasjonen slutter å virke. Bruk bare hvis koden er misbrukt, for eksempel delt
          offentlig. Statistikk og historikk beholdes.
        </p>
        <input
          type="text"
          placeholder="Skriv inn nåværende kode"
          value={rotate.confirmCode}
          onChange={(e) => setRotate({ ...rotate, confirmCode: e.target.value.trim() })}
          aria-label="Nåværende kode"
          style={{ width: '100%', marginTop: '0.4rem', padding: '0.4rem 0.5rem', border: '1px solid var(--theme-elevation-200)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'var(--theme-text)' }}
        />
        <textarea
          placeholder="Begrunnelse"
          value={rotate.reason}
          onChange={(e) => setRotate({ ...rotate, reason: e.target.value })}
          aria-label="Begrunnelse for nytt QR-kode"
          rows={2}
          style={{ width: '100%', marginTop: '0.4rem', padding: '0.4rem 0.5rem', border: '1px solid var(--theme-elevation-200)', borderRadius: 4, background: 'var(--theme-input-bg)', color: 'var(--theme-text)' }}
        />
        <div style={{ marginTop: '0.4rem' }}>
          <Button buttonStyle="error" size="small" margin={false} onClick={rotateCode} disabled={busy || rotate.confirmCode !== code || rotate.reason.trim().length < 3}>
            Bytt QR-kode
          </Button>
        </div>
      </details>
    </div>
  )
}
