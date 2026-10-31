import 'server-only'
import { createLocalReq } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { defaultDuplicateTracker } from './duplicates'
import { dbPinAttemptStore } from './pinAttempts'
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
  return submitRegistration(await localReq(), input, { duplicates: defaultDuplicateTracker })
}

export async function submitDeliveryOnServer(input: DeliveryFormInput): Promise<SubmitDeliveryResult> {
  const req = await localReq()
  return submitDelivery(req, input, { pinAttempts: dbPinAttemptStore(req.payload) })
}

export { localReq as createMiljoRequest }
