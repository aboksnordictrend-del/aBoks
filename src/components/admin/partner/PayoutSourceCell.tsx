'use client'

import type { DefaultCellComponentProps } from 'payload'
import { PAYOUT_SOURCE_OPTIONS } from '@/lib/partner/constants'

/**
 * List cell for `partner-payouts.source`. Payouts written before sources existed store NULL and
 * are promo-code payouts; this labels them so instead of leaving the column blank.
 */

const LABEL = new Map(PAYOUT_SOURCE_OPTIONS.map((o) => [o.value as string, o.label]))

export function payoutSourceLabel(value: unknown): string {
  if (value == null || value === '') return LABEL.get('promoCode')!
  return LABEL.get(String(value)) ?? String(value)
}

export default function PayoutSourceCell({ cellData }: DefaultCellComponentProps) {
  return <span>{payoutSourceLabel(cellData)}</span>
}
