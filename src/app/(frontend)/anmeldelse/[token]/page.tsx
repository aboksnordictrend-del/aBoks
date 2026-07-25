import type { Metadata } from 'next'
import Link from 'next/link'
import { resolveInvitation } from '@/lib/reviewServer'
import { turnstileSiteKey } from '@/lib/turnstile'
import ReviewForm from './ReviewForm'

// Token validation must run per request and must never be cached.
export const dynamic = 'force-dynamic'

// Private, personal page — keep it out of search indexes.
export const metadata: Metadata = {
  title: 'Gi en anmeldelse | aBoks',
  robots: { index: false, follow: false },
}

const wrapStyle: React.CSSProperties = {
  maxWidth: '720px',
  margin: '0 auto',
  padding: 'clamp(96px,12vw,140px) clamp(20px,5vw,32px) clamp(64px,8vw,96px)',
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8e0d4',
  borderRadius: '16px',
  padding: 'clamp(28px,5vw,48px)',
}

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(26px,3.4vw,38px)',
  letterSpacing: '-0.01em',
  lineHeight: 1.1,
  color: '#1a1d17',
  margin: '0 0 12px',
}

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,16px)',
  lineHeight: 1.7,
  color: '#4a4e41',
  margin: '0 0 8px',
}

function StateCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={wrapStyle}>
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <h1 style={headingStyle}>{title}</h1>
        <div style={{ marginTop: '8px' }}>{children}</div>
      </div>
    </div>
  )
}

const kontaktLink = (
  <p style={{ ...bodyStyle, marginTop: '20px' }}>
    <Link href="/kontakt" style={{ color: '#5e6a48', fontWeight: 600 }}>
      Kontakt oss
    </Link>
  </p>
)

export default async function ReviewTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { state, dto } = await resolveInvitation(token)

  if (state === 'expired') {
    return (
      <StateCard title="Denne lenken har utløpt">
        <p style={bodyStyle}>Kontakt oss dersom du ønsker en ny lenke.</p>
        {kontaktLink}
      </StateCard>
    )
  }

  if (state === 'used') {
    return (
      <StateCard title="Takk!">
        <p style={bodyStyle}>Denne lenken er allerede brukt.</p>
        <p style={{ ...bodyStyle, marginTop: '16px' }}>
          <Link href="/anmeldelser" style={{ color: '#5e6a48', fontWeight: 600 }}>
            Se anmeldelser fra våre kunder
          </Link>
        </p>
      </StateCard>
    )
  }

  if (state !== 'valid' || !dto) {
    return (
      <StateCard title="Lenken er ugyldig">
        <p style={bodyStyle}>Lenken er ugyldig eller ikke lenger aktiv.</p>
        {kontaktLink}
      </StateCard>
    )
  }

  return (
    <div style={wrapStyle}>
      <ReviewForm token={token} dto={dto} turnstileSiteKey={turnstileSiteKey()} />
    </div>
  )
}
