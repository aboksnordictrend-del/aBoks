'use client'

import Image from 'next/image'

interface VideoPlaceholderProps {
  thumbnail: string
  label?: string
  duration?: string
}

export default function VideoPlaceholder({
  thumbnail,
  label = 'Produktvideo',
  duration,
}: VideoPlaceholderProps) {
  return (
    <button
      aria-label="Spill av film"
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: '24px',
        overflow: 'hidden',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        background: '#e7d9bd',
        boxShadow: '0 24px 56px -20px rgba(42,36,24,.3)',
      }}
    >
      <Image
        src={thumbnail}
        alt="aBoks film"
        fill
        sizes="(max-width: 1100px) 100vw, 1100px"
        style={{ objectFit: 'cover', opacity: 0.92 }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,29,23,.12)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: '84px',
          height: '84px',
          borderRadius: '999px',
          background: 'rgba(250,246,238,.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#39402c">
          <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.6-6.8a.6.6 0 0 0 0-1l-10.6-6.8a.6.6 0 0 0-.92.5z" />
        </svg>
      </span>
      <span
        style={{
          position: 'absolute',
          left: '24px',
          bottom: '22px',
          fontFamily: 'var(--font-manrope)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: '#faf6ee',
          background: 'rgba(26,29,23,.5)',
          padding: '7px 14px',
          borderRadius: '999px',
        }}
      >
        {duration ? `${label} · ${duration}` : label}
      </span>
    </button>
  )
}
