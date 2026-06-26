import { type NextRequest, NextResponse } from 'next/server'
import { getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('order_id')

  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
  }

  try {
    // Fetch from Kustom API to verify payment status and get customer data.
    // This also acts as implicit auth verification: only our credentials can call this endpoint.
    const kustomOrder = await getKustomOrder(orderId)

    if (kustomOrder.status !== 'checkout_complete') {
      // Not paid yet — return 200 so Kustom doesn't retry
      return NextResponse.json({ ok: true, skipped: true })
    }

    const payload = await getPayloadClient()

    const existing = await payload.find({
      collection: 'orders',
      where: { kustomOrderId: { equals: orderId } },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      // Order not in CMS yet (race condition is unlikely but possible).
      // Return 200 to prevent infinite retries from Kustom.
      return NextResponse.json({ ok: true, note: 'Order not found in CMS' })
    }

    const order = existing.docs[0]

    // Idempotency: already confirmed, nothing to do
    if (order.status === 'confirmed') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const addr = kustomOrder.billing_address ?? kustomOrder.shipping_address

    await payload.update({
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

    // Deduct inventory from each ordered variant by variantId, not productId
    for (const item of order.items ?? []) {
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
        // Log but don't fail the webhook — order is confirmed, inventory can be corrected manually
        console.error(
          '[kustom-webhook] inventory update failed for variant',
          variantId,
          invErr instanceof Error ? invErr.message : invErr,
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Return 500 so Kustom retries the push notification
    console.error('[kustom-webhook] error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
