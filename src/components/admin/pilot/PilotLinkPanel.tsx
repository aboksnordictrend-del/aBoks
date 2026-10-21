'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { encodeQr, qrSvg, qrSvgPath, type QrCode } from '@/lib/qr/qrcode'
import { buildQrPrintHtml, type QrPrintLayout } from '@/lib/pilot/qrPrint'
import { pilotPath, pilotPublicUrl } from '@/lib/pilot/urls'
import { PILOT_STATUS_OPTIONS } from '@/lib/pilot/constants'

const QUIET_ZONE = 4
const PNG_SIZE = 1200

/** Renders the QR code onto a canvas (white background, black modules) and downloads it as PNG. */
function downloadPng(qr: QrCode, filename: string) {
  const modules = qr.size + QUIET_ZONE * 2
  const scale = Math.max(1, Math.floor(PNG_SIZE / modules))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = modules * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y]![x]) ctx.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale)
    }
  }
  canvas.toBlob((blob) => {
    if (!blob) return
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }, 'image/png')
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers / contexts without the async clipboard API.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

/**
 * Sidebar panel on a pilot project: public URL, copy action, QR preview, PNG download, printable
 * sheets, preview and shortcuts to the evaluations and the analytics. Always reflects the SAVED
 * slug — what is actually live — and says so when the form holds an unsaved change.
 *
 * The QR code is generated in the browser by @/lib/qr/qrcode; nothing is sent to any service.
 */
export default function PilotLinkPanel() {
  const { id, savedDocumentData } = useDocumentInfo()
  const formSlug = useFormFields(([fields]) => fields?.slug?.value as string | undefined)
  const savedSlug = typeof savedDocumentData?.slug === 'string' ? savedDocumentData.slug : ''
  const savedStatus = savedDocumentData?.status as string | undefined
  const projectName = (savedDocumentData?.name as string | undefined) ?? ''

  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle')
  const [count, setCount] = useState<number | null>(null)

  const url = savedSlug ? pilotPublicUrl(savedSlug) : ''
  const qr = useMemo(() => (url ? encodeQr(url, 'Q') : null), [url])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/pilot-evaluations?where[project][equals]=${id}&limit=1&depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { totalDocs?: number } | null) => {
        if (!cancelled && body && typeof body.totalDocs === 'number') setCount(body.totalDocs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  const wrap: React.CSSProperties = {
    marginBottom: '1.5rem',
    padding: '1rem',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: '6px',
    background: 'var(--theme-elevation-50)',
    fontSize: '0.85rem',
  }
  const heading: React.CSSProperties = { margin: '0 0 0.6rem', fontSize: '0.95rem', fontWeight: 700 }
  const muted: React.CSSProperties = { color: 'var(--theme-elevation-500)', margin: '0.4rem 0 0' }
  const linkStyle: React.CSSProperties = { color: 'inherit', textDecoration: 'underline' }

  if (!id || !savedSlug || !qr) {
    return (
      <div style={wrap}>
        <p style={heading}>Offentlig lenke og QR-kode</p>
        <p style={{ margin: 0 }}>Lagre prosjektet for å få lenke og QR-kode.</p>
      </div>
    )
  }

  const dim = qr.size + QUIET_ZONE * 2
  const statusLabel = PILOT_STATUS_OPTIONS.find((o) => o.value === savedStatus)?.label ?? savedStatus

  const openPrint = (layout: QrPrintLayout) => {
    const html = buildQrPrintHtml({ projectName: projectName || savedSlug, url, svg: qrSvg(qr, QUIET_ZONE), layout })
    const win = window.open('', '_blank')
    if (!win) {
      window.alert('Nettleseren blokkerte utskriftsvinduet. Tillat popup-vinduer for admin og prøv igjen.')
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const onCopy = async () => {
    setCopied((await copyText(url)) ? 'ok' : 'error')
    setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <div style={wrap}>
      <p style={heading}>Offentlig lenke og QR-kode</p>

      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          alignItems: 'center',
          background: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: '4px',
          padding: '0.35rem 0.5rem',
          wordBreak: 'break-all',
        }}
      >
        <a href={pilotPath(savedSlug)} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, flex: 1 }}>
          {url}
        </a>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={onCopy}>
          {copied === 'ok' ? 'Kopiert!' : copied === 'error' ? 'Kunne ikke kopiere' : 'Kopier lenke'}
        </Button>
        <Button
          buttonStyle="secondary"
          size="small"
          margin={false}
          url={`${pilotPath(savedSlug)}?forhandsvisning=1`}
          newTab
          el="anchor"
        >
          Forhåndsvis
        </Button>
      </div>

      {formSlug !== undefined && formSlug !== '' && formSlug !== savedSlug && (
        <p style={{ ...muted, color: 'var(--theme-warning-500)' }}>
          URL-slug er endret, men ikke lagret. Lenken og QR-koden oppdateres når du lagrer. Den gamle adressen
          videresendes til den nye.
        </p>
      )}
      {savedStatus !== 'active' && (
        <p style={{ ...muted, color: 'var(--theme-warning-500)' }}>
          Status er «{statusLabel}». Skjemaet tar bare imot svar når status er «Aktiv».
        </p>
      )}

      <div
        style={{
          background: '#ffffff',
          padding: '0.5rem',
          borderRadius: '4px',
          marginTop: '0.9rem',
          maxWidth: '220px',
        }}
      >
        <svg
          viewBox={`0 0 ${dim} ${dim}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`QR-kode til ${url}`}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        >
          <rect width={dim} height={dim} fill="#ffffff" />
          <path d={qrSvgPath(qr, QUIET_ZONE)} fill="#000000" />
        </svg>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={() => downloadPng(qr, `qr-pilot-${savedSlug}.png`)}>
          Last ned PNG
        </Button>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={() => openPrint('single')}>
          Skriv ut
        </Button>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={() => openPrint('labels')}>
          Skriv ut etiketter
        </Button>
      </div>
      <p style={muted}>
        QR-koden peker på den offentlige adressen og lages lokalt i nettleseren. «Skriv ut etiketter» gir et A4-ark
        med 12 små koder til å feste på produktene.
      </p>

      <hr style={{ border: 0, borderTop: '1px solid var(--theme-elevation-150)', margin: '0.9rem 0' }} />
      <p style={{ margin: 0 }}>
        <a href={`/admin/collections/pilot-evaluations?where[project][equals]=${id}`} style={linkStyle}>
          Se evalueringer{count != null ? ` (${count})` : ''}
        </a>
        {' · '}
        <a href={`/admin/pilotanalyse?project=${id}`} style={linkStyle}>
          Pilotanalyse
        </a>
      </p>
    </div>
  )
}
