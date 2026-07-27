/**
 * Deterministic allocation of one order-level discount across the cart lines it applies to.
 *
 * Needed whichever way the discount finally reaches Kustom: as a separate negative line the
 * per-line split still has to be stored on the order so revenue and profit land on the right
 * product/variant; as allocated line discounts it *is* what gets sent. Same function either
 * way, so the two can never drift apart.
 *
 * ── Method: largest remainder (Hamilton) in integer øre ──
 *
 * The obvious approach — round each line's proportional share independently — does not work:
 * three equal lines sharing a 100 øre discount each want 33.33 øre, and any independent
 * rounding gives 99 or 102, not 100. The customer would then be charged a total that does
 * not match the discount shown.
 *
 * Largest remainder fixes that by construction:
 *
 *   1. Give every line the *floor* of its exact share, computed with integer arithmetic:
 *          floor_i = ⌊ discount × amount_i / totalEligible ⌋
 *      Because both operands are integers, `discount × amount_i` is exact — the intermediate
 *      never leaves the safe-integer range for realistic carts (a 10 000 kr line against a
 *      10 000 kr discount is ~1e12, well under 2^53).
 *
 *   2. The floors always sum to at most the discount, and are short by fewer øre than there
 *      are lines. Hand out those leftover øre one at a time, to the lines whose *remainder*
 *          rem_i = (discount × amount_i) mod totalEligible
 *      is largest — ties broken by original index, so the result is identical for identical
 *      input, run after run, machine after machine.
 *
 * The sum is therefore exactly the discount, every time, with no floating point anywhere in
 * the loop. Two invariants hold by construction and are asserted by the tests:
 *   • Σ allocations === discount (after the discount is capped at the eligible subtotal)
 *   • allocation_i ≤ amount_i   (no line is ever discounted below zero)
 */

/** One line that may receive part of the discount. `amountOere` is its full line total. */
export interface AllocatableLine {
  /** Caller's identifier — echoed back so the result can be matched to the cart line. */
  key: string
  amountOere: number
}

export interface AllocationEntry {
  key: string
  /** This line's share of the discount, in øre. Never greater than the line's own total. */
  discountOere: number
}

export interface AllocationResult {
  entries: AllocationEntry[]
  /** Σ of the entries. Equals the requested discount once capped at the eligible subtotal. */
  totalAllocatedOere: number
}

/**
 * Splits `totalDiscountOere` across `lines`.
 *
 * A discount larger than the lines can absorb is capped at their combined total — the caller
 * is expected to have capped it already, but a 100 kr fixed discount on an 80 kr eligible
 * subtotal must produce 80 kr and never a negative line.
 */
export function allocateDiscount(
  lines: AllocatableLine[],
  totalDiscountOere: number,
): AllocationResult {
  const entries: AllocationEntry[] = lines.map((line) => ({ key: line.key, discountOere: 0 }))

  if (!Number.isFinite(totalDiscountOere) || totalDiscountOere <= 0 || lines.length === 0) {
    return { entries, totalAllocatedOere: 0 }
  }

  // Negative or non-integer line amounts are treated as zero rather than trusted; a corrupt
  // line must not be able to hand itself a discount.
  const amounts = lines.map((line) =>
    Number.isInteger(line.amountOere) && line.amountOere > 0 ? line.amountOere : 0,
  )
  const totalEligible = amounts.reduce((sum, a) => sum + a, 0)
  if (totalEligible <= 0) return { entries, totalAllocatedOere: 0 }

  const discount = Math.min(Math.floor(totalDiscountOere), totalEligible)

  // Step 1 — exact integer floors, and the remainder that decides who gets the leftovers.
  const remainders: { index: number; rem: number }[] = []
  let allocated = 0
  for (let i = 0; i < amounts.length; i++) {
    const numerator = discount * amounts[i]
    const share = Math.floor(numerator / totalEligible)
    entries[i].discountOere = share
    allocated += share
    remainders.push({ index: i, rem: numerator % totalEligible })
  }

  // Step 2 — distribute the shortfall, largest remainder first, index as the tie-break.
  let leftover = discount - allocated
  if (leftover > 0) {
    const order = remainders
      .slice()
      .sort((a, b) => (b.rem - a.rem) || (a.index - b.index))

    // A line already at its own total cannot take another øre; skipping it is what keeps
    // `allocation ≤ amount` true. With the discount capped at the eligible subtotal there is
    // always enough headroom overall, so the loop can always place every leftover øre.
    for (const { index } of order) {
      if (leftover === 0) break
      if (entries[index].discountOere < amounts[index]) {
        entries[index].discountOere += 1
        leftover -= 1
      }
    }
  }

  const totalAllocatedOere = entries.reduce((sum, e) => sum + e.discountOere, 0)
  return { entries, totalAllocatedOere }
}
