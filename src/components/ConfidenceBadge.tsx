import { AppIcon } from './AppIcon'
import type { AccommodationConfidence } from '../lib/schema/analysisSchema'

const CONFIDENCE_LABELS: Record<AccommodationConfidence, string> = {
  likely_relevant: 'Likely relevant',
  possibly_relevant: 'Possibly relevant',
  unclear_confirm: 'Unclear, confirm with staff',
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
    <span className={`confidence-badge confidence-badge--${confidence}`}>
      <AppIcon name={CONFIDENCE_ICONS[confidence]} />
      {CONFIDENCE_LABELS[confidence]}
    </span>
  )
}
