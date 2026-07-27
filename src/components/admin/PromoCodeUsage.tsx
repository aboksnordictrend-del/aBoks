'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

type Stats = { count: number; lastUsedAt: string | null }

/**
 * Sidebar panel on a promo code: how many times it has actually been used, how many uses
 * remain, and when it was last used.
 *
 * Counted live from `promo-code-usages` rather than read off a stored counter — a counter
 * can drift, and this number is what an admin uses to decide whether a one-time code is
 * still available. One indexed query; `limit=1` because only `totalDocs` and the newest row
 * are needed. The endpoint is the ordinary REST list route, so the admin's own session
 * cookie carries the (admin-only) read access.
 */
export default function PromoCodeUsage() {
  const { id } = useDocumentInfo()
  const usageMode = useFormFields(([fields]) => fields?.usageMode?.value as string | undefined)
  const maxUses = useFormFields(([fields]) => fields?.maxUses?.value as number | undefined)

  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(
        `/api/promo-code-usages?where[promoCode][equals]=${id}&sort=-usedAt&limit=1&depth=0`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(String(res.status))
      const body = await res.json()
      setStats({
        count: typeof body?.totalDocs === 'number' ? body.totalDocs : 0,
        lastUsedAt: body?.docs?.[0]?.usedAt ?? null,
      })
    } catch {
      setFailed(true)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Nothing to count before the code exists.
  if (!id) return null

  const allowance =
    usageMode === 'single_use_global'
      ? 1
      : usageMode === 'limited' && typeof maxUses === 'number' && maxUses > 0
        ? maxUses
        : null

  const remaining =
    allowance != null && stats ? Math.max(0, allowance - stats.count) : null

  return (
    <div className="field-type" style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.7 }}>Bruk</div>

      {failed ? (
        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Kunne ikke hente bruksdata.</div>
      ) : (
        <div style={{ fontSize: '0.75rem', lineHeight: 1.7 }}>
          <div>
            Antall bruk: <strong>{stats ? stats.count : '…'}</strong>
          </div>
          {remaining != null && (
            <div>
              Gjenstående: <strong>{remaining}</strong>
            </div>
          )}
          {usageMode === 'once_per_customer' && (
            <div style={{ opacity: 0.7 }}>Én gang per e-postadresse.</div>
          )}
          <div style={{ opacity: 0.7 }}>
            Sist brukt:{' '}
            {stats?.lastUsedAt ? new Date(stats.lastUsedAt).toLocaleString('nb-NO') : 'aldri'}
          </div>
        </div>
      )}
    </div>
  )
}
