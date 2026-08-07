'use client'

import { useRef, useState, type CSSProperties } from 'react'

/**
 * A video that costs nothing until the visitor presses play.
 *
 * The MP4 URL lives in `data-src` and is only assigned to `video.src` on the
 * first press, so no request ever reaches Vercel Blob for visitors who don't
 * ask for the video — including copies that sit behind a responsive
 * breakpoint. `preload="none"` keeps the browser from touching it afterwards
 * until playback actually starts.
 *
 * The URL is deliberately kept out of JSX: re-rendering a <video> with a `src`
 * prop re-runs the media load algorithm, which would fetch the file twice.
 */
export default function ClickToPlayVideo({
  src,
  poster,
  label,
  muted = false,
  playsInline = true,
  controlsWhenPlaying = false,
  placeholderBackground = '#efe6d3',
  buttonSize = 52,
  wrapperStyle,
  videoStyle,
}: {
  src: string
  /** Resolved by the caller — the element renders it as given, never rewrites it. */
  poster?: string
  /** Accessible name for the play button, e.g. "Spill av film om aBoks". */
  label: string
  muted?: boolean
  playsInline?: boolean
  /** Hand over to the native player once started (big, standalone videos). */
  controlsWhenPlaying?: boolean
  /** Sits behind the poster, so it only shows while that image loads. */
  placeholderBackground?: string
  buttonSize?: number
  wrapperStyle?: CSSProperties
  videoStyle?: CSSProperties
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)

  /** First press attaches the URL and starts; later presses just toggle. */
  function togglePlay() {
    const v = videoRef.current
    if (!v) return

    if (!started) {
      v.src = src
      v.load()
      setStarted(true)
      v.play().catch(() => {})
      return
    }

    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  // Once the native controls are visible they own play/pause, so the overlay
  // steps aside for good. Without them the button comes back on every pause.
  const showButton = controlsWhenPlaying ? !started : !playing

  return (
    <div
      onClick={() => {
        // Native controls handle their own clicks — don't fight them.
        if (controlsWhenPlaying && started) return
        togglePlay()
      }}
      style={{
        position: 'relative',
        background: placeholderBackground,
        cursor: controlsWhenPlaying && started ? 'default' : 'pointer',
        ...wrapperStyle,
      }}
    >
      <video
        ref={videoRef}
        data-src={src}
        preload="none"
        muted={muted}
        playsInline={playsInline}
        poster={poster}
        controls={controlsWhenPlaying && started}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={videoStyle}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          opacity: showButton ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        <button
          type="button"
          aria-label={label}
          tabIndex={showButton ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          style={{
            width: `${buttonSize}px`,
            height: `${buttonSize}px`,
            borderRadius: '50%',
            border: 'none',
            padding: 0,
            background: 'rgba(250,246,238,0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: showButton ? 'auto' : 'none',
            boxShadow: '0 4px 16px -6px rgba(42,36,24,.4)',
          }}
        >
          <svg
            width={buttonSize * 0.27}
            height={buttonSize * 0.31}
            viewBox="0 0 14 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M1.5 1.5L12.5 8L1.5 14.5V1.5Z" fill="#3a3f33" />
          </svg>
        </button>
      </div>
    </div>
  )
}
