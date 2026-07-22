import type { AdminViewServerProps } from 'payload'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { MarketingExpense } from '@/payload-types'
import { MARKETING_ROUTES, channelTitle } from '@/lib/marketing/channels'
import { formatNOK } from '@/lib/analytics/money'
import styles from './marketing.module.css'

// Custom collection view at /admin/collections/marketing-expenses/all — the full list of
// ALL marketing expenses (manual + imported). This is the "Vis alle kostnader" destination.
// Server-rendered from req.payload (access-controlled: admin-only, like the collection), so
// there is no recursion with the overridden catalog list view. Each row links to the normal
// edit view, and "Ny kostnad" opens the standard create view — full CRUD stays available.
function formatDay(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

export default async function AllExpensesView({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult
  if (!req.user) {
    return (
      <Gutter>
        <h1 className={styles.title}>Ikke tilgang</h1>
        <p>Du må være innlogget som administrator.</p>
      </Gutter>
    )
  }

  const result = await req.payload.find({
    collection: 'marketing-expenses',
    depth: 0,
    limit: 1000,
    sort: '-date',
    overrideAccess: false,
    user: req.user,
  })
  const docs = result.docs as MarketingExpense[]
  const editHref = (id: string | number) => `${MARKETING_ROUTES.catalog}/${id}`

  return (
    <Gutter>
      <Link className={styles.backLink} href={MARKETING_ROUTES.catalog}>
        <span aria-hidden>←</span> Tilbake til markedsføringskanaler
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Alle markedsføringskostnader</h1>
          <p className={styles.subtitle}>
            Manuelle og importerte kostnader for alle kanaler ({result.totalDocs}).
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            className="btn btn--style-primary btn--size-small"
            href={`${MARKETING_ROUTES.catalog}/create`}
          >
            Ny kostnad
          </Link>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className={styles.state}>Ingen markedsføringskostnader er registrert ennå.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Kanal</th>
                <th className={styles.num}>Betalt inkl. MVA</th>
                <th className={styles.num}>Eks. MVA</th>
                <th>Kilde</th>
                <th>Beskrivelse</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link className={styles.rowLink} href={editHref(d.id)}>
                      {formatDay(d.date)}
                    </Link>
                  </td>
                  <td>{channelTitle(d.channel)}</td>
                  <td className={styles.num}>{formatNOK(typeof d.amount === 'number' ? d.amount : 0, 2)}</td>
                  <td className={styles.num}>
                    {formatNOK(typeof d.amountExVat === 'number' ? d.amountExVat : 0, 2)}
                  </td>
                  <td>{d.source === 'meta-api' ? 'Meta API' : 'Manuell'}</td>
                  <td>{d.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Gutter>
  )
}
