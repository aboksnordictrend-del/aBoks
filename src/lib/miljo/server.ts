import 'server-only'
import { createLocalReq } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { defaultDuplicateTracker } from './duplicates'
import { dbPinAttemptStore } from './pinAttempts'
import { PUBLIC_WINDOW_SECONDS } from './abuse'
import { dbBatchRateLimitStore, withinBudget, type BudgetOutcome, type BudgetRule } from '@/lib/security/dbRateLimit'
import {
  resolveOrganization,
  submitDelivery,
  submitRegistration,
  type DeliveryFormInput,
  type OrganizationResolution,
  type RegistrationInput,
  type SubmitDeliveryResult,
  type SubmitRegistrationResult,
} from './service'

// Server-only entry points for the public /miljo/[code] page, its server actions and its route
// handlers. The logic lives in ./service with Payload reached through `req`, so it is tested
// against a stub and against the verification database.

async function localReq() {
  return createLocalReq({}, await getPayloadClient())
}

export async function resolvePublicOrganization(code: string): Promise<OrganizationResolution> {
  return resolveOrganization(await localReq(), code)
}

export async function submitRegistrationOnServer(input: RegistrationInput): Promise<SubmitRegistrationResult> {
  const req = await localReq()
  return submitRegistration(req, input, { duplicates: defaultDuplicateTracker, limits: dbBatchRateLimitStore(req.payload) })
}

/** Counts public-page rules (deliveries, statistics, downloads) in the shared database store. */
export async function publicBudget(tiers: BudgetRule[][]): Promise<BudgetOutcome> {
  const payload = await getPayloadClient()
  return withinBudget(dbBatchRateLimitStore(payload), PUBLIC_WINDOW_SECONDS, tiers)
}

export async function submitDeliveryOnServer(input: DeliveryFormInput): Promise<SubmitDeliveryResult> {
  const req = await localReq()
  return submitDelivery(req, input, { pinAttempts: dbPinAttemptStore(req.payload) })
}

export { localReq as createMiljoRequest }
