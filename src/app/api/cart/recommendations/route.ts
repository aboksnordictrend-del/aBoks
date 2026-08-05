import { type NextRequest, NextResponse } from 'next/server'
import { loadCartRecommendations } from '@/lib/cart/recommendationsServer'

/**
 * GET /api/cart/recommendations?slugs=aboks,aboks-vegg — the «Passer godt sammen med» data.
 *
 * A thin adapter, like the promo-code endpoint next door: it parses the slug list and hands
 * it to `loadCartRecommendations`, which owns the querying, the caching and the availability
 * rules. Read-only, and it returns only catalogue data that is already public on
 * /produkter — no prices are trusted from it (the cart's own line prices and the server's
 * checkout pricing are unchanged), so there is nothing here to authenticate.
 *
 * The client sends product slugs rather than the whole cart: no quantities, no variant ids,
 * no promo code. Only GET is exported, so Next.js answers any other method with 405.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('slugs') ?? ''
  const slugs = raw
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean)

  // An empty cart never reaches here (the client does not fetch), but a hand-made request
  // still gets a well-formed empty catalogue rather than an error.
  if (slugs.length === 0) {
    return NextResponse.json({ recommendationsBySlug: {}, products: {} })
  }

  const catalogue = await loadCartRecommendations(slugs)

  return NextResponse.json(catalogue, {
    // Public catalogue data, already cached server-side for an hour and invalidated by the
    // Payload revalidation hooks. A short browser cache keeps repeat cart visits instant
    // without letting an edit stay stale for long.
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
