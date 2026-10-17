'use client'

import type { DefaultCellComponentProps } from 'payload'
import { DefaultCell } from '@payloadcms/ui'

/**
 * List cell for `partner-payouts.promoCode`, used both in the Partnerutbetalinger list and in the
 * «Utbetalinger» join list on a partner.
 *
 * Payload's relationship cell only understands a bare id or a `{ relationTo, value }` pair. In the
 * partner's join list the payout rows arrive with `promoCode` already populated as the promo-code
 * document, which that cell cannot read, so it printed «<No Rabattkode>» although the link is
 * stored. This normalises every shape to the bare id and hands it back to Payload's own cell, so
 * the code is looked up and labelled exactly as in any other list — batched, no query per row.
 */

/** A relationship cell value in any shape Payload hands over → the related id, or null. */
export function promoCodeIdOf(value: unknown): number | string | null {
  if (typeof value === 'number' || (typeof value === 'string' && value !== '')) return value
  if (value && typeof value === 'object') {
    const v = value as { id?: unknown; value?: unknown }
    // `{ relationTo, value }` — `value` may itself be an id or a populated document.
    if ('value' in v) return promoCodeIdOf(v.value)
    if (typeof v.id === 'number' || (typeof v.id === 'string' && v.id !== '')) return v.id
  }
  return null
}

export default function PromoCodeCell(props: DefaultCellComponentProps) {
  const id = promoCodeIdOf(props.cellData)
  // A referral payout has no promo code by design; Payload would print «<No Rabattkode>», which
  // reads like missing data. A dash says "not applicable".
  if (id == null) return <span>—</span>
  return <DefaultCell {...props} cellData={id} />
}
