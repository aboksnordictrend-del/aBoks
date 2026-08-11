import type { CollectionConfig, NumberFieldSingleValidation } from 'payload'
import { computeProductCostPrice } from './hooks/productCost'
import { cascadeVariantDisplayNames } from './hooks/cascadeVariantDisplayNames'

/**
 * Whole units, never negative. `min: 0` already covers the lower bound; this adds the integer
 * rule (there is no half a battery pack) and keeps both messages Norwegian. An empty value is
 * accepted and read as 0 by @/lib/stock — a product row written before this column existed
 * has nothing stored, and that must mean "nothing to sell", not "invalid".
 */
const validateStock: NumberFieldSingleValidation = (value) => {
  if (value === null || value === undefined) return true
  if (!Number.isInteger(value)) return 'Lagerbeholdning må være et helt tall.'
  if (value < 0) return 'Lagerbeholdning kan ikke være negativ.'
  return true
}

async function revalidateProduct(slug: string) {
  const { revalidatePath, revalidateTag } = await import('next/cache')
  // Invalidate data cache (all pages using product data, including dynamic product pages)
  revalidateTag('products')
  revalidateTag('product-variants')
  // Invalidate ISR page cache for static pages
  revalidatePath('/', 'page')
  revalidatePath('/produkter', 'page')
  revalidatePath('/tilbehor', 'page')
}

