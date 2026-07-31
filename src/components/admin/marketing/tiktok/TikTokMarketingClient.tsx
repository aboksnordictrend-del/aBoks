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

// TikTok Ads detail view. Built on the same template as PinterestMarketingClient: connection
// panel → display filter → summary cards → imported-days table. Every value is fetched from
// the admin-only endpoints; no configuration or secret is ever read in the browser.
//
// The one thing this page has that the others do not is a real OAuth step, so the connection
// panel has four states — not configured, not connected, connected-but-no-advertiser, and
// connected — and the sync actions only appear in the last one.
//
// Nothing here ever receives the app secret or an access token: the status endpoint returns
// booleans, a masked advertiser id and non-secret metadata, and "Koble til" is a plain link
// to a server endpoint that performs the redirect.

type Phase = 'loading' | 'ready' | 'error'

/** TikTok Ads Manager. Deliberately the generic dashboard URL — linking to a specific account
 *  would mean putting the full advertiser id in client-side markup. */
const TIKTOK_ADS_MANAGER_URL = 'https://ads.tiktok.com/i18n/dashboard'

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
  /** True once an access token exists (env or a stored OAuth grant). */
  authorized: boolean
  /** True when authorized but no single advertiser has been resolved yet. */
  needsAdvertiser: boolean
  /** False when /advertiser/info/ was refused — optional metadata only. */
  metadataAvailable: boolean
  /** Result of the connect-time report probe; null when none has run. */
  reportingOk: boolean | null
  /** True when no currency could be established — the import stays blocked. */
  needsCurrency: boolean
  /** Masked, e.g. •••4017. The full id never leaves the server. */
  accountId: string
  accountName: string | null
  connectedAt: string | null
  apiVersion: string | null
  currency: string | null
  timezone: string | null
  summary: ExpensesSummary
  hasData: boolean
  sync: SyncStateSnapshot
  error?: string
}

interface AdvertiserRow {
  id: string
  name: string | null
}

const EMPTY_SUMMARY: ExpensesSummary = {
  totalInclVat: 0,
  totalExVat: 0,
  days: 0,
  lastSyncedAt: null,
  firstDay: null,
  lastDay: null,
}

/**
 * Norwegian copy for every outcome the OAuth callback can redirect with. The callback only
 * ever sends a short reason code, so no TikTok text can reach the browser — and the wording
 * can change here without touching the server.
 */
