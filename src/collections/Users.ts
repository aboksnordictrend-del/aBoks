import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { isAdminUser, isStaffUser, staffOnly } from '@/lib/security/staffAccess'
import { enforceUserRole } from './hooks/userRole'

/**
 * An administrator may change or remove any user. An editor only editor accounts — including
 * their own — so an editor can never take over an administrator by resetting that account's
 * password or e-mail. Everyone else: nothing.
 */
const adminOrEditorTargets: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  if (isStaffUser(req.user)) return { role: { equals: 'editor' } }
  return false
}

const adminOnlyField: FieldAccess = ({ req }) => isAdminUser(req.user)

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Administrasjon',
  },
  auth: true,
  // Explicit, because Payload's default is «any logged-in user» — from ANY auth collection.
  // Staff (admin and editor) keep the access the default gave them, except that an editor cannot
  // touch an administrator account or any role (see `adminOrEditorTargets` and `enforceUserRole`).
  access: {
    admin: ({ req }) => isStaffUser(req.user),
    read: staffOnly,
    create: staffOnly,
    update: adminOrEditorTargets,
    delete: adminOrEditorTargets,
    unlock: staffOnly,
  },
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
      // Read-only for editors in the admin and stripped from their requests; the hook then settles
      // the value, because a stripped field falls back to the default above.
      access: { create: adminOnlyField, update: adminOnlyField },
      admin: {
        description: 'Bare administratorer kan endre rollen. En bruker som opprettes av en redaktør, blir redaktør.',
      },
    },
  ],
  hooks: {
    beforeChange: [enforceUserRole],
  },
}
