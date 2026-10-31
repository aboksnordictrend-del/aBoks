// Shared inline styles and fetch helper for the Miljøregistrering admin panels. Payload theme
// variables only, so the panels follow the admin's light/dark theme like the pilot panel does.

import type { CSSProperties } from 'react'

export const box: CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1rem',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '6px',
  background: 'var(--theme-elevation-50)',
  fontSize: '0.85rem',
}
export const heading: CSSProperties = { margin: '0 0 0.6rem', fontSize: '0.95rem', fontWeight: 700 }
export const muted: CSSProperties = { color: 'var(--theme-elevation-500)', margin: '0.4rem 0 0' }
export const warn: CSSProperties = { color: 'var(--theme-warning-600)', margin: '0.4rem 0 0' }
export const danger: CSSProperties = { color: 'var(--theme-error-500)', margin: '0.4rem 0 0', fontWeight: 600 }
export const linkStyle: CSSProperties = { color: 'inherit', textDecoration: 'underline' }
export const rule: CSSProperties = { border: 0, borderTop: '1px solid var(--theme-elevation-150)', margin: '0.9rem 0' }
export const input: CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.5rem',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
  fontSize: '0.85rem',
}

export async function postJson(url: string, body: unknown): Promise<{ res: Response; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = { error: `Uventet svar (${res.status}).` }
  }
  return { res, data }
}

export const osloDateTime = (iso: string | null | undefined): string =>
  iso ? new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : ''
