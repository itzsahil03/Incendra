import { useEffect, useRef } from 'react'

const HERO_VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4'

const OVERLAYS = {
  /** Full-bleed hero (Home): stays fairly transparent so the video reads through. */
  hero: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.42) 35%, rgba(10,8,20,0.78) 100%)',
  /** Page intros (About/Services/Contact): fades to solid black at the bottom so the
   *  hero blends seamlessly into the page's black content sections below it. */
  page: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.55) 45%, #000000 100%)',
  /** Auth split layout: a touch darker, tuned for the narrower panel. */
  split: 'linear-gradient(160deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.45) 40%, rgba(10,8,20,0.85) 100%)',
  /** Authenticated app hero (Dashboard): heavier/directional so it reads as a backdrop
   *  behind stat numbers and body copy, not a focal image. */
  app: 'linear-gradient(105deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 45%, rgba(10,8,20,0.55) 100%)',
} as const

/** Full-bleed looping background video used behind marketing/auth/app hero sections,
 *  with a dark gradient overlay for text contrast. Autoplay is retried on the events
 *  browsers commonly interrupt it on, since muted autoplay isn't always guaranteed. */
export function HeroBackground({ overlay = 'page', videoOpacity = 1 }: { overlay?: keyof typeof OVERLAYS; videoOpacity?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const tryPlay = () => {
      video.muted = true
      video.play().catch(() => {})
    }
    tryPlay()
    const events = ['loadeddata', 'canplay', 'pause'] as const
    events.forEach((event) => video.addEventListener(event, tryPlay))
    document.addEventListener('visibilitychange', tryPlay)
    return () => {
      events.forEach((event) => video.removeEventListener(event, tryPlay))
      document.removeEventListener('visibilitychange', tryPlay)
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden>
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        style={{ opacity: videoOpacity }}
        className="absolute inset-0 size-full object-cover"
      >
        <source src={HERO_VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="absolute inset-0" style={{ background: OVERLAYS[overlay] }} />
    </div>
  )
}
