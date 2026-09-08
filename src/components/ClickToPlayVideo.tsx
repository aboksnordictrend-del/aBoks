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
  resetOnEnd = false,
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
  /**
   * Return to the poster and the play button when the video ends, instead of
   * leaving the last frame frozen on screen. Only sensible when the poster is
   * that last frame, so nothing visibly jumps.
   *
   * This also paints the poster as a real <img> layer above the video whenever
   * playback is not running — see the note on `posterLayer` below.
   */
  resetOnEnd?: boolean
  /** Sits behind the poster, so it only shows while that image loads. */
  placeholderBackground?: string
  buttonSize?: number
  wrapperStyle?: CSSProperties
  videoStyle?: CSSProperties
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const posterRef = useRef<HTMLImageElement>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)

  /**
   * Raise or drop the poster layer in the current task, ahead of React's commit.
   * The rendered style derives from `started` and settles on the same value, so
   * this only decides *when* the flip lands, never what it lands on.
   */
  function showPosterNow(visible: boolean) {
    const el = posterRef.current
    if (el) el.style.opacity = visible ? '1' : '0'
  }

  /** First press attaches the URL and starts; later presses just toggle. */
  function togglePlay() {
    const v = videoRef.current
    if (!v) return

    if (!started) {
      // The video is already parked on frame 0 after a `resetOnEnd` reset, and on
      // a first press its own `poster` attribute still covers it, so dropping the
      // layer first reveals the same picture either way — no flash.
      showPosterNow(false)
      // The URL is attached once. A restart after `resetOnEnd` re-uses the media
      // already in the element — re-assigning `src` would re-run the load
      // algorithm and, on iOS, throw away the buffered file for no gain.
      if (!v.currentSrc && !v.src) {
        v.src = src
        v.load()
      } else if (v.currentTime !== 0) {
        v.currentTime = 0
      }
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

  // iOS Safari repaints `<video poster>` only while the element has never held
  // media; once it has played, neither `removeAttribute('src') + load()` nor a
  // rewind reliably brings the poster back, and the box goes blank. So for
  // `resetOnEnd` the still is painted as an ordinary <img> above the video and
  // only faded out while playback runs — nothing depends on the browser's poster
  // behaviour. It resolves to the same URL as the `poster` attribute, so it is
  // one request, not two.
  //
  // The layer stays mounted and switches on `opacity` alone: `display` would
  // hand WebKit a layout and a decode to do at the exact moment the video ends,
  // which is what the flip is trying to hide.
  const posterLayer = resetOnEnd && poster

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
        onEnded={() => {
          setPlaying(false)
          if (!resetOnEnd) return
          const v = videoRef.current
          if (!v) return
          // Cover the video before touching it. React's commit is a task away,
          // while WebKit repaints the element the instant it is rewound, so a
          // state update alone leaves a window in which frame 0 flashes through.
          showPosterNow(true)
          setStarted(false)
          // Rewind only once that cover has actually been painted: the first
          // frame callback runs before the paint, the second after it.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const el = videoRef.current
              if (!el) return
              el.pause()
              try {
                el.currentTime = 0
              } catch {
                // Seeking can throw if the media was evicted; the poster still
                // shows and the next press reloads from the URL.
              }
            })
          })
        }}
        style={videoStyle}
      />
      {posterLayer && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={posterRef}
          src={poster}
          alt=""
          aria-hidden="true"
          draggable={false}
          // Decoded up front so raising the layer is never waiting on an image.
          decoding="sync"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            // Above the video, below the play button. No transition: the swap
            // has to land in the frame it is made in.
            zIndex: 1,
            opacity: started ? 0 : 1,
            transition: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 2,
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
