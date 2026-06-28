import type { CollectionConfig } from 'payload'

export const ProductVariants: CollectionConfig = {
  slug: 'product-variants',
  hooks: {
    afterChange: [
      async () => {
        const { revalidatePath, revalidateTag } = await import('next/cache')
        // Invalidate data cache (product pages re-fetch fresh variant data on next request)
        revalidateTag('product-variants')
        // Invalidate ISR page cache for static pages
        revalidatePath('/', 'page')
        revalidatePath('/produkter', 'page')
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    group: 'Butikk',
    defaultColumns: ['name', 'colorHex', 'sku', 'inventory', 'product'],
    description: 'Fargevarianter for produkter.',
  },
  access: {
  read: () => true,
  create: () => true,
  update: () => true,
  delete: () => true,
},
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      label: 'Produkt',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Fargenavn (norsk)',
      required: true,
      admin: {
        description: 'F.eks. Olivengrønn, Mørk blå, Sort',
      },
    },
    {
      name: 'colorHex',
      type: 'text',
      label: 'Fargekode (HEX)',
      required: true,
      admin: {
        description: 'F.eks. #5b6347',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Produktbilde for denne fargen',
    },
    {
      name: 'sku',
      type: 'text',
      label: 'SKU / Varenummer',
      required: true,
      unique: true,
    },
    {
      name: 'inventory',
      type: 'number',
      label: 'Lagerbeholdning',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Antall enheter på lager.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      label: 'Rekkefølge',
      defaultValue: 0,
      admin: {
        description: 'Lavere tall vises først.',
      },
    },
    {
      name: 'videoUrl',
      type: 'text',
      label: 'Video URL (mp4)',
      admin: {
        description: 'Full URL til .mp4-produktvideo for denne fargen. La stå tom hvis ingen video.',
      },
    },
  ],
  timestamps: true,
}
