'use client'
import { useEffect } from 'react'

export default function TouchPressManager() {
  useEffect(() => {
    let pressed: Element | null = null

    const clear = () => {
      if (pressed) {
        pressed.classList.remove('is-pressed')
        pressed = null
      }
    }

    const onStart = (e: TouchEvent) => {
      clear()
      const el = (e.target as Element)?.closest('a[href], button, [role="button"]')
      if (!el) return
      pressed = el
      el.classList.add('is-pressed')
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', clear, { passive: true })
    document.addEventListener('touchcancel', clear, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', clear)
      document.removeEventListener('touchcancel', clear)
    }
  }, [])

  return null
}
