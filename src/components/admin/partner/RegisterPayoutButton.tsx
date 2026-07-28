'use client'

import { useState } from 'react'
import { Drawer, toast, useModal, useRouteCache } from '@payloadcms/ui'
import type { PayoutMethod } from '@/lib/partner/constants'
import PayoutModalBody, { PayoutTriggerRow, type PayoutSummary } from './PayoutModalBody'

/**
 * «Registrer utbetaling» — the one action on the partner panel.
 *
 * ── What it does, and deliberately does not ──
 *
 * The company settles partner commission once per period, paying the whole accumulated
 * balance. So there is no amount input: the modal states the balance the server calculated
 * and pays exactly that. An admin chooses the payment method and may add a reference or a
 * note — nothing else.
 *
 * The amount shown is presentational. The server recalculates earned, paid and available from
 * the database immediately before writing the row and — because this flow sends
 * `expectFullBalance` — refuses outright if the figure moved since this screen was drawn. A
 * stale modal therefore cannot pay a stale amount.
 *
 * This registers a transfer a human has ALREADY made by bank or Vipps. It moves no money.
 *
 * Behaviour only: everything visible lives in `PayoutModalBody`, which is free of Payload's
 * client providers and is therefore directly testable.
 */

export interface RegisterPayoutButtonProps extends PayoutSummary {
  promoCodeId: string
}

type Result = {
  ok?: boolean
  error?: string
  emailStatus?: 'sent' | 'skipped_no_address' | 'failed'
}

const DRAWER_SLUG = 'register-partner-payout'

export default function RegisterPayoutButton({
  promoCodeId,
  ...summary
}: RegisterPayoutButtonProps) {
  const { openModal, closeModal } = useModal()
  const { clearRouteCache } = useRouteCache()

  const [method, setMethod] = useState<PayoutMethod>('bankTransfer')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')

    try {
      const res = await fetch('/api/partner-payouts/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoCodeId,
          // Presentational only — the server recalculates and must agree exactly.
          amount: summary.availableToPay,
          expectFullBalance: true,
          paymentMethod: method,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })

      const body: Result = await res.json().catch(() => ({}))

      if (!res.ok || !body.ok) {
        setError(body.error ?? `Utbetalingen kunne ikke registreres (${res.status}).`)
        return
      }

      // The payout stands regardless of what happened to the e-mail; the message says which.
      if (body.emailStatus === 'failed') {
        toast.warning('Utbetalingen ble registrert, men e-posten kunne ikke sendes.')
      } else if (body.emailStatus === 'skipped_no_address') {
        toast.warning(
          'Utbetalingen ble registrert. Ingen e-post ble sendt fordi partneren ikke har en gyldig e-postadresse.',
        )
      } else {
        toast.success('Utbetalingen ble registrert.')
      }

      setReference('')
      setNote('')
      closeModal(DRAWER_SLUG)

      // Payload's own refresh: re-renders the document view, so the summary cards, the detail
      // rows and both tables come back with the new figures. No page reload.
      clearRouteCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PayoutTriggerRow
        availableToPay={summary.availableToPay}
        onOpen={() => {
          setError('')
          openModal(DRAWER_SLUG)
        }}
      />

      <Drawer slug={DRAWER_SLUG} title="Registrer partnerutbetaling">
        <PayoutModalBody
          summary={summary}
          method={method}
          reference={reference}
          note={note}
          busy={busy}
          error={error}
          onMethodChange={setMethod}
          onReferenceChange={setReference}
          onNoteChange={setNote}
          onCancel={() => closeModal(DRAWER_SLUG)}
          onSubmit={submit}
        />
      </Drawer>
    </>
  )
}
