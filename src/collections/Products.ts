import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    group: 'Butikk',
    defaultColumns: ['title', 'price', 'published', 'updatedAt'],
    description: 'Administrer produkter i butikken.',
    listSearchableFields: ['title', 'slug'],
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  versions: {
    drafts: true,
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
        description: 'Brukes i URL-en: /produkt/[slug]',
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
