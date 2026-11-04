'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { PUBLIC_MILJO_ORIGIN } from '@/lib/miljo/constants'
import { box, danger, heading, input, muted, osloDateTime, postJson, rule, warn } from './adminUi'

type Account = {
  id: number
  email: string
  fullName: string
  status: 'invited' | 'active' | 'disabled' | string
  provisioning: string
  mustChangePassword: boolean
  emailVerifiedAt: string | null
  invitedAt: string | null
  inviteExpiresAt: string | null
  inviteExpired: boolean
  createdAt: string | null
}

type Customer = { id: number; name: string; organizationNumber: string; status: string; accessBasis: string; accessOk: boolean; accessProblem: string | null }

type Listing = { organization: { id: number; name: string; organizationNumber: string }; businessCustomer: Customer | null; accounts: Account[] }

type Credentials = { email: string; password: string }

const STATUS_LABEL: Record<string, string> = { invited: 'Invitert', active: 'Aktiv', disabled: 'Deaktivert' }
const PROVISIONING_LABEL: Record<string, string> = {
  'self-registration': 'Selvregistrering',
  'admin-password': 'Midlertidig passord',
  'admin-invitation': 'E-postinvitasjon',
}
const LOGIN_URL = `${PUBLIC_MILJO_ORIGIN}${MILJO_PATHS.login}`

const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }
const cell: CSSProperties = { textAlign: 'left', padding: '0.45rem 0.5rem', borderTop: '1px solid var(--theme-elevation-150)', verticalAlign: 'top' }
const label: CSSProperties = { display: 'block', fontWeight: 600, margin: '0.6rem 0 0.25rem' }
const credentialBox: CSSProperties = {
  ...box,
  borderColor: 'var(--theme-success-500)',
  background: 'var(--theme-success-50)',
  fontFamily: 'var(--font-mono, monospace)',
  whiteSpace: 'pre-wrap',
}

/**
 * «Brukerkontoer» tab on an organisation (Stage 2.5): create the responsible person's Min side
 * login with a temporary password or an e-mail invitation, and manage it afterwards. A temporary
 * password is shown ONCE, right after it is created, with a copy button — it is never stored in
 * clear text and cannot be shown again (set a new one instead). Nothing is e-mailed except
 * invitations.
 */