export const Products: CollectionConfig = {
  slug: 'products',
  hooks: {
    beforeChange: [computeProductCostPrice],
    afterChange: [
      async ({ doc }: { doc: any }) => {
        await revalidateProduct(doc.slug)
      },
      cascadeVariantDisplayNames,
    ],
    afterDelete: [
      async ({ doc }: { doc: any }) => {
        await revalidateProduct(doc.slug)
      },
    ],
  },
  admin: {
    useAsTitle: 'title',
    group: 'Butikk',
    defaultColumns: ['title', 'section', 'price', 'published', 'updatedAt'],
    description: 'Administrer produkter i butikken.',
    listSearchableFields: ['title', 'slug'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Produktnavn',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'URL-slug',
      required: true,
      unique: true,
      admin: {
        description: 'Brukes i URL-en: /produkter/[slug]',
      },
    },
    {
      name: 'tagline',
      type: 'text',
      label: 'Kort beskrivelse',
      admin: {
        description: 'Vises under produktnavnet på produktsiden.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Beskrivelse',
      required: true,
    },
    {
      name: 'price',
      type: 'number',
      label: 'Pris (kr)',
      required: true,
      min: 0,
      admin: {
        step: 10,
        description: 'Pris i norske kroner (eks. 499)',
      },
    },
    {
      /**
       * Stock for a product that has NO Product Variants — an accessory such as a battery
       * multipack, which is one sellable thing with one count.
       *
       * A product WITH variants keeps its stock exactly where it has always been, on each
       * variant's own «Lagerbeholdning» (`product-variants.inventory`), and this column is
       * never read for it. The rule is written down once, in @/lib/stock, and every reader
       * goes through it — there is deliberately no product where both sources are in play.
       *
       * The field is hidden in the admin for products that do have variants. That decision
       * cannot be made by `admin.condition`, which only ever sees the current form's own
       * values and knows nothing about rows in another collection, so it is made by the field
       * component below: it asks the API how many variants this product actually has and
       * shows the input only when the answer is none. Asking the database is what makes it
       * reliable — a stale flag on the product could drift the moment a variant is added or
       * deleted, and it would then hide (or offer) the wrong field.
       */
      name: 'stock',
      type: 'number',
      label: 'Lagerbeholdning',
      defaultValue: 0,
      min: 0,
      validate: validateStock,
      admin: {
        step: 1,
        description:
          'Antall enheter på lager. Brukes kun for produkter uten fargevarianter — har produktet varianter, styres lageret på hver variant.',
        components: {
          Field: '@/components/admin/ProductStockField#default',
        },
      },
    },
    {
      type: 'collapsible',
      label: 'Kostnadsberegning',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'costItems',
          type: 'array',
          label: 'Kostnader',
          admin: {
            description: 'Legg til kostnadsposter (uten MVA). Total kostpris regnes ut automatisk som summen.',
          },
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Navn',
              required: true,
              maxLength: 120,
              hooks: {
                // Trim so " Eske " never counts as content and required rejects blanks.
                beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
              },
              admin: { placeholder: 'F.eks. PLA Matte, Eske, Etikett …' },
            },
            {
              name: 'amount',
              type: 'number',
              label: 'Beløp (kr)',
              required: true,
              min: 0,
              admin: { step: 0.5, description: 'Kostnad i NOK, uten MVA.' },
            },
          ],
        },
        {
          name: 'costPrice',
          type: 'number',
          label: 'Total kostpris',
          min: 0,
          admin: {
            readOnly: true,
            description: 'Regnes automatisk ut som summen av alle kostnadsposter (kr, uten MVA).',
          },
        },
      ],
    },
    {
      name: 'images',
      type: 'array',
      label: 'Produktbilder',
      minRows: 1,
      admin: {
        description: 'Første bilde brukes som hovedbilde.',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Bilde',
        },
        {
          name: 'alt',
          type: 'text',
          label: 'Alt-tekst',
        },
      ],
    },
    {
      name: 'capacity',
      type: 'group',
      label: 'Kapasitet',
      fields: [
        {
          name: 'aa',
          type: 'number',
          label: 'AA-batterier',
          defaultValue: 20,
        },
        {
          name: 'aaa',
          type: 'number',
          label: 'AAA-batterier',
          defaultValue: 36,
        },
        {
          name: 'usedCompartments',
          type: 'number',
          label: 'Rom for brukte batterier',
          defaultValue: 1,
        },
      ],
    },
    {
      name: 'features',
      type: 'array',
      label: 'Funksjoner',
      fields: [
        {
          name: 'number',
          type: 'text',
          label: 'Nummer (f.eks. 01)',
        },
        {
          name: 'title',
          type: 'text',
          label: 'Tittel',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
          label: 'Beskrivelse',
          required: true,
        },
      ],
    },
    {
      name: 'details',
      type: 'array',
      label: 'Produktdetaljer (akkordeon)',
      admin: {
        description: 'Seksjoner som vises i akkordeon under kjøpsknappen (f.eks. Beskrivelse, Spesifikasjoner, Frakt og retur). Du kan endre rekkefølge, legge til og slette seksjoner fritt.',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Tittel',
          required: true,
        },
        {
          name: 'content',
          type: 'textarea',
          label: 'Innhold',
          required: true,
        },
      ],
    },
    {
      name: 'faqs',
      type: 'array',
      label: 'Vanlige spørsmål',
      fields: [
        {
          name: 'question',
          type: 'text',
          label: 'Spørsmål',
          required: true,
        },
        {
          name: 'answer',
          type: 'textarea',
          label: 'Svar',
          required: true,
        },
      ],
    },
    {
      /**
       * Cross-sell picks shown in the cart under «Passer godt sammen med».
       *
       * One field covers both catalogues: Tilbehør is not a separate collection — accessories
       * are ordinary `products` rows with `section: 'accessories'` — so a single self-referencing
       * relationship can point at either, and recommendations work in both directions.
       *
       * `hasMany` keeps the admin's ordering (Payload stores the row position in
       * products_rels."order"), and that order is what the cart renders. `filterOptions` drops
       * the product itself from the picker so the most obvious self-reference cannot be made at
       * all; the cart filters the rest (unpublished, deleted, sold out, already in the cart).
       */
      name: 'cartRecommendations',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      label: 'Anbefalte produkter i handlekurven',
      admin: {
        description:
          'Velg produkter som skal vises som anbefalinger når dette produktet ligger i handlekurven.',
      },
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
    },
    {
      name: 'salePrice',
      type: 'number',
      label: 'Tilbudspris (kr)',
      min: 0,
      admin: {
        step: 10,
        description: 'Tilbudspris i kr. Sett lavere enn ordinær pris for å aktivere rabatt. La stå tom for ingen rabatt.',
      },
    },
    {
      name: 'saleStartDate',
      type: 'date',
      label: 'Tilbud gyldig fra',
      admin: {
        description: 'La stå tom for å starte umiddelbart.',
      },
    },
    {
      name: 'saleEndDate',
      type: 'date',
      label: 'Tilbud gyldig til',
      admin: {
        description: 'La stå tom for at tilbudet aldri utløper.',
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Sidetittel',
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Meta-beskrivelse',
        },
      ],
    },
    {
      name: 'section',
      type: 'select',
      label: 'Seksjon',
      required: true,
      defaultValue: 'products',
      options: [
        { label: 'Produkter', value: 'products' },
        { label: 'Tilbehør', value: 'accessories' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Styrer hvor produktet vises: /produkter eller /tilbehor.',
      },
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Publisert',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Kryss av for å vise produktet i butikken.',
      },
    },
  ],
  timestamps: true,
}
