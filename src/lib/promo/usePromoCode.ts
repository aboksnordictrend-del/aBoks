'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useCartStore } from '@/store/cart'
import {
  buildValidationRequest,
  cartSignature,
  initialPromoState,
  interpretResponse,
  networkOutcome,
  promoCheckKey,
  promoReducer,
  restoredPromoState,
  type PromoCartItem,
  type PromoState,
  type PromoTotals,
} from './cartPromo'

/**
 * Wires the pure promo state machine in ./cartPromo.ts to React, the cart store and `fetch`.
 *
 * Everything with a decision in it lives in that module; this hook only owns the side
 * effects — issuing the request, debouncing, and keeping the store's persisted code string
 * in step with the state machine.
 */

const ENDPOINT = '/api/promo-codes/validate'

/**
 * One cart action (a click on +) can produce several store updates in quick succession, and
 * a customer adjusting a quantity produces a burst. A short debounce collapses each burst
 * into a single request without being noticeable.
 */
const REVALIDATE_DEBOUNCE_MS = 400

export interface UsePromoCodeResult {
  status: PromoState['status']
  /** The applied code, or null. */
  code: string | null
  /** Trusted server figures — present only while the code is applied. */
  totals: PromoTotals | null
  message: string | null
  busy: boolean
  apply: (code: string) => void
  remove: () => void
}

export function usePromoCode(): UsePromoCodeResult {
  const items = useCartStore((s) => s.items)
  const storedCode = useCartStore((s) => s.promoCode)
  const setPromoCode = useCartStore((s) => s.setPromoCode)
  const clearPromoCode = useCartStore((s) => s.clearPromoCode)

  const [state, dispatch] = useReducer(promoReducer, storedCode, restoredPromoState)

  // Refs so the request function never goes stale and never needs re-creating.
  const stateRef = useRef<PromoState>(initialPromoState)
  stateRef.current = state
  const itemsRef = useRef<PromoCartItem[]>(items)
  itemsRef.current = items

  /** Monotonic request id. Any result whose id is no longer current is discarded. */
  const requestIdRef = useRef(0)
  /** The `code|signature` pair the last issued request covered — stops repeat requests. */
  const lastCheckedRef = useRef<string | null>(null)

  const run = useCallback(async (code: string, requestId: number) => {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Identifiers and quantities only — never a price, name or total. See
        // buildValidationRequest.
        body: JSON.stringify(buildValidationRequest(code, itemsRef.current)),
      })

      let body: unknown = null
      try {
        body = await res.json()
      } catch {
        body = null // a non-JSON response is handled as "no answer"
      }

      dispatch({ type: 'result', requestId, outcome: interpretResponse(res.status, body) })
    } catch {
      // Offline, aborted, DNS — never blamed on the code.
      dispatch({ type: 'result', requestId, outcome: networkOutcome() })
    }
  }, [])

  const apply = useCallback(
    (raw: string) => {
      const code = raw.trim()
      if (!code) return
      // Guarded here as well as in the reducer, so a double click cannot even issue a fetch.
      if (stateRef.current.status === 'checking') return

      const requestId = ++requestIdRef.current
      // Recorded up front so the revalidation effect does not immediately repeat this call.
      lastCheckedRef.current = promoCheckKey(
        code.toUpperCase(),
        cartSignature(itemsRef.current),
      )
      dispatch({ type: 'submit', code, requestId })
      void run(code, requestId)
    },
    [run],
  )

  const remove = useCallback(() => {
    requestIdRef.current += 1 // any in-flight result is now stale
    lastCheckedRef.current = null
    dispatch({ type: 'remove' })
    clearPromoCode()
  }, [clearPromoCode])

  const signature = useMemo(() => cartSignature(items), [items])
  const checkKey = promoCheckKey(state.code, signature)
  const cartIsEmpty = items.length === 0

  // An emptied cart drops the code — there is nothing left for it to apply to.
  useEffect(() => {
    if (!cartIsEmpty) return
    if (!stateRef.current.code && !storedCode) return
    requestIdRef.current += 1
    lastCheckedRef.current = null
    dispatch({ type: 'cartEmptied' })
    clearPromoCode()
  }, [cartIsEmpty, storedCode, clearPromoCode])

  // Revalidate when the cart's contents change under an applied code.
  //
  // Cannot loop: `checkKey` is derived only from the code and the cart, and a result changes
  // neither (except by clearing the code, which makes checkKey null and stops everything).
  // `lastCheckedRef` guarantees each distinct pair is requested at most once.
  useEffect(() => {
    if (!checkKey || cartIsEmpty) return
    if (lastCheckedRef.current === checkKey) return

    const timer = setTimeout(() => {
      const code = stateRef.current.code
      if (!code) return
      lastCheckedRef.current = checkKey
      const requestId = ++requestIdRef.current
      dispatch({ type: 'revalidate', requestId })
      void run(code, requestId)
    }, REVALIDATE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [checkKey, cartIsEmpty, run])

  // Keep the persisted code string in step with the state machine. Only ever the string —
  // no totals, no validation result (see the store's `promoCode` comment).
  useEffect(() => {
    if (state.status === 'applied' && state.code && state.code !== storedCode) {
      setPromoCode(state.code)
      return
    }
    if (state.status === 'error' && storedCode) {
      clearPromoCode()
    }
  }, [state.status, state.code, storedCode, setPromoCode, clearPromoCode])

  return {
    status: state.status,
    code: state.code,
    totals: state.totals,
    message: state.message,
    busy: state.status === 'checking',
    apply,
    remove,
  }
}
