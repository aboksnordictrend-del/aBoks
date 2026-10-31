'use client'

import type { CSSProperties, ReactNode } from 'react'
import { anchorClick } from '@/lib/anchorScroll'

/**
 * An in-page link that scrolls with the site's header-aware smooth scroll (lib/anchorScroll),
 * so the server-rendered sections need no client code of their own.
 */
export default function AnchorLink({
  target,
  className,
  style,
  children,
}: {
  target: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <a href={`#${target}`} data-btn onClick={anchorClick(target)} className={className} style={style}>
      {children}
    </a>
  )
}
