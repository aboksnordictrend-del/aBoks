'use client'

import { useEffect, useState } from 'react'
import { AUDIT_ACTION_OPTIONS } from '@/lib/miljo/constants'
import { heading, muted, osloDateTime } from './adminUi'

type Row = { id: number; action: string; reason?: string | null; performedByLabel?: string | null; performedAt: string; before?: unknown; after?: unknown }

const label = (a: string) => AUDIT_ACTION_OPTIONS.find((o) => o.value === a)?.label ?? a

/** Read-only change history of one registration or delivery (newest first). */
export default function AuditHistory({ collection, field, id, version }: { collection: string; field: string; id: string | number; version: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/${collection}?where[${field}][equals]=${id}&sort=-performedAt&limit=100&depth=0`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { docs?: Row[] } | null) => {
        if (!cancelled) setRows(body?.docs ?? [])
      })
      .catch(() => !cancelled && setRows([]))
    return () => {
      cancelled = true
    }
  }, [collection, field, id, version])

  return (
    <div>
      <p style={heading}>Endringslogg</p>
      {rows === null && <p style={muted}>Henter …</p>}
      {rows?.length === 0 && <p style={muted}>Ingen endringer.</p>}
      {rows && rows.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{label(r.action)}</strong> · {osloDateTime(r.performedAt)}
              <br />
              <span style={{ color: 'var(--theme-elevation-600)' }}>{r.performedByLabel}</span>
              {r.reason && (
                <>
                  <br />«{r.reason}»
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
