'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatNOK } from '@/lib/analytics/money'
import { MARKETING_API, MARKETING_ROUTES, STATUS } from '@/lib/marketing/channels'
import type { ExpenseRow, ExpensesSummary } from '@/lib/marketing/expenseSummary'
import type { SyncStateSnapshot } from '@/lib/marketing/syncState'
import AdsSyncButton, { type AdsSyncOutcome } from '../AdsSyncButton'
import styles from '../marketing.module.css'

// Google Ads detail view. Built on the same template as MetaMarketingClient: display
// filter → summary cards → imported-days table, plus a connection panel (Google Ads needs
// to surface which account/manager/currency the numbers came from). Every value is fetched
// from the admin-only endpoints; no configuration or secret is ever read in the browser.

type Phase = 'loading' | 'ready' | 'error'

interface ExpensesResponse {
  period: { since: string | null; until: string | null }
  rows: ExpenseRow[]
  summary: ExpensesSummary
  /** True when any imported record exists at all (independent of the display filter). */
  hasData: boolean
  error?: string
}

interface StatusResponse {
  configured: boolean
  configError: string | null
  missingEnv: string[]
  /** Masked, e.g. •••-•••-7890. The full id never leaves the server. */
  accountId: string
  managerId: string | null
  apiVersion: string | null
  currency: string | null
  timeZone: string | null
  summary: ExpensesSummary
  hasData: boolean
  sync: SyncStateSnapshot
  error?: string
}

const EMPTY_SUMMARY: ExpensesSummary = {
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

function ConnectionPanel({ status }: { status: StatusResponse | null }) {
  const connected = Boolean(status?.configured)
  const label = connected ? STATUS.connected : STATUS.notConfigured
  const color = connected ? 'var(--theme-success-500)' : 'var(--theme-warning-500)'
  const lastError = status?.sync.lastError ?? null

  return (
    <section className={styles.connection}>
      <div className={styles.connHead}>
        <h2 className={styles.connHeadTitle}>Tilkobling</h2>
        <span className={styles.connBadge} style={{ ['--badge' as string]: color }}>
          <span className={styles.connBadgeDot} aria-hidden="true" />
          {label}
        </span>
        <span className={styles.connLabel} style={{ margin: 0 }}>
          {connected ? 'Synkronisering aktiv' : 'Mangler oppsett'}
        </span>
      </div>

      <div className={styles.connGrid}>
        <div>
          <div className={styles.connLabel}>Annonsekonto</div>
          <div className={styles.connValue}>{status?.accountId ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Administratorkonto (MCC)</div>
          <div className={styles.connValue}>{status?.managerId ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Valuta</div>
          <div className={styles.connValue}>{status?.currency ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Tidssone</div>
          <div className={styles.connValue}>{status?.timeZone ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>API-versjon</div>
          <div className={styles.connValue}>{status?.apiVersion ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Sist synkronisert</div>
          <div className={styles.connValue}>
            {formatDateTime(status?.sync.lastSuccessAt ?? status?.summary.lastSyncedAt)}
          </div>
        </div>
      </div>

      {!connected && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          {status?.configError ?? 'Google Ads-konfigurasjonen mangler eller er ugyldig.'}
          {status && status.missingEnv.length > 0 && (
            <> Mangler: {status.missingEnv.join(', ')}.</>
          )}
        </p>
      )}

      {connected && lastError && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Siste forsøk feilet: {lastError}
        </p>
      )}
    </section>
  )
}

/**
 * Google Ads detail view. Shows only imported (source = 'google-ads') day records for the
 * selected period, a computed summary, and the sync actions. The "Totalt" under the table is
 * a computed sum of the displayed rows — never a stored record.
 */
export default function GoogleMarketingClient() {
  const [sinceInput, setSinceInput] = useState('')
  const [untilInput, setUntilInput] = useState('')
  const [applied, setApplied] = useState<{ since: string; until: string }>({ since: '', until: '' })

  const [phase, setPhase] = useState<Phase>('loading')
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [summary, setSummary] = useState<ExpensesSummary>(EMPTY_SUMMARY)
  const [error, setError] = useState('')
  const [hasData, setHasData] = useState(false)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [lastSync, setLastSync] = useState<AdsSyncOutcome | null>(null)

  /** Connection + stored-history status. Never triggers a Google Ads API call. */
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(MARKETING_API.googleStatus, { credentials: 'include' })
      const body = (await res.json().catch(() => ({}))) as StatusResponse
      if (res.ok) setStatus(body)
    } catch {
      // A failed status read must never blank the expense table below it.
    }
  }, [])

  const load = useCallback(async (since: string, until: string) => {
    setPhase('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (since) params.set('since', since)
      if (until) params.set('until', until)
      const qs = params.toString()
      const res = await fetch(`${MARKETING_API.googleExpenses}${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as ExpensesResponse
      if (!res.ok) {
        setError(body.error ?? `Kunne ikke hente Google Ads-kostnader (${res.status}).`)
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

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

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
    (outcome: AdsSyncOutcome) => {
      setLastSync(outcome)
      // Refresh both panels in place — no manual page reload.
      load(applied.since, applied.until)
      loadStatus()
    },
    [applied, load, loadStatus],
  )

  return (
    <div>
      <Link className={styles.backLink} href={MARKETING_ROUTES.catalog}>
        <span aria-hidden>←</span> Tilbake til markedsføringskanaler
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Google Ads</h1>
          <p className={styles.subtitle}>Synkroniser annonseringskostnader fra Google Ads.</p>
        </div>
        <div className={styles.headerActions}>
          {/* Sync never touches the display filter below — it only refreshes the data. */}
          <AdsSyncButton
            endpoint={MARKETING_API.googleSync}
            providerName="Google Ads"
            channelLabel="Google Ads"
            idPrefix="google"
            hasData={hasData}
            primaryLabel="Synkroniser nå"
            primaryLabelHasData="Oppdater"
            onSynced={onSynced}
          />
        </div>
      </div>

      <ConnectionPanel status={status} />

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
          <div className={styles.summaryLabel}>Importerte dager</div>
          <div className={styles.summaryValue}>{summary.days}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Historikk i databasen</div>
          <div className={styles.summaryValue}>
            {status?.summary.firstDay && status.summary.lastDay
              ? `${formatDay(status.summary.firstDay)}–${formatDay(status.summary.lastDay)}`
              : '—'}
          </div>
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

      {phase === 'loading' && <div className={styles.state}>Laster Google Ads-kostnader …</div>}
      {phase === 'error' && (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          {error || 'Kunne ikke laste Google Ads-kostnader.'}
        </div>
      )}
      {phase === 'ready' && rows.length === 0 && (
        <div className={styles.state}>
          Ingen importerte Google Ads-kostnader for perioden. Bruk «
          {hasData ? 'Oppdater' : 'Synkroniser nå'}».
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
                  <td>Google Ads API</td>
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
