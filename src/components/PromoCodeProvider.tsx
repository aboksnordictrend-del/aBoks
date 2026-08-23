'use client'

import { createContext, useContext } from 'react'
import { usePromoCode, type UsePromoCodeResult } from '@/lib/promo/usePromoCode'

/**
 * One promo-code state for the whole site.
 *
 * `usePromoCode` owns an applied code, its trusted server totals and the in-flight validation
 * request. Calling it twice — once on /handlekurv and once in the slide-out cart — would mean
 * two hooks racing over one code: two requests per cart change, and, worse, a removal in one
 * view that the other never hears about (only the persisted *string* is shared through the
 * store, not the state machine). This provider calls it exactly once and hands the single
 * result to both views, so «Fjern» in the drawer empties the cart page's field too and a code
 * applied on the cart page is already applied when the drawer opens.
 *
 * Mounted in the frontend layout, above both the drawer and the page. Living there also means
 * the state outlives the drawer's contents, which only exist while it is open — reopening the
 * drawer shows the applied code and its `Rabatt` row immediately, with no re-check.
 *
 * It holds no state of its own and computes nothing: the discount is still the server's
 * number, copied through `usePromoCode` unchanged.
 */

const PromoCodeContext = createContext<UsePromoCodeResult | null>(null)

export default function PromoCodeProvider({ children }: { children: React.ReactNode }) {
  const promo = usePromoCode()
  return <PromoCodeContext.Provider value={promo}>{children}</PromoCodeContext.Provider>
}

/**
 * The shared promo state.
 *
 * Throws rather than falling back to a private `usePromoCode()`: a silent fallback is exactly
 * the second, independent state this provider exists to prevent, and it would fail as a
 * desync in production rather than as an error the first time anyone rendered the tree.
 */
export function useSharedPromoCode(): UsePromoCodeResult {
  const promo = useContext(PromoCodeContext)
  if (!promo) {
    throw new Error('useSharedPromoCode must be used inside <PromoCodeProvider>')
  }
  return promo
}
