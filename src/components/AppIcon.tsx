import type { SVGProps } from 'react'

export type AppIconName =
  | 'assignment'
  | 'camera'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'compass'
  | 'flag'
  | 'headphones'
  | 'microphone'
  | 'notebook'
  | 'parent'
  | 'quote'
  | 'results'
  | 'shield'
  | 'source'
  | 'spark'
  | 'star'
  | 'student'
  | 'teacher'
  | 'upload'
  | 'waypoint'

interface AppIconProps extends SVGProps<SVGSVGElement> {
  name: AppIconName
  title?: string
}

export function AppIcon({
  className,
  name,
  title,
  ...props
}: AppIconProps) {
  const iconClassName = ['app-icon', className].filter(Boolean).join(' ')

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      className={iconClassName}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {renderIcon(name)}
    </svg>
  )
}

function renderIcon(name: AppIconName) {
  switch (name) {
    case 'assignment':
      return (
        <>
          <rect x="5" y="4" width="14" height="16" rx="3" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </>
      )
    case 'camera':
      return (
        <>
          <path d="M7.5 7.5h2l1.2-2h2.6l1.2 2h2c1.38 0 2.5 1.12 2.5 2.5v6c0 1.38-1.12 2.5-2.5 2.5h-9c-1.38 0-2.5-1.12-2.5-2.5v-6c0-1.38 1.12-2.5 2.5-2.5Z" />
          <circle cx="12" cy="13" r="3.2" />
        </>
      )
    case 'check':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.7 12.2 2.2 2.2 4.5-4.8" />
        </>
      )
    case 'chevron':
      return <path d="m10 7 5 5-5 5" />
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5V12l3 1.8" />
        </>
      )
    case 'headphones':
      return (
        <>
          <path d="M5 14v-1.5a7 7 0 0 1 14 0V14" />
          <rect x="4" y="13.5" width="3.6" height="6" rx="1.6" />
          <rect x="16.4" y="13.5" width="3.6" height="6" rx="1.6" />
        </>
      )
    case 'compass':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m14.9 9.1-1.8 5-5 1.8 1.8-5 5-1.8Z" />
          <circle cx="12" cy="12" r="1.2" />
        </>
      )
    case 'flag':
      return (
        <>
          <path d="M7 20V5" />
          <path d="M8 6h8l-1.6 3L16 12H8Z" />
        </>
      )
    case 'microphone':
      return (
        <>
          <rect x="9" y="4" width="6" height="10" rx="3" />
          <path d="M7 11.5a5 5 0 0 0 10 0" />
          <path d="M12 16.5V20" />
          <path d="M9 20h6" />
        </>
      )
    case 'notebook':
      return (
        <>
          <path d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7Z" />
          <path d="M7 4.5a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 7 19.5" />
          <path d="M9 8.5h6" />
          <path d="M9 12h6" />
          <path d="M9 15.5h4.5" />
        </>
      )
    case 'parent':
      return (
        <>
          <circle cx="9" cy="9" r="2.4" />
          <circle cx="15.5" cy="10.3" r="1.9" />
          <path d="M5.8 18c.6-2.2 2.2-3.4 4.2-3.4S13.6 15.8 14.2 18" />
          <path d="M13.2 18c.35-1.55 1.45-2.45 2.95-2.45 1.28 0 2.25.76 2.65 2.45" />
        </>
      )
    case 'quote':
      return (
        <>
          <path d="M8.8 8.2C6.9 9 6 10.5 6 12.5V16h4.3v-4.2H8.5c0-1.25.6-2.2 1.9-2.95Z" />
          <path d="M16.8 8.2c-1.9.8-2.8 2.3-2.8 4.3V16h4.3v-4.2h-1.8c0-1.25.6-2.2 1.9-2.95Z" />
        </>
      )
    case 'results':
      return (
        <>
          <path d="M6 17.5 10 13l3 2.5 5-6" />
          <path d="M18 9.5V7h-2.5" />
          <path d="M5.5 5.5v13h13" />
        </>
      )
    case 'shield':
      return (
        <>
          <path d="M12 4.5 18 7v4.5c0 3.4-2.3 6.55-6 7.95-3.7-1.4-6-4.55-6-7.95V7Z" />
          <path d="m9.2 11.8 1.8 1.8 3.8-4" />
        </>
      )
    case 'source':
      return (
        <>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M9 9h6" />
          <path d="M9 12.5h6" />
          <path d="M9 16h3.5" />
        </>
      )
    case 'spark':
      return (
        <>
          <path d="m12 4 1.65 4.35L18 10l-4.35 1.65L12 16l-1.65-4.35L6 10l4.35-1.65Z" />
        </>
      )
    case 'star':
      return (
        <>
          <path d="m12 4.5 1.9 4 4.4.65-3.2 3.1.75 4.45L12 14.55 8.15 16.7l.75-4.45-3.2-3.1 4.4-.65Z" />
        </>
      )
    case 'student':
      return (
        <>
          <path d="m12 5 7 3.5-7 3.5-7-3.5Z" />
          <path d="M8 10.4V14c0 1.7 1.8 3 4 3s4-1.3 4-3v-3.6" />
        </>
      )
    case 'teacher':
      return (
        <>
          <rect x="5" y="6" width="14" height="10" rx="2" />
          <path d="M8.5 19h7" />
          <path d="M9 10h6" />
          <path d="M9 13h3.5" />
        </>
      )
    case 'upload':
      return (
        <>
          <path d="M12 15V6" />
          <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
          <path d="M6 16.5v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
        </>
      )
    case 'waypoint':
      return (
        <>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M12 4v3" />
          <path d="M20 12h-3" />
          <path d="M12 20v-3" />
          <path d="M4 12h3" />
        </>
      )
  }
}
