import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { adminOnly, isAdminUser, isStaffUser, staffOnly } from '@/lib/security/staffAccess'
import { enforceUserRole } from './hooks/userRole'

/**
 * An administrator may change any user. An editor only their own account — so an editor can never
 * take over an administrator (or another editor) by resetting that account's password or e-mail.
 * Their own role stays out of reach (field access + `enforceUserRole`), and Payload's internal auth
 * fields (hash, salt, login attempts, lock, reset token) are closed to writes by Payload itself.
 * Everyone else: nothing.
 */
const adminOrSelf: Access = ({ req }) => {
  if (!isStaffUser(req.user)) return false
  return isAdminUser(req.user) ? true : { id: { equals: req.user.id } }
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
  //
  // Only administrators create and delete users; an editor reads the list and edits their own
  // profile. `create` and `delete` are plain booleans on purpose: Payload hides «Create New» and
  // «Delete» for a `false`, but grants list-level permission — and shows the buttons — for any
  // `Where` result, even where the server would then refuse the documents.
  access: {
    admin: ({ req }) => isStaffUser(req.user),
    read: staffOnly,
    create: adminOnly,
    update: adminOrSelf,
    delete: adminOnly,
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
        description: 'Bare administratorer kan endre rollen.',
      },
    },
  ],
  hooks: {
    beforeChange: [enforceUserRole],
  },
}
