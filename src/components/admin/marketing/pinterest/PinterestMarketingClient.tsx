'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatNOK } from '@/lib/analytics/money'
import { MARKETING_API, MARKETING_ROUTES, STATUS } from '@/lib/marketing/channels'
import type { ExpenseRow, ExpensesSummary } from '@/lib/marketing/expenseSummary'
import type { SyncStateSnapshot } from '@/lib/marketing/syncState'
import AdsSyncButton, { type AdsSyncOutcome } from '../AdsSyncButton'
import styles from '../marketing.module.css'

// Pinterest Ads detail view. Built on the same template as GoogleMarketingClient: connection
// panel → display filter → summary cards → imported-days table. Every value is fetched from
// the admin-only endpoints; no configuration or secret is ever read in the browser.

type Phase = 'loading' | 'ready' | 'error'

interface ExpensesResponse {
  period: { since: string | null; until: string | null }
  rows: ExpenseRow[]
  summary: ExpensesSummary
  /** True when any imported record exists at all (independent of the display filter). */
  hasData: boolean
  error?: string
}

/** Non-secret OAuth connection state. No token value is ever part of this payload. */
interface ConnectionState {
  status: 'disconnected' | 'connected' | 'reauthorization_required' | string
  connectedAt: string | null
  lastRefreshedAt: string | null
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  scope: string | null
  /** Short internal code such as `invalid_grant` — never Pinterest's raw response. */
  lastOAuthError: string | null
}

interface StatusResponse {
  configured: boolean
  configError: string | null
  missingEnv: string[]
  /** True when a usable authorization exists (OAuth grant, or the legacy env token). */
  authorized: boolean
  /** True when the app credentials and the encryption key are in place, so «Koble til» works. */
  canConnect: boolean
  /** Safe message naming a misconfigured encryption key, or null. Never contains key material. */
  encryptionKeyError: string | null
  /** True while the deprecated PINTEREST_ACCESS_TOKEN is still set. */
  usingLegacyToken: boolean
  connection: ConnectionState
  requestedScope: string
  redirectUri: string
  /** Masked, e.g. •••5175. The full id never leaves the server. */
  accountId: string
  apiVersion: string | null
  currency: string | null
  summary: ExpensesSummary
  hasData: boolean
  sync: SyncStateSnapshot
  error?: string
}

/**
 * Norwegian copy for every outcome the OAuth callback can redirect with. The callback only ever
 * sends a short reason code, so no Pinterest text — and no token — can reach the browser, and
 * the wording can change here without touching the server.
 */
export const PINTEREST_CALLBACK_MESSAGES: Record<string, string> = {
  config:
    'Pinterest-appens legitimasjon mangler eller er ugyldig. Kontroller PINTEREST_APP_ID og PINTEREST_APP_SECRET.',
  denied: 'Autoriseringen ble avbrutt i Pinterest. Ingen tilgang ble gitt.',
  state:
    'Sikkerhetskontrollen for autoriseringen feilet, eller den tok for lang tid. Start «Koble til» på nytt.',
  // Not "you are not logged in": the callback authenticates on the lagrede state, not on the
  // session cookie (which Payload will not honour on a cross-site redirect). This means the
  // account that started the flow is no longer an administrator.
  unauthorized:
    'Autoriseringen kunne ikke knyttes til en administrator. Logg inn i admin og start «Koble til» på nytt.',
  code: 'Pinterest returnerte ingen autorisasjonskode. Start «Koble til» på nytt.',
  exchange:
    'Pinterest avviste autorisasjonskoden. Koden kan bare brukes én gang og varer kort — start «Koble til» på nytt. Se serverloggen (op=code-exchange).',
  scope:
    'Autoriseringen ga ikke lesetilgang til annonsedata (ads:read). Kontroller tillatelsene på Pinterest-appen og prøv igjen.',
  storage:
    'Tilgangen ble gitt, men kunne ikke lagres sikkert. Kontroller PINTEREST_TOKEN_ENCRYPTION_KEY eller PAYLOAD_SECRET.',
  failed: 'Tilkoblingen til Pinterest feilet. Prøv igjen senere.',
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

/**
 * Connection panel with the four states the OAuth flow can produce: not configured, not
 * connected, must reconnect, and connected. The connect action is a plain link, never a fetch —
 * the endpoint answers with a 302 to Pinterest's consent screen, which only a top-level
 * navigation can follow.
 */
function ConnectionPanel({ status }: { status: StatusResponse | null }) {
  const [connecting, setConnecting] = useState(false)

  const configured = Boolean(status?.configured)
  const connState = status?.connection.status ?? 'disconnected'
  const needsReauth = connState === 'reauthorization_required'
  const authorized = Boolean(status?.authorized) && !needsReauth

  const label = !configured
    ? STATUS.notConfigured
    : needsReauth
      ? STATUS.reauthRequired
      : authorized
        ? STATUS.connected
        : STATUS.notConnected

  const color = !configured
    ? 'var(--theme-warning-500)'
    : needsReauth
      ? 'var(--theme-error-500)'
      : authorized
        ? 'var(--theme-success-500)'
        : 'var(--theme-warning-500)'

  const tagline = !configured
    ? 'Mangler oppsett'
    : needsReauth
      ? 'Autorisering utløpt'
      : authorized
        ? 'Synkronisering aktiv'
        : 'Autorisering mangler'

  // Offered whenever the app credentials are in place — including while connected, so an admin
  // can deliberately re-consent (for example after widening the scopes) without waiting for a
  // failure.
  const canConnect = Boolean(status?.canConnect)
  const connectLabel = needsReauth || authorized ? 'Koble til på nytt' : 'Koble til'
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
          {tagline}
        </span>
        {canConnect && (
          <a
            className="btn btn--style-primary btn--size-small"
            style={{ marginLeft: 'auto' }}
            href={MARKETING_API.pinterestOAuthStart}
            onClick={() => setConnecting(true)}
            aria-busy={connecting}
            aria-label={connecting ? 'Åpner Pinterest-autorisering' : connectLabel}
          >
            {connecting ? 'Åpner Pinterest …' : connectLabel}
          </a>
        )}
      </div>

      <div className={styles.connGrid}>
        <div>
          <div className={styles.connLabel}>Annonsekonto</div>
          <div className={styles.connValue}>{status?.accountId ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Valuta</div>
          <div className={styles.connValue}>{status?.currency ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Tilgangsnivå</div>
          <div className={styles.connValue}>
            {status?.connection.scope || status?.requestedScope || '—'}
          </div>
        </div>
        <div>
          <div className={styles.connLabel}>Koblet til</div>
          <div className={styles.connValue}>{formatDateTime(status?.connection.connectedAt)}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Token fornyes etter</div>
          <div className={styles.connValue}>
            {formatDateTime(status?.connection.accessTokenExpiresAt)}
          </div>
        </div>
        <div>
          <div className={styles.connLabel}>Sist fornyet</div>
          <div className={styles.connValue}>
            {formatDateTime(status?.connection.lastRefreshedAt)}
          </div>
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

      {!configured && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          {status?.configError ?? 'Pinterest Ads-konfigurasjonen mangler eller er ugyldig.'}
          {status && status.missingEnv.length > 0 && (
            <> Mangler: {status.missingEnv.join(', ')}.</>
          )}
        </p>
      )}

      {status?.encryptionKeyError && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          {status.encryptionKeyError}
        </p>
      )}

      {configured && needsReauth && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Pinterest har trukket tilbake tilgangen, eller den er utløpt. Importerte kostnader er
          uendret — velg «Koble til på nytt» for å gjenoppta synkroniseringen.
        </p>
      )}

      {configured && !authorized && !needsReauth && (
        <p className={styles.connNotice}>
          Pinterest Ads er ikke autorisert ennå. Velg «Koble til» og godkjenn tilgangen
          {status?.requestedScope ? ` (${status.requestedScope})` : ''} i Pinterest.
        </p>
      )}

      {status?.usingLegacyToken && (
        <p className={styles.connNotice}>
          PINTEREST_ACCESS_TOKEN er fortsatt satt. Den brukes bare inntil «Koble til» er
          gjennomført, og kan fjernes fra miljøvariablene etterpå.
        </p>
      )}

      {authorized && lastError && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Siste forsøk feilet: {lastError}
        </p>
      )}
    </section>
  )
}

