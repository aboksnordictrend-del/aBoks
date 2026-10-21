import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import type { RawAnswers } from './answers'
import {
  resolvePilotPage as resolveWith,
  submitPilotEvaluation as submitWith,
  type PilotPageResolution,
  type PilotPayload,
  type SubmitPilotResult,
} from './submission'

// Server-only entry points for the public /pilot/[slug] page and its server action. The logic
// lives in ./submission with Payload injected, so it is tested without a database.

export type { PilotPageResolution, PilotPageState, SubmitPilotResult } from './submission'

export async function resolvePilotPage(slug: string, opts: { preview: boolean }): Promise<PilotPageResolution> {
  return resolveWith((await getPayloadClient()) as PilotPayload, slug, opts)
}

export async function submitPilotEvaluation(input: {
  projectId: number
  version: number
  raw: RawAnswers
}): Promise<SubmitPilotResult> {
  return submitWith((await getPayloadClient()) as PilotPayload, input)
}
