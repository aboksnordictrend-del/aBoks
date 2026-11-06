'use client'

import { useEffect, useState } from 'react'
import { box, linkStyle } from './adminUi'

const QUEUE_URL = '/admin/collections/miljo-registrations?where[status][equals]=awaiting_approval'

/** Above the «Selvregistreringer» list: how many applications wait, and a link to exactly those. */
export default function RegistrationQueue() {
  const [waiting, setWaiting] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/miljo-registrations?where[status][equals]=awaiting_approval&limit=0&depth=0', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { totalDocs?: number } | null) => {
        if (!cancelled) setWaiting(body?.totalDocs ?? 0)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (waiting === null) return null
  return (
    <div style={box}>
      {waiting === 0 ? (
        'Ingen søknader venter på godkjenning.'
      ) : (
        <a href={QUEUE_URL} style={{ ...linkStyle, fontWeight: 600 }}>
          {waiting === 1 ? '1 søknad venter på godkjenning' : `${waiting} søknader venter på godkjenning`}
        </a>
      )}
    </div>
  )
}
