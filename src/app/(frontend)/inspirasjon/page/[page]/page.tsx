import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import InspirasjonContent from '../../_components/InspirasjonContent'
import { getArticlesForPage, getTotalPages } from '../../_data'

type Props = {
  params: Promise<{ page: string }>
}

export function generateStaticParams() {
  const totalPages = getTotalPages()
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    page: String(i + 2),
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params

  return {
    title: `Inspirasjon – side ${page}`,
    alternates: {
      canonical: `/inspirasjon/page/${page}`,
    },
  }
}

export default async function InspirasjonPaginatedPage({ params }: Props) {
  const { page: pageParam } = await params
  const page = Number(pageParam)
  const totalPages = getTotalPages()

  if (!Number.isInteger(page)) notFound()
  if (page === 1) redirect('/inspirasjon')
  if (page < 1 || page > totalPages) notFound()

  const articles = getArticlesForPage(page)

  return <InspirasjonContent articles={articles} currentPage={page} totalPages={totalPages} />
}
