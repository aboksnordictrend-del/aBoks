'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { MARKETING_API, MARKETING_ROUTES } from '@/lib/marketing/channels'
import {
  applyBulkSelection,
  bulkSelectionState,
  countSelected,
} from '@/lib/pinterest/export/selection'
import { DESCRIPTION_MAX, TITLE_MAX } from '@/lib/pinterest/export/text'
import type {
  PinterestExportItem,
  PinterestExportPreview,
  PinterestSourceSelection,
  PinterestSourceType,
} from '@/lib/pinterest/export/types'
import marketing from '../marketing.module.css'
import styles from './pinterestExport.module.css'

// Pinterest-eksport. Builds a Pinterest-compatible bulk-upload CSV from published products,
// published variants with their own image, and the curated homepage list. Nothing is
// published through the Pinterest API — the admin downloads the file and uploads it at
// pinterest.com/settings/bulk-create-pins.

type Phase = 'loading' | 'ready' | 'error'

/** Board name is a UI preference, never a database record. */
const BOARD_STORAGE_KEY = 'aboks:pinterest-export:board'

const SOURCE_LABEL: Record<PinterestSourceType, string> = {
  product: 'Produkt',
  variant: 'Variant',
  homepage: 'Forside',
  blob: 'Pinterest-mappe',
}

interface RowEdit {
  enabled: boolean
  title: string
  description: string
  keywords: string
  /** Only editable for Pinterest-mappe rows, and only to a value from the server allowlist. */
  destinationUrl: string
}

type PreviewResponse = PinterestExportPreview & { limit: number; error?: string }

const itemKey = (item: PinterestExportItem) => `${item.sourceType}:${item.sourceId}`

function countClass(value: string, max: number): string {
  return `${styles.counter} ${Array.from(value).length > max ? styles.counterOver : ''}`.trim()
}

export interface BulkSelectionToolbarProps {
  canSelectAll: boolean
  canClearAll: boolean
  onSelectAll: () => void
  onClearAll: () => void
}

/**
 * The row above the preview table: the sort note on the left, the bulk actions on the right.
 * Real `<button>` elements with the native `disabled` attribute, so they are keyboard
 * reachable and announce their state without any ARIA of our own. Styling comes from
 * Payload's own `btn` classes, so focus rings match the rest of the admin.
 */
export function BulkSelectionToolbar({
  canSelectAll,
  canClearAll,
  onSelectAll,
  onClearAll,
}: BulkSelectionToolbarProps) {
  return (
    <div className={styles.tableToolbar}>
      <p className={styles.hint}>Sortering: Nyeste først</p>
      <div className={styles.tableToolbarActions}>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          onClick={onSelectAll}
          disabled={!canSelectAll}
        >
          Velg alle
        </button>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          onClick={onClearAll}
          disabled={!canClearAll}
        >
          Fjern alle valg
        </button>
      </div>
    </div>
  )
}

