import type { CollectionBeforeChangeHook } from 'payload'
import { isAdminUser } from '@/lib/security/staffAccess'

/**
 * Only an administrator assigns or changes a user's role.
 *
 * The `role` field's own access (admin-only create/update, see `Users.ts`) makes it read-only for
 * editors in the admin and strips it from their REST requests. That is not enough on its own:
 * Payload then falls back to the field's default — `admin` — on create. This collection hook runs
 * after defaults are applied, on every path, and settles the role from who is asking:
 *
 *   • an administrator: the role as submitted;
 *   • no user at all: trusted server code or Payload's «create first user» screen (the only way to
 *     reach `users` create without staff access) — the role as submitted;
 *   • anyone else (an editor): a new user is always an `editor`; an existing user keeps the role
 *     already stored. Nothing an editor sends can produce or change a role.
 */
export const enforceUserRole: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (!data || !req.user || isAdminUser(req.user)) return data
  data.role = operation === 'create' ? 'editor' : ((originalDoc as { role?: unknown } | undefined)?.role ?? null)
  return data
}
