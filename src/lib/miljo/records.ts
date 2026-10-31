// Payload documents → plain records for ./stats, ./csv and ./reportPdf. Pure.

import {
  isBatteryCategory,
  isDeliveryUnit,
  type DocumentationStatus,
  type RecordStatus,
} from './constants'
import type { DeliveryRecord, RegistrationRecord } from './stats'

type Doc = Record<string, unknown>

const relId = (value: unknown): number => {
  const raw = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
  return typeof raw === 'number' ? raw : Number(raw)
}

const status = (value: unknown): RecordStatus =>
  value === 'corrected' || value === 'invalidated' ? value : 'registered'

export function toLines(value: unknown): RegistrationRecord['lines'] {
  if (!Array.isArray(value)) return []
  const out: RegistrationRecord['lines'] = []
  for (const l of value as Doc[]) {
    const quantity = Number(l?.quantity)
    if (isBatteryCategory(l?.category) && Number.isInteger(quantity) && quantity > 0) out.push({ category: l.category, quantity })
  }
  return out
}

export function toRegistrationRecord(doc: Doc): RegistrationRecord {
  return {
    id: Number(doc.id),
    organizationId: relId(doc.organization),
    organizationName: String(doc.organizationName ?? ''),
    registeredAt: String(doc.registeredAt ?? ''),
    status: status(doc.status),
    lines: toLines(doc.lines),
    submittedTotal: Number(doc.submittedTotal ?? 0),
    flags: Array.isArray(doc.flags) ? (doc.flags as unknown[]).filter((f): f is string => typeof f === 'string') : [],
    reviewState: typeof doc.reviewState === 'string' ? doc.reviewState : 'none',
  }
}

export function toDeliveryRecord(doc: Doc): DeliveryRecord {
  const documentationStatus: DocumentationStatus = doc.documentationStatus === 'documented' ? 'documented' : 'reported'
  return {
    id: Number(doc.id),
    organizationId: relId(doc.organization),
    organizationName: String(doc.organizationName ?? ''),
    deliveryDate: String(doc.deliveryDate ?? ''),
    quantity: Number(doc.quantity ?? 0),
    unit: isDeliveryUnit(doc.unit) ? doc.unit : 'kg',
    operator: String(doc.operator ?? ''),
    documentationStatus,
    status: status(doc.status),
    registeredAt: String(doc.registeredAt ?? ''),
  }
}

/** Fields selected when loading records — only what the aggregates need. */
export const REGISTRATION_SELECT = {
  organization: true,
  organizationName: true,
  registeredAt: true,
  status: true,
  lines: true,
  submittedTotal: true,
  flags: true,
  reviewState: true,
} as const

export const DELIVERY_SELECT = {
  organization: true,
  organizationName: true,
  deliveryDate: true,
  quantity: true,
  unit: true,
  operator: true,
  documentationStatus: true,
  status: true,
  registeredAt: true,
} as const
