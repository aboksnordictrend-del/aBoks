import type { CollectionBeforeChangeHook } from 'payload'
import { round2 } from '@/lib/analytics/money'

// costPrice (Total kostpris) is a derived value: the sum of every costItems[].amount.
// It is recomputed on the server for every write, so a client-supplied costPrice is
// always ignored, and the read-only admin field can never drift from the cost items.

interface CostItemLike {
  amount?: unknown
}

/** Sum of valid, non-negative, finite amounts. Empty/invalid → 0. Pure & unit-tested. */
export function computeCostPriceFromItems(items: unknown): number {
  if (!Array.isArray(items)) return 0
  let sum = 0
  for (const item of items as CostItemLike[]) {
    const raw = item?.amount
    const amount = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(amount) && amount > 0) sum += amount
  }
  return round2(sum)
}

export const computeProductCostPrice: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  // A partial update may omit costItems — fall back to the stored array so costPrice is
  // never wiped to 0 by a write that never touched the cost items.
  const items = data?.costItems ?? originalDoc?.costItems
  data.costPrice = computeCostPriceFromItems(items)
  return data
}