export default function PinterestExportClient() {
  const [sources, setSources] = useState<PinterestSourceSelection>({
    products: true,
    variants: true,
    homepage: true,
    blob: true,
  })
  const [board, setBoard] = useState('')
  const [phase, setPhase] = useState<Phase>('loading')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const reqId = useRef(0)

  // Restore the last board name. localStorage only — the value never reaches the database.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BOARD_STORAGE_KEY)
      if (saved) setBoard(saved)
    } catch {
      // Private mode / disabled storage — the field simply starts empty.
    }
  }, [])

  const rememberBoard = useCallback((value: string) => {
    setBoard(value)
    try {
      window.localStorage.setItem(BOARD_STORAGE_KEY, value)
    } catch {
      // Not being able to remember it is not worth an error message.
    }
  }, [])

  const selectedSources = useMemo(
    () =>
      (Object.keys(sources) as (keyof PinterestSourceSelection)[]).filter((k) => sources[k]),
    [sources],
  )

  const load = useCallback(async () => {
    const id = ++reqId.current
    setPhase('loading')
    setError('')
    setDownloadError('')
    try {
      const qs = selectedSources.join(',')
      const res = await fetch(
        `${MARKETING_API.pinterestExportPreview}?sources=${encodeURIComponent(qs)}`,
        { credentials: 'include' },
      )
      const body = (await res.json().catch(() => ({}))) as PreviewResponse
      if (id !== reqId.current) return
      if (!res.ok) {
        setError(body.error ?? `Kunne ikke bygge forhåndsvisningen (${res.status}).`)
        setPhase('error')
        return
      }
      setPreview(body)
      // Seed the edit buffer from the server values, keeping any row the admin already edited.
      setEdits((prev) => {
        const next: Record<string, RowEdit> = {}
        for (const item of body.items) {
          const key = itemKey(item)
          next[key] = prev[key] ?? {
            enabled: true,
            title: item.title,
            description: item.description,
            keywords: item.keywords,
            destinationUrl: item.destinationUrl,
          }
        }
        return next
      })
      setPhase('ready')
    } catch (err) {
      if (id !== reqId.current) return
      setError(err instanceof Error ? err.message : 'Nettverksfeil.')
      setPhase('error')
    }
  }, [selectedSources])

  useEffect(() => {
    load()
  }, [load])

  const patchEdit = useCallback((key: string, patch: Partial<RowEdit>) => {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }, [])

  const items = preview?.items ?? []
  /** Keys of the rows currently on screen — the exact set the bulk buttons act on. */
  const visibleKeys = useMemo(() => items.map(itemKey), [items])
  const enabledCount = countSelected(visibleKeys, edits)
  const { canSelectAll, canClearAll } = bulkSelectionState(visibleKeys, edits)
  const noSources = selectedSources.length === 0

  /**
   * Flip every visible row on or off. Touches nothing but each row's `enabled` flag: the
   * source filters, the fetched preview, the sort order and every edited title, description,
   * keyword list and destination are all left exactly as they were.
   */
  const setAllSelected = useCallback(
    (enabled: boolean) => {
      setEdits((prev) => applyBulkSelection(visibleKeys, prev, enabled))
    },
    [visibleKeys],
  )

  const download = useCallback(async () => {
    setDownloadError('')
    setDownloading(true)
    try {
      const res = await fetch(MARKETING_API.pinterestExport, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board,
          sources,
          rows: items.map((item) => {
            const edit = edits[itemKey(item)]
            return {
              sourceType: item.sourceType,
              sourceId: item.sourceId,
              enabled: edit?.enabled !== false,
              title: edit?.title ?? item.title,
              description: edit?.description ?? item.description,
              keywords: edit?.keywords ?? item.keywords,
              // Server-side allowlisted; anything else is ignored there.
              destinationUrl: edit?.destinationUrl ?? item.destinationUrl,
            }
          }),
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setDownloadError(body.error ?? `Eksporten feilet (${res.status}).`)
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(disposition)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = match?.[1] ?? 'pinterest-export.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Nettverksfeil.')
    } finally {
      setDownloading(false)
    }
  }, [board, sources, items, edits])

  return (
    <div>
      <Link className={marketing.backLink} href={MARKETING_ROUTES.pinterest}>
        <span aria-hidden>←</span> Tilbake til Pinterest Ads
      </Link>

      <div className={marketing.header}>
        <div>
          <h1 className={marketing.title}>Pinterest-eksport</h1>
          <p className={marketing.subtitle}>
            Lag en CSV-fil for Pinterest Bulk Upload. Hvert produktbilde i galleriet blir en egen
            pin. Filen lastes opp manuelt på Pinterest — ingenting publiseres automatisk.
          </p>
        </div>
      </div>

      {/* ── Sources ─────────────────────────────────────────────────────────────────── */}
      <fieldset className={styles.sources}>
        <legend className={styles.summaryLabel}>Kilder</legend>
        {(
          [
            ['products', 'Produkter'],
            ['variants', 'Varianter'],
            ['homepage', 'Forside'],
            ['blob', 'Pinterest-mappe'],
          ] as [keyof PinterestSourceSelection, string][]
        ).map(([key, label]) => (
          <label key={key} className={styles.check}>
            <input
              type="checkbox"
              checked={sources[key]}
              onChange={(e) => setSources((prev) => ({ ...prev, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {/* ── Board ───────────────────────────────────────────────────────────────────── */}
      <div className={styles.boardRow}>
        <label className={styles.field}>
          <span>Pinterest-tavle (påkrevd)</span>
          <input
            className={styles.input}
            type="text"
            value={board}
            placeholder="F.eks. Batterioppbevaring eller Batterioppbevaring/Produkter"
            onChange={(e) => rememberBoard(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          onClick={() => load()}
          disabled={phase === 'loading'}
        >
          Oppdater forhåndsvisning
        </button>
      </div>
      <p className={styles.hint}>
        Tavlenavnet må stemme nøyaktig med navnet på Pinterest. Bruk «Tavle/Seksjon» for å pinne
        til en seksjon. Navnet huskes lokalt i nettleseren og lagres aldri i databasen.
      </p>

      {preview?.baseUrlFallback && (
        <p className={`${styles.notice} ${styles.noticeWarn}`} role="status">
          NEXT_PUBLIC_SERVER_URL er ikke satt til en https-adresse. Alle lenker bygges derfor mot{' '}
          <strong>{preview.baseUrl}</strong>.
        </p>
      )}

      {/* A source that could not be read (currently only Blob) warns without blocking the rest. */}
      {preview?.warnings?.map((warning) => (
        <p key={warning} className={`${styles.notice} ${styles.noticeWarn}`} role="status">
          {warning}
        </p>
      ))}

      {/* ── Summary ─────────────────────────────────────────────────────────────────── */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          {/* One Pin per gallery image, so this is a count of images — not of products. The
              source filter above stays "Produkter". */}
          <div className={styles.summaryLabel}>Produktbilder</div>
          <div className={styles.summaryValue}>{preview?.counts.products ?? 0}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Varianter</div>
          <div className={styles.summaryValue}>{preview?.counts.variants ?? 0}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Forside</div>
          <div className={styles.summaryValue}>{preview?.counts.homepage ?? 0}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Pinterest-mappe</div>
          <div className={styles.summaryValue}>{preview?.counts.blob ?? 0}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Pins totalt</div>
          <div className={styles.summaryValue}>{enabledCount}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Hoppet over</div>
          <div className={styles.summaryValue}>{preview?.skipped.length ?? 0}</div>
        </div>
      </div>

      {(preview?.omitted ?? 0) > 0 && (
        <p className={`${styles.notice} ${styles.noticeWarn}`} role="status">
          Pinterest tar imot maks {preview?.limit ?? 200} pins per opplasting.{' '}
          <strong>{preview?.omitted}</strong> rader er utelatt fra denne filen.
        </p>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn--style-primary btn--size-small"
          onClick={download}
          disabled={downloading || phase !== 'ready' || enabledCount === 0 || !board.trim()}
        >
          {downloading ? 'Lager CSV …' : `Last ned CSV (${enabledCount})`}
        </button>
        {!board.trim() && <span className={styles.hint}>Fyll inn tavlenavn for å laste ned.</span>}
      </div>

      {downloadError && (
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {downloadError}
        </p>
      )}

      {/* ── Preview table ───────────────────────────────────────────────────────────── */}
      {noSources && <div className={styles.state}>Velg minst én kilde.</div>}
      {!noSources && phase === 'loading' && (
        <div className={styles.state}>Bygger forhåndsvisning …</div>
      )}
      {!noSources && phase === 'error' && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {error || 'Kunne ikke bygge forhåndsvisningen.'}
        </div>
      )}
      {!noSources && phase === 'ready' && items.length === 0 && (
        <div className={styles.state}>Ingen rader å eksportere for de valgte kildene.</div>
      )}

      {!noSources && phase === 'ready' && items.length > 0 && (
        <>
        <BulkSelectionToolbar
          canSelectAll={canSelectAll}
          canClearAll={canClearAll}
          onSelectAll={() => setAllSelected(true)}
          onClearAll={() => setAllSelected(false)}
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Med</th>
                <th scope="col">Bilde</th>
                <th scope="col">Kilde</th>
                <th scope="col">Tittel</th>
                <th scope="col">Mål-URL</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const key = itemKey(item)
                const edit = edits[key]
                if (!edit) return null
                const open = expanded[key] === true
                return (
                  <Fragment key={key}>
                    <tr className={edit.enabled ? undefined : styles.rowOff}>
                      <td>
                        <input
                          type="checkbox"
                          checked={edit.enabled}
                          aria-label={`Ta med «${edit.title}»`}
                          onChange={(e) => patchEdit(key, { enabled: e.target.checked })}
                        />
                      </td>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className={styles.thumb} src={item.mediaUrl} alt="" loading="lazy" />
                      </td>
                      <td>
                        <span className={styles.badge}>{SOURCE_LABEL[item.sourceType]}</span>
                      </td>
                      <td>
                        <input
                          className={styles.inputSmall}
                          type="text"
                          value={edit.title}
                          aria-label="Tittel"
                          onChange={(e) => patchEdit(key, { title: e.target.value })}
                        />
                        <div className={countClass(edit.title, TITLE_MAX)}>
                          {Array.from(edit.title).length} / {TITLE_MAX}
                        </div>
                      </td>
                      <td>
                        <a
                          className={styles.link}
                          href={edit.destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {edit.destinationUrl}
                        </a>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          aria-expanded={open}
                          onClick={() => setExpanded((prev) => ({ ...prev, [key]: !open }))}
                        >
                          {open ? 'Skjul' : 'Rediger'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className={styles.editRow}>
                        <td colSpan={6}>
                          <div className={styles.editGrid}>
                            <label className={styles.field}>
                              <span>Beskrivelse</span>
                              <textarea
                                className={styles.textarea}
                                value={edit.description}
                                onChange={(e) => patchEdit(key, { description: e.target.value })}
                              />
                              <span className={countClass(edit.description, DESCRIPTION_MAX)}>
                                {Array.from(edit.description).length} / {DESCRIPTION_MAX}
                              </span>
                            </label>
                            <div className={styles.field}>
                              <label className={styles.field} style={{ margin: 0 }}>
                                <span>Nøkkelord (kommaseparert)</span>
                                <input
                                  className={styles.inputSmall}
                                  type="text"
                                  value={edit.keywords}
                                  onChange={(e) => patchEdit(key, { keywords: e.target.value })}
                                />
                              </label>

                              {/* Destination is editable for Pinterest-mappe rows only, and
                                  only to a value the server itself produced. Catalogue rows
                                  keep the link their product owns. */}
                              {item.sourceType === 'blob' && (
                                <label className={styles.field} style={{ margin: 0 }}>
                                  <span>Mål-URL</span>
                                  <select
                                    className={styles.inputSmall}
                                    value={edit.destinationUrl}
                                    onChange={(e) =>
                                      patchEdit(key, { destinationUrl: e.target.value })
                                    }
                                  >
                                    {(preview?.destinationOptions ?? []).map((option) => (
                                      <option key={option.url} value={option.url}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}

                              <span className={styles.counter}>
                                {item.sourceType === 'blob' && (
                                  <>
                                    Blob-sti:{' '}
                                    <span className={styles.link}>
                                      {item.sourceId.replace(/^blob:/, '')}
                                    </span>
                                    <br />
                                  </>
                                )}
                                Bilde: <span className={styles.link}>{item.mediaUrl}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* ── Skipped ─────────────────────────────────────────────────────────────────── */}
      {phase === 'ready' && (preview?.skipped.length ?? 0) > 0 && (
        <div className={styles.notice}>
          <strong>Hoppet over ({preview?.skipped.length})</strong>
          <ul className={styles.skipList}>
            {preview?.skipped.map((s) => (
              <li key={`${s.sourceType}:${s.sourceId}:${s.reason}`}>
                <span className={styles.badge}>{SOURCE_LABEL[s.sourceType]}</span> {s.label} —{' '}
                {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
