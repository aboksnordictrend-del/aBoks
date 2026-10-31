// Result contracts of the public Miljøregistrering server actions. Strict, as for reviews and
// pilot evaluations: `success: true` only when a record was actually stored.

import type { BatteryCategory, DeliveryUnit } from '@/lib/miljo/constants'

export type RegistrationActionResult =
  | { success: true; total: number; lines: { category: BatteryCategory; quantity: number }[] }
  | { success: false; message: string; errors?: Record<string, string>; reason?: string }

export type DeliveryActionResult =
  | {
      success: true
      delivery: { deliveryDate: string; quantity: number; unit: DeliveryUnit; operator: string; documented: boolean }
    }
  | { success: false; message: string; errors?: Record<string, string>; reason?: string }
