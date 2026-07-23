'use client'

import { MARKETING_API } from '@/lib/marketing/channels'
import AdsSyncButton, { type AdsSyncMode, type AdsSyncOutcome } from './AdsSyncButton'

// Sync actions for Meta Ads. The user never picks dates here: the server decides the window
// from the mode (incremental = trailing 14-day overlap, full = entire history). Viewing
// periods are a separate concern, owned by the page filter and by Analyse.
//
// The whole flow now lives in the provider-neutral AdsSyncButton; this file only binds the
// Meta endpoint and the Meta copy, so the rendered UI is unchanged.

export type MetaSyncMode = AdsSyncMode
export type MetaSyncOutcome = AdsSyncOutcome

export default function MetaSyncButton({
  hasData = false,
  onSynced,
}: {
  /** Drives the primary button label: "Synkroniser" (no data yet) vs "Oppdater". */
  hasData?: boolean
  onSynced?: (outcome: MetaSyncOutcome) => void
} = {}) {
  return (
    <AdsSyncButton
      endpoint={MARKETING_API.metaSync}
      providerName="Meta"
      channelLabel="Meta Ads"
      idPrefix="meta"
      hasData={hasData}
      onSynced={onSynced}
    />
  )
}
