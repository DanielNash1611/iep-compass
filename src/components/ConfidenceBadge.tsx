import { AppIcon } from './AppIcon'
import type { AccommodationConfidence } from '../lib/schema/analysisSchema'

const CONFIDENCE_LABELS: Record<AccommodationConfidence, string> = {
  likely_relevant: 'Strong fit',
  possibly_relevant: 'Might fit',
  unclear_confirm: 'Ask a teacher',
}

const CONFIDENCE_ICONS: Record<
  AccommodationConfidence,
  'check' | 'compass' | 'flag'
> = {
  likely_relevant: 'check',
  possibly_relevant: 'compass',
  unclear_confirm: 'flag',
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: AccommodationConfidence
}) {
  return (
    <span
      className={`confidence-badge confidence-badge--${confidence}`}
      aria-label={`How well this fits: ${CONFIDENCE_LABELS[confidence]}`}
    >
      <AppIcon name={CONFIDENCE_ICONS[confidence]} />
      {CONFIDENCE_LABELS[confidence]}
    </span>
  )
}
