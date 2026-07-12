import type { Metadata } from 'next'
import InspirasjonContent from './_components/InspirasjonContent'
import { getArticlesForPage, getTotalPages } from './_data'

export const metadata: Metadata = {
  title: {
    absolute: 'Inspirasjon | Tips om batterier, oppbevaring og miljø',
  },
  description:
    'Artikler og guider fra aBoks om batterier, oppbevaring, gjenvinning og miljø – med praktiske tips til et ryddigere og mer bærekraftig hjem.',
  alternates: {
    canonical: '/inspirasjon',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/inspirasjon',
    title: 'Inspirasjon | Tips om batterier, oppbevaring og miljø',
    description:
      'Guider og artikler om batterier, oppbevaring, gjenvinning og miljø – fra aBoks.',
  },
}

export default function InspirasjonPage() {
  const totalPages = getTotalPages()
  const articles = getArticlesForPage(1)

  return <InspirasjonContent articles={articles} currentPage={1} totalPages={totalPages} />
}
