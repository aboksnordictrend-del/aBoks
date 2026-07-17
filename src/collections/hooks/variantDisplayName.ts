import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

// Auto-generated variant title: "Produktnavn – Fargenavn" (e.g. "aBoks Mini – Creme").
// Computed server-side on every write so it is never user-editable and a client-supplied
// value is ignored. Color variants of different products no longer collide as "Sort" etc.

interface VariantData {
  product?: number | { id: number; title?: string | null } | null
  name?: string | null
  displayName?: string | null
}

/** Pure formatter — unit-tested. */
export function formatVariantDisplayName(title: string, colorName: string): string {
  return `${title.trim()} – ${colorName.trim()}`
}

function idOf(rel: VariantData['product']): number | null {
  if (rel == null) return null
  if (typeof rel === 'number') return rel
  if (typeof rel === 'object' && typeof rel.id === 'number') return rel.id
  return null
}

/** Product title from an already-populated relationship, or a single lookup by id. */
async function resolveProductTitle(req: PayloadRequest, product: VariantData['product']): Promise<string | null> {
  if (product && typeof product === 'object' && typeof product.title === 'string') {
    return product.title // already populated — no extra query
  }
  const id = idOf(product)
  if (id == null) return null
  const doc = await req.payload.findByID({ collection: 'products', id, depth: 0 })
  return typeof doc?.title === 'string' ? doc.title : null
}

export const computeVariantDisplayName: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  // Fall back to the stored values so a partial update (that omits product or name) still
  // recomputes from the correct current data instead of wiping the title.
  const product = (data?.product ?? originalDoc?.product) as VariantData['product']
  const colorName = ((data?.name ?? originalDoc?.name) as string | null | undefined) ?? ''

  const title = await resolveProductTitle(req, product)
  if (title && colorName) {
    data.displayName = formatVariantDisplayName(title, colorName)
  } else if (colorName) {
    // Product not resolvable (shouldn't happen — it is required) — keep something useful.
    data.displayName = colorName.trim()
  }

  return data
}
