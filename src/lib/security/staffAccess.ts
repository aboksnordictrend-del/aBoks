import type { Access, FieldAccess } from 'payload'

/**
 * Who counts as ABOKS AS staff — the one place every access rule and admin endpoint asks.
 *
 * `req.user` alone is not enough. Payload sets it for a login through ANY auth-enabled
 * collection, so a plain `!!req.user` would also let in an account from a future customer-facing
 * auth collection (e.g. Miljøregistrering organisation accounts). Staff are therefore:
 *
 *   • authenticated through the `users` collection — the admin panel's user collection.
 *     Payload stamps `user.collection` on every strategy (JWT, API key, login, refresh), so it
 *     is always present on a real request;
 *   • with an explicit staff role. `admin` and `editor` are the only two; a `users` row with no
 *     role, or any other value, is refused — fail closed.
 *
 * `isAdminUser` is the stricter check for what was already `role === 'admin'` (deletes,
 * Miljøregistrering, marketing settings, …). Editors keep exactly what they had: everything
 * previously open to any logged-in user, nothing that required the admin role.
 *
 * Both are type guards, so `if (!isStaffUser(req.user)) return …` narrows `req.user` like the
 * `if (!req.user)` checks they replace.
 */

export const STAFF_COLLECTION = 'users'
export const STAFF_ROLES = ['admin', 'editor'] as const

type Principal = { collection?: unknown; role?: unknown }

export function isStaffUser<T>(user: T): user is NonNullable<T> {
  if (!user || typeof user !== 'object') return false
  const { collection, role } = user as Principal
  return collection === STAFF_COLLECTION && (STAFF_ROLES as readonly unknown[]).includes(role)
}

export function isAdminUser<T>(user: T): user is NonNullable<T> {
  return isStaffUser(user) && (user as Principal).role === 'admin'
}

/** Collection / global access: any staff user (admin or editor). */
export const staffOnly: Access = ({ req }) => isStaffUser(req.user)

/** Collection / global access: staff with the admin role. */
export const adminOnly: Access = ({ req }) => isAdminUser(req.user)

/** Field access: any staff user. */
export const staffOnlyField: FieldAccess = ({ req }) => isStaffUser(req.user)
