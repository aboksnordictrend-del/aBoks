'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatNOK } from '@/lib/analytics/money'
import { MARKETING_API, MARKETING_ROUTES } from '@/lib/marketing/channels'
import type { MetaExpenseRow, MetaExpensesSummary } from '@/lib/marketing/metaExpenses'
import MetaSyncButton, { type MetaSyncOutcome } from '../MetaSyncButton'
import styles from '../marketing.module.css'

type Phase = 'loading' | 'ready' | 'error'

interface ExpensesResponse {
  period: { since: string | null; until: string | null }
  rows: MetaExpenseRow[]
  summary: MetaExpensesSummary
  /** True when any imported record exists at all (independent of the display filter). */
  hasData: boolean
  error?: string
}

const EMPTY_SUMMARY: MetaExpensesSummary = {
  totalInclVat: 0,
  totalExVat: 0,
  days: 0,
  lastSyncedAt: null,
  firstDay: null,
  lastDay: null,
}

function formatDay(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('nb-NO')
}

/**
 * Meta Ads detail view. Shows only imported (source = 'meta-api') day records for the
 * selected period, a computed summary, and the sync action. The "Totalt" under the table is
 * a computed sum of the displayed rows — never a stored record.
 */
export default function MetaMarketingClient() {
  const [sinceInput, setSinceInput] = useState('')
  const [untilInput, setUntilInput] = useState('')
  const [applied, setApplied] = useState<{ since: string; until: string }>({ since: '', until: '' })

  const [phase, setPhase] = useState<Phase>('loading')
  const [rows, setRows] = useState<MetaExpenseRow[]>([])
  const [summary, setSummary] = useState<MetaExpensesSummary>(EMPTY_SUMMARY)
  const [error, setError] = useState('')
  const [hasData, setHasData] = useState(false)
  const [lastSync, setLastSync] = useState<MetaSyncOutcome | null>(null)

  const load = useCallback(async (since: string, until: string) => {
    setPhase('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (since) params.set('since', since)
      if (until) params.set('until', until)
      const qs = params.toString()
      const res = await fetch(`${MARKETING_API.metaExpenses}${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as ExpensesResponse
      if (!res.ok) {
        setError(body.error ?? `Kunne ikke hente Meta-kostnader (${res.status}).`)
        setPhase('error')
        return
      }
      setRows(body.rows ?? [])
      setSummary(body.summary ?? EMPTY_SUMMARY)
      setHasData(Boolean(body.hasData))
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil.')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    load(applied.since, applied.until)
  }, [applied, load])

  const applyFilter = () => {
    // Both dates or neither; a single date is a validation error (matches the sync rule).
    if ((sinceInput && !untilInput) || (!sinceInput && untilInput)) {
      setError('Fyll inn begge datoene, eller la begge stå tomme.')
      setPhase('error')
      return
    }
    if (sinceInput && untilInput && sinceInput > untilInput) {
      setError('«Periode fra» kan ikke være etter «Periode til».')
      setPhase('error')
      return
    }
    setApplied({ since: sinceInput, until: untilInput })
  }

  const clearFilter = () => {
    setSinceInput('')
    setUntilInput('')
    setApplied({ since: '', until: '' })
  }

  const onSynced = useCallback(
    (outcome: MetaSyncOutcome) => {
      setLastSync(outcome)
      load(applied.since, applied.until)
    },
    [applied, load],
  )

  return (
    <div>
      <Link className={styles.backLink} href={MARKETING_ROUTES.catalog}>
        <span aria-hidden>←</span> Tilbake til markedsføringskanaler
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Meta Ads</h1>
          <p className={styles.subtitle}>Synkroniser annonseringskostnader fra Meta Ads.</p>
        </div>
        <div className={styles.headerActions}>
          {/* Sync never touches the display filter below — it only refreshes the data. */}
          <MetaSyncButton hasData={hasData} onSynced={onSynced} />
        </div>
      </div>

      <div className={styles.filter}>
        <label className={styles.field}>
          <span>Periode fra</span>
          <input
            type="date"
            className={styles.input}
            value={sinceInput}
            onChange={(e) => setSinceInput(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Periode til</span>
          <input
            type="date"
            className={styles.input}
            value={untilInput}
            onChange={(e) => setUntilInput(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn--style-primary btn--size-small" onClick={applyFilter}>
          Filtrer
        </button>
        <button type="button" className="btn btn--style-secondary btn--size-small" onClick={clearFilter}>
          Nullstill
        </button>
      </div>
      <p className={styles.subtitle}>La begge feltene stå tomme for å vise hele perioden.</p>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Totale kostnader</div>
          <div className={styles.summaryValue}>{formatNOK(summary.totalInclVat, 2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Antall dager</div>
          <div className={styles.summaryValue}>{summary.days}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Siste synkronisering</div>
          <div className={styles.summaryValue}>{formatDateTime(summary.lastSyncedAt)}</div>
        </div>
        {lastSync && (
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Ved siste synk</div>
            <div className={styles.summaryValue}>
              +{lastSync.created} / ↻{lastSync.updated}
            </div>
          </div>
        )}
      </div>

      {phase === 'loading' && <div className={styles.state}>Laster Meta-kostnader …</div>}
      {phase === 'error' && (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          {error || 'Kunne ikke laste Meta-kostnader.'}
        </div>
      )}
      {phase === 'ready' && rows.length === 0 && (
        <div className={styles.state}>
          Ingen importerte Meta-kostnader for perioden. Bruk «{hasData ? 'Oppdater' : 'Synkroniser'}».
        </div>
      )}

      {phase === 'ready' && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dato</th>
                <th className={styles.num}>Betalt beløp inkl. MVA</th>
                <th className={styles.num}>Beløp eks. MVA</th>
                <th>Kilde</th>
                <th>Beskrivelse</th>
                <th>Sist synkronisert</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDay(r.date)}</td>
                  <td className={styles.num}>{formatNOK(r.amount, 2)}</td>
                  <td className={styles.num}>{formatNOK(r.amountExVat, 2)}</td>
                  <td>Meta API</td>
                  <td>{r.description ?? '—'}</td>
                  <td>{formatDateTime(r.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.tableTotal}>
                <td>Totalt</td>
                <td className={styles.num}>{formatNOK(summary.totalInclVat, 2)}</td>
                <td className={styles.num}>{formatNOK(summary.totalExVat, 2)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
