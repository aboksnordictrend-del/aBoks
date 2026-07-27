import { USAGE_MODES, type UsageMode } from './constants'

/**
 * First-launch promo policy.
 *
 * The promo system ships supporting **reusable codes only** — codes with no total or
 * per-customer usage ceiling. Everything else a code can express (active flag, start date,
 * expiry, percentage or fixed discount, minimum amount, product restrictions) is fully
 * supported; only the *counting* modes are not.
 *
 * Why: enforcing "only N ever" or "once per customer" correctly needs either a reservation
 * lifecycle or the acceptance that two simultaneous checkouts can both pay on the last use.
 * Neither is in scope for launch, so rather than shipping a limit that quietly does not hold,
 * those modes are refused outright.
 *
 * This helper is the single authority on that question. It is consulted inside
 * `validatePromoCode`, which every customer-facing path goes through — the admin-side guards
 * are convenience, not enforcement. The database columns stay exactly as Stage 2 created
 * them, so enabling these modes later is a code change, not a migration.
 *
 * Fail-closed by design: anything not positively recognised as unlimited is refused.
 */

/** The subset of a promo-code document this decision depends on. */
export interface PromoCodeLike {
  usageMode?: string | null
  maxUses?: number | null
}

export type PromoUnsupportedReason =
  | 'single_use_not_supported'
  | 'limited_uses_not_supported'
  | 'once_per_customer_not_supported'
  | 'unknown_mode_not_supported'

export type PromoSupportDecision =
  | { supported: true }
  | { supported: false; reason: PromoUnsupportedReason; customerMessage: string }

/**
 * Deliberately identical for every unsupported mode: the customer learns the code cannot be
 * used, and nothing about how our campaign limits are configured.
 */
export const PROMO_UNSUPPORTED_MESSAGE = 'Denne rabattkoden er ikke tilgjengelig akkurat nå.'

const REASON_BY_MODE: Partial<Record<UsageMode, PromoUnsupportedReason>> = {
  single_use_global: 'single_use_not_supported',
  limited: 'limited_uses_not_supported',
  once_per_customer: 'once_per_customer_not_supported',
}

const refuse = (reason: PromoUnsupportedReason): PromoSupportDecision => ({
  supported: false,
  reason,
  customerMessage: PROMO_UNSUPPORTED_MESSAGE,
})

/** True only for a code with no usage ceiling of any kind. */
export function checkPromoLaunchSupport(promo: PromoCodeLike): PromoSupportDecision {
  const raw = promo.usageMode

  // An empty/absent mode is the collection's own default — a plain reusable code.
  const mode: UsageMode = raw == null || raw === '' ? 'unlimited' : (raw as UsageMode)

  if (!USAGE_MODES.includes(mode)) {
    // A value the schema does not know about. Never guess that it means "unlimited".
    return refuse('unknown_mode_not_supported')
  }

  const byMode = REASON_BY_MODE[mode]
  if (byMode) return refuse(byMode)

  // Belt and braces: a positive `maxUses` is a usage ceiling whatever the mode says. A row
  // whose mode was switched back to unlimited while a stale limit remained is exactly the
  // ambiguous case that must fail closed rather than silently become unlimited.
  if (typeof promo.maxUses === 'number' && Number.isFinite(promo.maxUses) && promo.maxUses > 0) {
    return refuse('limited_uses_not_supported')
  }

  return { supported: true }
}

/** The usage modes an admin may currently save. */
export const SUPPORTED_USAGE_MODES: UsageMode[] = USAGE_MODES.filter(
  (mode) => checkPromoLaunchSupport({ usageMode: mode }).supported,
)