export default function AccountsPanel() {
  const { id } = useDocumentInfo()
  const [data, setData] = useState<Listing | null>(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', method: 'password' as 'password' | 'invitation', generate: true, password: '', organizationNumber: '' })
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/environmental-organizations/${id}/accounts`, { credentials: 'include', cache: 'no-store' })
    if (res.ok) {
      setData((await res.json()) as Listing)
      setLoadError('')
    } else setLoadError('Kunne ikke hente brukerkontoene.')
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!id) {
    return (
      <div style={box}>
        <p style={heading}>Brukerkontoer</p>
        <p style={{ margin: 0 }}>Lagre organisasjonen først.</p>
      </div>
    )
  }

  const open = data?.accounts.filter((a) => a.status !== 'disabled') ?? []
  const needsOrgNumber = !!data && !data.businessCustomer && !data.organization.organizationNumber

  const showCredentials = (email: string, password: string) => {
    setCredentials({ email, password })
    setCopied(false)
  }

  const create = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    setFieldError(null)
    try {
      const { res, data: out } = await postJson(`/api/environmental-organizations/${id}/accounts`, {
        fullName: form.fullName,
        email: form.email,
        method: form.method,
        password: form.method === 'password' && !form.generate ? form.password : '',
        organizationNumber: form.organizationNumber,
      })
      if (!res.ok) {
        setFieldError({ field: out.field as string | undefined, message: String(out.error ?? 'Kunne ikke opprette kontoen.') })
        return
      }
      const account = out.account as Account
      if (typeof out.temporaryPassword === 'string') showCredentials(account.email, out.temporaryPassword)
      const parts = [`Brukerkonto opprettet for ${account.email}.`]
      if (out.businessCustomerCreated) parts.push('Bedriftskunde opprettet med tilgang «Avtale med aBoks».')
      if (form.method === 'invitation') parts.push(out.invitationSent ? 'Invitasjonen er sendt på e-post.' : 'Invitasjonen kunne IKKE sendes — bruk «Send ny invitasjon».')
      setNotice(parts.join(' '))
      if (typeof out.accessProblem === 'string' && out.accessProblem) setError(out.accessProblem)
      setForm({ fullName: '', email: '', method: 'password', generate: true, password: '', organizationNumber: '' })
      setCreating(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const act = async (account: Account, action: 'revoke' | 'restore' | 'reinvite' | 'reset-password', question?: string) => {
    if (question && !window.confirm(question)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { res, data: out } = await postJson(`/api/environmental-organizations/${id}/accounts/${account.id}/${action}`, {})
      if (!res.ok) {
        setError(String(out.error ?? 'Handlingen mislyktes.'))
        return
      }
      if (action === 'reset-password' && typeof out.temporaryPassword === 'string') {
        showCredentials(account.email, out.temporaryPassword)
        setNotice(`Nytt midlertidig passord for ${account.email}. Alle økter er avsluttet; passordet må byttes ved neste innlogging.`)
      } else if (action === 'reinvite') {
        setNotice(out.invitationSent ? `Ny invitasjon sendt til ${account.email}. Den forrige lenken virker ikke lenger.` : 'Invitasjonen kunne IKKE sendes. Prøv igjen senere.')
      } else if (action === 'revoke') setNotice(`Tilgangen for ${account.email} er stengt, og alle økter er avsluttet.`)
      else setNotice(`Kontoen ${account.email} er gjenopprettet.`)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const credentialText = credentials ? `Innlogging: ${LOGIN_URL}\nE-post: ${credentials.email}\nMidlertidig passord: ${credentials.password}` : ''

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={box}>
        <p style={heading}>Brukerkontoer for Min side</p>
        <p style={{ margin: 0 }}>
          Kontoer gir den ansvarlige tilgang til Min side (statistikk, rapporter, QR-kode og PIN). Ansatte trenger ingen konto — de bruker QR-siden.
        </p>
        {loadError && <p style={danger}>{loadError}</p>}
        {data?.businessCustomer && (
          <p style={muted}>
            Bedriftskunde: <a href={`/admin/collections/business-customers/${data.businessCustomer.id}`}>{data.businessCustomer.name}</a> ({data.businessCustomer.organizationNumber}) · tilgang{' '}
            {data.businessCustomer.accessBasis === 'agreement' ? '«Avtale med aBoks»' : '«Kjøp»'}
          </p>
        )}
        {data && !data.businessCustomer && (
          <p style={muted}>Organisasjonen har ingen bedriftskunde ennå. Den opprettes automatisk med tilgang «Avtale med aBoks» når du oppretter den første kontoen.</p>
        )}
        {data?.businessCustomer?.accessProblem && <p style={warn}>{data.businessCustomer.accessProblem}</p>}
      </div>

      {credentials && (
        <div style={credentialBox} role="status">
          <p style={{ ...heading, fontFamily: 'inherit' }}>Midlertidig passord — vises bare nå</p>
          {credentialText}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', fontFamily: 'inherit' }}>
            <Button
              buttonStyle="secondary"
              size="small"
              onClick={() => {
                void navigator.clipboard.writeText(credentialText).then(() => setCopied(true))
              }}
            >
              {copied ? 'Kopiert' : 'Kopier innloggingsinformasjon'}
            </Button>
            <Button buttonStyle="secondary" size="small" onClick={() => setCredentials(null)}>
              Jeg har tatt vare på det — skjul
            </Button>
          </div>
          <p style={{ ...muted, fontFamily: 'inherit' }}>
            Passordet lagres ikke og kan ikke vises igjen. Gi det til den ansvarlige på en trygg måte. Det må byttes ved første innlogging.
          </p>
        </div>
      )}

      {notice && <p style={{ ...muted, color: 'var(--theme-success-600)' }}>{notice}</p>}
      {error && <p style={danger}>{error}</p>}

      <div style={box}>
        {data && data.accounts.length === 0 && <p style={{ margin: 0 }}>Ingen brukerkontoer ennå.</p>}
        {data && data.accounts.length > 0 && (
          <table style={table}>
            <thead>
              <tr>
                <th style={cell}>Navn / e-post</th>
                <th style={cell}>Status</th>
                <th style={cell}>Opprettet via</th>
                <th style={cell}>Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.id}>
                  <td style={cell}>
                    <strong>{a.fullName || '—'}</strong>
                    <br />
                    {a.email}
                  </td>
                  <td style={cell}>
                    {STATUS_LABEL[a.status] ?? a.status}
                    {a.status === 'active' && a.mustChangePassword && <div style={muted}>Må bytte passord ved innlogging</div>}
                    {a.status === 'invited' && a.inviteExpiresAt && (
                      <div style={a.inviteExpired ? warn : muted}>
                        {a.inviteExpired ? 'Invitasjonen er utløpt' : `Invitasjon gyldig til ${osloDateTime(a.inviteExpiresAt)}`}
                      </div>
                    )}
                    {a.status === 'invited' && !a.inviteExpiresAt && <div style={warn}>Ingen gyldig invitasjon</div>}
                  </td>
                  <td style={cell}>
                    {PROVISIONING_LABEL[a.provisioning] ?? a.provisioning}
                    {a.createdAt && <div style={muted}>{osloDateTime(a.createdAt)}</div>}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                      {a.status === 'invited' && (
                        <Button buttonStyle="secondary" size="small" disabled={busy} onClick={() => void act(a, 'reinvite')}>
                          Send ny invitasjon
                        </Button>
                      )}
                      {a.status !== 'disabled' && (
                        <Button
                          buttonStyle="secondary"
                          size="small"
                          disabled={busy}
                          onClick={() => void act(a, 'reset-password', `Lage et nytt midlertidig passord for ${a.email}? Alle innloggede økter avsluttes.`)}
                        >
                          Nytt midlertidig passord
                        </Button>
                      )}
                      {a.status !== 'disabled' && (
                        <Button
                          buttonStyle="secondary"
                          size="small"
                          disabled={busy}
                          onClick={() => void act(a, 'revoke', `Stenge tilgangen for ${a.email}? Kontoen logges ut med en gang og kan ikke logge inn før den gjenopprettes.`)}
                        >
                          Steng tilgang
                        </Button>
                      )}
                      {a.status === 'disabled' && (
                        <Button buttonStyle="secondary" size="small" disabled={busy || open.length > 0} onClick={() => void act(a, 'restore')}>
                          Gjenopprett
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <hr style={rule} />
        {!creating && (
          <Button buttonStyle="primary" size="small" disabled={busy || !data || open.length > 0} onClick={() => setCreating(true)}>
            Opprett brukerkonto
          </Button>
        )}
        {!creating && open.length > 0 && <p style={muted}>Organisasjonen har allerede en aktiv eller invitert konto. Steng den først for å opprette en ny.</p>}

        {creating && (
          <div>
            <p style={heading}>Opprett brukerkonto</p>
            <label style={label} htmlFor="acct-name">
              Den ansvarliges navn
            </label>
            <input id="acct-name" style={input} value={form.fullName} maxLength={120} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            {fieldError?.field === 'fullName' && <p style={danger}>{fieldError.message}</p>}

            <label style={label} htmlFor="acct-email">
              E-post (brukes som innlogging)
            </label>
            <input id="acct-email" type="email" style={input} value={form.email} autoComplete="off" onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {fieldError?.field === 'email' && <p style={danger}>{fieldError.message}</p>}

            {needsOrgNumber && (
              <>
                <label style={label} htmlFor="acct-orgnr">
                  Organisasjonsnummer (9 sifre)
                </label>
                <input id="acct-orgnr" style={input} inputMode="numeric" value={form.organizationNumber} onChange={(e) => setForm({ ...form, organizationNumber: e.target.value })} />
                <p style={muted}>Organisasjonen har ikke registrert organisasjonsnummer. Det trengs for bedriftskunden.</p>
                {fieldError?.field === 'organizationNumber' && <p style={danger}>{fieldError.message}</p>}
              </>
            )}

            <span style={label}>Hvordan skal den ansvarlige få tilgang?</span>
            <label style={{ display: 'block', margin: '0.2rem 0' }}>
              <input type="radio" name="acct-method" checked={form.method === 'password'} onChange={() => setForm({ ...form, method: 'password' })} /> Midlertidig passord — jeg gir
              innloggingen videre selv. Passordet må byttes ved første innlogging.
            </label>
            <label style={{ display: 'block', margin: '0.2rem 0' }}>
              <input type="radio" name="acct-method" checked={form.method === 'invitation'} onChange={() => setForm({ ...form, method: 'invitation' })} /> E-postinvitasjon — den
              ansvarlige får en lenke (gyldig i 7 dager) og velger passord selv.
            </label>

            {form.method === 'password' && (
              <div style={{ marginTop: '0.4rem' }}>
                <label style={{ display: 'block', margin: '0.2rem 0' }}>
                  <input type="checkbox" checked={form.generate} onChange={(e) => setForm({ ...form, generate: e.target.checked, password: '' })} /> Lag et sterkt passord automatisk
                </label>
                {!form.generate && (
                  <>
                    <label style={label} htmlFor="acct-password">
                      Midlertidig passord
                    </label>
                    <input
                      id="acct-password"
                      type="text"
                      style={input}
                      autoComplete="off"
                      spellCheck={false}
                      value={form.password}
                      maxLength={128}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <p style={muted}>Minst 10 tegn, med minst én bokstav og ett tall.</p>
                  </>
                )}
                {fieldError?.field === 'password' && <p style={danger}>{fieldError.message}</p>}
              </div>
            )}

            {fieldError && !['fullName', 'email', 'password', 'organizationNumber'].includes(fieldError.field ?? '') && <p style={danger}>{fieldError.message}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
              <Button buttonStyle="primary" size="small" disabled={busy} onClick={() => void create()}>
                {form.method === 'password' ? 'Opprett konto' : 'Opprett og send invitasjon'}
              </Button>
              <Button
                buttonStyle="secondary"
                size="small"
                disabled={busy}
                onClick={() => {
                  setCreating(false)
                  setFieldError(null)
                }}
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
