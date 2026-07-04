import type { Metadata } from 'next'
import InspirasjonContent from './_components/InspirasjonContent'
import { getArticlesForPage, getTotalPages } from './_data'

export const metadata: Metadata = {
  title: 'Inspirasjon',
  description:
    'Tips, guider og ideer om batterier, organisering, bærekraft og et ryddig hjem – fra aBoks.',
  alternates: {
    canonical: '/inspirasjon',
  },
  openGraph: {
    title: 'Inspirasjon | aBoks',
    description:
      'Tips, guider og ideer om batterier, organisering, bærekraft og et ryddig hjem – fra aBoks.',
  },
}

export default function InspirasjonPage() {
  const totalPages = getTotalPages()
  const articles = getArticlesForPage(1)

  return <InspirasjonContent articles={articles} currentPage={1} totalPages={totalPages} />
}
