'use client'

import { motion, useReducedMotion } from 'framer-motion'

/**
 * The single scroll animation used on /historien: content lifts into place as it enters the
 * viewport. Same easing and distance as the homepage sections, so the story page moves like
 * the rest of the site.
 *
 * Honours `prefers-reduced-motion` by rendering the end state immediately.
 *
 * Deliberately *not* `once: true`, which is what the homepage uses. This page is ~19 000px
 * tall and lazy-loads two dozen photos, so blocks reflow downward while you are still
 * scrolling. Dragging the scrollbar down a page this long can carry a block past the trigger
 * band without an intersection callback ever firing for it — and with a one-shot reveal that
 * block then stays at `opacity: 0` for the rest of the visit, hiding a chunk of the story.
 * Letting the animation track the viewport state instead makes it self-healing: whatever is
 * on screen is always visible. The fade-out only ever happens off screen, so nothing about
 * it is visible to the reader.
 *
 * The 200px margin widens the trigger band past the viewport edges, so a block is already
 * settled by the time it is properly in frame and can never flicker at the boundary.
 */
const VIEWPORT = { margin: '200px 0px 200px 0px' } as const

export default function Reveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }
      }
    >
      {children}
    </motion.div>
  )
}
