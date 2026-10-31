import type { CategoryOption } from '@/lib/miljo/policy'
import styles from './miljo.module.css'

/**
 * «Slik leverer du batterier trygt». Lists only the types this organisation's form offers as
 * accepted, names what aBoks XL does NOT take (9V and lithium, also in AA/AAA size), and always
 * defers to the label on the container. Never suggests that any other type may go in.
 */
export default function SafetyInstructions({ categories }: { categories: CategoryOption[] }) {
  const accepted = categories.map((c) => (c.value === 'other' && c.description ? `${c.label} (${c.description})` : c.label))
  const list =
    accepted.length <= 1 ? accepted.join('') : `${accepted.slice(0, -1).join(', ')} og ${accepted[accepted.length - 1]}`

  return (
    <details className={`${styles.card} ${styles.safety}`}>
      <summary>Slik leverer du batterier trygt</summary>
      <ul>
        {list && (
          <li>
            Legg bare disse batteritypene i beholderen: <strong>{list}</strong>.
          </li>
        )}
        <li>
          <span className={styles.notAccepted}>aBoks XL tar ikke imot 9V-batterier eller litiumbatterier</span> — heller ikke
          litiumbatterier i AA- eller AAA-størrelse. Lever dem der batterier selges, eller på en gjenvinningsstasjon.
        </li>
        <li>
          Batterier som er skadet, oppsvulmet, lekker eller blir varme, skal ikke legges i beholderen. Lever dem på en
          gjenvinningsstasjon.
        </li>
        <li>Batterier som sitter fast i et produkt, leveres sammen med produktet som EE-avfall.</li>
        <li>Er du usikker på hvilken type batteriet er, skal det ikke i beholderen. Følg alltid merkingen på beholderen.</li>
      </ul>
    </details>
  )
}
