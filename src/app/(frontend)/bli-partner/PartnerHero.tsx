'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { anchorClick } from '@/lib/anchorScroll'
import { PARTNER_HERO, PARTNER_HERO_IMAGE } from '@/lib/partnerProgram/content'
import { CREAM, GOLD, INK, SANS, SERIF } from '../bedrifter/theme'
import { Icon } from './ui'
import styles from './bliPartner.module.css'

/**
 * Full-viewport hero for /bli-partner.
 *
 * Background: the two Blob images in `PARTNER_HERO_IMAGE` (mobile below `md`, desktop from
 * `md`), under a dark gradient for legibility. With no image configured it falls back to a
 * gradient composition rather than a broken image — and a single configured image is used at
 * every width.
 *
 * Motion: the copy and the gold lines are CSS-animated (see `bliPartner.module.css` for why);
 * the only JS-driven effect is a gentle parallax on the background, which is switched off
 * under reduced motion.
 *
 * The section starts at the top of the page, so the fixed header's nav row sits on the image.
 * This route is in Header's `HERO_TOP_ROUTES` (transparent at the top, like the homepage) and
 * `DARK_HERO_TOP_ROUTES` (cream nav text and a white logo while transparent); the scrim below
 * keeps that row readable whatever the photo looks like at the top.
 */

const POINTS = ['Gratis å søke', 'Ingen varelager', 'Hele Norge']

