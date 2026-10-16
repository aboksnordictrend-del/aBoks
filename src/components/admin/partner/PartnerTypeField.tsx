'use client'

import type { RadioFieldClientComponent } from 'payload'
import { RadioGroupField, useDocumentInfo } from '@payloadcms/ui'

/**
 * «Partnertype» in the admin: Payload's own radio group, read-only once the SAVED partner has a
 * type.
 *
 * Display only. The rule itself — classified once, then permanent — is enforced on the server by
 * `enforcePartnerType` (`@/collections/hooks/partnerType`), which refuses a change with a
 * validation error on every path: the admin, REST and the Local API. Field-level access is
 * deliberately not used for this: it would make Payload drop the change silently and answer 200.
 */
export function isPartnerTypeLocked(savedType: unknown): boolean {
  return typeof savedType === 'string' && savedType !== ''
}

const PartnerTypeField: RadioFieldClientComponent = (props) => {
  const { initialData } = useDocumentInfo()
  const locked = isPartnerTypeLocked((initialData as { partnerType?: unknown } | undefined)?.partnerType)
  return <RadioGroupField {...props} readOnly={props.readOnly || locked} />
}

export default PartnerTypeField
