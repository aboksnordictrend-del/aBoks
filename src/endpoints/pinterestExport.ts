// Admin-only Pinterest bulk-upload export.
//
//   GET  /api/admin/integrations/pinterest/export/preview?sources=products,variants,homepage
//   POST /api/admin/integrations/pinterest/export
//
// Security boundary, identical to the other marketing endpoints (see pinterestExpenses.ts):
// an authenticated Payload user with role 'admin', and `overrideAccess: false` on every read.
// No Blob token, customer, order, analytics or marketing-expense data is ever read or
// returned — the only collections touched are `products` and `product-variants`.
//
// The POST deliberately does NOT trust the media or destination URLs in the request body. It
// re-derives the full export server-side and matches each submitted row back by
// `sourceType:sourceId`, taking only the title, description and keywords from the client. A
// Pin can therefore never be pointed at a URL the server did not itself produce.

import type { Endpoint, PayloadRequest } from 'payload'
import { SITE_URL } from '@/lib/site'
import { validateBoardName } from '@/lib/pinterest/export/board'
import { collectExportPreview } from '@/lib/pinterest/export/collect'
import { pinterestCsv, pinterestCsvFilename } from '@/lib/pinterest/export/csv'
import { PINTEREST_ROW_LIMIT } from '@/lib/pinterest/export/items'
import { DESCRIPTION_MAX, TITLE_MAX, normalizeText } from '@/lib/pinterest/export/text'
import { resolveCanonicalBase } from '@/lib/pinterest/export/urls'
import type { PinterestExportItem, PinterestSourceSelection } from '@/lib/pinterest/export/types'

/** 200 rows of edited copy, with headroom. Anything larger is a malformed or hostile body. */
const MAX_BODY_BYTES = 500_000

const ALL_SOURCES: PinterestSourceSelection = { products: true, variants: true, homepage: true }

function requireAdmin(req: PayloadRequest): Response | null {
  if (!req.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((req.user as { role?: string }).role !== 'admin') {
    return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
  }
  return null
}

/** `?sources=products,variants` → selection. Absent or empty means all three. */
export function parseSources(raw: unknown): PinterestSourceSelection {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !value.trim()) return { ...ALL_SOURCES }
  const wanted = new Set(value.split(',').map((s) => s.trim()))
  return {
    products: wanted.has('products'),
    variants: wanted.has('variants'),
    homepage: wanted.has('homepage'),
  }
}

/** The same selection from a JSON body, where it arrives as an object of booleans. */
function parseSourcesObject(raw: unknown): PinterestSourceSelection {
  if (!raw || typeof raw !== 'object') return { ...ALL_SOURCES }
  const obj = raw as Record<string, unknown>
  const pick = (k: keyof PinterestSourceSelection) => obj[k] !== false
  return { products: pick('products'), variants: pick('variants'), homepage: pick('homepage') }
}

/** One row as the preview submits it back. Only the three text fields are honoured. */
interface SubmittedRow {
  sourceType?: unknown
  sourceId?: unknown
  title?: unknown
  description?: unknown
  keywords?: unknown
  enabled?: unknown
}

class BadRequest extends Error {}

async function readBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    if (raw == null) return {}
    if (typeof raw !== 'object') return {}
    if (JSON.stringify(raw).length > MAX_BODY_BYTES) {
      throw new BadRequest('Forespørselen er for stor.')
    }
    return raw as Record<string, unknown>
  } catch (err) {
    if (err instanceof BadRequest) throw err
    throw new BadRequest('Ugyldig forespørsel.')
  }
}

/**
 * Apply the admin's edits to the server-computed items.
 *
 * `submitted` only selects and re-labels; `serverItems` is the sole source of mediaUrl and
 * destinationUrl. Unknown keys are dropped, disabled rows are dropped, and a repeated key is
 * emitted once — so a crafted body cannot smuggle a URL in or pad the file with copies.
 */
export function applySubmittedRows(
  serverItems: readonly PinterestExportItem[],
  submitted: readonly SubmittedRow[],
): PinterestExportItem[] {
  const byKey = new Map(serverItems.map((i) => [`${i.sourceType}:${i.sourceId}`, i]))
  const used = new Set<string>()
  const out: PinterestExportItem[] = []

  for (const row of submitted) {
    if (row.enabled === false) continue
    if (typeof row.sourceType !== 'string' || typeof row.sourceId !== 'string') continue
    const key = `${row.sourceType}:${row.sourceId}`
    const base = byKey.get(key)
    if (!base || used.has(key)) continue
    used.add(key)

    const title = typeof row.title === 'string' ? normalizeText(row.title, TITLE_MAX) : base.title
    out.push({
      ...base,
      // An edit that empties the title would produce an invalid Pin; fall back to the original.
      title: title || base.title,
      description:
        typeof row.description === 'string'
          ? normalizeText(row.description, DESCRIPTION_MAX)
          : base.description,
      keywords:
        typeof row.keywords === 'string'
          ? normalizeText(row.keywords, DESCRIPTION_MAX)
          : base.keywords,
    })
  }

  return out
}

// ── GET /preview ──────────────────────────────────────────────────────────────────────────

export const pinterestExportPreviewEndpoint: Endpoint = {
  path: '/admin/integrations/pinterest/export/preview',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const denied = requireAdmin(req)
    if (denied) return denied

    const query = (req.query ?? {}) as Record<string, unknown>
    const sources = parseSources(query.sources)
    const { baseUrl, fallback } = resolveCanonicalBase(SITE_URL)

    try {
      const preview = await collectExportPreview(req.payload, req.user, {
        baseUrl,
        baseUrlFallback: fallback,
        sources,
      })
      return Response.json({ ...preview, limit: PINTEREST_ROW_LIMIT }, { status: 200 })
    } catch (err) {
      req.payload.logger.error(
        `[pinterest-export] preview failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke bygge Pinterest-eksporten.' }, { status: 500 })
    }
  },
}

// ── POST (CSV download) ───────────────────────────────────────────────────────────────────

export const pinterestExportEndpoint: Endpoint = {
  path: '/admin/integrations/pinterest/export',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    const denied = requireAdmin(req)
    if (denied) return denied

    let body: Record<string, unknown>
    try {
      body = await readBody(req)
    } catch (err) {
      const message = err instanceof BadRequest ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ error: message }, { status: 400 })
    }

    const board = validateBoardName(body.board)
    if (!board.ok) {
      return Response.json({ error: board.error }, { status: 400 })
    }

    const sources = parseSourcesObject(body.sources)
    const { baseUrl, fallback } = resolveCanonicalBase(SITE_URL)

    try {
      const preview = await collectExportPreview(req.payload, req.user, {
        baseUrl,
        baseUrlFallback: fallback,
        sources,
      })

      const submitted = Array.isArray(body.rows) ? (body.rows as SubmittedRow[]) : null
      const chosen = submitted
        ? applySubmittedRows(preview.items, submitted)
        : [...preview.items]

      // preview.items is already capped, but an explicit slice keeps the guarantee local to
      // the thing that writes the file.
      const items = chosen.slice(0, PINTEREST_ROW_LIMIT)
      if (items.length === 0) {
        return Response.json(
          { error: 'Ingen rader å eksportere. Velg minst én kilde eller én rad.' },
          { status: 400 },
        )
      }

      const csv = pinterestCsv(items, board.value)
      const filename = pinterestCsvFilename()

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          'X-Pinterest-Rows': String(items.length),
        },
      })
    } catch (err) {
      req.payload.logger.error(
        `[pinterest-export] csv failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke generere CSV-filen.' }, { status: 500 })
    }
  },
}
