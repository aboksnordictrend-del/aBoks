import { formatInt, formatNOK } from '@/lib/analytics/money'
import type { PartnerStatistics } from '@/lib/partner/statistics'
import styles from './partner.module.css'

/**
 * The four headline figures. Every value arrives already computed by the server — nothing
 * here adds, filters or converts anything.
 */
export default function PartnerSummaryCards({ stats }: { stats: PartnerStatistics }) {
  const cards: {
    title: string
    value: string
    help: string
    highlight?: boolean
  }[] = [
    {
      title: 'Bruk',
      value: formatInt(stats.counts.valid),
      help: 'Gyldige partnerkjøp',
    },
    {
      title: 'Omsetning',
      value: formatNOK(stats.revenue, 2),
      help: 'Gyldig omsetning',
    },
    {
      title: 'Opptjent provisjon',
      value: formatNOK(stats.balance.earnedCommission, 2),
      help: 'Totalt opptjent',
    },
    {
      title: 'Til utbetaling',
      value: formatNOK(stats.balance.availableToPay, 2),
      help: 'Gjenstår å betale',
      highlight: true,
    },
  ]

  return (
    <div className={styles.cards}>
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${styles.card} ${card.highlight ? styles.cardHighlight : ''}`}
        >
          <div className={styles.cardTitle}>{card.title}</div>
          <div className={styles.cardValue}>{card.value}</div>
          <div className={styles.cardHelp}>{card.help}</div>
        </div>
      ))}
    </div>
  )
}
