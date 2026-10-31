import styles from './demo.module.css'

/** The visible «DEMO» mark every interactive block carries. */
export default function DemoBadge({ children = 'DEMO – ingen data lagres' }: { children?: React.ReactNode }) {
  return (
    <span className={styles.demoBadge}>
      <span className={styles.demoDot} aria-hidden="true" />
      {children}
    </span>
  )
}
