import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { getSortedArticles } from './_data'
import {
  articleDocumentTitle,
  buildArticleBreadcrumbJsonLd,
  buildArticleJsonLd,
  buildArticleMetadata,
} from './_seo'
import { absoluteUrl } from '@/lib/site'

const DIR = join(process.cwd(), 'src', 'app', '(frontend)', 'inspirasjon')

const articleFolders = readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && d.name !== 'page')
  .map((d) => d.name)
  .sort()

const source = (slug: string) => readFileSync(join(DIR, slug, 'page.tsx'), 'utf8')

/** The `title` an article passes to buildArticleMetadata — the first title in the file. */
function declaredTitle(slug: string): string {
  const match = source(slug).match(/buildArticleMetadata\(\{[\s\S]*?\btitle:\s*(['"])(.*?)\1/)
  assert.ok(match, `${slug}: no title passed to buildArticleMetadata`)
  return match[2]
}

/** What ends up in <title>, with the root layout's `%s | aBoks` template applied. */
function renderedTitle(title: ReturnType<typeof articleDocumentTitle>): string {
  if (typeof title === 'string') return `${title} | aBoks`
  assert.ok(title && typeof title === 'object' && 'absolute' in title)
  return title.absolute as string
}

describe('/inspirasjon article registry', () => {
  it('has exactly one entry per article folder (the sitemap reads the registry)', () => {
    const registered = getSortedArticles().map((a) => a.slug.replace('/inspirasjon/', '')).sort()
    assert.deepEqual(registered, articleFolders)
  })

  it('gives every article a valid publication date', () => {
    for (const article of getSortedArticles()) {
      assert.match(article.publishedAt, /^\d{4}-\d{2}-\d{2}$/, article.slug)
      assert.ok(!Number.isNaN(new Date(article.publishedAt).getTime()), article.slug)
    }
  })
})

describe('/inspirasjon article titles', () => {
  for (const slug of articleFolders) {
    it(`${slug} carries the brand suffix exactly once`, () => {
      const title = renderedTitle(buildArticleMetadata({ slug, title: declaredTitle(slug), description: 'x' }).title)
      assert.equal(title.split('| aBoks').length - 1, 1, title)
      assert.ok(title.startsWith(declaredTitle(slug).replace(/ \| aBoks$/, '')), 'wording preserved')
    })
  }
})

describe('/inspirasjon article structured data', () => {
  for (const slug of articleFolders) {
    it(`${slug} renders the shared JSON-LD exactly once and nothing hand-written`, () => {
      const page = source(slug)
      assert.equal(page.split(`<ArticleStructuredData slug="${slug}" />`).length - 1, 1)
      assert.equal(page.split('ArticleStructuredData slug=').length - 1, 1)
      assert.ok(!page.includes('application/ld+json'))
    })
  }

  it('builds the Article from registry data only', () => {
    for (const article of getSortedArticles()) {
      const jsonLd = buildArticleJsonLd(article) as Record<string, any>
      assert.equal(jsonLd['@type'], 'Article')
      assert.equal(jsonLd.headline, article.title)
      assert.equal(jsonLd.url, absoluteUrl(article.slug))
      assert.equal(jsonLd.mainEntityOfPage['@id'], absoluteUrl(article.slug))
      assert.equal(jsonLd.datePublished, article.publishedAt)
      assert.equal('dateModified' in jsonLd, Boolean(article.updatedAt))
      assert.equal(jsonLd.publisher.name, 'ABOKS AS')
      assert.equal(jsonLd.author['@type'], 'Organization', 'no invented person as author')
      if (article.image) assert.equal(jsonLd.image.url, article.image)
      else assert.equal(jsonLd.image, undefined)
    }
  })

  it('states dateModified only when a revision date is recorded', () => {
    const [article] = getSortedArticles()
    assert.equal((buildArticleJsonLd({ ...article, updatedAt: '2026-10-29' }) as any).dateModified, '2026-10-29')
  })

  it('leaves out an image that is not an absolute URL', () => {
    const [article] = getSortedArticles()
    assert.equal((buildArticleJsonLd({ ...article, image: '/relative.webp' }) as any).image, undefined)
  })

  it('builds the Hjem / Inspirasjon / article trail', () => {
    const [article] = getSortedArticles()
    const crumbs = buildArticleBreadcrumbJsonLd(article)
    assert.equal(crumbs['@type'], 'BreadcrumbList')
    assert.deepEqual(
      crumbs.itemListElement.map((c: any) => [c.position, c.name, c.item]),
      [
        [1, 'Hjem', absoluteUrl('/')],
        [2, 'Inspirasjon', absoluteUrl('/inspirasjon')],
        [3, article.title, undefined],
      ],
    )
  })
})
