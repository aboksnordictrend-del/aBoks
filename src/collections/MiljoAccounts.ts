import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { MILJO_ADMIN_GROUP } from '@/lib/miljo/constants'
import {
  BUSINESS_CUSTOMERS_SLUG,
  MILJO_ACCOUNTS_SLUG,
  MILJO_ACCOUNT_STATUS_OPTIONS,
} from '@/lib/miljo/business'
import { resolveAuthorizedBusinessCustomerId } from '@/lib/miljo/businessAccess'
import { adminOnly, isAdminUser } from '@/lib/security/staffAccess'
import { enforceMiljoAccountRules, guardMiljoAccountOperations, refuseInactiveLogin } from './hooks/miljoAccount'

/**
 * Miljø accounts («Miljøkontoer») — the ONE shared login a business customer uses to manage its
 * Miljøregistrering. Employees keep using the public QR page; they never need an account.
 *
 * A Payload auth collection of its own (e-mail + password, Payload's hashing, login attempts and
 * lockout). It is never staff: every internal rule requires the `users` collection
 * (@/lib/security/staffAccess), and `access.admin` keeps it out of the admin panel.
 *
 * ── Stage 1 ──
 *
 * Only an administrator creates, changes or deletes accounts; there is no public sign-up, and
 * password reset is closed until the registration flow (with its e-mails) exists. An account can
 * sign in, refresh its token and see data only while it is «Aktiv», its e-mail is verified
 * (`emailVerifiedAt`, system-written — set by the verification flow in a later stage) AND its
 * business customer is «Aktiv»; all three are re-checked on every request, see
 * @/lib/miljo/businessAccess and `./hooks/miljoAccount`.
 *
 * A signed-in account reads its own account document and its own business customer, nothing else.
 */

const adminOrSelf: Access = async ({ req }) => {
  if (isAdminUser(req.user)) return true
  if ((await resolveAuthorizedBusinessCustomerId(req)) == null) return false
  return { id: { equals: (req.user as { id: number | string }).id } }
}

/** System-written (verification flow, or trusted server code with overrideAccess). */
const systemOnly: FieldAccess = () => false

export const MiljoAccounts: CollectionConfig = {
  slug: MILJO_ACCOUNTS_SLUG,
  labels: { singular: 'Miljøkonto', plural: 'Miljøkontoer' },
  admin: {
    useAsTitle: 'email',
    group: MILJO_ADMIN_GROUP,
    defaultColumns: ['email', 'businessCustomer', 'status', 'emailVerifiedAt'],
    description:
      'Felles innlogging for en bedriftskunde i Miljøregistrering. Kan bare logge inn når kontoen er aktiv og e-posten er bekreftet.',
  },
  auth: {
    tokenExpiration: 2 * 60 * 60,
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    useAPIKey: false,
    cookies: {
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  access: {
    // Never the admin panel, whatever the account's state.
    admin: () => false,
    read: adminOrSelf,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    unlock: adminOnly,
  },
  fields: [
    {
      name: 'businessCustomer',
      type: 'relationship',
      relationTo: BUSINESS_CUSTOMERS_SLUG,
      label: 'Bedriftskunde',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Én konto per bedriftskunde. Kan ikke endres etter at kontoen er opprettet.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          label: 'Status',
          required: true,
          defaultValue: 'invited',
          index: true,
          options: MILJO_ACCOUNT_STATUS_OPTIONS,
          admin: { width: '50%', description: '«Deaktivert» stenger kontoen ved neste forespørsel.' },
        },
        {
          name: 'emailVerifiedAt',
          type: 'date',
          label: 'E-post bekreftet',
          access: { create: systemOnly, update: systemOnly },
          admin: {
            width: '50%',
            readOnly: true,
            date: { pickerAppearance: 'dayAndTime' },
            description: 'Settes av bekreftelsesflyten (kommer senere).',
          },
        },
      ],
    },
  ],
  hooks: {
    beforeOperation: [guardMiljoAccountOperations],
    beforeLogin: [refuseInactiveLogin],
    beforeChange: [enforceMiljoAccountRules],
  },
  timestamps: true,
}