/**
 * Pinterest Ads detail view. Shows only imported (source = 'pinterest-ads') day records for
 * the selected period, a computed summary, and the sync actions. The "Totalt" under the table
 * is a computed sum of the displayed rows — never a stored record.
 */
export default function PinterestMarketingClient() {
  const searchParams = useSearchParams()
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

  /** Connection + stored-history status. Never triggers a Pinterest Ads API call. */
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(MARKETING_API.pinterestStatus, { credentials: 'include' })
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
      const res = await fetch(`${MARKETING_API.pinterestExpenses}${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as ExpensesResponse
      if (!res.ok) {
        setError(body.error ?? `Kunne ikke hente Pinterest Ads-kostnader (${res.status}).`)
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

  /**
   * Outcome of an OAuth round-trip, rebuilt from the short code in the URL. The callback never
   * puts a message, a token or a Pinterest response in the address bar — only `connected`, or
   * `error` plus a reason code that maps to the copy above.
   */
  const callbackNotice = useMemo(() => {
    const outcome = searchParams?.get('pinterest')
    if (outcome === 'connected') {
      return { ok: true, text: 'Pinterest Ads er koblet til. Synkronisering er aktiv.' }
    }
    if (outcome === 'error') {
      const reason = searchParams?.get('reason') ?? 'failed'
      return {
        ok: false,
        text: PINTEREST_CALLBACK_MESSAGES[reason] ?? PINTEREST_CALLBACK_MESSAGES.failed,
      }
    }
    return null
  }, [searchParams])

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
          <h1 className={styles.title}>Pinterest Ads</h1>
          <p className={styles.subtitle}>Synkroniser annonseringskostnader fra Pinterest Ads.</p>
        </div>
        <div className={styles.headerActions}>
          {/* Content export — no Pinterest API call, the admin uploads the CSV manually. */}
          <Link
            className="btn btn--style-secondary btn--size-small"
            href={MARKETING_ROUTES.pinterestExport}
          >
            Pinterest-eksport
          </Link>
          {/* Sync never touches the display filter below — it only refreshes the data. */}
          <AdsSyncButton
            endpoint={MARKETING_API.pinterestSync}
            providerName="Pinterest Ads"
            channelLabel="Pinterest Ads"
            idPrefix="pinterest"
            hasData={hasData}
            primaryLabel="Synkroniser nå"
            primaryLabelHasData="Oppdater"
            onSynced={onSynced}
          />
        </div>
      </div>

      {callbackNotice && (
        <div
          className={`${styles.state} ${callbackNotice.ok ? '' : styles.stateError}`}
          role={callbackNotice.ok ? 'status' : 'alert'}
        >
          {callbackNotice.text}
        </div>
      )}

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

      {phase === 'loading' && <div className={styles.state}>Laster Pinterest Ads-kostnader …</div>}
      {phase === 'error' && (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          {error || 'Kunne ikke laste Pinterest Ads-kostnader.'}
        </div>
      )}
      {phase === 'ready' && rows.length === 0 && (
        <div className={styles.state}>
          Ingen importerte Pinterest Ads-kostnader for perioden. Bruk «
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
                  <td>Pinterest Ads API</td>
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