export const TIKTOK_CALLBACK_MESSAGES: Record<string, string> = {
  // Not "you are not logged in": the callback authenticates on the signed state, not on the
  // session cookie (which Payload will not honour on a cross-site redirect). This means the
  // account that started the flow is no longer an administrator, or the returning session
  // belongs to someone else.
  unauthorized:
    'Autoriseringen kunne ikke knyttes til en administrator. Logg inn i admin og start «Koble til» på nytt.',
  config: 'TikTok-konfigurasjonen mangler eller er ugyldig. Kontroller miljøvariablene.',
  denied: 'Autoriseringen ble avbrutt i TikTok. Ingen tilgang ble gitt.',
  state: 'Sikkerhetskontrollen for autoriseringen feilet, eller den tok for lang tid. Prøv å koble til på nytt.',
  code: 'TikTok returnerte ingen autorisasjonskode. Prøv å koble til på nytt.',
  exchange:
    'TikTok avviste autorisasjonskoden. Koden kan bare brukes én gang og varer i én time — start «Koble til» på nytt. Se serverloggen (op=token-exchange) for TikToks feilkode.',
  'advertiser-list':
    'Tilgangstokenet ble hentet, men TikTok avviste oppslaget av annonsekontoer. Kontroller at appen har lesetilgang til annonsekontoer. Se serverloggen (op=advertiser-list).',
  'no-advertiser': 'Autoriseringen ga ikke tilgang til noen annonsekonto. Kontroller tilgangene i TikTok Business Center.',
  'multiple-advertisers':
    'Flere annonsekontoer er tilgjengelige. Velg én ved å sette TIKTOK_ADVERTISER_ID i miljøvariablene.',
  'not-authorized':
    'Annonsekontoen i TIKTOK_ADVERTISER_ID er ikke blant kontoene autoriseringen gjelder for.',
  currency:
    'Annonsekontoen rapporterer ikke i NOK. Import er stoppet — beløp konverteres ikke automatisk.',
  'currency-unknown':
    'Tilkoblingen er opprettet, men valutaen er ukjent. TikTok oppgir valuta kun via /advertiser/info/, som krever tillatelsen «Ad Account Management». Kontroller valutaen i TikTok Ads Manager og sett TIKTOK_ADVERTISER_CURRENCY (f.eks. NOK).',
  reporting:
    'Tilkoblingen er opprettet, men TikTok avviste en testrapport. Kontroller at appen har tillatelsen «Reporting» for denne annonsekontoen. Se serverloggen (op=report-probe).',
  failed: 'Tilkoblingen til TikTok feilet. Prøv igjen senere.',
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

/** The connection state a panel is in. Derived once so the copy and the actions agree. */
export type TikTokConnectionState =
  | 'not-configured'
  | 'not-connected'
  | 'needs-advertiser'
  | 'needs-currency'
  | 'reporting-unavailable'
  | 'connected'

/**
 * The connection's single state, in descending order of severity. The order matters: a
 * missing currency blocks importing even when reporting works, and reporting being refused
 * blocks it even when everything else is in place.
 */
export function connectionState(status: StatusResponse | null): TikTokConnectionState {
  if (!status?.configured) return 'not-configured'
  if (!status.authorized) return 'not-connected'
  if (status.needsAdvertiser) return 'needs-advertiser'
  if (status.needsCurrency) return 'needs-currency'
  if (status.reportingOk === false) return 'reporting-unavailable'
  return 'connected'
}

const STATE_LABEL: Record<TikTokConnectionState, string> = {
  'not-configured': STATUS.notConfigured,
  'not-connected': STATUS.notConnected,
  'needs-advertiser': STATUS.notConnected,
  'needs-currency': STATUS.notConnected,
  'reporting-unavailable': STATUS.notConnected,
  connected: STATUS.connected,
}

const STATE_TAGLINE: Record<TikTokConnectionState, string> = {
  'not-configured': 'Mangler oppsett',
  'not-connected': 'Autorisering mangler',
  'needs-advertiser': 'Velg annonsekonto',
  'needs-currency': 'Valuta mangler',
  'reporting-unavailable': 'Rapporteringstilgang mangler',
  connected: 'Synkronisering aktiv',
}

/**
 * Connection panel. Exported so its rendered surface can be asserted directly in a test
 * without the surrounding fetches and Payload providers.
 */
export function TikTokConnectionPanel({
  status,
  callbackError,
  advertisers,
  advertisersError,
  loadingAdvertisers,
  onShowAdvertisers,
}: {
  status: StatusResponse | null
  /** Reason code from the OAuth callback redirect, if the admin just came back from TikTok. */
  callbackError: string | null
  advertisers: AdvertiserRow[] | null
  advertisersError: string | null
  loadingAdvertisers: boolean
  onShowAdvertisers: () => void
}) {
  const state = connectionState(status)
  const connected = state === 'connected'
  const color = connected ? 'var(--theme-success-500)' : 'var(--theme-warning-500)'
  const lastError = status?.sync.lastError ?? null
  const canConnect = Boolean(status?.configured)

  return (
    <section className={styles.connection}>
      <div className={styles.connHead}>
        <h2 className={styles.connHeadTitle}>Tilkobling</h2>
        <span className={styles.connBadge} style={{ ['--badge' as string]: color }}>
          <span className={styles.connBadgeDot} aria-hidden="true" />
          {STATE_LABEL[state]}
        </span>
        <span className={styles.connLabel} style={{ margin: 0 }}>
          {STATE_TAGLINE[state]}
        </span>
      </div>

      <div className={styles.connGrid}>
        <div>
          <div className={styles.connLabel}>Annonsekonto</div>
          <div className={styles.connValue}>
            {status?.accountName ? `${status.accountName} (${status.accountId})` : (status?.accountId ?? '—')}
          </div>
        </div>
        <div>
          <div className={styles.connLabel}>Valuta</div>
          <div className={styles.connValue}>{status?.currency ?? '—'}</div>
        </div>
        <div>
          <div className={styles.connLabel}>Tidssone</div>
          <div className={styles.connValue}>{status?.timezone ?? '—'}</div>
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
        <div>
          <div className={styles.connLabel}>Siste importerte dag</div>
          <div className={styles.connValue}>{formatDay(status?.summary.lastDay)}</div>
        </div>
      </div>

      {/* --- Outcome of a just-completed OAuth round-trip ------------------------------ */}
      {callbackError && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          {TIKTOK_CALLBACK_MESSAGES[callbackError] ?? TIKTOK_CALLBACK_MESSAGES.failed}
        </p>
      )}

      {/* --- State-specific explanation ------------------------------------------------ */}
      {state === 'not-configured' && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          {status?.configError ?? 'TikTok Ads-konfigurasjonen mangler eller er ugyldig.'}
          {status && status.missingEnv.length > 0 && <> Mangler: {status.missingEnv.join(', ')}.</>}
        </p>
      )}

      {state === 'not-connected' && (
        <p className={styles.connNotice}>
          Oppsettet er på plass. Bruk «Koble til TikTok» for å autorisere annonsekontoen.
        </p>
      )}

      {state === 'needs-advertiser' && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Autoriseringen er fullført, men ingen enkelt annonsekonto kunne velges. Sett
          TIKTOK_ADVERTISER_ID i miljøvariablene til kontoen kostnadene skal hentes fra.
        </p>
      )}

      {state === 'needs-currency' && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Tilkoblingen er opprettet, men valutaen til annonsekontoen er ukjent. TikTok oppgir
          valuta kun via /advertiser/info/, som krever tillatelsen «Ad Account Management».
          Kontroller valutaen i TikTok Ads Manager og sett TIKTOK_ADVERTISER_CURRENCY (f.eks.
          NOK). Import er stoppet inntil den er satt — valuta gjettes aldri.
        </p>
      )}

      {state === 'reporting-unavailable' && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Tilkoblingen er opprettet, men TikTok avviste en testrapport. Kontroller at appen har
          tillatelsen «Reporting» for denne annonsekontoen, og koble til på nytt.
        </p>
      )}

      {/* Optional metadata only — never presented as a failure. */}
      {status?.authorized && !status.metadataAvailable && state !== 'not-connected' && (
        <p className={styles.connNotice}>
          TikTok ga ikke tilgang til kontodetaljer (/advertiser/info/ krever «Ad Account
          Management»). Valuta er hentet fra oppsettet, og tidssone bruker UTC. Import av
          kostnader er ikke påvirket.
        </p>
      )}

      {connected && lastError && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          Siste forsøk feilet: {lastError}
        </p>
      )}

      {/* --- Actions ------------------------------------------------------------------- */}
      <div className={styles.headerActions}>
        {canConnect && (
          // A real navigation, not fetch: the endpoint answers 302 to TikTok's consent screen.
          <a
            className={`btn btn--style-${connected ? 'secondary' : 'primary'} btn--size-small`}
            href={MARKETING_API.tiktokConnect}
          >
            {connected ? 'Koble til på nytt' : 'Koble til TikTok'}
          </a>
        )}
        {state === 'needs-advertiser' && (
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            onClick={onShowAdvertisers}
            disabled={loadingAdvertisers}
          >
            {loadingAdvertisers ? 'Henter kontoer …' : 'Vis tilgjengelige kontoer'}
          </button>
        )}
        {connected && (
          <a
            className="btn btn--style-secondary btn--size-small"
            href={TIKTOK_ADS_MANAGER_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Åpne TikTok Ads Manager
          </a>
        )}
      </div>

      {advertisersError && (
        <p className={`${styles.connNotice} ${styles.connNoticeError}`} role="alert">
          {advertisersError}
        </p>
      )}

      {advertisers && advertisers.length > 0 && (
        <div className={styles.connNotice}>
          <p>Autoriserte annonsekontoer — kopier ID-en du vil importere fra:</p>
          <ul>
            {advertisers.map((a) => (
              <li key={a.id}>
                {a.name ?? 'Uten navn'} — <code>{a.id}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * TikTok Ads detail view. Shows only imported (source = 'tiktok-ads') day records for the
 * selected period, a computed summary, and the connect/sync actions. The "Totalt" under the
 * table is a computed sum of the displayed rows — never a stored record.
 */
export default function TikTokMarketingClient() {
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

  const [advertisers, setAdvertisers] = useState<AdvertiserRow[] | null>(null)
  const [advertisersError, setAdvertisersError] = useState<string | null>(null)
  const [loadingAdvertisers, setLoadingAdvertisers] = useState(false)

  // `?tiktok=connected` / `?tiktok=error&reason=…` are written by the OAuth callback. The
  // auth code itself never reaches this URL — the callback consumes it server-side and
  // redirects to this clean address.
  const callbackOutcome = searchParams?.get('tiktok') ?? null
  const callbackError = callbackOutcome === 'error' ? (searchParams?.get('reason') ?? 'failed') : null
  const justConnected = callbackOutcome === 'connected'

  /** Connection + stored-history status. Never triggers a TikTok Ads API call. */
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(MARKETING_API.tiktokStatus, { credentials: 'include' })
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
      const res = await fetch(`${MARKETING_API.tiktokExpenses}${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
      })
      const body = (await res.json().catch(() => ({}))) as ExpensesResponse
      if (!res.ok) {
        setError(body.error ?? `Kunne ikke hente TikTok Ads-kostnader (${res.status}).`)
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

  /** Advertiser list — only reachable in the "needs advertiser" state, and admin-guarded. */
  const showAdvertisers = useCallback(async () => {
    setLoadingAdvertisers(true)
    setAdvertisersError(null)
    try {
      const res = await fetch(MARKETING_API.tiktokAdvertisers, { credentials: 'include' })
      const body = (await res.json().catch(() => ({}))) as {
        advertisers?: AdvertiserRow[]
        error?: string
      }
      if (!res.ok) {
        setAdvertisersError(body.error ?? `Kunne ikke hente annonsekontoer (${res.status}).`)
        return
      }
      setAdvertisers(body.advertisers ?? [])
    } catch (err) {
      setAdvertisersError(err instanceof Error ? err.message : 'Nettverksfeil.')
    } finally {
      setLoadingAdvertisers(false)
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

  // Sync is offered only when it could actually run: configured, authorized and pointed at a
  // single advertiser.
  const canSync = useMemo(() => connectionState(status) === 'connected', [status])

  return (
    <div>
      <Link className={styles.backLink} href={MARKETING_ROUTES.catalog}>
        <span aria-hidden>←</span> Tilbake til markedsføringskanaler
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>TikTok Ads</h1>
          <p className={styles.subtitle}>Synkroniser annonseringskostnader fra TikTok Ads.</p>
        </div>
        <div className={styles.headerActions}>
          {/* Sync never touches the display filter below — it only refreshes the data. */}
          {canSync && (
            <AdsSyncButton
              endpoint={MARKETING_API.tiktokSync}
              providerName="TikTok Ads"
              channelLabel="TikTok Ads"
              idPrefix="tiktok"
              hasData={hasData}
              primaryLabel="Synkroniser nå"
              primaryLabelHasData="Oppdater"
              onSynced={onSynced}
            />
          )}
        </div>
      </div>

      {justConnected && (
        <p className={styles.connNotice} role="status">
          TikTok Ads er koblet til. Bruk «Synkroniser nå» for å hente historikken.
        </p>
      )}

      <TikTokConnectionPanel
        status={status}
        callbackError={callbackError}
        advertisers={advertisers}
        advertisersError={advertisersError}
        loadingAdvertisers={loadingAdvertisers}
        onShowAdvertisers={showAdvertisers}
      />

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

      {phase === 'loading' && <div className={styles.state}>Laster TikTok Ads-kostnader …</div>}
      {phase === 'error' && (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          {error || 'Kunne ikke laste TikTok Ads-kostnader.'}
        </div>
      )}
      {phase === 'ready' && rows.length === 0 && (
        <div className={styles.state}>
          {canSync
            ? `Ingen importerte TikTok Ads-kostnader for perioden. Bruk «${hasData ? 'Oppdater' : 'Synkroniser nå'}».`
            : 'Ingen importerte TikTok Ads-kostnader ennå. Fullfør tilkoblingen over først.'}
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
                  <td>TikTok Ads API</td>
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
