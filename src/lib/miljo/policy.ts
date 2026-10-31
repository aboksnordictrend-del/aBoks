// Per-organisation registration policy. Pure.
//
// Turns an organisation document into the categories and limits the public form may use. The
// hard ceilings in REGISTRATION_LIMITS always win over the organisation's own values, and «Andre»
// is offered only when it is both selected AND described — a selected category without a
// description of what the container permits stays hidden.

import {
  BATTERY_CATEGORIES,
  CATEGORY_LABELS,
  REGISTRATION_LIMITS,
  isBatteryCategory,
  type BatteryCategory,
} from './constants'

export interface CategoryOption {
  value: BatteryCategory
  label: string
  /** Shown under the label; only «Andre» has one (what the container permits). */
  description?: string
}

export interface RegistrationPolicy {
  categories: CategoryOption[]
  maxPerCategory: number
  maxPerSubmission: number
  confirmAbove: number
  dailyFlagThreshold: number
}

export interface PolicySource {
  allowedCategories?: unknown
  otherCategoryLabel?: string | null
  otherCategoryDescription?: string | null
  maxPerCategory?: number | null
  maxPerSubmission?: number | null
  confirmAbove?: number | null
  dailyFlagThreshold?: number | null
}

function bounded(value: number | null | undefined, ceiling: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return fallback
  return Math.min(value, ceiling)
}

/** Categories the organisation offers, in canonical order. */
export function allowedCategoriesFor(org: PolicySource): CategoryOption[] {
  const selected = new Set(
    (Array.isArray(org.allowedCategories) ? org.allowedCategories : []).filter(isBatteryCategory),
  )
  const out: CategoryOption[] = []
  for (const value of BATTERY_CATEGORIES) {
    if (!selected.has(value)) continue
    if (value === 'other') {
      const description = org.otherCategoryDescription?.trim()
      if (!description) continue
      out.push({ value, label: org.otherCategoryLabel?.trim() || CATEGORY_LABELS.other, description })
      continue
    }
    out.push({ value, label: CATEGORY_LABELS[value] })
  }
  return out
}

export function policyFor(org: PolicySource): RegistrationPolicy {
  const maxPerCategory = bounded(org.maxPerCategory, REGISTRATION_LIMITS.maxPerCategory, REGISTRATION_LIMITS.maxPerCategory)
  const maxPerSubmission = bounded(
    org.maxPerSubmission,
    REGISTRATION_LIMITS.maxPerSubmission,
    REGISTRATION_LIMITS.maxPerSubmission,
  )
  return {
    categories: allowedCategoriesFor(org),
    maxPerCategory,
    maxPerSubmission,
    confirmAbove: Math.min(bounded(org.confirmAbove, maxPerSubmission, REGISTRATION_LIMITS.confirmAbove), maxPerSubmission),
    dailyFlagThreshold: bounded(org.dailyFlagThreshold, 1_000_000, REGISTRATION_LIMITS.dailyFlagThreshold),
  }
}

/** Label for any stored category, including one an organisation no longer offers. */
export function categoryLabel(category: string, org?: PolicySource): string {
  if (category === 'other') return org?.otherCategoryLabel?.trim() || CATEGORY_LABELS.other
  return isBatteryCategory(category) ? CATEGORY_LABELS[category] : category
}
