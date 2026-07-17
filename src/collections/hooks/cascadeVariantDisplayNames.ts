import type { CollectionAfterChangeHook } from 'payload'
import { formatVariantDisplayName } from './variantDisplayName'

// When a Product's title changes, refresh the auto-generated `displayName` of every
// variant that belongs to it. Only runs on an actual title change, so ordinary product
// edits do not touch variants. Touches nothing but variant.displayName.
export const cascadeVariantDisplayNames: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc
  const title = (doc as { title?: string }).title
  const prevTitle = (previousDoc as { title?: string } | undefined)?.title
  if (typeof title !== 'string' || title === prevTitle) return doc

  const variants = await req.payload.find({
    collection: 'product-variants',
    where: { product: { equals: doc.id } },
    limit: 1000,
    depth: 0,
  })

  for (const variant of variants.docs) {
    if (typeof variant.name !== 'string') continue
    await req.payload.update({
      collection: 'product-variants',
      id: variant.id,
      data: { displayName: formatVariantDisplayName(title, variant.name) },
      depth: 0,
    })
  }

  return doc
}
