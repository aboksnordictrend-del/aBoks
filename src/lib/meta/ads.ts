// High-level Meta ads reads. `getMetaDailySpend` returns one normalized row per day for
// the account, either for an explicit inclusive window or for the whole available history
// (date_preset=maximum). Pure enough to test: config and fetch are both injectable.

import { getMetaConfig, type MetaConfig } from './config'
import { metaPaginatedGet, type MetaRequestOptions } from './client'
import { MetaError } from './errors'
import type { MetaDailySpend, MetaInsightsRow } from './types'

const REQUIRED_CURRENCY = 'NOK'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface GetMetaDailySpendArgs {
  /** Inclusive start day, YYYY-MM-DD. Omit together with `until` for full history. */
  since?: string
  /** Inclusive end day, YYYY-MM-DD. */
  until?: string
}

export interface GetMetaDailySpendOptions extends MetaRequestOptions {
  /** Override the env-derived config (used in tests). */
  config?: MetaConfig
}

/** Parse a Meta spend string to a non-negative decimal; invalid/blank → 0. */
function parseSpend(raw: string | undefined): number {
  if (typeof raw !== 'string' || raw.trim() === '') return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  // Meta reports spend already in major currency units with 2 decimals.
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Daily account-level ad spend. Verifies the account currency is NOK and never performs
 * currency conversion — a non-NOK account throws so the caller can stop the import.
 */
export async function getMetaDailySpend(
  { since, until }: GetMetaDailySpendArgs,
  options: GetMetaDailySpendOptions = {},
): Promise<MetaDailySpend[]> {
  const config = options.config ?? getMetaConfig()

  const params: Record<string, string> = {
    fields: 'spend,date_start,date_stop,account_currency',
    level: 'account',
    time_increment: '1',
  }

  if (since && until) {
    params.time_range = JSON.stringify({ since, until })
  } else {
    // Whole available history for the account.
    params.date_preset = 'maximum'
  }

  const rows = await metaPaginatedGet<MetaInsightsRow>(
    config.baseUrl,
    `${config.adAccountId}/insights`,
    params,
    config.accessToken,
    options,
  )

  const out: MetaDailySpend[] = []
  for (const row of rows) {
    const currency = row.account_currency
    if (currency && currency !== REQUIRED_CURRENCY) {
      throw new MetaError(
        `Annonsekontoen rapporterer i ${currency}, ikke ${REQUIRED_CURRENCY}. Import er stoppet — beløp konverteres ikke automatisk.`,
        { message: `unexpected account currency: ${currency}` },
      )
    }

    const date = row.date_start
    if (!date || !DATE_RE.test(date)) continue // a row without a usable day is unusable

    out.push({
      date,
      spend: parseSpend(row.spend),
      currency: currency ?? REQUIRED_CURRENCY,
    })
  }

  return out
}
