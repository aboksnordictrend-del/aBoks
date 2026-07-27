import { type NextRequest, NextResponse } from 'next/server'
import { getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'
import { allocateOrderNumber } from '@/lib/orderNumber'
import { syncCustomerForOrderSafe } from '@/lib/customers'
import { colorNameFromLineName } from '@/lib/orderLineName'
import { registerPromoUsageOnce, type RegisterUsageResult } from '@/lib/promo/usageRegistration'
import { resolvePromoSnapshot } from '@/lib/promo/webhookPromo'

/**
 * A transient failure to record promo usage must be retried, and the only retry mechanism
 * available is Kustom re-delivering the push — which it only does on a non-2xx response.
 * The paid order itself is already committed by this point and is never rolled back; the
 * next delivery takes the already-confirmed branch and simply re-attempts the audit row.
 *
 * Everything else is terminal and answers 2xx: `created`, `already_registered`, and every
 * `not_applicable` reason (including `promo_not_found` for a deleted promo, which must never
 * cause endless retries).
 */
function usageNeedsRetry(
  result: RegisterUsageResult,
): result is Extract<RegisterUsageResult, { status: 'retryable_error' }> {
  return result.status === 'retryable_error'
}

const RETRY_RESPONSE = (kustomOrderId: string, reason: string) =>
  NextResponse.json(
    { ok: false, orderSaved: true, retry: true, reason, orderId: kustomOrderId },
    { status: 503 },
  )

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('order_id')

  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
  }

  try {
    // Fetch from Kustom to verify payment status and get customer + line data.
    const kustomOrder = await getKustomOrder(orderId)

    if (kustomOrder.status !== 'checkout_complete') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const payload = await getPayloadClient()
    const addr = kustomOrder.billing_address ?? kustomOrder.shipping_address

    const existing = await payload.find({
      collection: 'orders',
      where: { kustomOrderId: { equals: orderId } },
      limit: 1,
    })

    let confirmedOrder

    if (existing.docs.length > 0) {
      const order = existing.docs[0]

      // Idempotency: already confirmed, so the order itself needs no write. Still run
      // the customer sync — it is a no-op when the link is already there, and it repairs
      // the link if an earlier delivery of this webhook failed halfway.
      if (order.status === 'confirmed') {
        await syncCustomerForOrderSafe(payload, order)
        // Promo usage is retried here too, deliberately. If the first delivery confirmed the
        // order but the usage insert failed transiently, this is the only path a retry takes
        // — returning early without it would lose the record permanently.
        const usage = await registerPromoUsageOnce({ payload }, { kustomOrder, order })
        if (usageNeedsRetry(usage)) {
          // The order stays confirmed; only the audit row is outstanding.
          return RETRY_RESPONSE(orderId, usage.reason)
        }
        return NextResponse.json({ ok: true, skipped: true, usage: usage.status })
      }

      // Repair the promo snapshot if the best-effort pre-create left it missing or partial.
      // Never overwrites a snapshot that already names a different code — that is logged as
      // an integrity conflict and left for a human.
      const snapshot = await resolvePromoSnapshot(payload, kustomOrder, order)
      if (snapshot.action === 'conflict') {
        console.error(
          JSON.stringify({
            scope: 'kustom-webhook',
            event: 'integrity-conflict',
            reason: 'order_promo_conflict',
            orderId: String(order.id),
            kustomOrderId: orderId,
            storedCode: snapshot.storedCode,
            paidCode: snapshot.paidCode,
          }),
        )
      }

      confirmedOrder = await payload.update({
        collection: 'orders',
        id: String(order.id),
        data: {
          status: 'confirmed',
          // Stamp the payment date once. A replayed webhook keeps the original value,
          // and a manual status change never reaches this path.
          paidAt: order.paidAt ?? new Date().toISOString(),
          ...(snapshot.action === 'restore' ? snapshot.patch : {}),
          customerInfo: {
            email: addr?.email ?? '',
            firstName: addr?.given_name ?? '',
            lastName: addr?.family_name ?? '',
            address: addr?.street_address ?? '',
            postalCode: addr?.postal_code ?? '',
            city: addr?.city ?? '',
            phone: addr?.phone ?? '',
          },
        },
      })
    } else {
      // The pre-create in initKustomCheckout failed or was skipped.
      // Reconstruct the order from Kustom data so we never lose a paid order.
      const physicalLines = (kustomOrder.order_lines ?? []).filter(l => l.type === 'physical')
      const shippingLine = (kustomOrder.order_lines ?? []).find(l => l.type === 'shipping_fee')

      // Promo discounts ride on the physical lines as `total_discount_amount` (Kustom
      // "Option A"), so `total_amount` is already net. `subtotal` must stay the PRE-discount
      // goods sum for the order's own identity to hold —
      //   subtotal + shipping − total === discount
      // — which is what the PDF receipt reads to print its "Rabatt" row. Summing
      // `total_amount` here instead would rebuild a discounted order as an undiscounted one.
      const grossOere = physicalLines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
      const discountOere = physicalLines.reduce((s, l) => s + (l.total_discount_amount ?? 0), 0)

      const subtotal = grossOere / 100
      const shipping = shippingLine ? shippingLine.total_amount / 100 : 0
      const total = kustomOrder.order_amount / 100

      // The discount AMOUNT comes from the Kustom lines; the promo IDENTITY comes from
      // merchant_data, which is the only place Option A preserves it. `resolvePromoSnapshot`
      // cross-checks the two against the paid amounts, and omits the promo relationship when
      // the record has since been deleted — a dangling foreign key here would fail the whole
      // create and lose a paid order.
      //
      // When merchant_data is absent or unusable the money is still reconstructed correctly:
      // the order simply keeps no code, and no usage is registered, rather than an identity
      // being invented.
      let reconstructedDiscount: Record<string, unknown> = {}
      if (discountOere > 0) {
        const restored = await resolvePromoSnapshot(payload, kustomOrder, {})
        if (restored.action === 'restore') {
          reconstructedDiscount = restored.patch
        } else {
          console.warn(
            JSON.stringify({
              scope: 'kustom-webhook',
              event: 'reconstruct-without-promo-identity',
              kustomOrderId: orderId,
              discountOere,
            }),
          )
          reconstructedDiscount = {
            discount: {
              discountAmount: discountOere / 100,
              subtotalBeforeDiscount: subtotal,
              subtotalAfterDiscount: (grossOere - discountOere) / 100,
              totalBeforeDiscount: (grossOere + (shippingLine?.total_amount ?? 0)) / 100,
              totalAfterDiscount: total,
            },
          }
        }
      }

      // Use the merchant_reference we set at CREATE_ORDER, or allocate a fresh number
      const orderNumber = kustomOrder.merchant_reference || (await allocateOrderNumber(payload))

      confirmedOrder = await payload.create({
        collection: 'orders',
        data: {
          orderNumber,
          kustomOrderId: orderId,
          items: physicalLines.map(l => {
            const variantId = parseInt(l.reference, 10)
            return {
              ...(Number.isFinite(variantId) ? { variant: variantId } : {}),
              // The Kustom line name is the variant's full display name; both fields are
              // re-resolved from the variant by the orders snapshot hook when the reference
              // is usable, so these are only the last-resort values.
              displayName: l.name.trim(),
              variantName: colorNameFromLineName(l.name),
              quantity: l.quantity,
              unitPrice: l.unit_price / 100,
              // Pre-discount line value, with the promo share recorded alongside it — the
              // same shape initKustomCheckout writes.
              lineTotal: (l.unit_price * l.quantity) / 100,
              discountAmount: (l.total_discount_amount ?? 0) / 100,
            }
          }),
          subtotal,
          shipping,
          total,
          ...reconstructedDiscount,
          status: 'confirmed',
          paidAt: new Date().toISOString(),
          customerInfo: {
            email: addr?.email ?? '',
            firstName: addr?.given_name ?? '',
            lastName: addr?.family_name ?? '',
            address: addr?.street_address ?? '',
            postalCode: addr?.postal_code ?? '',
            city: addr?.city ?? '',
            phone: addr?.phone ?? '',
          },
        },
      })

      console.log('[kustom-webhook] created missing order from Kustom data: orderId=%s payloadId=%s', orderId, confirmedOrder.id)
    }

    // Find-or-create the Customer for this buyer and link the order to it.
    // Runs after the order write has committed so a sync failure can never roll it back.
    await syncCustomerForOrderSafe(payload, confirmedOrder)

    // Register the promo use — once, and only now that the order is confirmed paid.
    //
    // Deliberately after the order write has committed and outside any transaction with it:
    // the audit row must never be able to roll back a genuinely paid order. A transient
    // failure here leaves the order confirmed and returns 'retryable_error'; Kustom retries
    // the push until it gets a 2xx, and the already-confirmed branch above picks the
    // registration up on the next delivery.
    const usageResult = await registerPromoUsageOnce({ payload }, { kustomOrder, order: confirmedOrder })
    if (usageNeedsRetry(usageResult)) {
      console.error(
        JSON.stringify({
          scope: 'kustom-webhook',
          event: 'promo-usage-retryable',
          orderId: String(confirmedOrder.id),
          kustomOrderId: orderId,
          reason: usageResult.reason,
        }),
      )
    }

    // Deduct inventory — run regardless of create vs. update path
    const itemsToProcess = confirmedOrder.items ?? []
    for (const item of itemsToProcess) {
      if (!item.variant || !item.quantity) continue

      const variantId =
        typeof item.variant === 'object'
          ? String((item.variant as { id: number }).id)
          : String(item.variant)

      try {
        const variant = await payload.findByID({
          collection: 'product-variants',
          id: Number(variantId),
        })

        const newInventory = Math.max(0, (variant.inventory ?? 0) - item.quantity)

        await payload.update({
          collection: 'product-variants',
          id: Number(variantId),
          data: { inventory: newInventory },
        })

        console.log(
          `[kustom-webhook] inventory: variant=${variantId} (${variant.name ?? variant.sku}) ${variant.inventory} → ${newInventory}`,
        )
      } catch (invErr) {
        console.error(
          '[kustom-webhook] inventory update failed for variant',
          variantId,
          invErr instanceof Error ? invErr.message : invErr,
        )
      }
    }

    // Inventory has been deducted and the order is committed. If only the promo audit row is
    // outstanding, ask Kustom to deliver again: every step above is idempotent, so a repeat
    // delivery is safe and is the one thing that can still record the usage.
    if (usageNeedsRetry(usageResult)) {
      return RETRY_RESPONSE(orderId, usageResult.reason)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[kustom-webhook] error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
