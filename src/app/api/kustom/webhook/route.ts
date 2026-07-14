import { type NextRequest, NextResponse } from 'next/server'
import { getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/format'
import { syncCustomerForOrderSafe } from '@/lib/customers'

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
        return NextResponse.json({ ok: true, skipped: true })
      }

      confirmedOrder = await payload.update({
        collection: 'orders',
        id: String(order.id),
        data: {
          status: 'confirmed',
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

      const subtotal = physicalLines.reduce((s, l) => s + l.total_amount, 0) / 100
      const shipping = shippingLine ? shippingLine.total_amount / 100 : 0
      const total = kustomOrder.order_amount / 100

      // Use the merchant_reference we set at CREATE_ORDER, or generate a fallback
      const orderNumber = kustomOrder.merchant_reference || generateOrderNumber()

      confirmedOrder = await payload.create({
        collection: 'orders',
        data: {
          orderNumber,
          kustomOrderId: orderId,
          items: physicalLines.map(l => {
            const variantId = parseInt(l.reference, 10)
            const [, colorName] = l.name.split(' · ')
            return {
              ...(Number.isFinite(variantId) ? { variant: variantId } : {}),
              variantName: colorName?.trim() ?? l.name,
              quantity: l.quantity,
              unitPrice: l.unit_price / 100,
              lineTotal: l.total_amount / 100,
            }
          }),
          subtotal,
          shipping,
          total,
          status: 'confirmed',
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[kustom-webhook] error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
