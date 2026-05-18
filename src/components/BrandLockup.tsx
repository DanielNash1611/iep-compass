import { useId } from 'react'

type BrandLockupElement = 'div' | 'h1'

interface BrandLockupProps {
  as?: BrandLockupElement
  className?: string
  compact?: boolean
}

export function BrandLockup({
  as: Component = 'div',
  className,
  compact = false,
}: BrandLockupProps) {
  const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const titleGradientId = `brand-title-${idPrefix}`
  const roseGradientId = `brand-rose-${idPrefix}`
  const sparkGradientId = `brand-spark-${idPrefix}`

  const lockupClassName = ['brand-lockup', compact && 'brand-lockup--compact', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={lockupClassName}>
      <span className="brand-lockup__mark" aria-hidden="true">
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 120 120"
          className="brand-lockup__mark-svg"
        >
          <defs>
            <radialGradient id={titleGradientId} cx="42%" cy="36%" r="68%">
              <stop offset="0%" stopColor="#f6f3ea" />
              <stop offset="56%" stopColor="#cfe9e4" />
              <stop offset="100%" stopColor="#19474d" />
            </radialGradient>
            <linearGradient id={roseGradientId} x1="20%" y1="18%" x2="82%" y2="88%">
              <stop offset="0%" stopColor="#9ee0d5" />
              <stop offset="42%" stopColor="#4e8f88" />
              <stop offset="100%" stopColor="#173f45" />
            </linearGradient>
            <linearGradient id={sparkGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffd889" />
              <stop offset="100%" stopColor="#ff9f2a" />
            </linearGradient>
          </defs>

          <circle cx="60" cy="60" r="50" fill="none" stroke={`url(#${roseGradientId})`} strokeWidth="4.25" />
          <circle cx="60" cy="60" r="45" fill={`url(#${titleGradientId})`} opacity="0.18" />

          <g fill="#efe9d7" opacity="0.88">
            <circle cx="60" cy="15.5" r="2" />
            <circle cx="86.5" cy="24.5" r="2" />
            <circle cx="104.5" cy="60" r="2" />
            <circle cx="86.5" cy="95.5" r="2" />
            <circle cx="60" cy="104.5" r="2" />
            <circle cx="33.5" cy="95.5" r="2" />
            <circle cx="15.5" cy="60" r="2" />
            <circle cx="33.5" cy="24.5" r="2" />
          </g>

          <path
            d="M60 17 67.25 52.75 103 60 67.25 67.25 60 103 52.75 67.25 17 60 52.75 52.75Z"
            fill={`url(#${roseGradientId})`}
            opacity="0.95"
          />
          <path
            d="M60 29.5 68.4 51.6 90.5 60 68.4 68.4 60 90.5 51.6 68.4 29.5 60 51.6 51.6Z"
            fill="#e5f4ef"
            opacity="0.38"
          />

          <circle cx="60" cy="60" r="10" fill="#f8f6f1" />
          <circle cx="60" cy="60" r="5.8" fill="none" stroke="#173f45" strokeWidth="1.25" opacity="0.28" />
          <circle cx="60" cy="60" r="3.3" fill="#173f45" opacity="0.26" />

          <path
            d="M60 6.5 63.5 16 73 19.5 63.5 23 60 32.5 56.5 23 47 19.5 56.5 16Z"
            fill={`url(#${sparkGradientId})`}
            style={{ filter: 'drop-shadow(0 0 8px rgba(255, 166, 42, 0.52))' }}
          />
          <path
            d="M60 8.5 62.35 15.65 69.5 18 62.35 20.35 60 27.5 57.65 20.35 50.5 18 57.65 15.65Z"
            fill="#fff6dc"
            opacity="0.7"
          />
        </svg>
      </span>

      <span className="brand-lockup__wordmark">
        <span className="brand-lockup__name">IEP Compass</span>
        <span className="brand-lockup__underline" aria-hidden="true" />
      </span>
    </Component>
  )
}
