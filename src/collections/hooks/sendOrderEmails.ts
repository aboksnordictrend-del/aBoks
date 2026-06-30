import type { CollectionAfterChangeHook } from 'payload'
import type { Order } from '@/payload-types'
import {
  createOrderConfirmationEmail,
  createAdminOrderEmail,
  createOrderShippedEmail,
} from '@/emails'

const ADMIN_EMAIL = 'post@aboks.no'

export const sendOrderEmails: CollectionAfterChangeHook<Order> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // Skip recursive calls triggered by our own sentinel field updates
  if ((req.context as Record<string, unknown>)?.skipEmailHooks) return

  const { payload } = req

  const customerName =
    [doc.customerInfo?.firstName, doc.customerInfo?.lastName].filter(Boolean).join(' ') || 'Kunde'

  const customerEmail = doc.customerInfo?.email
  if (!customerEmail) {
    console.error(`[Orders] Missing customer email for order ${doc.orderNumber}`)
    return
  }

  const items = (doc.items ?? []).map((item) => ({
    variantName: item.variantName ?? undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }))

  const shippingAddress = {
    address: doc.customerInfo?.address ?? '',
    postalCode: doc.customerInfo?.postalCode ?? '',
    city: doc.customerInfo?.city ?? '',
  }

  const now = () => new Date().toISOString()

  const markSent = async (data: Record<string, string>) => {
    try {
      await payload.update({
        collection: 'orders',
        id: doc.id,
        data,
        context: { skipEmailHooks: true },
        overrideAccess: true,
      })
    } catch (err) {
      console.error(`[Orders] Failed to mark email as sent for ${doc.orderNumber}:`, err)
    }
  }

  // ── Order confirmed: send to customer + admin ─────────────────────────────
  // Fires when status first becomes 'confirmed', regardless of how it got there:
  //   • webhook fallback creates the order directly as 'confirmed'  (create)
  //   • normal flow: webhook updates pending → confirmed            (update)
  const justConfirmed =
    doc.status === 'confirmed' &&
    (operation === 'create' ||
      (operation === 'update' && previousDoc?.status !== 'confirmed'))

  if (justConfirmed) {
    if (!doc.confirmationEmailSentAt) {
      try {
        const email = createOrderConfirmationEmail({
          customerName,
          customerEmail,
          orderNumber: doc.orderNumber,
          items,
          subtotal: doc.subtotal,
          shipping: doc.shipping ?? 0,
          total: doc.total,
          shippingAddress,
        })
        await payload.sendEmail({ to: customerEmail, ...email })
        await markSent({ confirmationEmailSentAt: now() })
      } catch (err) {
        console.error(`[Orders] Failed to send confirmation email for ${doc.orderNumber}:`, err)
      }
    }

    if (!doc.adminEmailSentAt) {
      try {
        const email = createAdminOrderEmail({
          customerName,
          customerEmail,
          customerPhone: doc.customerInfo?.phone ?? undefined,
          orderNumber: doc.orderNumber,
          items,
          subtotal: doc.subtotal,
          shipping: doc.shipping ?? 0,
          total: doc.total,
          shippingAddress,
        })
        await payload.sendEmail({ to: ADMIN_EMAIL, ...email })
        await markSent({ adminEmailSentAt: now() })
      } catch (err) {
        console.error(`[Orders] Failed to send admin email for ${doc.orderNumber}:`, err)
      }
    }
  }

  // ── Status changed to shipped: send tracking notification to customer ──────
  if (
    operation === 'update' &&
    doc.status === 'shipped' &&
    previousDoc?.status !== 'shipped' &&
    !doc.shippedEmailSentAt
  ) {
    try {
      const email = createOrderShippedEmail({
        customerName,
        customerEmail,
        orderNumber: doc.orderNumber,
        items,
        total: doc.total,
      })
      await payload.sendEmail({ to: customerEmail, ...email })
      await markSent({ shippedEmailSentAt: now() })
    } catch (err) {
      console.error(`[Orders] Failed to send shipped email for ${doc.orderNumber}:`, err)
    }
  }
}
