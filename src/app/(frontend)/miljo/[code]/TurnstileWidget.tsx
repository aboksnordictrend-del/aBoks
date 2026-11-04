'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import styles from './miljo.module.css'

// Cloudflare Turnstile, rendered explicitly — one widget per form, addressed by its own id, so
// resetting one form never touches the other. Managed mode with `interaction-only`: most people
// never see it; Cloudflare shows a checkbox only when it is unsure.
//
// `execution: 'execute'`: the challenge starts on the first interaction with the form (or on
// submit), not on page load, so the hidden delivery tab does not keep minting tokens nobody uses.
// A token is single-use: after every submission the form calls `reset()`, and the next submission
// gets a fresh one.

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  execute: (widgetId: string) => void
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

// Other forms declare `window.turnstile` with only `reset`; read it through this local view instead.
const turnstileOf = (): TurnstileApi | undefined => (window as unknown as { turnstile?: TurnstileApi }).turnstile

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__aboksTurnstileReady'
let loading: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  const ready = turnstileOf()
  if (ready) return Promise.resolve(ready)
  if (!loading) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      ;(window as unknown as Record<string, unknown>).__aboksTurnstileReady = () => resolve(turnstileOf()!)
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onerror = () => {
        loading = null
        s.remove()
        reject(new Error('turnstile-load'))
      }
      document.head.appendChild(s)
    })
  }
  return loading
}

export const TURNSTILE_CLIENT_MESSAGES = {
  error: 'Sikkerhetskontrollen kunne ikke fullføres. Sjekk nettforbindelsen og prøv igjen, eller last siden på nytt.',
  unsupported: 'Nettleseren din støttes ikke av sikkerhetskontrollen. Oppdater nettleseren eller prøv en annen.',
  timeout: 'Sikkerhetskontrollen tok for lang tid. Prøv igjen.',
} as const

export interface TurnstileHandle {
  /** Starts the challenge if nothing is running yet. */
  prime(): void
  /** A fresh token: the one in hand, or waits for the challenge (rejects with a Norwegian message). */
  token(timeoutMs?: number): Promise<string>
  /** Discards the used token; the next `prime`/`token` runs a new challenge. */
  reset(): void
}

type Waiter = { resolve: (t: string) => void; reject: (e: Error) => void }

const TurnstileWidget = forwardRef<TurnstileHandle, { siteKey: string; action: string }>(function TurnstileWidget({ siteKey, action }, ref) {
  const box = useRef<HTMLDivElement>(null)
  const api = useRef<TurnstileApi | null>(null)
  const widgetId = useRef<string | null>(null)
  const current = useRef('')
  const running = useRef(false)
  const waiters = useRef<Waiter[]>([])
  const pendingStart = useRef(false)
  const [problem, setProblem] = useState('')

  const settle = (token: string | null, message?: string) => {
    const list = waiters.current
    waiters.current = []
    for (const w of list) {
      if (token) w.resolve(token)
      else w.reject(new Error(message ?? TURNSTILE_CLIENT_MESSAGES.error))
    }
  }

  const start = () => {
    if (current.current || running.current) return
    if (!api.current || !widgetId.current) {
      pendingStart.current = true
      return
    }
    running.current = true
    setProblem('')
    try {
      api.current.execute(widgetId.current)
    } catch {
      running.current = false
      setProblem(TURNSTILE_CLIENT_MESSAGES.error)
      settle(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !box.current) return
        api.current = t
        widgetId.current = t.render(box.current, {
          sitekey: siteKey,
          action,
          appearance: 'interaction-only',
          execution: 'execute',
          'response-field': false,
          'refresh-expired': 'manual',
          callback: (token: string) => {
            running.current = false
            current.current = token
            setProblem('')
            settle(token)
          },
          'expired-callback': () => {
            current.current = ''
          },
          'timeout-callback': () => {
            running.current = false
            current.current = ''
            setProblem(TURNSTILE_CLIENT_MESSAGES.timeout)
            settle(null, TURNSTILE_CLIENT_MESSAGES.timeout)
          },
          'error-callback': () => {
            running.current = false
            current.current = ''
            setProblem(TURNSTILE_CLIENT_MESSAGES.error)
            settle(null)
            return true
          },
          'unsupported-callback': () => {
            setProblem(TURNSTILE_CLIENT_MESSAGES.unsupported)
            settle(null, TURNSTILE_CLIENT_MESSAGES.unsupported)
          },
        })
        if (pendingStart.current) {
          pendingStart.current = false
          start()
        }
      })
      .catch(() => {
        if (!cancelled) setProblem(TURNSTILE_CLIENT_MESSAGES.error)
        settle(null)
      })
    return () => {
      cancelled = true
      if (api.current && widgetId.current) {
        try {
          api.current.remove(widgetId.current)
        } catch {
          /* already gone */
        }
      }
      widgetId.current = null
      settle(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, action])

  useImperativeHandle(ref, () => ({
    prime: start,
    token(timeoutMs = 20_000) {
      if (current.current) return Promise.resolve(current.current)
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.current = waiters.current.filter((w) => w.resolve !== done)
          reject(new Error(TURNSTILE_CLIENT_MESSAGES.timeout))
        }, timeoutMs)
        const done = (t: string) => {
          clearTimeout(timer)
          resolve(t)
        }
        waiters.current.push({
          resolve: done,
          reject: (e) => {
            clearTimeout(timer)
            reject(e)
          },
        })
        start()
      })
    },
    reset() {
      current.current = ''
      running.current = false
      if (api.current && widgetId.current) {
        try {
          api.current.reset(widgetId.current)
        } catch {
          /* widget not rendered */
        }
      }
    },
  }))

  return (
    <div className={styles.turnstile}>
      <div ref={box} />
      {problem && (
        <p className={styles.small} role="status">
          {problem}
        </p>
      )}
    </div>
  )
})

export default TurnstileWidget
