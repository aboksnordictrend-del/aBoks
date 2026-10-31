'use client'

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from 'react'
import type { RegistrationLine } from '@/lib/miljo/validation'
import { demoReducer, demoStatistics, seedState, type DemoAction, type DemoState, type DemoStatistics } from './demoModel'

/** The last thing the visitor did, so the statistics can say what just changed. */
export type DemoChange = { kind: 'registration' | 'delivery' | 'reset'; text: string; at: number } | null

interface DemoContextValue {
  state: DemoState
  stats: DemoStatistics
  lastChange: DemoChange
  register: (lines: RegistrationLine[], total: number) => void
  deliver: (delivery: Extract<DemoAction, { type: 'deliver' }>['delivery'], text: string) => void
  reset: () => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

/**
 * One local state for the three demos — registration, delivery and statistics react to each
 * other. React state only: no request, no storage; a reload starts again from the sample data.
 */
export default function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, () => seedState(new Date()))
  const [lastChange, setLastChange] = useState<DemoChange>(null)
  const stats = useMemo(() => demoStatistics(state, new Date()), [state])

  const register = useCallback((lines: RegistrationLine[], total: number) => {
    dispatch({ type: 'register', lines, at: new Date().toISOString() })
    setLastChange({ kind: 'registration', text: `${total} ${total === 1 ? 'batteri' : 'batterier'} registrert i demoen`, at: Date.now() })
  }, [])

  const deliver = useCallback((delivery: Extract<DemoAction, { type: 'deliver' }>['delivery'], text: string) => {
    dispatch({ type: 'deliver', delivery })
    setLastChange({ kind: 'delivery', text, at: Date.now() })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'reset', now: new Date() })
    setLastChange({ kind: 'reset', text: 'Demoen er nullstilt til eksempeldataene', at: Date.now() })
  }, [])

  const value = useMemo(() => ({ state, stats, lastChange, register, deliver, reset }), [state, stats, lastChange, register, deliver, reset])
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
