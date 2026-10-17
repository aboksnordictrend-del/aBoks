'use client'

import { useState } from 'react'
import { Drawer, toast, useModal, useRouteCache } from '@payloadcms/ui'
import type { PayoutMethod } from '@/lib/partner/constants'
import { oereToKr } from '@/lib/money'
import type { AdjustmentRow, PayableSaleRow } from '@/lib/partner/referralPayoutState'
import ReferralPayoutModalBody, { referralPayoutFigures } from './ReferralPayoutModalBody'
import styles from './partner.module.css'

/**
 * «Registrer utbetaling av henvisningsprovisjon» — behaviour only; everything visible lives in
 * `ReferralPayoutModalBody`. Posts to `/api/partner-payouts/register-referral` with the selected
 * sales and the amount the screen showed; the server re-reads and locks the rows and refuses if
 * that amount no longer holds. Moves no money.
 */

export interface RegisterReferralPayoutButtonProps {
  partnerId: string
  partnerName: string
  bankAccount?: string
  accountOwner?: string
  sales: PayableSaleRow[]
  adjustments: AdjustmentRow[]
}

const DRAWER_SLUG = 'register-referral-payout'

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })

export default function RegisterReferralPayoutButton(props: RegisterReferralPayoutButtonProps) {
  const { openModal, closeModal } = useModal()
  const { clearRouteCache } = useRouteCache()

  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.sales.map((s) => s.id)))
  const [payoutDate, setPayoutDate] = useState(today)
  const [method, setMethod] = useState<PayoutMethod>('bankTransfer')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const enabled = props.sales.length > 0

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const figures = referralPayoutFigures(props.sales, selected, props.adjustments)
      const res = await fetch('/api/partner-payouts/register-referral', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: Number(props.partnerId),
          saleIds: props.sales.filter((s) => selected.has(s.id)).map((s) => Number(s.id)),
          // Compared, never trusted: the server must arrive at exactly this figure.
          expectedAmount: oereToKr(figures.netOere),
          payoutDate,
          paymentMethod: method,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })
      const body: { ok?: boolean; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setError(body.error ?? `Utbetalingen kunne ikke registreres (${res.status}).`)
        return
      }
      toast.success('Utbetalingen av henvisningsprovisjon ble registrert.')
      setReference('')
      setNote('')
      closeModal(DRAWER_SLUG)
      clearRouteCache()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nettverksfeil.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <div className={styles.actionRow}>
        <button
          type="button"
          className="btn btn--style-primary btn--size-small"
          disabled={!enabled}
          onClick={() => {
            setError('')
            setSelected(new Set(props.sales.map((s) => s.id)))
            openModal(DRAWER_SLUG)
          }}
        >
          Registrer utbetaling av henvisningsprovisjon
        </button>
        {!enabled && <span className={styles.actionHint}>Ingen opptjent provisjon å utbetale.</span>}
      </div>

      <Drawer slug={DRAWER_SLUG} title="Registrer utbetaling av henvisningsprovisjon">
        <ReferralPayoutModalBody
          partnerName={props.partnerName}
          bankAccount={props.bankAccount}
          accountOwner={props.accountOwner}
          sales={props.sales}
          adjustments={props.adjustments}
          selected={selected}
          payoutDate={payoutDate}
          method={method}
          reference={reference}
          note={note}
          busy={busy}
          error={error}
          onToggle={toggle}
          onToggleAll={(on) => setSelected(on ? new Set(props.sales.map((s) => s.id)) : new Set())}
          onPayoutDateChange={setPayoutDate}
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
