'use client'

import { useReducedMotion } from 'framer-motion'

/** Motion props for the shared reveal, produced by {@link useRevealFactory}. */
export type RevealProps = ReturnType<ReturnType<typeof useRevealFactory>>

/**
 * The scroll reveal every block on /bedrifter uses. Lives in its own module so the page
 * and the solution section animate from one definition rather than two that drift apart.
 */
export function useRevealFactory() {
  const reduceMotion = useReducedMotion()
  // Motion props stay identical on the server and the client — only the timing changes
  // under reduced motion, so the SSR markup never gets stuck at opacity 0.
  return (delay = 0) => ({
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.65, delay, ease: [0.22, 0.61, 0.36, 1] as const },
  })
}
