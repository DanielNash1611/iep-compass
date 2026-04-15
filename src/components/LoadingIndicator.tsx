interface LoadingIndicatorProps {
  label: string
  size?: 'sm' | 'md'
}

export function LoadingIndicator({
  label,
  size = 'md',
}: LoadingIndicatorProps) {
  return (
    <span className={`loading-indicator loading-indicator--${size}`}>
      <span className="loading-indicator__spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