export default function PartnerHero() {
  const ref = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '10%'])

  const desktop = PARTNER_HERO_IMAGE.desktop || PARTNER_HERO_IMAGE.mobile
  const mobile = PARTNER_HERO_IMAGE.mobile || PARTNER_HERO_IMAGE.desktop
  const hasImage = Boolean(desktop)

  const words = PARTNER_HERO.headline.split(' ')

  return (
    <section
      ref={ref}
      aria-labelledby="partner-hero-title"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden"
      style={{ background: INK }}
    >
      {/* ── background ── */}
      <motion.div aria-hidden="true" className="absolute inset-[-6%_0_-6%_0] -z-20" style={{ y }}>
        {hasImage ? (
          <>
            <div className="absolute inset-0 md:hidden">
              <Image
                src={mobile}
                alt={PARTNER_HERO_IMAGE.alt}
                fill
                priority
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
              />
            </div>
            <div className="absolute inset-0 hidden md:block">
              <Image
                src={desktop}
                alt={PARTNER_HERO_IMAGE.alt}
                fill
                priority
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: 'center' }}
              />
            </div>
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 85% 10%, #5e6a48 0%, rgba(94,106,72,0) 55%), radial-gradient(90% 70% at 10% 90%, #4a3f2a 0%, rgba(74,63,42,0) 60%), linear-gradient(160deg, #2a2f22 0%, #1a1d17 70%)',
            }}
          />
        )}
      </motion.div>

      {/* Legibility: darker at the bottom where the copy sits on mobile, and on the left
          where it sits from `md` up. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,22,17,.45) 0%, rgba(20,22,17,.25) 38%, rgba(20,22,17,.88) 100%)',
        }}
      />
      {/* Mobile only: the copy sits at the top below `md`, and its last lines fall over the
          lighter window and wall in the mobile photo. This deepens that band and fades out
          before the people, so the image itself is unchanged where nothing sits on it. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 md:hidden"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,22,17,.25) 0%, rgba(20,22,17,.32) 38%, rgba(20,22,17,0) 56%)',
        }}
      />
      {/* Header scrim: a little extra depth behind the transparent nav row. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10"
        style={{ height: '200px', background: 'linear-gradient(180deg, rgba(20,22,17,.5) 0%, rgba(20,22,17,0) 100%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden md:block"
        style={{
          background: 'linear-gradient(90deg, rgba(20,22,17,.78) 0%, rgba(20,22,17,.35) 55%, rgba(20,22,17,0) 100%)',
        }}
      />

      {/* ── decoration: soft light and two drawn gold lines ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className={styles.orb}
          style={{
            position: 'absolute',
            right: '-12%',
            top: '8%',
            width: 'min(60vw,640px)',
            aspectRatio: '1',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,167,106,.22) 0%, rgba(201,167,106,0) 65%)',
          }}
        />
        <div
          className={styles.orbSlow}
          style={{
            position: 'absolute',
            left: '-18%',
            bottom: '-10%',
            width: 'min(70vw,720px)',
            aspectRatio: '1',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(230,236,223,.12) 0%, rgba(230,236,223,0) 65%)',
          }}
        />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <path
            className={styles.line}
            pathLength={1}
            d="M-40 720 C 320 640, 520 820, 860 690 S 1300 520, 1500 580"
            stroke={GOLD}
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <path
            className={styles.line}
            style={{ animationDelay: '0.9s' }}
            pathLength={1}
            d="M-40 780 C 360 700, 600 880, 940 760 S 1320 610, 1500 660"
            stroke={CREAM}
            strokeOpacity="0.18"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* ── copy ──
          Below `md` the /bedrifter mobile pattern: a full-height column with the text group
          directly under the header (same top padding) and the actions pushed to the bottom
          by `mt-auto`. From `md` up the inner block is plain and centred, exactly as before. */}
      <div className="max-w-container mx-auto flex w-full flex-1 flex-col px-[clamp(20px,5vw,48px)] pb-[calc(clamp(88px,14vh,128px)+env(safe-area-inset-bottom))] pt-[clamp(88px,22vw,120px)] md:justify-center md:pb-[clamp(96px,12vh,140px)] md:pt-[clamp(120px,18vh,160px)]">
        <div className="flex max-w-[680px] flex-1 flex-col text-center md:block md:flex-none md:text-left">
          <p
            className={styles.rise}
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: GOLD,
              margin: '0 0 20px',
              animationDelay: '0.05s',
            }}
          >
            {PARTNER_HERO.eyebrow}
          </p>

          <h1
            id="partner-hero-title"
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: 'clamp(44px,7.2vw,96px)',
              letterSpacing: '-0.025em',
              lineHeight: 1.0,
              color: CREAM,
              margin: '0 0 24px',
            }}
          >
            {words.map((word, i) => (
              <span key={`${word}-${i}`}>
                <span className={styles.word}>
                  <span
                    className={styles.wordInner}
                    style={{
                      animationDelay: `${0.15 + i * 0.09}s`,
                      ...(word === 'aBoks' ? { fontStyle: 'italic', color: '#e4d3ae' } : null),
                    }}
                  >
                    {word}
                  </span>
                </span>
                {i < words.length - 1 ? ' ' : null}
              </span>
            ))}
          </h1>

          <p
            className={`${styles.rise} mx-auto md:mx-0`}
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(16px,1.45vw,19px)',
              lineHeight: 1.65,
              color: 'rgba(250,246,238,.86)',
              marginTop: 0,
              marginBottom: '34px',
              maxWidth: '52ch',
              animationDelay: '0.55s',
            }}
          >
            {PARTNER_HERO.subheadline}
          </p>

          {/* Actions: pinned to the bottom on mobile (with at least 40px above them), in the
              normal flow from `md`. */}
          <div className="mt-auto pt-10 md:mt-0 md:pt-0">
            <div
              className={`${styles.rise} mx-auto flex w-full max-w-[380px] flex-wrap gap-3 md:mx-0 md:max-w-none`}
              style={{ animationDelay: '0.7s' }}
            >
              <a
                href="#sok"
                data-btn
                onClick={anchorClick('sok')}
                className="inline-flex grow basis-[calc(50%-6px)] items-center justify-center gap-2 whitespace-nowrap rounded-full px-8 md:grow-0 md:basis-auto"
                style={{
                  minHeight: '54px',
                  background: CREAM,
                  color: INK,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: '15px',
                  textDecoration: 'none',
                }}
              >
                {PARTNER_HERO.primaryCta}
                <span className={styles.ctaArrow}>
                  <Icon name="arrow" size={18} color={INK} strokeWidth={2} />
                </span>
              </a>
              <a
                href="#slik-fungerer-det"
                data-btn
                onClick={anchorClick('slik-fungerer-det')}
                className="inline-flex grow basis-[calc(50%-6px)] items-center justify-center whitespace-nowrap rounded-full px-8 md:grow-0 md:basis-auto"
                style={{
                  minHeight: '54px',
                  background: 'rgba(250,246,238,.08)',
                  color: CREAM,
                  border: '1.5px solid rgba(250,246,238,.45)',
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: '15px',
                  textDecoration: 'none',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                }}
              >
                {PARTNER_HERO.secondaryCta}
              </a>
            </div>

            <ul
              className={`${styles.rise} mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-start`}
              style={{ listStyle: 'none', padding: 0, animationDelay: '0.85s' }}
            >
              {POINTS.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-2"
                  style={{ fontFamily: SANS, fontWeight: 600, fontSize: '14px', color: 'rgba(250,246,238,.82)' }}
                >
                  <Icon name="check" size={16} color={GOLD} strokeWidth={2.2} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── scroll cue ── */}
      {/* Centred by a full-width wrapper, not a translate: the entrance animation owns the
          link's `transform`. */}
      <div
        className="pointer-events-none absolute inset-x-0 hidden justify-center sm:flex"
        style={{ bottom: 'calc(28px + env(safe-area-inset-bottom))' }}
      >
        <a
          href="#programmer"
          data-btn
          onClick={anchorClick('programmer')}
          aria-label="Bla ned til partnerprogrammene"
          className={`${styles.rise} pointer-events-auto flex flex-col items-center gap-2`}
          style={{
            animationDelay: '1.2s',
            textDecoration: 'none',
            color: 'rgba(250,246,238,.7)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              width: '26px',
              height: '42px',
              borderRadius: '999px',
              border: '1.5px solid rgba(250,246,238,.5)',
              position: 'relative',
            }}
          >
            <span
              className={styles.scrollDot}
              style={{
                position: 'absolute',
                left: '50%',
                top: '8px',
                width: '4px',
                height: '8px',
                marginLeft: '-2px',
                borderRadius: '999px',
                background: CREAM,
              }}
            />
          </span>
          <span
            aria-hidden="true"
            style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            Utforsk
          </span>
        </a>
      </div>
    </section>
  )
}
