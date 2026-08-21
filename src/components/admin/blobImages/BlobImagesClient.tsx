'use client'

import { useCallback, useState } from 'react'
import {
  BLOB_IMAGES_FOLDERS,
  BLOB_IMAGES_REVALIDATE_API,
  BLOB_IMAGES_REVALIDATE_SECONDS,
} from '@/lib/blobImagesCache'

// The one button behind /admin/blob-bilder. It POSTs to the admin-only revalidation endpoint
// and reports what happened; the endpoint is the real security boundary, not this component.

type Phase = 'idle' | 'working' | 'done' | 'error'

const HOURS = Math.round(BLOB_IMAGES_REVALIDATE_SECONDS / 3600)

/** Norwegian time-of-day for the confirmation line. */
function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function BlobImagesClient() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setPhase('working')
    setMessage('')
    try {
      const res = await fetch(BLOB_IMAGES_REVALIDATE_API, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        revalidatedAt?: string
      }
      if (!res.ok || body.ok !== true) {
        setPhase('error')
        setMessage(body.error ?? `Kunne ikke oppdatere bildelistene (${res.status}).`)
        return
      }
      const at = body.revalidatedAt ? clock(body.revalidatedAt) : ''
      setPhase('done')
      setMessage(
        at
          ? `Bildelistene ble oppdatert kl. ${at}. Last siden på nettbutikken på nytt for å se endringen.`
          : 'Bildelistene ble oppdatert. Last siden på nettbutikken på nytt for å se endringen.',
      )
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Nettverksfeil.')
    }
  }, [])

  return (
    <div>
      <h1>Blob-bildelister</h1>
      <p>
        Nettbutikken leser bildemappene i Vercel Blob én gang i døgnet ({HOURS} timer). Har du
        nettopp lagt til, byttet eller slettet en fil i en av mappene under, trykk her for å hente
        listene på nytt med én gang.
      </p>
      <ul>
        {BLOB_IMAGES_FOLDERS.map((folder) => (
          <li key={folder}>
            <code>{folder}</code>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn--style-primary"
        onClick={refresh}
        disabled={phase === 'working'}
      >
        {phase === 'working' ? 'Oppdaterer …' : 'Oppdater bildelister'}
      </button>
      {message ? (
        <p role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
