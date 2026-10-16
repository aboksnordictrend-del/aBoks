import { STANDARD_EARNING_METHODS, STANDARD_METHODS_NOTE } from '@/lib/partner/partnerships'
import styles from './partner.module.css'

/**
 * «Standard partnerfordeler» on the partner edit page.
 *
 * Information only — there is nothing to tick. Every partner has Promokode, Bedriftssalg and
 * Forhandlersalg under the one partner agreement. The percentages are the `/bli-partner`
 * programme constants; the Promokode rate that is actually paid is set on each promo code.
 */
export default function StandardPartnerBenefits() {
  return (
    <div className={styles.benefits}>
      <h3 className={styles.subheading}>Standard partnerfordeler</h3>
      <p className={styles.intro}>{STANDARD_METHODS_NOTE}</p>
      <ul className={styles.benefitList}>
        {STANDARD_EARNING_METHODS.map((method) => (
          <li key={method.id} className={styles.benefitRow}>
            <div className={styles.benefitTitle}>
              {method.label} — {method.commissionPercent} % provisjon
            </div>
            <div className={styles.benefitText}>{method.description}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
