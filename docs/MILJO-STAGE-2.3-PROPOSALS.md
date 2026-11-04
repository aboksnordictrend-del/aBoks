# Miljøregistrering — proposals after Stage 2.3 (not implemented)

Stage 2.3 made Min side the organisation's dashboard (overview, statistics, deliveries, exports,
QR and PIN). The items below were deliberately **not** built: each changes data, permissions or
the public flow and needs a decision first.

## 1. PIN rotation from Min side

**Today:** only an administrator can set a new PIN (admin «PIN» action,
`/api/environmental-organizations/:id/pin`). It writes the scrypt hash, the encrypted copy
(`MILJO_PIN_ENCRYPTION_KEY`) and resets the attempt counter. Min side can only *show* the active PIN.

**Proposal:** «Lag ny PIN» on Min side.
- Requires the account password again (re-authentication), a confirmation step, and the vault key
  (refuse otherwise — the new PIN must stay revealable).
- Reuses the admin endpoint's storage logic (one shared server function), generates a random PIN;
  no customer-chosen PINs.
- The old PIN stops working immediately: whoever delivers batteries must be told.
- Rate limit (e.g. 3 per day) and an audit record (who, when — never the PIN).
- Optional: e-mail to the login address «PIN-koden er endret».

## 2. «Ansvarlig» on deliveries

**Today:** a delivery is registered on the QR page with the shared PIN; no name is stored, so
Min side cannot show who delivered.

**Proposal:** optional field «Navn på ansvarlig» in the delivery form (max 80 characters), stored
on `battery-deliveries` (migration: one nullable text column), shown on Min side and in the
organisation's CSV — never on the public statistics.

## 3. Correcting or deleting deliveries from Min side

**Today:** deliveries cannot be deleted (hook); administrators correct or invalidate them with a
reason and an audit entry (`battery-delivery-audit`). Min side is read-only.

**Proposal (permission model):** the organisation may *request* a correction or invalidation with a
reason; aBoks approves it in the admin. Nothing is changed by the organisation directly, history
stays complete, and the existing audit trail records the administrator's action plus the request.
Needs one small collection for requests (migration) and an admin view.

## 4. Receipts and references in the organisation's own files

**Today:** Min side shows the reference and receipt status; the CSV/PDF exports use the public
column set (no reference, no attachment).

**Proposal:**
- CSV «Leveranser» with a «Kvittering / referanse» column for the organisation's own export
  (a third CSV audience `organization`).
- «Last ned kvittering» per delivery on Min side, served only to the owning organisation's
  session (the documents collection is private today).
