'use client'

import { useState, useEffect, useRef } from 'react'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface Props {
  endDate: string
  startDate: string
  onExpire?: () => void
  variant?: 'light' | 'dark'
  align?: 'left' | 'center'
}

function calcRemaining(endMs: number): TimeLeft | null {
  const diff = endMs - Date.now()
  if (diff <= 0) return null
  const s = Math.floor(diff / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

export default function SaleCountdown({
  endDate,
  startDate,
  onExpire,
  variant = 'light',
  align = 'center',
}: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })

  useEffect(() => {
    const endMs = new Date(endDate).getTime()
    const startMs = new Date(startDate).getTime()
    if (isNaN(endMs) || isNaN(startMs)) return
    if (Date.now() < startMs) return

    let id: ReturnType<typeof setInterval>

    const tick = () => {
      const tl = calcRemaining(endMs)
      setTimeLeft(tl)
      if (tl === null) {
        clearInterval(id)
        onExpireRef.current?.()
      }
    }

    tick()
    id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endDate, startDate])

  if (!timeLeft) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const isDark = variant === 'dark'
  const isLeft = align === 'left'

  const units = [
    { v: timeLeft.days,    l: timeLeft.days === 1 ? 'dag' : 'dager' },
    { v: timeLeft.hours,   l: timeLeft.hours === 1 ? 'time' : 'timer' },
    { v: timeLeft.minutes, l: 'min' },
    { v: timeLeft.seconds, l: 'sek' },
  ]

  return (
    <div style={isLeft ? { display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
      <p
        style={{
          fontFamily: 'var(--font-manrope)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255,255,255,0.65)' : '#6b6f63',
          margin: '0 0 8px',
          textAlign: 'center',
          width: isLeft ? '100%' : undefined,
        }}
      >
        Tilbudet avsluttes om
      </p>
      <div style={{ display: 'flex', gap: 'clamp(10px,2.5vw,22px)', justifyContent: isLeft ? 'flex-start' : 'center' }}>
        {units.map(({ v, l }) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px' }}>
            <span
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 600,
                fontSize: 'clamp(20px,2.2vw,28px)',
                lineHeight: 1,
                color: isDark ? '#fff' : '#39402c',
                letterSpacing: '-0.01em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pad(v)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isDark ? 'rgba(255,255,255,0.5)' : '#9a9488',
                marginTop: '3px',
              }}
            >
              {l}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
