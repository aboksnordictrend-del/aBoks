import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Administrasjon',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Navn',
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rolle',
      defaultValue: 'admin',
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Redaktør', value: 'editor' },
      ],
    },
  ],
}
