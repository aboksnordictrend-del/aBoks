'use client'

import { useState } from 'react'
import { DELIVERY_UNIT_LABELS } from '@/lib/miljo/constants'
import { formatDayKey } from '@/lib/miljo/period'
import { formatNo } from '../../miljo/[code]/clientUtils'
import real from '../../miljo/[code]/miljo.module.css'
import { DEMO_CATEGORIES, DEMO_LABEL, DEMO_ORG_NAME } from './demoModel'
import { useDemo } from './DemoProvider'
import DemoBadge from './DemoBadge'
import styles from './demo.module.css'

const CSV_OPTIONS = [
  { value: 'sammendrag', label: 'Sammendrag per periode' },
  { value: 'registreringer', label: 'Registreringer' },
  { value: 'leveranser', label: 'Leveranser' },
] as const

const qty = (n: number, unit: 'kg' | 'stk') => `${formatNo(n, unit === 'kg' ? 2 : 0)} ${DELIVERY_UNIT_LABELS[unit]}`

function save(body: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The site's own logo (a static file on this origin), as in the real report's header. */
async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const res = await fetch('/logo.png')
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    return null
  }
}

/**
 * A preview of page one of the «Miljørapport» plus working demo downloads. Both files are
 * generated in the browser from the demo state (./demoExports.ts, loaded on first click) and
 * marked «DEMO – EKSEMPELDATA»; the real export endpoint is never called.
 */
export default function ReportDemo() {
  const { state, stats } = useDemo()
  const [csvType, setCsvType] = useState<(typeof CSV_OPTIONS)[number]['value']>('sammendrag')
  const [busy, setBusy] = useState<'' | 'pdf' | 'csv'>('')
  const [error, setError] = useState('')
  const { registrations, deliveries, period } = stats
  const share = (n: number) => (registrations.total > 0 ? `${formatNo((n / registrations.total) * 100, 1)} %` : '–')

  const download = async (kind: 'pdf' | 'csv') => {
    setBusy(kind)
    setError('')
    try {
      const m = await import('./demoExports')
      if (kind === 'pdf') {
        const file = await m.demoPdf(state, await loadLogo())
        save(file.body as BlobPart, 'application/pdf', file.filename)
      } else {
        const file = m.demoCsv(state, csvType)
        save(file.body, 'text/csv;charset=utf-8', file.filename)
      }
    } catch {
      setError('Demofilen kunne ikke lages. Prøv igjen.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className={styles.split} style={{ alignItems: 'center' }}>
      <div className={styles.formCol}>
        <div className={styles.paper} aria-label="Forhåndsvisning av demo-miljørapport" role="figure">
          <div className={styles.paperBanner}>{DEMO_LABEL} · Fiktive tall</div>
          <div className={styles.watermark} aria-hidden="true">
            {DEMO_LABEL}
          </div>
          <div className={styles.paperHead}>
            <span className={styles.paperLogo}>aBoks</span>
            <span className={styles.paperSmall}>aBoks Miljøregistrering</span>
          </div>
          <p className={styles.paperTitle}>Miljørapport – DEMO</p>
          <p className={styles.paperOrg}>
            {DEMO_ORG_NAME} ({DEMO_LABEL})
          </p>
          <dl className={styles.paperKv}>
            <dt>Rapportperiode</dt>
            <dd>
              {formatDayKey(period.fromKey)}–{formatDayKey(period.toKey)}
            </dd>
            <dt>Utstedt av</dt>
            <dd>Demo på aboks.no – ikke en ekte rapport</dd>
          </dl>
          <p className={styles.paperNotice}>
            Rapporten skiller mellom batterier som ansatte selv har registrert, og leveranser som organisasjonens ansvarlige har
            registrert. Tallene måles på ulike måter og kan ikke legges sammen.
          </p>
          <p className={styles.paperH}>1. Registrerte batterier (egenrapportert)</p>
          <table className={styles.paperTable}>
            <thead>
              <tr>
                <th>Batteritype</th>
                <th className={styles.r}>Antall</th>
                <th className={styles.r}>Andel</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_CATEGORIES.map((c) => (
                <tr key={c.value}>
                  <td>{c.label}</td>
                  <td className={styles.r}>{formatNo(registrations.byCategory[c.value])}</td>
                  <td className={styles.r}>{share(registrations.byCategory[c.value])}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Totalt</strong>
                </td>
                <td className={styles.r}>
                  <strong>{formatNo(registrations.total)}</strong>
                </td>
                <td className={styles.r} />
              </tr>
            </tbody>
          </table>
          <p className={styles.paperH}>2. Leverte batterier (oppgitt eller dokumentert)</p>
          <table className={styles.paperTable}>
            <tbody>
              {(['kg', 'stk'] as const)
                .filter((u) => deliveries.byUnit[u].deliveries > 0)
                .map((u) => (
                  <tr key={u}>
                    <td>{u === 'kg' ? 'Levert, registrert i kilo' : 'Levert, registrert i antall'}</td>
                    <td className={styles.r}>{qty(deliveries.byUnit[u].quantity, u)}</td>
                  </tr>
                ))}
              <tr>
                <td>Dokumentert med kvittering</td>
                <td className={styles.r}>{formatNo(deliveries.documented)} leveranser</td>
              </tr>
              <tr>
                <td>Oppgitt av ansvarlig</td>
                <td className={styles.r}>{formatNo(deliveries.reported)} leveranser</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${styles.formCol} ${real.card}`}>
        <DemoBadge>DEMO – eksempeldata</DemoBadge>
        <h3 className={real.subTitle} style={{ marginTop: 14 }}>
          Last ned demorapporten
        </h3>
        <p className={real.small} style={{ marginTop: 0 }}>
          Filene lages i nettleseren din av eksempeldataene over, inkludert det du har registrert i demoen. De er tydelig merket
          «{DEMO_LABEL}» og er ikke ekte miljødokumentasjon.
        </p>
        <div className={styles.exportButtons}>
          <button
            type="button"
            className={real.submit}
            style={{ marginTop: 0 }}
            onClick={() => void download('pdf')}
            disabled={busy !== ''}
          >
            {busy === 'pdf' ? 'Lager PDF …' : 'Last ned demo-PDF'}
          </button>
        </div>
        <div className={real.exportRow} style={{ marginTop: 12 }}>
          <label className={real.srOnly} htmlFor="demo-csv-type">
            Innhold i CSV-filen
          </label>
          <select id="demo-csv-type" className={real.select} value={csvType} onChange={(e) => setCsvType(e.target.value as typeof csvType)}>
            {CSV_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" className={real.secondary} onClick={() => void download('csv')} disabled={busy !== ''}>
            {busy === 'csv' ? 'Lager CSV …' : 'Last ned demo-CSV'}
          </button>
        </div>
        {error && (
          <p className={real.formError} role="alert">
            {error}
          </p>
        )}
        <p className={real.small}>
          Rapporten skiller registrerte og leverte batterier, og inneholder ingen beregning av klimaeffekt eller bekreftelse på
          gjenvinning.
        </p>
      </div>
    </div>
  )
}
